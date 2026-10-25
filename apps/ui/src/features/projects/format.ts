/** Shared display helpers for the Projects feature pages (legacy
 * `ProjectsDashboard.tsx`/`ProjectList.tsx`/`ProjectDetail.tsx` all formatted
 * money as en-IN rupees and dates as plain calendar days). */

export function formatCurrency(
  val: number | string | null | undefined,
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(val ?? 0) || 0);
}

/** API dates arrive as ISO timestamps (`2026-08-01T00:00:00.000Z`) for
 * `@db.Date` columns — render the calendar day without timezone shifting. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  const day = toDateInput(value);
  if (!day) return "—";
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** True when a not-yet-completed item's target day is before today. */
export function isPastDue(
  targetDate: string | null | undefined,
  status: string,
): boolean {
  const day = toDateInput(targetDate);
  return Boolean(day) && status !== "completed" && day < todayInput();
}

/** True when a not-yet-completed item's target day falls within the next
 * `days` days (legacy `isMilestoneUpcoming(m, 7)`). */
export function isDueWithin(
  targetDate: string | null | undefined,
  status: string,
  days: number,
): boolean {
  const day = toDateInput(targetDate);
  if (!day || status === "completed") return false;
  const today = todayInput();
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  return day >= today && day <= limit.toISOString().slice(0, 10);
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function percent(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}
