import type { ExitRequestStatus, SettlementStatus } from "./types";

export const STATUS_LABELS: Record<ExitRequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

/** Color token per status, passed to the shared StatusBadge. Status always
 * renders as text as well, never color alone (Docs/DESIGN_SYSTEM.md). */
export const STATUS_COLOR: Record<
  ExitRequestStatus,
  "success" | "warning" | "error" | "gray"
> = {
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "error",
  COMPLETED: "gray",
};

export const SETTLEMENT_LABELS: Record<SettlementStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
};
