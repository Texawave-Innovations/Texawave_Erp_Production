import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { assertRelatedEntityExists } from "../shared/related-entity.js";
import type { CreateCrmDocumentDto } from "./dto/document.dto.js";

const ENTITY_TYPE = "crm_document";

export interface CrmDocumentFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
}

function snapshot(row: { name: string; link: string }) {
  return { name: row.name, link: row.link };
}

function filterWhere(filter: CrmDocumentFilter): Prisma.CrmDocumentWhereInput {
  const clauses: Prisma.CrmDocumentWhereInput[] = [{ deletedAt: null }];
  if (filter.relatedType) clauses.push({ relatedType: filter.relatedType });
  if (filter.relatedId !== undefined)
    clauses.push({ relatedId: filter.relatedId });
  return { AND: clauses };
}

@Injectable()
export class CrmDocumentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: CrmDocumentFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere(scope, filterWhere(filter));
    const [items, total] = await Promise.all([
      this.prisma.crmDocument.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ uploadedAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmDocument.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCrmDocumentDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelatedEntityExists(
        tx,
        scope.organizationId,
        dto.relatedType,
        dto.relatedId,
      );
      const created = await tx.crmDocument.create({
        data: {
          organizationId: scope.organizationId,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          name: dto.name,
          link: dto.link,
          notes: dto.notes ?? null,
          uploadedBy: actorId,
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
  async softDelete(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmDocument.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
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
