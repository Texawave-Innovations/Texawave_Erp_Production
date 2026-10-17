import type {
  AddOpportunityProductsInput,
  ChangeStageInput,
  CreateOpportunityInput,
  MarkLostInput,
  MarkWonInput,
  Opportunity,
  OpportunityProduct,
  OpportunityStageHistoryEntry,
  PaginatedEnvelope,
  QueryOpportunitiesInput,
  ReopenInput,
  SetOnHoldInput,
  SetStuckReasonInput,
  UpdateOpportunityInput,
  UpdateOpportunityProductInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/leads/api.ts. Migrated from the LIVE legacy
 * TexaWave_ERP/src/modules/crm/Pipeline.tsx +
 * domain/opportunitiesService.ts. */
export function listOpportunities(
  query: QueryOpportunitiesInput,
): Promise<PaginatedEnvelope<Opportunity>> {
  return withAuthRetry(() =>
    apiClient.get<Opportunity[]>("/crm/opportunities", { query }),
  ) as Promise<PaginatedEnvelope<Opportunity>>;
}

export async function getOpportunity(id: number): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Opportunity>(`/crm/opportunities/${id}`),
  );
  return data;
}

export async function getStageHistory(
  id: number,
): Promise<OpportunityStageHistoryEntry[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OpportunityStageHistoryEntry[]>(
      `/crm/opportunities/${id}/stage-history`,
    ),
  );
  return data;
}

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>("/crm/opportunities", input),
  );
  return data;
}

export async function updateOpportunity(
  id: number,
  input: UpdateOpportunityInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Opportunity>(`/crm/opportunities/${id}`, input),
  );
  return data;
}

export async function changeOpportunityStage(
  id: number,
  input: ChangeStageInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>(`/crm/opportunities/${id}/stage`, input),
  );
  return data;
}

export async function markOpportunityWon(
  id: number,
  input: MarkWonInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>(`/crm/opportunities/${id}/won`, input),
  );
  return data;
}

export async function markOpportunityLost(
  id: number,
  input: MarkLostInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>(`/crm/opportunities/${id}/lost`, input),
  );
  return data;
}

export async function setOpportunityOnHold(
  id: number,
  input: SetOnHoldInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>(`/crm/opportunities/${id}/on-hold`, input),
  );
  return data;
}

export async function reopenOpportunity(
  id: number,
  input: ReopenInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Opportunity>(`/crm/opportunities/${id}/reopen`, input),
  );
  return data;
}

export async function setOpportunityStuckReason(
  id: number,
  input: SetStuckReasonInput,
): Promise<Opportunity> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Opportunity>(
      `/crm/opportunities/${id}/stuck-reason`,
      input,
    ),
  );
  return data;
}

export async function deleteOpportunity(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/opportunities/${id}`));
}

export async function listOpportunityProducts(
  opportunityId: number,
): Promise<OpportunityProduct[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OpportunityProduct[]>(
      `/crm/opportunities/${opportunityId}/products`,
    ),
  );
  return data;
}

export async function addOpportunityProducts(
  opportunityId: number,
  input: AddOpportunityProductsInput,
): Promise<OpportunityProduct[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<OpportunityProduct[]>(
      `/crm/opportunities/${opportunityId}/products`,
      input,
    ),
  );
  return data;
}

export async function updateOpportunityProduct(
  opportunityId: number,
  itemId: number,
  input: UpdateOpportunityProductInput,
): Promise<OpportunityProduct> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<OpportunityProduct>(
      `/crm/opportunities/${opportunityId}/products/${itemId}`,
      input,
    ),
  );
  return data;
}

export async function removeOpportunityProduct(
  opportunityId: number,
  itemId: number,
): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(
      `/crm/opportunities/${opportunityId}/products/${itemId}`,
    ),
  );
}
