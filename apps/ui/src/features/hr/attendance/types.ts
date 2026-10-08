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

/** Mirrors apps/api/src/modules/hr/attendance/dto/attendance-correction.dto.ts. */
export const CORRECTION_TYPES = [
  "MISSED_CHECK_IN",
  "MISSED_CHECK_OUT",
  "INCORRECT_TIME",
  "LATE_ARRIVAL",
  "EARLY_DEPARTURE",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const CORRECTION_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export interface AttendanceRef {
  id: number;
  employeeCode: string;
  fullName: string;
  userId: number | null;
}

export interface DeciderRef {
  id: number;
  fullName: string;
}

/** Row shape of GET/POST /hr/attendance/corrections and its /:id, /:id/approve,
 * /:id/reject actions (apps/api/src/modules/hr/attendance/corrections/attendance-corrections.repository.ts
 * `toCorrectionView`). Unlike AttendanceDayView, this payload does include the
 * employee's name. */
export interface AttendanceCorrection {
  id: number;
  employee: AttendanceRef;
  attendanceDate: string;
  correctionType: CorrectionType;
  requestedCheckInAt: string | null;
  requestedCheckOutAt: string | null;
  reason: string;
  status: CorrectionStatus;
  requestedBy: number;
  decidedBy: DeciderRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}
