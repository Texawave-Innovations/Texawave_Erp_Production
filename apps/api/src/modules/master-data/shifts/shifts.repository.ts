import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { ResourceConflictException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateShiftDto } from "./dto/create-shift.dto.js";
import type { UpdateShiftDto } from "./dto/update-shift.dto.js";
import { assertShiftTimes } from "./shift-time.js";

const ENTITY_TYPE = "shift";

type ShiftRow = Prisma.ShiftGetPayload<object>;

export interface ShiftFilter {
  search?: string | undefined;
  isActive?: boolean | undefined;
  sortBy?: "name" | "code" | "createdAt" | undefined;
}

/** Allow-listed fields recorded in the audit trail (never the raw row). */
function snapshot(row: ShiftRow) {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    startTime: row.startTime,
    endTime: row.endTime,
    isOvernight: row.isOvernight,
    workingMinutes: row.workingMinutes,
  };
}

/** The only place `PrismaService` is called for this module. Every write runs
 * in one transaction together with its audit row, so the two commit or roll
 * back as one. */
@Injectable()
export class ShiftsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ShiftFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ShiftWhereInput>(scope, {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: "insensitive" } },
              { name: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "name"]: pagination.order ?? "asc" },
          { id: "asc" },
        ],
      }),
      this.prisma.shift.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.shift.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.shift.findFirst({
      where: tenantWhere(scope, { code, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.shift.findFirst({
      where: tenantWhere<Prisma.ShiftWhereInput>(scope, {
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateShiftDto, actorId: number) {
    try {
      // Validate (and derive isOvernight) before opening the transaction.
      const { isOvernight } = assertShiftTimes(dto);
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.shift.create({
          data: {
            ...dto,
            isOvernight,
            description: dto.description || null,
            organizationId: scope.organizationId,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: row.id,
          action: "create",
          after: snapshot(row),
        });
        return row;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /** Returns `null` when the row does not exist in this organization, and the
   * unchanged row (no write, no audit entry) when nothing actually changes. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateShiftDto,
    actorId: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.shift.findFirst({
          where: tenantWhere(scope, { id, deletedAt: null }),
        });
        if (!before) return null;

        const changed: Record<string, unknown> = {};
        for (const [key, raw] of Object.entries(
          dto as Record<string, unknown>,
        )) {
          if (raw === undefined) continue;
          const value = key === "description" && raw === "" ? null : raw;
          if ((before as Record<string, unknown>)[key] !== value) {
            changed[key] = value;
          }
        }
        if (Object.keys(changed).length === 0) return before;

        // Re-validate the WHOLE resulting shift, not just the changed field:
        // moving only the end time can make the stored working duration
        // impossible. isOvernight follows the times, never the client.
        if (
          "startTime" in changed ||
          "endTime" in changed ||
          "workingMinutes" in changed
        ) {
          const merged = {
            startTime:
              (changed.startTime as string | undefined) ?? before.startTime,
            endTime: (changed.endTime as string | undefined) ?? before.endTime,
            workingMinutes:
              (changed.workingMinutes as number | undefined) ??
              before.workingMinutes,
          };
          changed.isOvernight = assertShiftTimes(merged).isOvernight;
        }

        const after = await tx.shift.update({
          where: { id },
          data: {
            ...changed,
            updatedBy: actorId,
          } as Prisma.ShiftUncheckedUpdateInput,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "update",
          before: snapshot(before),
          after: snapshot(after),
        });
        return after;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  @OrgScoped()
  async setActive(
    scope: OrgScope,
    id: number,
    isActive: boolean,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.shift.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      if (before.isActive === isActive) return before;

      if (!isActive) {
        // A shift still assigned to someone (or a team) from today onwards
        // cannot be switched off: attendance would resolve an inactive shift.
        // End or void those assignments first. "Today" is the UTC date; the
        // business time zone is an open attendance decision.
        const today = new Date(
          new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
        );
        const inUse = await tx.shiftAssignment.count({
          where: {
            shiftId: id,
            organizationId: scope.organizationId,
            isActive: true,
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          },
        });
        if (inUse > 0) {
          throw new ResourceConflictException(
            `Shift is still assigned (${inUse} current or future assignment(s)) — end or void them first`,
          );
        }
      }

      const after = await tx.shift.update({
        where: { id },
        data: { isActive, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: isActive ? "activate" : "deactivate",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** A unique-constraint race the service's pre-check could not see. */
  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          "A shift with this code or name already exists",
        )
      : error;
  }
}
