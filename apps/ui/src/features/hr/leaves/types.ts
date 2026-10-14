/** Mirrors apps/api/src/modules/hr/leave-requests/leave-domain.ts and
 * leave-requests.repository.ts (LeaveRequestView / LeaveBalanceView). */
export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const DAY_PORTIONS = ["FULL", "FIRST_HALF", "SECOND_HALF"] as const;
export type DayPortion = (typeof DAY_PORTIONS)[number];

/** FIRST = the reporting manager / a scoped approver; HR = the second
 * approval of a two-level leave type (hr.leave.approve.all). */
export type AwaitingStage = "FIRST" | "HR";

export interface EmployeeRef {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface LeaveTypeRef {
  id: number;
  code: string;
  name: string;
}

export interface DeciderRef {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/leave-requests, /hr/leave-requests/:id,
 * /self-service/leave-requests and /self-service/leave-requests/:id. */
export interface LeaveRequestItem {
  id: number;
  employee: EmployeeRef;
  leaveType: LeaveTypeRef;
  startDate: string;
  endDate: string;
  dayPortion: DayPortion;
  /** Working days consumed (weekly-offs and holidays excluded; half = 0.5). */
  leaveDays: number;
  /** Inclusive calendar days, kept for history. Not what balances consume. */
  calendarDays: number;
  reason: string;
  status: LeaveStatus;
  /** 1 or 2 approvals, fixed when the request was (re)submitted. */
  approvalLevels: number;
  /** Who a PENDING request waits for; null once decided. */
  awaiting: AwaitingStage | null;
  /** The employee, or HR who applied on the employee's behalf. */
  requestedBy: DeciderRef;
  firstDecidedBy: DeciderRef | null;
  firstDecidedAt: string | null;
  firstDecisionNote: string | null;
  decidedBy: DeciderRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledBy: DeciderRef | null;
  cancelledAt: string | null;
  cancellationNote: string | null;
  createdAt: string;
}

/** Row shape of leave type admin endpoints (GET /hr/leave-types). Used here
 * only to populate the leave-type picker when requesting leave. */
export interface LeaveTypeItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isPaid: boolean;
  annualEntitlement: number;
  carryForwardLimit: number;
  /** 1 = one approval; 2 = first approval, then HR. */
  approvalLevels: number;
  isActive: boolean;
}

/** Row shape of GET /self-service/leave-requests/balances and
 * GET /hr/leave-requests/balances (LeaveBalanceView). */
export interface LeaveBalanceItem {
  leaveTypeId: number;
  code: string;
  name: string;
  isPaid: boolean;
  year: number;
  opening: number;
  entitlement: number;
  accrued: number;
  used: number;
  pending: number;
  /** null for unpaid leave: it is not balance-limited. */
  available: number | null;
}

/** Row of GET /hr/leave-requests/balances/report (EmployeeBalanceRow). */
export interface EmployeeBalanceRow {
  employee: EmployeeRef & { teamId: number };
  balances: (LeaveBalanceItem & { isOverride: boolean })[];
}

/** Mirrors leave-delegations.repository.ts LeaveDelegationView. */
export interface LeaveDelegationItem {
  id: number;
  delegator: DeciderRef;
  delegate: DeciderRef;
  startDate: string;
  endDate: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
}

/** POST /hr/leave-entitlements/import (EntitlementImportReport). */
export interface EntitlementImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  imported: number;
  errors: { row: number; message: string }[];
}
