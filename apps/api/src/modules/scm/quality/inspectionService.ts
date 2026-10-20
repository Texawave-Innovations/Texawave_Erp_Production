import { update } from "firebase/database";
import {
  createRecord,
  database,
  getAllRecords,
  getRecordById,
  ref,
  runTransaction,
  stripUndefined,
  updateRecord,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { INVENTORY_PATHS } from "@/modules/scm/inventory/inventoryPaths";
import {
  getStockBalance,
  postOnce,
} from "@/modules/scm/inventory/stockLedgerService";
import { shrinkFulfillmentReservation } from "@/modules/scm/orders/fulfillmentReservations";
import {
  loadAndValidateBatch,
  loadAndValidateSerials,
  makeLineId,
  postStockMovement,
  setBatchStatusIfWhole,
  setSerialStatuses,
} from "@/modules/scm/inventory/batchSerialService";
import { RETURNS_PATHS } from "@/modules/scm/returns/returnsPaths";
import { QUALITY_PATHS } from "./qualityPaths";
import {
  STOCK_OUT_DISPOSITIONS,
  computeOverallResult,
  deriveItemResult,
  dispositionQuantity,
  inspectionStatusesLeadingTo,
  isValidDisposition,
} from "./qualityHelpers";
import { createQuarantineRecord, withStatusClaim } from "./quarantineService";
import type {
  ScmQualityCheckpointResult,
  ScmQualityCondition,
  ScmQualityDefect,
  ScmQualityDisposition,
  ScmQualityInspection,
  ScmQualityInspectionItem,
  ScmQualityInspectionStatus,
  ScmQualityInspectionType,
  ScmQualityOverallResult,
  ScmQualityPriority,
  ScmQualitySourceType,
  ScmQualityTemplate,
  StockBatch,
} from "@/types";

const OPEN_INSPECTION_STATUSES: ScmQualityInspectionStatus[] = [
  "DRAFT",
  "PENDING_INSPECTION",
  "IN_PROGRESS",
];

async function getFreshInspection(id: string): Promise<ScmQualityInspection> {
  const insp = (await getRecordById(
    QUALITY_PATHS.inspections,
    id,
  )) as ScmQualityInspection | null;
  if (!insp) throw new Error("Inspection not found. Refresh and try again.");
  return { ...insp, items: insp.items || [] };
}

function requireInProgress(insp: ScmQualityInspection): void {
  if (insp.status !== "IN_PROGRESS")
    throw new Error(
      `Inspection is ${formatStatusLabel(insp.status)}, not In Progress. Refresh and try again.`,
    );
}

// ---------------------------------------------------------------------------
// Create / start / cancel
// ---------------------------------------------------------------------------

export interface CreateInspectionItemInput {
  productCode: string;
  productNameSnapshot: string;
  sourceLineId?: string;
  batchId?: string;
  batchNumber?: string;
  serialNumbers?: string[];
  orderedQuantity?: number;
  sourceQuantity: number;
  warehouseId?: string;
  locationId?: string;
  unitCost?: number;
}

export interface CreateInspectionInput {
  inspectionType: ScmQualityInspectionType;
  sourceType: ScmQualitySourceType;
  sourceId: string;
  sourceNumber?: string;
  templateId?: string;
  supplierId?: string;
  supplierNameSnapshot?: string;
  customerId?: string;
  customerNameSnapshot?: string;
  warehouseId?: string;
  warehouseNameSnapshot?: string;
  locationId?: string;
  locationNameSnapshot?: string;
  priority: ScmQualityPriority;
  notes?: string;
  items: CreateInspectionItemInput[];
}

/** Creates a QC inspection at PENDING_INSPECTION. A Customer Return inspection also links itself
 *  onto the return (`qualityInspectionId`). */
export async function createInspection(
  input: CreateInspectionInput,
  performedBy: string,
): Promise<string> {
  if (!input.sourceId)
    throw new Error("A source document is required to create a QC inspection.");
  if (!input.items || input.items.length === 0)
    throw new Error("Add at least one item to inspect.");
  let templateNameSnapshot: string | undefined;
  if (input.templateId) {
    const template = (await getRecordById(
      QUALITY_PATHS.templates,
      input.templateId,
    )) as ScmQualityTemplate | null;
    if (!template || !template.active)
      throw new Error("The selected QC template is missing or inactive.");
    if (template.inspectionType !== input.inspectionType)
      throw new Error(
        `Template ${template.templateCode} is for ${formatStatusLabel(template.inspectionType)} inspections.`,
      );
    templateNameSnapshot = template.name;
  }

  const items: ScmQualityInspectionItem[] = input.items.map((it) => {
    if (!(it.sourceQuantity > 0))
      throw new Error(
        `Source quantity for ${it.productCode} must be greater than zero.`,
      );
    return {
      id: makeLineId("qi"),
      productCode: it.productCode,
      productNameSnapshot: it.productNameSnapshot,
      sourceLineId: it.sourceLineId,
      batchId: it.batchId,
      batchNumber: it.batchNumber,
      serialNumbers: it.serialNumbers,
      orderedQuantity: it.orderedQuantity,
      sourceQuantity: it.sourceQuantity,
      inspectedQuantity: 0,
      acceptedQuantity: 0,
      rejectedQuantity: 0,
      warehouseId: it.warehouseId || input.warehouseId,
      locationId: it.locationId || input.locationId,
      unitCost: it.unitCost,
      checkpointResults: [],
    };
  });

  const inspectionNumber = await reserveDocumentNumber("qualityInspection");
  const id = await createRecord(QUALITY_PATHS.inspections, {
    ...input,
    templateNameSnapshot,
    inspectionNumber,
    status: "PENDING_INSPECTION",
    inspectionDate: Date.now(),
    items,
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmQualityInspection, "id">);
  if (!id) throw new Error("Failed to create inspection.");

  await logRecordAudit(
    QUALITY_PATHS.inspections,
    id,
    "Inspection created",
    performedBy,
    `${inspectionNumber} (${input.inspectionType}) for ${input.sourceNumber || input.sourceId}`,
  );
  await notifyAdminFeed(
    "QC inspection created",
    `${inspectionNumber} created for ${input.sourceNumber || input.sourceId}.`,
    "quality",
  );
  if (input.inspectionType === "CUSTOMER_RETURN") {
    await updateRecord(RETURNS_PATHS.returns, input.sourceId, {
      qualityInspectionId: id,
      qualityInspectionNumberSnapshot: inspectionNumber,
    });
  }
  return id;
}

export async function startInspection(
  inspection: ScmQualityInspection,
  performedBy: string,
  inspectorName?: string,
): Promise<void> {
  await transitionStatus<ScmQualityInspectionStatus>(
    QUALITY_PATHS.inspections,
    inspection.id,
    inspectionStatusesLeadingTo("IN_PROGRESS"),
    "IN_PROGRESS",
    {
      startedAt: Date.now(),
      inspectorId: performedBy,
      inspectorName: inspectorName || performedBy,
    },
  );
  await logRecordAudit(
    QUALITY_PATHS.inspections,
    inspection.id,
    "Inspection started",
    performedBy,
    inspection.inspectionNumber,
  );
  await notifyAdminFeed(
    "QC inspection started",
    `${inspection.inspectionNumber} is now in progress.`,
    "quality",
  );
}

/** Nothing posts before completion, and a completed inspection cannot be cancelled, so the
 *  atomic status check is the whole guard here. */
export async function cancelInspection(
  inspection: ScmQualityInspection,
  reason: string,
  performedBy: string,
): Promise<void> {
  const why = reason.trim() || "Cancelled by user";
  await transitionStatus<ScmQualityInspectionStatus>(
    QUALITY_PATHS.inspections,
    inspection.id,
    inspectionStatusesLeadingTo("CANCELLED"),
    "CANCELLED",
    {
      cancelledBy: performedBy,
      cancelledAt: Date.now(),
      cancellationReason: why,
    },
  );
  await logRecordAudit(
    QUALITY_PATHS.inspections,
    inspection.id,
    "Inspection cancelled",
    performedBy,
    why,
  );
}

// ---------------------------------------------------------------------------
// Record a line result
// ---------------------------------------------------------------------------

export interface RecordItemResultInput {
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  manualHold?: boolean;
  condition?: ScmQualityCondition;
  defectCode?: string;
  defectDescription?: string;
  disposition?: ScmQualityDisposition;
  notes?: string;
  checkpointResults?: ScmQualityCheckpointResult[];
}

/** Validates and writes one line's result — only that line's path, re-checked in a transaction, so a
 *  stale page can never overwrite other lines. */
export async function recordItemResult(
  inspectionId: string,
  itemId: string,
  input: RecordItemResultInput,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshInspection(inspectionId);
  requireInProgress(fresh);
  const idx = fresh.items.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new Error("Inspection line not found.");
  const item = fresh.items[idx];
  if (input.inspectedQuantity > item.sourceQuantity) {
    throw new Error(
      `Inspected quantity (${input.inspectedQuantity}) cannot exceed the source quantity (${item.sourceQuantity}).`,
    );
  }
  if (item.batchId) {
    const batch = (await getRecordById(
      INVENTORY_PATHS.batches,
      item.batchId,
    )) as StockBatch | null;
    if (batch && input.inspectedQuantity > (batch.quantity || 0)) {
      throw new Error(
        `Inspected quantity (${input.inspectedQuantity}) exceeds the batch's on-hand quantity (${batch.quantity}).`,
      );
    }
  }
  const result = deriveItemResult(
    input.acceptedQuantity,
    input.rejectedQuantity,
    input.inspectedQuantity,
    !!input.manualHold,
  );
  if (input.disposition && !isValidDisposition(result, input.disposition)) {
    throw new Error(
      `${formatStatusLabel(input.disposition)} is not a valid disposition for a ${formatStatusLabel(result)} result.`,
    );
  }

  let error: string | null = null;
  const tx = await runTransaction(
    ref(database, `${QUALITY_PATHS.inspections}/${inspectionId}/items/${idx}`),
    (current: ScmQualityInspectionItem | null) => {
      error = null;
      if (current === null) return null;
      if (current.id !== itemId) {
        error = "Inspection lines changed. Refresh and try again.";
        return; // abort
      }
      return stripUndefined({
        ...current,
        inspectedQuantity: input.inspectedQuantity,
        acceptedQuantity: input.acceptedQuantity,
        rejectedQuantity: input.rejectedQuantity,
        inspectionResult: result,
        condition: input.condition,
        defectCode: input.defectCode,
        defectDescription: input.defectDescription,
        disposition: input.disposition,
        notes: input.notes,
        checkpointResults: input.checkpointResults,
      });
    },
  );
  if (error) throw new Error(error);
  if (!tx.committed || !tx.snapshot.val())
    throw new Error("Inspection line not found. Refresh and try again.");
  await logRecordAudit(
    QUALITY_PATHS.inspections,
    inspectionId,
    "Inspection item recorded",
    performedBy,
    `${item.productCode} → ${result}${input.disposition ? ` / ${input.disposition}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

function sameSourceLine(
  a: ScmQualityInspectionItem,
  b: ScmQualityInspectionItem,
): boolean {
  return a.sourceLineId
    ? b.sourceLineId === a.sourceLineId
    : b.productCode === a.productCode;
}

/** Every check that can fail, run before anything posts. Returns the defects that need a
 *  critical-defect notification. */
async function validateCompletion(
  insp: ScmQualityInspection,
): Promise<string[]> {
  if (insp.items.length === 0)
    throw new Error("An inspection needs at least one item.");
  const [template, defects, others] = await Promise.all([
    insp.templateId
      ? (getRecordById(
          QUALITY_PATHS.templates,
          insp.templateId,
        ) as Promise<ScmQualityTemplate | null>)
      : null,
    getAllRecords(QUALITY_PATHS.defects) as Promise<ScmQualityDefect[]>,
    getAllRecords(QUALITY_PATHS.inspections) as Promise<ScmQualityInspection[]>,
  ]);
  const required = (template?.checkpoints || []).filter((c) => c.required);
  const defectByCode = new Map(defects.map((d) => [d.defectCode, d]));
  const critical: string[] = [];
  // Receipt-type sources may only be inspected up to their quantity in total; inventory and
  // pre-dispatch checks can be repeated, so only other *open* inspections count against them.
  const cumulative =
    insp.inspectionType === "INCOMING" ||
    insp.inspectionType === "CUSTOMER_RETURN";
  const peers = others.filter(
    (o) =>
      o.id !== insp.id &&
      o.sourceId === insp.sourceId &&
      (cumulative
        ? o.status !== "CANCELLED"
        : OPEN_INSPECTION_STATUSES.includes(o.status)),
  );

  for (const item of insp.items) {
    const label = item.productCode;
    if (!item.inspectionResult)
      throw new Error(
        `${label}: record an inspection result before completing.`,
      );
    if (item.inspectionResult !== "PASS" && !item.disposition) {
      throw new Error(
        `${label}: a disposition is required for a ${formatStatusLabel(item.inspectionResult)} result.`,
      );
    }
    if (
      item.disposition &&
      !isValidDisposition(item.inspectionResult, item.disposition)
    ) {
      throw new Error(
        `${label}: ${formatStatusLabel(item.disposition)} is not valid for a ${formatStatusLabel(item.inspectionResult)} result.`,
      );
    }
    const done = new Set(
      (item.checkpointResults || []).map((c) => c.checkpointId),
    );
    const missing = required.find((c) => !done.has(c.checkpointId));
    if (missing)
      throw new Error(
        `${label}: complete required checkpoint "${missing.name}" before completing this inspection.`,
      );

    const defect = item.defectCode
      ? defectByCode.get(item.defectCode)
      : undefined;
    if (
      defect &&
      (defect.severity === "HIGH" || defect.severity === "CRITICAL")
    ) {
      if (!item.notes?.trim())
        throw new Error(
          `${label}: a review note is required for a ${defect.severity} defect (${item.defectCode}).`,
        );
      critical.push(`${label} (${item.defectCode})`);
    }

    const priorQty = peers.reduce(
      (s, o) =>
        s +
        (o.items || [])
          .filter((oi) => sameSourceLine(item, oi))
          .reduce((q, oi) => q + (oi.inspectedQuantity || 0), 0),
      0,
    );
    let limit = item.sourceQuantity;
    if (insp.inspectionType === "INVENTORY") {
      const balance = await getStockBalance(
        item.productCode,
        item.warehouseId || insp.warehouseId || "",
      );
      limit = Math.min(
        limit,
        balance ? balance.onHand - (balance.reserved || 0) : 0,
      );
    }
    if (priorQty + item.inspectedQuantity > limit) {
      throw new Error(
        `${label}: ${priorQty + item.inspectedQuantity} would be under inspection, but only ${Math.max(0, limit)} is available.`,
      );
    }
    if (cumulative) {
      for (const sn of item.serialNumbers || []) {
        const dupe = peers.find(
          (o) =>
            o.status === "COMPLETED" &&
            (o.items || []).some((oi) => (oi.serialNumbers || []).includes(sn)),
        );
        if (dupe)
          throw new Error(
            `Serial ${sn} was already inspected in ${dupe.inspectionNumber}.`,
          );
      }
    }

    if (
      insp.inspectionType !== "CUSTOMER_RETURN" &&
      item.disposition &&
      STOCK_OUT_DISPOSITIONS.has(item.disposition)
    ) {
      const qty = dispositionQuantity(item);
      if (!(qty > 0) || qty > item.sourceQuantity)
        throw new Error(
          `${label}: ${formatStatusLabel(item.disposition)} quantity must be between 1 and ${item.sourceQuantity}.`,
        );
      if (!(item.warehouseId || insp.warehouseId))
        throw new Error(
          `${label}: a warehouse is required to post a ${formatStatusLabel(item.disposition)} disposition.`,
        );
    }
  }
  return critical;
}

/** Moves one failed/held line out of sellable stock: QUARANTINE (+ quarantine record) for
 *  QUARANTINE/REJECT/REWORK — a rejected incoming line then goes back to the vendor from the
 *  quarantine — or DAMAGE for DAMAGED/SCRAP. */
async function postLineDisposition(
  insp: ScmQualityInspection,
  idx: number,
  performedBy: string,
): Promise<void> {
  const item = insp.items[idx];
  const disposition = item.disposition as ScmQualityDisposition;
  const quarantine = disposition !== "DAMAGED" && disposition !== "SCRAP";
  const warehouseId = (item.warehouseId || insp.warehouseId) as string;
  const quantity = dispositionQuantity(item);
  const key = `${insp.id}:${item.id}`;
  const serials = await loadAndValidateSerials(
    item.serialNumbers || [],
    item.productCode,
  );

  if (insp.inspectionType === "PRE_DISPATCH") {
    // The stock is reserved for this fulfillment, and QUARANTINE/DAMAGE may only take unreserved
    // stock — shrink the fulfillment's reservation first (records, line and balance together) so
    // `available` isn't reduced twice and a later release doesn't release these units again.
    await postOnce("QC_INSPECTION_UNRESERVE", key, async () => {
      const released = await shrinkFulfillmentReservation(
        insp.sourceId,
        item.productCode,
        quantity,
        performedBy,
      );
      return String(released);
    });
  }

  const ledgerEntryId = await postStockMovement({
    claimType: "QC_INSPECTION",
    claimId: key,
    ledger: {
      productCode: item.productCode,
      productName: item.productNameSnapshot,
      warehouseId,
      locationId: item.locationId,
      batchId: item.batchId,
      transactionType: quarantine ? "QUARANTINE" : "DAMAGE",
      referenceType: "QC_INSPECTION",
      referenceId: key,
      referenceNumber: insp.inspectionNumber,
      quantityOut: quantity,
      unitCost: item.unitCost,
      notes: item.notes,
      createdBy: performedBy,
    },
    stockRecords: async () => {
      await setSerialStatuses(
        serials,
        quarantine ? "QUARANTINED" : "DAMAGED",
        insp.inspectionNumber,
        performedBy,
        { warehouseId },
      );
      if (item.batchId) {
        const batch = await loadAndValidateBatch(
          item.batchId,
          item.productCode,
        );
        await setBatchStatusIfWhole(
          batch,
          quantity,
          quarantine ? "QUARANTINED" : "BLOCKED",
          insp.inspectionNumber,
          performedBy,
        );
      }
    },
  });

  let quarantineRecordId: string | undefined;
  if (quarantine) {
    ({ result: quarantineRecordId } = await postOnce(
      "QC_INSPECTION_QUARANTINE",
      key,
      () =>
        createQuarantineRecord(
          {
            productCode: item.productCode,
            productNameSnapshot: item.productNameSnapshot,
            batchId: item.batchId,
            batchNumber: item.batchNumber,
            serialNumbers: item.serialNumbers,
            warehouseId,
            warehouseNameSnapshot: insp.warehouseNameSnapshot,
            locationId: item.locationId,
            quantity,
            sourceType: insp.sourceType,
            sourceId: insp.sourceId,
            sourceNumber: insp.sourceNumber,
            inspectionId: insp.id,
            inspectionNumberSnapshot: insp.inspectionNumber,
            defectCode: item.defectCode,
            reason:
              item.defectDescription ||
              item.notes ||
              `QC ${formatStatusLabel(disposition)}`,
          },
          performedBy,
        ),
    ));
  }
  await update(
    ref(database, `${QUALITY_PATHS.inspections}/${insp.id}/items/${idx}`),
    stripUndefined({ ledgerEntryId, quarantineRecordId }),
  );
}

const RESULT_AUDIT: Record<ScmQualityOverallResult, string> = {
  PASSED: "Inspection passed",
  PARTIALLY_PASSED: "Inspection partially passed",
  FAILED: "Inspection failed",
  ON_HOLD: "Inspection on hold",
};

/**
 * Validates everything first, then claims COMPLETED atomically and posts each stock-affecting line
 * (idempotent per line). If a posting fails the inspection goes back to In Progress, so it can be
 * retried. Customer Return inspections never post — the return's own disposition flow does.
 */
export async function completeInspection(
  inspectionId: string,
  performedBy: string,
): Promise<void> {
  const insp = await getFreshInspection(inspectionId);
  requireInProgress(insp);
  const critical = await validateCompletion(insp);
  const overallResult = computeOverallResult(insp.items);

  await withStatusClaim<ScmQualityInspectionStatus, void>(
    QUALITY_PATHS.inspections,
    insp.id,
    ["IN_PROGRESS"],
    "COMPLETED",
    { result: overallResult, completedAt: Date.now() },
    { result: null, completedAt: null },
    async () => {
      if (insp.inspectionType === "CUSTOMER_RETURN") return;
      for (let idx = 0; idx < insp.items.length; idx++) {
        const d = insp.items[idx].disposition;
        if (d && STOCK_OUT_DISPOSITIONS.has(d))
          await postLineDisposition(insp, idx, performedBy);
      }
    },
  );

  await logRecordAudit(
    QUALITY_PATHS.inspections,
    insp.id,
    RESULT_AUDIT[overallResult],
    performedBy,
    `${insp.inspectionNumber} → ${overallResult}`,
  );
  await notifyAdminFeed(
    "QC inspection completed",
    `${insp.inspectionNumber} completed — ${formatStatusLabel(overallResult)}.`,
    "quality",
  );
  if (critical.length > 0)
    await notifyAdminFeed(
      "Critical QC defect recorded",
      `${insp.inspectionNumber}: ${critical.join(", ")}.`,
      "quality",
    );
  if (insp.inspectionType === "CUSTOMER_RETURN") {
    await updateRecord(RETURNS_PATHS.returns, insp.sourceId, {
      qualityInspectionId: insp.id,
      qualityInspectionNumberSnapshot: insp.inspectionNumber,
    });
  }
}
