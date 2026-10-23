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
import type { CreateCrmDocumentDto } from "./dto/document.dto.js";

const ENTITY_TYPE = "crm_document";

export interface CrmDocumentFilter {
  relatedType?: string | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: account + its contacts + its opportunities. */
  rollupAccountId?: number | undefined;
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
      this.prisma.crmDocument.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ uploadedAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmDocument.count({ where }),
    ]);
    const items = await attachActorNames(
      this.prisma,
      scope.organizationId,
      rows,
    );
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
  /** Recycle Bin: this organization's soft-deleted rows, newest deletion first. */
  @OrgScoped()
  async findDeleted(scope: OrgScope) {
    return this.prisma.crmDocument.findMany({
      where: tenantWhere(scope, { deletedAt: { not: null } }),
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
    });
  }

  /** Recycle Bin restore: clears `deletedAt`. Returns null when the row is not in the bin. */
  @OrgScoped()
  async restoreDeleted(scope: OrgScope, id: number, actorId: number) {
    void actorId;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.crmDocument.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmDocument.update({
          where: { id },
          data: { deletedAt: null },
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
        const before = await tx.crmDocument.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmDocument.delete({ where: { id } });
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
