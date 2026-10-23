// Small shared helpers for the CRM Intelligence Layer.
import { format, isToday, isTomorrow, isYesterday } from "date-fns";

/**
 * Deterministically derives a stable "company key" from a free-text company name so the same
 * company typed identically across different source tabs aggregates into one Company 360 profile.
 * Rows with a blank company name each get their own unique key (via `fallbackSeed`) rather than
 * being collapsed together.
 */
export function slugifyCompanyKey(
  companyName: string | undefined | null,
  fallbackSeed: string,
): string {
  const trimmed = (companyName || "").trim().toLowerCase();
  if (!trimmed) return `unknown__${fallbackSeed}`;
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `unknown__${fallbackSeed}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Friendly relative-day label used by the Activity Timeline (Feature 5). */
export function relativeDayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "dd MMM yyyy");
}

export function formatShortDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return format(d, "dd MMM yyyy");
}
