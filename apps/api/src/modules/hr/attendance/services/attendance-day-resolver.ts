import {
  isoWeekdayOf,
  type CalendarFlags,
} from "./attendance-calculation.service.js";

/**
 * Pure resolution of "what kind of day is this for this employee, and what is
 * the target?" from already-loaded HR calendar data. No database access here,
 * so every rule is unit-tested in isolation (attendance-day-resolver.spec.ts).
 *
 * Calendar precedence is decided in attendance-calculation.service.ts; this
 * file only answers whether each calendar fact applies. Scope rules:
 *  - Holiday: applies org-wide (no location) or to the employee's location.
 *  - Weekly off: the MOST SPECIFIC applicable rule decides for the day —
 *    team > location > organization (decided, see ATTENDANCE_ARCHITECTURE.md
 *    §7). A narrower rule that covers the date overrides a broader one even
 *    if the broader one lists the weekday, so a team can be set to work on a
 *    day the organization treats as off.
 *  - Leave: only APPROVED requests count; a pending request does not make a
 *    day an on-leave day.
 *  - Target: an employee-level shift assignment overrides a team-level one
 *    (decided); with neither, the target is null.
 */

export interface EmployeeRef {
  id: number;
  teamId: number;
  workLocationId: number | null;
}

/** All dates are `YYYY-MM-DD` strings so comparisons are plain string
 * comparisons, which is correct for ISO calendar dates. */
export interface DayContext {
  holidays: { date: string; workLocationId: number | null }[];
  weeklyOffRules: {
    daysOfWeek: readonly number[];
    teamId: number | null;
    workLocationId: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
  }[];
  approvedLeaves: { employeeId: number; startDate: string; endDate: string }[];
  shiftAssignments: {
    employeeId: number | null;
    teamId: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    workingMinutes: number;
  }[];
}

export const EMPTY_DAY_CONTEXT: DayContext = {
  holidays: [],
  weeklyOffRules: [],
  approvedLeaves: [],
  shiftAssignments: [],
};

function covers(
  range: { effectiveFrom: string; effectiveTo: string | null },
  date: string,
): boolean {
  return (
    range.effectiveFrom <= date &&
    (range.effectiveTo === null || range.effectiveTo >= date)
  );
}

export function resolveCalendar(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): CalendarFlags {
  const holiday = ctx.holidays.some(
    (h) =>
      h.date === date &&
      (h.workLocationId === null ||
        h.workLocationId === employee.workLocationId),
  );

  return {
    holiday,
    weeklyOff: isWeeklyOff(ctx, employee, date),
    onLeave: ctx.approvedLeaves.some(
      (l) =>
        l.employeeId === employee.id &&
        l.startDate <= date &&
        l.endDate >= date,
    ),
  };
}

function isWeeklyOff(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): boolean {
  const applicable = ctx.weeklyOffRules.filter(
    (rule) =>
      covers(rule, date) &&
      ((rule.teamId !== null && rule.teamId === employee.teamId) ||
        (rule.teamId === null &&
          rule.workLocationId !== null &&
          rule.workLocationId === employee.workLocationId) ||
        (rule.teamId === null && rule.workLocationId === null)),
  );
  if (applicable.length === 0) return false;

  const specificity = (rule: (typeof applicable)[number]) =>
    rule.teamId !== null ? 2 : rule.workLocationId !== null ? 1 : 0;
  const mostSpecific = Math.max(...applicable.map(specificity));
  return applicable
    .filter((rule) => specificity(rule) === mostSpecific)
    .some((rule) => rule.daysOfWeek.includes(isoWeekdayOf(date)));
}

export function resolveTargetMinutes(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): number | null {
  const covering = ctx.shiftAssignments.filter((a) => covers(a, date));
  const employeeLevel = covering.find((a) => a.employeeId === employee.id);
  if (employeeLevel) return employeeLevel.workingMinutes;
  const teamLevel = covering.find((a) => a.teamId === employee.teamId);
  return teamLevel ? teamLevel.workingMinutes : null;
}
