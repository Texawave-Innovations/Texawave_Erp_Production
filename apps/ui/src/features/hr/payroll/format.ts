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
  ATTENDANCE_NOT_APPROVED:
    "Payroll reads approved attendance. Approve these employees' attendance month first (HR → Attendance → Month close).",
  TAX_REGIME_NOT_CONFIGURED:
    "TDS is on, but this financial year's tax slabs are missing. Add them under Payroll settings → Tax regimes.",
  SALARY_GROSS_MISMATCH:
    "The earning lines do not add up to the gross. Fix the amounts or leave the gross empty.",
  SALARY_COMPONENTS_INCOMPLETE:
    "Give the salary lines, a template with its gross, or a gross to split.",
  SALARY_OVERLAP:
    "This employee already has a salary structure for these dates. End the current one first.",
  SALARY_LOCKED_BY_FINALIZED_PAYROLL:
    "A finalized payroll used this structure. Create a new structure from the next month instead.",
  SALARY_COMPONENT_INACTIVE: "One of the components is inactive.",
  SALARY_COMPONENT_DUPLICATE: "A component appears more than once.",
  COMPONENT_CODE_RESERVED:
    "That code is used by the payroll engine itself (PF, ESI, PT, TDS, LOAN, BONUS, ARREARS, OVERTIME, GRATUITY).",
  COMPONENT_REQUIRED: "Basic Salary cannot be deactivated.",
  TEMPLATE_EXCEEDS_GROSS: "The template's earnings are more than the gross.",
  TEMPLATE_GROSS_MISMATCH:
    "The template's earnings do not add up to the gross. Add a REMAINDER line.",
  TEMPLATE_BASIC_MISSING:
    "A percent-of-Basic line needs a fixed or percent-of-gross BASIC line.",
  TEMPLATE_REMAINDER_DUPLICATE: "A template can have only one REMAINDER line.",
  TEMPLATE_REMAINDER_NOT_EARNING: "Only an earning can take the remainder.",
  TEMPLATE_VALUE_REQUIRED: "Every line except the REMAINDER needs a value.",
  TAX_SLABS_INVALID:
    "Slabs must start at 0 and follow on without gaps; only the last may have no upper limit.",
  PT_SLAB_OVERLAP:
    "This wage range overlaps another slab of the same state in force at the same time.",
  TAX_DECLARATION_LOCKED:
    "The declaration is submitted or verified and can no longer be changed.",
  DECISION_NOTE_REQUIRED: "Give a note when rejecting.",
  FORM16_NO_PAYROLL: "No finalized payroll for this employee in that year.",
  FINANCIAL_YEAR_INVALID: "Write the financial year like 2026-27.",
  LOAN_OVER_LIMIT:
    "The principal is above the organization's limit. Give an override reason; an organization-wide approver must then approve it.",
  LOAN_EMI_OVER_LIMIT:
    "The employee's EMIs together would exceed the allowed share of their salary.",
  LOAN_PREPAYMENT_EXCEEDS_BALANCE:
    "The prepayment is more than the outstanding balance.",
  PAYROLL_ALREADY_PAID:
    "Salary for this month is already paid, so it cannot be reopened. Correct it in the next period.",
  STATUTORY_ALREADY_REMITTED:
    "PF or ESI for this month is already remitted, so it cannot be reopened.",
  PAYSLIP_REGENERATION_REASON_REQUIRED:
    "A generated payslip would change. Give a reason to regenerate it.",
  PAYSLIP_SUPERSEDED: "This payslip belongs to a superseded run.",
  GRATUITY_NOT_ELIGIBLE: "No gratuity is due.",
  UAN_MISSING: "Some PF members have no UAN. Add it under Compliance.",
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

/** The financial year a date falls in: April–March, written "2026-27". */
export function financialYearOf(date: Date): string {
  const y = date.getFullYear();
  const start = date.getMonth() + 1 >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function currentFinancialYear(): string {
  return financialYearOf(new Date());
}

/** The current and the previous few financial years, newest first. */
export function recentFinancialYears(count = 4): string[] {
  const start = Number(currentFinancialYear().slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  });
}

/** Pay-days policy names (settings `payDaysMode`). */
export const PAY_DAYS_LABEL = {
  CALENDAR: "Calendar days",
  FIXED_30: "Fixed 30 days",
  FIXED_26: "Fixed 26 days",
  WORKING_DAYS: "Working days",
} as const;
