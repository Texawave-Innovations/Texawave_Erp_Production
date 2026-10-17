import type { CrmCalendarEvent } from "@texawave-erp/api-types";

/** Hand-built local-date helpers (no date library in this app). All dates are
 * local-midnight `Date`s; a "day key" is `YYYY-MM-DD` in local time. */

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string | null | undefined): Date | undefined {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Monday-first week start, like legacy (`weekStartsOn: 1`). */
export function startOfWeek(d: Date): Date {
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export type CalendarView = "month" | "week" | "day";

/** The inclusive local-day range the grid for `view` needs. */
export function viewRange(
  view: CalendarView,
  cursor: Date,
): { start: Date; end: Date } {
  if (view === "month") {
    return {
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    };
  }
  if (view === "week") {
    return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
  }
  return { start: cursor, end: cursor };
}

/** Date-only sources (meeting, task) are midnight UTC and must not shift with
 * the viewer's timezone; timestamp sources bucket by the viewer's local day. */
export function eventDay(e: CrmCalendarEvent): string {
  return e.hasTime ? dayKey(new Date(e.date)) : e.date.slice(0, 10);
}

/** Calendar-day-accurate `Date` for display of an event's date. */
export function eventDate(e: CrmCalendarEvent): Date {
  return e.hasTime
    ? new Date(e.date)
    : (parseDayKey(e.date.slice(0, 10)) as Date);
}

export function eventTime(e: CrmCalendarEvent): string | null {
  if (e.time) return e.time;
  if (!e.hasTime) return null;
  return new Date(e.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type EventTone = "red" | "blue" | "slate";

/** Legacy tone: overdue red, today blue, otherwise slate. */
export function eventTone(e: CrmCalendarEvent, todayKey: string): EventTone {
  const key = eventDay(e);
  if (key < todayKey) return "red";
  if (key === todayKey) return "blue";
  return "slate";
}
