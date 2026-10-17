import type {
  CreateCrmQuotaInput,
  CrmQuota,
  CrmQuotaLiveSummary,
  CrmQuotaLiveSummaryInput,
  PaginatedEnvelope,
  QueryCrmQuotasInput,
  UpdateCrmQuotaInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Routes confirmed from apps/api/src/modules/crm/quotas/quotas.controller.ts. */
export function listQuotas(
  query: QueryCrmQuotasInput,
): Promise<PaginatedEnvelope<CrmQuota>> {
  return withAuthRetry(() =>
    apiClient.get<CrmQuota[]>("/crm/quotas", { query }),
  ) as Promise<PaginatedEnvelope<CrmQuota>>;
}

export async function createQuota(
  input: CreateCrmQuotaInput,
): Promise<CrmQuota> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmQuota>("/crm/quotas", input),
  );
  return data;
}

export async function updateQuota(
  id: number,
  input: UpdateCrmQuotaInput,
): Promise<CrmQuota> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmQuota>(`/crm/quotas/${id}`, input),
  );
  return data;
}

export async function deleteQuota(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/quotas/${id}`));
}

export async function getQuotaLiveSummary(
  input: CrmQuotaLiveSummaryInput,
): Promise<CrmQuotaLiveSummary> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmQuotaLiveSummary>("/crm/quotas/live-summary", input),
  );
  return data;
}
