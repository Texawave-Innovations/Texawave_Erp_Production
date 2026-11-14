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
