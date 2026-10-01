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
import type { CreateDesignationDto } from "./dto/create-designation.dto.js";
import type { UpdateDesignationDto } from "./dto/update-designation.dto.js";

const ENTITY_TYPE = "designation";

type DesignationRow = Prisma.DesignationGetPayload<object>;

export interface DesignationFilter {
  search?: string | undefined;
  isActive?: boolean | undefined;
  sortBy?: "name" | "code" | "createdAt" | undefined;
}

/** Allow-listed fields recorded in the audit trail (never the raw row). */
function snapshot(row: DesignationRow) {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
  };
}

/** The only place `PrismaService` is called for this module. Every write runs
 * in one transaction together with its audit row, so the two commit or roll
 * back as one. */
@Injectable()
export class DesignationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: DesignationFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.DesignationWhereInput>(scope, {
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
      this.prisma.designation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "name"]: pagination.order ?? "asc" },
          { id: "asc" },
        ],
      }),
      this.prisma.designation.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.designation.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.designation.findFirst({
      where: tenantWhere(scope, { code, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.designation.findFirst({
      where: tenantWhere<Prisma.DesignationWhereInput>(scope, {
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateDesignationDto, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.designation.create({
          data: {
            ...dto,
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
    dto: UpdateDesignationDto,
    actorId: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.designation.findFirst({
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

        const after = await tx.designation.update({
          where: { id },
          data: {
            ...changed,
            updatedBy: actorId,
          } as Prisma.DesignationUncheckedUpdateInput,
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
      const before = await tx.designation.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      if (before.isActive === isActive) return before;

      const after = await tx.designation.update({
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
          "A designation with this code or name already exists",
        )
      : error;
  }
}
