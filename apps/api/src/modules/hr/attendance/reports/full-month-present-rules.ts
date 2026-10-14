import type { EffectiveStatus } from "../services/attendance-calculation.service.js";

/**
 * FULL MONTH PRESENT: a derived, read-only qualification over the SHARED day
 * views. It adds no status or hour rule of its own (Docs/ATTENDANCE_ARCHITECTURE.md
 * §1); it only decides what "qualifies" means for a whole month.
 *
 * Legacy `src/modules/hr/FMP.tsx` shows a P/L/H/A grid and states no qualifying
 * rule, so this definition is production's, not legacy parity. See the
 * deviation list in Docs/ATTENDANCE_ARCHITECTURE.md (Full Month Present).
 *
 *  - The month must be complete (its last day is before today, IST). A current
 *    or future month never qualifies.
 *  - The employee must be employed on every day of the month. A mid-month
 *    joiner or a leaver does not qualify for that month.
 *  - Every WORKING day must be PRESENT. HOLIDAY and WEEKLY_OFF are not working
 *    days. ABSENT, HALF_DAY, ON_LEAVE and NOT_MARKED all disqualify.
 *  - At least one working day must exist, so an all-off month is not a
 *    qualification.
 */
const NON_WORKING: readonly EffectiveStatus[] = ["HOLIDAY", "WEEKLY_OFF"];

export interface FullMonthPresenceInput {
  monthComplete: boolean;
  employedWholeMonth: boolean;
  /** The status of every day of the month, in date order. */
  statuses: readonly EffectiveStatus[];
}

export function isFullMonthPresent(input: FullMonthPresenceInput): boolean {
  if (!input.monthComplete || !input.employedWholeMonth) return false;
  const working = input.statuses.filter((s) => !NON_WORKING.includes(s));
  return working.length > 0 && working.every((s) => s === "PRESENT");
}

/**
 * True when the employee was employed on the first and last day of the month.
 * Dates are `YYYY-MM-DD`, so plain string comparison is correct.
 */
export function employedWholeMonthOf(
  dateOfJoining: string,
  dateOfExit: string | null,
  firstDay: string,
  lastDay: string,
): boolean {
  return (
    dateOfJoining <= firstDay && (dateOfExit === null || dateOfExit >= lastDay)
  );
}
