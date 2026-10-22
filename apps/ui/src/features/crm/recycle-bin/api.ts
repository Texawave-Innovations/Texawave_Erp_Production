import type {
  CrmRecycleBinEntityType,
  CrmRecycleBinItem,
  CrmRecycleBinSummary,
  PaginatedEnvelope,
  QueryCrmRecycleBinInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Routes confirmed from
 * apps/api/src/modules/crm/recycle-bin/recycle-bin.controller.ts. */
export function listRecycleBin(
  query: QueryCrmRecycleBinInput,
): Promise<PaginatedEnvelope<CrmRecycleBinItem>> {
  return withAuthRetry(() =>
    apiClient.get<CrmRecycleBinItem[]>("/crm/recycle-bin", { query }),
  ) as Promise<PaginatedEnvelope<CrmRecycleBinItem>>;
}

export async function getRecycleBinSummary(): Promise<CrmRecycleBinSummary> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmRecycleBinSummary>("/crm/recycle-bin/summary"),
  );
  return data;
}

export async function restoreRecycleBinItem(
  entityType: CrmRecycleBinEntityType,
  id: number,
): Promise<void> {
  await withAuthRetry(() =>
    apiClient.post<unknown>(`/crm/recycle-bin/${entityType}/${id}/restore`),
  );
}

export async function purgeRecycleBinItem(
  entityType: CrmRecycleBinEntityType,
  id: number,
): Promise<void> {
  await withAuthRetry(() =>
    apiClient.post<unknown>(`/crm/recycle-bin/${entityType}/${id}/purge`, {
      confirm: true,
    }),
  );
}
