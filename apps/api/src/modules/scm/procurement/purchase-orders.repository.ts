import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { actorName, toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";
import { GoodsReceiptsRepository } from "./goods-receipts.repository.js";
import { LINKABLE_REQUISITION_STATUSES } from "./procurement.helpers.js";

export interface PurchaseOrderLineData {
  productId: number;
  productName: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface PurchaseOrderData {
  supplierId: number;
  vendorName: string;
  vendorGstin: string | null;
  rfqId?: number | undefined;
  quotationId?: number | undefined;
  requisitionId?: number | undefined;
  requisitionNumber?: string | undefined;
  poDate: string;
  expectedDeliveryDate?: string | undefined;
  warehouseId: number;
  deliveryLocation?: string | undefined;
  paymentTerms?: string | undefined;
  currency: string;
  freight: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string | undefined;
  lines: PurchaseOrderLineData[];
}

export interface PurchaseOrderFilter {
  q?: string | undefined;
  status?: string | undefined;
  supplierId?: number | undefined;
  requisitionId?: number | undefined;
  statusIn?: readonly string[] | undefined;
}

export const purchaseOrderInclude = {
  items: { orderBy: { lineNo: "asc" } },
  supplier: { select: { id: true, supplierCode: true, companyName: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  quotation: { select: { id: true, quotationNumber: true } },
  rfq: { select: { id: true, rfqNumber: true } },
  requisition: {
    select: {
      id: true,
      requisitionNumber: true,
      requestedByName: true,
      department: true,
      purpose: true,
    },
  },
  _count: { select: { receipts: true } },
} satisfies Prisma.ScmPurchaseOrderInclude;

const remaining = (it: {
  quantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
}) => Prisma.Decimal.max(0, it.quantity.minus(it.receivedQuantity));

@Injectable()
export class PurchaseOrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly stock: StockPostingService,
    private readonly receipts: GoodsReceiptsRepository,
  ) {}

  @OrgScoped()
  async findMany(scope: OrgScope, f: PurchaseOrderFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmPurchaseOrderWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.statusIn ? { status: { in: [...f.statusIn] } } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.requisitionId ? { requisitionId: f.requisitionId } : {}),
      ...(f.q
        ? {
            OR: [
              { poNumber: { contains: f.q, mode: "insensitive" } },
              { vendorNameSnapshot: { contains: f.q, mode: "insensitive" } },
              { requisitionNumber: { contains: f.q, mode: "insensitive" } },
              {
                requisition: {
                  OR: [
                    {
                      requisitionNumber: { contains: f.q, mode: "insensitive" },
                    },
                    { requestedByName: { contains: f.q, mode: "insensitive" } },
                    { department: { contains: f.q, mode: "insensitive" } },
                    { purpose: { contains: f.q, mode: "insensitive" } },
                  ],
                },
              },
              {
                rfq: { rfqNumber: { contains: f.q, mode: "insensitive" } },
              },
              {
                quotation: {
                  quotationNumber: { contains: f.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmPurchaseOrder.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: purchaseOrderInclude,
      }),
      this.prisma.scmPurchaseOrder.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmPurchaseOrder.findFirst({
      where: tenantWhere(scope, { id }),
      include: purchaseOrderInclude,
    });
  }

  /** Live (non-cancelled) POs raised from a quotation. */
  @OrgScoped()
  findLiveForQuotation(scope: OrgScope, quotationId: number) {
    return this.prisma.scmPurchaseOrder.findFirst({
      where: tenantWhere<Prisma.ScmPurchaseOrderWhereInput>(scope, {
        quotationId,
        status: { not: "CANCELLED" },
      }),
      select: { id: true, poNumber: true },
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, data: PurchaseOrderData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const poNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "purchaseOrder",
      );
      const created = await tx.scmPurchaseOrder.create({
        data: {
          organizationId: scope.organizationId,
          poNumber,
          supplierId: data.supplierId,
          vendorNameSnapshot: data.vendorName,
          vendorGstinSnapshot: data.vendorGstin,
          rfqId: data.rfqId ?? null,
          quotationId: data.quotationId ?? null,
          requisitionId: data.requisitionId ?? null,
          requisitionNumber: data.requisitionNumber ?? null,
          poDate: new Date(data.poDate),
          expectedDeliveryDate: toDate(data.expectedDeliveryDate),
          warehouseId: data.warehouseId,
          deliveryLocation: data.deliveryLocation?.trim() || null,
          paymentTerms: data.paymentTerms?.trim() || null,
          currency: data.currency,
          freight: data.freight,
          discount: data.discount,
          subtotal: data.subtotal,
          taxAmount: data.taxAmount,
          total: data.total,
          notes: data.notes?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: data.lines.map((l, i) => ({
              lineNo: i + 1,
              productId: l.productId,
              productNameSnapshot: l.productName,
              uom: l.uom,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              total: l.total,
            })),
          },
        },
        include: purchaseOrderInclude,
      });
      await this.audit.write(tx, {
        entityType: "scm_purchase_order",
        entityId: created.id,
        action: "create",
        after: { poNumber, supplier: data.vendorName, total: data.total },
      });
      if (data.requisitionId) {
        // Linking converts the requisition, so it drops out of the "not yet
        // on a PO" suggestions and never gets offered twice.
        const converted = await tx.scmPurchaseRequisition.updateMany({
          where: {
            id: data.requisitionId,
            organizationId: scope.organizationId,
            status: { in: [...LINKABLE_REQUISITION_STATUSES] },
          },
          data: { status: "CONVERTED", updatedBy: actorId },
        });
        if (converted.count > 0) {
          await this.audit.write(tx, {
            entityType: "scm_purchase_requisition",
            entityId: data.requisitionId,
            action: "converted",
            after: { status: "CONVERTED", purchaseOrder: poNumber },
          });
        }
      }
      return created;
    });
  }

  /** Plain status move (submit, send). */
  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: string,
    actorId: number,
  ) {
    return this.run(scope, id, from, to, actorId, async () => ({}));
  }

  /** Approval raises `incoming` by each line's unreceived quantity. The status
   * claim and every incoming change commit together, so a retry can never
   * double-apply (legacy needed per-line posting claims for this). */
  @OrgScoped()
  async approve(scope: OrgScope, id: number, actorId: number) {
    return this.run(
      scope,
      id,
      ["PENDING_APPROVAL"],
      "APPROVED",
      actorId,
      async (tx, po) => {
        for (const it of po.items) {
          const rest = remaining(it);
          if (rest.lessThanOrEqualTo(0)) continue;
          await this.stock.applyIncomingDelta(
            tx,
            scope.organizationId,
            it.productId,
            po.warehouseId,
            Number(rest),
          );
        }
        return {
          approvedBy: actorId,
          approvedByName: await actorName(tx, scope.organizationId, actorId),
          approvedAt: new Date(),
          incomingApplied: true,
        };
      },
    );
  }

  /** Cancel/close lowers `incoming` by what is still unreceived. */
  @OrgScoped()
  async end(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: "CANCELLED" | "CLOSED",
    actorId: number,
  ) {
    return this.run(scope, id, from, to, actorId, async (tx, po) => {
      if (!po.incomingApplied) return {};
      for (const it of po.items) {
        const rest = remaining(it);
        if (rest.lessThanOrEqualTo(0)) continue;
        await this.stock.applyIncomingDelta(
          tx,
          scope.organizationId,
          it.productId,
          po.warehouseId,
          -Number(rest),
        );
      }
      return { incomingApplied: false };
    });
  }

  private async run(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: string,
    actorId: number,
    effect: (
      tx: Prisma.TransactionClient,
      po: Prisma.ScmPurchaseOrderGetPayload<{ include: { items: true } }>,
    ) => Promise<Prisma.ScmPurchaseOrderUncheckedUpdateManyInput>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.scmPurchaseOrder.findFirst({
        where: tenantWhere(scope, { id }),
        include: { items: true },
      });
      if (!po) return null;
      if (!from.includes(po.status)) {
        throw new InvalidStateTransitionException(
          "Purchase order",
          po.status,
          to,
        );
      }
      const claimed = await tx.scmPurchaseOrder.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: { status: to, updatedBy: actorId },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Purchase order",
          "changed",
          to,
        );
      }
      const extra = await effect(tx, po);
      if (Object.keys(extra).length > 0) {
        await tx.scmPurchaseOrder.update({
          where: { id },
          data: extra as Prisma.ScmPurchaseOrderUncheckedUpdateInput,
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_purchase_order",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: po.status },
        after: { status: to },
      });
      return tx.scmPurchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
  }

  /** Deletes a purchase order together with every goods receipt received
   * against it (each one's stock is unwound — see GoodsReceiptsRepository.
   * removeInTx). Returns the number of receipts removed, or null when the PO
   * does not exist. Refused while supplier bills reference the PO. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.scmPurchaseOrder.findFirst({
        where: tenantWhere(scope, { id }),
        include: {
          items: true,
          receipts: { select: { id: true } },
          bills: { select: { id: true } },
        },
      });
      if (!po) return null;
      if (po.bills.length > 0) {
        throw new BusinessRuleViolationException(
          `Cannot delete ${po.poNumber} — ${po.bills.length} supplier bill(s) reference this purchase order.`,
          "PO_HAS_BILLS",
        );
      }
      for (const grn of po.receipts) {
        await this.receipts.removeInTx(tx, scope, grn.id, actorId);
      }
      const fresh = await tx.scmPurchaseOrder.findFirstOrThrow({
        where: { id },
        include: { items: true },
      });
      if (fresh.incomingApplied) {
        for (const it of fresh.items) {
          await this.stock.applyIncomingDelta(
            tx,
            scope.organizationId,
            it.productId,
            fresh.warehouseId,
            -Number(it.quantity),
          );
        }
      }
      await tx.scmPurchaseOrder.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_purchase_order",
        entityId: id,
        action: "delete",
        before: { poNumber: po.poNumber, receiptsRemoved: po.receipts.length },
      });
      return { receiptsRemoved: po.receipts.length };
    });
  }
}
