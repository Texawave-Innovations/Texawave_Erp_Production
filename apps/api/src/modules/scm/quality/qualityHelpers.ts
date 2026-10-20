import type {
  ScmQualityCheckpointResultStatus,
  ScmQualityCondition,
  ScmQualityDefectCategory,
  ScmQualityDefectSeverity,
  ScmQualityDisposition,
  ScmQualityInspectionItem,
  ScmQualityInspectionStatus,
  ScmQualityInspectionType,
  ScmQualityItemResult,
  ScmQualityOverallResult,
  ScmQualityPriority,
  ScmQualityQuarantineStatus,
} from "@/types";

export { ALL } from "@/modules/scm/shared/format";

export const INSPECTION_TYPES: ScmQualityInspectionType[] = [
  "INCOMING",
  "CUSTOMER_RETURN",
  "INVENTORY",
  "PRE_DISPATCH",
];

export const INSPECTION_TYPE_LABEL: Record<ScmQualityInspectionType, string> = {
  INCOMING: "Incoming (GRN)",
  CUSTOMER_RETURN: "Customer Return",
  INVENTORY: "Inventory",
  PRE_DISPATCH: "Pre-Dispatch",
};

export const QUALITY_CONDITIONS: ScmQualityCondition[] = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "CONTAMINATED",
  "UNKNOWN",
];

export const DEFECT_CATEGORIES: ScmQualityDefectCategory[] = [
  "PRODUCT",
  "PACKAGING",
  "QUANTITY",
  "DOCUMENTATION",
  "FUNCTIONAL",
  "PHYSICAL_DAMAGE",
  "WRONG_ITEM",
  "OTHER",
];

export const DEFECT_SEVERITIES: ScmQualityDefectSeverity[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const CHECKPOINT_RESULTS: ScmQualityCheckpointResultStatus[] = [
  "PASS",
  "FAIL",
  "NA",
];

export const INSPECTION_STATUSES: ScmQualityInspectionStatus[] = [
  "DRAFT",
  "PENDING_INSPECTION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];
export const QUALITY_PRIORITIES: ScmQualityPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];
export const QUARANTINE_STATUSES: ScmQualityQuarantineStatus[] = [
  "QUARANTINED",
  "UNDER_REVIEW",
  "RELEASED",
  "REJECTED",
];

/** Dispositions that move stock out of sellable on-hand at completion. */
export const STOCK_OUT_DISPOSITIONS: ReadonlySet<ScmQualityDisposition> =
  new Set<ScmQualityDisposition>([
    "QUARANTINE",
    "DAMAGED",
    "SCRAP",
    "REJECT",
    "REWORK",
  ]);

/** Explicit forward-only transition map (spec #8) — every status change must go through
 * `canTransitionInspection`, never an arbitrary field edit. */
export const INSPECTION_TRANSITIONS: Record<
  ScmQualityInspectionStatus,
  ScmQualityInspectionStatus[]
> = {
  DRAFT: ["PENDING_INSPECTION", "IN_PROGRESS", "CANCELLED"],
  PENDING_INSPECTION: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionInspection(
  from: ScmQualityInspectionStatus,
  to: ScmQualityInspectionStatus,
): boolean {
  return (INSPECTION_TRANSITIONS[from] || []).includes(to);
}

/** Item result -> allowed dispositions (spec #22). PASS may only ACCEPT/RELEASE; FAIL must be
 * quarantined/damaged/scrapped/rejected; HOLD can only be quarantined pending review; PARTIAL_PASS
 * (some sample units failed) allows either an accept-with-caveat or a controlled hold/rework. */
export const ALLOWED_DISPOSITIONS_BY_RESULT: Record<
  ScmQualityItemResult,
  ScmQualityDisposition[]
> = {
  PASS: ["ACCEPT", "RELEASE"],
  PARTIAL_PASS: ["ACCEPT", "RELEASE", "QUARANTINE", "REWORK"],
  FAIL: ["QUARANTINE", "DAMAGED", "SCRAP", "REJECT"],
  HOLD: ["QUARANTINE"],
};

export function isValidDisposition(
  result: ScmQualityItemResult,
  disposition: ScmQualityDisposition,
): boolean {
  return (ALLOWED_DISPOSITIONS_BY_RESULT[result] || []).includes(disposition);
}

/** Derives an item's PASS/PARTIAL_PASS/FAIL result from its accepted/rejected split, or HOLD when
 * the inspector has parked the line. Quantities are validated either way — a HOLD line still needs
 * a real inspected quantity (it is what gets quarantined). */
export function deriveItemResult(
  accepted: number,
  rejected: number,
  inspected: number,
  manualHold: boolean,
): ScmQualityItemResult {
  if (!(inspected > 0))
    throw new Error("Inspected quantity must be greater than zero.");
  if (accepted < 0 || rejected < 0)
    throw new Error("Accepted/rejected quantity cannot be negative.");
  if (manualHold) {
    if (accepted + rejected > inspected)
      throw new Error(
        "Accepted + rejected quantity cannot exceed inspected quantity.",
      );
    return "HOLD";
  }
  if (accepted + rejected !== inspected)
    throw new Error(
      "Accepted + rejected quantity must equal inspected quantity.",
    );
  if (rejected === 0) return "PASS";
  if (accepted === 0) return "FAIL";
  return "PARTIAL_PASS";
}

/** Quantity a stock-affecting disposition moves out of sellable stock: the whole inspected
 * quantity for a HOLD line, otherwise the rejected quantity. */
export function dispositionQuantity(
  item: Pick<
    ScmQualityInspectionItem,
    "inspectionResult" | "inspectedQuantity" | "rejectedQuantity"
  >,
): number {
  return item.inspectionResult === "HOLD"
    ? item.inspectedQuantity || 0
    : item.rejectedQuantity || 0;
}

/** Overall inspection result from every item's result (spec #9). Any HOLD wins first (needs a
 * human decision before anything else matters); otherwise uniform PASS/FAIL collapses to that,
 * and any other mix is PARTIALLY_PASSED. */
export function computeOverallResult(
  items: ScmQualityInspectionItem[],
): ScmQualityOverallResult {
  if (items.length === 0)
    throw new Error(
      "At least one inspected item is required to complete an inspection.",
    );
  if (items.some((i) => i.inspectionResult === "HOLD")) return "ON_HOLD";
  if (items.every((i) => i.inspectionResult === "PASS")) return "PASSED";
  if (items.every((i) => i.inspectionResult === "FAIL")) return "FAILED";
  return "PARTIALLY_PASSED";
}

/** Every status that may move to `to` — the `from` set for `transitionStatus`. */
export function inspectionStatusesLeadingTo(
  to: ScmQualityInspectionStatus,
): ScmQualityInspectionStatus[] {
  return (
    Object.keys(INSPECTION_TRANSITIONS) as ScmQualityInspectionStatus[]
  ).filter((s) => INSPECTION_TRANSITIONS[s].includes(to));
}

export const INSPECTION_STATUS_TONE: Record<
  ScmQualityInspectionStatus,
  string
> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  PENDING_INSPECTION: "text-amber-600 border-amber-200 bg-amber-50",
  IN_PROGRESS: "text-blue-600 border-blue-200 bg-blue-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const RESULT_TONE: Record<
  ScmQualityOverallResult | ScmQualityItemResult,
  string
> = {
  PASSED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  PARTIALLY_PASSED: "text-amber-600 border-amber-200 bg-amber-50",
  FAILED: "text-red-600 border-red-200 bg-red-50",
  ON_HOLD: "text-purple-600 border-purple-200 bg-purple-50",
  PASS: "text-emerald-600 border-emerald-200 bg-emerald-50",
  PARTIAL_PASS: "text-amber-600 border-amber-200 bg-amber-50",
  FAIL: "text-red-600 border-red-200 bg-red-50",
  HOLD: "text-purple-600 border-purple-200 bg-purple-50",
};

/** Shared by priorities and defect severities (same LOW..CRITICAL scale). */
export const PRIORITY_TONE: Record<
  ScmQualityPriority | ScmQualityDefectSeverity,
  string
> = {
  LOW: "text-slate-600 border-slate-200 bg-slate-50",
  MEDIUM: "text-blue-600 border-blue-200 bg-blue-50",
  HIGH: "text-amber-600 border-amber-200 bg-amber-50",
  CRITICAL: "text-red-600 border-red-200 bg-red-50",
};

export const SEVERITY_TONE = PRIORITY_TONE;

export const DISPOSITION_TONE: Record<ScmQualityDisposition, string> = {
  ACCEPT: "text-emerald-600 border-emerald-200 bg-emerald-50",
  RELEASE: "text-emerald-600 border-emerald-200 bg-emerald-50",
  QUARANTINE: "text-purple-600 border-purple-200 bg-purple-50",
  REWORK: "text-indigo-600 border-indigo-200 bg-indigo-50",
  DAMAGED: "text-red-600 border-red-200 bg-red-50",
  SCRAP: "text-red-700 border-red-200 bg-red-50",
  REJECT: "text-slate-600 border-slate-200 bg-slate-50",
};

export const QUARANTINE_STATUS_TONE: Record<
  ScmQualityQuarantineStatus,
  string
> = {
  QUARANTINED: "text-purple-600 border-purple-200 bg-purple-50",
  UNDER_REVIEW: "text-amber-600 border-amber-200 bg-amber-50",
  RELEASED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  REJECTED: "text-red-600 border-red-200 bg-red-50",
};

export function priorityForSeverity(
  severity?: ScmQualityDefectSeverity,
): ScmQualityPriority {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "HIGH") return "HIGH";
  if (severity === "MEDIUM") return "MEDIUM";
  return "LOW";
}
