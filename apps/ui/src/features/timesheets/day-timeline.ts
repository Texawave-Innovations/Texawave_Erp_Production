import { visibleMonthStatus } from "./month-status";
import type { MyTimesheetDay } from "./types";

/**
 * Pure model of one day's work timeline (Log Work): the day as a horizontal
 * bar in IST with the punches, the work done on each task or activity, the
 * approved permission window, and the gaps in between while checked in:
 * "Paused" right after a task was paused, otherwise "No active task". No I/O —
 * unit-tested in day-timeline.test.ts.
 *
 * Positions are minutes after IST midnight of the day (0 … 1440).
 */

export const DAY_MINUTES = 24 * 60;

/** Default window when the day has nothing to draw: 09:00 – 18:00 IST. */
const DEFAULT_START = 9 * 60;
const DEFAULT_SPAN = 9 * 60;
/** The bar always shows at least the shift target plus an hour's break. */
const BREAK_ALLOWANCE = 60;

export type SegmentKind = "work" | "permission" | "paused" | "no_task";

export interface TimelineSegment {
  kind: SegmentKind;
  start: number;
  end: number;
  /** Task / activity title, "Permission", "Paused" or "No active task". */
  label: string;
  /** The full name for the tooltip (task code, title, project). */
  detail: string;
  /** Which colour a work segment takes: one per row, in row order. */
  colorIndex: number;
  /** A timer still running (drawn up to now). */
  running: boolean;
  /** A work session that ended because the task was paused. */
  endsPaused: boolean;
}

/** HR statuses the bar shows: a full-day band, or (half day) a chip. */
export type DayStatusMark =
  "HOLIDAY" | "WEEKLY_OFF" | "ON_LEAVE" | "ABSENT" | "HALF_DAY";
const MARKED: readonly string[] = [
  "HOLIDAY",
  "WEEKLY_OFF",
  "ON_LEAVE",
  "ABSENT",
  "HALF_DAY",
];

export interface DayTimeline {
  date: string;
  /** HR's status shown on the bar; null for a plain working day. A future
   * day only shows what HR's calendar already knows (holiday, weekly off,
   * leave) — the same rule as the month table. */
  dayStatus: DayStatusMark | null;
  /** Bar bounds, whole hours. */
  axisStart: number;
  axisEnd: number;
  checkIn: number | null;
  checkOut: number | null;
  /** Today only: the current minute (where recorded time ends). */
  now: number | null;
  segments: TimelineSegment[];
  /** Minutes drawn for each kind. */
  workMinutes: number;
  permissionMinutes: number;
  pausedMinutes: number;
  noTaskMinutes: number;
  /** Logged durations with no clock time (cannot be placed on the bar). */
  untimedMinutes: number;
  /** HR's target after permissions; null when no shift applies. */
  targetMinutes: number | null;
}

/** Minutes after IST midnight of `date` for an instant, clamped to the day. */
export function istMinuteOf(iso: string, date: string): number {
  const dayStart = Date.parse(`${date}T00:00:00.000+05:30`);
  const minutes = Math.round((Date.parse(iso) - dayStart) / 60_000);
  return Math.min(Math.max(minutes, 0), DAY_MINUTES);
}

/** The IST calendar date of an instant (`YYYY-MM-DD`). */
export function istDateOf(at: Date): string {
  return new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function wallMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Sorted, merged copy of `[start, end)` intervals. */
function merge(intervals: { start: number; end: number }[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function buildDayTimeline(
  day: Pick<
    MyTimesheetDay,
    "date" | "rows" | "attendance" | "attendanceStatus"
  >,
  now: Date,
): DayTimeline {
  const { date } = day;
  const visible = visibleMonthStatus(
    { date, attendanceStatus: day.attendanceStatus },
    istDateOf(now),
  );
  const dayStatus =
    visible !== null && MARKED.includes(visible)
      ? (visible as DayStatusMark)
      : null;
  const nowIso = now.toISOString();
  const isToday = istDateOf(now) === date;
  const segments: TimelineSegment[] = [];
  let untimedMinutes = 0;

  day.rows.forEach((row, colorIndex) => {
    // The title reads on the bar; the code (long) is in the tooltip only.
    const label = row.title;
    const detail = [row.taskCode, row.title, row.projectName]
      .filter((part): part is string => Boolean(part))
      .join(" · ");
    if (row.category !== "TASK") {
      if (row.startedAt && row.endedAt) {
        segments.push({
          kind: "work",
          start: istMinuteOf(row.startedAt, date),
          end: istMinuteOf(row.endedAt, date),
          label,
          detail,
          colorIndex,
          running: false,
          endsPaused: false,
        });
      } else {
        untimedMinutes += row.durationMinutes;
      }
      return;
    }
    for (const s of row.sessions) {
      // A timer left running counts nothing, so it is not drawn as work.
      if (s.reviewState === "STALE_UNRESOLVED") continue;
      if (s.timePrecision === "DURATION_ONLY") {
        untimedMinutes += s.durationMinutes;
        continue;
      }
      const running = s.endedAt === null;
      if (running && !isToday) continue;
      segments.push({
        kind: "work",
        start: istMinuteOf(s.startedAt, date),
        end: istMinuteOf(s.endedAt ?? nowIso, date),
        label,
        detail,
        colorIndex,
        running,
        endsPaused: s.closedReason === "PAUSED",
      });
    }
  });

  for (const p of day.attendance?.permissions ?? []) {
    segments.push({
      kind: "permission",
      start: wallMinutes(p.fromTime),
      end: wallMinutes(p.toTime),
      label: "Permission",
      detail: `Approved permission ${p.fromTime} – ${p.toTime}`,
      colorIndex: 0,
      running: false,
      endsPaused: false,
    });
  }

  const checkInAt = day.attendance?.checkInAt ?? null;
  const checkOutAt = day.attendance?.checkOutAt ?? null;
  const checkIn = checkInAt ? istMinuteOf(checkInAt, date) : null;
  const checkOut = checkOutAt ? istMinuteOf(checkOutAt, date) : null;

  const nowMinute = isToday ? istMinuteOf(nowIso, date) : null;

  // Gaps inside the attended window, neither working nor on permission: right
  // after a task was paused it is "Paused", otherwise "No active task".
  const works = segments.filter((s) => s.kind === "work");
  const covered = merge(
    segments
      .filter((s) => s.end > s.start)
      .map(({ start, end }) => ({ start, end })),
  );
  if (checkIn !== null) {
    const lastCovered = covered[covered.length - 1]?.end ?? checkIn;
    const windowEnd = checkOut ?? nowMinute ?? Math.max(lastCovered, checkIn);
    let cursor = checkIn;
    for (const c of [...covered, { start: windowEnd, end: windowEnd }]) {
      const gapEnd = Math.min(c.start, windowEnd);
      if (gapEnd - cursor >= 1) {
        const pausedTask = works.find((w) => w.end === cursor && w.endsPaused);
        segments.push(
          pausedTask
            ? {
                kind: "paused",
                start: cursor,
                end: gapEnd,
                label: "Paused",
                detail: `${pausedTask.label} paused, nothing else running`,
                colorIndex: 0,
                running: false,
                endsPaused: false,
              }
            : {
                kind: "no_task",
                start: cursor,
                end: gapEnd,
                label: "No active task",
                detail: "No task timer was running",
                colorIndex: 0,
                running: false,
                endsPaused: false,
              },
        );
      }
      cursor = Math.max(cursor, c.end);
      if (cursor >= windowEnd) break;
    }
  }

  segments.sort((a, b) => a.start - b.start);
  const minutesOf = (kind: SegmentKind) =>
    segments
      .filter((s) => s.kind === kind)
      .reduce((n, s) => n + Math.max(s.end - s.start, 0), 0);

  const targetMinutes = day.attendance?.targetMinutes ?? null;
  const axis = axisFor(
    [
      ...segments.flatMap((s) => [s.start, s.end]),
      ...(checkIn !== null ? [checkIn] : []),
      ...(checkOut !== null ? [checkOut] : []),
      ...(nowMinute !== null ? [nowMinute] : []),
    ],
    (day.attendance?.baseTargetMinutes ?? targetMinutes ?? 8 * 60) +
      BREAK_ALLOWANCE,
  );

  return {
    date,
    dayStatus,
    axisStart: axis.start,
    axisEnd: axis.end,
    checkIn,
    checkOut,
    now: nowMinute,
    segments,
    workMinutes: minutesOf("work"),
    permissionMinutes: minutesOf("permission"),
    pausedMinutes: minutesOf("paused"),
    noTaskMinutes: minutesOf("no_task"),
    untimedMinutes,
    targetMinutes,
  };
}

/** Whole-hour bounds covering `points`, at least `minSpan` wide, inside the day. */
export function axisFor(
  points: readonly number[],
  minSpan: number = DEFAULT_SPAN,
): { start: number; end: number } {
  const span = Math.max(minSpan, 60);
  if (points.length === 0) {
    return {
      start: DEFAULT_START,
      end: Math.min(DEFAULT_START + Math.ceil(span / 60) * 60, DAY_MINUTES),
    };
  }
  let start = Math.floor(Math.min(...points) / 60) * 60;
  let end = Math.ceil(Math.max(...points) / 60) * 60;
  if (end - start < span) end = start + Math.ceil(span / 60) * 60;
  if (end > DAY_MINUTES) {
    start = Math.max(0, start - (end - DAY_MINUTES));
    end = DAY_MINUTES;
  }
  return { start, end };
}

/** One shared window for several days (the week worksheet lines up). */
export function sharedAxis(days: readonly DayTimeline[]): {
  start: number;
  end: number;
} {
  if (days.length === 0) return axisFor([]);
  return {
    start: Math.min(...days.map((d) => d.axisStart)),
    end: Math.max(...days.map((d) => d.axisEnd)),
  };
}
