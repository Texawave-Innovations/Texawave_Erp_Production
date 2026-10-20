import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { actorName, toDate } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";
import { round2, RECEIVABLE_PO_STATUSES } from "./procurement.helpers.js";

export interface GrnInput {
  purchaseOrderId: number;
  receiptDate: string;
  locationId?: number | undefined;
  notes?: string | undefined;
  lines: {
    purchaseOrderItemId: number;
    receivingQuantity: number;
    rejectedQuantity?: number | undefined;
    batchNumber?: string | undefined;
    serialNumbers?: string[] | undefined;
    unitCost?: number | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
    notes?: string | undefined;
  }[];
}

const include = {
  items: { orderBy: { id: "asc" } },
  purchaseOrder: { select: { id: true, poNumber: true, status: true } },
  supplier: { select: { id: true, supplierCode: true, companyName: true } },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ScmGoodsReceiptInclude;

const fail = (message: string, code: string): never => {
  throw new BusinessRuleViolationException(message, code);
};

@Injectable()
export class GoodsReceiptsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly stock: StockPostingService,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      purchaseOrderId?: number | undefined;
      supplierId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmGoodsReceiptWhereInput>(scope, {
      ...(f.purchaseOrderId ? { purchaseOrderId: f.purchaseOrderId } : {}),
      ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      ...(f.q
        ? {
            OR: [
              { grnNumber: { contains: f.q, mode: "insensitive" } },
              { vendorNameSnapshot: { contains: f.q, mode: "insensitive" } },
              {
                purchaseOrder: {
                  poNumber: { contains: f.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmGoodsReceipt.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmGoodsReceipt.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const grn = await this.prisma.scmGoodsReceipt.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
    if (!grn) return null;
    const ledger = await this.prisma.scmStockLedgerEntry.findMany({
      where: tenantWhere(scope, { referenceType: "GRN", referenceId: id }),
      orderBy: { id: "asc" },
    });
    return { ...grn, ledgerEntries: ledger };
  }

  /** Validates, records the receipt on the PO, posts every stock effect and
   * writes the GRN — in ONE transaction under a lock on the PO row. Anything
   * that fails rolls the whole receipt back (legacy needed a visible DRAFT GRN
   * plus a "Retry posting" button to survive partial failures). */
  @OrgScoped()
  async create(scope: OrgScope, input: GrnInput, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM scm.purchase_orders WHERE id = ${input.purchaseOrderId} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const po = await tx.scmPurchaseOrder.findFirst({
        where: tenantWhere(scope, { id: input.purchaseOrderId }),
        include: { items: { include: { product: true } } },
      });
      if (!po) return fail("Purchase order not found.", "PO_NOT_FOUND");
      if (!(RECEIVABLE_PO_STATUSES as readonly string[]).includes(po.status)) {
        return fail(
          `Purchase order is ${po.status.replace(/_/g, " ").toLowerCase()} — goods can only be received against a sent purchase order.`,
          "PO_NOT_RECEIVABLE",
        );
      }

      const lines = input.lines.filter((l) => l.receivingQuantity > 0);
      if (lines.length === 0) {
        return fail(
          "Enter a receiving quantity for at least one item",
          "GRN_EMPTY",
        );
      }

      const serialsByProduct = new Map<number, Set<string>>();
      const prepared = lines.map((l) => {
        const item = po.items.find((i) => i.id === l.purchaseOrderItemId);
        if (!item) {
          return fail(
            "A receiving line does not belong to this purchase order.",
            "GRN_LINE_MISMATCH",
          );
        }
        const it = item as NonNullable<typeof item>;
        const name = it.productNameSnapshot;
        const rest = Number(it.quantity.minus(it.receivedQuantity));
        const rejected = l.rejectedQuantity ?? 0;
        if (l.receivingQuantity > rest) {
          fail(
            `${name}: cannot receive ${l.receivingQuantity}, only ${rest} remaining on the PO`,
            "GRN_OVER_RECEIPT",
          );
        }
        if (rejected > l.receivingQuantity) {
          fail(
            `${name}: rejected quantity cannot exceed receiving quantity`,
            "GRN_REJECTED",
          );
        }
        const accepted = round2(l.receivingQuantity - rejected);
        const serials = (l.serialNumbers ?? [])
          .map((s) => s.trim())
          .filter(Boolean);
        const batchNumber = l.batchNumber?.trim() || undefined;
        if (it.product.batchTracked && accepted > 0 && !batchNumber) {
          fail(`${name} requires a batch number`, "GRN_BATCH_REQUIRED");
        }
        if (it.product.serialTracked && accepted > 0) {
          if (serials.length !== accepted) {
            fail(
              `${name} requires exactly ${accepted} serial number(s), got ${serials.length}`,
              "GRN_SERIAL_COUNT",
            );
          }
          const seen = serialsByProduct.get(it.productId) ?? new Set<string>();
          for (const sn of serials) {
            if (seen.has(sn)) {
              fail(
                `${name}: serial number "${sn}" entered more than once`,
                "GRN_SERIAL_DUP",
              );
            }
            seen.add(sn);
          }
          serialsByProduct.set(it.productId, seen);
        }
        return { line: l, item: it, accepted, rejected, serials, batchNumber };
      });

      const allSerials = prepared.flatMap((p) => p.serials);
      if (allSerials.length > 0) {
        const taken = await tx.scmSerialNumber.findFirst({
          where: {
            organizationId: scope.organizationId,
            serialNumber: { in: allSerials },
          },
        });
        if (taken) {
          return fail(
            `Serial number "${taken.serialNumber}" already exists in inventory`,
            "GRN_SERIAL_EXISTS",
          );
        }
      }

      const grnNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "grn",
      );
      const receivedByName = await actorName(tx, scope.organizationId, actorId);
      const grn = await tx.scmGoodsReceipt.create({
        data: {
          organizationId: scope.organizationId,
          grnNumber,
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
          vendorNameSnapshot: po.vendorNameSnapshot,
          receiptDate: new Date(input.receiptDate),
          warehouseId: po.warehouseId,
          locationId: input.locationId ?? null,
          receivedBy: actorId,
          receivedByName,
          notes: input.notes?.trim() || null,
          createdBy: actorId,
          items: {
            create: prepared.map((p) => ({
              purchaseOrderItemId: p.item.id,
              productId: p.item.productId,
              productNameSnapshot: p.item.productNameSnapshot,
              uom: p.item.uom,
              orderedQuantity: p.item.quantity,
              previouslyReceivedQuantity: p.item.receivedQuantity,
              receivingQuantity: p.line.receivingQuantity,
              rejectedQuantity: p.rejected,
              acceptedQuantity: p.accepted,
              batchNumber: p.batchNumber ?? null,
              serialNumbers: p.serials,
              unitCost: p.line.unitCost ?? Number(p.item.unitPrice),
              totalCost: round2(
                p.accepted * (p.line.unitCost ?? Number(p.item.unitPrice)),
              ),
              notes: p.line.notes?.trim() || null,
            })),
          },
        },
        include: { items: { orderBy: { id: "asc" } } },
      });

      for (const [i, p] of prepared.entries()) {
        if (p.accepted <= 0) continue;
        const grnItem = grn.items[i]!;
        const unitCost = p.line.unitCost ?? Number(p.item.unitPrice);

        await tx.scmPurchaseOrderItem.update({
          where: { id: p.item.id },
          data: { receivedQuantity: { increment: p.accepted } },
        });

        let batchId: number | undefined;
        if (p.batchNumber) {
          const batch = await this.stock.upsertBatchQuantity(tx, {
            organizationId: scope.organizationId,
            batchNumber: p.batchNumber,
            productId: p.item.productId,
            warehouseId: po.warehouseId,
            quantity: p.accepted,
            manufacturingDate: toDate(p.line.manufacturingDate),
            expiryDate: toDate(p.line.expiryDate),
            createdBy: actorId,
          });
          batchId = batch.id;
        }

        await this.stock.post(tx, {
          organizationId: scope.organizationId,
          productId: p.item.productId,
          warehouseId: po.warehouseId,
          locationId: input.locationId,
          batchId,
          transactionType: "PURCHASE_RECEIPT",
          referenceType: "GRN",
          referenceId: grn.id,
          referenceNumber: grnNumber,
          quantityIn: p.accepted,
          unitCost,
          notes: p.batchNumber ? `Batch ${p.batchNumber}` : undefined,
          createdBy: actorId,
          idempotencyKey: `GRN:${grn.id}:${grnItem.id}`,
        });

        if (po.incomingApplied) {
          await this.stock.applyIncomingDelta(
            tx,
            scope.organizationId,
            p.item.productId,
            po.warehouseId,
            -p.accepted,
          );
        }

        if (p.serials.length > 0) {
          await tx.scmSerialNumber.createMany({
            data: p.serials.map((serialNumber) => ({
              organizationId: scope.organizationId,
              serialNumber,
              productId: p.item.productId,
              warehouseId: po.warehouseId,
              locationId: input.locationId ?? null,
              status: "AVAILABLE",
              currentReference: grnNumber,
              createdBy: actorId,
            })),
          });
        }
      }

      const items = await tx.scmPurchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });
      const status = items.every((it) =>
        it.quantity.lessThanOrEqualTo(it.receivedQuantity),
      )
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";
      await tx.scmPurchaseOrder.update({
        where: { id: po.id },
        data: { status, updatedBy: actorId },
      });

      await this.audit.write(tx, {
        entityType: "scm_goods_receipt",
        entityId: grn.id,
        action: "create",
        after: {
          grnNumber,
          purchaseOrder: po.poNumber,
          lines: prepared.length,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_purchase_order",
        entityId: po.id,
        action: "receipt",
        before: { status: po.status },
        after: { status, grnNumber },
      });

      return tx.scmGoodsReceipt.findUniqueOrThrow({
        where: { id: grn.id },
        include,
      });
    });
  }
}
