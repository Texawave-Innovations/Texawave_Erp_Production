import type {
  CreateCrmDocumentInput,
  CrmDocument,
  PaginatedEnvelope,
  QueryCrmDocumentsInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Account-360 Documents tab
 * (Phase 1A), routes confirmed from
 * apps/api/src/modules/crm/documents/documents.controller.ts. No update
 * endpoint exists — create/list/delete only, matching legacy. */
export function listCrmDocuments(
  query: QueryCrmDocumentsInput,
): Promise<PaginatedEnvelope<CrmDocument>> {
  return withAuthRetry(() =>
    apiClient.get<CrmDocument[]>("/crm/documents", { query }),
  ) as Promise<PaginatedEnvelope<CrmDocument>>;
}

export async function createCrmDocument(
  input: CreateCrmDocumentInput,
): Promise<CrmDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmDocument>("/crm/documents", input),
  );
  return data;
}

export async function deleteCrmDocument(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/documents/${id}`));
}
