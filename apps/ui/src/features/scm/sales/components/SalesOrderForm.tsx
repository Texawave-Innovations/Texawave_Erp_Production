"use client";

import type { SalesOrderPayload } from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
  TotalsBar,
} from "../../shared/form-bits";
import { formatMoney } from "../../shared/format";
import { round2, today } from "../../shared/pricing";
import {
  emptyLine,
  filledLines,
  ScmLinesEditor,
  type LineColumn,
  type LineDraft,
} from "../../shared/ScmLinesEditor";
import { useCustomerOptions } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
const COLUMNS: readonly LineColumn[] = [
  { key: "quantity", label: "Qty", type: "number", min: 0, step: 0.001 },
  { key: "unitPrice", label: "Unit Price", type: "number", min: 0, step: 0.01 },
  {
    key: "taxRate",
    label: "Tax %",
    type: "number",
    min: 0,
    max: 100,
    step: 0.01,
  },
];

const blankLine = () =>
  emptyLine({ quantity: "", unitPrice: "", taxRate: "0" });
const lineAmount = (l: LineDraft) =>
  round2(Number(l.values.quantity || 0) * Number(l.values.unitPrice || 0));
const lineTax = (l: LineDraft) =>
  round2((lineAmount(l) * Number(l.values.taxRate || 0)) / 100);

export function SalesOrderForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: SalesOrderPayload) => Promise<void>;
}) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="New Sales Order"
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? <Body onClose={onClose} onSubmit={onSubmit} /> : null}
    </ScmPanel>
  );
}

function Body({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: SalesOrderPayload) => Promise<void>;
}) {
  const customers = useCustomerOptions();
  const [form, setForm] = useState({
    customerId: "",
    orderDate: today(),
    expectedDate: "",
    shipToAddress: "",
    billToAddress: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const filled = filledLines(lines);
  const subtotal = round2(filled.reduce((s, l) => s + lineAmount(l), 0));
  const tax = round2(filled.reduce((s, l) => s + lineTax(l), 0));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.customerId) found.customerId = "Select a customer";
    if (!form.orderDate) found.orderDate = "Order date is required";
    if (filled.length === 0)
      found.items = "Add at least one item with a quantity greater than zero";
    if (new Set(filled.map((l) => l.productId)).size !== filled.length)
      found.items = "A product appears on more than one line — combine them";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        customerId: Number(form.customerId),
        orderDate: form.orderDate,
        expectedDate: form.expectedDate || undefined,
        shipToAddress: form.shipToAddress || undefined,
        billToAddress: form.billToAddress || undefined,
        notes: form.notes || undefined,
        items: filled.map((l) => ({
          productId: l.productId as number,
          quantity: Number(l.values.quantity),
          unitPrice: Number(l.values.unitPrice) || 0,
          taxRate: Number(l.values.taxRate) || 0,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save the sales order.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormGrid cols={3}>
        <SelectField
          label="Customer"
          required
          value={form.customerId}
          error={errors.customerId}
          onChange={(v) => {
            set("customerId", v);
            const cu = customers.data?.find((x) => String(x.id) === v);
            if (cu && !form.shipToAddress)
              set("shipToAddress", cu.shippingAddress ?? "");
          }}
          placeholder="Select customer"
          options={(customers.data ?? []).map((c) => ({
            value: String(c.id),
            label: `${c.name} (${c.customerCode})`,
          }))}
        />
        <TextField
          label="Order Date"
          type="date"
          required
          value={form.orderDate}
          error={errors.orderDate}
          onChange={(v) => set("orderDate", v)}
        />
        <TextField
          label="Expected Delivery"
          type="date"
          value={form.expectedDate}
          onChange={(v) => set("expectedDate", v)}
        />
      </FormGrid>
      <FormGrid>
        <TextAreaField
          label="Ship-to address"
          value={form.shipToAddress}
          onChange={(v) => set("shipToAddress", v)}
        />
        <TextAreaField
          label="Bill-to address"
          value={form.billToAddress}
          onChange={(v) => set("billToAddress", v)}
        />
      </FormGrid>
      <ScmLinesEditor
        lines={lines}
        onChange={setLines}
        columns={COLUMNS}
        newLineDefaults={{ quantity: "", unitPrice: "", taxRate: "0" }}
        disabled={submitting}
        error={errors.items}
        computed={{
          label: "Total",
          render: (l) => formatMoney(round2(lineAmount(l) + lineTax(l))),
        }}
      />
      <TextAreaField
        label="Notes"
        value={form.notes}
        onChange={(v) => set("notes", v)}
      />
      <TotalsBar
        rows={[
          { label: "Subtotal", value: formatMoney(subtotal) },
          { label: "Tax", value: formatMoney(tax) },
          {
            label: "Total",
            value: formatMoney(round2(subtotal + tax)),
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
          Save as Draft
        </Button>
      </div>
    </form>
  );
}
