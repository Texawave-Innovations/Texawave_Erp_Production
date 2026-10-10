import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface MyTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  priority: string;
  status: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | undefined;
  dueDate: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
}

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const;

export async function listMyTasks(): Promise<MyTask[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyTask[]>("/self-service/tasks", { query: { limit: 50 } }),
  );
  return data;
}

export async function createMyTask(input: CreateTaskInput): Promise<MyTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyTask>("/self-service/tasks", input),
  );
  return data;
}

export async function updateMyTaskStatus(
  id: number,
  status: (typeof TASK_STATUSES)[number],
): Promise<MyTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyTask>(`/self-service/tasks/${id}/status`, { status }),
  );
  return data;
}
