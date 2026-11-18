/**
 * The ERP's business day is the IST (Asia/Kolkata) calendar date — the same
 * single definition the API uses (apps/api/src/common/dates/business-date.ts,
 * Docs/ATTENDANCE_ARCHITECTURE.md §7.4). The browser's own time zone must never
 * decide "which day is it": an employee on a laptop set to another zone would
 * otherwise file work on a different day than the server does.
 *
 * Calendar dates a user picks (`YYYY-MM-DD`) are already business dates and are
 * not converted; use this only to answer "what is today" / "which day is this
 * instant".
 */
export const BUSINESS_TIMEZONE = "Asia/Kolkata";

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

/** Today's IST calendar date, `YYYY-MM-DD`. */
export function businessToday(now: Date = new Date()): string {
  return businessDateOf(now);
}

/** `YYYY-MM-DD` shifted by whole calendar days (pure calendar arithmetic). */
export function addBusinessDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
