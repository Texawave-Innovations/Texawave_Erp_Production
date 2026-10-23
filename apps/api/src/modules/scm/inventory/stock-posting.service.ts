import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

export const LEDGER_TRANSACTION_TYPES = [
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_ISSUE",
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "QUARANTINE",
  "QC_RELEASE",
  "QC_REJECT",
] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

/** Types that add to on-hand. */
const IN_TYPES = new Set<LedgerTransactionType>([
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "QC_RELEASE",
]);
/** Types that subtract from on-hand. QC_REJECT carries a quantityOut but its
 * on-hand effect is zero: the quantity was already removed by the QUARANTINE
 * posting that put it on hold (legacy rule, must be preserved or on-hand
 * double-decrements). */
const OUT_TYPES = new Set<LedgerTransactionType>([
  "SALES_ISSUE",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "QUARANTINE",
  "QC_REJECT",
]);

export interface PostLedgerParams {
  organizationId: number;
  productId: number;
  warehouseId: number;
  locationId?: number | null | undefined;
  batchId?: number | null | undefined;
  serialId?: number | null | undefined;
  transactionType: LedgerTransactionType;
  referenceType: string;
  referenceId?: number | null | undefined;
  referenceNumber?: string | null | undefined;
  quantityIn?: number | undefined;
  quantityOut?: number | undefined;
  unitCost?: number | null | undefined;
  notes?: string | null | undefined;
  createdBy: number;
  /** Skip the non-negative guard. Only for deliberate corrections. */
  allowNegative?: boolean | undefined;
  /** Replaces legacy `postOnce`: a second post with the same key returns the
   * original entry instead of moving stock again. */
  idempotencyKey?: string | undefined;
}

export interface PostLedgerResult {
  id: number;
  alreadyPosted: boolean;
}

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
const ZERO = D(0);

interface BalanceDelta {
  onHand: Prisma.Decimal;
  damaged: Prisma.Decimal;
  quarantine: Prisma.Decimal;
}

function balanceDeltaFor(
  type: LedgerTransactionType,
  qIn: Prisma.Decimal,
  qOut: Prisma.Decimal,
): BalanceDelta {
  return {
    onHand: type === "QC_REJECT" ? ZERO : qIn.minus(qOut),
    damaged: type === "DAMAGE" || type === "QC_REJECT" ? qOut : ZERO,
    quarantine:
      type === "QUARANTINE"
        ? qOut
        : type === "QC_RELEASE"
          ? qIn.neg()
          : type === "QC_REJECT"
            ? qOut.neg()
            : ZERO,
  };
}

/** The single write path for stock movements. Every method takes the caller's
 * transaction client, so the balance change, the ledger row and the document
 * that caused them commit or roll back together, and the balance row is
 * locked (`FOR UPDATE`) for the duration — which is what makes the
 * non-negative guard race-free. */
@Injectable()
export class StockPostingService {
  /** Creates the balance row if needed and locks it for the transaction. */
  async lockBalance(
    tx: Prisma.TransactionClient,
    organizationId: number,
    productId: number,
    warehouseId: number,
  ) {
    await tx.scmStockBalance.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { organizationId, productId, warehouseId },
      update: {},
    });
    await tx.$queryRaw`SELECT id FROM scm.stock_balances WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} FOR UPDATE`;
    return tx.scmStockBalance.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
  }

  async post(
    tx: Prisma.TransactionClient,
    p: PostLedgerParams,
  ): Promise<PostLedgerResult> {
    const qIn = D(Math.max(0, p.quantityIn ?? 0));
    const qOut = D(Math.max(0, p.quantityOut ?? 0));
    if (qIn.isZero() && qOut.isZero()) {
      throw new BusinessRuleViolationException(
        "Ledger entry must have a non-zero quantityIn or quantityOut.",
        "LEDGER_ZERO_QUANTITY",
      );
    }
    if (IN_TYPES.has(p.transactionType) && !qOut.isZero()) {
      throw new BusinessRuleViolationException(
        `${p.transactionType} may not carry a quantityOut.`,
        "LEDGER_DIRECTION",
      );
    }
    if (OUT_TYPES.has(p.transactionType) && !qIn.isZero()) {
      throw new BusinessRuleViolationException(
        `${p.transactionType} may not carry a quantityIn.`,
        "LEDGER_DIRECTION",
      );
    }

    if (p.idempotencyKey) {
      const existing = await tx.scmStockLedgerEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: p.organizationId,
            idempotencyKey: p.idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id, alreadyPosted: true };
    }

    const balance = await this.lockBalance(
      tx,
      p.organizationId,
      p.productId,
      p.warehouseId,
    );
    const delta = balanceDeltaFor(p.transactionType, qIn, qOut);
    const quantity = qIn.isZero() ? qOut : qIn;

    if (!p.allowNegative) {
      const error = await this.guardError(
        tx,
        p.transactionType,
        balance,
        delta,
        quantity,
        p.productId,
      );
      if (error) {
        throw new BusinessRuleViolationException(error, "INSUFFICIENT_STOCK");
      }
    }

    const onHand = balance.onHand.plus(delta.onHand);
    await tx.scmStockBalance.update({
      where: { id: balance.id },
      data: {
        onHand,
        damaged: Prisma.Decimal.max(ZERO, balance.damaged.plus(delta.damaged)),
        quarantine: Prisma.Decimal.max(
          ZERO,
          balance.quarantine.plus(delta.quarantine),
        ),
      },
    });

    const entry = await tx.scmStockLedgerEntry.create({
      data: {
        organizationId: p.organizationId,
        productId: p.productId,
        warehouseId: p.warehouseId,
        locationId: p.locationId ?? null,
        batchId: p.batchId ?? null,
        serialId: p.serialId ?? null,
        transactionType: p.transactionType,
        referenceType: p.referenceType,
        referenceId: p.referenceId ?? null,
        referenceNumber: p.referenceNumber ?? null,
        quantityIn: qIn,
        quantityOut: qOut,
        unitCost: p.unitCost ?? null,
        idempotencyKey: p.idempotencyKey ?? null,
        notes: p.notes ?? null,
        createdBy: p.createdBy,
      },
      select: { id: true },
    });
    return { id: entry.id, alreadyPosted: false };
  }

  /** Returns a message when applying `delta` would drive the balance below
   * what physically exists. SALES_ISSUE consumes stock that was reserved for
   * it, so it checks on-hand; every other outbound movement may only take
   * unreserved stock. */
  private async guardError(
    tx: Prisma.TransactionClient,
    type: LedgerTransactionType,
    base: {
      onHand: Prisma.Decimal;
      reserved: Prisma.Decimal;
      quarantine: Prisma.Decimal;
    },
    delta: BalanceDelta,
    quantity: Prisma.Decimal,
    productId: number,
  ): Promise<string | null> {
    const label = async () =>
      (
        await tx.scmProduct.findUnique({
          where: { id: productId },
          select: { productCode: true },
        })
      )?.productCode ?? `product ${productId}`;

    if (type === "QC_RELEASE" || type === "QC_REJECT") {
      return base.quarantine.lessThan(quantity)
        ? `Only ${base.quarantine.toString()} unit(s) are in quarantine for ${await label()}.`
        : null;
    }
    if (delta.onHand.greaterThanOrEqualTo(0)) return null;
    const takeable =
      type === "SALES_ISSUE" ? base.onHand : base.onHand.minus(base.reserved);
    return takeable.lessThan(quantity)
      ? `Insufficient stock for ${await label()}: ${Prisma.Decimal.max(ZERO, takeable).toString()} available, ${quantity.toString()} required.`
      : null;
  }

  /** Reserve (positive) or release (negative) stock without a ledger entry —
   * reservations only shrink `available`, never `onHand`. Rejects
   * over-reservation; a release larger than what is reserved clamps at zero. */
  async applyReservationDelta(
    tx: Prisma.TransactionClient,
    organizationId: number,
    productId: number,
    warehouseId: number,
    delta: number,
  ) {
    const balance = await this.lockBalance(
      tx,
      organizationId,
      productId,
      warehouseId,
    );
    const next = Prisma.Decimal.max(ZERO, balance.reserved.plus(delta));
    if (D(delta).greaterThan(0) && next.greaterThan(balance.onHand)) {
      throw new BusinessRuleViolationException(
        "Cannot reserve more than the available stock.",
        "OVER_RESERVATION",
      );
    }
    return tx.scmStockBalance.update({
      where: { id: balance.id },
      data: { reserved: next },
    });
  }

  /** Adjusts `incoming` (raised when a PO is approved, lowered as GRNs
   * receive against it) without touching on-hand or the ledger. */
  async applyIncomingDelta(
    tx: Prisma.TransactionClient,
    organizationId: number,
    productId: number,
    warehouseId: number,
    delta: number,
  ) {
    const balance = await this.lockBalance(
      tx,
      organizationId,
      productId,
      warehouseId,
    );
    return tx.scmStockBalance.update({
      where: { id: balance.id },
      data: {
        incoming: Prisma.Decimal.max(ZERO, balance.incoming.plus(delta)),
      },
    });
  }

  /** Adjusts the `damaged` bucket alone — no ledger entry, no on-hand change.
   * Used when a document that parked stock there (a GRN's rejected units, which
   * are received then written off in one net-zero pair) is deleted. */
  async applyDamagedDelta(
    tx: Prisma.TransactionClient,
    organizationId: number,
    productId: number,
    warehouseId: number,
    delta: number,
  ) {
    const balance = await this.lockBalance(
      tx,
      organizationId,
      productId,
      warehouseId,
    );
    return tx.scmStockBalance.update({
      where: { id: balance.id },
      data: {
        damaged: Prisma.Decimal.max(ZERO, balance.damaged.plus(delta)),
      },
    });
  }

  /** Adds `quantity` onto the batch identified by (batchNumber, product,
   * warehouse), creating it on first sight. The unique index makes two
   * receipts of the same vendor lot accumulate onto one row. */
  async upsertBatchQuantity(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: number;
      batchNumber: string;
      productId: number;
      warehouseId: number;
      quantity: number;
      manufacturingDate?: Date | null | undefined;
      expiryDate?: Date | null | undefined;
      createdBy: number;
    },
  ) {
    return tx.scmStockBatch.upsert({
      where: {
        organizationId_batchNumber_productId_warehouseId: {
          organizationId: params.organizationId,
          batchNumber: params.batchNumber,
          productId: params.productId,
          warehouseId: params.warehouseId,
        },
      },
      create: {
        organizationId: params.organizationId,
        batchNumber: params.batchNumber,
        productId: params.productId,
        warehouseId: params.warehouseId,
        manufacturingDate: params.manufacturingDate ?? null,
        expiryDate: params.expiryDate ?? null,
        quantity: params.quantity,
        createdBy: params.createdBy,
      },
      update: { quantity: { increment: params.quantity } },
    });
  }

  /** Atomically adds `delta` to a batch; rejects a result below zero. */
  async adjustBatchQuantity(
    tx: Prisma.TransactionClient,
    organizationId: number,
    batchId: number,
    delta: number,
  ): Promise<number> {
    const result = await tx.scmStockBatch.updateMany({
      where: {
        id: batchId,
        organizationId,
        ...(delta < 0 ? { quantity: { gte: -delta } } : {}),
      },
      data: { quantity: { increment: delta } },
    });
    const batch = await tx.scmStockBatch.findFirst({
      where: { id: batchId, organizationId },
    });
    if (!batch) {
      throw new BusinessRuleViolationException(
        `Batch ${batchId} not found.`,
        "BATCH_NOT_FOUND",
      );
    }
    if (result.count === 0) {
      throw new BusinessRuleViolationException(
        `Batch ${batch.batchNumber} only has ${batch.quantity.toString()} on hand.`,
        "BATCH_INSUFFICIENT",
      );
    }
    return Number(batch.quantity);
  }

  /** Loads a batch and checks it belongs to `productId`. */
  async loadAndValidateBatch(
    tx: Prisma.TransactionClient,
    organizationId: number,
    batchId: number,
    productId: number,
  ) {
    const batch = await tx.scmStockBatch.findFirst({
      where: { id: batchId, organizationId },
    });
    if (!batch) {
      throw new BusinessRuleViolationException(
        `Batch ${batchId} not found.`,
        "BATCH_NOT_FOUND",
      );
    }
    if (batch.productId !== productId) {
      throw new BusinessRuleViolationException(
        `Batch ${batch.batchNumber} belongs to a different product.`,
        "BATCH_PRODUCT_MISMATCH",
      );
    }
    return batch;
  }

  /** Flips a batch status only when `quantity` covers the whole remaining
   * batch — a partial hit is tracked by the ledger's quarantine/damaged
   * buckets and must not block the good stock. */
  async setBatchStatusIfWhole(
    tx: Prisma.TransactionClient,
    batch: { id: number; quantity: Prisma.Decimal },
    quantity: number,
    status: string,
  ): Promise<boolean> {
    const whole =
      batch.quantity.greaterThan(0) &&
      D(quantity).greaterThanOrEqualTo(batch.quantity);
    if (whole) {
      await tx.scmStockBatch.update({
        where: { id: batch.id },
        data: { status },
      });
    }
    return whole;
  }

  /** Loads every serial in `serialNumbers`, checking each exists, matches the
   * product, is not listed twice and is not in a blocked status. */
  async loadAndValidateSerials(
    tx: Prisma.TransactionClient,
    organizationId: number,
    serialNumbers: string[],
    productId: number,
    blockedStatuses: string[] = [],
  ) {
    if (new Set(serialNumbers).size !== serialNumbers.length) {
      throw new BusinessRuleViolationException(
        "Duplicate serial numbers on the same line.",
        "SERIAL_DUPLICATE",
      );
    }
    if (serialNumbers.length === 0) return [];
    const rows = await tx.scmSerialNumber.findMany({
      where: { organizationId, productId, serialNumber: { in: serialNumbers } },
    });
    const byNumber = new Map(rows.map((r) => [r.serialNumber, r]));
    return serialNumbers.map((sn) => {
      const rec = byNumber.get(sn);
      if (!rec) {
        throw new BusinessRuleViolationException(
          `Serial ${sn} not found for this product.`,
          "SERIAL_NOT_FOUND",
        );
      }
      if (blockedStatuses.includes(rec.status)) {
        throw new BusinessRuleViolationException(
          `Serial ${sn} is already ${rec.status}.`,
          "SERIAL_STATUS",
        );
      }
      return rec;
    });
  }

  async setSerialStatuses(
    tx: Prisma.TransactionClient,
    serialIds: number[],
    status: string,
    reference: string,
    extra: { warehouseId?: number; locationId?: number | null } = {},
  ) {
    if (serialIds.length === 0) return;
    await tx.scmSerialNumber.updateMany({
      where: { id: { in: serialIds } },
      data: { status, currentReference: reference, ...extra },
    });
  }
}
