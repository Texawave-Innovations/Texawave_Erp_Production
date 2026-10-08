import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  AttendanceCorrection,
  AttendanceDayView,
  CheckInResult,
  CheckOutResult,
  CorrectionStatus,
  CorrectionType,
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

const CORRECTIONS_BASE = "/hr/attendance/corrections";

export interface CorrectionListQuery {
  page: number;
  limit: number;
  status?: CorrectionStatus;
  employeeId?: number;
}

/** Own/team/all scoped. An employee's own corrections are just the `.own`
 * scope of this same endpoint — there is no separate self-service list. */
export function listAttendanceCorrections(
  query: CorrectionListQuery,
): Promise<PaginatedEnvelope<AttendanceCorrection>> {
  return withAuthRetry(() =>
    apiClient.get<AttendanceCorrection[]>(CORRECTIONS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<AttendanceCorrection>>;
}

export interface SubmitCorrectionBody {
  attendanceDate: string;
  correctionType: CorrectionType;
  requestedCheckInAt?: string;
  requestedCheckOutAt?: string;
  reason: string;
}

/** Submits for the authenticated user's own employee record — there is
 * deliberately no employee field in the request body. */
export async function submitAttendanceCorrection(
  body: SubmitCorrectionBody,
): Promise<AttendanceCorrection> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrection>(CORRECTIONS_BASE, body),
  );
  return data;
}

export interface DecideCorrectionBody {
  note?: string;
}

export async function approveAttendanceCorrection(
  id: number,
  body: DecideCorrectionBody,
): Promise<AttendanceCorrection> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrection>(
      `${CORRECTIONS_BASE}/${id}/approve`,
      body,
    ),
  );
  return data;
}

export async function rejectAttendanceCorrection(
  id: number,
  body: DecideCorrectionBody,
): Promise<AttendanceCorrection> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrection>(
      `${CORRECTIONS_BASE}/${id}/reject`,
      body,
    ),
  );
  return data;
}
