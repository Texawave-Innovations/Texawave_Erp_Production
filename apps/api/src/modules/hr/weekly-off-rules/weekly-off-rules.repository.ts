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
import type {
  CreateWeeklyOffRuleDto,
  UpdateWeeklyOffRuleDto,
} from "./dto/weekly-off-rule.dto.js";

const ENTITY_TYPE = "weekly_off_rule";
const INCLUDE = {
  workLocation: { select: { id: true, code: true, name: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.WeeklyOffRuleInclude;
type RuleRow = Prisma.WeeklyOffRuleGetPayload<{ include: typeof INCLUDE }>;

export type WeeklyOffScope = "organization" | "location" | "team";

export interface WeeklyOffRuleView {
  id: number;
  name: string;
  description: string | null;
  daysOfWeek: number[];
  scope: WeeklyOffScope;
  workLocation: { id: number; code: string; name: string } | null;
  team: { id: number; name: string } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** `false` = voided (entered in error); kept for history. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toRuleView(row: RuleRow): WeeklyOffRuleView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    daysOfWeek: row.daysOfWeek,
    scope:
      row.teamId !== null
        ? "team"
        : row.workLocationId !== null
          ? "location"
          : "organization",
    workLocation: row.workLocation,
    team: row.team,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function snapshot(row: RuleRow) {
  return {
    name: row.name,
    daysOfWeek: row.daysOfWeek,
    workLocationId: row.workLocationId,
    teamId: row.teamId,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    isActive: row.isActive,
  };
}

export interface WeeklyOffFilter {
  scope?: WeeklyOffScope | undefined;
  workLocationId?: number | undefined;
  teamId?: number | undefined;
  activeOn?: string | undefined;
  includeVoided?: boolean | undefined;
}

/** Organization-wide reference data: reads and writes are gated by exact
 * permissions, so every method is `@OrgScoped()` and no team scope applies. */
@Injectable()
export class WeeklyOffRulesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: WeeklyOffFilter,
    pagination: PaginationDto,
  ) {
    const day = filter.activeOn ? parseDateOnly(filter.activeOn) : undefined;
    const where = tenantWhere<Prisma.WeeklyOffRuleWhereInput>(scope, {
      deletedAt: null,
      ...(filter.includeVoided ? {} : { isActive: true }),
      ...(filter.scope === "organization"
        ? { workLocationId: null, teamId: null }
        : {}),
      ...(filter.scope === "location" ? { workLocationId: { not: null } } : {}),
      ...(filter.scope === "team" ? { teamId: { not: null } } : {}),
      ...(filter.workLocationId !== undefined
        ? { workLocationId: filter.workLocationId }
        : {}),
      ...(filter.teamId !== undefined ? { teamId: filter.teamId } : {}),
      ...(day
        ? {
            effectiveFrom: { lte: day },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.weeklyOffRule.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { effectiveFrom: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.weeklyOffRule.count({ where }),
    ]);
    return { items: rows.map(toRuleView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.weeklyOffRule.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toRuleView(row) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateWeeklyOffRuleDto,
    actorId: number,
  ): Promise<WeeklyOffRuleView> {
    const from = parseDateOnly(dto.effectiveFrom);
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;
    if (dto.workLocationId !== undefined && dto.teamId !== undefined) {
      throw new BusinessRuleViolationException(
        "A weekly-off rule applies to a location OR a team, not both",
        "WEEKLY_OFF_SCOPE_INVALID",
      );
    }
    if (to && to < from) {
      throw new BusinessRuleViolationException(
        "effectiveTo cannot be before effectiveFrom",
        "WEEKLY_OFF_DATES_INVALID",
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const live = {
          organizationId: scope.organizationId,
          deletedAt: null,
          isActive: true,
        };
        if (dto.workLocationId !== undefined) {
          const found = await tx.workLocation.findFirst({
            where: { id: dto.workLocationId, ...live },
            select: { id: true },
          });
          if (!found) {
            throw new BusinessRuleViolationException(
              `Work location ${dto.workLocationId} does not exist in this organization or is inactive`,
              "INVALID_WORK_LOCATION",
            );
          }
        }
        if (dto.teamId !== undefined) {
          const found = await tx.team.findFirst({
            where: { id: dto.teamId, ...live },
            select: { id: true },
          });
          if (!found) {
            throw new BusinessRuleViolationException(
              `Team ${dto.teamId} does not exist in this organization or is inactive`,
              "INVALID_TEAM",
            );
          }
        }
        const created = await tx.weeklyOffRule.create({
          data: {
            organizationId: scope.organizationId,
            name: dto.name,
            description: dto.description || null,
            daysOfWeek: dto.daysOfWeek,
            workLocationId: dto.workLocationId ?? null,
            teamId: dto.teamId ?? null,
            effectiveFrom: from,
            effectiveTo: to,
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
        return toRuleView(created);
      });
    } catch (error) {
      throw await this.explainOverlap(
        error,
        scope.organizationId,
        dto,
        from,
        to,
      );
    }
  }

  /** Label-only edit (name/description). Days and dates are history. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateWeeklyOffRuleDto,
    actorId: number,
  ): Promise<WeeklyOffRuleView | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.weeklyOffRule.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      const name = dto.name ?? before.name;
      const description =
        dto.description === undefined
          ? before.description
          : dto.description || null;
      if (name === before.name && description === before.description)
        return toRuleView(before);
      const after = await tx.weeklyOffRule.update({
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
      return toRuleView(after);
    });
  }

  /** Shorten only — extending could silently swallow a later rule. */
  @OrgScoped()
  async end(
    scope: OrgScope,
    id: number,
    input: { effectiveTo: string; reason?: string | undefined },
    actorId: number,
  ): Promise<WeeklyOffRuleView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.weeklyOffRule.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      if (!before.isActive) {
        throw new BusinessRuleViolationException(
          "This rule has been voided",
          "WEEKLY_OFF_VOIDED",
        );
      }
      const newTo = parseDateOnly(input.effectiveTo);
      if (newTo < before.effectiveFrom) {
        throw new BusinessRuleViolationException(
          "effectiveTo cannot be before effectiveFrom",
          "WEEKLY_OFF_DATES_INVALID",
        );
      }
      if (before.effectiveTo && newTo > before.effectiveTo) {
        throw new BusinessRuleViolationException(
          "A rule can only be shortened, never extended — create a new one instead",
          "WEEKLY_OFF_CANNOT_EXTEND",
        );
      }
      if (
        before.effectiveTo &&
        newTo.getTime() === before.effectiveTo.getTime()
      ) {
        return toRuleView(before);
      }
      const after = await tx.weeklyOffRule.update({
        where: { id },
        data: { effectiveTo: newTo, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "end",
        before: snapshot(before),
        after: snapshot(after),
        reason: input.reason,
      });
      return toRuleView(after);
    });
  }

  @OrgScoped()
  async voidOne(
    scope: OrgScope,
    id: number,
    reason: string,
    actorId: number,
  ): Promise<WeeklyOffRuleView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.weeklyOffRule.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      if (!before.isActive) return toRuleView(before);
      const after = await tx.weeklyOffRule.update({
        where: { id },
        data: { isActive: false, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "void",
        before: snapshot(before),
        after: snapshot(after),
        reason,
      });
      return toRuleView(after);
    });
  }

  private async lock(
    tx: Prisma.TransactionClient,
    organizationId: number,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM hr.weekly_off_rules
       WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
  }

  private async explainOverlap(
    error: unknown,
    organizationId: number,
    dto: CreateWeeklyOffRuleDto,
    from: Date,
    to: Date | null,
  ): Promise<unknown> {
    if (classifyDbError(error)?.kind !== "exclusion") return error;
    const clash = await this.prisma.weeklyOffRule.findFirst({
      where: {
        organizationId,
        isActive: true,
        workLocationId: dto.workLocationId ?? null,
        teamId: dto.teamId ?? null,
        ...(to ? { effectiveFrom: { lte: to } } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      orderBy: { effectiveFrom: "asc" },
    });
    const detail = clash
      ? ` (rule #${clash.id}: ${formatDateOnly(clash.effectiveFrom)} to ${clash.effectiveTo ? formatDateOnly(clash.effectiveTo) : "open-ended"})`
      : "";
    return new BusinessRuleConflictException(
      `Overlaps an existing weekly-off rule of the same scope${detail} — end or void it first`,
      "WEEKLY_OFF_OVERLAP",
    );
  }
}
