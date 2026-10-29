import type {
  CreateFinanceBankAccountInput,
  CreateFinanceBankTransactionInput,
  FinanceBankAccount,
  FinanceBankTransaction,
  PaginatedEnvelope,
  QueryFinanceBankAccountsInput,
  QueryFinanceBankTransactionsInput,
  ReconcileBankTransactionInput,
  UpdateFinanceBankAccountInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of company bank accounts with optional filters. */
export function listBankAccounts(
  query: QueryFinanceBankAccountsInput = {},
): Promise<PaginatedEnvelope<FinanceBankAccount>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceBankAccount[]>("/finance/bank-accounts", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinanceBankAccount>>;
}

/** Fetch a single bank account by ID including linked GL account. */
export async function getBankAccount(id: number): Promise<FinanceBankAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceBankAccount>(`/finance/bank-accounts/${id}`),
  );
  return data;
}

/** Register a new company bank account. */
export async function createBankAccount(
  input: CreateFinanceBankAccountInput,
): Promise<FinanceBankAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceBankAccount>("/finance/bank-accounts", input),
  );
  return data;
}

/** Update bank account details (name, bank, routing, linked GL account, active status). */
export async function updateBankAccount(
  id: number,
  input: UpdateFinanceBankAccountInput,
): Promise<FinanceBankAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinanceBankAccount>(`/finance/bank-accounts/${id}`, input),
  );
  return data;
}

/** Soft-delete a bank account (blocked if transactions exist). */
export async function deleteBankAccount(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/finance/bank-accounts/${id}`),
  );
}

/** Fetch paginated list of bank transactions with filters (account, type, dates, reconciliation). */
export function listBankTransactions(
  query: QueryFinanceBankTransactionsInput = {},
): Promise<PaginatedEnvelope<FinanceBankTransaction>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceBankTransaction[]>("/finance/bank-transactions", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinanceBankTransaction>>;
}

/** Fetch a single bank transaction by ID including bank account and matched GL voucher. */
export async function getBankTransaction(
  id: number,
): Promise<FinanceBankTransaction> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceBankTransaction>(`/finance/bank-transactions/${id}`),
  );
  return data;
}

/** Record a bank transaction (atomically updates account balance and optional GL double entry). */
export async function createBankTransaction(
  input: CreateFinanceBankTransactionInput,
): Promise<FinanceBankTransaction> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceBankTransaction>("/finance/bank-transactions", input),
  );
  return data;
}

/** Mark a bank transaction as reconciled. */
export async function reconcileBankTransaction(
  id: number,
  input: ReconcileBankTransactionInput = {},
): Promise<FinanceBankTransaction> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceBankTransaction>(
      `/finance/bank-transactions/${id}/reconcile`,
      input,
    ),
  );
  return data;
}

/** Unmark a bank transaction as reconciled. */
export async function unreconcileBankTransaction(
  id: number,
): Promise<FinanceBankTransaction> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceBankTransaction>(
      `/finance/bank-transactions/${id}/unreconcile`,
    ),
  );
  return data;
}
