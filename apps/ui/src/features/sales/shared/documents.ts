import { apiClient, withAuthRetry } from "@/lib/api-client";
import { downloadBlob } from "@/lib/download";

/**
 * Shapes and calls shared by the Sales documents (quotations; invoices and
 * challans reuse them). Mirrors apps/api/src/modules/sales/documents and
 * master-list. Money arrives as decimal strings.
 */

export type MasterDocumentType =
  | "QUOTATION"
  | "PROFORMA_INVOICE"
  | "TAX_INVOICE"
  | "DELIVERY_CHALLAN"
  | "PAYMENT_RECEIVED"
  | "RETURNABLE_DC";

export type MasterField =
  | "VALIDITY"
  | "DELIVERY_TERMS"
  | "PAYMENT_TERMS"
  | "HSN_CODE"
  | "BANK_ACCOUNT"
  | "COMPANY_SEAL"
  | "AUTHORIZED_SIGNATURE"
  | "PREPARED_BY"
  | "PAYMENT_MODE";

export interface BankDetails {
  bankName?: string;
  accountNumber?: string;
  branch?: string | null;
  ifsc?: string;
}

/** A Sales master-list option (GET /sales/master/document-fields). */
export interface MasterOption {
  id: number;
  documentType: MasterDocumentType;
  field: MasterField;
  label: string;
  value: string | null;
  bankDetails: BankDetails | null;
  isDefault: boolean;
  sortOrder: number;
  hasImage: boolean;
}

/** The customer copy frozen on each document. */
export interface CustomerSnapshot {
  customerId: number;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
}

/** POST …/preview: the server's totals and the PDF's HTML. */
export interface DocumentPreview {
  number: string;
  html: string;
  totals: {
    placeOfSupply: string;
    taxMode: "INTRA" | "INTER";
    itemsSubtotal: string;
    transportCharge: string;
    taxableAmount: string;
    cgstRate: string;
    sgstRate: string;
    igstRate: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    roundOff: string;
    totalAmount: string;
    amountInWords: string;
    lineAmounts: string[];
  };
}

export type MailOutcome = "SENT" | "NOT_CONFIGURED";

export interface EmailBody {
  to?: string[];
  cc?: string[];
  subject?: string;
  message?: string;
}

export async function listMasterOptions(
  documentType: MasterDocumentType,
): Promise<MasterOption[]> {
  const res = await withAuthRetry(() =>
    apiClient.get<MasterOption[]>("/sales/master/document-fields", {
      query: { documentType },
    }),
  );
  return res.data;
}

export async function downloadPdf(path: string, fileName: string) {
  const blob = await withAuthRetry(() => apiClient.download(path));
  downloadBlob(fileName, blob);
}

/** `TW/QUO/26-27/0001` → `TW-QUO-26-27-0001.pdf` (the server's name too). */
export function pdfFileName(number: string): string {
  return `${number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}

export async function sendEmail(
  path: string,
  body: EmailBody,
): Promise<{ status: MailOutcome; to: string[] }> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ status: MailOutcome; to: string[] }>(path, body),
  );
  return data;
}

/** A wa.me link with the share text; the user's own WhatsApp sends it. */
export async function whatsappLink(path: string): Promise<string> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ url: string }>(path),
  );
  return data.url;
}
