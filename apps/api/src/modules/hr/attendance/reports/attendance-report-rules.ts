import type { DayView } from "../services/attendance-day-view.service.js";

/**
 * Report rules over the SHARED day views. These functions decide what a report
 * row means. They never compute a status or an hour: every figure comes from
 * AttendanceCalculationService through AttendanceDayViewService.
 */

export const MISSING_PUNCH_TYPES = [
  "MISSING_CHECKOUT",
  "MISSING_CHECK_IN",
] as const;
export type MissingPunchType = (typeof MISSING_PUNCH_TYPES)[number];

/**
 * DEFINITION OF A MISSING PUNCH (a new, derived report — not legacy parity):
 *
 *  - MISSING_CHECKOUT: the day has an OPEN session and its business date is
 *    before today (IST). The employee checked in and no checkout exists, even
 *    after the day ended. Applies on any calendar state, because a punch that
 *    exists is a punch problem regardless of whether the day was a holiday.
 *  - MISSING_CHECK_IN: the derived status is PRESENT but there are no punches.
 *    That happens only when HR stored PRESENT and no check-in was recorded.
 *    It is NOT raised for an unmarked working day, a holiday, a weekly off,
 *    leave, or an explicit ABSENT or HALF_DAY. Those are not punch problems.
 *
 * Not a missing punch (explicitly excluded): an unmarked day with no punches
 * (NOT_MARKED); a future date. "Checkout without check-in" is structurally
 * impossible, since every session is created with a check-in.
 */
export function missingPunchOf(
  view: DayView,
  today: string,
): MissingPunchType | null {
  if (view.attendanceDate > today) return null;
  if (view.hasOpenSession && view.attendanceDate < today)
    return "MISSING_CHECKOUT";
  if (view.status === "PRESENT" && view.sessions.length === 0)
    return "MISSING_CHECK_IN";
  return null;
}

/**
 * OVERTIME ROWS: the days on which the calculation produced overtime above zero.
 * Holiday, weekly-off, leave, half-day and absent days produce zero overtime in
 * the calculation itself, so they never appear here. This function adds no
 * overtime rule of its own.
 */
export function overtimeDaysOf(views: readonly DayView[]): DayView[] {
  return views.filter((v) => v.overtimeMinutes > 0);
}
