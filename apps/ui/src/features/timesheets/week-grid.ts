import type { DayWorkflowStatus, ReviewDaySummary } from "./types.js";

/**
 * Pure builder for the Week grid (people down the side, Monday to Sunday
 * across). No I/O, no React: the screen only draws what this returns, and the
 * rules are unit-tested (week-grid.test.ts). The data is the API's day report
 * (`GET /timesheets/reports/days`): one summary per employee per day with work.
 * Days without work simply have no cell — nothing is invented.
 */

/** The Monday of the ISO week that holds `date` (`YYYY-MM-DD`). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Sunday (0) -> 6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` shifted by whole calendar days. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Seven dates, Monday first, for the week starting `start`. */
export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
}

export interface GridRow {
  employee: ReviewDaySummary["employee"];
  /** The employee's days of this week, by date. A date with no work is absent. */
  cells: Record<string, ReviewDaySummary | undefined>;
  totalMinutes: number;
  /** Days with any work recorded. */
  dayCount: number;
}

export interface WeekGrid {
  dates: string[];
  rows: GridRow[];
  /** Minutes across everyone, per date. */
  dayTotals: Record<string, number>;
  weekTotalMinutes: number;
  /** Days in each review state across the whole grid. */
  stateCounts: Record<DayWorkflowStatus, number>;
  needsAttentionDays: number;
}

const EMPTY_COUNTS = (): Record<DayWorkflowStatus, number> => ({
  DRAFT: 0,
  SUBMITTED: 0,
  APPROVED: 0,
  REJECTED: 0,
});

/** One row per employee (in name order), one cell per day with work. Days
 * outside the week are ignored. */
export function buildWeekGrid(
  start: string,
  days: readonly ReviewDaySummary[],
): WeekGrid {
  const dates = weekDates(start);
  const inWeek = new Set(dates);
  const dayTotals: Record<string, number> = Object.fromEntries(
    dates.map((d) => [d, 0]),
  );
  const stateCounts = EMPTY_COUNTS();
  const byEmployee = new Map<number, GridRow>();
  let weekTotalMinutes = 0;
  let needsAttentionDays = 0;

  for (const day of days) {
    if (!inWeek.has(day.date)) continue;
    let row = byEmployee.get(day.employee.id);
    if (!row) {
      row = {
        employee: day.employee,
        cells: {},
        totalMinutes: 0,
        dayCount: 0,
      };
      byEmployee.set(day.employee.id, row);
    }
    row.cells[day.date] = day;
    row.totalMinutes += day.totalMinutes;
    row.dayCount += 1;
    dayTotals[day.date] = (dayTotals[day.date] ?? 0) + day.totalMinutes;
    weekTotalMinutes += day.totalMinutes;
    stateCounts[day.status] += 1;
    if (day.needsAttention) needsAttentionDays += 1;
  }

  const rows = [...byEmployee.values()].sort((a, b) =>
    a.employee.name.localeCompare(b.employee.name),
  );
  return {
    dates,
    rows,
    dayTotals,
    weekTotalMinutes,
    stateCounts,
    needsAttentionDays,
  };
}

/** What a cell says about its day's review state, in words. */
export function cellStateLabel(day: ReviewDaySummary): string {
  switch (day.status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return day.stage === "MANAGER" ? "Waiting for manager" : "Waiting for HR";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Returned";
  }
}

/** A day may be opened for review once it has been submitted; a draft has
 * nothing to review yet. */
export function isOpenable(day: ReviewDaySummary): boolean {
  return day.status !== "DRAFT";
}
