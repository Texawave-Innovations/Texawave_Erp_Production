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
  approvedLeaves: {
    employeeId: number;
    startDate: string;
    endDate: string;
    dayPortion?: "FULL" | "FIRST_HALF" | "SECOND_HALF";
  }[];
  shiftAssignments: {
    employeeId: number | null;
    teamId: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    workingMinutes: number;
    /** Shift clock times (IST, "HH:mm"). Optional so callers that only need
     * the target need not load them; the missing-punch alerts do. */
    startTime?: string;
    endTime?: string;
    isOvernight?: boolean;
  }[];
  /** APPROVED short-time work permissions (Employee Self Service). Each one
   * excuses `minutes` of the day's target. Optional so callers that only need
   * the calendar (and existing fixtures) need not supply it. */
  approvedPermissions?: {
    employeeId: number;
    date: string;
    /** Wall-clock "HH:mm" within the day. */
    fromTime: string;
    toTime: string;
    minutes: number;
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

  const covering = ctx.approvedLeaves.filter(
    (l) =>
      l.employeeId === employee.id && l.startDate <= date && l.endDate >= date,
  );
  // A full-day leave, or both halves of the date, is a full day on leave.
  // Exactly one half is a half-day leave; the other half is worked.
  const full = covering.some((l) => (l.dayPortion ?? "FULL") === "FULL");
  const firstHalf = covering.some((l) => l.dayPortion === "FIRST_HALF");
  const secondHalf = covering.some((l) => l.dayPortion === "SECOND_HALF");
  const onLeave = full || (firstHalf && secondHalf);

  return {
    holiday,
    weeklyOff: isWeeklyOff(ctx, employee, date),
    onLeave,
    halfDayLeave: !onLeave && (firstHalf || secondHalf),
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

/** The employee's approved work permissions on `date` (earliest first). */
export function resolvePermissions(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): { fromTime: string; toTime: string; minutes: number }[] {
  return (ctx.approvedPermissions ?? [])
    .filter((p) => p.employeeId === employee.id && p.date === date)
    .map(({ fromTime, toTime, minutes }) => ({ fromTime, toTime, minutes }))
    .sort((a, b) => a.fromTime.localeCompare(b.fromTime));
}

/** The shift's full target before any permission is excused; null = no shift. */
export function resolveBaseTargetMinutes(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): number | null {
  return resolveShiftAssignment(ctx, employee, date)?.workingMinutes ?? null;
}

/** The day's target: the shift's working minutes minus every approved
 * permission on that day, never below zero. With no shift there is no target
 * to reduce, so it stays null. */
export function resolveTargetMinutes(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): number | null {
  const base = resolveBaseTargetMinutes(ctx, employee, date);
  if (base === null) return null;
  const excused = resolvePermissions(ctx, employee, date).reduce(
    (sum, p) => sum + p.minutes,
    0,
  );
  return Math.max(base - excused, 0);
}

/** The shift assignment that applies on `date` (same precedence as the
 * target: employee level over team level), or null. */
export function resolveShiftAssignment(
  ctx: DayContext,
  employee: EmployeeRef,
  date: string,
): DayContext["shiftAssignments"][number] | null {
  const covering = ctx.shiftAssignments.filter((a) => covers(a, date));
  return (
    covering.find((a) => a.employeeId === employee.id) ??
    covering.find((a) => a.teamId === employee.teamId) ??
    null
  );
}
