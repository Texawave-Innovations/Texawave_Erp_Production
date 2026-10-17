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
  CompleteMeetingDto,
  CreateMeetingDto,
  RescheduleMeetingDto,
  UpdateMeetingDto,
} from "./dto/meeting.dto.js";

const ENTITY_TYPE = "crm_meeting";

export interface MeetingFilter {
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

function snapshot(row: { status: string; meetingDate: Date }) {
  return { status: row.status, meetingDate: row.meetingDate.toISOString() };
}

function filterWhere(filter: MeetingFilter): Prisma.CrmMeetingWhereInput {
  const clauses: Prisma.CrmMeetingWhereInput[] = [{ deletedAt: null }];
  if (filter.relatedType) clauses.push({ relatedType: filter.relatedType });
  if (filter.relatedId !== undefined)
    clauses.push({ relatedId: filter.relatedId });
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.statusNotIn?.length)
    clauses.push({ status: { notIn: filter.statusNotIn } });
  if (filter.dateFrom || filter.dateTo) {
    clauses.push({
      meetingDate: {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lt: filter.dateTo } : {}),
      },
    });
  }
  if (filter.q) {
    const or: Prisma.CrmMeetingWhereInput[] = [
      { mode: { contains: filter.q, mode: "insensitive" } },
      { agenda: { contains: filter.q, mode: "insensitive" } },
      { participants: { contains: filter.q, mode: "insensitive" } },
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
export class MeetingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: MeetingFilter,
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
      this.prisma.crmMeeting.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ meetingDate: pagination.order ?? "asc" }, { id: "asc" }],
        include: { reschedules: { orderBy: { rescheduledAt: "desc" } } },
      }),
      this.prisma.crmMeeting.count({ where }),
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
    return this.prisma.crmMeeting.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: { reschedules: { orderBy: { rescheduledAt: "desc" } } },
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateMeetingDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelatedEntityExists(
        tx,
        scope.organizationId,
        dto.relatedType,
        dto.relatedId,
      );
      const created = await tx.crmMeeting.create({
        data: {
          organizationId: scope.organizationId,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          mode: dto.mode ?? "Online",
          meetingDate: new Date(dto.meetingDate),
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          location: dto.location ?? null,
          meetingLink: dto.meetingLink ?? null,
          agenda: dto.agenda ?? null,
          participants: dto.participants ?? null,
          status: "REQUESTED",
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
    dto: UpdateMeetingDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMeeting.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmMeeting.update({
        where: { id },
        data: {
          mode: dto.mode ?? before.mode,
          meetingDate: dto.meetingDate
            ? new Date(dto.meetingDate)
            : before.meetingDate,
          startTime:
            dto.startTime === undefined
              ? before.startTime
              : dto.startTime || null,
          endTime:
            dto.endTime === undefined ? before.endTime : dto.endTime || null,
          location:
            dto.location === undefined ? before.location : dto.location || null,
          meetingLink:
            dto.meetingLink === undefined
              ? before.meetingLink
              : dto.meetingLink || null,
          agenda: dto.agenda === undefined ? before.agenda : dto.agenda || null,
          participants:
            dto.participants === undefined
              ? before.participants
              : dto.participants || null,
          updatedBy: actorId,
        },
      });
      return after;
    });
  }

  /** Generic status setter — matches legacy `updateCrmMeetingStatus`
   * exactly, including the completedAt/cancelledAt side effect. */
  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    status: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMeeting.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const now = new Date();
      const after = await tx.crmMeeting.update({
        where: { id },
        data: {
          status,
          completedAt: status === "COMPLETED" ? now : before.completedAt,
          cancelledAt: status === "CANCELLED" ? now : before.cancelledAt,
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

  @OrgScoped()
  async complete(
    scope: OrgScope,
    id: number,
    dto: CompleteMeetingDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMeeting.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const now = new Date();
      const after = await tx.crmMeeting.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: now,
          summary: dto.summary ?? before.summary,
          requirements: dto.requirements ?? before.requirements,
          concerns: dto.concerns ?? before.concerns,
          competitors: dto.competitors ?? before.competitors,
          budget: dto.budget ?? before.budget,
          decisionMaker: dto.decisionMaker ?? before.decisionMaker,
          expectedTimeline: dto.expectedTimeline ?? before.expectedTimeline,
          nextStep: dto.nextStep ?? before.nextStep,
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

  /** Rewrites `meetingDate`, forces status to RESCHEDULED, and appends an
   * immutable history row — matches legacy `rescheduleCrmMeeting` exactly. */
  @OrgScoped()
  async reschedule(
    scope: OrgScope,
    id: number,
    dto: RescheduleMeetingDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMeeting.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmMeeting.update({
        where: { id },
        data: {
          meetingDate: new Date(dto.newDate),
          status: "RESCHEDULED",
          updatedBy: actorId,
        },
      });
      await tx.crmMeetingReschedule.create({
        data: {
          meetingId: id,
          previousDate: before.meetingDate,
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
      return tx.crmMeeting.findFirst({
        where: { id },
        include: { reschedules: { orderBy: { rescheduledAt: "desc" } } },
      });
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMeeting.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmMeeting.update({
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
    return this.prisma.crmMeeting.findMany({
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
        const before = await tx.crmMeeting.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmMeeting.update({
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
        const before = await tx.crmMeeting.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmMeeting.delete({ where: { id } });
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
