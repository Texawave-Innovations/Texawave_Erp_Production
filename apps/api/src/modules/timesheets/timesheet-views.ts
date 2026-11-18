import { addDays, businessDateOf } from "../../common/dates/business-date.js";
import { dailyTotalMinutes, type DailyStatus } from "./timesheets.rules.js";

/**
 * Pure builders for what the timesheet screens read — no I/O, so every rule is
 * unit-tested (timesheet-views.spec.ts).
 *
 * The key idea: only days with work have stored rows. Days in between (a task
 * on hold, an absence, a weekend) are NEVER stored; they are derived here, on
 * read, and always carry 0 minutes — so nothing is fabricated and an earlier
 * day's record is never touched by what happens later.
 */

/** HR attendance statuses on which no work is expected. */
export const NON_WORKING_ATTENDANCE: readonly string[] = [
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEKLY_OFF",
];

export interface StatusEvent {
  at: Date;
  status: string;
}

/** The task's status at the END of an IST day, from its status history (the
 * audit trail). null = no recorded status yet on or before that day. */
export function taskStatusAsOf(
  events: readonly StatusEvent[],
  date: string,
): string | null {
  let status: string | null = null;
  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const event of ordered) {
    if (businessDateOf(event.at) <= date) status = event.status;
    else break;
  }
  return status;
}

export interface RecordedDay {
  rowId: number;
  dailyStatus: DailyStatus;
  minutes: number;
}

export interface TaskHistoryDay {
  date: string;
  /** true = nothing was worked on this task today; nothing is stored for it. */
  carried: boolean;
  /** Always 0 for a carried day. */
  minutes: number;
  /** The recorded day status; null on carried days. */
  dailyStatus: DailyStatus | null;
  /** The task's overall status at the end of this day. */
  taskStatus: string | null;
  /** HR attendance status where HR has a record for the day, else null. */
  attendanceStatus: string | null;
  label: string;
  rowId: number | null;
}

const DAILY_LABEL: Record<DailyStatus, string> = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

function carriedLabel(
  taskStatus: string | null,
  attendance: string | null,
): string {
  // No work was expected on these days, whatever the task status is.
  if (attendance !== null && NON_WORKING_ATTENDANCE.includes(attendance)) {
    return "Not worked";
  }
  switch (taskStatus) {
    case "hold":
      return "On Hold (no work)";
    case "in_progress":
      return "In Progress (no work)";
    case "completed":
      return "Completed";
    default:
      return "Not started";
  }
}

/** One entry per calendar day in `[from, to]`: the recorded row where work
 * happened, otherwise a derived "carried" day. */
export function buildTaskHistory(input: {
  from: string;
  to: string;
  recorded: ReadonlyMap<string, RecordedDay>;
  events: readonly StatusEvent[];
  attendance: ReadonlyMap<string, string>;
}): TaskHistoryDay[] {
  const days: TaskHistoryDay[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const recorded = input.recorded.get(date);
    const attendanceStatus = input.attendance.get(date) ?? null;
    const taskStatus = taskStatusAsOf(input.events, date);
    if (recorded) {
      days.push({
        date,
        carried: false,
        minutes: recorded.minutes,
        dailyStatus: recorded.dailyStatus,
        taskStatus,
        attendanceStatus,
        label: DAILY_LABEL[recorded.dailyStatus],
        rowId: recorded.rowId,
      });
    } else {
      days.push({
        date,
        carried: true,
        minutes: 0,
        dailyStatus: null,
        taskStatus,
        attendanceStatus,
        label: carriedLabel(taskStatus, attendanceStatus),
        rowId: null,
      });
    }
  }
  return days;
}

export interface DayRowInput {
  category: string;
  /** Closed sessions of a TASK row. */
  sessions: { endedAt: Date | null; durationMinutes: number }[];
  /** A custom row's own interval. */
  durationMinutes: number | null;
  endedAt: Date | null;
}

export interface DayTotals {
  taskMinutes: number;
  customMinutes: number;
  totalMinutes: number;
  rowCount: number;
}

/** Day totals = the stored minutes of CLOSED sessions and custom activities;
 * open sessions, zero-minute stale rows and idle time contribute nothing. */
export function summarizeDay(rows: readonly DayRowInput[]): DayTotals {
  let taskMinutes = 0;
  let customMinutes = 0;
  for (const row of rows) {
    if (row.category === "TASK") {
      taskMinutes += dailyTotalMinutes(row.sessions);
    } else if (row.durationMinutes !== null) {
      customMinutes += dailyTotalMinutes([
        { endedAt: row.endedAt, durationMinutes: row.durationMinutes },
      ]);
    }
  }
  return {
    taskMinutes,
    customMinutes,
    totalMinutes: taskMinutes + customMinutes,
    rowCount: rows.length,
  };
}
