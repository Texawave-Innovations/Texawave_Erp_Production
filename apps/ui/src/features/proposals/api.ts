import type {
  CreateProposalDocumentInput,
  CreateProposalTemplateInput,
  ExtendFollowupInput,
  PaginatedEnvelope,
  ProposalDocument,
  ProposalSettings,
  ProposalStats,
  ProposalTemplate,
  QueryProposalDocumentsInput,
  TransitionProposalInput,
  UpdateProposalDocumentInput,
  UpdateProposalSettingsInput,
  UpdateProposalTemplateInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/api/src/modules/projects/proposals/. One function per endpoint
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
const DOCUMENTS_BASE = "/proposals";
const TEMPLATES_BASE = "/proposals/templates";
const SETTINGS_BASE = "/proposals/settings";

export function listProposalDocuments(
  query: QueryProposalDocumentsInput = {},
): Promise<PaginatedEnvelope<ProposalDocument>> {
  return withAuthRetry(() =>
    apiClient.get<ProposalDocument[]>(DOCUMENTS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<ProposalDocument>>;
}

export async function getProposalStats(): Promise<ProposalStats> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProposalStats>(`${DOCUMENTS_BASE}/stats`),
  );
  return data;
}

export async function duplicateProposalDocument(
  id: number,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalDocument>(`${DOCUMENTS_BASE}/${id}/duplicate`, {}),
  );
  return data;
}

export async function getProposalDocument(
  id: number,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProposalDocument>(`${DOCUMENTS_BASE}/${id}`),
  );
  return data;
}

export async function createProposalDocument(
  input: CreateProposalDocumentInput,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalDocument>(DOCUMENTS_BASE, input),
  );
  return data;
}

export async function updateProposalDocument(
  id: number,
  input: UpdateProposalDocumentInput,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ProposalDocument>(`${DOCUMENTS_BASE}/${id}`, input),
  );
  return data;
}

export async function transitionProposalDocument(
  id: number,
  input: TransitionProposalInput,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalDocument>(
      `${DOCUMENTS_BASE}/${id}/transition`,
      input,
    ),
  );
  return data;
}

export async function extendProposalFollowup(
  id: number,
  input: ExtendFollowupInput,
): Promise<ProposalDocument> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalDocument>(
      `${DOCUMENTS_BASE}/${id}/extend-followup`,
      input,
    ),
  );
  return data;
}

export async function deleteProposalDocument(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`${DOCUMENTS_BASE}/${id}`));
}

export function listProposalTemplates(): Promise<ProposalTemplate[]> {
  return withAuthRetry(() =>
    apiClient.get<ProposalTemplate[]>(TEMPLATES_BASE),
  ).then((res) => res.data);
}

export async function getProposalTemplate(
  id: number,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProposalTemplate>(`${TEMPLATES_BASE}/${id}`),
  );
  return data;
}

export async function createProposalTemplate(
  input: CreateProposalTemplateInput,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalTemplate>(TEMPLATES_BASE, input),
  );
  return data;
}

export async function updateProposalTemplate(
  id: number,
  input: UpdateProposalTemplateInput,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ProposalTemplate>(`${TEMPLATES_BASE}/${id}`, input),
  );
  return data;
}

export async function deleteProposalTemplate(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`${TEMPLATES_BASE}/${id}`));
}

export async function getProposalSettings(): Promise<ProposalSettings> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProposalSettings>(SETTINGS_BASE),
  );
  return data;
}

export async function updateProposalSettings(
  input: UpdateProposalSettingsInput,
): Promise<ProposalSettings> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<ProposalSettings>(SETTINGS_BASE, input),
  );
  return data;
}

export async function publishProposalTemplate(
  id: number,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalTemplate>(`${TEMPLATES_BASE}/${id}/publish`, {}),
  );
  return data;
}

export async function duplicateProposalTemplate(
  id: number,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalTemplate>(`${TEMPLATES_BASE}/${id}/duplicate`, {}),
  );
  return data;
}

export async function createProposalTemplateVersion(
  id: number,
): Promise<ProposalTemplate> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProposalTemplate>(`${TEMPLATES_BASE}/${id}/new-version`, {}),
  );
  return data;
}
