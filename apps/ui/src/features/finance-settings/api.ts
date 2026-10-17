import type {
  CreateFinanceMasterListItemInput,
  FinanceMasterListItem,
  PaginatedEnvelope,
  QueryFinanceMasterListItemsInput,
  UpdateFinanceMasterListItemInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/sales-settings/api.ts's master-list-items section.
 * One function per endpoint in apps/api/src/modules/finance-settings/.
 */

export function listMasterListItems(
  query: QueryFinanceMasterListItemsInput,
): Promise<PaginatedEnvelope<FinanceMasterListItem>> {
  return withAuthRetry(() =>
    apiClient.get<FinanceMasterListItem[]>(
      "/finance-settings/master-list-items",
      { query },
    ),
  ) as Promise<PaginatedEnvelope<FinanceMasterListItem>>;
}

export async function createMasterListItem(
  input: CreateFinanceMasterListItemInput,
): Promise<FinanceMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinanceMasterListItem>(
      "/finance-settings/master-list-items",
      input,
    ),
  );
  return data;
}

export async function updateMasterListItem(
  id: number,
  input: UpdateFinanceMasterListItemInput,
): Promise<FinanceMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinanceMasterListItem>(
      `/finance-settings/master-list-items/${id}`,
      input,
    ),
  );
  return data;
}

export async function deleteMasterListItem(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/finance-settings/master-list-items/${id}`),
  );
}
