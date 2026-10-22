"use client";

import type { CreateQuotationInput, Rfq } from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
  TotalsBar,
} from "../../shared/form-bits";
import { formatMoney } from "../../shared/format";
import { documentTotals, lineTotal, today } from "../../shared/pricing";
import {
  emptyLine,
  filledLines,
  ScmLinesEditor,
  type LineColumn,
  type LineDraft,
} from "../../shared/ScmLinesEditor";
import { useRfqs } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
const COLUMNS: readonly LineColumn[] = [
  { key: "quantity", label: "Qty", type: "number", min: 0, step: 0.001 },
  {
    key: "unitPrice",
    label: "Unit Price",
    type: "number",
    min: 0,
    step: 0.01,
    width: "md:col-span-2",
  },
  { key: "discount", label: "Disc.", type: "number", min: 0, step: 0.01 },
  {
    key: "taxRate",
    label: "Tax %",
    type: "number",
    min: 0,
    max: 100,
    step: 0.01,
  },
  {
    key: "promisedDeliveryDate",
    label: "Promised",
    type: "date",
    width: "md:col-span-2",
  },
];

const OPEN = ["RESPONSES_PENDING", "PARTIALLY_RESPONDED", "RESPONDED"];

function linesFromRfq(rfq: Rfq): LineDraft[] {
  return rfq.items.map((it) => ({
    productId: it.productId,
    values: {
      quantity: String(Number(it.quantity)),
      unitPrice: "",
      discount: "0",
      taxRate: "0",
      promisedDeliveryDate: "",
    },
  }));
}

export interface QuotationFormProps {
  open: boolean;
  onClose: () => void;
  initialRfqId?: number | null;
  onSubmit: (input: CreateQuotationInput) => Promise<void>;
}

/** Legacy `ScmSupplierQuotations` create dialog. Only RFQs still accepting
 * responses are offered, only invited suppliers can quote, and the items
 * start from the RFQ's lines. */
export function QuotationForm({
  open,
  onClose,
  initialRfqId,
  onSubmit,
}: QuotationFormProps) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="Record Supplier Quotation"
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? (
        <Body
          initialRfqId={initialRfqId ?? null}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  initialRfqId,
  onClose,
  onSubmit,
}: {
  initialRfqId: number | null;
  onClose: () => void;
  onSubmit: (input: CreateQuotationInput) => Promise<void>;
}) {
  const rfqQuery = useRfqs({ limit: 100 });
  const openRfqs = useMemo(
    () => (rfqQuery.data?.data ?? []).filter((r) => OPEN.includes(r.status)),
    [rfqQuery.data],
  );
  const [form, setForm] = useState({
    rfqId: initialRfqId ? String(initialRfqId) : "",
    supplierId: "",
    supplierQuotationNumber: "",
    quotationDate: today(),
    validUntil: "",
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    freight: "0",
    discount: "0",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([
    emptyLine({
      quantity: "",
      unitPrice: "",
      discount: "0",
      taxRate: "0",
      promisedDeliveryDate: "",
    }),
  ]);
  const [prefilled, setPrefilled] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rfq = openRfqs.find((r) => r.id === Number(form.rfqId));
  // Start from the RFQ's items the first time that RFQ is chosen.
  if (rfq && prefilled !== rfq.id) {
    setPrefilled(rfq.id);
    setLines(linesFromRfq(rfq));
    setForm((f) => ({
      ...f,
      currency: rfq.currency,
      paymentTerms: f.paymentTerms || (rfq.paymentTerms ?? ""),
      deliveryTerms: f.deliveryTerms || (rfq.deliveryTerms ?? ""),
      supplierId: rfq.suppliers.some(
        (s) => String(s.supplierId) === f.supplierId,
      )
        ? f.supplierId
        : "",
    }));
  }

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const filled = filledLines(lines);
  const priced = filled.map((l) => ({
    quantity: Number(l.values.quantity),
    unitPrice: Number(l.values.unitPrice) || 0,
    discount: Number(l.values.discount) || 0,
    taxRate: Number(l.values.taxRate) || 0,
  }));
  const freight = Number(form.freight) || 0;
  const discount = Number(form.discount) || 0;
  const totals = documentTotals(priced, freight, discount);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.rfqId) found.rfqId = "Select the RFQ this quotation responds to";
    if (!form.supplierId) found.supplierId = "Select the supplier";
    if (filled.length === 0)
      found.items = "Add at least one item with quantity and unit price";
    if (new Set(filled.map((l) => l.productId)).size !== filled.length) {
      found.items = "A product appears on more than one line — combine them";
    }
    for (const [i, p] of priced.entries()) {
      if (p.discount > p.quantity * p.unitPrice) {
        found.items = `Line ${i + 1}: discount cannot exceed the line amount`;
      }
    }
    if (freight < 0) found.freight = "Freight cannot be negative";
    if (discount < 0) found.discount = "Overall discount cannot be negative";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        supplierQuotationNumber: form.supplierQuotationNumber,
        rfqId: Number(form.rfqId),
        supplierId: Number(form.supplierId),
        quotationDate: form.quotationDate,
        validUntil: form.validUntil || undefined,
        currency: form.currency.toUpperCase(),
        paymentTerms: form.paymentTerms,
        deliveryTerms: form.deliveryTerms,
        freight,
        discount,
        notes: form.notes,
        items: filled.map((l, i) => ({
          productId: l.productId,
          quantity: priced[i]!.quantity,
          unitPrice: priced[i]!.unitPrice,
          discount: priced[i]!.discount,
          taxRate: priced[i]!.taxRate,
          promisedDeliveryDate: l.values.promisedDeliveryDate || undefined,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save the quotation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormGrid cols={3}>
        <SelectField
          label="RFQ"
          required
          value={form.rfqId}
          error={errors.rfqId}
          onChange={(v) => set("rfqId", v)}
          placeholder="Select RFQ"
          options={openRfqs.map((r) => ({
            value: String(r.id),
            label: r.rfqNumber,
          }))}
        />
        <SelectField
          label="Supplier"
          required
          value={form.supplierId}
          error={errors.supplierId}
          onChange={(v) => set("supplierId", v)}
          placeholder={rfq ? "Select invited supplier" : "Select an RFQ first"}
          disabled={!rfq}
          options={(rfq?.suppliers ?? []).map((s) => ({
            value: String(s.supplierId),
            label: s.supplierNameSnapshot,
          }))}
        />
        <TextField
          label="Supplier's Quote #"
          value={form.supplierQuotationNumber}
          onChange={(v) => set("supplierQuotationNumber", v)}
        />
        <TextField
          label="Quotation Date"
          type="date"
          required
          value={form.quotationDate}
          onChange={(v) => set("quotationDate", v)}
        />
        <TextField
          label="Valid Until"
          type="date"
          value={form.validUntil}
          onChange={(v) => set("validUntil", v)}
        />
        <TextField
          label="Currency"
          upper
          value={form.currency}
          onChange={(v) => set("currency", v.slice(0, 3))}
        />
        <TextField
          label="Payment Terms"
          value={form.paymentTerms}
          onChange={(v) => set("paymentTerms", v)}
        />
        <TextField
          label="Delivery Terms"
          value={form.deliveryTerms}
          onChange={(v) => set("deliveryTerms", v)}
        />
      </FormGrid>
      <ScmLinesEditor
        lines={lines}
        onChange={setLines}
        columns={COLUMNS}
        newLineDefaults={{
          quantity: "",
          unitPrice: "",
          discount: "0",
          taxRate: "0",
          promisedDeliveryDate: "",
        }}
        disabled={submitting}
        error={errors.items}
        computed={{
          label: "Line Total",
          render: (l) =>
            formatMoney(
              lineTotal(
                Number(l.values.quantity) || 0,
                Number(l.values.unitPrice) || 0,
                Number(l.values.discount) || 0,
                Number(l.values.taxRate) || 0,
              ).total,
              form.currency,
            ),
        }}
      />
      <FormGrid cols={3}>
        <TextField
          label="Freight"
          type="number"
          min={0}
          step={0.01}
          value={form.freight}
          error={errors.freight}
          onChange={(v) => set("freight", v)}
        />
        <TextField
          label="Overall Discount"
          type="number"
          min={0}
          step={0.01}
          value={form.discount}
          error={errors.discount}
          onChange={(v) => set("discount", v)}
        />
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(v) => set("notes", v)}
        />
      </FormGrid>
      <TotalsBar
        rows={[
          {
            label: "Subtotal",
            value: formatMoney(totals.subtotal, form.currency),
          },
          { label: "Tax", value: formatMoney(totals.tax, form.currency) },
          { label: "Freight", value: formatMoney(freight, form.currency) },
          {
            label: "Discount",
            value: `− ${formatMoney(discount, form.currency)}`,
          },
          {
            label: "Total",
            value: formatMoney(totals.total, form.currency),
            strong: true,
          },
        ]}
      />
      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Record Quotation
        </Button>
      </div>
    </form>
  );
}
