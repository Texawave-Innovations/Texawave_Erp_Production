"use client";

import { useCallback } from "react";
import { PricedDocumentForm } from "../../shared/components/PricedDocumentForm";
import type { BankDetails } from "../../shared/documents";
import { previewQuotation } from "../api";
import {
  formToBody,
  QUOTATION_FORM,
  quotationSchema,
  type QuotationFormValues,
} from "../schema";
import type { QuotationBody } from "../types";

export interface QuotationFormProps {
  mode: "create" | "edit";
  /** Edit: the saved quotation's id and number. */
  quotationId?: number;
  quotationNumber?: string;
  initialValues: QuotationFormValues;
  savedBank?: BankDetails | null;
  customerLabel?: string;
  onSubmit: (body: QuotationBody) => Promise<void>;
  onCancel: () => void;
}

/** The quotation form: the shared priced-document form with the
 * quotation's header fields and preview endpoint. */
export function QuotationForm({
  mode,
  quotationId,
  quotationNumber,
  initialValues,
  savedBank,
  customerLabel,
  onSubmit,
  onCancel,
}: QuotationFormProps) {
  const preview = useCallback(
    (v: QuotationFormValues, bank: (c: string) => BankDetails | null) =>
      previewQuotation(formToBody(v, bank), quotationId),
    [quotationId],
  );
  return (
    <PricedDocumentForm
      config={QUOTATION_FORM}
      schema={quotationSchema}
      mode={mode}
      documentNumber={quotationNumber}
      initialValues={initialValues}
      savedBank={savedBank}
      customerLabel={customerLabel}
      preview={preview}
      onSubmit={(v, bank) => onSubmit(formToBody(v, bank))}
      onCancel={onCancel}
      submitLabel={mode === "create" ? "Save quotation" : "Save changes"}
    />
  );
}
