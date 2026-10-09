import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  PayrollEntry,
  PayrollPeriod,
  PayrollRun,
  PeriodStatus,
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
