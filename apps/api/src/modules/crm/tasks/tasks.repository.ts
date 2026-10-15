import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { assertRelatedEntityExists } from "../shared/related-entity.js";
import type { CreateCrmTaskDto, UpdateCrmTaskDto } from "./dto/task.dto.js";

const ENTITY_TYPE = "crm_task";

export interface CrmTaskFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  status?: string | undefined;
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
    const where = tenantWhere(scope, filterWhere(filter));
    const [items, total] = await Promise.all([
      this.prisma.crmTask.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ dueDate: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.crmTask.count({ where }),
    ]);
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
}
