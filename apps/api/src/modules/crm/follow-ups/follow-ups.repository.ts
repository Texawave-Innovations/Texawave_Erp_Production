import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { assertRelatedEntityExists } from "../shared/related-entity.js";
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
  status?: string | undefined;
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
    const where = tenantWhere(scope, filterWhere(filter));
    const [items, total] = await Promise.all([
      this.prisma.crmFollowUp.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ scheduledAt: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.crmFollowUp.count({ where }),
    ]);
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
}
