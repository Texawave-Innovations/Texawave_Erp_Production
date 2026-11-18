/**
 * The ONE definition of the ERP's "business day" for Projects, Timesheets and
 * HR Attendance: the IST (Asia/Kolkata) calendar date.
 *
 * This is the documented HR policy — Docs/ATTENDANCE_ARCHITECTURE.md §7.4:
 * "A punch belongs to the IST date it starts on". Before this helper the policy
 * was re-implemented per module (attendance `istDateOf`, HR tasks `istToday`)
 * while Projects used the UTC date (`toISOString().slice(0, 10)`), which put
 * anything between 00:00 and 05:30 IST on the previous day.
 *
 * Rules every caller follows:
 *  - A *work date* is always derived with `businessDateOf` / `businessToday`,
 *    never from `toISOString()`, `getUTC*()` or the browser/server local zone.
 *  - Calendar dates the user types (`"YYYY-MM-DD"`) are NOT converted — they are
 *    already business dates; use `parseDateOnly` / `formatDateOnly`.
 *  - `OrganizationSetting.timezone` is display-only and deliberately NOT read
 *    here (it would change HR attendance days; see the timesheet plan).
 *
 * IST has no daylight saving, so day bounds use the fixed +05:30 offset. If the
 * business timezone ever changed to a DST zone, only `dayStartUtc` would need
 * revisiting.
 */
export const BUSINESS_TIMEZONE = "Asia/Kolkata";

/** IST = UTC+05:30, no DST. */
const BUSINESS_OFFSET_MINUTES = 330;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const BUSINESS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The IST calendar date of an instant, `YYYY-MM-DD`. */
export function businessDateOf(instant: Date): string {
  return BUSINESS_DATE.format(instant);
}

/** The current IST calendar date, `YYYY-MM-DD`. */
export function businessToday(now: Date = new Date()): string {
  return businessDateOf(now);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD` calendar date. */
export function isoWeekdayOf(dateOnly: string): number {
  const day = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** `YYYY-MM-DD` shifted by whole calendar days (pure calendar arithmetic). */
export function addDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `dateOnly` (weeks run Monday–Sunday). */
export function weekStart(dateOnly: string): string {
  return addDays(dateOnly, -(isoWeekdayOf(dateOnly) - 1));
}

/** The instant a business day starts: `dateOnly` 00:00 IST. */
export function businessDayStart(dateOnly: string): Date {
  return new Date(
    new Date(`${dateOnly}T00:00:00.000Z`).getTime() -
      BUSINESS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}

/**
 * The instant of an IST wall-clock time on a business date: `("2026-11-16",
 * "14:00")` is 14:00 IST. The server turns what an employee typed into instants
 * itself, so a browser clock or time zone never decides when work happened.
 * Returns null for anything that is not a real `HH:mm` (00:00–23:59).
 */
export function businessInstant(dateOnly: string, hhmm: string): Date | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  const instant = new Date(
    businessDayStart(dateOnly).getTime() +
      (Number(m[1]) * 60 + Number(m[2])) * MS_PER_MINUTE,
  );
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** The IST wall-clock time of an instant as `HH:mm` (inverse of `businessInstant`). */
export function businessTimeOf(instant: Date): string {
  const minutes =
    Math.round(
      (instant.getTime() -
        businessDayStart(businessDateOf(instant)).getTime()) /
        MS_PER_MINUTE,
    ) %
    (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Half-open `[start, end)` instant range of a business day. */
export function businessDayBounds(dateOnly: string): {
  start: Date;
  end: Date;
} {
  const start = businessDayStart(dateOnly);
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

export interface BusinessDaySegment {
  /** IST work date this segment belongs to. */
  date: string;
  start: Date;
  end: Date;
}

/**
 * Splits `[start, end)` at every IST midnight. A session that ends exactly at
 * midnight belongs wholly to the day it started on (no empty trailing segment)
 * — the same rule the timesheet backfill migration uses, so a row that was
 * already split is never split again.
 */
export function splitAtBusinessMidnight(
  start: Date,
  end: Date,
): BusinessDaySegment[] {
  if (end.getTime() <= start.getTime()) return [];
  const segments: BusinessDaySegment[] = [];
  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const date = businessDateOf(cursor);
    const dayEnd = businessDayBounds(date).end;
    const segEnd = dayEnd.getTime() < end.getTime() ? dayEnd : end;
    segments.push({ date, start: cursor, end: segEnd });
    cursor = segEnd;
  }
  return segments;
}

/**
 * Minutes per segment so that they add up to `totalMinutes` EXACTLY: every
 * segment but the last is its rounded elapsed time, the last takes the
 * remainder (identical to the backfill SQL). Never invents or loses a minute.
 */
export function allocateSegmentMinutes(
  segments: readonly BusinessDaySegment[],
  totalMinutes: number,
): number[] {
  const out: number[] = [];
  let used = 0;
  segments.forEach((seg, i) => {
    if (i < segments.length - 1) {
      const m = Math.round(
        (seg.end.getTime() - seg.start.getTime()) / MS_PER_MINUTE,
      );
      out.push(m);
      used += m;
    } else {
      out.push(totalMinutes - used);
    }
  });
  return out;
}
