"use client";

import { useState } from "react";
import { z } from "zod";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  FormField,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { todayIst } from "../../shared/format";
import { useConvertQuotation } from "../hooks";

const schema = z.object({
  invoiceType: z.enum(["PROFORMA", "TAX"]),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date."),
});

/** "Convert to invoice": the quotation becomes a proforma or tax invoice
 * (same customer, items and taxes) and is locked afterwards. */
export function ConvertQuotationDialog({
  open,
  onClose,
  quotationId,
  quotationNumber,
}: {
  open: boolean;
  onClose: () => void;
  quotationId: number;
  quotationNumber: string;
}) {
  const { toast } = useToast();
  const convert = useConvertQuotation();
  const [values, setValues] = useState<z.input<typeof schema>>({
    invoiceType: "PROFORMA",
    invoiceDate: todayIst(),
  });
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, validateAll } = useFormValidation(schema, values);

  async function handleConvert(event: React.FormEvent) {
    event.preventDefault();
    const parsed = validateAll();
    if (!parsed) return;
    setError(null);
    try {
      const invoice = await convert.mutateAsync({
        id: quotationId,
        body: parsed,
      });
      toast({
        title: `${invoice.invoiceType === "PROFORMA" ? "Proforma invoice" : "Tax invoice"} ${invoice.invoiceNumber} created`,
        description: `${quotationNumber} is now locked.`,
        variant: "success",
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not convert the quotation.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Convert ${quotationNumber}`}
      size="md"
    >
      <form onSubmit={handleConvert} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert variant="error" title="Not converted">
            {error}
          </Alert>
        ) : null}
        <FormField label="Convert to" required>
          {(f) => (
            <Select
              {...f}
              value={values.invoiceType}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  invoiceType: e.target.value as "PROFORMA" | "TAX",
                }))
              }
            >
              <option value="PROFORMA">Proforma invoice</option>
              <option value="TAX">Tax invoice</option>
            </Select>
          )}
        </FormField>
        <FormField
          label="Invoice date"
          required
          errorVariant="bubble"
          error={errorFor("invoiceDate")}
        >
          {(f) => (
            <DatePicker
              {...f}
              value={values.invoiceDate}
              onBlur={() => touch("invoiceDate")}
              onChange={(e) =>
                setValues((v) => ({ ...v, invoiceDate: e.target.value }))
              }
            />
          )}
        </FormField>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          The invoice copies the customer, items and taxes. The quotation can no
          longer be edited afterwards.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={convert.isPending}>
            Convert
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
