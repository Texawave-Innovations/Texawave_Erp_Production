export const RETURN_TYPES = ["CUSTOMER_RETURN", "VENDOR_RETURN"] as const;
export type ReturnType = (typeof RETURN_TYPES)[number];

export const RETURN_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "UNKNOWN",
] as const;

export const CUSTOMER_RETURN_STATUSES = [
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
] as const;
export const VENDOR_RETURN_STATUSES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "READY_TO_SHIP",
  "SHIPPED",
  "VENDOR_RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const ALL_RETURN_STATUSES = [
  ...new Set([...CUSTOMER_RETURN_STATUSES, ...VENDOR_RETURN_STATUSES]),
] as string[];

export const RETURN_DISPOSITIONS = [
  "RESTOCK",
  "QUARANTINE",
  "DAMAGED",
  "SCRAP",
  "REJECT",
] as const;
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

/** Only issued (fulfilled) orders can be returned by a customer. */
export const RETURNABLE_FULFILLMENT_STATUSES = ["FULFILLED"] as const;
/** Returns that no longer hold a claim on their source quantity. */
export const RELEASED_RETURN_STATUSES = ["CANCELLED", "REJECTED"] as const;

/** Forward-only transition maps per lifecycle. */
export const CUSTOMER_RETURN_TRANSITIONS: Record<string, string[]> = {
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
export const VENDOR_RETURN_TRANSITIONS: Record<string, string[]> = {
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

export function transitionsFor(type: string) {
  return type === "CUSTOMER_RETURN"
    ? CUSTOMER_RETURN_TRANSITIONS
    : VENDOR_RETURN_TRANSITIONS;
}

/** Every status of `type` that may move to `to`. */
export function returnStatusesLeadingTo(type: string, to: string): string[] {
  const map = transitionsFor(type);
  return Object.keys(map).filter((from) => map[from]!.includes(to));
}

// ---------------------------------------------------------------------------
// Split dispositions
// ---------------------------------------------------------------------------

export interface DispositionLine {
  acceptedQty: number;
  rejectedQty: number;
  condition: string | null;
  /** Quantity already dispositioned, per disposition. */
  done: Partial<Record<ReturnDisposition, number>>;
}

export const dispositionedQty = (item: DispositionLine) =>
  Object.values(item.done).reduce((s, q) => s + (q ?? 0), 0);

/** Inspected quantity (accepted + rejected) still waiting for a disposition. */
export function remainingToDisposition(item: DispositionLine): number {
  return Math.max(
    0,
    item.acceptedQty + item.rejectedQty - dispositionedQty(item),
  );
}

/** Max quantity `disposition` may still take on this line: RESTOCK only from
 * accepted units, REJECT only from rejected units, QUARANTINE/DAMAGED/SCRAP
 * from either. */
export function dispositionCap(
  item: DispositionLine,
  disposition: ReturnDisposition,
): number {
  const remaining = remainingToDisposition(item);
  if (disposition === "RESTOCK") {
    return Math.min(
      remaining,
      Math.max(0, item.acceptedQty - (item.done.RESTOCK ?? 0)),
    );
  }
  if (disposition === "REJECT") {
    return Math.min(
      remaining,
      Math.max(0, item.rejectedQty - (item.done.REJECT ?? 0)),
    );
  }
  return remaining;
}

/** Message for dispositioning `quantity` of this line, or null when allowed. */
export function dispositionError(
  productCode: string,
  item: DispositionLine,
  disposition: ReturnDisposition,
  quantity: number,
): string | null {
  if (!(quantity > 0) || !Number.isFinite(quantity)) {
    return "Disposition quantity must be greater than zero.";
  }
  if (
    disposition === "RESTOCK" &&
    (item.condition === "DAMAGED" || item.condition === "DEFECTIVE")
  ) {
    return "Damaged/defective stock cannot be restocked — choose Quarantine, Damaged or Scrap instead.";
  }
  const cap = dispositionCap(item, disposition);
  if (quantity > cap + 1e-9) {
    return `Cannot ${disposition.toLowerCase()} ${quantity} of ${productCode} — only ${cap} available for this disposition.`;
  }
  return null;
}

export const isFullyDispositioned = (item: DispositionLine) =>
  remainingToDisposition(item) <= 1e-9;
