import type {
  CreateCrmColdCallingEntryInput,
  CrmColdCallingEntry,
  LinkCrmColdCallingEntryInput,
  PaginatedEnvelope,
  QueryCrmColdCallingEntriesInput,
  RecordCrmColdCallingDispositionInput,
  UpdateCrmColdCallingEntryInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/accounts/api.ts. Phase 1B Cold Calling Status
 * queue, routes confirmed from
 * apps/api/src/modules/crm/cold-calling/cold-calling.controller.ts. */
export function listColdCallingEntries(
  query: QueryCrmColdCallingEntriesInput,
): Promise<PaginatedEnvelope<CrmColdCallingEntry>> {
  return withAuthRetry(() =>
    apiClient.get<CrmColdCallingEntry[]>("/crm/cold-calling-entries", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<CrmColdCallingEntry>>;
}

export async function getColdCallingEntry(
  id: number,
): Promise<CrmColdCallingEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmColdCallingEntry>(`/crm/cold-calling-entries/${id}`),
  );
  return data;
}

export async function createColdCallingEntry(
  input: CreateCrmColdCallingEntryInput,
): Promise<CrmColdCallingEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmColdCallingEntry>("/crm/cold-calling-entries", input),
  );
  return data;
}

export async function updateColdCallingEntry(
  id: number,
  input: UpdateCrmColdCallingEntryInput,
): Promise<CrmColdCallingEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CrmColdCallingEntry>(
      `/crm/cold-calling-entries/${id}`,
      input,
    ),
  );
  return data;
}

export async function linkColdCallingEntryAccount(
  id: number,
  input: LinkCrmColdCallingEntryInput,
): Promise<CrmColdCallingEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmColdCallingEntry>(
      `/crm/cold-calling-entries/${id}/link-account`,
      input,
    ),
  );
  return data;
}

export async function recordColdCallingDisposition(
  id: number,
  input: RecordCrmColdCallingDispositionInput,
): Promise<CrmColdCallingEntry> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmColdCallingEntry>(
      `/crm/cold-calling-entries/${id}/disposition`,
      input,
    ),
  );
  return data;
}

export async function deleteColdCallingEntry(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/crm/cold-calling-entries/${id}`),
  );
}
