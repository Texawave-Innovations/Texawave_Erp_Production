import { update } from "firebase/database";
import {
  createRecord,
  database,
  ref,
  runTransaction,
  stripUndefined,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import {
  postOnce,
  type PostLedgerEntryParams,
} from "../inventory/stockLedgerService";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import {
  adjustBatchQuantity,
  loadAndValidateBatch,
  loadAndValidateSerials,
  makeLineId,
  postStockMovement,
  setBatchStatusIfWhole,
  setSerialStatuses,
} from "../inventory/batchSerialService";
import { createQuarantineRecord } from "../quality/quarantineService";
import { RETURNS_PATHS } from "./returnsPaths";
import {
  dispositionBreakdown,
  dispositionError,
  isFullyDispositioned,
} from "./returnHelpers";
import {
  appendReturnLedgerIds,
  getFreshReturn,
  requireStatus,
  transitionReturn,
} from "./returnsMasterService";
import type {
  ReturnDisposition,
  ScmReturn,
  ScmReturnDispositionRecord,
  ScmReturnItem,
  ScmReturnPendingDisposition,
} from "@/types";

// ---------------------------------------------------------------------------
// Disposition — a line may be split across several dispositions. Each one first claims its
// quantity on the line (transaction, with a `pendingDisposition` marker), then posts; postings are
// keyed by the pending id, so a failure leaves the marker in place and `retryPendingDisposition`
// resumes without double-posting.
// ---------------------------------------------------------------------------

export interface DispositionOptions {
  warehouseId?: string;
  locationId?: string;
  notes?: string;
}

function itemPath(retId: string, idx: number): string {
  return `${RETURNS_PATHS.returns}/${retId}/items/${idx}`;
}

async function claimDisposition(
  retId: string,
  idx: number,
  itemId: string,
  pending: ScmReturnPendingDisposition,
): Promise<void> {
  let error: string | null = null;
  const result = await runTransaction(
    ref(database, itemPath(retId, idx)),
    (current: ScmReturnItem | null) => {
      error = null;
      if (current === null) return null;
      if (current.id !== itemId) {
        error = "Return line changed. Refresh and try again.";
        return; // abort
      }
      error = dispositionError(current, pending.disposition, pending.quantity);
      if (error) return; // abort
      const done = dispositionBreakdown(current);
      return stripUndefined({
        ...current,
        dispositionQuantities: {
          ...done,
          [pending.disposition]:
            (done[pending.disposition] || 0) + pending.quantity,
        },
        pendingDisposition: pending,
      });
    },
  );
  if (error) throw new Error(error);
  if (!result.committed || !result.snapshot.val())
    throw new Error("Return line not found. Refresh and try again.");
}

async function executePendingDisposition(
  ret: ScmReturn,
  idx: number,
  performedBy: string,
): Promise<void> {
  const item = ret.items[idx];
  const pending = item.pendingDisposition;
  if (!pending) return;
  const key = `${ret.id}:${item.id}:${pending.id}`;
  const qty = pending.quantity;
  const locationId = pending.locationId || item.locationId;
  const ledgerBase: Omit<PostLedgerEntryParams, "transactionType"> = {
    productCode: item.productCode,
    productName: item.productNameSnapshot,
    warehouseId: pending.warehouseId,
    locationId,
    batchId: item.batchId,
    referenceType: "CUSTOMER_RETURN",
    referenceId: `${ret.id}:${item.id}`,
    referenceNumber: ret.returnNumber,
    unitCost: item.unitCost,
    notes: pending.notes,
    createdBy: performedBy,
  };
  const ledgerIds: Array<string | undefined> = [];
  let quarantineRecordId: string | undefined;

  if (pending.disposition !== "REJECT") {
    const serials = await loadAndValidateSerials(
      item.serialNumbers || [],
      item.productCode,
    );
    const batchId = item.batchId;
    // Returned units physically come back, so on-hand (and the batch) go up first whatever the
    // disposition; non-restock dispositions then move them out of sellable stock.
    ledgerIds.push(
      await postStockMovement({
        claimType: "CUSTOMER_RETURN",
        claimId: `${key}:in`,
        ledger: {
          ...ledgerBase,
          transactionType: "SALES_RETURN",
          quantityIn: qty,
        },
        stockRecords: async () => {
          if (pending.disposition === "RESTOCK") {
            await setSerialStatuses(
              serials,
              "AVAILABLE",
              ret.returnNumber,
              performedBy,
              {
                warehouseId: pending.warehouseId,
                ...(locationId ? { locationId } : {}),
              },
            );
          }
          if (batchId) {
            const after = await adjustBatchQuantity(batchId, qty);
            await logRecordAudit(
              INVENTORY_PATHS.batches,
              batchId,
              "Batch quantity increased (customer return)",
              performedBy,
              `${ret.returnNumber} +${qty} → ${after}`,
            );
          }
        },
      }),
    );

    if (pending.disposition !== "RESTOCK") {
      const quarantine = pending.disposition === "QUARANTINE";
      ledgerIds.push(
        await postStockMovement({
          claimType: "CUSTOMER_RETURN",
          claimId: `${key}:out`,
          ledger: {
            ...ledgerBase,
            transactionType: quarantine ? "QUARANTINE" : "DAMAGE",
            quantityOut: qty,
          },
          stockRecords: async () => {
            await setSerialStatuses(
              serials,
              quarantine ? "QUARANTINED" : "DAMAGED",
              ret.returnNumber,
              performedBy,
              { warehouseId: pending.warehouseId },
            );
            if (batchId) {
              const batch = await loadAndValidateBatch(
                batchId,
                item.productCode,
              );
              await setBatchStatusIfWhole(
                batch,
                qty,
                quarantine ? "QUARANTINED" : "BLOCKED",
                ret.returnNumber,
                performedBy,
              );
            }
          },
        }),
      );
      if (quarantine) {
        const { result } = await postOnce(
          "CUSTOMER_RETURN_QUARANTINE",
          key,
          () =>
            createQuarantineRecord(
              {
                productCode: item.productCode,
                productNameSnapshot: item.productNameSnapshot,
                batchId: item.batchId,
                batchNumber: item.batchNumber,
                serialNumbers: item.serialNumbers,
                warehouseId: pending.warehouseId,
                locationId,
                quantity: qty,
                sourceType: "RETURN",
                sourceId: ret.id,
                sourceNumber: ret.returnNumber,
                inspectionId: ret.qualityInspectionId,
                inspectionNumberSnapshot: ret.qualityInspectionNumberSnapshot,
                reason: pending.notes || `Customer return ${ret.returnNumber}`,
              },
              performedBy,
            ),
        );
        quarantineRecordId = result;
      }
    }
    await appendReturnLedgerIds(ret.id, ledgerIds);
  }

  const postedIds = ledgerIds.filter((id): id is string => !!id);
  await postOnce(
    "CUSTOMER_RETURN_DISPOSITION",
    key,
    async () =>
      (await createRecord(RETURNS_PATHS.dispositions, {
        returnId: ret.id,
        returnNumberSnapshot: ret.returnNumber,
        itemId: item.id,
        productCode: item.productCode,
        disposition: pending.disposition,
        quantity: qty,
        warehouseId: pending.warehouseId,
        locationId,
        notes: pending.notes,
        ledgerEntryId: postedIds[postedIds.length - 1],
        ledgerEntryIds: postedIds,
        quarantineRecordId,
        createdBy: performedBy,
        createdAt: Date.now(),
      } satisfies Omit<ScmReturnDispositionRecord, "id">)) as string,
  );

  await update(ref(database, itemPath(ret.id, idx)), {
    pendingDisposition: null,
  });
  await logRecordAudit(
    RETURNS_PATHS.returns,
    ret.id,
    "Disposition recorded",
    performedBy,
    `${item.productCode} → ${pending.disposition} (${qty})${postedIds.length > 0 ? " — inventory posted" : ""}`,
  );
}

/** Dispositions `quantity` of one line. RESTOCK posts SALES_RETURN; QUARANTINE/DAMAGED/SCRAP post
 *  SALES_RETURN then QUARANTINE/DAMAGE (QUARANTINE also opens a quarantine-register record);
 *  REJECT posts nothing. */
export async function setCustomerReturnItemDisposition(
  retId: string,
  itemId: string,
  disposition: ReturnDisposition,
  quantity: number,
  opts: DispositionOptions,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshReturn(retId);
  requireStatus(fresh, "DISPOSITION_PENDING");
  const idx = fresh.items.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new Error("Return line not found.");
  const item = fresh.items[idx];
  const error = dispositionError(item, disposition, quantity);
  if (error) throw new Error(error);
  const warehouseId = opts.warehouseId || item.warehouseId || fresh.warehouseId;
  if (!warehouseId) throw new Error("Select a warehouse for this disposition.");
  if (disposition !== "REJECT") {
    // Validate stock records before claiming anything.
    if (item.batchId)
      await loadAndValidateBatch(item.batchId, item.productCode);
    await loadAndValidateSerials(item.serialNumbers || [], item.productCode);
  }

  const pending: ScmReturnPendingDisposition = stripUndefined({
    id: makeLineId("dp"),
    disposition,
    quantity,
    warehouseId,
    locationId: opts.locationId,
    notes: opts.notes,
    startedBy: performedBy,
    startedAt: Date.now(),
  });
  await claimDisposition(fresh.id, idx, itemId, pending);
  await executePendingDisposition(
    {
      ...fresh,
      items: fresh.items.map((it, i) =>
        i === idx ? { ...it, pendingDisposition: pending } : it,
      ),
    },
    idx,
    performedBy,
  );
}

/** Resumes a disposition whose postings did not all complete. */
export async function retryPendingDisposition(
  retId: string,
  itemId: string,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshReturn(retId);
  requireStatus(fresh, "DISPOSITION_PENDING");
  const idx = fresh.items.findIndex((i) => i.id === itemId);
  if (idx < 0 || !fresh.items[idx].pendingDisposition)
    throw new Error("Nothing pending on this line. Refresh and try again.");
  await executePendingDisposition(fresh, idx, performedBy);
}

export async function completeCustomerReturn(
  retId: string,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshReturn(retId);
  requireStatus(fresh, "DISPOSITION_PENDING");
  const open = fresh.items.find((i) => !isFullyDispositioned(i));
  if (open)
    throw new Error(
      `${open.productCode}: every inspected unit must be dispositioned before the return can be completed.`,
    );
  await transitionReturn(
    fresh,
    "COMPLETED",
    { completedBy: performedBy, completedDate: Date.now() },
    performedBy,
    "Return completed",
    fresh.returnNumber,
  );
  await notifyAdminFeed(
    "Return completed",
    `${fresh.returnNumber} has been completed.`,
    "returns",
  );
}
