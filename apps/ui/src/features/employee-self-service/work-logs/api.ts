import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface MyWorkLog {
  id: number;
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
  status: string;
}

export interface CreateWorkLogInput {
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
}

export async function listMyWorkLogs(): Promise<MyWorkLog[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyWorkLog[]>("/self-service/work-logs", {
      query: { limit: 50 },
    }),
  );
  return data;
}

export async function createMyWorkLog(
  input: CreateWorkLogInput,
): Promise<MyWorkLog> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyWorkLog>("/self-service/work-logs", input),
  );
  return data;
}
