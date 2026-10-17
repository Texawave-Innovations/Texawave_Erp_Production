import { classifyDbError } from "../../../common/database/db-errors.js";
import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { attachActorNames } from "../shared/actor-names.js";
import type { CreateCrmNoteDto } from "./dto/note.dto.js";

const ENTITY_TYPE = "crm_note";

function snapshot(row: { content: string }) {
  return { content: row.content };
}

@Injectable()
export class CrmNotesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findByAccount(
    scope: OrgScope,
    accountId: number,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere(scope, { accountId, deletedAt: null });
    const [rows, total] = await Promise.all([
      this.prisma.crmNote.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmNote.count({ where }),
    ]);
    const items = await attachActorNames(
      this.prisma,
      scope.organizationId,
      rows,
    );
    return { items, total };
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCrmNoteDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          id: dto.accountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) {
        throw new BusinessRuleViolationException(
          `Account ${dto.accountId} does not exist in this organization`,
          "INVALID_ACCOUNT",
        );
      }
      const created = await tx.crmNote.create({
        data: {
          organizationId: scope.organizationId,
          accountId: dto.accountId,
          content: dto.content,
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
  async softDelete(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmNote.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmNote.update({
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
    return this.prisma.crmNote.findMany({
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
        const before = await tx.crmNote.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const parent = await tx.account.findFirst({
          where: { id: before.accountId, organizationId: scope.organizationId },
          select: { deletedAt: true },
        });
        if (parent?.deletedAt) {
          throw new BusinessRuleViolationException(
            "Restore the parent account first - it is still in the Recycle Bin.",
            "PARENT_DELETED",
          );
        }
        const after = await tx.crmNote.update({
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
        const before = await tx.crmNote.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmNote.delete({ where: { id } });
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
