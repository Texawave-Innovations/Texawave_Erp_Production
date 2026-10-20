// Shared batch/serial helpers for stock movements raised outside the inventory screens (returns
// and quality). The ledger (`postLedgerEntry`) stays the authority for quantities; these only keep
// the batch/serial records in step with it.
import {
  database,
  getAllRecords,
  getRecordById,
  ref,
  runTransaction,
  updateRecord,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { INVENTORY_PATHS } from "./inventoryPaths";
import {
  postLedgerEntry,
  postOnce,
  type PostLedgerEntryParams,
} from "./stockLedgerService";
import type {
  BatchStatus,
  SerialNumberRecord,
  SerialStatus,
  StockBatch,
} from "@/types";

/** Stable client-generated line id (used as a per-line posting reference). */
export function makeLineId(prefix = "ln"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Loads a batch and checks it belongs to `productCode`. */
export async function loadAndValidateBatch(
  batchId: string,
  productCode: string,
): Promise<StockBatch> {
  const batch = (await getRecordById(
    INVENTORY_PATHS.batches,
    batchId,
  )) as StockBatch | null;
  if (!batch) throw new Error(`Batch ${batchId} not found.`);
  if (batch.productCode !== productCode) {
    throw new Error(
      `Batch ${batch.batchNumber || batchId} belongs to ${batch.productCode}, not ${productCode}.`,
    );
  }
  return batch;
}

/** Loads every serial in `serialNumbers`, checking each exists, matches the product, is not
 *  listed twice and is not in one of `blockedStatuses`. */
export async function loadAndValidateSerials(
  serialNumbers: string[],
  productCode: string,
  blockedStatuses: SerialStatus[] = [],
): Promise<SerialNumberRecord[]> {
  if (new Set(serialNumbers).size !== serialNumbers.length)
    throw new Error("Duplicate serial numbers on the same line.");
  if (serialNumbers.length === 0) return [];
  const all = (await getAllRecords(
    INVENTORY_PATHS.serials,
  )) as SerialNumberRecord[];
  const byNumber = new Map(
    all
      .filter((s) => s.productCode === productCode)
      .map((s) => [s.serialNumber, s]),
  );
  return serialNumbers.map((sn) => {
    const rec = byNumber.get(sn);
    if (!rec) throw new Error(`Serial ${sn} not found for ${productCode}.`);
    if (blockedStatuses.includes(rec.status))
      throw new Error(`Serial ${sn} is already ${rec.status}.`);
    return rec;
  });
}

/** Atomically adds `delta` to a batch's quantity; rejects a result below zero. */
export async function adjustBatchQuantity(
  batchId: string,
  delta: number,
): Promise<number> {
  const batchRef = ref(database, `${INVENTORY_PATHS.batches}/${batchId}`);
  let error: string | null = null;
  const result = await runTransaction(
    batchRef,
    (current: StockBatch | null) => {
      error = null;
      if (current === null) return null; // not cached yet — let the server re-run with the real row
      const next = (current.quantity || 0) + delta;
      if (next < 0) {
        error = `Batch ${current.batchNumber} only has ${current.quantity || 0} on hand.`;
        return; // abort
      }
      return { ...current, quantity: next };
    },
  );
  if (error) throw new Error(error);
  const after = result.snapshot.val() as StockBatch | null;
  if (!result.committed || !after)
    throw new Error(`Batch ${batchId} not found.`);
  return after.quantity || 0;
}

/** Flips a batch's status only when `quantity` covers the whole remaining batch — a partial hit
 *  is tracked by the ledger's quarantine/damaged buckets and must not block the good stock. */
export async function setBatchStatusIfWhole(
  batch: StockBatch,
  quantity: number,
  status: BatchStatus,
  reference: string,
  performedBy: string,
): Promise<boolean> {
  const whole = (batch.quantity || 0) > 0 && quantity >= (batch.quantity || 0);
  if (whole) {
    await updateRecord(INVENTORY_PATHS.batches, batch.id, { status });
    await logRecordAudit(
      INVENTORY_PATHS.batches,
      batch.id,
      `Batch set to ${status}`,
      performedBy,
      `${reference} — ${batch.batchNumber} (${quantity}/${batch.quantity})`,
    );
  } else {
    await logRecordAudit(
      INVENTORY_PATHS.batches,
      batch.id,
      "Partial batch movement",
      performedBy,
      `${reference} — ${quantity} of ${batch.quantity}; batch status unchanged`,
    );
  }
  return whole;
}

/** Sets every serial to `status` (idempotent) and audits each one. */
export async function setSerialStatuses(
  serials: SerialNumberRecord[],
  status: SerialStatus,
  reference: string,
  performedBy: string,
  extra: Partial<Pick<SerialNumberRecord, "warehouseId" | "locationId">> = {},
): Promise<void> {
  for (const s of serials) {
    await updateRecord(INVENTORY_PATHS.serials, s.id, {
      status,
      currentReference: reference,
      ...extra,
    });
    await logRecordAudit(
      INVENTORY_PATHS.serials,
      s.id,
      `Serial set to ${status}`,
      performedBy,
      `${reference} — ${s.serialNumber}`,
    );
  }
}

export interface StockMovementParams {
  /** postOnce reference type/id — must be unique per line and action. */
  claimType: string;
  claimId: string;
  ledger: PostLedgerEntryParams;
  /** Batch/serial side effects. Run once, under their own claim, after the ledger posting — so a
   *  failure here can be retried without re-posting the ledger. Put idempotent steps (serial
   *  status) before non-idempotent ones (batch quantity). */
  stockRecords?: () => Promise<void>;
}

/** postOnce → postLedgerEntry → batch/serial update. Returns the ledger entry id (the recorded one
 *  on a retry), or undefined for a legacy claim that predates recorded results. */
export async function postStockMovement(
  params: StockMovementParams,
): Promise<string | undefined> {
  const { result, alreadyPosted } = await postOnce(
    params.claimType,
    params.claimId,
    () => postLedgerEntry(params.ledger),
  );
  if (alreadyPosted && !result) return undefined; // legacy claim: posted before results were recorded
  if (params.stockRecords) {
    const stockRecords = params.stockRecords;
    await postOnce(
      `${params.claimType}_STOCK_RECORDS`,
      params.claimId,
      async () => {
        await stockRecords();
        return "done";
      },
    );
  }
  return result;
}
