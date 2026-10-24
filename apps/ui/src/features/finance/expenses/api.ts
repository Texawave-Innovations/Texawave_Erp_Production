import type {
  CreateExpenseFromClaimInput,
  CreateFinanceExpenseInput,
  FinanceBankAccount,
  FinanceExpense,
  PaginatedEnvelope,
  QueryFinanceExpensesInput,
  RecordExpensePaymentInput,
  UpdateFinanceExpenseInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of operational expenses with optional category, date, or status filters. */
export function listExpenses(
  query: QueryFinanceExpensesInput = {},
): Promise<PaginatedEnvelope<FinanceExpense>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceExpense[]>("/finance/expenses", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinanceExpense>>;
}

/** Fetch a single expense record by ID with category, bank account, and GL journal links. */
export async function getExpense(id: number): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceExpense>(`/finance/expenses/${id}`),
  );
  return data;
}

/** Record an operating expense (DRAFT or immediate PAID). */
export async function createExpense(
  input: CreateFinanceExpenseInput,
): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>("/finance/expenses", input),
  );
  return data;
}

/** Update an editable expense record (DRAFT or PENDING_APPROVAL). */
export async function updateExpense(
  id: number,
  input: UpdateFinanceExpenseInput,
): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinanceExpense>(`/finance/expenses/${id}`, input),
  );
  return data;
}

/** Submit a DRAFT expense for manager approval. */
export async function submitExpense(id: number): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(`/finance/expenses/${id}/submit`),
  );
  return data;
}

/** Approve a PENDING_APPROVAL expense. */
export async function approveExpense(id: number): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(`/finance/expenses/${id}/approve`),
  );
  return data;
}

/** Reject a PENDING_APPROVAL expense back to DRAFT. */
export async function rejectExpense(id: number): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(`/finance/expenses/${id}/reject`),
  );
  return data;
}

/** Disburse payment for an expense and atomically post double-entry GL journal. */
export async function payExpense(
  id: number,
  input: RecordExpensePaymentInput,
): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(`/finance/expenses/${id}/pay`, input),
  );
  return data;
}

/** Cancel an expense (atomically creates GL reversal voucher if already paid). */
export async function cancelExpense(id: number): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(`/finance/expenses/${id}/cancel`),
  );
  return data;
}

/** Convert an approved HR Expense Claim into a Finance operating expense. */
export async function createExpenseFromClaim(
  claimId: number,
  input: CreateExpenseFromClaimInput,
): Promise<FinanceExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceExpense>(
      `/finance/expenses/from-claim/${claimId}`,
      input,
    ),
  );
  return data;
}

/** Soft delete a DRAFT or CANCELLED expense. */
export async function deleteExpense(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/finance/expenses/${id}`));
}

/** Fetch active company bank accounts for payment disbursement. */
export async function listActiveBankAccounts(): Promise<FinanceBankAccount[]> {
  const res = (await withAuthRetry(() =>
    apiClient.get<FinanceBankAccount[]>("/finance/bank-accounts", {
      query: { limit: 100, isActive: true },
    }),
  )) as unknown as PaginatedEnvelope<FinanceBankAccount>;
  return res?.data ?? [];
}
