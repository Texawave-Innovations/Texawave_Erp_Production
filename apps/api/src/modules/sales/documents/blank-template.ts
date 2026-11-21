import { Prisma } from "@texawave-erp/database";
import type { CompanyProfile } from "../master-list/company-profile.service.js";
import type { PrintableDocument } from "./document-pdf.template.js";
import type { CustomerSnapshot } from "./documents.rules.js";
import {
  printableDeliveryChallan,
  printableInvoice,
  printableQuotation,
  printableReturnableDc,
} from "./printable.js";

/**
 * Pure builders: the empty, unsaved document a form shows as its default
 * preview — the real letterhead, the next number and today's date, no
 * customer and one blank item row. Built with the same printable builders
 * as a saved document, so it cannot drift from the PDF.
 */

export type BlankDocumentKind =
  | "quotation"
  | "proforma"
  | "tax-invoice"
  | "delivery-challan"
  | "returnable-dc";

/** What the user has picked so far (all optional; nothing is validated). */
export interface BlankDraft {
  customer?: CustomerSnapshot | null | undefined;
  validity?: string | null | undefined;
  dueDate?: Date | null | undefined;
  purpose?: string | undefined;
  expectedReturnDate?: Date | undefined;
  takenBy?: string | null | undefined;
  preparedBy?: string | null | undefined;
}

const ZERO = new Prisma.Decimal(0);

const NO_CUSTOMER: CustomerSnapshot = {
  customerId: 0,
  customerCode: "",
  companyName: "",
  contactPerson: "",
  email: "",
  mobile: "",
  gstin: null,
  stateCode: null,
  stateName: null,
  billingAddress: null,
  shippingAddress: null,
};

/** One empty row, so the table's columns show before anything is typed. */
const BLANK_ROW = {
  description: "",
  hsnCode: null,
  quantity: "",
  unitPrice: "",
  amount: "",
};

const priced = {
  customerSnapshot: NO_CUSTOMER,
  lines: [],
  transportDescription: null,
  transportHsn: null,
  transportCharge: ZERO,
  taxMode: "INTRA",
  cgstRate: ZERO,
  sgstRate: ZERO,
  igstRate: ZERO,
  cgstAmount: ZERO,
  sgstAmount: ZERO,
  igstAmount: ZERO,
  itemsSubtotal: ZERO,
  roundOff: ZERO,
  totalAmount: ZERO,
  amountInWords: "",
  bankDetails: null,
  sealName: null,
  signatureName: null,
  preparedBy: null,
  terms: null,
};

const unpriced = {
  customerSnapshot: NO_CUSTOMER,
  lines: [],
  notes: null,
  preparedBy: null,
  sealName: null,
  signatureName: null,
};

export function blankDocument(
  kind: BlankDocumentKind,
  company: CompanyProfile,
  number: string,
  date: Date,
  draft: BlankDraft = {},
): PrintableDocument {
  const customerSnapshot = draft.customer ?? NO_CUSTOMER;
  const preparedBy = draft.preparedBy || null;
  const doc = ((): PrintableDocument => {
    switch (kind) {
      case "quotation":
        return printableQuotation(
          {
            ...priced,
            customerSnapshot,
            preparedBy,
            quotationNumber: number,
            quotationDate: date,
            validity: draft.validity || null,
          },
          company,
        );
      case "proforma":
      case "tax-invoice":
        return printableInvoice(
          {
            ...priced,
            customerSnapshot,
            preparedBy,
            invoiceType: kind === "proforma" ? "PROFORMA" : "TAX",
            invoiceNumber: number,
            invoiceDate: date,
            dueDate: draft.dueDate ?? null,
          },
          company,
        );
      case "delivery-challan":
        return printableDeliveryChallan(
          {
            ...unpriced,
            customerSnapshot,
            preparedBy,
            dcNumber: number,
            dcDate: date,
          },
          company,
        );
      case "returnable-dc":
        return printableReturnableDc(
          {
            ...unpriced,
            customerSnapshot,
            preparedBy,
            rdcNumber: number,
            issueDate: date,
            purpose: draft.purpose ?? "",
            expectedReturnDate: draft.expectedReturnDate ?? date,
            takenBy: draft.takenBy || null,
            status: "OPEN",
            returnedDate: null,
          },
          company,
        );
    }
  })();
  return { ...doc, lines: [BLANK_ROW] };
}
