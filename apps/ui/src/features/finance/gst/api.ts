import type {
  CounterpartGstEntryInput,
  CreateFinanceGstEntryInput,
  FinanceGstEntry,
  FinanceGstEntryType,
  FinanceGstReconciliationResult,
  FinanceGstr1SummaryReport,
  FinanceGstr3bSummaryReport,
  FinanceHsnSummaryReport,
  PaginatedEnvelope,
  QueryFinanceGstEntriesInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface FinanceGstPeriodReconciliationSummary {
  period: string;
  totalEntries: number;
  reconciledCount: number;
  pendingCount: number;
  totalItcAmount: number;
  reconciledItcAmount: number;
  reconciliationPercentage: number;
  generatedAt: string;
}

export interface ReconcileGstInput {
  period: string;
  persistReconciliation?: boolean;
  counterpartEntries: CounterpartGstEntryInput[];
}

/** Fetch paginated list of GST entries with period, entryType, status, and search filters. */
export function listGstEntries(
  query: QueryFinanceGstEntriesInput = {},
): Promise<PaginatedEnvelope<FinanceGstEntry>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceGstEntry[]>("/finance/gst/entries", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinanceGstEntry>>;
}

/** Fetch a single GST entry by ID. */
export async function getGstEntry(id: number): Promise<FinanceGstEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceGstEntry>(`/finance/gst/entries/${id}`),
  );
  return data;
}

/** Record a new GST entry (outward liability or inward input tax credit). */
export async function createGstEntry(
  input: CreateFinanceGstEntryInput,
): Promise<FinanceGstEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceGstEntry>("/finance/gst/entries", input),
  );
  return data;
}

/** Fetch GSTR-1 Outward Tax Summary Report for a period. */
export async function getGstr1Summary(
  period: string,
): Promise<FinanceGstr1SummaryReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceGstr1SummaryReport>(
      "/finance/gst/reports/gstr1-summary",
      {
        query: { period },
      },
    ),
  );
  return data;
}

/** Fetch GSTR-3B Net Tax Payable Summary Report for a period. */
export async function getGstr3bSummary(
  period: string,
): Promise<FinanceGstr3bSummaryReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceGstr3bSummaryReport>(
      "/finance/gst/reports/gstr3b-summary",
      {
        query: { period },
      },
    ),
  );
  return data;
}

/** Fetch HSN/SAC summary aggregation report for outward or inward supplies. */
export async function getHsnSummary(query: {
  period?: string;
  startDate?: string;
  endDate?: string;
  entryType?: FinanceGstEntryType;
}): Promise<FinanceHsnSummaryReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceHsnSummaryReport>("/finance/gst/reports/hsn-summary", {
      query,
    }),
  );
  return data;
}

/** Reconcile ERP purchase books against GSTR-2B filing counterpart entries. */
export async function reconcileGst(
  input: ReconcileGstInput,
): Promise<FinanceGstReconciliationResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceGstReconciliationResult>(
      "/finance/gst/reconciliation",
      input,
    ),
  );
  return data;
}

/** Fetch period reconciliation summary metrics and percentage. */
export async function getGstReconciliationSummary(
  period: string,
): Promise<FinanceGstPeriodReconciliationSummary> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceGstPeriodReconciliationSummary>(
      "/finance/gst/reconciliation/summary",
      {
        query: { period },
      },
    ),
  );
  return data;
}
