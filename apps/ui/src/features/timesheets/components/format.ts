// Display helpers shared by the employee, reviewer and report timesheet views.
// Re-exported from MyTimesheetView so existing imports keep working.

export const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly off",
  NOT_MARKED: "Not marked",
};

export const ATTENDANCE_CLASS: Record<string, string> = {
  PRESENT:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ABSENT: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  HALF_DAY:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};
export const ATTENDANCE_DEFAULT_CLASS =
  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

/** `135` -> `2h 15m`; `45` -> `45m`; `0` -> `0m`. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Clock time in the business timezone (IST) — the same day boundary the API uses. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `"10:00"` -> `10:00 AM`, `"14:30"` -> `2:30 PM` (a wall-clock time, no zone). */
export function formatWallClock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** `"10:00"`, `"12:00"` -> `10:00 AM – 12:00 PM`. */
export function formatPermissionWindow(p: {
  fromTime: string;
  toTime: string;
}): string {
  return `${formatWallClock(p.fromTime)} – ${formatWallClock(p.toTime)}`;
}

/** `2026-08-03` -> `03 Aug`. */
export function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
}

/** ISO weekday (1 = Monday ... 7 = Sunday) -> `Mon`. */
export function weekdayShort(isoWeekday: number): string {
  return (
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][isoWeekday - 1] ?? ""
  );
}
