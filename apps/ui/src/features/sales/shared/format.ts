/**
 * Display formatting for Sales screens. Money arrives from the API as a
 * decimal string ("708", "14770.80") and is shown with the rupee sign and
 * Indian digit grouping (₹14,770.80); it is never re-computed here.
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** "14770.8" → "₹14,770.80"; null/blank → "—". */
export function formatInr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? INR.format(n) : String(value);
}

/** Large figures on cards: "₹1,24,500" (no paise). */
export function formatInrWhole(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? INR_WHOLE.format(n) : String(value);
}

/** A date-only ("2026-10-15") or ISO instant → "15 Oct 2026"; null → "—". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today as YYYY-MM-DD in India (the business calendar). */
export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** 1 → "Jan". */
export function monthLabel(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}
