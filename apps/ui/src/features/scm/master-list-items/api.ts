import type {
  CreateScmMasterListItemInput,
  PaginatedEnvelope,
  QueryScmMasterListItemsInput,
  ScmMasterListItem,
  UpdateScmMasterListItemInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/finance-settings/api.ts. One function per endpoint
 * in apps/api/src/modules/scm/master-list-items/.
 */

export function listMasterListItems(
  query: QueryScmMasterListItemsInput,
): Promise<PaginatedEnvelope<ScmMasterListItem>> {
  return withAuthRetry(() =>
    apiClient.get<ScmMasterListItem[]>("/scm/master-list-items", { query }),
  ) as Promise<PaginatedEnvelope<ScmMasterListItem>>;
}

export async function createMasterListItem(
  input: CreateScmMasterListItemInput,
): Promise<ScmMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ScmMasterListItem>("/scm/master-list-items", input),
  );
  return data;
}

export async function updateMasterListItem(
  id: number,
  input: UpdateScmMasterListItemInput,
): Promise<ScmMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ScmMasterListItem>(`/scm/master-list-items/${id}`, input),
  );
  return data;
}

export async function deleteMasterListItem(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/scm/master-list-items/${id}`),
  );
}
