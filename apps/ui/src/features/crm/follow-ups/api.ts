import type {
  CreateFollowUpInput,
  FollowUp,
  PaginatedEnvelope,
  QueryFollowUpsInput,
  RescheduleFollowUpInput,
  UpdateFollowUpInput,
  UpdateFollowUpStatusInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Follow-ups
 * tab (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/follow-ups/follow-ups.controller.ts. */
export function listFollowUps(
  query: QueryFollowUpsInput,
): Promise<PaginatedEnvelope<FollowUp>> {
  return withAuthRetry(() =>
    apiClient.get<FollowUp[]>("/crm/follow-ups", { query }),
  ) as Promise<PaginatedEnvelope<FollowUp>>;
}

export async function getFollowUp(id: number): Promise<FollowUp> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FollowUp>(`/crm/follow-ups/${id}`),
  );
  return data;
}

export async function createFollowUp(
  input: CreateFollowUpInput,
): Promise<FollowUp> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FollowUp>("/crm/follow-ups", input),
  );
  return data;
}

export async function updateFollowUp(
  id: number,
  input: UpdateFollowUpInput,
): Promise<FollowUp> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FollowUp>(`/crm/follow-ups/${id}`, input),
  );
  return data;
}

export async function updateFollowUpStatus(
  id: number,
  input: UpdateFollowUpStatusInput,
): Promise<FollowUp> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FollowUp>(`/crm/follow-ups/${id}/status`, input),
  );
  return data;
}

export async function rescheduleFollowUp(
  id: number,
  input: RescheduleFollowUpInput,
): Promise<FollowUp> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FollowUp>(`/crm/follow-ups/${id}/reschedule`, input),
  );
  return data;
}

export async function deleteFollowUp(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/follow-ups/${id}`));
}
