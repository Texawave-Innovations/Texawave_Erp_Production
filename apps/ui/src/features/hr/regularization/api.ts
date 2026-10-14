import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  AttendanceCorrectionItem,
  CorrectionStatus,
  CorrectionType,
} from "./types";

const BASE = "/hr/attendance/corrections";

export interface CorrectionListQuery {
  page: number;
  limit: number;
  status?: CorrectionStatus;
  employeeId?: number;
}

/**
 * A single endpoint, scoped server-side (own/team/all) against
 * `hr.attendance_correction.read` — there is no separate self-service list
 * route. An employee with only `.own` gets back their own requests from the
 * same call an approver uses for the team/all queue.
 */
export function listCorrections(
  query: CorrectionListQuery,
): Promise<PaginatedEnvelope<AttendanceCorrectionItem>> {
  return withAuthRetry(() =>
    apiClient.get<AttendanceCorrectionItem[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<AttendanceCorrectionItem>>;
}

export async function getCorrection(
  id: number,
): Promise<AttendanceCorrectionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<AttendanceCorrectionItem>(`${BASE}/${id}`),
  );
  return data;
}

export interface SubmitCorrectionBody {
  attendanceDate: string;
  correctionType: CorrectionType;
  requestedCheckInAt?: string;
  requestedCheckOutAt?: string;
  reason: string;
}

export async function submitCorrection(
  body: SubmitCorrectionBody,
): Promise<AttendanceCorrectionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrectionItem>(BASE, body),
  );
  return data;
}

export interface DecideCorrectionBody {
  note?: string;
}

export async function approveCorrection(
  id: number,
  body: DecideCorrectionBody,
): Promise<AttendanceCorrectionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrectionItem>(`${BASE}/${id}/approve`, body),
  );
  return data;
}

export async function rejectCorrection(
  id: number,
  body: DecideCorrectionBody,
): Promise<AttendanceCorrectionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AttendanceCorrectionItem>(`${BASE}/${id}/reject`, body),
  );
  return data;
}
