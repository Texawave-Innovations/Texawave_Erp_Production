import type {
  Account,
  ChangeAccountStatusTagInput,
  CreateAccountInput,
  PaginatedEnvelope,
  QueryAccountsInput,
  UpdateAccountInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 (Phase 1A):
 * full CRUD + status-tag change, on top of the Phase 4B list/create
 * foundation. */
export function listAccounts(
  query: QueryAccountsInput,
): Promise<PaginatedEnvelope<Account>> {
  return withAuthRetry(() =>
    apiClient.get<Account[]>("/crm/accounts", { query }),
  ) as Promise<PaginatedEnvelope<Account>>;
}

export async function getAccount(id: number): Promise<Account> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Account>(`/crm/accounts/${id}`),
  );
  return data;
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<Account> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Account>("/crm/accounts", input),
  );
  return data;
}

export async function updateAccount(
  id: number,
  input: UpdateAccountInput,
): Promise<Account> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Account>(`/crm/accounts/${id}`, input),
  );
  return data;
}

export async function changeAccountStatusTag(
  id: number,
  input: ChangeAccountStatusTagInput,
): Promise<Account> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Account>(`/crm/accounts/${id}/status-tag`, input),
  );
  return data;
}

export async function deleteAccount(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/accounts/${id}`));
}
