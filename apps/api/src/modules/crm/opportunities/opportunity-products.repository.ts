import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { computeLineBreakdown } from "../shared/money.js";
import type {
  AddOpportunityProductsDto,
  UpdateOpportunityProductDto,
} from "./dto/opportunity-product.dto.js";

const ENTITY_TYPE = "crm_opportunity_product";

/** Opportunity owns its own `teamId`/`createdBy` directly — the same
 * scope fields OpportunitiesRepository itself uses, since a line item's
 * access follows whatever opportunity it belongs to. */
const SCOPE_FIELDS = { ownerField: "createdBy" };

function snapshot(row: {
  productName: string;
  quantity: Prisma.Decimal;
  discountPercent: Prisma.Decimal | null;
  total: Prisma.Decimal;
  isActive: boolean;
}) {
  return {
    productName: row.productName,
    quantity: row.quantity.toString(),
    discountPercent: row.discountPercent?.toString() ?? null,
    total: row.total.toString(),
    isActive: row.isActive,
  };
}

/**
 * Deal line items — migrated from legacy's `domain/dealProductsService.ts`
 * + `domain/AddDealProductsDialog.tsx`. Access follows the parent
 * Opportunity's own `crm.opportunity.read`/`.write` scope (see the
 * catalog.ts note) — there is no separate line-item permission, matching
 * legacy, which does not gate the Products tab any more narrowly than
 * the surrounding Deal detail screen either.
 */
@Injectable()
export class OpportunityProductsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(scope: TeamScope, opportunityId: number) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: teamWhere(
        scope,
        { id: opportunityId, deletedAt: null },
        SCOPE_FIELDS,
      ),
      select: { id: true },
    });
    if (!opportunity) return null;
    return this.prisma.opportunityProduct.findMany({
      where: { opportunityId, deletedAt: null },
      include: {
        product: { select: { id: true, code: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Snapshots `productName`/`unitPrice`/`taxPercent` off the LIVE
   * `Product` row at this moment — frozen from here on, exactly like
   * legacy's `CrmDealProduct` (Docs/CRM_PRODUCTS_LEGACY_PARITY.md §2.6).
   * Only an active product may be newly added, matching
   * `AddDealProductsDialog.tsx`'s `products.filter((p) => p.active)`.
   * Inserts are sequential within one transaction (same ordering
   * guarantee as legacy's own sequential-not-Promise.all loop,
   * `dealProductsService.ts:43-53` — here it is also atomic, which
   * legacy's Firebase loop was not).
   */
  @TeamScoped()
  async addItems(
    scope: TeamScope,
    opportunityId: number,
    dto: AddOpportunityProductsDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findFirst({
        where: teamWhere(
          scope,
          { id: opportunityId, deletedAt: null },
          SCOPE_FIELDS,
        ),
        select: { id: true },
      });
      if (!opportunity) return null;

      const created = [];
      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
        });
        if (!product) {
          throw new BusinessRuleViolationException(
            `Product ${item.productId} does not exist in this organization`,
            "INVALID_PRODUCT",
          );
        }
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Product "${product.name}" is inactive and cannot be added to a deal`,
            "INACTIVE_PRODUCT",
          );
        }
        const unitPrice = Number(product.unitPrice);
        const taxPercent = product.taxPercent ? Number(product.taxPercent) : 0;
        const discountPercent = item.discountPercent ?? 0;
        const { total } = computeLineBreakdown(
          item.quantity,
          unitPrice,
          discountPercent,
          taxPercent,
        );
        const row = await tx.opportunityProduct.create({
          data: {
            organizationId: scope.organizationId,
            opportunityId,
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
            discountPercent,
            taxPercent,
            total,
            createdBy: actorId,
            updatedBy: actorId,
          },
          include: {
            product: { select: { id: true, code: true, isActive: true } },
          },
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: row.id,
          action: "create",
          after: snapshot(row),
        });
        created.push(row);
      }
      return created;
    });
  }

  /** Recomputes `total` from the stored (frozen) `unitPrice`/`taxPercent`
   * snapshot plus the revised `quantity`/`discountPercent` — never
   * re-reads the live Product, matching the "snapshot never changes
   * after add" rule. */
  @TeamScoped()
  async updateItem(
    scope: TeamScope,
    opportunityId: number,
    itemId: number,
    dto: UpdateOpportunityProductDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findFirst({
        where: teamWhere(
          scope,
          { id: opportunityId, deletedAt: null },
          SCOPE_FIELDS,
        ),
        select: { id: true },
      });
      if (!opportunity) return null;
      const before = await tx.opportunityProduct.findFirst({
        where: { id: itemId, opportunityId, deletedAt: null },
      });
      if (!before) return null;

      const quantity = dto.quantity ?? Number(before.quantity);
      const discountPercent =
        dto.discountPercent ?? Number(before.discountPercent ?? 0);
      const unitPrice = Number(before.unitPrice);
      const taxPercent = before.taxPercent ? Number(before.taxPercent) : 0;
      const { total } = computeLineBreakdown(
        quantity,
        unitPrice,
        discountPercent,
        taxPercent,
      );

      const after = await tx.opportunityProduct.update({
        where: { id: itemId },
        data: { quantity, discountPercent, total, updatedBy: actorId },
        include: {
          product: { select: { id: true, code: true, isActive: true } },
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: itemId,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Soft-delete only — same Recycle Bin convention as every other CRM
   * delete, matching legacy's `removeCrmDealProduct`. */
  @TeamScoped()
  async removeItem(
    scope: TeamScope,
    opportunityId: number,
    itemId: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findFirst({
        where: teamWhere(
          scope,
          { id: opportunityId, deletedAt: null },
          SCOPE_FIELDS,
        ),
        select: { id: true },
      });
      if (!opportunity) return null;
      const before = await tx.opportunityProduct.findFirst({
        where: { id: itemId, opportunityId, deletedAt: null },
      });
      if (!before) return null;
      const after = await tx.opportunityProduct.update({
        where: { id: itemId },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: itemId,
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
    return this.prisma.opportunityProduct.findMany({
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
        const before = await tx.opportunityProduct.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const parent = await tx.opportunity.findFirst({
          where: {
            id: before.opportunityId,
            organizationId: scope.organizationId,
          },
          select: { deletedAt: true },
        });
        if (parent?.deletedAt) {
          throw new BusinessRuleViolationException(
            "Restore the parent opportunity first - it is still in the Recycle Bin.",
            "PARENT_DELETED",
          );
        }
        const after = await tx.opportunityProduct.update({
          where: { id },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
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
        const before = await tx.opportunityProduct.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.opportunityProduct.delete({ where: { id } });
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
