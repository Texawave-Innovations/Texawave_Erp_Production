import type { EmployeeStatus } from "./types";

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
};

/**
 * Mirrors the API's normal lifecycle (employee-status.policy.ts). This is for
 * showing only the moves that can succeed — the backend stays authoritative
 * and still refuses anything else (422).
 */
export const TRANSITIONS: Record<EmployeeStatus, readonly EmployeeStatus[]> = {
  ACTIVE: ["INACTIVE", "RESIGNED", "TERMINATED"],
  INACTIVE: ["ACTIVE", "RESIGNED", "TERMINATED"],
  RESIGNED: [],
  TERMINATED: [],
};

/** The audited correction workflow — the only way out of RESIGNED/TERMINATED. */
export const CORRECTIONS: Record<EmployeeStatus, readonly EmployeeStatus[]> = {
  ACTIVE: [],
  INACTIVE: [],
  RESIGNED: ["ACTIVE", "TERMINATED"],
  TERMINATED: ["ACTIVE", "RESIGNED"],
};

export function isExitStatus(status: EmployeeStatus): boolean {
  return status === "RESIGNED" || status === "TERMINATED";
}

/** Color token per status, passed to the shared StatusBadge. */
export const STATUS_COLOR: Record<
  EmployeeStatus,
  "success" | "warning" | "gray" | "error"
> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  RESIGNED: "gray",
  TERMINATED: "error",
};
