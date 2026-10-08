import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  ExitRequestItem,
  ExitRequestStatus,
  SettlementStatus,
} from "./types";

const HR_BASE = "/hr/exit-requests";
const SELF_SERVICE_BASE = "/self-service/exit-requests";

export interface ExitRequestListQuery {
  page: number;
  limit: number;
  status?: ExitRequestStatus;
  employeeId?: number;
}

/** HR surface: own/team/all, scoped server-side against
 * `hr.exit_request.read`. */
export function listExitRequests(
  query: ExitRequestListQuery,
): Promise<PaginatedEnvelope<ExitRequestItem>> {
  return withAuthRetry(() =>
    apiClient.get<ExitRequestItem[]>(HR_BASE, { query }),
  ) as Promise<PaginatedEnvelope<ExitRequestItem>>;
}

export async function getExitRequest(id: number): Promise<ExitRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ExitRequestItem>(`${HR_BASE}/${id}`),
  );
  return data;
}

export interface UpdateExitRequestBody {
  status?: ExitRequestStatus;
  confirmedLastWorkingDate?: string;
  settlementStatus?: SettlementStatus;
  hrNote?: string;
}

export async function updateExitRequest(
  id: number,
  body: UpdateExitRequestBody,
): Promise<ExitRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ExitRequestItem>(`${HR_BASE}/${id}`, body),
  );
  return data;
}

// ---- self-service (the authenticated user's own exit requests) -----------

export function listMyExitRequests(
  query: Omit<ExitRequestListQuery, "employeeId">,
): Promise<PaginatedEnvelope<ExitRequestItem>> {
  return withAuthRetry(() =>
    apiClient.get<ExitRequestItem[]>(SELF_SERVICE_BASE, { query }),
  ) as Promise<PaginatedEnvelope<ExitRequestItem>>;
}

export interface CreateExitRequestBody {
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays?: number;
  additionalNotes?: string;
}

export async function createMyExitRequest(
  body: CreateExitRequestBody,
): Promise<ExitRequestItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ExitRequestItem>(SELF_SERVICE_BASE, body),
  );
  return data;
}
