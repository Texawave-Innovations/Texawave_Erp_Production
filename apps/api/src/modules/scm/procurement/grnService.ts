import {
  createRecord,
  getAllRecords,
  updateRecord,
  database,
  ref,
  runTransaction,
  set,
  stripUndefined,
} from "@/services/firebase";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import {
  INVENTORY_PATHS,
  firebaseKey,
} from "@/modules/scm/inventory/inventoryPaths";
import {
  applyIncomingDelta,
  postLedgerEntry,
  postOnce,
  upsertBatchQuantity,
} from "@/modules/scm/inventory/stockLedgerService";
import {
  RECEIVABLE_PO_STATUSES,
  pendingReceiptQty,
} from "@/modules/scm/shared/businessRules";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import type {
  GoodsReceipt,
  GrnItem,
  GrnStatus,
  InventorySettings,
  ScmPOStatus,
  ScmPurchaseOrder,
  SerialNumberRecord,
} from "@/types";

/** One receiving row, matched to its PO line by index (a PO may repeat a product). */
export interface GrnLineInput {
  poLineIndex: number;
  productCode: string;
  productName: string;
  uom: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  receivingQuantity: number;
  rejectedQuantity: number;
  batchNumber: string;
  serialNumbers: string[];
  unitCost: number;
  notes: string;
}

export function parseSerials(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Synchronous validation of the receiving rows. Returns an error message or null. */
export function validateGrnLines(
  lines: GrnLineInput[],
  settingsByCode: Map<string, InventorySettings>,
): string | null {
  if (lines.length === 0)
    return "Enter a receiving quantity for at least one item";
  const serialsByProduct = new Map<string, Set<string>>();
  for (const d of lines) {
    const remaining = d.orderedQuantity - d.previouslyReceivedQuantity;
    if (d.receivingQuantity < 0 || d.rejectedQuantity < 0)
      return `${d.productName}: quantities cannot be negative`;
    if (d.receivingQuantity > remaining)
      return `${d.productName}: cannot receive ${d.receivingQuantity}, only ${remaining} remaining on the PO`;
    if (d.rejectedQuantity > d.receivingQuantity)
      return `${d.productName}: rejected quantity cannot exceed receiving quantity`;
    if (!(d.unitCost >= 0))
      return `${d.productName}: unit cost cannot be negative`;
    const accepted = d.receivingQuantity - d.rejectedQuantity;
    const setting = settingsByCode.get(d.productCode);
    if (setting?.batchTracked && accepted > 0 && !d.batchNumber.trim())
      return `${d.productName} requires a batch number`;
    if (setting?.serialTracked && accepted > 0) {
      if (d.serialNumbers.length !== accepted)
        return `${d.productName} requires exactly ${accepted} serial number(s), got ${d.serialNumbers.length}`;
      const seen = serialsByProduct.get(d.productCode) || new Set<string>();
      for (const sn of d.serialNumbers) {
        if (seen.has(sn))
          return `${d.productName}: serial number "${sn}" entered more than once`;
        seen.add(sn);
      }
      serialsByProduct.set(d.productCode, seen);
    }
  }
  return null;
}

/** Serial numbers are unique per product — checks the entered ones against inventory. */
async function assertSerialsUnused(items: GrnItem[]): Promise<void> {
  const withSerials = items.filter(
    (it) => it.serialNumbers && it.serialNumbers.length > 0,
  );
  if (withSerials.length === 0) return;
  const existing = (await getAllRecords(
    INVENTORY_PATHS.serials,
  )) as SerialNumberRecord[];
  const taken = new Set(
    existing.map((s) => `${s.productCode}__${s.serialNumber}`),
  );
  for (const it of withSerials) {
    const dup = it.serialNumbers?.find((sn) =>
      taken.has(`${it.productCode}__${sn}`),
    );
    if (dup)
      throw new Error(
        `Serial number "${dup}" already exists in inventory for ${it.productName}`,
      );
  }
}

/** Adds this GRN's accepted quantities onto the PO lines, atomically and at most once per GRN. */
async function applyReceiptToPo(
  poId: string,
  grnId: string,
  items: GrnItem[],
): Promise<ScmPurchaseOrder> {
  const poRef = ref(database, `${PROCUREMENT_PATHS.purchaseOrders}/${poId}`);
  let failure: string | null = null;

  const result = await runTransaction(
    poRef,
    (current: ScmPurchaseOrder | null) => {
      failure = null;
      if (current === null) return null; // not cached yet — let the server re-run with the real value
      if (current.receiptGrnIds?.[grnId]) return; // already applied by an earlier attempt
      if (!RECEIVABLE_PO_STATUSES.has(current.status)) {
        failure = `Purchase order is ${formatStatusLabel(current.status)} — goods can only be received against a sent purchase order.`;
        return;
      }
      const nextItems = current.items.map((it) => ({ ...it }));
      for (const row of items) {
        if (row.acceptedQuantity <= 0) continue;
        const line =
          row.poLineIndex != null ? nextItems[row.poLineIndex] : undefined;
        if (!line || line.productCode !== row.productCode) {
          failure = `${row.productName}: the purchase order lines have changed. Reload and try again.`;
          return;
        }
        const remaining = pendingReceiptQty(line);
        if (row.acceptedQuantity > remaining) {
          failure = `${row.productName}: cannot receive ${row.acceptedQuantity}, only ${remaining} remaining on the PO (another receipt may have just been recorded).`;
          return;
        }
        line.receivedQuantity =
          (line.receivedQuantity || 0) + row.acceptedQuantity;
      }
      const status: ScmPOStatus = nextItems.every(
        (it) => pendingReceiptQty(it) === 0,
      )
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";
      return stripUndefined({
        ...current,
        items: nextItems,
        status,
        receiptGrnIds: { ...(current.receiptGrnIds || {}), [grnId]: true },
        updatedAt: Date.now(),
      });
    },
  );

  if (failure) throw new Error(failure);
  const po = result.snapshot.val() as ScmPurchaseOrder | null;
  if (!po) throw new Error("Purchase order not found. Reload and try again.");
  if (!po.receiptGrnIds?.[grnId])
    throw new Error("Failed to record the receipt against the purchase order.");
  return po;
}

/** Posts every stock side effect of one GRN line. Each effect is keyed `${grnId}:${i}`, so a
 * retry after a partial failure skips whatever already succeeded. */
async function postGrnLine(
  grn: GoodsReceipt,
  i: number,
  incomingApplied: boolean,
  performedBy: string,
): Promise<void> {
  const item = grn.items[i];
  if (item.acceptedQuantity <= 0) return;
  const key = `${grn.id}:${i}`;

  await postOnce("GRN", key, () =>
    postLedgerEntry({
      productCode: item.productCode,
      productName: item.productName,
      warehouseId: grn.warehouseId,
      transactionType: "PURCHASE_RECEIPT",
      referenceType: "GRN",
      referenceId: grn.id,
      referenceNumber: grn.grnNumber,
      quantityIn: item.acceptedQuantity,
      unitCost: item.unitCost,
      createdBy: performedBy,
      notes: item.batchNumber ? `Batch ${item.batchNumber}` : undefined,
    }),
  );

  if (incomingApplied) {
    await postOnce("GRN_INCOMING", key, async () => {
      await applyIncomingDelta(
        item.productCode,
        grn.warehouseId,
        item.productName,
        -item.acceptedQuantity,
      );
      return "applied";
    });
  }

  if (item.batchNumber) {
    await postOnce("GRN_BATCH", key, async () => {
      const batch = await upsertBatchQuantity({
        batchNumber: item.batchNumber as string,
        productCode: item.productCode,
        productName: item.productName,
        warehouseId: grn.warehouseId,
        quantity: item.acceptedQuantity,
        createdBy: performedBy,
      });
      return batch.id;
    });
  }

  if (item.serialNumbers && item.serialNumbers.length > 0) {
    await postOnce("GRN_SERIALS", key, async () => {
      // Deterministic keys, so a re-run overwrites instead of duplicating.
      for (const serialNumber of item.serialNumbers || []) {
        const id = firebaseKey(`${item.productCode}__${serialNumber}`);
        await set(
          ref(database, `${INVENTORY_PATHS.serials}/${id}`),
          stripUndefined({
            id,
            serialNumber,
            productCode: item.productCode,
            productName: item.productName,
            warehouseId: grn.warehouseId,
            status: "AVAILABLE",
            currentReference: grn.grnNumber,
            createdBy: performedBy,
            createdAt: Date.now(),
          }),
        );
      }
      return "created";
    });
  }
}

/**
 * Applies a DRAFT GRN: records the receipt on the PO, posts each line to the stock ledger and
 * marks the GRN COMPLETED. Safe to call again for a GRN left DRAFT by an earlier failure.
 */
export async function postGrn(
  grn: GoodsReceipt,
  performedBy: string,
): Promise<ScmPOStatus> {
  const po = await applyReceiptToPo(grn.purchaseOrderId, grn.id, grn.items);
  for (let i = 0; i < grn.items.length; i++) {
    await postGrnLine(grn, i, !!po.incomingApplied, performedBy);
  }
  await updateRecord(PROCUREMENT_PATHS.grns, grn.id, {
    status: "COMPLETED" as GrnStatus,
  });
  await logRecordAudit(
    PROCUREMENT_PATHS.grns,
    grn.id,
    "GRN finalized",
    performedBy,
    `${grn.grnNumber} against ${grn.purchaseOrderNumber}`,
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    po.id,
    "PO receipt recorded",
    performedBy,
    `${grn.grnNumber}: ${po.status}`,
  );
  await notifyAdminFeed(
    "Goods Receipt Completed",
    `${grn.grnNumber} received against ${grn.purchaseOrderNumber} (${grn.vendorNameSnapshot}) — PO is now ${formatStatusLabel(po.status)}`,
    "procurement",
  );
  return po.status;
}

/**
 * Validate → create the GRN as DRAFT → post it. A failure while posting leaves a visible DRAFT
 * GRN that can be retried with `postGrn`; a failure before anything was posted (e.g. the PO was
 * received or cancelled elsewhere) cancels the GRN.
 */
export async function createAndPostGrn(params: {
  po: ScmPurchaseOrder;
  lines: GrnLineInput[];
  receiptDate: string;
  notes: string;
  performedBy: string;
}): Promise<{ grnNumber: string; poStatus: ScmPOStatus }> {
  const { po, lines, receiptDate, notes, performedBy } = params;
  if (!RECEIVABLE_PO_STATUSES.has(po.status))
    throw new Error(
      `Purchase order is ${formatStatusLabel(po.status)} and cannot be received against.`,
    );
  if (!po.warehouseId) throw new Error("Purchase order has no warehouse");

  const items: GrnItem[] = lines.map((d) => {
    const accepted = d.receivingQuantity - d.rejectedQuantity;
    return {
      poLineIndex: d.poLineIndex,
      productCode: d.productCode,
      productName: d.productName,
      uom: d.uom,
      orderedQuantity: d.orderedQuantity,
      previouslyReceivedQuantity: d.previouslyReceivedQuantity,
      receivingQuantity: d.receivingQuantity,
      rejectedQuantity: d.rejectedQuantity,
      acceptedQuantity: accepted,
      batchNumber: d.batchNumber.trim() || undefined,
      serialNumbers: d.serialNumbers,
      unitCost: d.unitCost,
      totalCost: Math.round(accepted * d.unitCost * 100) / 100,
      notes: d.notes.trim() || undefined,
    };
  });
  await assertSerialsUnused(items);

  const grnNumber = await reserveDocumentNumber("grn");
  const draft: Omit<GoodsReceipt, "id" | "createdAt"> = {
    grnNumber,
    purchaseOrderId: po.id,
    purchaseOrderNumber: po.poNumber,
    vendorId: po.vendorId,
    vendorNameSnapshot: po.vendorNameSnapshot,
    receiptDate,
    warehouseId: po.warehouseId,
    receivedBy: performedBy,
    items,
    notes: notes.trim() || undefined,
    status: "DRAFT",
    createdBy: performedBy,
  };
  const grnId = await createRecord(PROCUREMENT_PATHS.grns, draft);
  if (!grnId) throw new Error("Failed to create GRN record");
  const grn: GoodsReceipt = { ...draft, id: grnId, createdAt: Date.now() };

  let receiptApplied = false;
  try {
    await applyReceiptToPo(po.id, grnId, items);
    receiptApplied = true;
    const poStatus = await postGrn(grn, performedBy);
    return { grnNumber, poStatus };
  } catch (err) {
    if (!receiptApplied) {
      await updateRecord(PROCUREMENT_PATHS.grns, grnId, {
        status: "CANCELLED" as GrnStatus,
      }).catch(() => undefined);
      throw err;
    }
    throw new Error(
      `${grnNumber} was saved but stock posting did not finish (${errorMessage(err, "unknown error")}). Use "Retry posting" on the GRN.`,
    );
  }
}
