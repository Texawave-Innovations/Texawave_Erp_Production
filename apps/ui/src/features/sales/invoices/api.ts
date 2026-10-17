import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { DocumentPreview } from "../shared/documents";
import type {
  Invoice,
  InvoiceBody,
  InvoiceStatus,
  InvoiceType,
  InvoiceUpdateBody,
} from "./types";

export const INVOICES = "/sales/invoices";

export interface InvoiceListQuery {
  page: number;
  limit: number;
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  customerId?: number;
  search?: string;
  from?: string;
  to?: string;
}

export function listInvoices(
  query: InvoiceListQuery,
): Promise<PaginatedEnvelope<Invoice>> {
  return withAuthRetry(() =>
    apiClient.get<Invoice[]>(INVOICES, { query }),
  ) as Promise<PaginatedEnvelope<Invoice>>;
}

export async function getInvoice(id: number): Promise<Invoice> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Invoice>(`${INVOICES}/${id}`),
  );
  return data;
}

/** Server pricing + the PDF's HTML (nothing stored). */
export async function previewInvoice(
  body: InvoiceBody | InvoiceUpdateBody,
  id?: number,
): Promise<DocumentPreview> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<DocumentPreview>(
      id === undefined ? `${INVOICES}/preview` : `${INVOICES}/${id}/preview`,
      body,
    ),
  );
  return data;
}

export async function createInvoice(body: InvoiceBody): Promise<Invoice> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Invoice>(INVOICES, body),
  );
  return data;
}

export async function updateInvoice(
  id: number,
  body: InvoiceUpdateBody,
): Promise<Invoice> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Invoice>(`${INVOICES}/${id}`, body),
  );
  return data;
}

export async function deleteInvoice(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${INVOICES}/${id}`));
}

/** "Move to Tax Invoice": the proforma becomes a tax invoice. */
export async function convertToTax(
  id: number,
  invoiceDate: string,
): Promise<Invoice> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Invoice>(`${INVOICES}/${id}/convert-to-tax`, {
      invoiceDate,
    }),
  );
  return data;
}

/** A delivery challan with the tax invoice's customer and items. */
export async function createChallanFromInvoice(
  id: number,
  dcDate: string,
): Promise<{ id: number; dcNumber: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ id: number; dcNumber: string }>(
      `${INVOICES}/${id}/delivery-challan`,
      { dcDate },
    ),
  );
  return data;
}
