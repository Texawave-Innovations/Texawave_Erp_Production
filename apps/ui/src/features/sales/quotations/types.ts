import type { BankDetails, CustomerSnapshot } from "../shared/documents";
import type { PricedBody } from "../shared/priced-form";

/** Mirrors apps/api/src/modules/sales/documents/quotations.repository.ts
 * (toView). Money and rates arrive as decimal strings. */

export type QuotationStatus = "OPEN" | "CONVERTED";

export interface QuotationLine {
  lineNo: number;
  description: string;
  hsnCode: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  quotationDate: string;
  validity: string | null;
  deliveryTerms: string | null;
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
  amountInWords: string;
  bankDetails: BankDetails | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  terms: string | null;
  status: QuotationStatus;
  convertedAt: string | null;
  lines: QuotationLine[];
  createdAt: string;
  updatedAt: string;
}

/** POST /sales/quotations (and the preview). */
export interface QuotationBody extends PricedBody {
  quotationDate: string;
  validity: string | null;
  deliveryTerms: string | null;
}
