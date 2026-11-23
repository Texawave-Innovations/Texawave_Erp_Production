import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { DocumentPreview } from "../shared/documents";
import type { Quotation, QuotationBody, QuotationStatus } from "./types";

export const QUOTATIONS = "/sales/quotations";

export interface QuotationListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: QuotationStatus;
  customerId?: number;
  from?: string;
  to?: string;
}

export function listQuotations(
  query: QuotationListQuery,
): Promise<PaginatedEnvelope<Quotation>> {
  return withAuthRetry(() =>
    apiClient.get<Quotation[]>(QUOTATIONS, { query }),
  ) as Promise<PaginatedEnvelope<Quotation>>;
}

export async function getQuotation(id: number): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Quotation>(`${QUOTATIONS}/${id}`),
  );
  return data;
}

export async function getNextQuotationNumber(date: string): Promise<string> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ number: string }>(`${QUOTATIONS}/next-number`, {
      query: { date },
    }),
  );
  return data.number;
}

/** The empty quotation (letterhead, next number) for the form's default preview. */
export async function getQuotationTemplate(
  params: Record<string, string | number>,
): Promise<{ html: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ html: string }>(`${QUOTATIONS}/template`, {
      query: params,
    }),
  );
  return data;
}

/** Server pricing + the PDF's HTML for unsaved values (nothing stored). */
export async function previewQuotation(
  body: QuotationBody,
  id?: number,
): Promise<DocumentPreview> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<DocumentPreview>(
      id === undefined
        ? `${QUOTATIONS}/preview`
        : `${QUOTATIONS}/${id}/preview`,
      body,
    ),
  );
  return data;
}

export async function createQuotation(body: QuotationBody): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Quotation>(QUOTATIONS, body),
  );
  return data;
}

export async function updateQuotation(
  id: number,
  body: QuotationBody,
): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Quotation>(`${QUOTATIONS}/${id}`, body),
  );
  return data;
}

export async function deleteQuotation(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${QUOTATIONS}/${id}`));
}

export async function reopenQuotation(
  id: number,
  reason: string,
): Promise<Quotation> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Quotation>(`${QUOTATIONS}/${id}/reopen`, { reason }),
  );
  return data;
}

export interface ConvertedInvoice {
  id: number;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
}

export async function convertQuotation(
  id: number,
  body: { invoiceType: "PROFORMA" | "TAX"; invoiceDate: string },
): Promise<ConvertedInvoice> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ConvertedInvoice>(`${QUOTATIONS}/${id}/convert`, body),
  );
  return data;
}
