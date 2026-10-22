import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { attachActorNames } from "../shared/actor-names.js";
import {
  accountRollupWhere,
  assertRelatedEntityExists,
} from "../shared/related-entity.js";
import type {
  CreateFollowUpDto,
  RescheduleFollowUpDto,
  UpdateFollowUpDto,
  UpdateFollowUpStatusDto,
} from "./dto/follow-up.dto.js";

const ENTITY_TYPE = "crm_follow_up";

export interface FollowUpFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: account + its contacts + its opportunities. */
  rollupAccountId?: number | undefined;
  status?: string | undefined;
  /** Global search / calendar feed (additive). */
  q?: string | undefined;
  relatedAccountIds?: number[] | undefined;
  statusNotIn?: string[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
}

function snapshot(row: { status: string; scheduledAt: Date }) {
  return { status: row.status, scheduledAt: row.scheduledAt.toISOString() };
}

function filterWhere(filter: FollowUpFilter): Prisma.CrmFollowUpWhereInput {
  const clauses: Prisma.CrmFollowUpWhereInput[] = [{ deletedAt: null }];
  if (filter.relatedType) clauses.push({ relatedType: filter.relatedType });
  if (filter.relatedId !== undefined)
    clauses.push({ relatedId: filter.relatedId });
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.statusNotIn?.length)
    clauses.push({ status: { notIn: filter.statusNotIn } });
  if (filter.dateFrom || filter.dateTo) {
    clauses.push({
      scheduledAt: {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lt: filter.dateTo } : {}),
      },
    });
  }
  if (filter.q) {
    const or: Prisma.CrmFollowUpWhereInput[] = [
      { type: { contains: filter.q, mode: "insensitive" } },
      { assignedTo: { contains: filter.q, mode: "insensitive" } },
      { notes: { contains: filter.q, mode: "insensitive" } },
    ];
    if (filter.relatedAccountIds?.length)
      or.push({
        relatedType: "account",
        relatedId: { in: filter.relatedAccountIds },
      });
    clauses.push({ OR: or });
  }
  return { AND: clauses };
}

@Injectable()
export class FollowUpsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: FollowUpFilter,
    pagination: PaginationDto,
  ) {
    const base = filterWhere(filter);
    const where = tenantWhere(
      scope,
      filter.rollupAccountId === undefined
        ? base
        : {
            AND: [
              base,
              await accountRollupWhere(
                this.prisma,
                scope.organizationId,
                filter.rollupAccountId,
              ),
            ],
          },
    );
    const [rows, total] = await Promise.all([
      this.prisma.crmFollowUp.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ scheduledAt: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.crmFollowUp.count({ where }),
    ]);
    const items = await attachActorNames(
      this.prisma,
      scope.organizationId,
      rows,
    );
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.crmFollowUp.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateFollowUpDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelatedEntityExists(
        tx,
        scope.organizationId,
        dto.relatedType,
        dto.relatedId,
      );
      const created = await tx.crmFollowUp.create({
        data: {
          organizationId: scope.organizationId,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          type: dto.type,
          scheduledAt: new Date(dto.scheduledAt),
          assignedTo: dto.assignedTo,
          priority: dto.priority ?? "Medium",
          notes: dto.notes ?? null,
          status: "PENDING",
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateFollowUpDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmFollowUp.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      return tx.crmFollowUp.update({
        where: { id },
        data: {
          type: dto.type ?? before.type,
          scheduledAt: dto.scheduledAt
            ? new Date(dto.scheduledAt)
            : before.scheduledAt,
          assignedTo: dto.assignedTo ?? before.assignedTo,
          priority: dto.priority ?? before.priority,
          notes: dto.notes === undefined ? before.notes : dto.notes || null,
          updatedBy: actorId,
        },
      });
    });
  }

  /** Generic status setter — matches legacy `updateCrmFollowUpStatus`
   * exactly (optional outcome/nextFollowUpAt). `OVERDUE` is intentionally
   * not a legal value here (enforced at the DTO layer) — it is never
   * persisted, only computed at read time (see `getEffectiveStatus`). */
  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    dto: UpdateFollowUpStatusDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmFollowUp.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmFollowUp.update({
        where: { id },
        data: {
          status: dto.status,
          outcome: dto.outcome ?? before.outcome,
          nextFollowUpAt: dto.nextFollowUpAt
            ? new Date(dto.nextFollowUpAt)
            : before.nextFollowUpAt,
          updatedBy: actorId,
        },
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
  }

  /** Rewrites `scheduledAt`, forces status back to PENDING (NOT
   * RESCHEDULED) and appends an immutable history row — reproduced exactly
   * as observed in legacy `rescheduleCrmFollowUp`, including the asymmetry
   * with Meeting's own reschedule (which sets RESCHEDULED). Not corrected. */
  @OrgScoped()
  async reschedule(
    scope: OrgScope,
    id: number,
    dto: RescheduleFollowUpDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmFollowUp.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmFollowUp.update({
        where: { id },
        data: {
          scheduledAt: new Date(dto.newScheduledAt),
          status: "PENDING",
          updatedBy: actorId,
        },
      });
      await tx.crmFollowUpReschedule.create({
        data: {
          followUpId: id,
          previousDate: before.scheduledAt,
          reason: dto.reason ?? null,
          rescheduledBy: actorId,
        },
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
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmFollowUp.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmFollowUp.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }
  /** Recycle Bin: this organization's soft-deleted rows, newest deletion first. */
  @OrgScoped()
  async findDeleted(scope: OrgScope) {
    return this.prisma.crmFollowUp.findMany({
      where: tenantWhere(scope, { deletedAt: { not: null } }),
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
    });
  }

  /** Recycle Bin restore: clears `deletedAt`. Returns null when the row is not in the bin. */
  @OrgScoped()
  async restoreDeleted(scope: OrgScope, id: number, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.crmFollowUp.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmFollowUp.update({
          where: { id },
          data: { deletedAt: null, updatedBy: actorId },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "restore",
          before: { deletedAt: before.deletedAt },
          after: { deletedAt: null },
        });
        return after;
      });
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          "A live record with the same unique value already exists, so this one can't be restored",
        );
      }
      throw error;
    }
  }

  /** Recycle Bin permanent delete: irreversible hard delete of a soft-deleted row. FK-safe: rows the record owns are removed, nullable references to it are cleared, and anything else still referencing it aborts with STILL_REFERENCED. Returns null when the row is not in the bin. */
  @OrgScoped()
  async purgeDeleted(scope: OrgScope, id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.crmFollowUp.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmFollowUp.delete({ where: { id } });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "purge",
          before: { deletedAt: before.deletedAt },
        });
        return before;
      });
    } catch (error) {
      if (classifyDbError(error)?.kind === "foreign_key") {
        throw new BusinessRuleViolationException(
          "This record is still referenced by other records and can't be permanently deleted",
          "STILL_REFERENCED",
        );
      }
      throw error;
    }
  }
}
