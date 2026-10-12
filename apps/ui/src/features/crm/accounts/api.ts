import type {
  Account,
  CreateAccountInput,
  PaginatedEnvelope,
  QueryAccountsInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/_reference/tags/api.ts (Docs/CODING_STANDARDS.md
 * "Frontend API/state/error standard"). Minimal CRM Account foundation
 * (Phase 4B): list + create only, no full Account-360 UI. */
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
