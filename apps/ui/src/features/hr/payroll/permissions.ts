/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Every HR payroll/compliance permission is team-scoped (seeded as
 * `.own/.team/.all`, see packages/database/prisma/permissions/catalog.ts) and
 * the user's permission list holds the suffixed codes, so each check lists
 * the variants that can actually succeed (Docs/CODING_STANDARDS.md §13):
 *
 * - reads: any scope — the API filters the rows.
 * - single-employee writes and approvals: `.team`/`.all`. `.own` never
 *   writes payroll data (nobody edits their own pay), and an `.own` approver
 *   only sees their own records, which maker-checker forbids them to decide.
 * - whole-organization actions (periods, runs, approval, finalizing,
 *   generating payslips, payment batches): `.all` only
 *   (apps/api/.../payroll/shared/payroll-scope.ts `requireOrgWideScope`).
 */
function anyScope<P extends string>(code: P) {
  return [`${code}.own`, `${code}.team`, `${code}.all`] as const;
}
function teamOrAll<P extends string>(code: P) {
  return [`${code}.team`, `${code}.all`] as const;
}
function orgWide<P extends string>(code: P) {
  return [`${code}.all`] as const;
}

export const PAYROLL_READ = anyScope("hr.payroll.read");
export const PAYROLL_WRITE = orgWide("hr.payroll.write");
export const PAYROLL_APPROVE = orgWide("hr.payroll.approve");
export const PAYROLL_FINALIZE = orgWide("hr.payroll.finalize");

export const SALARY_READ = anyScope("hr.salary.read");
export const SALARY_WRITE = teamOrAll("hr.salary.write");

export const BONUS_READ = anyScope("hr.bonus.read");
export const BONUS_WRITE = teamOrAll("hr.bonus.write");
export const BONUS_APPROVE = teamOrAll("hr.bonus.approve");

export const LOAN_READ = anyScope("hr.loan.read");
export const LOAN_WRITE = teamOrAll("hr.loan.write");
export const LOAN_APPROVE = teamOrAll("hr.loan.approve");

export const PAYSLIP_READ = anyScope("hr.payslip.read");

export const PAYMENT_READ = anyScope("hr.payment.read");
/** Payment batches cover the whole organization: list, create, process,
 * export all need `.all`. */
export const PAYMENT_BATCH_READ = orgWide("hr.payment.read");
export const PAYMENT_BATCH_WRITE = orgWide("hr.payment.write");
/** Correcting one payment is narrower: a `.team` grant may touch its own
 * teams' payments. */
export const PAYMENT_WRITE = teamOrAll("hr.payment.write");

export const PF_READ = anyScope("hr.pf.read");
export const PF_WRITE = teamOrAll("hr.pf.write");
export const ESI_READ = anyScope("hr.esi.read");
export const ESI_WRITE = teamOrAll("hr.esi.write");

/** Self-service: organization-wide, exact codes. */
export const MY_PAYSLIP_READ = "employee_self_service.payslip.read";
export const MY_LOAN_READ = "employee_self_service.loan.read";
