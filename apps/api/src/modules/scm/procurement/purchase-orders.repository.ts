import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { InvalidStateTransitionException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { actorName, toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";

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
  statusIn?: readonly string[] | undefined;
}

export const purchaseOrderInclude = {
  items: { orderBy: { lineNo: "asc" } },
  supplier: { select: { id: true, supplierCode: true, companyName: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  quotation: { select: { id: true, quotationNumber: true } },
  rfq: { select: { id: true, rfqNumber: true } },
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
  ) {}

  @OrgScoped()
  async findMany(scope: OrgScope, f: PurchaseOrderFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmPurchaseOrderWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.statusIn ? { status: { in: [...f.statusIn] } } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.q
        ? {
            OR: [
              { poNumber: { contains: f.q, mode: "insensitive" } },
              { vendorNameSnapshot: { contains: f.q, mode: "insensitive" } },
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
}
