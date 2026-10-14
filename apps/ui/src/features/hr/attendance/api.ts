import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { fetchFile } from "@/lib/fetch-file";
import { downloadBlob } from "@/features/hr/payroll/download";
import type {
  AttendanceDayView,
  AttendanceImportReport,
  BulkApproveReport,
  DailyAttendanceRow,
  FinalizeMonthReport,
  MissingPunchRow,
  MissingPunchType,
  MonthLockRow,
  MonthLockStatus,
  CheckInResult,
  CheckOutResult,
  StoredStatus,
} from "./types";

export interface AttendanceRangeQuery {
  page: number;
  limit: number;
  from: string;
  to: string;
}

export interface AttendanceListQuery extends AttendanceRangeQuery {
  employeeId?: number;
  status?: StoredStatus;
}

const BASE = "/hr/attendance";

export function listAttendance(
  query: AttendanceListQuery,
): Promise<PaginatedEnvelope<AttendanceDayView>> {
  return withAuthRetry(() =>
    apiClient.get<AttendanceDayView[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<AttendanceDayView>>;
}

export async function getAttendance(id: number): Promise<AttendanceDayView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<AttendanceDayView>(`${BASE}/${id}`),
  );
  return data;
}

export interface ManualSessionBody {
  checkInAt: string;
  checkOutAt?: string | null;
}

export interface ManualEditAttendanceBody {
  status?: StoredStatus | null;
  sessions?: ManualSessionBody[];
}

export async function manualEditAttendance(
  id: number,
  body: ManualEditAttendanceBody,
): Promise<AttendanceDayView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<AttendanceDayView>(`${BASE}/${id}`, body),
  );
  return data;
}

/** The authenticated user's own attendance. */
export function listMyAttendance(
  query: AttendanceRangeQuery,
): Promise<PaginatedEnvelope<AttendanceDayView>> {
  return withAuthRetry(() =>
    apiClient.get<AttendanceDayView[]>(`${BASE}/mine`, { query }),
  ) as Promise<PaginatedEnvelope<AttendanceDayView>>;
}

/** No body: the server stamps the time and resolves the employee from the JWT. */
export async function checkIn(): Promise<CheckInResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CheckInResult>(`${BASE}/check-in`, {}),
  );
  return data;
}

export async function checkOut(): Promise<CheckOutResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CheckOutResult>(`${BASE}/check-out`, {}),
  );
  return data;
}

// ---- reports -----------------------------------------------------------------

export interface PageQuery {
  page: number;
  limit: number;
}

export function getDailyReport(
  query: PageQuery & { date: string },
): Promise<PaginatedEnvelope<DailyAttendanceRow>> {
  return withAuthRetry(() =>
    apiClient.get<DailyAttendanceRow[]>(`${BASE}/reports/daily`, { query }),
  ) as Promise<PaginatedEnvelope<DailyAttendanceRow>>;
}

export interface MissingPunchQuery extends AttendanceRangeQuery {
  type?: MissingPunchType;
  employeeId?: number;
}

export function listMissingPunches(
  query: MissingPunchQuery,
): Promise<PaginatedEnvelope<MissingPunchRow>> {
  return withAuthRetry(() =>
    apiClient.get<MissingPunchRow[]>(`${BASE}/reports/missing-punches`, {
      query,
    }),
  ) as Promise<PaginatedEnvelope<MissingPunchRow>>;
}

// ---- export / import -------------------------------------------------------------

export async function exportAttendanceCsv(query: {
  from: string;
  to: string;
  employeeId?: number;
}): Promise<void> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.employeeId) params.set("employeeId", String(query.employeeId));
  const blob = await fetchFile(`${BASE}/export?${params.toString()}`);
  downloadBlob(`attendance-${query.from}-to-${query.to}.csv`, blob);
}

export function importAttendanceCsv(
  file: File,
  dryRun: boolean,
): Promise<AttendanceImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<AttendanceImportReport>(
      `${BASE}/import${dryRun ? "?dryRun=true" : ""}`,
      { method: "POST", formData },
    ),
  ).then((res) => res.data);
}

// ---- month close -------------------------------------------------------------------

const LOCKS = `${BASE}/month-locks`;

export interface MonthLockQuery extends PageQuery {
  month: string;
  status?: MonthLockStatus;
  employeeId?: number;
}

export function listMonthLocks(
  query: MonthLockQuery,
): Promise<PaginatedEnvelope<MonthLockRow>> {
  return withAuthRetry(() =>
    apiClient.get<MonthLockRow[]>(LOCKS, { query }),
  ) as Promise<PaginatedEnvelope<MonthLockRow>>;
}

export async function finalizeMonth(body: {
  month: string;
  employeeIds?: number[];
}): Promise<FinalizeMonthReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinalizeMonthReport>(`${LOCKS}/finalize`, body),
  );
  return data;
}

export async function approveMonths(body: {
  ids: number[];
  note?: string;
}): Promise<BulkApproveReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<BulkApproveReport>(`${LOCKS}/approve`, body),
  );
  return data;
}

export type MonthDecision = "approve" | "return" | "reopen";

export async function decideMonth(
  id: number,
  decision: MonthDecision,
  note: string,
): Promise<MonthLockRow> {
  const body = note.trim() ? { note: note.trim() } : {};
  const { data } = await withAuthRetry(() =>
    apiClient.post<MonthLockRow>(`${LOCKS}/${id}/${decision}`, body),
  );
  return data;
}
