import type {
  CreateMomDocumentInput,
  CreateMomTemplateInput,
  MomDocument,
  MomStats,
  MomTemplate,
  PaginatedEnvelope,
  QueryMomDocumentsInput,
  StartMomRevisionInput,
  UpdateMomDocumentInput,
  UpdateMomTemplateInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/api/src/modules/projects/mom/. One function per endpoint
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
const DOCUMENTS_BASE = "/mom";
const TEMPLATES_BASE = "/mom/templates";

export function listMomDocuments(
  query: QueryMomDocumentsInput = {},
): Promise<PaginatedEnvelope<MomDocument>> {
  return withAuthRetry(() =>
    apiClient.get<MomDocument[]>(DOCUMENTS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<MomDocument>>;
}

export async function getMomStats(): Promise<MomStats> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MomStats>(`${DOCUMENTS_BASE}/stats`),
  );
  return data;
}

export async function listMomDocumentsByProject(
  projectId: number,
): Promise<MomDocument[]> {
  const res = await withAuthRetry(() =>
    apiClient.get<MomDocument[]>(`${DOCUMENTS_BASE}/by-project/${projectId}`),
  );
  return res.data;
}

export async function getMomDocument(id: number): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MomDocument>(`${DOCUMENTS_BASE}/${id}`),
  );
  return data;
}

export async function createMomDocument(
  input: CreateMomDocumentInput,
): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(DOCUMENTS_BASE, input),
  );
  return data;
}

export async function updateMomDocument(
  id: number,
  input: UpdateMomDocumentInput,
): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<MomDocument>(`${DOCUMENTS_BASE}/${id}`, input),
  );
  return data;
}

export async function finalizeMomDocument(id: number): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(`${DOCUMENTS_BASE}/${id}/finalize`, {}),
  );
  return data;
}

export async function startMomRevision(
  id: number,
  input: StartMomRevisionInput,
): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(
      `${DOCUMENTS_BASE}/${id}/revisions/start`,
      input,
    ),
  );
  return data;
}

export async function finalizeMomRevision(id: number): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(
      `${DOCUMENTS_BASE}/${id}/revisions/finalize`,
      {},
    ),
  );
  return data;
}

export async function archiveMomDocument(id: number): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(`${DOCUMENTS_BASE}/${id}/archive`, {}),
  );
  return data;
}

export async function restoreMomDocument(id: number): Promise<MomDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomDocument>(`${DOCUMENTS_BASE}/${id}/restore`, {}),
  );
  return data;
}

export async function deleteMomDocument(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`${DOCUMENTS_BASE}/${id}`));
}

export function listMomTemplates(): Promise<MomTemplate[]> {
  return withAuthRetry(() => apiClient.get<MomTemplate[]>(TEMPLATES_BASE)).then(
    (res) => res.data,
  );
}

export async function getMomTemplate(id: number): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MomTemplate>(`${TEMPLATES_BASE}/${id}`),
  );
  return data;
}

export async function createMomTemplate(
  input: CreateMomTemplateInput,
): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomTemplate>(TEMPLATES_BASE, input),
  );
  return data;
}

export async function updateMomTemplate(
  id: number,
  input: UpdateMomTemplateInput,
): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<MomTemplate>(`${TEMPLATES_BASE}/${id}`, input),
  );
  return data;
}

export async function deleteMomTemplate(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`${TEMPLATES_BASE}/${id}`));
}

export async function publishMomTemplate(id: number): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomTemplate>(`${TEMPLATES_BASE}/${id}/publish`, {}),
  );
  return data;
}

export async function duplicateMomTemplate(id: number): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomTemplate>(`${TEMPLATES_BASE}/${id}/duplicate`, {}),
  );
  return data;
}

export async function createMomTemplateVersion(
  id: number,
): Promise<MomTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MomTemplate>(`${TEMPLATES_BASE}/${id}/new-version`, {}),
  );
  return data;
}
