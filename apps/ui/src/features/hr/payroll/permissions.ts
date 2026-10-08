/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Every HR payroll/compliance permission is team-scoped (seeded as
 * `.own/.team/.all`, see packages/database/prisma/permissions/catalog.ts) and
 * the user's permission list holds the suffixed codes, so each check lists
 * all three variants (Docs/CODING_STANDARDS.md §13).
 */
function anyScope<P extends string>(code: P) {
  return [`${code}.own`, `${code}.team`, `${code}.all`] as const;
}

export const PAYROLL_READ = anyScope("hr.payroll.read");
export const PAYROLL_WRITE = anyScope("hr.payroll.write");
export const PAYROLL_APPROVE = anyScope("hr.payroll.approve");
export const PAYROLL_FINALIZE = anyScope("hr.payroll.finalize");

export const SALARY_READ = anyScope("hr.salary.read");
export const SALARY_WRITE = anyScope("hr.salary.write");

export const BONUS_READ = anyScope("hr.bonus.read");
export const BONUS_WRITE = anyScope("hr.bonus.write");
export const BONUS_APPROVE = anyScope("hr.bonus.approve");

export const LOAN_READ = anyScope("hr.loan.read");
export const LOAN_WRITE = anyScope("hr.loan.write");
export const LOAN_APPROVE = anyScope("hr.loan.approve");

export const PAYSLIP_READ = anyScope("hr.payslip.read");

export const PAYMENT_READ = anyScope("hr.payment.read");
export const PAYMENT_WRITE = anyScope("hr.payment.write");

export const PF_READ = anyScope("hr.pf.read");
export const PF_WRITE = anyScope("hr.pf.write");
export const ESI_READ = anyScope("hr.esi.read");
export const ESI_WRITE = anyScope("hr.esi.write");

/** Self-service: organization-wide, exact codes. */
export const MY_PAYSLIP_READ = "employee_self_service.payslip.read";
export const MY_LOAN_READ = "employee_self_service.loan.read";
