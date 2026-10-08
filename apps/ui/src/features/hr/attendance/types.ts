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
