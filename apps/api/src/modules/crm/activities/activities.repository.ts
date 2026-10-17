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
import { assertRelatedEntityExists } from "../shared/related-entity.js";
import type {
  CreateActivityDto,
  UpdateActivityDto,
} from "./dto/activity.dto.js";

const ENTITY_TYPE = "crm_activity";

export interface ActivityFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  type?: string | undefined;
  search?: string | undefined;
  /** Unified account timeline: the account itself plus its contacts. */
  accountId?: number | undefined;
  accountContactIds?: number[] | undefined;
  accountOpportunityIds?: number[] | undefined;
  /** Calendar feed (additive): occurredAt range, [from, to). */
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
}

function snapshot(row: { subject: string; type: string }) {
  return { subject: row.subject, type: row.type };
}

function filterWhere(filter: ActivityFilter): Prisma.CrmActivityWhereInput {
  const clauses: Prisma.CrmActivityWhereInput[] = [{ deletedAt: null }];
  if (filter.relatedType) clauses.push({ relatedType: filter.relatedType });
  if (filter.relatedId !== undefined)
    clauses.push({ relatedId: filter.relatedId });
  if (filter.type) clauses.push({ type: filter.type });
  if (filter.accountId !== undefined) {
    clauses.push({
      OR: [
        { relatedType: "account", relatedId: filter.accountId },
        {
          relatedType: "contact",
          relatedId: { in: filter.accountContactIds ?? [] },
        },
        {
          relatedType: "opportunity",
          relatedId: { in: filter.accountOpportunityIds ?? [] },
        },
      ],
    });
  }
  if (filter.search) {
    clauses.push({
      OR: [
        { subject: { contains: filter.search, mode: "insensitive" } },
        { notes: { contains: filter.search, mode: "insensitive" } },
      ],
    });
  }
  if (filter.dateFrom || filter.dateTo) {
    clauses.push({
      occurredAt: {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lt: filter.dateTo } : {}),
      },
    });
  }
  return { AND: clauses };
}

@Injectable()
export class ActivitiesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ActivityFilter,
    pagination: PaginationDto,
  ) {
    if (filter.accountId !== undefined) {
      const contacts = await this.prisma.contact.findMany({
        where: {
          organizationId: scope.organizationId,
          accountId: filter.accountId,
          deletedAt: null,
        },
        select: { id: true },
      });
      const opps = await this.prisma.opportunity.findMany({
        where: {
          organizationId: scope.organizationId,
          accountId: filter.accountId,
          deletedAt: null,
        },
        select: { id: true },
      });
      filter = {
        ...filter,
        accountContactIds: contacts.map((c) => c.id),
        accountOpportunityIds: opps.map((o) => o.id),
      };
    }
    const where = tenantWhere(scope, filterWhere(filter));
    const [rows, total] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ occurredAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmActivity.count({ where }),
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
    return this.prisma.crmActivity.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateActivityDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelatedEntityExists(
        tx,
        scope.organizationId,
        dto.relatedType,
        dto.relatedId,
      );
      const created = await tx.crmActivity.create({
        data: {
          organizationId: scope.organizationId,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          type: dto.type,
          subject: dto.subject,
          notes: dto.notes ?? null,
          direction: dto.direction ?? null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          createdBy: actorId,
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
    dto: UpdateActivityDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmActivity.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmActivity.update({
        where: { id },
        data: {
          subject: dto.subject ?? before.subject,
          notes: dto.notes === undefined ? before.notes : dto.notes || null,
          direction:
            dto.direction === undefined
              ? before.direction
              : dto.direction || null,
          occurredAt: dto.occurredAt
            ? new Date(dto.occurredAt)
            : before.occurredAt,
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
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmActivity.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmActivity.update({
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
    return this.prisma.crmActivity.findMany({
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
        const before = await tx.crmActivity.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmActivity.update({
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
        const before = await tx.crmActivity.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmActivity.delete({ where: { id } });
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
