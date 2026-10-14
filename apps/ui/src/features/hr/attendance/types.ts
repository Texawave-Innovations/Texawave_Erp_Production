/** Mirrors apps/api/src/modules/hr/attendance/services/attendance-calculation.service.ts. */
export const STORED_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY"] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

export const EFFECTIVE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "HOLIDAY",
  "WEEKLY_OFF",
  "ON_LEAVE",
  "NOT_MARKED",
] as const;
export type EffectiveStatus = (typeof EFFECTIVE_STATUSES)[number];

export interface AttendanceSession {
  id: number;
  checkInAt: string;
  checkOutAt: string | null;
  source: string;
}

/** Row shape of GET /hr/attendance, /hr/attendance/mine and /hr/attendance/:id.
 * There is no employee name on this payload — only `employeeId` — so the UI
 * must not invent one. */
export interface AttendanceDayView {
  recordId: number | null;
  employeeId: number;
  attendanceDate: string;
  storedStatus: StoredStatus | null;
  status: EffectiveStatus;
  targetMinutes: number | null;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  hasOpenSession: boolean;
  sessions: AttendanceSession[];
}

export interface CheckInResult {
  recordId: number;
  sessionId: number;
  attendanceDate: string;
  checkInAt: string;
}

export interface CheckOutResult {
  recordId: number;
  sessionId: number;
  checkOutAt: string;
}

export interface EmployeeRef {
  id: number;
  employeeCode: string;
  fullName: string;
}

/** Row of GET /hr/attendance/reports/daily: every employee in scope, one date. */
export interface DailyAttendanceRow extends AttendanceDayView {
  employee: EmployeeRef;
}

export const MISSING_PUNCH_TYPES = [
  "MISSING_CHECK_OUT",
  "MISSING_CHECK_IN",
] as const;
export type MissingPunchType = (typeof MISSING_PUNCH_TYPES)[number];

export interface MissingPunchRow extends AttendanceDayView {
  employee: EmployeeRef;
  type: MissingPunchType;
}

/** Mirrors apps/api .../month-locks/month-lock.rules.ts. OPEN = no row. */
export const MONTH_LOCK_FILTERS = [
  "OPEN",
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
  "REOPENED",
] as const;
export type MonthLockStatus = (typeof MONTH_LOCK_FILTERS)[number];

export interface MonthLockSummary {
  from: string;
  to: string;
  daysCounted: number;
  countsByStatus: Record<EffectiveStatus, number>;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  netOvertimeMinutes: number;
}

export interface MonthLockRow {
  id: number | null;
  month: string;
  status: MonthLockStatus;
  employee: EmployeeRef & { teamId: number };
  summary: MonthLockSummary | null;
  submittedBy: { id: number; fullName: string } | null;
  submittedAt: string | null;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface FinalizeMonthReport {
  month: string;
  submitted: { employeeId: number; id: number }[];
  skipped: { employeeId: number; code: string; message: string }[];
}

export interface BulkApproveReport {
  approved: number[];
  skipped: { id: number; code: string; message: string }[];
}

export interface AttendanceImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  imported: number;
  duplicates: number;
  errors: { row: number; field?: string; message: string }[];
}
