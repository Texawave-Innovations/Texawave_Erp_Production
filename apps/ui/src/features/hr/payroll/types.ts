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
  "REOPENED",
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
  reopenedAt?: string | null;
  reopenReason?: string | null;
  reopenCount?: number;
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
  absentDays?: Money;
  overtimeMinutes?: number;
  payDaysMode?: PayDaysMode | null;
  payDaysDivisor?: Money | null;
  attendanceLockId?: number | null;
  taxRegime?: TaxRegime | null;
  taxableEarnings?: Money;
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
  /** Employer share split (ECR). */
  epsContribution?: Money;
  epfEmployerContribution?: Money;
  edliContribution?: Money;
  adminCharges?: Money;
}

/** GET /hr/compliance/esi/contributions */
export interface EsiContribution extends ContributionBase {
  esiIncluded: boolean;
  esiWage: Money;
}

// ---- Loans (apps/api/.../payroll/loans) -----------------------------------

export const LOAN_STATUSES = [
  "PENDING_HR",
  "PENDING_ADMIN",
  "ACTIVE",
  "REJECTED",
  "CLOSED",
  "DEFAULTED",
  "CANCELLED",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
/** Awaiting the HR review, then the final approval (§3.7). */
export const LOAN_PENDING: readonly LoanStatus[] = [
  "PENDING_HR",
  "PENDING_ADMIN",
];

export type RepaymentStatus = "PENDING" | "PAID" | "SKIPPED" | "PREPAID";
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
  createdBy?: number | null;
  limitOverride?: boolean;
  overrideReason?: string | null;
  decisionNote?: string | null;
  approvedAt?: string | null;
  approver?: PersonRef | null;
  /** Who asked: the employee from the portal, or HR on their behalf. */
  requestedVia?: "SELF" | "HR";
  hrReviewer?: PersonRef | null;
  hrReviewedAt?: string | null;
  hrReviewNote?: string | null;
  employee: EmployeeRef & { userId: number | null };
  repayments: LoanRepayment[];
  skipRequests: LoanSkipRequest[];
  prepayments?: LoanPrepayment[];
}

// ---- Bonuses (apps/api/.../payroll/bonuses) -------------------------------

export const BONUS_TYPES = [
  "FESTIVAL",
  "PERFORMANCE",
  "STATUTORY",
  "ANNUAL",
  "SPOT",
  "GRATUITY",
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

// ---- payslips ------------------------------------------------------------

/** Bank details as the API returns them: account number and PAN are masked
 * to their last four characters; only the bank CSV export has them in full. */
export interface MaskedBankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber?: string | null;
}

export interface Payslip {
  id: number;
  payrollPeriodId: number;
  payrollEntryId: number;
  employeeId: number;
  payslipNumber: string;
  netPayable: Money;
  status: string;
  generatedAt: string;
  version?: number;
  regeneratedAt?: string | null;
  regenerationReason?: string | null;
  employee: EmployeeRef & {
    userId: number | null;
    designation: NamedRef | null;
    department: NamedRef | null;
    team: NamedRef | null;
    bankDetails: MaskedBankDetails | null;
    pfProfile: { uan: string | null; pfNumber: string | null } | null;
    esiProfile: { insuranceNumber: string | null } | null;
  };
  payrollPeriod: PeriodRef & { periodStart: string; periodEnd: string };
  payrollEntry: {
    payableDays: Money;
    lopDays: Money;
    totalGrossEarnings: Money;
    totalDeductions: Money;
    netPayable: Money;
    earnings: Array<{
      code: string;
      name: string;
      baseAmount: Money;
      calculatedAmount: Money;
    }>;
    deductions: Array<{
      code: string;
      name: string;
      amount: Money;
      sourceType: string | null;
    }>;
  };
}

// ---- payments ------------------------------------------------------------

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "CHEQUE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BATCH_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PROCESSED",
  "CANCELLED",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

/** Manual status changes the API allows (payments.service.ts
 * PAYMENT_TRANSITIONS). PAID and CANCELLED are final. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["PAID", "FAILED", "CANCELLED"],
  FAILED: ["PENDING", "PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export interface PayrollPayment {
  id: number;
  paymentBatchId: number;
  employeeId: number;
  amount: Money;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  bankReference: string | null;
  creditedAt: string | null;
  employee: EmployeeRef & { bankDetails: MaskedBankDetails | null };
}

export interface PaymentBatch {
  id: number;
  payrollPeriodId: number;
  batchNumber: string;
  totalEmployees: number;
  totalAmount: Money;
  generatedAt: string;
  status: BatchStatus;
  processedAt: string | null;
  payrollPeriod: PeriodRef;
  generator: PersonRef | null;
  /** Only on the single-batch endpoints. */
  payments?: PayrollPayment[];
}

// ---- Statutory engine additions (Docs/PAYROLL_AND_COMPLIANCE.md §3, §4.10–§4.16)

export const PAY_DAYS_MODES = [
  "CALENDAR",
  "FIXED_30",
  "FIXED_26",
  "WORKING_DAYS",
] as const;
export type PayDaysMode = (typeof PAY_DAYS_MODES)[number];

export const TAX_REGIMES = ["NEW", "OLD"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

/** GET /hr/payroll/settings — numbers, booleans and text, plus `version`. */
export interface PayrollSettings {
  basicPercent: number;
  hraPercent: number;
  conveyancePercent: number;
  pfWageCeiling: number;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  esiWageThreshold: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  payDaysMode: PayDaysMode;
  useAttendance: boolean;
  unmarkedDaysAsAbsent: boolean;
  overtimeEnabled: boolean;
  overtimeRatePerHour: number | null;
  overtimeMultiplier: number;
  standardHoursPerDay: number;
  pfCapAtCeiling: boolean;
  epsRate: number;
  epsWageCeiling: number;
  epsAgeLimit: number;
  edliRate: number;
  edliWageCeiling: number;
  pfAdminRate: number;
  ptEnabled: boolean;
  ptDefaultStateCode: string | null;
  tdsEnabled: boolean;
  defaultTaxRegime: TaxRegime;
  bonusEligibilityLimit: number;
  bonusCalculationCeiling: number;
  bonusPercent: number;
  gratuityCap: number;
  gratuityMinYears: number;
  loanMaxMultiple: number;
  loanMaxEmiPercent: number;
  companyName: string | null;
  companyAddress: string | null;
  companyGstin: string | null;
  companyPan: string | null;
  companyTan: string | null;
  pfEstablishmentCode: string | null;
  esiEmployerCode: string | null;
  isDefault: boolean;
  version: number;
  updatedAt: string | null;
}

export type ComponentKind = "EARNING" | "DEDUCTION";

/** GET /hr/payroll/salary-components */
export interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  kind: ComponentKind;
  isProrated: boolean;
  isTaxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  isSystem: boolean;
  displayOrder: number;
  isActive: boolean;
}

export const CALCULATION_TYPES = [
  "FIXED",
  "PERCENT_OF_GROSS",
  "PERCENT_OF_BASIC",
  "REMAINDER",
] as const;
export type CalculationType = (typeof CALCULATION_TYPES)[number];

/** GET /hr/payroll/salary-templates */
export interface SalaryTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  lines: Array<{
    id: number;
    calculationType: CalculationType;
    value: Money;
    component: Pick<
      SalaryComponent,
      "id" | "code" | "name" | "kind" | "isActive"
    >;
  }>;
}

/** One line of a structure or of a template preview. */
export interface AppliedLine {
  componentId: number;
  code: string;
  kind: ComponentKind;
  monthlyAmount: number;
}

/** GET /hr/salaries */
export interface Salary {
  id: number;
  employeeId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  grossMonthly: Money;
  arrearsSalary: Money;
  arrearsPaidPeriodId: number | null;
  employee: EmployeeRef & {
    teamId: number;
    userId: number | null;
    status: string;
  };
  components: Array<{
    monthlyAmount: Money;
    component: Pick<
      SalaryComponent,
      "id" | "code" | "name" | "kind" | "displayOrder"
    >;
  }>;
  salaryTemplate: { id: number; code: string; name: string } | null;
  revisionLetter: { id: number; documentNo: string } | null;
}

/** GET /hr/payroll/tax-regimes */
export interface TaxRegimeRules {
  id: number;
  financialYear: string;
  regime: TaxRegime;
  standardDeduction: Money;
  rebateIncomeLimit: Money;
  rebateMaxAmount: Money;
  cessPercent: Money;
  section80cLimit: Money;
  homeLoanInterestLimit: Money;
  version: number;
  slabs: Array<{
    id: number;
    fromIncome: Money;
    toIncome: Money | null;
    ratePercent: Money;
  }>;
}

/** GET /hr/payroll/pt-slabs */
export interface PtSlab {
  id: number;
  stateCode: string;
  minMonthlyWage: Money;
  maxMonthlyWage: Money | null;
  monthlyAmount: Money;
  specialMonth: number | null;
  specialAmount: Money | null;
  applicableMonths: number[];
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

/** GET /hr/payroll/pt-location-states */
export interface PtLocationState {
  id: number;
  workLocationId: number;
  stateCode: string;
  workLocation: { id: number; code: string; name: string };
}

export const DECLARATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
] as const;
export type DeclarationStatus = (typeof DECLARATION_STATUSES)[number];

/** Annual amounts an employee declares, with their labels. */
export const DECLARATION_FIELDS = [
  ["section80c", "80C investments (other than PF)"],
  ["section80d", "80D medical insurance"],
  ["hraExemption", "HRA exemption"],
  ["homeLoanInterest", "Home-loan interest"],
  ["otherDeductions", "Other deductions"],
  ["otherIncome", "Other income"],
  ["previousEmployerIncome", "Income from previous employer"],
  ["previousEmployerTds", "TDS by previous employer"],
] as const;
export type DeclarationField = (typeof DECLARATION_FIELDS)[number][0];

/** Declared field → the field HR records its accepted amount in. */
export const VERIFIABLE_FIELDS = [
  ["section80c", "verifiedSection80c"],
  ["section80d", "verifiedSection80d"],
  ["hraExemption", "verifiedHraExemption"],
  ["homeLoanInterest", "verifiedHomeLoanInterest"],
  ["otherDeductions", "verifiedOtherDeductions"],
] as const;
export type VerifiedField = (typeof VERIFIABLE_FIELDS)[number][1];

/** GET /hr/tax-declarations, /self-service/tax-declarations */
export type TaxDeclaration = {
  id: number;
  employeeId: number;
  financialYear: string;
  regime: TaxRegime;
  status: DeclarationStatus;
  submittedAt: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  version: number;
  employee: EmployeeRef & { teamId: number; userId: number | null };
  verifier: PersonRef | null;
} & Record<DeclarationField, Money> &
  Record<VerifiedField, Money | null>;

/** GET …/form16/:financialYear — Form 16 Part B. */
export interface Form16 {
  financialYear: string;
  employer: {
    name: string | null;
    address: string | null;
    pan: string | null;
    tan: string | null;
  };
  employee: { employeeCode: string; fullName: string; pan: string | null };
  regime: TaxRegime;
  months: Array<{
    year: number;
    month: number;
    grossEarnings: number;
    taxableEarnings: number;
    tds: number;
  }>;
  totals: {
    grossEarnings: number;
    taxableSalary: number;
    otherIncome: number;
    previousEmployerIncome: number;
    deductions: number;
    taxableIncome: number;
    taxPayable: number | null;
    tdsDeducted: number;
    previousEmployerTds: number;
  };
}

/** POST /hr/bonuses/statutory */
export interface StatutoryBonusResult {
  financialYear: string;
  rules: {
    eligibilityLimit: number;
    calculationCeiling: number;
    percent: number;
  };
  employees: Array<{
    employee: EmployeeRef;
    monthlyBasicDa: number;
    alreadyRaised: boolean;
    eligible: boolean;
    reason: string | null;
    workedDays: number;
    bonusWages: number;
    amount: number;
  }>;
  createdBonusIds: number[];
}

/** GET /hr/bonuses/gratuity/:employeeId */
export interface GratuityResult {
  employee: EmployeeRef;
  asOf: string;
  eligible: boolean;
  reason: string | null;
  completedYears: number;
  countedYears: number;
  lastDrawnWage: number;
  amount: number;
}

export interface LoanPrepayment {
  id: number;
  amount: Money;
  receivedOn: string;
  reference: string | null;
  reason: string;
  status: DecisionStatus;
  requestedById: number;
  decidedAt: string | null;
  requester: PersonRef | null;
  decider: PersonRef | null;
}

/** The statutory files and reports of a period (§4.15). */
export const PAYROLL_REPORTS = [
  { id: "pf-ecr", label: "PF ECR (EPFO)", finalizedOnly: true },
  { id: "esi", label: "ESI upload", finalizedOnly: true },
  { id: "professional-tax", label: "Professional Tax", finalizedOnly: true },
  { id: "tds", label: "TDS (24Q basis)", finalizedOnly: true },
  { id: "journal", label: "Salary journal", finalizedOnly: false },
  { id: "salary-register", label: "Salary register", finalizedOnly: false },
] as const;
export type PayrollReportId = (typeof PAYROLL_REPORTS)[number]["id"];
