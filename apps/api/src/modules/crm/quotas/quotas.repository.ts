import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { OpportunityForAttainment } from "./quota-attainment.js";

const ENTITY_TYPE = "crm_quota";

export interface QuotaWriteData {
  repName: string;
  team: string | null;
  managerName: string | null;
  targetOwner: string | null;
  period: string;
  periodKey: string;
  startDate: Date | null;
  endDate: Date | null;
  targetAmount: number;
  metric: string;
  currency: string | null;
  notes: string | null;
}

function snapshot(row: {
  repName: string;
  period: string;
  periodKey: string;
  targetAmount: Prisma.Decimal;
  metric: string;
}) {
  return {
    repName: row.repName,
    period: row.period,
    periodKey: row.periodKey,
    targetAmount: row.targetAmount.toString(),
    metric: row.metric,
  };
}

@Injectable()
export class CrmQuotasRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Every live quota — used by the service for the case-insensitive rep
   * filter and the duplicate guard (rep names are free text). */
  @OrgScoped()
  async findAllLive(scope: OrgScope) {
    return this.prisma.crmQuota.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.crmQuota.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  /** WON opportunities (with a wonAt) feeding attainment. */
  @OrgScoped()
  async findWonOpportunities(
    scope: OrgScope,
  ): Promise<OpportunityForAttainment[]> {
    const rows = await this.prisma.opportunity.findMany({
      where: tenantWhere(scope, {
        status: "WON",
        deletedAt: null,
        wonAt: { not: null },
      }),
      select: {
        status: true,
        ownerName: true,
        wonAt: true,
        closingAmount: true,
        estimatedValue: true,
      },
    });
    return rows.map((r) => ({
      status: r.status,
      ownerName: r.ownerName,
      wonAt: r.wonAt,
      closingAmount: r.closingAmount === null ? null : Number(r.closingAmount),
      estimatedValue: Number(r.estimatedValue),
    }));
  }

  @OrgScoped()
  async create(scope: OrgScope, data: QuotaWriteData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.crmQuota.create({
        data: {
          ...data,
          organizationId: scope.organizationId,
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
    data: Partial<QuotaWriteData>,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmQuota.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmQuota.update({
        where: { id },
        data: { ...data, updatedBy: actorId },
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
      const before = await tx.crmQuota.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmQuota.update({
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
    return this.prisma.crmQuota.findMany({
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
        const before = await tx.crmQuota.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.crmQuota.update({
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
        const before = await tx.crmQuota.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.crmQuota.delete({ where: { id } });
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
