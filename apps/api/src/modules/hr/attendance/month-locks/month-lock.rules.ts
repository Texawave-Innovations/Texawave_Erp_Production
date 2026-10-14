import type { EffectiveStatus } from "../services/attendance-calculation.service.js";

/**
 * Pure rules of the monthly attendance close (Docs/HR_API.md → Attendance
 * month locks). No database or clock access: every input is passed in.
 *
 *   (no row) ──finalize──► SUBMITTED ──approve──► APPROVED ──reopen──► REOPENED
 *                              │                                         │
 *                              └──return──► RETURNED ◄───(both may be finalized again)
 */

export const MONTH_LOCK_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
  "REOPENED",
] as const;
export type MonthLockStatus = (typeof MONTH_LOCK_STATUSES)[number];

/** `OPEN` is the absence of a row; it is never stored. */
export const MONTH_LOCK_FILTERS = ["OPEN", ...MONTH_LOCK_STATUSES] as const;
export type MonthLockFilter = (typeof MONTH_LOCK_FILTERS)[number];

/** While a month is in one of these, its punches, statuses and corrections
 * are frozen. */
export const LOCKED_STATUSES: readonly MonthLockStatus[] = [
  "SUBMITTED",
  "APPROVED",
];

/** Statuses a finalize may start from (null = no row yet). */
export const FINALIZABLE_FROM: readonly (MonthLockStatus | null)[] = [
  null,
  "RETURNED",
  "REOPENED",
];

export function isLocked(status: string | null | undefined): boolean {
  return LOCKED_STATUSES.includes(status as MonthLockStatus);
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `2026-09` → `2026-09-01`. */
export function firstDayOf(month: string): string {
  return `${month}-01`;
}

/** `2026-09` → `2026-09-30`. */
export function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** `2026-09-17` → `2026-09`. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** A month can be closed only once it has ended (its last day is before
 * today, IST). Closing the current month would freeze days not yet worked. */
export function isMonthComplete(month: string, todayIst: string): boolean {
  return lastDayOf(month) < todayIst;
}

/** The days of `month` the employee was employed: from the later of the
 * month start and joining, to the earlier of the month end and exit. Null
 * when the employee was not employed at all that month. */
export function employedWindow(
  month: string,
  dateOfJoining: string,
  dateOfExit: string | null,
): { from: string; to: string } | null {
  const first = firstDayOf(month);
  const last = lastDayOf(month);
  const from = dateOfJoining > first ? dateOfJoining : first;
  const to = dateOfExit !== null && dateOfExit < last ? dateOfExit : last;
  return from <= to ? { from, to } : null;
}

/** What is frozen at submission and shown to the approver. */
export interface MonthLockSummary {
  from: string;
  to: string;
  daysCounted: number;
  countsByStatus: Record<EffectiveStatus, number>;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  /** overtime − shortfall: the legacy "Net OT" (may be negative). */
  netOvertimeMinutes: number;
}

export function summarise(
  window: { from: string; to: string },
  days: readonly {
    status: EffectiveStatus;
    workedMinutes: number;
    overtimeMinutes: number;
    shortfallMinutes: number;
  }[],
): MonthLockSummary {
  const countsByStatus: Record<EffectiveStatus, number> = {
    PRESENT: 0,
    ABSENT: 0,
    HALF_DAY: 0,
    HOLIDAY: 0,
    WEEKLY_OFF: 0,
    ON_LEAVE: 0,
    NOT_MARKED: 0,
  };
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  let shortfallMinutes = 0;
  for (const d of days) {
    countsByStatus[d.status] += 1;
    workedMinutes += d.workedMinutes;
    overtimeMinutes += d.overtimeMinutes;
    shortfallMinutes += d.shortfallMinutes;
  }
  return {
    from: window.from,
    to: window.to,
    daysCounted: days.length,
    countsByStatus,
    workedMinutes,
    overtimeMinutes,
    shortfallMinutes,
    netOvertimeMinutes: overtimeMinutes - shortfallMinutes,
  };
}

/** Every ISO date from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`).getTime();
  while (cursor.getTime() <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
