import type { BankDetails, CustomerSnapshot } from "../shared/documents";
import type { PricedBody } from "../shared/priced-form";

/** Mirrors apps/api/src/modules/sales/documents/invoices.repository.ts
 * (toView). Money and rates arrive as decimal strings. */

export type InvoiceType = "PROFORMA" | "TAX";
export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CONVERTED";

export interface InvoicePayment {
  id: number;
  paymentNumber: string;
  paymentDate: string;
  dueDate: string | null;
  amount: string;
  mode: string;
  modeItemId: number | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Invoice {
  id: number;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  invoiceDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  sourceQuotation: { id: number; quotationNumber: string } | null;
  sourceInvoice: { id: number; invoiceNumber: string } | null;
  convertedTo: { id: number; invoiceNumber: string } | null;
  supplierStateCode: string;
  placeOfSupply: string;
  taxMode: "INTRA" | "INTER";
  transportDescription: string | null;
  transportCharge: string;
  transportHsn: string | null;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  itemsSubtotal: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOff: string;
  totalAmount: string;
  amountReceived: string;
  balance: string;
  amountInWords: string;
  bankDetails: BankDetails | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  terms: string | null;
  status: InvoiceStatus;
  convertedAt: string | null;
  lines: Array<{
    lineNo: number;
    description: string;
    hsnCode: string | null;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
  payments: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

/** PATCH body (the type cannot change). */
export interface InvoiceUpdateBody extends PricedBody {
  invoiceDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
}

/** POST /sales/invoices (and the preview). */
export interface InvoiceBody extends InvoiceUpdateBody {
  invoiceType: InvoiceType;
}

export const INVOICE_LABEL: Record<InvoiceType, string> = {
  PROFORMA: "Proforma invoice",
  TAX: "Tax invoice",
};
