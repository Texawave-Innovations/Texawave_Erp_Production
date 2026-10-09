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

export interface NamedRef {
  id: number;
  name: string;
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
  halfDays: Money;
  holidayDays: Money;
  leaveDays: Money;
  lopDays: Money;
  payableDays: Money;
  monthlyGross: Money;
  perDayRate: Money;
  /** payableDays ÷ requiredWorkingDays, e.g. "0.9545". */
  earningRatio: Money;
  baseEarnings: Money;
  totalGrossEarnings: Money;
  totalDeductions: Money;
  netPayable: Money;
  status: string;
  employee: EmployeeRef & {
    team: NamedRef | null;
    department: NamedRef | null;
  };
  earnings: Array<{
    id: number;
    code: string;
    name: string;
    baseAmount: Money;
    earningRatio: Money;
    calculatedAmount: Money;
  }>;
  deductions: Array<{
    id: number;
    code: string;
    name: string;
    amount: Money;
    /** Where the deduction came from, e.g. "STATUTORY", "LOAN". */
    sourceType: string | null;
  }>;
  payslip: { id: number; payslipNumber: string; status: string } | null;
}

// ---- Compliance: PF / ESI (apps/api/.../payroll/compliance) ---------------

export type ComplianceKind = "pf" | "esi";

export const CONTRIBUTION_PAYMENT_STATUSES = [
  "PENDING",
  "CREDITED",
  "FAILED",
] as const;
export type ContributionPaymentStatus =
  (typeof CONTRIBUTION_PAYMENT_STATUSES)[number];

interface ProfileBase {
  id: number;
  employeeId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedAt: string;
  employee: EmployeeRef;
}

/** GET/PUT /hr/compliance/pf/profiles/:employeeId */
export interface PfProfile extends ProfileBase {
  pfApplicable: boolean;
  uan: string | null;
  pfNumber: string | null;
}

/** GET/PUT /hr/compliance/esi/profiles/:employeeId */
export interface EsiProfile extends ProfileBase {
  esiApplicable: boolean;
  insuranceNumber: string | null;
}

interface ContributionBase {
  id: number;
  payrollPeriodId: number;
  payrollEntryId: number;
  employeeId: number;
  employeeContribution: Money;
  employerContribution: Money;
  paymentStatus: ContributionPaymentStatus;
  salaryCredited: boolean;
  employee: EmployeeRef;
  payrollPeriod: PeriodRef;
}

/** GET /hr/compliance/pf/contributions */
export interface PfContribution extends ContributionBase {
  pfIncluded: boolean;
  pfWage: Money;
}

/** GET /hr/compliance/esi/contributions */
export interface EsiContribution extends ContributionBase {
  esiIncluded: boolean;
  esiWage: Money;
}

// ---- Loans (apps/api/.../payroll/loans) -----------------------------------

export const LOAN_STATUSES = [
  "ACTIVE",
  "CLOSED",
  "DEFAULTED",
  "CANCELLED",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export type RepaymentStatus = "PENDING" | "PAID" | "SKIPPED";
export type DecisionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LoanRepayment {
  id: number;
  installmentNo: number;
  dueDate: string;
  amount: Money;
  status: RepaymentStatus;
  paidAt: string | null;
}

export interface LoanSkipRequest {
  id: number;
  loanId: number;
  payrollPeriodId: number;
  status: DecisionStatus;
  reason: string;
  requestedAt: string;
  approvedAt: string | null;
  payrollPeriod: { id: number; year: number; month: number };
  requester: PersonRef | null;
  approver: PersonRef | null;
}

/** GET /hr/loans(/:id), /self-service/loans(/:id) */
export interface Loan {
  id: number;
  employeeId: number;
  loanNumber: string;
  principalAmount: Money;
  emiAmount: Money;
  emiMonths: number;
  disbursedDate: string;
  status: LoanStatus;
  reason: string | null;
  createdAt: string;
  employee: EmployeeRef & { userId: number | null };
  repayments: LoanRepayment[];
  skipRequests: LoanSkipRequest[];
}

// ---- Bonuses (apps/api/.../payroll/bonuses) -------------------------------

export const BONUS_TYPES = [
  "FESTIVAL",
  "PERFORMANCE",
  "STATUTORY",
  "ANNUAL",
  "SPOT",
] as const;
export type BonusType = (typeof BONUS_TYPES)[number];

/** PAID is set by period finalization; the list filter (QueryBonusDto) only
 * accepts the first three plus PROCESSED, which nothing sets. */
export type BonusStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";
export const BONUS_FILTER_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

/** GET /hr/bonuses(/:id) */
export interface Bonus {
  id: number;
  employeeId: number;
  payrollPeriodId: number | null;
  bonusType: BonusType;
  calculationBase: string | null;
  tenureMonths: number | null;
  attendanceDays: Money | null;
  amount: Money;
  status: BonusStatus;
  reason: string | null;
  createdBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  employee: EmployeeRef & { userId: number | null };
  payrollPeriod: PeriodRef | null;
  approver: PersonRef | null;
}
