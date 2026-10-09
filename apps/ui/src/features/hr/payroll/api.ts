import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  Bonus,
  BonusType,
  ComplianceKind,
  ContributionPaymentStatus,
  DecisionStatus,
  EsiContribution,
  EsiProfile,
  Loan,
  LoanStatus,
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
