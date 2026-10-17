import { z } from "zod";
import type { BankDetails } from "../shared/documents";
import {
  blankNull,
  emptyPricedValues,
  ISO_DATE,
  optionalText,
  pricedBody,
  pricedFormSchema,
  pricedValuesFromStored,
  type PricedFormConfig,
  type PricedFormValues,
} from "../shared/priced-form";
import type {
  Invoice,
  InvoiceBody,
  InvoiceType,
  InvoiceUpdateBody,
} from "./types";

/**
 * The invoice form: the shared priced-document fields plus its header —
 * type (create only), invoice date, due date and payment terms. Mirrors
 * apps/api/src/modules/sales/documents/dto/invoice.dto.ts.
 */

export const invoiceHeaderSchema = z
  .object({
    invoiceType: z.enum(["PROFORMA", "TAX"]),
    invoiceDate: z.string().regex(ISO_DATE, "Enter a date."),
    dueDate: z.string().refine((v) => v === "" || ISO_DATE.test(v), {
      message: "Enter a date.",
    }),
    paymentTerms: optionalText(50),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate && v.invoiceDate && v.dueDate < v.invoiceDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "The due date cannot be before the invoice date.",
      });
    }
  });

export const invoiceSchema = pricedFormSchema(invoiceHeaderSchema);

export type InvoiceFormValues = PricedFormValues;

export const INVOICE_FORM: PricedFormConfig = {
  noun: "invoice",
  numberLabel: "Invoice number",
  masterTypeOf: (h) =>
    h.invoiceType === "PROFORMA" ? "PROFORMA_INVOICE" : "TAX_INVOICE",
  headerFields: [
    {
      key: "invoiceType",
      label: "Type",
      kind: "select",
      required: true,
      fixedOnEdit: true,
      options: [
        { value: "PROFORMA", label: "Proforma invoice" },
        { value: "TAX", label: "Tax invoice" },
      ],
      hint: "Cannot change after saving.",
    },
    { key: "invoiceDate", label: "Invoice date", kind: "date", required: true },
    { key: "dueDate", label: "Due date", kind: "date" },
    {
      key: "paymentTerms",
      label: "Payment terms",
      kind: "text",
      maxLength: 50,
      placeholder: "30 Days",
      masterField: "PAYMENT_TERMS",
    },
  ],
};

export function emptyInvoiceForm(
  invoiceType: InvoiceType,
  today: string,
): InvoiceFormValues {
  return emptyPricedValues({
    invoiceType,
    invoiceDate: today,
    dueDate: "",
    paymentTerms: "",
  });
}

export function invoiceToForm(inv: Invoice): InvoiceFormValues {
  return pricedValuesFromStored(inv, {
    invoiceType: inv.invoiceType,
    invoiceDate: inv.invoiceDate.slice(0, 10),
    dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
    paymentTerms: inv.paymentTerms ?? "",
  });
}

type Bank = (choice: string) => BankDetails | null;

export function formToUpdateBody(
  v: InvoiceFormValues,
  bank: Bank,
): InvoiceUpdateBody {
  return {
    ...pricedBody(v, bank),
    invoiceDate: v.header.invoiceDate ?? "",
    dueDate: blankNull(v.header.dueDate),
    paymentTerms: blankNull(v.header.paymentTerms),
  };
}

export function formToCreateBody(
  v: InvoiceFormValues,
  bank: Bank,
): InvoiceBody {
  return {
    ...formToUpdateBody(v, bank),
    invoiceType: v.header.invoiceType === "PROFORMA" ? "PROFORMA" : "TAX",
  };
}
