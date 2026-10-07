import type { CorrectionStatus, CorrectionType } from "./types";

export const STATUS_LABELS: Record<CorrectionStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Color token per status, passed to the shared StatusBadge. */
export const STATUS_COLOR: Record<
  CorrectionStatus,
  "success" | "warning" | "error"
> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "error",
};

export const CORRECTION_TYPE_LABELS: Record<CorrectionType, string> = {
  MISSED_CHECK_IN: "Missed check-in",
  MISSED_CHECK_OUT: "Missed check-out",
  INCORRECT_TIME: "Incorrect time",
  LATE_ARRIVAL: "Late arrival",
  EARLY_DEPARTURE: "Early departure",
};
