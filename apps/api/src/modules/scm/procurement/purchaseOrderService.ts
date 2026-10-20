import {
  createRecord,
  getAllRecords,
  getRecordById,
} from "@/services/firebase";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import {
  applyIncomingDelta,
  postOnce,
} from "@/modules/scm/inventory/stockLedgerService";
import { transitionWithSideEffect } from "@/modules/scm/shared/statusTransition";
import { pendingReceiptQty } from "@/modules/scm/shared/businessRules";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import type { ScmPOStatus, ScmPurchaseOrder } from "@/types";

const PO_PATH = PROCUREMENT_PATHS.purchaseOrders;

async function getPurchaseOrder(poId: string): Promise<ScmPurchaseOrder> {
  const po = (await getRecordById(PO_PATH, poId)) as ScmPurchaseOrder | null;
  if (!po) throw new Error("Purchase order not found. Refresh and try again.");
  return po;
}

/** Non-cancelled SCM POs already raised from this quotation. */
export async function findPurchaseOrdersForQuotation(
  quotationId: string,
): Promise<ScmPurchaseOrder[]> {
  const pos = (await getAllRecords(PO_PATH)) as ScmPurchaseOrder[];
  return pos.filter(
    (p) => p.sourceQuotationId === quotationId && p.status !== "CANCELLED",
  );
}

export type NewPurchaseOrder = Omit<
  ScmPurchaseOrder,
  "id" | "poNumber" | "status" | "createdAt"
>;

/** Creates a DRAFT PO. A quotation may back at most one live PO. */
export async function createPurchaseOrder(
  data: NewPurchaseOrder,
): Promise<{ id: string; poNumber: string }> {
  if (data.sourceQuotationId) {
    const existing = await findPurchaseOrdersForQuotation(
      data.sourceQuotationId,
    );
    if (existing.length > 0)
      throw new Error(
        `Quotation ${data.sourceQuotationNumber || ""} already has purchase order ${existing[0].poNumber}.`,
      );
  }
  const poNumber = await reserveDocumentNumber("scmPurchaseOrder");
  const id = await createRecord(PO_PATH, {
    ...data,
    poNumber,
    status: "DRAFT" as ScmPOStatus,
  });
  if (!id) throw new Error("Failed to create purchase order");
  return { id, poNumber };
}

/** Approval raises `incoming` by each line's unreceived quantity. The status move is atomic and
 * each line is applied at most once, so a retry after a partial failure only applies the rest. */
export async function approvePurchaseOrder(
  poId: string,
  approvedBy: string,
): Promise<void> {
  await transitionWithSideEffect<ScmPOStatus>(
    PO_PATH,
    poId,
    ["PENDING_APPROVAL"],
    "APPROVED",
    async () => {
      const po = await getPurchaseOrder(poId);
      for (const [i, item] of po.items.entries()) {
        const remaining = pendingReceiptQty(item);
        if (remaining <= 0) continue;
        await postOnce("PO_INCOMING", `${poId}:${i}`, async () => {
          await applyIncomingDelta(
            item.productCode,
            po.warehouseId,
            item.productName,
            remaining,
          );
          return "applied";
        });
      }
    },
    { approvedBy, approvedAt: Date.now(), incomingApplied: true },
  );
}

/** Cancel/close lowers `incoming` by what is still unreceived — read fresh after the status move,
 * since GRNs may have been received since the list was loaded (and none can arrive after it). */
async function endPurchaseOrder(
  poId: string,
  from: ScmPOStatus[],
  to: "CANCELLED" | "CLOSED",
): Promise<void> {
  await transitionWithSideEffect<ScmPOStatus>(
    PO_PATH,
    poId,
    from,
    to,
    async () => {
      const po = await getPurchaseOrder(poId);
      if (!po.incomingApplied) return;
      for (const [i, item] of po.items.entries()) {
        const remaining = pendingReceiptQty(item);
        if (remaining <= 0) continue;
        await postOnce("PO_INCOMING_RELEASE", `${poId}:${i}`, async () => {
          await applyIncomingDelta(
            item.productCode,
            po.warehouseId,
            item.productName,
            -remaining,
          );
          return "released";
        });
      }
    },
    { incomingApplied: false },
  );
}

export const CANCELLABLE_PO_STATUSES: ScmPOStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
];
export const CLOSABLE_PO_STATUSES: ScmPOStatus[] = [
  "RECEIVED",
  "PARTIALLY_RECEIVED",
];

export function cancelPurchaseOrder(poId: string): Promise<void> {
  return endPurchaseOrder(poId, CANCELLABLE_PO_STATUSES, "CANCELLED");
}

export function closePurchaseOrder(poId: string): Promise<void> {
  return endPurchaseOrder(poId, CLOSABLE_PO_STATUSES, "CLOSED");
}
