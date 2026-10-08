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
  decidedBy: DeciderRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
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
