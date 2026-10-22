import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateCrmMiningRowDto,
  UpdateCrmMiningRowDto,
} from "./dto/mining-row.dto.js";

const ENTITY_TYPE = "crm_mining_row";

const TEXT_FIELDS = [
  "serialNo",
  "minedDate",
  "domain",
  "hq",
  "website",
  "keyDecisionMakers",
  "title",
  "contactNumber",
  "email",
  "emailStatus",
  "followUpStatus",
  "industry",
  "numberOfEmployees",
  "city",
  "state",
  "country",
  "linkedInProfile",
  "assignedTo",
  "priority",
  "nextFollowUpDate",
  "notes",
] as const;

function snapshot(row: {
  companyName: string;
  promotedToLeadId: number | null;
}) {
  return {
    companyName: row.companyName,
    promotedToLeadId: row.promotedToLeadId,
  };
}

function filterWhere(search?: string): Prisma.CrmMiningRowWhereInput {
  const clauses: Prisma.CrmMiningRowWhereInput[] = [{ deletedAt: null }];
  if (search) {
    const contains = { contains: search, mode: "insensitive" as const };
    clauses.push({
      OR: [
        { companyName: contains },
        { domain: contains },
        { keyDecisionMakers: contains },
        { contactNumber: contains },
        { email: contains },
        { followUpStatus: contains },
        { industry: contains },
        { city: contains },
      ],
    });
  }
  return { AND: clauses };
}

@Injectable()
export class CrmMiningRowsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    search: string | undefined,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere(scope, filterWhere(search));
    const [items, total] = await Promise.all([
      this.prisma.crmMiningRow.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmMiningRow.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.crmMiningRow.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCrmMiningRowDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CrmMiningRowUncheckedCreateInput = {
        organizationId: scope.organizationId,
        companyName: dto.companyName,
        customFields: dto.customFields ?? Prisma.JsonNull,
        createdBy: actorId,
        updatedBy: actorId,
      };
      for (const f of TEXT_FIELDS) data[f] = dto[f] || null;
      const created = await tx.crmMiningRow.create({ data });
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
    dto: UpdateCrmMiningRowDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMiningRow.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const data: Prisma.CrmMiningRowUncheckedUpdateInput = {
        companyName: dto.companyName ?? before.companyName,
        updatedBy: actorId,
      };
      for (const f of TEXT_FIELDS) {
        if (dto[f] !== undefined) data[f] = dto[f] || null;
      }
      if (dto.customFields !== undefined) data.customFields = dto.customFields;
      const after = await tx.crmMiningRow.update({ where: { id }, data });
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

  /** Atomically links the row to its Lead: only succeeds while
   * `promotedToLeadId` is still null, so two concurrent promotions can
   * never both win. Returns the updated row, or null when the row was
   * already promoted (or vanished). */
  @OrgScoped()
  async linkPromotedLead(
    scope: OrgScope,
    id: number,
    leadId: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.crmMiningRow.updateMany({
        where: tenantWhere(scope, {
          id,
          deletedAt: null,
          promotedToLeadId: null,
        }),
        data: { promotedToLeadId: leadId, updatedBy: actorId },
      });
      if (count === 0) return null;
      const after = await tx.crmMiningRow.findFirstOrThrow({ where: { id } });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Display name for the Lead's default `assignedTo` (legacy falls back
   * to the current user's name). */
  @OrgScoped()
  async findUserName(scope: OrgScope, userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: scope.organizationId },
      select: { fullName: true },
    });
    return user?.fullName ?? null;
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmMiningRow.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmMiningRow.update({
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
    return this.prisma.crmMiningRow.findMany({
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
        const before = await tx.crmMiningRow.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmMiningRow.update({
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
        const before = await tx.crmMiningRow.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmMiningRow.delete({ where: { id } });
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
