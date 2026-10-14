import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { fetchFile } from "@/lib/fetch-file";
import { downloadBlob } from "@/features/hr/payroll/download";
import type {
  DayPortion,
  EmployeeBalanceRow,
  EntitlementImportReport,
  LeaveBalanceItem,
  LeaveDelegationItem,
  LeaveRequestItem,
  LeaveStatus,
  LeaveTypeItem,
} from "./types";

const HR_BASE = "/hr/leave-requests";
const SELF_SERVICE_BASE = "/self-service/leave-requests";
const LEAVE_TYPES_BASE = "/hr/leave-types";
const LEAVE_ENTITLEMENTS_BASE = "/hr/leave-entitlements";
const DELEGATIONS_BASE = "/hr/leave-delegations";

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

// ---- leave type administration (hr.leave_type.read / .write) --------------

export interface LeaveTypeListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export function listLeaveTypes(
  query: LeaveTypeListQuery,
): Promise<PaginatedEnvelope<LeaveTypeItem>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveTypeItem[]>(LEAVE_TYPES_BASE, { query }),
  ) as Promise<PaginatedEnvelope<LeaveTypeItem>>;
}

export interface LeaveTypeBody {
  code?: string;
  name: string;
  description?: string;
  isPaid?: boolean;
  annualEntitlement?: number;
  carryForwardLimit?: number;
  approvalLevels?: number;
}

export async function createLeaveType(
  body: LeaveTypeBody & { code: string },
): Promise<LeaveTypeItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveTypeItem>(LEAVE_TYPES_BASE, body),
  );
  return data;
}

export async function updateLeaveType(
  id: number,
  body: Omit<LeaveTypeBody, "code">,
): Promise<LeaveTypeItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<LeaveTypeItem>(`${LEAVE_TYPES_BASE}/${id}`, body),
  );
  return data;
}

export async function setLeaveTypeActive(
  id: number,
  isActive: boolean,
): Promise<LeaveTypeItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveTypeItem>(
      `${LEAVE_TYPES_BASE}/${id}/${isActive ? "activate" : "deactivate"}`,
      {},
    ),
  );
  return data;
}

// ---- per-employee entitlement overrides (hr.leave_type.write) -------------

/** Mirrors apps/api/.../leave-requests.repository.ts `EntitlementView`. */
export interface EntitlementResult {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  annualEntitlement: number | null;
}

export async function setLeaveEntitlement(
  employeeId: number,
  leaveTypeId: number,
  year: number,
  annualEntitlement: number | null,
): Promise<EntitlementResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<EntitlementResult>(
      `${LEAVE_ENTITLEMENTS_BASE}/${employeeId}/${leaveTypeId}/${year}`,
      { annualEntitlement },
    ),
  );
  return data;
}

// ---- approval queue, HR actions (Docs/HR_LEAVE.md §6.1, §6.4) -------------

export type AwaitingQuery = Omit<LeaveListQuery, "status">;

/** PENDING requests waiting for the caller's decision (reporting line,
 * delegations, approve scope, and HR's second approval). */
export function listAwaitingLeave(
  query: AwaitingQuery,
): Promise<PaginatedEnvelope<LeaveRequestItem>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveRequestItem[]>(`${HR_BASE}/approvals`, { query }),
  ) as Promise<PaginatedEnvelope<LeaveRequestItem>>;
}

export async function createLeaveOnBehalf(
  body: CreateLeaveRequestBody & { employeeId: number },
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(HR_BASE, body),
  );
  return data;
}

export async function hrCancelLeaveRequest(
  id: number,
  body: { note: string },
): Promise<LeaveRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveRequestItem>(`${HR_BASE}/${id}/cancel`, body),
  );
  return data;
}

// ---- export and balance report --------------------------------------------

function toParams(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  return params.toString();
}

export async function exportLeaveRequestsCsv(
  query: Omit<LeaveListQuery, "page" | "limit">,
): Promise<void> {
  const blob = await fetchFile(`${HR_BASE}/export?${toParams({ ...query })}`);
  downloadBlob(
    `leave-requests${query.from ? `-${query.from}` : ""}${query.to ? `-to-${query.to}` : ""}.csv`,
    blob,
  );
}

export interface BalanceReportQuery {
  page: number;
  limit: number;
  year?: number;
  teamId?: number;
  search?: string;
}

export function leaveBalanceReport(
  query: BalanceReportQuery,
): Promise<PaginatedEnvelope<EmployeeBalanceRow>> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeBalanceRow[]>(`${HR_BASE}/balances/report`, {
      query,
    }),
  ) as Promise<PaginatedEnvelope<EmployeeBalanceRow>>;
}

export async function exportLeaveBalancesCsv(
  query: Omit<BalanceReportQuery, "page" | "limit">,
): Promise<void> {
  const blob = await fetchFile(
    `${HR_BASE}/balances/export?${toParams({ ...query })}`,
  );
  downloadBlob(`leave-balances-${query.year ?? "current"}.csv`, blob);
}

// ---- bulk entitlements -----------------------------------------------------

export function importLeaveEntitlementsCsv(
  file: File,
  dryRun: boolean,
): Promise<EntitlementImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<EntitlementImportReport>(
      `${LEAVE_ENTITLEMENTS_BASE}/import${dryRun ? "?dryRun=true" : ""}`,
      { method: "POST", formData },
    ),
  ).then((res) => res.data);
}

// ---- delegations (Docs/HR_LEAVE.md §6.2) -----------------------------------

export function listLeaveDelegations(query: {
  page: number;
  limit: number;
  activeOnly?: boolean;
}): Promise<PaginatedEnvelope<LeaveDelegationItem>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveDelegationItem[]>(DELEGATIONS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<LeaveDelegationItem>>;
}

export interface CreateDelegationBody {
  delegateUserId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function createLeaveDelegation(
  body: CreateDelegationBody,
): Promise<LeaveDelegationItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveDelegationItem>(DELEGATIONS_BASE, body),
  );
  return data;
}

export async function revokeLeaveDelegation(
  id: number,
): Promise<LeaveDelegationItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveDelegationItem>(`${DELEGATIONS_BASE}/${id}/revoke`, {}),
  );
  return data;
}

export function listDelegationCandidates(
  search: string,
): Promise<{ id: number; fullName: string }[]> {
  return withAuthRetry(() =>
    apiClient.get<{ id: number; fullName: string }[]>(
      `${DELEGATIONS_BASE}/candidates`,
      { query: search ? { search } : {} },
    ),
  ).then((r) => r.data);
}
