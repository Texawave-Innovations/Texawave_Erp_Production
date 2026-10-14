import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  AppliedLine,
  CalculationType,
  ComponentKind,
  DeclarationField,
  DeclarationStatus,
  Form16,
  GratuityResult,
  PayrollReportId,
  PayrollSettings,
  PtLocationState,
  PtSlab,
  Salary,
  SalaryComponent,
  SalaryTemplate,
  StatutoryBonusResult,
  TaxDeclaration,
  TaxRegime,
  TaxRegimeRules,
  VerifiedField,
  Bonus,
  BonusType,
  ComplianceKind,
  ContributionPaymentStatus,
  DecisionStatus,
  EsiContribution,
  EsiProfile,
  Loan,
  LoanStatus,
  PaymentBatch,
  PaymentMethod,
  PaymentStatus,
  BatchStatus,
  PayrollPayment,
  Payslip,
  PayrollEntry,
  PayrollPeriod,
  PayrollRun,
  PeriodStatus,
  PfContribution,
  PfProfile,
  RunStatus,
} from "./types";

const PERIODS = "/hr/payroll/periods";
const RUNS = "/hr/payroll/runs";
const ENTRIES = "/hr/payroll/entries";

interface PageQuery {
  page: number;
  limit: number;
}

// ---- periods --------------------------------------------------------------

export interface PeriodListQuery extends PageQuery {
  year?: number;
  status?: PeriodStatus;
}

export function listPeriods(
  query: PeriodListQuery,
): Promise<PaginatedEnvelope<PayrollPeriod>> {
  return withAuthRetry(() =>
    apiClient.get<PayrollPeriod[]>(PERIODS, { query }),
  ) as Promise<PaginatedEnvelope<PayrollPeriod>>;
}

export async function getPeriod(id: number): Promise<PayrollPeriod> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PayrollPeriod>(`${PERIODS}/${id}`),
  );
  return data;
}

export interface CreatePeriodBody {
  year: number;
  month: number;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
}

export async function createPeriod(
  body: CreatePeriodBody,
): Promise<PayrollPeriod> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PayrollPeriod>(PERIODS, body),
  );
  return data;
}

export async function cancelPeriod(id: number): Promise<PayrollPeriod> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PayrollPeriod>(`${PERIODS}/${id}`, {
      status: "CANCELLED",
    }),
  );
  return data;
}

export async function finalizePeriod(id: number): Promise<PayrollPeriod> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PayrollPeriod>(`${PERIODS}/${id}/finalize`, {}),
  );
  return data;
}

// ---- runs -----------------------------------------------------------------

export interface RunListQuery extends PageQuery {
  payrollPeriodId?: number;
  status?: RunStatus;
}

export function listRuns(
  query: RunListQuery,
): Promise<PaginatedEnvelope<PayrollRun>> {
  return withAuthRetry(() =>
    apiClient.get<PayrollRun[]>(RUNS, { query }),
  ) as Promise<PaginatedEnvelope<PayrollRun>>;
}

export interface CreateRunBody {
  payrollPeriodId: number;
  employeeIds?: number[];
  notes?: string;
}

export async function createRun(body: CreateRunBody): Promise<PayrollRun> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PayrollRun>(RUNS, body),
  );
  return data;
}

export async function approveRun(
  id: number,
  body: { notes?: string },
): Promise<PayrollRun> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PayrollRun>(`${RUNS}/${id}/approve`, body),
  );
  return data;
}

// ---- entries --------------------------------------------------------------

export interface EntryListQuery extends PageQuery {
  payrollRunId?: number;
  payrollPeriodId?: number;
  employeeId?: number;
}

export async function getEntry(id: number): Promise<PayrollEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PayrollEntry>(`${ENTRIES}/${id}`),
  );
  return data;
}

export function listEntries(
  query: EntryListQuery,
): Promise<PaginatedEnvelope<PayrollEntry>> {
  return withAuthRetry(() =>
    apiClient.get<PayrollEntry[]>(ENTRIES, { query }),
  ) as Promise<PaginatedEnvelope<PayrollEntry>>;
}

/** Every entry of one run, across pages — for reports that need totals.
 * Capped so a runaway result can't loop forever (100 × 50 = 5,000 rows). */
export async function listAllRunEntries(
  payrollRunId: number,
): Promise<PayrollEntry[]> {
  const LIMIT = 100;
  const MAX_PAGES = 50;
  const rows: PayrollEntry[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await listEntries({ page, limit: LIMIT, payrollRunId });
    rows.push(...res.data);
    if (page >= (res.meta?.totalPages ?? 1)) break;
  }
  return rows;
}

// ---- compliance: PF / ESI ------------------------------------------------

const COMPLIANCE = "/hr/compliance";

export type ComplianceProfile<K extends ComplianceKind> = K extends "pf"
  ? PfProfile
  : EsiProfile;
export type Contribution<K extends ComplianceKind> = K extends "pf"
  ? PfContribution
  : EsiContribution;

/** null when the employee has no profile yet (the API answers 404). */
export async function getComplianceProfile<K extends ComplianceKind>(
  kind: K,
  employeeId: number,
): Promise<ComplianceProfile<K> | null> {
  try {
    const { data } = await withAuthRetry(() =>
      apiClient.get<ComplianceProfile<K>>(
        `${COMPLIANCE}/${kind}/profiles/${employeeId}`,
      ),
    );
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound) return null;
    throw err;
  }
}

export type PfProfileBody = {
  pfApplicable: boolean;
  uan?: string | undefined;
  pfNumber?: string | undefined;
  effectiveFrom?: string | undefined;
  effectiveTo?: string | undefined;
};
export type EsiProfileBody = {
  esiApplicable: boolean;
  insuranceNumber?: string | undefined;
  effectiveFrom?: string | undefined;
  effectiveTo?: string | undefined;
};

export async function saveComplianceProfile<K extends ComplianceKind>(
  kind: K,
  employeeId: number,
  body: K extends "pf" ? PfProfileBody : EsiProfileBody,
): Promise<ComplianceProfile<K>> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<ComplianceProfile<K>>(
      `${COMPLIANCE}/${kind}/profiles/${employeeId}`,
      body,
    ),
  );
  return data;
}

export interface ContributionQuery extends PageQuery {
  payrollPeriodId?: number;
  employeeId?: number;
  paymentStatus?: ContributionPaymentStatus;
}

export function listContributions<K extends ComplianceKind>(
  kind: K,
  query: ContributionQuery,
): Promise<PaginatedEnvelope<Contribution<K>>> {
  return withAuthRetry(() =>
    apiClient.get<Contribution<K>[]>(`${COMPLIANCE}/${kind}/contributions`, {
      query,
    }),
  ) as Promise<PaginatedEnvelope<Contribution<K>>>;
}

// ---- loans ---------------------------------------------------------------

const LOANS = "/hr/loans";

export interface LoanListQuery extends PageQuery {
  employeeId?: number;
  status?: LoanStatus;
}

export function listLoans(
  query: LoanListQuery,
): Promise<PaginatedEnvelope<Loan>> {
  return withAuthRetry(() =>
    apiClient.get<Loan[]>(LOANS, { query }),
  ) as Promise<PaginatedEnvelope<Loan>>;
}

export function listMyLoans(
  query: Omit<LoanListQuery, "employeeId">,
): Promise<PaginatedEnvelope<Loan>> {
  return withAuthRetry(() =>
    apiClient.get<Loan[]>("/self-service/loans", { query }),
  ) as Promise<PaginatedEnvelope<Loan>>;
}

export interface CreateLoanBody {
  employeeId: number;
  principalAmount: number;
  emiAmount: number;
  emiMonths: number;
  disbursedDate: string;
  reason?: string | undefined;
  /** Required above the organization's principal limit. */
  overrideReason?: string | undefined;
}

export async function createLoan(body: CreateLoanBody): Promise<Loan> {
  const { data } = await withAuthRetry(() => apiClient.post<Loan>(LOANS, body));
  return data;
}

export async function requestLoanSkip(
  loanId: number,
  body: { payrollPeriodId: number; reason: string },
): Promise<unknown> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<unknown>(`${LOANS}/${loanId}/skip-request`, body),
  );
  return data;
}

export async function decideLoanSkip(
  skipRequestId: number,
  decision: Exclude<DecisionStatus, "PENDING">,
): Promise<unknown> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<unknown>(`${LOANS}/skip-requests/${skipRequestId}/decide`, {
      decision,
    }),
  );
  return data;
}

// ---- bonuses -------------------------------------------------------------

const BONUSES = "/hr/bonuses";

export interface BonusListQuery extends PageQuery {
  employeeId?: number;
  payrollPeriodId?: number;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export function listBonuses(
  query: BonusListQuery,
): Promise<PaginatedEnvelope<Bonus>> {
  return withAuthRetry(() =>
    apiClient.get<Bonus[]>(BONUSES, { query }),
  ) as Promise<PaginatedEnvelope<Bonus>>;
}

export interface CreateBonusBody {
  employeeId: number;
  bonusType: BonusType;
  amount: number;
  payrollPeriodId?: number | undefined;
  reason?: string | undefined;
}

export async function createBonus(body: CreateBonusBody): Promise<Bonus> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Bonus>(BONUSES, body),
  );
  return data;
}

export async function decideBonus(
  id: number,
  body: { decision: "APPROVED" | "REJECTED"; note?: string | undefined },
): Promise<Bonus> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Bonus>(`${BONUSES}/${id}/decide`, body),
  );
  return data;
}

// ---- payslips ------------------------------------------------------------

export interface PayslipListQuery extends PageQuery {
  employeeId?: number;
  payrollPeriodId?: number;
}

export function listPayslips(
  query: PayslipListQuery,
): Promise<PaginatedEnvelope<Payslip>> {
  return withAuthRetry(() =>
    apiClient.get<Payslip[]>("/hr/payslips", { query }),
  ) as Promise<PaginatedEnvelope<Payslip>>;
}

export function listMyPayslips(
  query: Omit<PayslipListQuery, "employeeId">,
): Promise<PaginatedEnvelope<Payslip>> {
  return withAuthRetry(() =>
    apiClient.get<Payslip[]>("/self-service/payslips", { query }),
  ) as Promise<PaginatedEnvelope<Payslip>>;
}

/** (Re)generates the payslips of a period's approved run. */
export async function generatePayslips(
  payrollPeriodId: number,
  reason?: string,
): Promise<Payslip[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Payslip[]>("/hr/payslips/generate", {
      payrollPeriodId,
      ...(reason ? { reason } : {}),
    }),
  );
  return data;
}

/** The payslip PDF, from the HR or the self-service route. */
export function downloadPayslipPdf(
  id: number,
  selfService: boolean,
): Promise<Blob> {
  const base = selfService ? "/self-service/payslips" : "/hr/payslips";
  return withAuthRetry(() => apiClient.download(`${base}/${id}/pdf`));
}

// ---- payments ------------------------------------------------------------

const BATCHES = "/hr/payment-batches";

export interface BatchListQuery extends PageQuery {
  payrollPeriodId?: number;
  status?: BatchStatus;
}

export function listPaymentBatches(
  query: BatchListQuery,
): Promise<PaginatedEnvelope<PaymentBatch>> {
  return withAuthRetry(() =>
    apiClient.get<PaymentBatch[]>(BATCHES, { query }),
  ) as Promise<PaginatedEnvelope<PaymentBatch>>;
}

export async function getPaymentBatch(id: number): Promise<PaymentBatch> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PaymentBatch>(`${BATCHES}/${id}`),
  );
  return data;
}

export async function createPaymentBatch(body: {
  payrollPeriodId: number;
  paymentMethod: PaymentMethod;
}): Promise<PaymentBatch> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PaymentBatch>(BATCHES, body),
  );
  return data;
}

/** Marks the batch processed and its still-pending payments paid. */
export async function processPaymentBatch(id: number): Promise<PaymentBatch> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PaymentBatch>(`${BATCHES}/${id}/process`, {}),
  );
  return data;
}

/** The bank-transfer CSV (full account numbers — the bank needs them). */
export async function exportPaymentBatch(
  id: number,
): Promise<{ fileName: string; content: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ fileName: string; content: string }>(
      `${BATCHES}/${id}/export`,
    ),
  );
  return data;
}

export interface UpdatePaymentBody {
  status?: PaymentStatus | undefined;
  bankReference?: string | undefined;
}

export async function updatePayment(
  id: number,
  body: UpdatePaymentBody,
): Promise<PayrollPayment> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PayrollPayment>(`/hr/payments/${id}`, body),
  );
  return data;
}

// ---- reopen, payslip regeneration (§4.16) ----------------------------------

export async function reopenPeriod(
  id: number,
  reason: string,
): Promise<PayrollPeriod> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PayrollPeriod>(`${PERIODS}/${id}/reopen`, { reason }),
  );
  return data;
}

export async function regeneratePayslip(
  id: number,
  reason: string,
): Promise<Payslip> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Payslip>(`/hr/payslips/${id}/regenerate`, { reason }),
  );
  return data;
}

/** A statutory file or report of a period (§4.15), as a Blob. */
export function downloadPayrollReport(
  payrollPeriodId: number,
  report: PayrollReportId,
): Promise<Blob> {
  return withAuthRetry(() =>
    apiClient.download(`${PERIODS}/${payrollPeriodId}/reports/${report}`),
  );
}

// ---- settings (§4.2a) ------------------------------------------------------

const SETTINGS = "/hr/payroll/settings";

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PayrollSettings>(SETTINGS),
  );
  return data;
}

export type PayrollSettingsBody = Partial<
  Omit<PayrollSettings, "isDefault" | "updatedAt">
> & { version: number };

export async function updatePayrollSettings(
  body: PayrollSettingsBody,
): Promise<PayrollSettings> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PayrollSettings>(SETTINGS, body),
  );
  return data;
}

// ---- salary components & templates (§4.10) --------------------------------

const COMPONENTS = "/hr/payroll/salary-components";
const TEMPLATES = "/hr/payroll/salary-templates";

export async function listSalaryComponents(
  includeInactive: boolean,
): Promise<SalaryComponent[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<SalaryComponent[]>(COMPONENTS, {
      query: { includeInactive },
    }),
  );
  return data;
}

export interface SalaryComponentBody {
  code?: string;
  name?: string;
  kind?: ComponentKind;
  isProrated?: boolean;
  isTaxable?: boolean;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export async function createSalaryComponent(
  body: SalaryComponentBody,
): Promise<SalaryComponent> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SalaryComponent>(COMPONENTS, body),
  );
  return data;
}

export async function updateSalaryComponent(
  id: number,
  body: SalaryComponentBody,
): Promise<SalaryComponent> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<SalaryComponent>(`${COMPONENTS}/${id}`, body),
  );
  return data;
}

export async function listSalaryTemplates(
  includeInactive: boolean,
): Promise<SalaryTemplate[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<SalaryTemplate[]>(TEMPLATES, { query: { includeInactive } }),
  );
  return data;
}

export interface TemplateLineBody {
  componentId: number;
  calculationType: CalculationType;
  value?: number;
}

export interface SalaryTemplateBody {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  lines?: TemplateLineBody[];
}

export async function createSalaryTemplate(
  body: SalaryTemplateBody,
): Promise<SalaryTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SalaryTemplate>(TEMPLATES, body),
  );
  return data;
}

export async function updateSalaryTemplate(
  id: number,
  body: SalaryTemplateBody,
): Promise<SalaryTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<SalaryTemplate>(`${TEMPLATES}/${id}`, body),
  );
  return data;
}

export async function previewSalaryTemplate(
  id: number,
  grossMonthly: number,
): Promise<{
  grossMonthly: number;
  lines: AppliedLine[];
  totalEarnings: number;
}> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{
      grossMonthly: number;
      lines: AppliedLine[];
      totalEarnings: number;
    }>(`${TEMPLATES}/${id}/preview`, { grossMonthly }),
  );
  return data;
}

// ---- salaries (§4.2) ---------------------------------------------------------

const SALARIES = "/hr/salaries";

export interface SalaryListQuery extends PageQuery {
  employeeId?: number;
  effectiveOn?: string;
}

export function listSalaries(
  query: SalaryListQuery,
): Promise<PaginatedEnvelope<Salary>> {
  return withAuthRetry(() =>
    apiClient.get<Salary[]>(SALARIES, { query }),
  ) as Promise<PaginatedEnvelope<Salary>>;
}

export interface SalaryLineBody {
  componentId: number;
  monthlyAmount: number;
}

export interface CreateSalaryBody {
  employeeId: number;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  components?: SalaryLineBody[] | undefined;
  salaryTemplateId?: number | undefined;
  grossMonthly?: number | undefined;
  revisionLetterId?: number | undefined;
  arrearsSalary?: number | undefined;
}

export async function createSalary(body: CreateSalaryBody): Promise<Salary> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Salary>(SALARIES, body),
  );
  return data;
}

export interface UpdateSalaryBody {
  effectiveTo?: string | undefined;
  components?: SalaryLineBody[] | undefined;
  arrearsSalary?: number | undefined;
}

export async function updateSalary(
  id: number,
  body: UpdateSalaryBody,
): Promise<Salary> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Salary>(`${SALARIES}/${id}`, body),
  );
  return data;
}

// ---- tax regimes, Professional Tax (§4.11, §4.12) ----------------------------

export async function listTaxRegimes(
  financialYear?: string,
): Promise<TaxRegimeRules[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaxRegimeRules[]>("/hr/payroll/tax-regimes", {
      query: financialYear ? { financialYear } : {},
    }),
  );
  return data;
}

export interface TaxRegimeBody {
  financialYear: string;
  regime: TaxRegime;
  version: number;
  standardDeduction: number;
  rebateIncomeLimit: number;
  rebateMaxAmount: number;
  cessPercent: number;
  section80cLimit?: number;
  homeLoanInterestLimit?: number;
  slabs: Array<{
    fromIncome: number;
    toIncome: number | null;
    ratePercent: number;
  }>;
}

export async function saveTaxRegime(
  body: TaxRegimeBody,
): Promise<TaxRegimeRules> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<TaxRegimeRules>("/hr/payroll/tax-regimes", body),
  );
  return data;
}

export async function listPtSlabs(): Promise<PtSlab[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PtSlab[]>("/hr/payroll/pt-slabs"),
  );
  return data;
}

export interface PtSlabBody {
  stateCode: string;
  minMonthlyWage: number;
  maxMonthlyWage?: number | null;
  monthlyAmount: number;
  specialMonth?: number;
  specialAmount?: number;
  applicableMonths?: number[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export async function createPtSlab(body: PtSlabBody): Promise<PtSlab> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PtSlab>("/hr/payroll/pt-slabs", body),
  );
  return data;
}

export async function updatePtSlab(
  id: number,
  body: { effectiveTo?: string; isActive?: boolean },
): Promise<PtSlab> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PtSlab>(`/hr/payroll/pt-slabs/${id}`, body),
  );
  return data;
}

export async function listPtLocationStates(): Promise<PtLocationState[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PtLocationState[]>("/hr/payroll/pt-location-states"),
  );
  return data;
}

export async function setPtLocationState(
  workLocationId: number,
  stateCode: string,
): Promise<PtLocationState> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<PtLocationState>(
      `/hr/payroll/pt-location-states/${workLocationId}`,
      { stateCode },
    ),
  );
  return data;
}

// ---- tax declarations & Form 16 (§4.13, §4.14) -------------------------------

const DECLARATIONS = "/hr/tax-declarations";

export interface DeclarationListQuery extends PageQuery {
  financialYear?: string;
  status?: DeclarationStatus;
  employeeId?: number;
}

export function listTaxDeclarations(
  query: DeclarationListQuery,
): Promise<PaginatedEnvelope<TaxDeclaration>> {
  return withAuthRetry(() =>
    apiClient.get<TaxDeclaration[]>(DECLARATIONS, { query }),
  ) as Promise<PaginatedEnvelope<TaxDeclaration>>;
}

export type DeclarationAmounts = Partial<Record<DeclarationField, number>>;

export interface SaveDeclarationBody extends DeclarationAmounts {
  version: number;
  regime: TaxRegime;
  submit?: boolean;
}

export async function saveDeclarationForEmployee(
  employeeId: number,
  financialYear: string,
  body: SaveDeclarationBody,
): Promise<TaxDeclaration> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<TaxDeclaration>(
      `${DECLARATIONS}/employee/${employeeId}/${financialYear}`,
      body,
    ),
  );
  return data;
}

export interface VerifyDeclarationBody extends Partial<
  Record<VerifiedField, number>
> {
  decision: "VERIFIED" | "REJECTED";
  note?: string;
}

export async function verifyDeclaration(
  id: number,
  body: VerifyDeclarationBody,
): Promise<TaxDeclaration> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TaxDeclaration>(`${DECLARATIONS}/${id}/verify`, body),
  );
  return data;
}

export async function listMyDeclarations(): Promise<TaxDeclaration[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaxDeclaration[]>("/self-service/tax-declarations"),
  );
  return data;
}

export async function saveMyDeclaration(
  financialYear: string,
  body: SaveDeclarationBody,
): Promise<TaxDeclaration> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<TaxDeclaration>(
      `/self-service/tax-declarations/${financialYear}`,
      body,
    ),
  );
  return data;
}

/** Form 16 Part B — HR (by employee) or the caller's own. */
export async function getForm16(
  financialYear: string,
  employeeId: number | null,
): Promise<Form16> {
  const path =
    employeeId === null
      ? `/self-service/form16/${financialYear}`
      : `${DECLARATIONS}/form16/${employeeId}/${financialYear}`;
  const { data } = await withAuthRetry(() => apiClient.get<Form16>(path));
  return data;
}

export function downloadForm16(
  financialYear: string,
  employeeId: number | null,
): Promise<Blob> {
  const path =
    employeeId === null
      ? `/self-service/form16/${financialYear}/pdf`
      : `${DECLARATIONS}/form16/${employeeId}/${financialYear}/pdf`;
  return withAuthRetry(() => apiClient.download(path));
}

// ---- loan approval & prepayments (§3.7) ----------------------------------------

/** The employee's own request (the employee is always the caller). */
export async function requestMyLoan(
  body: Omit<CreateLoanBody, "employeeId">,
): Promise<Loan> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Loan>("/self-service/loans", body),
  );
  return data;
}

/** The HR step: forward for final approval, or reject (note required). */
export async function reviewLoan(
  id: number,
  body: { decision: "FORWARD" | "REJECT"; note?: string },
): Promise<Loan> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Loan>(`${LOANS}/${id}/review`, body),
  );
  return data;
}

export async function decideLoan(
  id: number,
  body: { decision: "APPROVED" | "REJECTED"; note?: string },
): Promise<Loan> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Loan>(`${LOANS}/${id}/decide`, body),
  );
  return data;
}

export interface LoanPrepaymentBody {
  amount: number;
  receivedOn: string;
  reference?: string | undefined;
  reason: string;
}

export async function requestLoanPrepayment(
  loanId: number,
  body: LoanPrepaymentBody,
): Promise<unknown> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<unknown>(`${LOANS}/${loanId}/prepayments`, body),
  );
  return data;
}

export async function decideLoanPrepayment(
  id: number,
  decision: "APPROVED" | "REJECTED",
): Promise<Loan> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Loan>(`${LOANS}/prepayments/${id}/decide`, { decision }),
  );
  return data;
}

// ---- statutory bonus & gratuity (§3.9) -----------------------------------------

export async function calculateStatutoryBonus(body: {
  financialYear: string;
  create?: boolean;
}): Promise<StatutoryBonusResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<StatutoryBonusResult>(`${BONUSES}/statutory`, body),
  );
  return data;
}

export async function getGratuity(
  employeeId: number,
  asOf?: string,
): Promise<GratuityResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<GratuityResult>(`${BONUSES}/gratuity/${employeeId}`, {
      query: asOf ? { asOf } : {},
    }),
  );
  return data;
}

export async function createGratuity(body: {
  employeeId: number;
  asOf: string;
  payrollPeriodId?: number | undefined;
}): Promise<Bonus> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Bonus>(`${BONUSES}/gratuity`, body),
  );
  return data;
}
