import type {
  CreateCrmMiningRowInput,
  CrmMiningRow,
  PaginatedEnvelope,
  QueryCrmMiningRowsInput,
  UpdateCrmMiningRowInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — routes confirmed from
 * apps/api/src/modules/crm/mining-rows/mining-rows.controller.ts. */
export function listMiningRows(
  query: QueryCrmMiningRowsInput,
): Promise<PaginatedEnvelope<CrmMiningRow>> {
  return withAuthRetry(() =>
    apiClient.get<CrmMiningRow[]>("/crm/mining-rows", { query }),
  ) as Promise<PaginatedEnvelope<CrmMiningRow>>;
}

export async function createMiningRow(
  input: CreateCrmMiningRowInput,
): Promise<CrmMiningRow> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmMiningRow>("/crm/mining-rows", input),
  );
  return data;
}

export async function updateMiningRow(
  id: number,
  input: UpdateCrmMiningRowInput,
): Promise<CrmMiningRow> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmMiningRow>(`/crm/mining-rows/${id}`, input),
  );
  return data;
}

export async function promoteMiningRowToLead(
  id: number,
): Promise<CrmMiningRow> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmMiningRow>(`/crm/mining-rows/${id}/promote-to-lead`),
  );
  return data;
}

export async function deleteMiningRow(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/mining-rows/${id}`));
}
