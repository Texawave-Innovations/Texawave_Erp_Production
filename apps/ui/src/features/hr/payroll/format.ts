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

/** ISO timestamp → "8 Oct 2026, 14:05" in the viewer's locale/timezone. */
export function timestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
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
  PERIOD_FINALIZED:
    "That payroll period is finalized, so it can no longer change.",
  ALREADY_DECIDED:
    "This was already decided by someone else. Refresh to see it.",
  LOAN_NOT_ACTIVE: "Only an active loan can skip an EMI.",
  LOAN_SCHEDULE_INVALID:
    "EMI × months must cover the principal, and the last installment can't be empty.",
  NO_APPROVED_RUN:
    "This period has no approved payroll run yet. Approve a run first.",
  PERIOD_NOT_FINALIZED:
    "Payments can only be made for a finalized payroll period. Finalize it first.",
  PAYMENT_BATCH_EXISTS:
    "A payment batch already exists for this period. Open it from the list.",
  PAYROLL_RUN_EMPTY: "The approved payroll run has no employees to pay.",
  BATCH_ALREADY_PROCESSED: "This batch was already processed.",
  INVALID_STATE_TRANSITION:
    "That action is not allowed in the current status. Refresh and try again.",
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const known = ERROR_TEXT[error.errorCode];
    if (known) return known;
    // Maker-checker refusals are a plain 403 with no error code of their own
    // (apps/api/.../payroll/shared/payroll-scope.ts `assertNotSelfApproval`),
    // so they are told apart from a missing permission by their message.
    if (error.isPermissionError && /maker-checker/i.test(error.message))
      return "You created this, so someone else must approve it.";
    if (error.isPermissionError)
      return "You don't have permission to do this. Organization-wide payroll actions need an .all grant.";
    if (error.statusCode === 409) return error.message;
    return error.message;
  }
  return "Something went wrong. Try again.";
}
