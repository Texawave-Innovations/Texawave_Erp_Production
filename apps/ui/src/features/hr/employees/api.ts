import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  EmployeeDetail,
  EmployeeListItem,
  EmployeeStatus,
  EmployeeStatusHistoryRow,
  LookupItem,
} from "./types";

export interface EmployeeListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: EmployeeStatus;
  departmentId?: number;
  designationId?: number;
  employmentTypeId?: number;
  workLocationId?: number;
  joinedFrom?: string;
  joinedTo?: string;
  sortBy?:
    "employeeCode" | "fullName" | "dateOfJoining" | "status" | "createdAt";
}

const BASE = "/hr/employees";

export function listEmployees(
  query: EmployeeListQuery,
): Promise<PaginatedEnvelope<EmployeeListItem>> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeListItem[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<EmployeeListItem>>;
}

export async function getEmployee(id: number): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeDetail>(`${BASE}/${id}`),
  );
  return data;
}

export async function createEmployee(
  body: Record<string, unknown>,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(BASE, body),
  );
  return data;
}

export async function updateEmployee(
  id: number,
  body: Record<string, unknown>,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<EmployeeDetail>(`${BASE}/${id}`, body),
  );
  return data;
}

export interface StatusChangeBody {
  status: EmployeeStatus;
  effectiveDate: string;
  reason: string;
}

/** `correction` is true only for the RESIGNED/TERMINATED workflow, which has its own permission. */
export async function changeEmployeeStatus(
  id: number,
  body: StatusChangeBody,
  correction: boolean,
): Promise<EmployeeDetail> {
  const path = `${BASE}/${id}/${correction ? "status-correction" : "status"}`;
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(path, body),
  );
  return data;
}

export interface LinkAccountBody {
  userId: number;
  reason?: string;
}

export interface UnlinkAccountBody {
  reason?: string;
}

/** Attach an existing platform user (same org, active, not linked elsewhere). */
export async function linkEmployeeUser(
  id: number,
  body: LinkAccountBody,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(`${BASE}/${id}/link-user`, body),
  );
  return data;
}

export async function unlinkEmployeeUser(
  id: number,
  body: UnlinkAccountBody,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(`${BASE}/${id}/unlink-user`, body),
  );
  return data;
}

export function listStatusHistory(
  id: number,
  page: number,
  limit: number,
): Promise<PaginatedEnvelope<EmployeeStatusHistoryRow>> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeStatusHistoryRow[]>(`${BASE}/${id}/status-history`, {
      query: { page, limit },
    }),
  ) as Promise<PaginatedEnvelope<EmployeeStatusHistoryRow>>;
}

/** Lookup lists for the filter bar and the form selects. Capped at the API's max page size. */
export async function listLookup(
  path:
    | "/departments"
    | "/master-data/designations"
    | "/master-data/employment-types"
    | "/master-data/work-locations",
): Promise<LookupItem[]> {
  const res = await withAuthRetry(() =>
    apiClient.get<LookupItem[]>(path, { query: { page: 1, limit: 100 } }),
  );
  return (res as PaginatedEnvelope<LookupItem>).data;
}
