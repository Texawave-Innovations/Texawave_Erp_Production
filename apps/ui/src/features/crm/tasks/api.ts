import type {
  CreateCrmTaskInput,
  CrmTask,
  PaginatedEnvelope,
  QueryCrmTasksInput,
  UpdateCrmTaskInput,
  UpdateCrmTaskStatusInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Tasks tab
 * (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/tasks/tasks.controller.ts. */
export function listCrmTasks(
  query: QueryCrmTasksInput,
): Promise<PaginatedEnvelope<CrmTask>> {
  return withAuthRetry(() =>
    apiClient.get<CrmTask[]>("/crm/tasks", { query }),
  ) as Promise<PaginatedEnvelope<CrmTask>>;
}

export async function getCrmTask(id: number): Promise<CrmTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmTask>(`/crm/tasks/${id}`),
  );
  return data;
}

export async function createCrmTask(
  input: CreateCrmTaskInput,
): Promise<CrmTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmTask>("/crm/tasks", input),
  );
  return data;
}

export async function updateCrmTask(
  id: number,
  input: UpdateCrmTaskInput,
): Promise<CrmTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmTask>(`/crm/tasks/${id}`, input),
  );
  return data;
}

export async function updateCrmTaskStatus(
  id: number,
  input: UpdateCrmTaskStatusInput,
): Promise<CrmTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmTask>(`/crm/tasks/${id}/status`, input),
  );
  return data;
}

export async function deleteCrmTask(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/tasks/${id}`));
}
