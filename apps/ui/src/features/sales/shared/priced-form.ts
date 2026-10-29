import { requiredText } from "@texawave-erp/core";
import { z } from "zod";
import type { BankDetails, MasterDocumentType, MasterField } from "./documents";
import { GST_STATES } from "./gst";

/**
 * The form shared by priced Sales documents (quotations, proforma and tax
 * invoices): customer, items, charges, tax rates, bank, seal, signature,
 * prepared-by and terms. Each document adds its own header fields under
 * `header` (e.g. quotation date and validity; invoice type and due date).
 * Mirrors apps/api/src/modules/sales/documents/dto/document-parts.dto.ts; the
 * API stays authoritative and does all pricing.
 */

const STATE_CODES = new Set(GST_STATES.map((s) => s.code));
const HSN = /^[0-9]{4,8}$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters.`);

const hsn = z
  .string()
  .trim()
  .refine((v) => v === "" || HSN.test(v), {
    message: "HSN code must be 4 to 8 digits.",
  });

/** A typed number: blank allowed when `optional`. */
export const decimal = (opts: {
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

/** The fields every priced document has. */
export const pricedShape = {
  customerId: z
    .number()
    .int()
    .positive()
    .nullable()
    .refine((v) => v !== null, { message: "Select a customer." }),
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
};

/** A priced form's schema: the shared fields plus the document's header. */
export function pricedFormSchema<
  H extends z.ZodType<Record<string, string>, Record<string, string>>,
>(header: H) {
  return z.object({ ...pricedShape, header });
}

export type LineFormValues = z.input<typeof lineSchema>;
export type PricedFormValues = z.input<z.ZodObject<typeof pricedShape>> & {
  header: Record<string, string>;
};

/** One header field of a document (rendered in section 1). */
export interface HeaderField {
  key: string;
  label: string;
  kind: "date" | "text" | "select";
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  /** Text fields: suggest (and default to) this master-list field. */
  masterField?: MasterField;
  /** Select fields. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Shown but not editable when editing a saved document. */
  fixedOnEdit?: boolean;
}

/** What a document type plugs into the shared form. */
export interface PricedFormConfig {
  /** "quotation" / "invoice" — used in labels and messages. */
  noun: string;
  headerFields: readonly HeaderField[];
  /** Master-list options to offer, from the current values. */
  masterTypeOf: (header: Record<string, string>) => MasterDocumentType;
  /** Shown before the first preview; the preview then gives the number. */
  numberLabel: string;
}

export const emptyLine = (): LineFormValues => ({
  description: "",
  hsnCode: "",
  quantity: "1",
  unitPrice: "",
});

export function emptyPricedValues(
  header: Record<string, string>,
): PricedFormValues {
  return {
    customerId: null,
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
    header,
  };
}

/** Strip the API's trailing zeros for editing ("9.00" → "9"). */
const plain = (v: string) => String(Number(v));

/** A saved priced document (quotation or invoice) as form values. */
export function pricedValuesFromStored(
  doc: {
    customerId: number;
    placeOfSupply: string;
    taxMode: "INTRA" | "INTER";
    lines: ReadonlyArray<{
      description: string;
      hsnCode: string | null;
      quantity: string;
      unitPrice: string;
    }>;
    transportDescription: string | null;
    transportCharge: string;
    transportHsn: string | null;
    cgstRate: string;
    sgstRate: string;
    igstRate: string;
    bankDetails: BankDetails | null;
    sealItemId: number | null;
    signatureItemId: number | null;
    preparedBy: string | null;
    terms: string | null;
  },
  header: Record<string, string>,
): PricedFormValues {
  return {
    customerId: doc.customerId,
    placeOfSupply: doc.placeOfSupply,
    lines: doc.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode ?? "",
      quantity: plain(l.quantity),
      unitPrice: plain(l.unitPrice),
    })),
    transportDescription: doc.transportDescription ?? "",
    transportCharge:
      Number(doc.transportCharge) === 0 ? "" : plain(doc.transportCharge),
    transportHsn: doc.transportHsn ?? "",
    // The stored rates of its tax mode; the other mode's are zero.
    cgstRate: doc.taxMode === "INTRA" ? plain(doc.cgstRate) : "",
    sgstRate: doc.taxMode === "INTRA" ? plain(doc.sgstRate) : "",
    igstRate: doc.taxMode === "INTER" ? plain(doc.igstRate) : "",
    bankChoice: doc.bankDetails ? "saved" : "",
    sealItemId: doc.sealItemId === null ? "" : String(doc.sealItemId),
    signatureItemId:
      doc.signatureItemId === null ? "" : String(doc.signatureItemId),
    preparedBy: doc.preparedBy ?? "",
    terms: doc.terms ?? "",
    header,
  };
}

export interface PricedBody {
  customerId: number;
  placeOfSupply: string | null;
  lines: Array<{
    description: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  transportDescription: string | null;
  transportCharge: number;
  transportHsn: string | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  bankDetails: BankDetails | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  sealName?: string | null;
  signatureName?: string | null;
  preparedBy: string | null;
  terms: string | null;
}

export const blankNull = (v: string | undefined) =>
  v === undefined || v.trim() === "" ? null : v.trim();
const rateOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const idOrNull = (v: string) => (v === "" ? null : Number(v));

/** The shared fields → request body. `bank` resolves the bank choice. */
export function pricedBody(
  v: PricedFormValues,
  bank: (choice: string) => BankDetails | null,
): PricedBody {
  return {
    customerId: v.customerId ?? 0,
    placeOfSupply: v.placeOfSupply === "" ? null : v.placeOfSupply,
    lines: v.lines.map((l) => ({
      description: l.description.trim(),
      hsnCode: blankNull(l.hsnCode),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    })),
    transportDescription: blankNull(v.transportDescription),
    transportCharge:
      v.transportCharge.trim() === "" ? 0 : Number(v.transportCharge),
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
