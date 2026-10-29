import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

export const INSPECTION_TYPES = [
  "INCOMING",
  "CUSTOMER_RETURN",
  "INVENTORY",
  "PRE_DISPATCH",
] as const;
export const SOURCE_TYPE_FOR: Record<
  (typeof INSPECTION_TYPES)[number],
  string
> = {
  INCOMING: "GRN",
  CUSTOMER_RETURN: "RETURN",
  INVENTORY: "INVENTORY",
  PRE_DISPATCH: "FULFILLMENT",
};
export const QUALITY_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "CONTAMINATED",
  "UNKNOWN",
] as const;
export const CHECKPOINT_RESULTS = ["PASS", "FAIL", "NA"] as const;
export const INSPECTION_STATUSES = [
  "DRAFT",
  "PENDING_INSPECTION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const QUARANTINE_STATUSES = [
  "QUARANTINED",
  "UNDER_REVIEW",
  "RELEASED",
  "REJECTED",
] as const;
export const QUALITY_DISPOSITIONS = [
  "ACCEPT",
  "RELEASE",
  "QUARANTINE",
  "REWORK",
  "DAMAGED",
  "SCRAP",
  "REJECT",
] as const;
export type QualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];
export type ItemResult = "PASS" | "PARTIAL_PASS" | "FAIL" | "HOLD";
export type OverallResult =
  "PASSED" | "PARTIALLY_PASSED" | "FAILED" | "ON_HOLD";

export const OPEN_INSPECTION_STATUSES = [
  "DRAFT",
  "PENDING_INSPECTION",
  "IN_PROGRESS",
] as const;
export const OPEN_QUARANTINE_STATUSES = [
  "QUARANTINED",
  "UNDER_REVIEW",
] as const;

/** Dispositions that move stock out of sellable on-hand at completion. */
export const STOCK_OUT_DISPOSITIONS: ReadonlySet<string> = new Set([
  "QUARANTINE",
  "DAMAGED",
  "SCRAP",
  "REJECT",
  "REWORK",
]);

/** Forward-only transition map. */
export const INSPECTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_INSPECTION", "IN_PROGRESS", "CANCELLED"],
  PENDING_INSPECTION: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function inspectionStatusesLeadingTo(to: string): string[] {
  return Object.keys(INSPECTION_TRANSITIONS).filter((s) =>
    INSPECTION_TRANSITIONS[s]!.includes(to),
  );
}

/** Item result -> allowed dispositions. PASS may only ACCEPT/RELEASE; FAIL
 * must be quarantined/damaged/scrapped/rejected; HOLD can only be quarantined
 * pending review; PARTIAL_PASS allows an accept-with-caveat or a controlled
 * hold/rework. */
export const ALLOWED_DISPOSITIONS_BY_RESULT: Record<ItemResult, string[]> = {
  PASS: ["ACCEPT", "RELEASE"],
  PARTIAL_PASS: ["ACCEPT", "RELEASE", "QUARANTINE", "REWORK"],
  FAIL: ["QUARANTINE", "DAMAGED", "SCRAP", "REJECT"],
  HOLD: ["QUARANTINE"],
};

export function isValidDisposition(
  result: ItemResult,
  disposition: string,
): boolean {
  return (ALLOWED_DISPOSITIONS_BY_RESULT[result] ?? []).includes(disposition);
}

const rule = (message: string, code: string) =>
  new BusinessRuleViolationException(message, code);

/** Derives an item's PASS/PARTIAL_PASS/FAIL result from its accepted/rejected
 * split, or HOLD when the inspector parked the line. A HOLD line still needs
 * a real inspected quantity (it is what gets quarantined). */
export function deriveItemResult(
  accepted: number,
  rejected: number,
  inspected: number,
  manualHold: boolean,
): ItemResult {
  if (!(inspected > 0))
    throw rule("Inspected quantity must be greater than zero.", "QC_QTY");
  if (accepted < 0 || rejected < 0)
    throw rule("Accepted/rejected quantity cannot be negative.", "QC_QTY");
  if (manualHold) {
    if (accepted + rejected > inspected) {
      throw rule(
        "Accepted + rejected quantity cannot exceed inspected quantity.",
        "QC_QTY",
      );
    }
    return "HOLD";
  }
  if (Math.abs(accepted + rejected - inspected) > 1e-9) {
    throw rule(
      "Accepted + rejected quantity must equal inspected quantity.",
      "QC_QTY",
    );
  }
  if (rejected === 0) return "PASS";
  if (accepted === 0) return "FAIL";
  return "PARTIAL_PASS";
}

/** Quantity a stock-affecting disposition moves out of sellable stock: the
 * whole inspected quantity for a HOLD line, otherwise the rejected quantity. */
export function dispositionQuantity(item: {
  inspectionResult: string | null;
  inspectedQty: number;
  rejectedQty: number;
}): number {
  return item.inspectionResult === "HOLD"
    ? item.inspectedQty
    : item.rejectedQty;
}

/** Overall inspection result from every item's result. Any HOLD wins first;
 * otherwise uniform PASS/FAIL collapses to that, and any other mix is
 * PARTIALLY_PASSED. */
export function computeOverallResult(
  items: { inspectionResult: string | null }[],
): OverallResult {
  if (items.length === 0) {
    throw rule(
      "At least one inspected item is required to complete an inspection.",
      "QC_EMPTY",
    );
  }
  if (items.some((i) => i.inspectionResult === "HOLD")) return "ON_HOLD";
  if (items.every((i) => i.inspectionResult === "PASS")) return "PASSED";
  if (items.every((i) => i.inspectionResult === "FAIL")) return "FAILED";
  return "PARTIALLY_PASSED";
}
