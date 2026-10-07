import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  DayPortion,
  LeaveBalanceItem,
  LeaveRequestItem,
  LeaveStatus,
} from "./types";

const HR_BASE = "/hr/leave-requests";
const SELF_SERVICE_BASE = "/self-service/leave-requests";

export interface LeaveListQuery {
  page: number;
  limit: number;
  status?: LeaveStatus;
  leaveTypeId?: number;
  from?: string;
  to?: string;
  employeeId?: number;
}

/** HR/approver surface: own/team/all, scoped server-side against
 * `hr.leave_request.read`. Also doubles as an employee's leave history when
 * `employeeId` is given (still within the caller's scope). */
export function listLeaveRequests(
  query: LeaveListQuery,
): Promise<PaginatedEnvelope<LeaveRequestItem>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveRequestItem[]>(HR_BASE, { query }),
  ) as Promise<PaginatedEnvelope<LeaveRequestItem>>;
}

export async function getLeaveRequest(id: number): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<LeaveRequestItem>(`${HR_BASE}/${id}`),
  );
  return data;
}

export interface DecideLeaveBody {
  note?: string;
}

export async function approveLeaveRequest(
  id: number,
  body: DecideLeaveBody,
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(`${HR_BASE}/${id}/approve`, body),
  );
  return data;
}

export async function rejectLeaveRequest(
  id: number,
  body: { note: string },
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(`${HR_BASE}/${id}/reject`, body),
  );
  return data;
}

export function hrLeaveBalances(
  employeeId: number,
  year?: number,
): Promise<LeaveBalanceItem[]> {
  return withAuthRetry(() =>
    apiClient.get<LeaveBalanceItem[]>(`${HR_BASE}/balances`, {
      query: { employeeId, ...(year ? { year } : {}) },
    }),
  ).then((r) => r.data);
}

// ---- self-service (the authenticated user's own leave) --------------------

export function listMyLeaveRequests(
  query: Omit<LeaveListQuery, "employeeId">,
): Promise<PaginatedEnvelope<LeaveRequestItem>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveRequestItem[]>(SELF_SERVICE_BASE, { query }),
  ) as Promise<PaginatedEnvelope<LeaveRequestItem>>;
}

export function myLeaveBalances(year?: number): Promise<LeaveBalanceItem[]> {
  return withAuthRetry(() =>
    apiClient.get<LeaveBalanceItem[]>(`${SELF_SERVICE_BASE}/balances`, {
      query: year ? { year } : {},
    }),
  ).then((r) => r.data);
}

export interface CreateLeaveRequestBody {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  dayPortion?: DayPortion;
  reason: string;
}

export async function createMyLeaveRequest(
  body: CreateLeaveRequestBody,
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(SELF_SERVICE_BASE, body),
  );
  return data;
}

export async function cancelMyLeaveRequest(
  id: number,
  body: { note?: string },
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(`${SELF_SERVICE_BASE}/${id}/cancel`, body),
  );
  return data;
}

export async function resubmitMyLeaveRequest(
  id: number,
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(`${SELF_SERVICE_BASE}/${id}/resubmit`, {}),
  );
  return data;
}
