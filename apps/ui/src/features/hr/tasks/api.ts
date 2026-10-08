import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { TaskItem, TaskPriority, TaskStatus } from "./types";

export interface TaskListQuery {
  page: number;
  limit: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  q?: string;
  assigneeId?: number;
  awaitingApproval?: boolean;
  overdue?: boolean;
}

const BASE = "/hr/tasks";

export function listTasks(
  query: TaskListQuery,
): Promise<PaginatedEnvelope<TaskItem>> {
  return withAuthRetry(() =>
    apiClient.get<TaskItem[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<TaskItem>>;
}

export async function getTask(id: number): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaskItem>(`${BASE}/${id}`),
  );
  return data;
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  assigneeId: number;
  dueDate: string;
  priority?: TaskPriority;
}

export async function createTask(body: CreateTaskBody): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TaskItem>(BASE, body),
  );
  return data;
}

export async function reassignTask(
  id: number,
  assigneeId: number,
): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<TaskItem>(`${BASE}/${id}`, { assigneeId }),
  );
  return data;
}

export async function setTaskStatus(
  id: number,
  status: TaskStatus,
): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TaskItem>(`${BASE}/${id}/status`, { status }),
  );
  return data;
}

export async function approveTask(id: number): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TaskItem>(`${BASE}/${id}/approve`, {}),
  );
  return data;
}

export async function reopenTask(id: number): Promise<TaskItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TaskItem>(`${BASE}/${id}/reopen`, {}),
  );
  return data;
}
