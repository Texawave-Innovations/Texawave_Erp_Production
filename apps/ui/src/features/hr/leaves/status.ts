import type { DayPortion, LeaveStatus } from "./types";

export const STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Color token per status, passed to the shared StatusBadge. Status always
 * renders as text as well, never color alone (Docs/DESIGN_SYSTEM.md). */
export const STATUS_COLOR: Record<
  LeaveStatus,
  "success" | "warning" | "error" | "gray"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
  CANCELLED: "gray",
};

export const DAY_PORTION_LABELS: Record<DayPortion, string> = {
  FULL: "Full day",
  FIRST_HALF: "First half",
  SECOND_HALF: "Second half",
};

const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Mirrors the lifecycle table in Docs/HR_LEAVE.md §2. UI gating only — the
 * backend re-checks every transition (422 INVALID_STATE_TRANSITION). */
export function canCancel(request: {
  status: LeaveStatus;
  startDate: string;
}): boolean {
  if (request.status === "PENDING") return true;
  if (request.status === "APPROVED") return request.startDate > todayStr();
  return false;
}

export function canResubmit(request: {
  status: LeaveStatus;
  startDate: string;
}): boolean {
  if (request.status !== "REJECTED" && request.status !== "CANCELLED") {
    return false;
  }
  return request.startDate >= todayStr();
}
