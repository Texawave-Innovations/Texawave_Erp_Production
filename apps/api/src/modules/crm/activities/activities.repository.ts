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
  CreateActivityDto,
  UpdateActivityDto,
} from "./dto/activity.dto.js";

const ENTITY_TYPE = "crm_activity";

export interface ActivityFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  type?: string | undefined;
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
    const where = tenantWhere(scope, filterWhere(filter));
    const [items, total] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ occurredAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmActivity.count({ where }),
    ]);
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
}
