import type {
  PurchaseRequisition,
  RequisitionLinkedPo,
  RequisitionStatus,
} from "@texawave-erp/api-types";

/** Requisition statuses that can still be linked to a PO (not yet CONVERTED,
 * and not dead-ended as REJECTED/CANCELLED). Mirrors the API's
 * LINKABLE_REQUISITION_STATUSES — one list for the suggestions and the
 * CONVERTED transition. */
export const LINKABLE_REQUISITION_STATUSES: readonly RequisitionStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
];

export interface MrCoverageLine {
  productId: number;
  productName: string;
  uom: string;
  requested: number;
  ordered: number;
  received: number;
  /** Still to be ordered against the requisition (never negative). */
  toOrder: number;
}

export type MrOrderStatus =
  "NOT_ORDERED" | "PARTIALLY_ORDERED" | "FULLY_ORDERED";

export interface MrCoverage {
  pos: RequisitionLinkedPo[];
  lines: MrCoverageLine[];
  status: MrOrderStatus;
  requestedTotal: number;
  orderedTotal: number;
  receivedTotal: number;
}

/** Live (non-cancelled) POs raised against the requisition. */
export function livePosForRequisition(
  mr: Pick<PurchaseRequisition, "purchaseOrders">,
): RequisitionLinkedPo[] {
  return (mr.purchaseOrders ?? []).filter((po) => po.status !== "CANCELLED");
}

/** Requested vs ordered vs received per item for one requisition — the
 * MR → PO → GR trace. Items are matched on product, and PO lines for
 * products that were not on the requisition are ignored (they are not MR
 * coverage). */
export function buildMrCoverage(mr: PurchaseRequisition): MrCoverage {
  const pos = livePosForRequisition(mr);
  const lines: MrCoverageLine[] = mr.items.map((item) => {
    let ordered = 0;
    let received = 0;
    for (const po of pos) {
      for (const line of po.items) {
        if (line.productId !== item.productId) continue;
        ordered += Number(line.quantity) || 0;
        received += Number(line.receivedQuantity) || 0;
      }
    }
    const requested = Number(item.quantity) || 0;
    return {
      productId: item.productId,
      productName: item.productNameSnapshot,
      uom: item.uom,
      requested,
      ordered,
      received,
      toOrder: Math.max(0, requested - ordered),
    };
  });
  const requestedTotal = lines.reduce((s, l) => s + l.requested, 0);
  const orderedTotal = lines.reduce(
    (s, l) => s + Math.min(l.ordered, l.requested),
    0,
  );
  const receivedTotal = lines.reduce((s, l) => s + l.received, 0);
  const status: MrOrderStatus =
    pos.length === 0 || orderedTotal === 0
      ? "NOT_ORDERED"
      : lines.every((l) => l.toOrder === 0)
        ? "FULLY_ORDERED"
        : "PARTIALLY_ORDERED";
  return { pos, lines, status, requestedTotal, orderedTotal, receivedTotal };
}
