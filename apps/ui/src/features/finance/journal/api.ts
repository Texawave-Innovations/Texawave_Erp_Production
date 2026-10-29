import type {
  CreateFinanceJournalEntryInput,
  FinanceJournalEntry,
  GeneralLedgerAccountReport,
  PaginatedEnvelope,
  QueryFinanceJournalEntriesInput,
  QueryGeneralLedgerInput,
  ReverseJournalEntryInput,
  UpdateFinanceJournalEntryInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of journal vouchers with optional filters. */
export function listJournalEntries(
  query: QueryFinanceJournalEntriesInput = {},
): Promise<PaginatedEnvelope<FinanceJournalEntry>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceJournalEntry[]>("/finance/journal-entries", { query }),
  ) as Promise<PaginatedEnvelope<FinanceJournalEntry>>;
}

/** Fetch a single journal voucher by ID with all lines and accounts. */
export async function getJournalEntry(
  id: number,
): Promise<FinanceJournalEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceJournalEntry>(`/finance/journal-entries/${id}`),
  );
  return data;
}

/** Create a new draft journal voucher with double-entry lines. */
export async function createJournalEntry(
  input: CreateFinanceJournalEntryInput,
): Promise<FinanceJournalEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceJournalEntry>("/finance/journal-entries", input),
  );
  return data;
}

/** Update an existing draft journal voucher. */
export async function updateJournalEntry(
  id: number,
  input: UpdateFinanceJournalEntryInput,
): Promise<FinanceJournalEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinanceJournalEntry>(
      `/finance/journal-entries/${id}`,
      input,
    ),
  );
  return data;
}

/** Post a draft journal voucher, synchronizing account ledger balances. */
export async function postJournalEntry(
  id: number,
): Promise<FinanceJournalEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceJournalEntry>(`/finance/journal-entries/${id}/post`),
  );
  return data;
}

/** Reverse a posted journal voucher, restoring account balances. */
export async function reverseJournalEntry(
  id: number,
  input: ReverseJournalEntryInput = {},
): Promise<FinanceJournalEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceJournalEntry>(
      `/finance/journal-entries/${id}/reverse`,
      input,
    ),
  );
  return data;
}

/** Delete a draft journal voucher. */
export async function deleteJournalEntry(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/finance/journal-entries/${id}`),
  );
}

/** Fetch account-level General Ledger statement with running balances. */
export async function getGeneralLedger(
  query: QueryGeneralLedgerInput = {},
): Promise<GeneralLedgerAccountReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<GeneralLedgerAccountReport>(
      "/finance/reports/general-ledger",
      { query },
    ),
  );
  return data;
}
