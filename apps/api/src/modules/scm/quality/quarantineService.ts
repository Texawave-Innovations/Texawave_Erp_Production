import { createRecord, getAllRecords, updateRecord } from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  loadAndValidateBatch,
  loadAndValidateSerials,
  postStockMovement,
  setBatchStatusIfWhole,
  setSerialStatuses,
} from "@/modules/scm/inventory/batchSerialService";
import { INVENTORY_PATHS } from "@/modules/scm/inventory/inventoryPaths";
import { QUALITY_PATHS } from "./qualityPaths";
import type {
  ScmQualityQuarantineRecord,
  ScmQualityQuarantineStatus,
} from "@/types";

export const OPEN_QUARANTINE_STATUSES: ScmQualityQuarantineStatus[] = [
  "QUARANTINED",
  "UNDER_REVIEW",
];

/**
 * Claims `to` on `${path}/${id}` (atomically, from one of `from`), runs `fn`, and puts the previous
 * status back if `fn` throws — so a failed posting never leaves the record past the posting step,
 * and two concurrent actions (e.g. release vs reject) can never both proceed.
 */
export async function withStatusClaim<S extends string, T>(
  path: string,
  id: string,
  from: readonly S[],
  to: S,
  extra: Record<string, unknown>,
  revertExtra: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = await transitionStatus(path, id, from, to, extra);
  try {
    return await fn();
  } catch (err) {
    await transitionStatus(path, id, [to], previous, revertExtra);
    throw err;
  }
}

export type NewQuarantineRecord = Omit<
  ScmQualityQuarantineRecord,
  "id" | "status" | "quarantineDate" | "createdBy" | "createdAt"
>;

/** Adds stock to the quarantine register. The caller must already have posted the QUARANTINE
 *  ledger entry that moved the quantity into the quarantine bucket. */
export async function createQuarantineRecord(
  input: NewQuarantineRecord,
  performedBy: string,
): Promise<string> {
  const id = await createRecord(QUALITY_PATHS.quarantine, {
    ...input,
    status: "QUARANTINED",
    quarantineDate: Date.now(),
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmQualityQuarantineRecord, "id">);
  if (!id) throw new Error("Failed to create quarantine record.");
  const source =
    input.inspectionNumberSnapshot ||
    input.sourceNumber ||
    input.sourceId ||
    "";
  await logRecordAudit(
    QUALITY_PATHS.quarantine,
    id,
    "Quarantine created",
    performedBy,
    `${input.productCode} — ${input.quantity} from ${source}`,
  );
  await notifyAdminFeed(
    "Stock quarantined",
    `${input.quantity} × ${input.productCode} quarantined from ${source}.`,
    "quality",
  );
  return id;
}

export async function reviewQuarantine(
  record: ScmQualityQuarantineRecord,
  performedBy: string,
): Promise<void> {
  await transitionStatus<ScmQualityQuarantineStatus>(
    QUALITY_PATHS.quarantine,
    record.id,
    ["QUARANTINED"],
    "UNDER_REVIEW",
    {
      reviewedBy: performedBy,
      reviewedAt: Date.now(),
    },
  );
  await logRecordAudit(
    QUALITY_PATHS.quarantine,
    record.id,
    "Quarantine under review",
    performedBy,
    `${record.productCode} — ${record.quantity}`,
  );
}

async function hasOtherOpenQuarantine(
  batchId: string,
  excludeId: string,
): Promise<boolean> {
  const all = (await getAllRecords(
    QUALITY_PATHS.quarantine,
  )) as ScmQualityQuarantineRecord[];
  return all.some(
    (q) =>
      q.id !== excludeId &&
      q.batchId === batchId &&
      OPEN_QUARANTINE_STATUSES.includes(q.status),
  );
}

/** Controlled release back to sellable on-hand via QC_RELEASE. Mutually exclusive with reject:
 *  the RELEASED status is claimed atomically before posting. */
export async function releaseQuarantine(
  record: ScmQualityQuarantineRecord,
  notes: string | undefined,
  performedBy: string,
): Promise<void> {
  const serials = await loadAndValidateSerials(
    record.serialNumbers || [],
    record.productCode,
  );
  const batch = record.batchId
    ? await loadAndValidateBatch(record.batchId, record.productCode)
    : null;

  const ledgerEntryId = await withStatusClaim<
    ScmQualityQuarantineStatus,
    string | undefined
  >(
    QUALITY_PATHS.quarantine,
    record.id,
    OPEN_QUARANTINE_STATUSES,
    "RELEASED",
    {
      releasedBy: performedBy,
      releasedAt: Date.now(),
      notes: notes ?? record.notes,
    },
    { releasedBy: null, releasedAt: null },
    () =>
      postStockMovement({
        claimType: "QC_QUARANTINE_RELEASE",
        claimId: record.id,
        ledger: {
          productCode: record.productCode,
          productName: record.productNameSnapshot,
          warehouseId: record.warehouseId,
          locationId: record.locationId,
          batchId: record.batchId,
          transactionType: "QC_RELEASE",
          referenceType: "QC_QUARANTINE_RELEASE",
          referenceId: record.id,
          referenceNumber:
            record.inspectionNumberSnapshot || record.sourceNumber,
          quantityIn: record.quantity,
          notes,
          createdBy: performedBy,
        },
        stockRecords: async () => {
          await setSerialStatuses(
            serials,
            "AVAILABLE",
            record.inspectionNumberSnapshot || record.id,
            performedBy,
          );
          // Only reactivate the batch when no other quarantine is still holding part of it.
          if (
            batch &&
            batch.status === "QUARANTINED" &&
            !(await hasOtherOpenQuarantine(batch.id, record.id))
          ) {
            await updateRecord(INVENTORY_PATHS.batches, batch.id, {
              status: "ACTIVE",
            });
            await logRecordAudit(
              INVENTORY_PATHS.batches,
              batch.id,
              "Batch set to ACTIVE",
              performedBy,
              `Quarantine released — ${batch.batchNumber}`,
            );
          }
        },
      }),
  );

  if (ledgerEntryId)
    await updateRecord(QUALITY_PATHS.quarantine, record.id, {
      releaseLedgerEntryId: ledgerEntryId,
    });
  await logRecordAudit(
    QUALITY_PATHS.quarantine,
    record.id,
    "Quarantine released",
    performedBy,
    `${record.productCode} — ${record.quantity} released back to available`,
  );
  await notifyAdminFeed(
    "Quarantine released",
    `${record.quantity} × ${record.productCode} released back to sellable stock.`,
    "quality",
  );
}

/** Permanent write-off of quarantined stock via QC_REJECT (quarantine bucket → damaged). */
export async function rejectQuarantine(
  record: ScmQualityQuarantineRecord,
  notes: string | undefined,
  performedBy: string,
): Promise<void> {
  const serials = await loadAndValidateSerials(
    record.serialNumbers || [],
    record.productCode,
  );
  const batch = record.batchId
    ? await loadAndValidateBatch(record.batchId, record.productCode)
    : null;
  const reference =
    record.inspectionNumberSnapshot || record.sourceNumber || record.id;

  const ledgerEntryId = await withStatusClaim<
    ScmQualityQuarantineStatus,
    string | undefined
  >(
    QUALITY_PATHS.quarantine,
    record.id,
    OPEN_QUARANTINE_STATUSES,
    "REJECTED",
    {
      rejectedBy: performedBy,
      rejectedAt: Date.now(),
      notes: notes ?? record.notes,
    },
    { rejectedBy: null, rejectedAt: null },
    () =>
      postStockMovement({
        claimType: "QC_QUARANTINE_REJECT",
        claimId: record.id,
        ledger: {
          productCode: record.productCode,
          productName: record.productNameSnapshot,
          warehouseId: record.warehouseId,
          locationId: record.locationId,
          batchId: record.batchId,
          transactionType: "QC_REJECT",
          referenceType: "QC_QUARANTINE_REJECT",
          referenceId: record.id,
          referenceNumber: reference,
          quantityOut: record.quantity,
          notes,
          createdBy: performedBy,
        },
        stockRecords: async () => {
          await setSerialStatuses(serials, "DAMAGED", reference, performedBy);
          if (batch)
            await setBatchStatusIfWhole(
              batch,
              record.quantity,
              "BLOCKED",
              reference,
              performedBy,
            );
        },
      }),
  );

  if (ledgerEntryId)
    await updateRecord(QUALITY_PATHS.quarantine, record.id, {
      rejectLedgerEntryId: ledgerEntryId,
    });
  await logRecordAudit(
    QUALITY_PATHS.quarantine,
    record.id,
    "Quarantine rejected (written off)",
    performedBy,
    `${record.productCode} — ${record.quantity}`,
  );
  await notifyAdminFeed(
    "Quarantine rejected",
    `${record.quantity} × ${record.productCode} written off from quarantine.`,
    "quality",
  );
}
