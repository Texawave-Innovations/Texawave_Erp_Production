import type {
  CompleteMeetingInput,
  CreateMeetingInput,
  Meeting,
  PaginatedEnvelope,
  QueryMeetingsInput,
  RescheduleMeetingInput,
  UpdateMeetingInput,
  UpdateMeetingStatusInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Meetings tab
 * (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/meetings/meetings.controller.ts. */
export function listMeetings(
  query: QueryMeetingsInput,
): Promise<PaginatedEnvelope<Meeting>> {
  return withAuthRetry(() =>
    apiClient.get<Meeting[]>("/crm/meetings", { query }),
  ) as Promise<PaginatedEnvelope<Meeting>>;
}

export async function getMeeting(id: number): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Meeting>(`/crm/meetings/${id}`),
  );
  return data;
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Meeting>("/crm/meetings", input),
  );
  return data;
}

export async function updateMeeting(
  id: number,
  input: UpdateMeetingInput,
): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Meeting>(`/crm/meetings/${id}`, input),
  );
  return data;
}

export async function updateMeetingStatus(
  id: number,
  input: UpdateMeetingStatusInput,
): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Meeting>(`/crm/meetings/${id}/status`, input),
  );
  return data;
}

export async function completeMeeting(
  id: number,
  input: CompleteMeetingInput,
): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Meeting>(`/crm/meetings/${id}/complete`, input),
  );
  return data;
}

export async function rescheduleMeeting(
  id: number,
  input: RescheduleMeetingInput,
): Promise<Meeting> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Meeting>(`/crm/meetings/${id}/reschedule`, input),
  );
  return data;
}

export async function deleteMeeting(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/meetings/${id}`));
}
