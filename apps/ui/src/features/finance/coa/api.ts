import type {
  CreateFinanceAccountInput,
  FinanceAccount,
  FinanceAccountTreeNode,
  PaginatedEnvelope,
  QueryFinanceAccountsInput,
  UpdateFinanceAccountInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of accounts with optional search and type filters. */
export function listAccounts(
  query: QueryFinanceAccountsInput = {},
): Promise<PaginatedEnvelope<FinanceAccount>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceAccount[]>("/finance/accounts", { query }),
  ) as Promise<PaginatedEnvelope<FinanceAccount>>;
}

/** Fetch full hierarchical tree of Chart of Accounts. */
export async function getAccountTree(): Promise<FinanceAccountTreeNode[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceAccountTreeNode[]>("/finance/accounts/tree"),
  );
  return data;
}

/** Fetch a single account by ID. */
export async function getAccount(id: number): Promise<FinanceAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceAccount>(`/finance/accounts/${id}`),
  );
  return data;
}

/** Create a new account in Chart of Accounts. */
export async function createAccount(
  input: CreateFinanceAccountInput,
): Promise<FinanceAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceAccount>("/finance/accounts", input),
  );
  return data;
}

/** Update an existing account. */
export async function updateAccount(
  id: number,
  input: UpdateFinanceAccountInput,
): Promise<FinanceAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinanceAccount>(`/finance/accounts/${id}`, input),
  );
  return data;
}

/** Soft-delete / deactivate an account. */
export async function deleteAccount(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/finance/accounts/${id}`));
}
