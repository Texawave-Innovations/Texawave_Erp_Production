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
import type { CreateCrmTaskDto, UpdateCrmTaskDto } from "./dto/task.dto.js";

const ENTITY_TYPE = "crm_task";

export interface CrmTaskFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: account + its contacts + its opportunities. */
  rollupAccountId?: number | undefined;
  status?: string | undefined;
  /** Calendar feed (additive). */
  statusNotIn?: string[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
}

function snapshot(row: { title: string; status: string }) {
  return { title: row.title, status: row.status };
}

function filterWhere(filter: CrmTaskFilter): Prisma.CrmTaskWhereInput {
  const clauses: Prisma.CrmTaskWhereInput[] = [{ deletedAt: null }];
  if (filter.relatedType) clauses.push({ relatedType: filter.relatedType });
  if (filter.relatedId !== undefined)
    clauses.push({ relatedId: filter.relatedId });
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.statusNotIn?.length)
    clauses.push({ status: { notIn: filter.statusNotIn } });
  if (filter.dateFrom || filter.dateTo) {
    clauses.push({
      dueDate: {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lt: filter.dateTo } : {}),
      },
    });
  }
  return { AND: clauses };
}

@Injectable()
export class CrmTasksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: CrmTaskFilter,
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
      this.prisma.crmTask.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ dueDate: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.crmTask.count({ where }),
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
    return this.prisma.crmTask.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCrmTaskDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelatedEntityExists(
        tx,
        scope.organizationId,
        dto.relatedType,
        dto.relatedId,
      );
      const created = await tx.crmTask.create({
        data: {
          organizationId: scope.organizationId,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          title: dto.title,
          dueDate: new Date(dto.dueDate),
          assignedTo: dto.assignedTo,
          priority: dto.priority ?? "Medium",
          notes: dto.notes ?? null,
          status: "Open",
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
    dto: UpdateCrmTaskDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmTask.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      return tx.crmTask.update({
        where: { id },
        data: {
          title: dto.title ?? before.title,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : before.dueDate,
          assignedTo: dto.assignedTo ?? before.assignedTo,
          priority: dto.priority ?? before.priority,
          notes: dto.notes === undefined ? before.notes : dto.notes || null,
          updatedBy: actorId,
        },
      });
    });
  }

  /** Matches legacy `setCrmTaskStatus` exactly: an audit entry is only
   * written when the task becomes Completed, not when reopened back to
   * Open — reproduced as-observed, not "fixed" to be symmetric. */
  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    status: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmTask.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmTask.update({
        where: { id },
        data: { status, updatedBy: actorId },
      });
      if (status === "Completed") {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "update",
          before: snapshot(before),
          after: snapshot(after),
        });
      }
      return after;
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmTask.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmTask.update({
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
    return this.prisma.crmTask.findMany({
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
        const before = await tx.crmTask.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmTask.update({
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
        const before = await tx.crmTask.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmTask.delete({ where: { id } });
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
