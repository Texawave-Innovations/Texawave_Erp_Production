import type {
  CreateDepartmentInput,
  Department,
  PaginatedEnvelope,
  QueryDepartmentsInput,
  UpdateDepartmentInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export function listDepartments(
  query: QueryDepartmentsInput = {},
): Promise<PaginatedEnvelope<Department>> {
  return withAuthRetry(() =>
    apiClient.get<Department[]>("/departments", { query }),
  ) as Promise<PaginatedEnvelope<Department>>;
}

export async function getDepartment(id: number): Promise<Department> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Department>(`/departments/${id}`),
  );
  return data;
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Department>("/departments", input),
  );
  return data;
}

export async function updateDepartment(
  id: number,
  input: UpdateDepartmentInput,
): Promise<Department> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Department>(`/departments/${id}`, input),
  );
  return data;
}

export async function deleteDepartment(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/departments/${id}`));
}
