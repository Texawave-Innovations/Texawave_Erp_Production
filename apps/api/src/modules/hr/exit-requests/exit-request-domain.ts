/** The five legacy statuses (ExitRequests.tsx `ExitStatus`), upper-cased. */
export const EXIT_REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const;
export type ExitRequestStatus = (typeof EXIT_REQUEST_STATUSES)[number];

/** The four legacy settlement options (ExitRequests.tsx SETTLEMENT_OPTIONS). */
export const SETTLEMENT_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/** Legacy blocks a new request while one of these exists (hasActiveRequest). */
export const ACTIVE_STATUSES: readonly ExitRequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
];

/**
 * PRODUCTION DECISION (E1). Legacy has no transition guard: any status may be
 * set. This map is the default recommended in Docs/HR_LEGACY_PARITY.md §3.8.
 * UNDER_REVIEW is optional, so HR may approve or reject straight from SUBMITTED.
 * REJECTED and COMPLETED are final.
 */
export const TRANSITIONS: Readonly<
  Record<ExitRequestStatus, readonly ExitRequestStatus[]>
> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export function isActive(status: ExitRequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Final: no status change and no field edit once a request is here. */
export function isTerminal(status: ExitRequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(
  from: ExitRequestStatus,
  to: ExitRequestStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses whose transition is an HR decision (who decided, and when, is
 * recorded). COMPLETED follows an approval and keeps that decision. */
export function isDecision(status: ExitRequestStatus): boolean {
  return status === "APPROVED" || status === "REJECTED";
}
