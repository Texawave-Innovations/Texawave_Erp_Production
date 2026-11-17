import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { PaginationMeta } from "@texawave-erp/api-types";

export interface WorkPermission {
  id: number;
  date: string;
  fromTime: string;
  toTime: string;
  durationMins: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hrNote: string | null;
  createdAt: string;
  employee: { id: number; employeeCode: string; fullName: string };
  requester: { id: number; fullName: string };
  decider: { id: number; fullName: string } | null;
}

export interface CreateWorkPermissionInput {
  date: string;
  fromTime: string;
  toTime: string;
  reason: string;
}

export interface WorkPermissionsResult {
  items: WorkPermission[];
  meta: PaginationMeta;
}

export async function listMyWorkPermissions(
  year?: number,
): Promise<WorkPermissionsResult> {
  const envelope = await withAuthRetry(() =>
    apiClient.get<WorkPermission[]>("/self-service/work-permissions", {
      query: { limit: 50, ...(year ? { year } : {}) },
    }),
  );
  return {
    items: envelope.data,
    meta: envelope.meta ?? { page: 1, limit: 50, total: 0, totalPages: 0 },
  };
}

export async function createMyWorkPermission(
  input: CreateWorkPermissionInput,
): Promise<WorkPermission> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkPermission>("/self-service/work-permissions", input),
  );
  return data;
}

export interface ListAllWorkPermissionsInput {
  status?: string;
  year?: number;
  page?: number;
  limit?: number;
}

export async function listAllWorkPermissions(
  input: ListAllWorkPermissionsInput = {},
): Promise<WorkPermissionsResult> {
  const envelope = await withAuthRetry(() =>
    apiClient.get<WorkPermission[]>("/hr/work-permissions", {
      query: {
        limit: input.limit ?? 20,
        page: input.page ?? 1,
        ...(input.status ? { status: input.status } : {}),
        ...(input.year ? { year: input.year } : {}),
      },
    }),
  );
  return {
    items: envelope.data,
    meta: envelope.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

export async function decideWorkPermission(
  id: number,
  decision: "APPROVED" | "REJECTED",
  hrNote?: string,
): Promise<WorkPermission> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<WorkPermission>(`/hr/work-permissions/${id}/decide`, {
      decision,
      hrNote,
    }),
  );
  return data;
}
