import type {
  CreateCrmNoteInput,
  CrmNote,
  PaginatedEnvelope,
  QueryCrmNotesInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Notes tab
 * (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/notes/notes.controller.ts. `accountId` is a
 * required raw query param (not part of the paginated DTO's optional
 * fields) — no update endpoint exists, matching legacy. */
export function listCrmNotes(
  query: QueryCrmNotesInput,
): Promise<PaginatedEnvelope<CrmNote>> {
  return withAuthRetry(() =>
    apiClient.get<CrmNote[]>("/crm/notes", { query }),
  ) as Promise<PaginatedEnvelope<CrmNote>>;
}

export async function createCrmNote(
  input: CreateCrmNoteInput,
): Promise<CrmNote> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmNote>("/crm/notes", input),
  );
  return data;
}

export async function deleteCrmNote(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/notes/${id}`));
}
