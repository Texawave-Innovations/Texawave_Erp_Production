import type { WorkLogStatus } from "./types";

export const STATUS_LABELS: Record<WorkLogStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Color token per status, passed to the shared StatusBadge. */
export const STATUS_COLOR: Record<
  WorkLogStatus,
  "success" | "warning" | "error"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
};
