import type { Prisma } from "@texawave-erp/database";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import type { CompanyProfile } from "../master-list/company-profile.service.js";
import type { BankDetails } from "./document-repository.helpers.js";
import type { CustomerSnapshot } from "./documents.rules.js";
import type {
  PrintableDocument,
  PrintablePricing,
} from "./document-pdf.template.js";

/**
 * Pure builders: a saved document → what gets printed, emailed or shared.
 * Dates print as DD/MM/YYYY, money with 2 decimals and Indian grouping.
 */

type Dec = Prisma.Decimal;

/** Filled in by DocumentDeliveryService.withImages() before rendering. */
const NO_IMAGES = { logo: null, seal: null, signature: null };

export function inr(v: Dec): string {
  const [whole = "0", frac = "00"] = v.toFixed(2).split(".");
  const neg = whole.startsWith("-");
  const digits = neg ? whole.slice(1) : whole;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${rest ? `${rest},${last3}` : last3}.${frac}`;
}

export function dmy(d: Date): string {
  const [y, m, day] = formatDateOnly(d).split("-");
  return `${day}/${m}/${y}`;
}

const qty = (q: Dec) => q.toDecimalPlaces(3).toString();
const termLines = (t: string | null) =>
  (t ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

interface PricedDoc {
  customerSnapshot: unknown;
  lines: Array<{
    description: string;
    hsnCode: string | null;
    quantity: Dec;
    unitPrice: Dec;
    amount: Dec;
  }>;
  transportDescription: string | null;
  transportHsn: string | null;
  transportCharge: Dec;
  taxMode: string;
  cgstRate: Dec;
  sgstRate: Dec;
  igstRate: Dec;
  cgstAmount: Dec;
  sgstAmount: Dec;
  igstAmount: Dec;
  itemsSubtotal: Dec;
  roundOff: Dec;
  totalAmount: Dec;
  amountInWords: string;
  bankDetails: unknown;
  sealName: string | null;
  signatureName: string | null;
  preparedBy: string | null;
  terms: string | null;
}

function pricing(doc: PricedDoc): PrintablePricing {
  const rate = (r: Dec) => r.toString();
  return {
    itemsSubtotal: inr(doc.itemsSubtotal),
    transport: doc.transportCharge.isZero()
      ? null
      : {
          description: doc.transportDescription ?? "Transport Charges",
          hsn: doc.transportHsn,
          charge: inr(doc.transportCharge),
        },
    taxMode: doc.taxMode,
    cgst: { rate: rate(doc.cgstRate), amount: inr(doc.cgstAmount) },
    sgst: { rate: rate(doc.sgstRate), amount: inr(doc.sgstAmount) },
    igst: { rate: rate(doc.igstRate), amount: inr(doc.igstAmount) },
    roundOff: inr(doc.roundOff),
    total: inr(doc.totalAmount),
    amountInWords: doc.amountInWords,
  };
}

function pricedBase(doc: PricedDoc, company: CompanyProfile) {
  return {
    company,
    customer: doc.customerSnapshot as CustomerSnapshot,
    lines: doc.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: qty(l.quantity),
      unitPrice: inr(l.unitPrice),
      amount: inr(l.amount),
    })),
    pricing: pricing(doc),
    bank: (doc.bankDetails ?? null) as BankDetails | null,
    terms: termLines(doc.terms),
    note: null,
    preparedBy: doc.preparedBy,
    sealName: doc.sealName,
    signatureName: doc.signatureName,
    images: NO_IMAGES,
  };
}

export function printableQuotation(
  q: PricedDoc & {
    quotationNumber: string;
    quotationDate: Date;
    validity: string | null;
  },
  company: CompanyProfile,
): PrintableDocument {
  return {
    ...pricedBase(q, company),
    title: "Quotation",
    number: q.quotationNumber,
    partyLabel: "Quotation To",
    meta: [
      ["QO No", q.quotationNumber],
      ["Date", dmy(q.quotationDate)],
      ...(q.validity ? [["Validity", q.validity] as [string, string]] : []),
    ],
    termsTitle: "Terms & Conditions",
  };
}

export function printableInvoice(
  inv: PricedDoc & {
    invoiceType: string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate: Date | null;
  },
  company: CompanyProfile,
): PrintableDocument {
  const proforma = inv.invoiceType === "PROFORMA";
  return {
    ...pricedBase(inv, company),
    title: proforma ? "Proforma Invoice" : "Tax Invoice",
    number: inv.invoiceNumber,
    partyLabel: proforma ? "Client Details" : "Bill To",
    meta: [
      [proforma ? "PI No" : "Invoice No", inv.invoiceNumber],
      ["Date", dmy(inv.invoiceDate)],
      ...(inv.dueDate
        ? [["Due Date", dmy(inv.dueDate)] as [string, string]]
        : []),
    ],
    termsTitle: proforma ? "Declaration & Terms" : "Declaration",
  };
}

export function printableDeliveryChallan(
  dc: {
    dcNumber: string;
    dcDate: Date;
    customerSnapshot: unknown;
    lines: Array<{
      description: string;
      hsnCode: string | null;
      quantity: Dec;
    }>;
    notes: string | null;
    preparedBy: string | null;
    sealName: string | null;
    signatureName: string | null;
  },
  company: CompanyProfile,
): PrintableDocument {
  return {
    title: "Delivery Challan",
    number: dc.dcNumber,
    partyLabel: "Consignee / Client Address",
    meta: [
      ["Sl. No (DC No)", dc.dcNumber],
      ["Date", dmy(dc.dcDate)],
      ...(dc.preparedBy
        ? [["Prepared By", dc.preparedBy] as [string, string]]
        : []),
    ],
    company,
    customer: dc.customerSnapshot as CustomerSnapshot,
    lines: dc.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: qty(l.quantity),
    })),
    pricing: null,
    bank: null,
    termsTitle: "",
    terms: [],
    note: dc.notes,
    preparedBy: dc.preparedBy,
    sealName: dc.sealName,
    signatureName: dc.signatureName,
    images: NO_IMAGES,
  };
}

/** `TW/QUO/26-27/0001` → `TW-QUO-26-27-0001.pdf`. */
export function pdfFileName(number: string): string {
  return `${number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}

/** The default email / WhatsApp text for a document. */
export function shareMessage(doc: PrintableDocument): string {
  const lines = [
    `Dear ${doc.customer.contactPerson},`,
    "",
    `Please find ${doc.title} ${doc.number} from ${doc.company.legalName}.`,
  ];
  if (doc.pricing) lines.push(`Total amount: ₹${doc.pricing.total}`);
  lines.push("", "Regards,", doc.preparedBy ?? doc.company.legalName);
  return lines.join("\n");
}
