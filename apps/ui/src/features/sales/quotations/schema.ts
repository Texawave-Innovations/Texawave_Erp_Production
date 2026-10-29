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
import type { Quotation, QuotationBody } from "./types";

/**
 * The quotation form: the shared priced-document fields
 * (shared/priced-form.ts) plus its header — date, validity and delivery
 * terms. Mirrors apps/api/src/modules/sales/documents/dto/quotation.dto.ts.
 */

export const quotationHeaderSchema = z.object({
  quotationDate: z.string().regex(ISO_DATE, "Enter a date."),
  validity: optionalText(50),
  deliveryTerms: optionalText(200),
});

export const quotationSchema = pricedFormSchema(quotationHeaderSchema);

export type QuotationFormValues = PricedFormValues;

export const QUOTATION_FORM: PricedFormConfig = {
  noun: "quotation",
  numberLabel: "Quotation number",
  masterTypeOf: () => "QUOTATION",
  headerFields: [
    {
      key: "quotationDate",
      label: "Quotation date",
      kind: "date",
      required: true,
    },
    {
      key: "validity",
      label: "Validity",
      kind: "text",
      maxLength: 50,
      placeholder: "30 Days",
      masterField: "VALIDITY",
    },
    {
      key: "deliveryTerms",
      label: "Delivery terms",
      kind: "text",
      maxLength: 200,
      placeholder: "2-3 Weeks",
      masterField: "DELIVERY_TERMS",
    },
  ],
};

export function emptyQuotationForm(today: string): QuotationFormValues {
  return emptyPricedValues({
    quotationDate: today,
    validity: "",
    deliveryTerms: "",
  });
}

export function quotationToForm(q: Quotation): QuotationFormValues {
  return pricedValuesFromStored(q, {
    quotationDate: q.quotationDate.slice(0, 10),
    validity: q.validity ?? "",
    deliveryTerms: q.deliveryTerms ?? "",
  });
}

export function formToBody(
  v: QuotationFormValues,
  bank: (choice: string) => BankDetails | null,
): QuotationBody {
  return {
    ...pricedBody(v, bank),
    quotationDate: v.header.quotationDate ?? "",
    validity: blankNull(v.header.validity),
    deliveryTerms: blankNull(v.header.deliveryTerms),
  };
}
