import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { ActionItemState } from "./dto/action-item.dto.js";

const ENTITY_TYPE = "sales_action_item";

const INCLUDE = {
  completer: { select: { id: true, fullName: true } },
} satisfies Prisma.SalesActionItemInclude;

type Row = Prisma.SalesActionItemGetPayload<{ include: typeof INCLUDE }>;

function toView(row: Row) {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate ? formatDateOnly(row.dueDate) : null,
    isDone: row.completedAt !== null,
    completedAt: row.completedAt,
    completedBy: row.completer,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function snapshot(row: Row) {
  return {
    title: row.title,
    dueDate: row.dueDate ? formatDateOnly(row.dueDate) : null,
    isDone: row.completedAt !== null,
  };
}

/** The only place `PrismaService` is called for the Sales checklist. */
@Injectable()
export class ActionItemsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Open items first by due date (no date last), done items newest first. */
  @OrgScoped()
  async findMany(
    scope: OrgScope,
    state: ActionItemState,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SalesActionItemWhereInput>(scope, {
      deletedAt: null,
      ...(state === "open" ? { completedAt: null } : {}),
      ...(state === "done" ? { completedAt: { not: null } } : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesActionItem.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { completedAt: { sort: "desc", nulls: "first" } },
          { dueDate: { sort: "asc", nulls: "last" } },
          { id: "asc" },
        ],
      }),
      this.prisma.salesActionItem.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  /** Open items, and how many of them are past due — for the dashboard. */
  @OrgScoped()
  async countOpen(scope: OrgScope, today: Date) {
    const base = tenantWhere<Prisma.SalesActionItemWhereInput>(scope, {
      deletedAt: null,
      completedAt: null,
    });
    const [open, overdue] = await Promise.all([
      this.prisma.salesActionItem.count({ where: base }),
      this.prisma.salesActionItem.count({
        where: { ...base, dueDate: { lt: today } },
      }),
    ]);
    return { open, overdue };
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: { title: string; dueDate: Date | null },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.salesActionItem.create({
        data: {
          organizationId: scope.organizationId,
          title: input.title,
          dueDate: input.dueDate,
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** Marks done (`done = true`) or reopens. null → not in scope. */
  @OrgScoped()
  async setDone(scope: OrgScope, id: number, done: boolean, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.salesActionItem.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.salesActionItem.update({
        where: { id },
        data: done
          ? {
              completedAt: before.completedAt ?? new Date(),
              completedBy: before.completedBy ?? actorId,
              updatedBy: actorId,
            }
          : { completedAt: null, completedBy: null, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: done ? "complete" : "reopen",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.salesActionItem.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return false;
      await tx.salesActionItem.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
      });
      return true;
    });
  }
}
