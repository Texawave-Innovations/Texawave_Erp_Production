import type {
  ConvertLeadInput,
  CreateLeadInput,
  Lead,
  PaginatedEnvelope,
  QueryLeadsInput,
  UpdateLeadInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/contacts/api.ts. Migrated from the LIVE legacy
 * TexaWave_ERP/src/modules/crm/Leads.tsx +
 * domain/LeadConvertDialog.tsx. */
export function listLeads(
  query: QueryLeadsInput,
): Promise<PaginatedEnvelope<Lead>> {
  return withAuthRetry(() =>
    apiClient.get<Lead[]>("/crm/leads", { query }),
  ) as Promise<PaginatedEnvelope<Lead>>;
}

export async function getLead(id: number): Promise<Lead> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Lead>(`/crm/leads/${id}`),
  );
  return data;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Lead>("/crm/leads", input),
  );
  return data;
}

export async function updateLead(
  id: number,
  input: UpdateLeadInput,
): Promise<Lead> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Lead>(`/crm/leads/${id}`, input),
  );
  return data;
}

export async function deleteLead(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/leads/${id}`));
}

export async function convertLead(
  id: number,
  input: ConvertLeadInput,
): Promise<Lead> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Lead>(`/crm/leads/${id}/convert`, input),
  );
  return data;
}
