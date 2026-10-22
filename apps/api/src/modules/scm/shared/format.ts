/** Select value meaning "no filter" (Radix Select can't use an empty string as a value). */
export const ALL = "__all__";

export const MS_PER_DAY = 86_400_000;

const inrFormatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount as currency (INR by default). One formatter for every SCM screen so the same
 *  value never renders with different rounding on different pages. Falls back to INR when the
 *  currency code is not a valid ISO 4217 code. */
export function formatCurrency(
  amount: number,
  currency = "INR",
  maximumFractionDigits = 2,
): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "INR";
  const key = `${code}:${maximumFractionDigits}`;
  let fmt = inrFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      maximumFractionDigits,
    });
    inrFormatters.set(key, fmt);
  }
  return fmt.format(Number.isFinite(amount) ? amount : 0);
}

/** `PARTIALLY_RECEIVED` → `Partially Received`. */
export function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Local-calendar `YYYY-MM-DD` for a date/timestamp (not UTC — `toISOString` shifts IST dates
 *  before 05:30 to the previous day). */
export function toLocalDateKey(value: Date | number = new Date()): string {
  const d = typeof value === "number" ? new Date(value) : value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Parses `YYYY-MM-DD` as local midnight (`new Date('YYYY-MM-DD')` is UTC midnight). */
export function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole calendar days from `from` to `to` (local dates), e.g. overdue days for a due date. */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  ).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

export function errorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
