import { requiredText } from "@texawave-erp/core";
import { z } from "zod";
import type { BankDetails } from "../shared/documents";
import { GST_STATES } from "../shared/gst";
import type { Quotation, QuotationBody } from "./types";

/**
 * Client-side validation of the quotation form. Mirrors
 * apps/api/src/modules/sales/documents/dto (quotation.dto.ts,
 * document-parts.dto.ts); the API stays authoritative and does all pricing.
 */

const STATE_CODES = new Set(GST_STATES.map((s) => s.code));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HSN = /^[0-9]{4,8}$/;

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters.`);

const hsn = z
  .string()
  .trim()
  .refine((v) => v === "" || HSN.test(v), {
    message: "HSN code must be 4 to 8 digits.",
  });

/** A typed number: blank allowed when `optional`. */
const decimal = (opts: {
  dp: number;
  min: number;
  max: number;
  minExclusive?: boolean;
  optional?: boolean;
  message: string;
}) =>
  z
    .string()
    .trim()
    .refine(
      (v) => {
        if (v === "") return Boolean(opts.optional);
        const re = new RegExp(`^\\d+(\\.\\d{1,${opts.dp}})?$`);
        if (!re.test(v)) return false;
        const n = Number(v);
        return (
          (opts.minExclusive ? n > opts.min : n >= opts.min) && n <= opts.max
        );
      },
      { message: opts.message },
    );

const rate = decimal({
  dp: 2,
  min: 0,
  max: 100,
  optional: true,
  message: "Enter a percentage from 0 to 100 (up to 2 decimals).",
});

export const lineSchema = z.object({
  description: requiredText(500),
  hsnCode: hsn,
  quantity: decimal({
    dp: 3,
    min: 0,
    max: 999_999_999,
    minExclusive: true,
    message: "Enter a quantity above 0 (up to 3 decimals).",
  }),
  unitPrice: decimal({
    dp: 2,
    min: 0,
    max: 999_999_999_999,
    message: "Enter a price of 0 or more (up to 2 decimals).",
  }),
});

export const quotationSchema = z.object({
  customerId: z
    .number()
    .int()
    .positive()
    .nullable()
    .refine((v) => v !== null, { message: "Select a customer." }),
  quotationDate: z.string().regex(ISO_DATE, "Enter a date."),
  validity: optionalText(50),
  deliveryTerms: optionalText(200),
  placeOfSupply: z.string().refine((v) => v === "" || STATE_CODES.has(v), {
    message: "Select a state.",
  }),
  lines: z
    .array(lineSchema)
    .min(1, "Add at least one item.")
    .max(200, "At most 200 items."),
  transportDescription: optionalText(200),
  transportCharge: decimal({
    dp: 2,
    min: 0,
    max: 999_999_999_999,
    optional: true,
    message: "Enter an amount of 0 or more (up to 2 decimals).",
  }),
  transportHsn: hsn,
  cgstRate: rate,
  sgstRate: rate,
  igstRate: rate,
  /** "" = none; a master-list BANK_ACCOUNT option id; "saved" = keep. */
  bankChoice: z.string(),
  sealItemId: z.string(),
  signatureItemId: z.string(),
  preparedBy: optionalText(150),
  terms: optionalText(5000),
});

export type QuotationFormValues = z.input<typeof quotationSchema>;
export type LineFormValues = z.input<typeof lineSchema>;

export const emptyLine = (): LineFormValues => ({
  description: "",
  hsnCode: "",
  quantity: "1",
  unitPrice: "",
});

export function emptyQuotationForm(today: string): QuotationFormValues {
  return {
    customerId: null,
    quotationDate: today,
    validity: "",
    deliveryTerms: "",
    placeOfSupply: "",
    lines: [emptyLine()],
    transportDescription: "",
    transportCharge: "",
    transportHsn: "",
    cgstRate: "",
    sgstRate: "",
    igstRate: "",
    bankChoice: "",
    sealItemId: "",
    signatureItemId: "",
    preparedBy: "",
    terms: "",
  };
}

const num = (v: string) => Number(v);
const blankNull = (v: string) => (v.trim() === "" ? null : v.trim());
const rateOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const idOrNull = (v: string) => (v === "" ? null : Number(v));

/** Strip a trailing ".00"/zeros the API prints, for editing ("9.00" → "9"). */
const plain = (v: string) => String(Number(v));

export function quotationToForm(q: Quotation): QuotationFormValues {
  return {
    customerId: q.customerId,
    quotationDate: q.quotationDate.slice(0, 10),
    validity: q.validity ?? "",
    deliveryTerms: q.deliveryTerms ?? "",
    placeOfSupply: q.placeOfSupply,
    lines: q.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode ?? "",
      quantity: plain(l.quantity),
      unitPrice: plain(l.unitPrice),
    })),
    transportDescription: q.transportDescription ?? "",
    transportCharge:
      Number(q.transportCharge) === 0 ? "" : plain(q.transportCharge),
    transportHsn: q.transportHsn ?? "",
    // The stored rates of its tax mode; the other mode's are zero.
    cgstRate: q.taxMode === "INTRA" ? plain(q.cgstRate) : "",
    sgstRate: q.taxMode === "INTRA" ? plain(q.sgstRate) : "",
    igstRate: q.taxMode === "INTER" ? plain(q.igstRate) : "",
    bankChoice: q.bankDetails ? "saved" : "",
    sealItemId: q.sealItemId === null ? "" : String(q.sealItemId),
    signatureItemId:
      q.signatureItemId === null ? "" : String(q.signatureItemId),
    preparedBy: q.preparedBy ?? "",
    terms: q.terms ?? "",
  };
}

/**
 * Form values → request body. `bank` resolves the bank choice: a master
 * option's details, the stored block ("saved"), or none.
 */
export function formToBody(
  v: QuotationFormValues,
  bank: (choice: string) => BankDetails | null,
): QuotationBody {
  return {
    customerId: v.customerId ?? 0,
    quotationDate: v.quotationDate,
    validity: blankNull(v.validity),
    deliveryTerms: blankNull(v.deliveryTerms),
    placeOfSupply: v.placeOfSupply === "" ? null : v.placeOfSupply,
    lines: v.lines.map((l) => ({
      description: l.description.trim(),
      hsnCode: blankNull(l.hsnCode),
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
    })),
    transportDescription: blankNull(v.transportDescription),
    transportCharge:
      v.transportCharge.trim() === "" ? 0 : num(v.transportCharge),
    transportHsn: blankNull(v.transportHsn),
    cgstRate: rateOrNull(v.cgstRate),
    sgstRate: rateOrNull(v.sgstRate),
    igstRate: rateOrNull(v.igstRate),
    bankDetails: bank(v.bankChoice),
    sealItemId: idOrNull(v.sealItemId),
    signatureItemId: idOrNull(v.signatureItemId),
    // With an option chosen the server prints its label; without one the
    // name is cleared too.
    ...(v.sealItemId === "" ? { sealName: null } : {}),
    ...(v.signatureItemId === "" ? { signatureName: null } : {}),
    preparedBy: blankNull(v.preparedBy),
    terms: blankNull(v.terms),
  };
}
