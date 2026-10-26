import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { downloadBlob } from "@/features/hr/payroll/download";
import type {
  EmployeeDetail,
  EmployeeImportReport,
  EmployeeListItem,
  EmployeeStats,
  EmployeeStatus,
  EmployeeStatusHistoryRow,
  LookupItem,
  OnboardingReviewStatus,
} from "./types";

export interface EmployeeListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: EmployeeStatus;
  onboardingReviewStatus?: OnboardingReviewStatus;
  teamId?: number;
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

/** Permanent — only succeeds when nothing else references this employee. */
export async function deleteEmployee(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${BASE}/${id}`));
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

export async function getEmployeeStats(): Promise<EmployeeStats> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeStats>(`${BASE}/stats`),
  );
  return data;
}

/**
 * Approve a submitted onboarding profile (PENDING_REVIEW, nothing missing).
 * `force` is an HR override: approve even if the profile was never
 * submitted or is still incomplete.
 */
export async function approveOnboarding(
  id: number,
  note?: string,
  force?: boolean,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(`${BASE}/${id}/onboarding/approve`, {
      ...(note ? { note } : {}),
      ...(force ? { force } : {}),
    }),
  );
  return data;
}

/** Send a submitted profile back with a note; reopens the employee's wizard. */
export async function sendBackOnboarding(
  id: number,
  note: string,
): Promise<EmployeeDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<EmployeeDetail>(`${BASE}/${id}/onboarding/send-back`, {
      note,
    }),
  );
  return data;
}

/**
 * HR's edit of one employee's onboarding detail tables — the path the
 * employee's own self-service wizard points to once their profile is
 * PROFILE_LOCKED ("Ask HR to update it"), used by the onboarding progress
 * view's per-section Edit action. Each getter returns `null` when nothing is
 * saved yet, same as the self-service equivalents.
 */
export function getEmployeePersonal(
  id: number,
): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      `${BASE}/${id}/personal-details`,
    ),
  ).then((res) => res.data);
}

export function putEmployeePersonal(id: number, input: object) {
  return withAuthRetry(() =>
    apiClient.put(`${BASE}/${id}/personal-details`, input),
  );
}

export function getEmployeeAddress(
  id: number,
  type: "PERMANENT" | "PRESENT",
): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      `${BASE}/${id}/address/${type}`,
    ),
  ).then((res) => res.data);
}

export function putEmployeeAddress(
  id: number,
  type: "PERMANENT" | "PRESENT",
  input: object,
) {
  return withAuthRetry(() =>
    apiClient.put(`${BASE}/${id}/address/${type}`, input),
  );
}

/** Masked account number only, same as the self-service read. */
export function getEmployeeBank(
  id: number,
): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(`${BASE}/${id}/bank-details`),
  ).then((res) => res.data);
}

export function putEmployeeBank(id: number, input: object) {
  return withAuthRetry(() =>
    apiClient.put(`${BASE}/${id}/bank-details`, input),
  );
}

export function getEmployeeGovernmentIds(
  id: number,
): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      `${BASE}/${id}/government-ids`,
    ),
  ).then((res) => res.data);
}

export function putEmployeeGovernmentIds(id: number, input: object) {
  return withAuthRetry(() =>
    apiClient.put(`${BASE}/${id}/government-ids`, input),
  );
}

export function uploadEmployeeDocument(
  id: number,
  documentType: string,
  file: File,
) {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request(`${BASE}/${id}/documents/${documentType}/file`, {
      method: "PUT",
      formData,
    }),
  );
}

/** All rows or none; `dryRun` validates (including database checks) and saves nothing. */
export function importEmployeesCsv(
  file: File,
  dryRun: boolean,
): Promise<EmployeeImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<EmployeeImportReport>(
      `${BASE}/import${dryRun ? "?dryRun=true" : ""}`,
      { method: "POST", formData },
    ),
  ).then((res) => res.data);
}

/**
 * apiClient only parses JSON, so CSV/PDF downloads go through fetch with the
 * same bearer token and base URL (as employee-documents/api.ts does). A failed
 * request surfaces the API's own message.
 */
async function fetchFile(path: string): Promise<Blob> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(message ?? `Download failed (status ${res.status})`);
  }
  return res.blob();
}

/** CSV of the employees matching the list filters (export permission). */
export async function exportEmployeesCsv(
  query: Omit<EmployeeListQuery, "page" | "limit">,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const blob = await fetchFile(`${BASE}/export${qs ? `?${qs}` : ""}`);
  const day = new Intl.DateTimeFormat("en-CA").format(new Date());
  downloadBlob(`employees-${day}.csv`, blob);
}

/** The profile as a PDF (no sensitive identifiers; profile read permission). */
export async function downloadProfilePdf(
  id: number,
  employeeCode: string,
): Promise<void> {
  const blob = await fetchFile(`${BASE}/${id}/profile/pdf`);
  downloadBlob(`${employeeCode}-profile.pdf`, blob);
}
