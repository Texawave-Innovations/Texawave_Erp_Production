/** Mirrors apps/api/src/modules/hr/attendance/reports/attendance-reports.service.ts
 * (FullMonthPresentRow). */
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

export interface FullMonthPresentRow {
  employee: { id: number; employeeCode: string; fullName: string };
  month: string;
  /** True once the month's last day is before today (IST). */
  monthComplete: boolean;
  /** True when the employee was employed on the first and last day of the month. */
  employedWholeMonth: boolean;
  /** Counts over the days counted: the month up to and including today (IST). */
  countsByStatus: Record<EffectiveStatus, number>;
  presentDays: number;
  /** Definition: apps/api full-month-present-rules.ts. */
  fullMonthPresent: boolean;
  /** The counted days in date order, with the derived status of each. */
  days: { attendanceDate: string; status: EffectiveStatus }[];
}
