import { addDays, isoWeekdayOf } from "../../common/dates/business-date.js";
import type { AttendanceDayInfo } from "../hr/attendance/services/attendance-lookup.service.js";
import {
  dayWorkflowStatus,
  type DayWorkflowStatus,
} from "./timesheet-approval.js";
import { summarizeDay } from "./timesheet-views.js";

/**
 * Pure builder of one employee's month: one line per calendar day with HR's
 * attendance (status, punches, hours, permissions) beside what was logged in
 * the timesheet, plus the month's counts. No I/O — unit-tested in
 * timesheet-month.spec.ts. Nothing is invented: a day without a record has a
 * null status, never an absence.
 */

/** The rows of one day the builder needs (a subset of `hr.timesheets`). */
export interface MonthTimesheetRow {
  workDate: string;
  status: string;
  category: string;
  durationMinutes: number | null;
  endedAt: Date | null;
  sessions: { endedAt: Date | null; durationMinutes: number }[];
}

export interface MonthDay {
  date: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** HR's effective status; null when HR has nothing for the day. */
  attendanceStatus: string | null;
  checkInAt: string | null;
  /** null while the day's last session is still open. */
  checkOutAt: string | null;
  /** Minutes HR counts as worked (capped at the target). */
  workedMinutes: number;
  /** Target after approved permissions; null when no shift applies. */
  targetMinutes: number | null;
  baseTargetMinutes: number | null;
  permissions: { fromTime: string; toTime: string; minutes: number }[];
  permissionMinutes: number;
  /** Minutes logged in the timesheet (stopped and paused work only). */
  loggedMinutes: number;
  /** Review state of the day's timesheet; null = nothing logged. */
  reviewStatus: DayWorkflowStatus | null;
  rowCount: number;
}

export interface MonthSummary {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  /** Logged timesheet minutes over the month. */
  loggedMinutes: number;
  /** Minutes HR counts as worked over the month. */
  workedMinutes: number;
  /** Approved permission minutes over the month. */
  permissionMinutes: number;
}

export interface EmployeeMonth {
  month: string;
  from: string;
  to: string;
  summary: MonthSummary;
  days: MonthDay[];
}

/** `2026-08` -> `{ from: "2026-08-01", to: "2026-08-31" }`. */
export function monthBounds(month: string): { from: string; to: string } {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildEmployeeMonth(input: {
  month: string;
  attendance: ReadonlyMap<string, AttendanceDayInfo>;
  rows: readonly MonthTimesheetRow[];
}): EmployeeMonth {
  const { from, to } = monthBounds(input.month);

  const rowsByDate = new Map<string, MonthTimesheetRow[]>();
  for (const row of input.rows) {
    const bucket = rowsByDate.get(row.workDate);
    if (bucket) bucket.push(row);
    else rowsByDate.set(row.workDate, [row]);
  }

  const summary: MonthSummary = {
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    holidayDays: 0,
    loggedMinutes: 0,
    workedMinutes: 0,
    permissionMinutes: 0,
  };
  const days: MonthDay[] = [];

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const attendance = input.attendance.get(date) ?? null;
    const rows = rowsByDate.get(date) ?? [];
    const totals = summarizeDay(rows);
    const status = attendance?.status ?? null;

    days.push({
      date,
      weekday: isoWeekdayOf(date),
      attendanceStatus: status,
      checkInAt: attendance?.checkInAt?.toISOString() ?? null,
      checkOutAt: attendance?.checkOutAt?.toISOString() ?? null,
      workedMinutes: attendance?.workedMinutes ?? 0,
      targetMinutes: attendance?.targetMinutes ?? null,
      baseTargetMinutes: attendance?.baseTargetMinutes ?? null,
      permissions: attendance?.permissions ?? [],
      permissionMinutes: attendance?.permissionMinutes ?? 0,
      loggedMinutes: totals.totalMinutes,
      reviewStatus: dayWorkflowStatus(rows.map((r) => r.status)),
      rowCount: rows.length,
    });

    // A half day counts as present: the employee worked the other half.
    if (status === "PRESENT" || status === "HALF_DAY") summary.presentDays += 1;
    else if (status === "ABSENT") summary.absentDays += 1;
    else if (status === "ON_LEAVE") summary.leaveDays += 1;
    else if (status === "HOLIDAY") summary.holidayDays += 1;
    summary.loggedMinutes += totals.totalMinutes;
    summary.workedMinutes += attendance?.workedMinutes ?? 0;
    summary.permissionMinutes += attendance?.permissionMinutes ?? 0;
  }

  return { month: input.month, from, to, summary, days };
}
