import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  AttendanceDayView,
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
