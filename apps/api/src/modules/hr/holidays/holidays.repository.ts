import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { classifyDbError } from "../../../common/database/db-errors.js";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateHolidayDto, UpdateHolidayDto } from "./dto/holiday.dto.js";

const ENTITY_TYPE = "holiday";
const INCLUDE = {
  workLocation: { select: { id: true, code: true, name: true } },
} satisfies Prisma.HolidayInclude;
type HolidayRow = Prisma.HolidayGetPayload<{ include: typeof INCLUDE }>;

export interface HolidayView {
  id: number;
  holidayDate: string;
  name: string;
  description: string | null;
  /** `null` = the whole organization. */
  workLocation: { id: number; code: string; name: string } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toHolidayView(row: HolidayRow): HolidayView {
  return {
    id: row.id,
    holidayDate: formatDateOnly(row.holidayDate),
    name: row.name,
    description: row.description,
    workLocation: row.workLocation,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: HolidayRow) {
  return {
    holidayDate: formatDateOnly(row.holidayDate),
    name: row.name,
    description: row.description,
    workLocationId: row.workLocation?.id ?? null,
    isActive: row.isActive,
  };
}

export interface HolidayFilter {
  year?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
  workLocationId?: number | undefined;
  organizationWide?: boolean | undefined;
  isActive?: boolean | undefined;
}

@Injectable()
export class HolidaysRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: HolidayFilter,
    pagination: PaginationDto,
  ) {
    const lower = filter.from
      ? parseDateOnly(filter.from)
      : filter.year !== undefined
        ? new Date(Date.UTC(filter.year, 0, 1))
        : undefined;
    const upper = filter.to
      ? parseDateOnly(filter.to)
      : filter.year !== undefined
        ? new Date(Date.UTC(filter.year, 11, 31))
        : undefined;
    const where = tenantWhere<Prisma.HolidayWhereInput>(scope, {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.organizationWide
        ? { workLocationId: null }
        : filter.workLocationId !== undefined
          ? { workLocationId: filter.workLocationId }
          : {}),
      ...(lower || upper
        ? {
            holidayDate: {
              ...(lower ? { gte: lower } : {}),
              ...(upper ? { lte: upper } : {}),
            },
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.holiday.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ holidayDate: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.holiday.count({ where }),
    ]);
    return { items: rows.map(toHolidayView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.holiday.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toHolidayView(row) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateHolidayDto,
    actorId: number,
  ): Promise<HolidayView> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.workLocationId !== undefined) {
          const location = await tx.workLocation.findFirst({
            where: {
              id: dto.workLocationId,
              organizationId: scope.organizationId,
              deletedAt: null,
              isActive: true,
            },
            select: { id: true },
          });
          if (!location) {
            throw new BusinessRuleViolationException(
              `Work location ${dto.workLocationId} does not exist in this organization or is inactive`,
              "INVALID_WORK_LOCATION",
            );
          }
        }
        const created = await tx.holiday.create({
          data: {
            organizationId: scope.organizationId,
            holidayDate: parseDateOnly(dto.holidayDate),
            name: dto.name,
            description: dto.description || null,
            workLocationId: dto.workLocationId ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "create",
          after: snapshot(created),
        });
        return toHolidayView(created);
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateHolidayDto,
    actorId: number,
  ): Promise<HolidayView | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.holiday.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      const name = dto.name ?? before.name;
      const description =
        dto.description === undefined
          ? before.description
          : dto.description || null;
      if (name === before.name && description === before.description) {
        return toHolidayView(before);
      }
      const after = await tx.holiday.update({
        where: { id },
        data: { name, description, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toHolidayView(after);
    });
  }

  /** Deactivating keeps the row (history); re-activating can collide with a
   * replacement entered meanwhile, which the partial unique index reports. */
  @OrgScoped()
  async setActive(
    scope: OrgScope,
    id: number,
    isActive: boolean,
    actorId: number,
  ): Promise<HolidayView | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.holiday.findFirst({
          where: tenantWhere(scope, { id, deletedAt: null }),
          include: INCLUDE,
        });
        if (!before) return null;
        if (before.isActive === isActive) return toHolidayView(before);
        const after = await tx.holiday.update({
          where: { id },
          data: { isActive, updatedBy: actorId },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: isActive ? "activate" : "deactivate",
          before: snapshot(before),
          after: snapshot(after),
        });
        return toHolidayView(after);
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new BusinessRuleConflictException(
          "There is already an active holiday on that date for that scope",
          "HOLIDAY_DATE_TAKEN",
        )
      : error;
  }
}
