import type {
  AttendanceDayView,
  AttendanceSession,
} from "@/features/hr/attendance/types";

/**
 * Display helpers for the portal attendance tracker, ported from legacy
 * TexaWave_ERP_old src/modules/employee/MyAttendance.tsx. Every number shown
 * comes from the API's AttendanceDayView (sessions, worked/overtime minutes,
 * effective status); these helpers only position and label it.
 */

// Timeline window (legacy TL_START_H / TL_END_H / TL_LABELS).
export const TL_START_H = 9;
export const TL_END_H = 21;
const TL_SPAN = (TL_END_H - TL_START_H) * 60;
export const TL_LABELS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function hourLabel(h: number): string {
  if (h === 12) return "12PM";
  if (h > 12) return `${String(h - 12).padStart(2, "0")}PM`;
  return `${String(h).padStart(2, "0")}AM`;
}

export function hourPct(h: number): number {
  return ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
}

function minsOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Position (0–100) of an instant on the 9 AM – 9 PM timeline. */
export function timePct(at: string | Date): number {
  const d = typeof at === "string" ? new Date(at) : at;
  return Math.max(
    0,
    Math.min(100, ((minsOfDay(d) - TL_START_H * 60) / TL_SPAN) * 100),
  );
}

export function time12(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .toUpperCase();
}

/** ms → "Xh Ym" / "Ym" (legacy msToHM). */
export function msToHM(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function sessionMs(s: AttendanceSession, now: number): number {
  const end = s.checkOutAt ? Date.parse(s.checkOutAt) : now;
  return Math.max(0, end - Date.parse(s.checkInAt));
}

/** Actual punched time (closed sessions + an open one up to now). */
export function workedMs(row: AttendanceDayView | null, now: number): number {
  if (!row) return 0;
  return row.sessions.reduce((sum, s) => sum + sessionMs(s, now), 0);
}

/** Total gaps between consecutive sessions. */
export function breakMs(sessions: readonly AttendanceSession[]): number {
  let total = 0;
  for (let i = 0; i < sessions.length - 1; i++) {
    const out = sessions[i]!.checkOutAt;
    const nextIn = sessions[i + 1]!.checkInAt;
    if (out) total += Math.max(0, Date.parse(nextIn) - Date.parse(out));
  }
  return total;
}

// Legacy day type by hours worked (display only — the payable status is the
// API's effective status).
const FULL_DAY_MS = 7.5 * 60 * 60 * 1000;
const HALF_DAY_MS = 4 * 60 * 60 * 1000;
export type DayType = "Full Day" | "Half Day" | "Short";

export function dayTypeOf(ms: number): DayType | null {
  if (ms <= 0) return null;
  if (ms >= FULL_DAY_MS) return "Full Day";
  if (ms >= HALF_DAY_MS) return "Half Day";
  return "Short";
}

export const DAY_TYPE_STYLE: Record<DayType, string> = {
  "Full Day":
    "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  "Half Day":
    "bg-amber-100 text-amber-800 border-amber-300 font-bold dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  Short:
    "bg-red-100 text-red-800 border-red-300 font-bold dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};

/** Legacy SHIFT_START_MINS: "Late by HH:MM" after 10:00 AM. */
const SHIFT_START_MINS = 10 * 60;

export function lateBy(row: AttendanceDayView | null): string | null {
  const first = row?.sessions[0];
  if (!first) return null;
  const mins = minsOfDay(new Date(first.checkInAt));
  if (mins <= SHIFT_START_MINS) return null;
  const diff = mins - SHIFT_START_MINS;
  return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
}

export type DayKind =
  | "present"
  | "half"
  | "absent"
  | "leave"
  | "holiday"
  | "weekoff"
  | "weekend"
  | "none";

/**
 * What a day is. A day with an attendance record uses the API's effective
 * status. A day without one (the API lists only recorded days) is a holiday
 * or approved leave if the calendar says so, the weekend on a Sunday (the
 * legacy rule), absent if it is a past working day, and blank otherwise.
 */
export function classifyDay(
  ds: string,
  row: AttendanceDayView | null,
  ctx: {
    today: string;
    holidays: ReadonlyMap<string, string>;
    leaveDays: ReadonlySet<string>;
  },
): DayKind {
  if (row) {
    switch (row.status) {
      case "PRESENT":
        return "present";
      case "HALF_DAY":
        return "half";
      case "ABSENT":
        return "absent";
      case "HOLIDAY":
        return "holiday";
      case "WEEKLY_OFF":
        return "weekoff";
      case "ON_LEAVE":
        return "leave";
      case "NOT_MARKED":
        return ds < ctx.today ? "absent" : "none";
    }
  }
  if (ctx.holidays.has(ds)) return "holiday";
  if (ctx.leaveDays.has(ds)) return "leave";
  if (new Date(`${ds}T00:00:00`).getDay() === 0) return "weekend";
  return ds < ctx.today ? "absent" : "none";
}

export function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(d);
}
