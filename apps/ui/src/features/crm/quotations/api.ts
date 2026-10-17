import type {
  PaginatedEnvelope,
  QueryQuotationsInput,
  Quotation,
  QuotationPayloadInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/opportunities/api.ts. Migrated from the LIVE
 * legacy TexaWave_ERP/src/modules/crm/QuoteForm.tsx + Quotes.tsx. */
export function listQuotations(
  query: QueryQuotationsInput,
): Promise<PaginatedEnvelope<Quotation>> {
  return withAuthRetry(() =>
    apiClient.get<Quotation[]>("/crm/quotations", { query }),
  ) as Promise<PaginatedEnvelope<Quotation>>;
}

export async function getQuotation(id: number): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Quotation>(`/crm/quotations/${id}`),
  );
  return data;
}

export async function createQuotation(
  input: QuotationPayloadInput,
): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Quotation>("/crm/quotations", input),
  );
  return data;
}

/** Full replace-all (approved decision D2) — header and every line item
 * together, every save, matching legacy's single Save button exactly. */
export async function replaceQuotation(
  id: number,
  input: QuotationPayloadInput,
): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<Quotation>(`/crm/quotations/${id}`, input),
  );
  return data;
}

export async function deleteQuotation(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/quotations/${id}`));
}
