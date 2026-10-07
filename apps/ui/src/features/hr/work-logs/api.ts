import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { WorkLogItem, WorkLogStatus } from "./types";

export interface WorkLogListQuery {
  page: number;
  limit: number;
  status?: WorkLogStatus;
  from?: string;
  to?: string;
  employeeId?: number;
}

const HR_BASE = "/hr/work-logs";
const SELF_SERVICE_BASE = "/self-service/work-logs";

export function listWorkLogs(
  query: WorkLogListQuery,
): Promise<PaginatedEnvelope<WorkLogItem>> {
  return withAuthRetry(() =>
    apiClient.get<WorkLogItem[]>(HR_BASE, { query }),
  ) as Promise<PaginatedEnvelope<WorkLogItem>>;
}

/** The approver's queue — the caller's direct reports, defaults to PENDING. */
export function listWorkLogApprovals(
  query: Omit<WorkLogListQuery, "employeeId">,
): Promise<PaginatedEnvelope<WorkLogItem>> {
  return withAuthRetry(() =>
    apiClient.get<WorkLogItem[]>(`${HR_BASE}/approvals`, { query }),
  ) as Promise<PaginatedEnvelope<WorkLogItem>>;
}

export async function getWorkLog(id: number): Promise<WorkLogItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<WorkLogItem>(`${HR_BASE}/${id}`),
  );
  return data;
}

export interface DecideWorkLogBody {
  note?: string;
}

export async function approveWorkLog(
  id: number,
  body: DecideWorkLogBody,
): Promise<WorkLogItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkLogItem>(`${HR_BASE}/${id}/approve`, body),
  );
  return data;
}

export async function rejectWorkLog(
  id: number,
  body: DecideWorkLogBody,
): Promise<WorkLogItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkLogItem>(`${HR_BASE}/${id}/reject`, body),
  );
  return data;
}

/** The authenticated user's own logs. */
export function listMyWorkLogs(
  query: Omit<WorkLogListQuery, "employeeId">,
): Promise<PaginatedEnvelope<WorkLogItem>> {
  return withAuthRetry(() =>
    apiClient.get<WorkLogItem[]>(SELF_SERVICE_BASE, { query }),
  ) as Promise<PaginatedEnvelope<WorkLogItem>>;
}

export interface CreateWorkLogBody {
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
}

export async function createMyWorkLog(
  body: CreateWorkLogBody,
): Promise<WorkLogItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkLogItem>(SELF_SERVICE_BASE, body),
  );
  return data;
}
