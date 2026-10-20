import { firebaseKey } from "../inventory/inventoryPaths";
import type {
  CustomerReturnStatus,
  ReturnDisposition,
  ReturnType,
  ScmReturn,
  ScmReturnItem,
  ScmReturnStatus,
  VendorReturnStatus,
} from "@/types";

export { ALL } from "@/modules/scm/shared/format";

export const RETURN_REASON_CODES = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "WRONG_QUANTITY",
  "CUSTOMER_CHANGED_MIND",
  "SIZE_OR_VARIANT",
  "QUALITY_ISSUE",
  "DELIVERY_DAMAGE",
  "NOT_AS_DESCRIBED",
  "OTHER",
] as const;

export const RETURN_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "UNKNOWN",
] as const;

export const CUSTOMER_RETURN_STATUSES: CustomerReturnStatus[] = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTION_PENDING",
  "INSPECTED",
  "DISPOSITION_PENDING",
  "COMPLETED",
  "CANCELLED",
];

export const VENDOR_RETURN_STATUSES: VendorReturnStatus[] = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "READY_TO_SHIP",
  "SHIPPED",
  "VENDOR_RECEIVED",
  "COMPLETED",
  "CANCELLED",
];

export const TERMINAL_RETURN_STATUSES: ReadonlySet<ScmReturnStatus> =
  new Set<ScmReturnStatus>(["COMPLETED", "CANCELLED", "REJECTED"]);

/** Fulfillment statuses whose stock has actually left (been issued) — only these are returnable. */
export const RETURNABLE_FULFILLMENT_STATUSES: ReadonlySet<string> = new Set([
  "FULFILLED",
]);
/** GRN statuses whose accepted stock is on hand and may be returned to the vendor. */
export const RETURNABLE_GRN_STATUSES: ReadonlySet<string> = new Set([
  "RECEIVED",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
]);

/** Forward-only transition maps per lifecycle. */
export const CUSTOMER_RETURN_TRANSITIONS: Record<
  CustomerReturnStatus,
  CustomerReturnStatus[]
> = {
  REQUESTED: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_TRANSIT", "CANCELLED"],
  REJECTED: [],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["INSPECTION_PENDING", "CANCELLED"],
  INSPECTION_PENDING: ["INSPECTED", "CANCELLED"],
  INSPECTED: ["DISPOSITION_PENDING", "CANCELLED"],
  DISPOSITION_PENDING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const VENDOR_RETURN_TRANSITIONS: Record<
  VendorReturnStatus,
  VendorReturnStatus[]
> = {
  REQUESTED: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["READY_TO_SHIP", "CANCELLED"],
  REJECTED: [],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["VENDOR_RECEIVED"],
  VENDOR_RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function transitionMap(
  returnType: ReturnType,
): Record<string, readonly ScmReturnStatus[]> {
  return returnType === "CUSTOMER_RETURN"
    ? CUSTOMER_RETURN_TRANSITIONS
    : VENDOR_RETURN_TRANSITIONS;
}

export function canTransitionReturn(
  returnType: ReturnType,
  from: ScmReturnStatus,
  to: ScmReturnStatus,
): boolean {
  return (transitionMap(returnType)[from] || []).includes(to);
}

/** Every status of `returnType` that may move to `to` — the `from` set for `transitionStatus`. */
export function returnStatusesLeadingTo(
  returnType: ReturnType,
  to: ScmReturnStatus,
): ScmReturnStatus[] {
  return Object.entries(transitionMap(returnType))
    .filter(([, next]) => next.includes(to))
    .map(([from]) => from as ScmReturnStatus);
}

/** True once any inventory has been (or may have been, for a disposition mid-posting) posted —
 *  normal cancellation is then blocked; a reversal is a separate controlled transaction. */
export function hasPostedInventory(
  ret: Pick<ScmReturn, "ledgerEntryIds" | "items">,
): boolean {
  if (ret.ledgerEntryIds && ret.ledgerEntryIds.length > 0) return true;
  return (ret.items || []).some(
    (i) => !!i.pendingDisposition || !!i.postedLedgerEntryId,
  );
}

export const RETURN_STATUS_TONE: Record<ScmReturnStatus, string> = {
  REQUESTED: "text-slate-600 border-slate-200 bg-slate-50",
  PENDING_APPROVAL: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-sky-600 border-sky-200 bg-sky-50",
  REJECTED: "text-red-600 border-red-200 bg-red-50",
  IN_TRANSIT: "text-purple-600 border-purple-200 bg-purple-50",
  READY_TO_SHIP: "text-teal-600 border-teal-200 bg-teal-50",
  SHIPPED: "text-purple-600 border-purple-200 bg-purple-50",
  RECEIVED: "text-blue-600 border-blue-200 bg-blue-50",
  VENDOR_RECEIVED: "text-blue-600 border-blue-200 bg-blue-50",
  INSPECTION_PENDING: "text-amber-600 border-amber-200 bg-amber-50",
  INSPECTED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  DISPOSITION_PENDING: "text-amber-600 border-amber-200 bg-amber-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const DISPOSITION_TONE: Record<ReturnDisposition, string> = {
  RESTOCK: "text-emerald-600 border-emerald-200 bg-emerald-50",
  QUARANTINE: "text-purple-600 border-purple-200 bg-purple-50",
  DAMAGED: "text-red-600 border-red-200 bg-red-50",
  SCRAP: "text-red-700 border-red-200 bg-red-50",
  REJECT: "text-slate-600 border-slate-200 bg-slate-50",
};

export const CUSTOMER_RETURN_DISPOSITIONS: ReturnDisposition[] = [
  "RESTOCK",
  "QUARANTINE",
  "DAMAGED",
  "SCRAP",
  "REJECT",
];

// ---------------------------------------------------------------------------
// Split dispositions
// ---------------------------------------------------------------------------

/** Units physically received back on a line (inspection splits exactly this into accepted/rejected). */
export function receivedQty(item: ScmReturnItem): number {
  return item.receivedReturnQuantity ?? item.requestedQuantity;
}

/** Quantity dispositioned so far per disposition. Legacy single-disposition lines count as
 *  fully dispositioned. */
export function dispositionBreakdown(
  item: ScmReturnItem,
): Partial<Record<ReturnDisposition, number>> {
  if (item.dispositionQuantities) return item.dispositionQuantities;
  if (item.disposition)
    return {
      [item.disposition]:
        (item.acceptedQuantity ?? 0) + (item.rejectedQuantity ?? 0),
    };
  return {};
}

export function dispositionedQty(item: ScmReturnItem): number {
  return Object.values(dispositionBreakdown(item)).reduce(
    (s, q) => s + (q || 0),
    0,
  );
}

/** Inspected quantity (accepted + rejected) still waiting for a disposition. */
export function remainingToDisposition(item: ScmReturnItem): number {
  return Math.max(
    0,
    (item.acceptedQuantity ?? 0) +
      (item.rejectedQuantity ?? 0) -
      dispositionedQty(item),
  );
}

/** Max quantity `disposition` may still take on this line: RESTOCK only from accepted units,
 *  REJECT only from rejected units, QUARANTINE/DAMAGED/SCRAP from either. */
export function dispositionCap(
  item: ScmReturnItem,
  disposition: ReturnDisposition,
): number {
  const done = dispositionBreakdown(item);
  const remaining = remainingToDisposition(item);
  if (disposition === "RESTOCK")
    return Math.min(
      remaining,
      Math.max(0, (item.acceptedQuantity ?? 0) - (done.RESTOCK || 0)),
    );
  if (disposition === "REJECT")
    return Math.min(
      remaining,
      Math.max(0, (item.rejectedQuantity ?? 0) - (done.REJECT || 0)),
    );
  return remaining;
}

/** Validation message for dispositioning `quantity` of this line, or null when allowed. */
export function dispositionError(
  item: ScmReturnItem,
  disposition: ReturnDisposition,
  quantity: number,
): string | null {
  if (!(quantity > 0) || !Number.isFinite(quantity))
    return "Disposition quantity must be greater than zero.";
  if (item.pendingDisposition)
    return `${item.productCode} has a disposition still posting — retry it first.`;
  if (
    disposition === "RESTOCK" &&
    (item.condition === "DAMAGED" || item.condition === "DEFECTIVE")
  ) {
    return "Damaged/defective stock cannot be restocked — choose Quarantine, Damaged or Scrap instead.";
  }
  const cap = dispositionCap(item, disposition);
  if (quantity > cap)
    return `Cannot ${disposition.toLowerCase()} ${quantity} of ${item.productCode} — only ${cap} available for this disposition.`;
  return null;
}

export function isFullyDispositioned(item: ScmReturnItem): boolean {
  return !item.pendingDisposition && remainingToDisposition(item) === 0;
}

// ---------------------------------------------------------------------------
// Over-return guard
// ---------------------------------------------------------------------------

/** Reservation scope for a source line: fulfillment + product (customer) or GRN + product + batch (vendor). */
export function returnScopeKey(
  ret: Pick<ScmReturn, "returnType" | "fulfillmentId" | "grnId">,
  item: Pick<ScmReturnItem, "productCode" | "batchNumber" | "grnId">,
): string {
  return ret.returnType === "CUSTOMER_RETURN"
    ? firebaseKey(`customer__${ret.fulfillmentId}__${item.productCode}`)
    : firebaseKey(
        `vendor__${item.grnId || ret.grnId}__${item.productCode}__${item.batchNumber || ""}`,
      );
}

/** Requested quantity per line id across open returns (not cancelled/rejected) for a source line. */
export function previouslyReturnedByLine(
  existingReturns: ScmReturn[],
  match: {
    fulfillmentId?: string;
    grnId?: string;
    productCode: string;
    batchNumber?: string;
  },
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of existingReturns) {
    if (r.status === "CANCELLED" || r.status === "REJECTED") continue;
    if (match.fulfillmentId && r.fulfillmentId !== match.fulfillmentId)
      continue;
    if (match.grnId && r.grnId !== match.grnId) continue;
    for (const it of r.items) {
      if (it.productCode !== match.productCode) continue;
      if (match.grnId && (it.batchNumber || "") !== (match.batchNumber || ""))
        continue;
      out.set(it.id, (out.get(it.id) || 0) + (it.requestedQuantity || 0));
    }
  }
  return out;
}

export function sumPreviouslyReturned(
  existingReturns: ScmReturn[],
  match: {
    fulfillmentId?: string;
    grnId?: string;
    productCode: string;
    batchNumber?: string;
  },
): number {
  let sum = 0;
  for (const q of previouslyReturnedByLine(existingReturns, match).values())
    sum += q;
  return sum;
}
