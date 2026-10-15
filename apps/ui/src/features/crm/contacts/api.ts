import type {
  Contact,
  CreateContactInput,
  PaginatedEnvelope,
  QueryContactsInput,
  UpdateContactInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/_reference/tags/api.ts. Migrated from the LIVE
 * legacy TexaWave_ERP/src/modules/crm/domain/contactsService.ts. */
export function listContacts(
  query: QueryContactsInput,
): Promise<PaginatedEnvelope<Contact>> {
  return withAuthRetry(() =>
    apiClient.get<Contact[]>("/crm/contacts", { query }),
  ) as Promise<PaginatedEnvelope<Contact>>;
}

export async function getContact(id: number): Promise<Contact> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Contact>(`/crm/contacts/${id}`),
  );
  return data;
}

export async function createContact(
  input: CreateContactInput,
): Promise<Contact> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Contact>("/crm/contacts", input),
  );
  return data;
}

export async function updateContact(
  id: number,
  input: UpdateContactInput,
): Promise<Contact> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Contact>(`/crm/contacts/${id}`, input),
  );
  return data;
}

export async function deleteContact(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/contacts/${id}`));
}
