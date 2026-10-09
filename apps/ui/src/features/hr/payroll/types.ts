/**
 * Response shapes of apps/api/src/modules/hr/payroll. Rows are Prisma rows
 * with their includes; Prisma `Decimal` columns serialize as strings (e.g.
 * "52200.00"), so money/day fields are typed `Money` and formatted with
 * `money()` from ./format — never do arithmetic on them in the UI.
 */
export type Money = string;

export const PERIOD_STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PROCESSED",
  "APPROVED",
  "FINALIZED",
  "CANCELLED",
] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const RUN_STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PROCESSED",
  "APPROVED",
  "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export interface PersonRef {
  id: number;
  fullName: string;
}

export interface EmployeeRef {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface PeriodRef {
  id: number;
  year: number;
  month: number;
  status: PeriodStatus;
}

/** GET /hr/payroll/periods(/:id) — apps/api/.../periods/payroll-periods.repository.ts */
export interface PayrollPeriod {
  id: number;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  status: PeriodStatus;
  finalizedAt: string | null;
  finalizedBy: (PersonRef & { email: string }) | null;
  runs: Array<{
    id: number;
    runNumber: number;
    status: RunStatus;
    startedAt: string | null;
    completedAt: string | null;
    approvedAt: string | null;
  }>;
  createdAt: string;
}

/** GET /hr/payroll/runs(/:id) — apps/api/.../runs/payroll-runs.repository.ts */
export interface PayrollRun {
  id: number;
  payrollPeriodId: number;
  runNumber: number;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  payrollPeriod: PeriodRef;
  runCreator: PersonRef | null;
  runApprover: PersonRef | null;
  _count: { entries: number };
}

/** GET /hr/payroll/entries(/:id) */
export interface PayrollEntry {
  id: number;
  payrollRunId: number;
  employeeId: number;
  totalCalendarDays: number;
  requiredWorkingDays: number;
  presentDays: Money;
  leaveDays: Money;
  lopDays: Money;
  payableDays: Money;
  monthlyGross: Money;
  totalGrossEarnings: Money;
  totalDeductions: Money;
  netPayable: Money;
  status: string;
  employee: EmployeeRef;
  earnings: Array<{
    id: number;
    code: string;
    name: string;
    calculatedAmount: Money;
  }>;
  deductions: Array<{ id: number; code: string; name: string; amount: Money }>;
  payslip: { id: number; payslipNumber: string; status: string } | null;
}
