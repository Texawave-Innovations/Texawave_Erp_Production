import { ApiError } from "@texawave-erp/core";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_OPTIONS = MONTHS.map((name, i) => ({
  value: i + 1,
  label: name,
}));

/** "May 2026" */
export function periodLabel(p: { year: number; month: number }): string {
  return `${MONTHS[p.month - 1] ?? p.month} ${p.year}`;
}

/** Decimal string → "₹ 1,23,456.00". */
export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹ ${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Decimal day count → "21.5" (no trailing zeros). */
export function days(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? String(n) : "0";
}

/** ISO timestamp/date → "2026-05-31". */
export function isoDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—";
}

/** Business-rule codes the payroll API returns, in words an HR user acts on.
 * Anything else falls back to the server's own message. */
const ERROR_TEXT: Record<string, string> = {
  PAYROLL_FINALIZED: "This payroll period is finalized or cancelled.",
  PAYROLL_ALREADY_FINALIZED: "This payroll period is already finalized.",
  PERIOD_DATES_INVALID: "The period end date cannot be before its start date.",
  SALARY_NOT_CONFIGURED:
    "Some employees have no salary structure for this period. Add one under Salaries, then run payroll again.",
  NO_ELIGIBLE_EMPLOYEES: "No eligible employees were found for this period.",
  CALCULATION_EMPTY: "Payroll could not be calculated for any employee.",
  RUN_ALREADY_APPROVED: "This payroll run is already approved.",
  SELF_APPROVAL_FORBIDDEN:
    "You created this payroll run, so someone else must approve it.",
  INVALID_STATE_TRANSITION:
    "That action is not allowed in the current status. Refresh and try again.",
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const known = ERROR_TEXT[error.errorCode];
    if (known) return known;
    if (error.isPermissionError)
      return "You don't have permission to do this. Organization-wide payroll actions need an .all grant.";
    if (error.statusCode === 409) return error.message;
    return error.message;
  }
  return "Something went wrong. Try again.";
}
