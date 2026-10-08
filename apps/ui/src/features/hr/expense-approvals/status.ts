import type { ExpenseClaimStatus } from "./types";

export const STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Color token per status, passed to the shared StatusBadge. Status always
 * renders as text as well, never color alone (Docs/DESIGN_SYSTEM.md). */
export const STATUS_COLOR: Record<
  ExpenseClaimStatus,
  "success" | "warning" | "error" | "gray"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
};
