import {
  ApiError,
  formatCurrency,
  formatDate,
  formatDateTime,
  resolveMessage,
  type MessageKey,
} from "@texawave-erp/core";

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

/** Decimal string → formatted currency e.g. "₹ 1,23,456.00". */
export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return formatCurrency(Number.isFinite(n) ? n : 0);
}

/** Decimal day count → "21.5" (no trailing zeros). */
export function days(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? String(n) : "0";
}

/** Formatted calendar date e.g. "31/05/2026" or "2026-05-31". */
export function isoDate(value: string | null | undefined): string {
  return value ? formatDate(value) : "—";
}

/** ISO timestamp → formatted date and time in the viewer's locale/timezone. */
export function timestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateTime(d);
}

/** Business-rule codes the payroll API returns, each pointing at the catalogue
 * message (`payroll.error.*`) that says it in words an HR user acts on.
 * Anything else falls back to the server's own message. */
const ERROR_KEYS: Record<string, MessageKey> = {
  PAYROLL_FINALIZED: "payroll.error.payrollFinalized",
  PAYROLL_ALREADY_FINALIZED: "payroll.error.payrollAlreadyFinalized",
  PERIOD_DATES_INVALID: "payroll.error.periodDatesInvalid",
  SALARY_NOT_CONFIGURED: "payroll.error.salaryNotConfigured",
  NO_ELIGIBLE_EMPLOYEES: "payroll.error.noEligibleEmployees",
  CALCULATION_EMPTY: "payroll.error.calculationEmpty",
  RUN_ALREADY_APPROVED: "payroll.error.runAlreadyApproved",
  PERIOD_FINALIZED: "payroll.error.periodFinalized",
  ALREADY_DECIDED: "payroll.error.alreadyDecided",
  LOAN_NOT_ACTIVE: "payroll.error.loanNotActive",
  LOAN_SCHEDULE_INVALID: "payroll.error.loanScheduleInvalid",
  NO_APPROVED_RUN: "payroll.error.noApprovedRun",
  PERIOD_NOT_FINALIZED: "payroll.error.periodNotFinalized",
  PAYMENT_BATCH_EXISTS: "payroll.error.paymentBatchExists",
  PAYROLL_RUN_EMPTY: "payroll.error.payrollRunEmpty",
  BATCH_ALREADY_PROCESSED: "payroll.error.batchAlreadyProcessed",
  INVALID_STATE_TRANSITION: "payroll.error.invalidStateTransition",
  ATTENDANCE_NOT_APPROVED: "payroll.error.attendanceNotApproved",
  TAX_REGIME_NOT_CONFIGURED: "payroll.error.taxRegimeNotConfigured",
  SALARY_GROSS_MISMATCH: "payroll.error.salaryGrossMismatch",
  SALARY_COMPONENTS_INCOMPLETE: "payroll.error.salaryComponentsIncomplete",
  SALARY_OVERLAP: "payroll.error.salaryOverlap",
  SALARY_LOCKED_BY_FINALIZED_PAYROLL:
    "payroll.error.salaryLockedByFinalizedPayroll",
  SALARY_COMPONENT_INACTIVE: "payroll.error.salaryComponentInactive",
  SALARY_COMPONENT_DUPLICATE: "payroll.error.salaryComponentDuplicate",
  COMPONENT_CODE_RESERVED: "payroll.error.componentCodeReserved",
  COMPONENT_REQUIRED: "payroll.error.componentRequired",
  TEMPLATE_EXCEEDS_GROSS: "payroll.error.templateExceedsGross",
  TEMPLATE_GROSS_MISMATCH: "payroll.error.templateGrossMismatch",
  TEMPLATE_BASIC_MISSING: "payroll.error.templateBasicMissing",
  TEMPLATE_REMAINDER_DUPLICATE: "payroll.error.templateRemainderDuplicate",
  TEMPLATE_REMAINDER_NOT_EARNING: "payroll.error.templateRemainderNotEarning",
  TEMPLATE_VALUE_REQUIRED: "payroll.error.templateValueRequired",
  TAX_SLABS_INVALID: "payroll.error.taxSlabsInvalid",
  PT_SLAB_OVERLAP: "payroll.error.ptSlabOverlap",
  TAX_DECLARATION_LOCKED: "payroll.error.taxDeclarationLocked",
  DECISION_NOTE_REQUIRED: "payroll.error.decisionNoteRequired",
  FORM16_NO_PAYROLL: "payroll.error.form16NoPayroll",
  FINANCIAL_YEAR_INVALID: "payroll.error.financialYearInvalid",
  LOAN_OVER_LIMIT: "payroll.error.loanOverLimit",
  LOAN_EMI_OVER_LIMIT: "payroll.error.loanEmiOverLimit",
  LOAN_PREPAYMENT_EXCEEDS_BALANCE: "payroll.error.loanPrepaymentExceedsBalance",
  PAYROLL_ALREADY_PAID: "payroll.error.payrollAlreadyPaid",
  STATUTORY_ALREADY_REMITTED: "payroll.error.statutoryAlreadyRemitted",
  PAYSLIP_REGENERATION_REASON_REQUIRED:
    "payroll.error.payslipRegenerationReasonRequired",
  PAYSLIP_SUPERSEDED: "payroll.error.payslipSuperseded",
  GRATUITY_NOT_ELIGIBLE: "payroll.error.gratuityNotEligible",
  UAN_MISSING: "payroll.error.uanMissing",
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const known = ERROR_KEYS[error.errorCode];
    if (known) return resolveMessage(known).title;
    // Maker-checker refusals are a plain 403 with no error code of their own
    // (apps/api/.../payroll/shared/payroll-scope.ts `assertNotSelfApproval`),
    // so they are told apart from a missing permission by their message.
    if (error.isPermissionError && /maker-checker/i.test(error.message))
      return resolveMessage("payroll.error.makerChecker").title;
    if (error.isPermissionError)
      return resolveMessage("payroll.error.permission").title;
    if (error.statusCode === 409) return error.message;
    return error.message;
  }
  return resolveMessage("payroll.error.generic").title;
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
