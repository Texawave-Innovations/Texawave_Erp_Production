import type {
  CreateCrmActivityInput,
  CrmActivity,
  PaginatedEnvelope,
  QueryCrmActivitiesInput,
  UpdateCrmActivityInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Activities
 * tab (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/activities/activities.controller.ts. */
export function listActivities(
  query: QueryCrmActivitiesInput,
): Promise<PaginatedEnvelope<CrmActivity>> {
  return withAuthRetry(() =>
    apiClient.get<CrmActivity[]>("/crm/activities", { query }),
  ) as Promise<PaginatedEnvelope<CrmActivity>>;
}

export async function getActivity(id: number): Promise<CrmActivity> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmActivity>(`/crm/activities/${id}`),
  );
  return data;
}

export async function createActivity(
  input: CreateCrmActivityInput,
): Promise<CrmActivity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmActivity>("/crm/activities", input),
  );
  return data;
}

export async function updateActivity(
  id: number,
  input: UpdateCrmActivityInput,
): Promise<CrmActivity> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmActivity>(`/crm/activities/${id}`, input),
  );
  return data;
}

export async function deleteActivity(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/activities/${id}`));
}
