import type { CrmSearchResponse } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrapper around the shared `apiClient` — route confirmed from
 * apps/api/src/modules/crm/search/search.controller.ts. */
export async function searchCrm(q: string): Promise<CrmSearchResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmSearchResponse>("/crm/search", { query: { q } }),
  );
  return data;
}
