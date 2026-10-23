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
        const grnItem = grn.items[i]!;
        const unitCost = p.line.unitCost ?? Number(p.item.unitPrice);

        // Units rejected at the dock were physically received, so they must
        // show up in inventory as Rejected / Bad stock rather than only on
        // the GRN: receive them, then write them straight off to the damaged
        // bucket (net on-hand effect is zero). They stay open on the PO.
        if (p.rejected > 0) {
          const rejectBase = {
            organizationId: scope.organizationId,
            productId: p.item.productId,
            warehouseId: po.warehouseId,
            referenceType: "GRN",
            referenceId: grn.id,
            referenceNumber: grnNumber,
            notes: `Rejected at receipt (${grnNumber})`,
            createdBy: actorId,
          };
          await this.stock.post(tx, {
            ...rejectBase,
            transactionType: "PURCHASE_RECEIPT",
            quantityIn: p.rejected,
            unitCost,
            idempotencyKey: `GRN:${grn.id}:${grnItem.id}:REJECT_IN`,
          });
          await this.stock.post(tx, {
            ...rejectBase,
            transactionType: "DAMAGE",
            quantityOut: p.rejected,
            idempotencyKey: `GRN:${grn.id}:${grnItem.id}:REJECT_DAMAGE`,
          });
        }

        if (p.accepted <= 0) continue;

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

  /** Deletes a goods receipt and unwinds what it did. The stock ledger is
   * append-only, so instead of deleting its entries the accepted quantity is
   * taken back out with an offsetting adjustment (refused if the stock has
   * since been used), the PO's received quantity / incoming are restored and
   * the PO status is recomputed. Receipts tied to a batch or serial numbers
   * are refused: their lot quantities are maintained separately. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction((tx) =>
      this.removeInTx(tx, scope, id, actorId),
    );
  }

  /** Same as `remove`, inside the caller's transaction (PO delete cascade). */
  async removeInTx(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
    actorId: number,
  ): Promise<boolean> {
    const grn = await tx.scmGoodsReceipt.findFirst({
      where: tenantWhere(scope, { id }),
      include: { items: true, bills: { select: { id: true } } },
    });
    if (!grn) return false;
    if (grn.bills.length > 0) {
      return fail(
        `Cannot delete ${grn.grnNumber} — ${grn.bills.length} supplier bill(s) reference this receipt.`,
        "GRN_HAS_BILLS",
      );
    }
    if (
      grn.items.some(
        (it) =>
          it.acceptedQuantity.greaterThan(0) &&
          (it.batchNumber || it.serialNumbers.length > 0),
      )
    ) {
      return fail(
        `Cannot delete ${grn.grnNumber}: it is tied to a batch/serial. Post an offsetting adjustment instead.`,
        "GRN_BATCH_SERIAL",
      );
    }
    await tx.$queryRaw`SELECT id FROM scm.purchase_orders WHERE id = ${grn.purchaseOrderId} AND organization_id = ${scope.organizationId} FOR UPDATE`;
    const po = await tx.scmPurchaseOrder.findFirstOrThrow({
      where: { id: grn.purchaseOrderId },
    });

    for (const it of grn.items) {
      if (it.rejectedQuantity.greaterThan(0)) {
        await this.stock.applyDamagedDelta(
          tx,
          scope.organizationId,
          it.productId,
          grn.warehouseId,
          -Number(it.rejectedQuantity),
        );
      }
      if (it.acceptedQuantity.lessThanOrEqualTo(0)) continue;
      const accepted = Number(it.acceptedQuantity);
      await this.stock.post(tx, {
        organizationId: scope.organizationId,
        productId: it.productId,
        warehouseId: grn.warehouseId,
        locationId: grn.locationId,
        transactionType: "ADJUSTMENT_OUT",
        referenceType: "GRN_REVERSAL",
        referenceId: grn.id,
        referenceNumber: grn.grnNumber,
        quantityOut: accepted,
        notes: `Reversal: ${grn.grnNumber} deleted`,
        createdBy: actorId,
        idempotencyKey: `GRN_DELETE:${grn.id}:${it.id}`,
      });
      await tx.scmPurchaseOrderItem.update({
        where: { id: it.purchaseOrderItemId },
        data: { receivedQuantity: { decrement: accepted } },
      });
      if (po.incomingApplied) {
        await this.stock.applyIncomingDelta(
          tx,
          scope.organizationId,
          it.productId,
          grn.warehouseId,
          accepted,
        );
      }
    }

    await tx.scmGoodsReceipt.delete({ where: { id } });

    const items = await tx.scmPurchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
    });
    let status = po.status;
    if (po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED") {
      status = items.every((i) =>
        i.quantity.lessThanOrEqualTo(i.receivedQuantity),
      )
        ? "RECEIVED"
        : items.some((i) => i.receivedQuantity.greaterThan(0))
          ? "PARTIALLY_RECEIVED"
          : "SENT";
      if (status !== po.status) {
        await tx.scmPurchaseOrder.update({
          where: { id: po.id },
          data: { status, updatedBy: actorId },
        });
      }
    }
    await this.audit.write(tx, {
      entityType: "scm_goods_receipt",
      entityId: id,
      action: "delete",
      before: { grnNumber: grn.grnNumber, purchaseOrder: po.poNumber },
      after: { poStatus: status },
    });
    return true;
  }
}
