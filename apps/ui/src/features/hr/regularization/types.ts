/** Mirrors apps/api/src/modules/hr/attendance/dto/attendance-correction.dto.ts. */
export const CORRECTION_TYPES = [
  "MISSED_CHECK_IN",
  "MISSED_CHECK_OUT",
  "INCORRECT_TIME",
  "LATE_ARRIVAL",
  "EARLY_DEPARTURE",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

/** Which punch each correction type may request. Mirrors ALLOWED_TIMES in
 * apps/api/src/modules/hr/attendance/services/attendance-correction-planner.ts. */
export const ALLOWED_TIMES: Record<
  CorrectionType,
  { in: boolean; out: boolean }
> = {
  MISSED_CHECK_IN: { in: true, out: true },
  MISSED_CHECK_OUT: { in: false, out: true },
  INCORRECT_TIME: { in: true, out: true },
  LATE_ARRIVAL: { in: true, out: false },
  EARLY_DEPARTURE: { in: false, out: true },
};

export const CORRECTION_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export interface Ref {
  id: number;
  employeeCode: string;
  fullName: string;
  userId: number | null;
}

export interface DeciderRef {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/attendance/corrections and GET /hr/attendance/corrections/:id. */
export interface AttendanceCorrectionItem {
  id: number;
  employee: Ref;
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
