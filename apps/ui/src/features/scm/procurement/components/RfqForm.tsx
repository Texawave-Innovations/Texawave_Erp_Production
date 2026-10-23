"use client";

import type {
  CreateRfqInput,
  PurchaseRequisition,
} from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from "../../shared/form-bits";
import { useSupplierOptions, useWarehouseOptions } from "../../shared/masters";
import { today } from "../../shared/pricing";
import {
  emptyLine,
  filledLines,
  ScmLinesEditor,
  type LineColumn,
  type LineDraft,
} from "../../shared/ScmLinesEditor";

import { ScmPanel } from "../../shared/ScmPanel";
const COLUMNS: readonly LineColumn[] = [
  { key: "quantity", label: "Qty", type: "number", min: 0, step: 0.001 },
  { key: "notes", label: "Notes", type: "text", width: "md:col-span-3" },
];

export interface RfqFormProps {
  open: boolean;
  onClose: () => void;
  /** Approved requisition being converted; locks its items. */
  fromRequisition?: PurchaseRequisition | null;
  onSubmit: (input: CreateRfqInput) => Promise<void>;
}

/** Legacy `ScmRfqs` create dialog: pick invited suppliers, set terms, list
 * the items to quote. Converting an approved requisition prefills the items. */
export function RfqForm({
  open,
  onClose,
  fromRequisition,
  onSubmit,
}: RfqFormProps) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title={
        fromRequisition
          ? `New RFQ from ${fromRequisition.requisitionNumber}`
          : "New RFQ"
      }
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? (
        <Body
          key={fromRequisition?.id ?? "new"}
          fromRequisition={fromRequisition ?? null}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  fromRequisition,
  onClose,
  onSubmit,
}: {
  fromRequisition: PurchaseRequisition | null;
  onClose: () => void;
  onSubmit: (input: CreateRfqInput) => Promise<void>;
}) {
  const warehouses = useWarehouseOptions();
  const suppliers = useSupplierOptions();
  const [form, setForm] = useState({
    warehouseId: fromRequisition ? String(fromRequisition.warehouseId) : "",
    issueDate: today(),
    responseDueDate: "",
    deliveryLocation: "",
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    notes: "",
  });
  const [supplierIds, setSupplierIds] = useState<number[]>([]);
  const [lines, setLines] = useState<LineDraft[]>(
    fromRequisition
      ? fromRequisition.items.map((it) => ({
          productId: it.productId,
          values: {
            quantity: String(Number(it.quantity)),
            notes: it.notes ?? "",
          },
        }))
      : [emptyLine({ quantity: "", notes: "" })],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const filled = filledLines(lines);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.warehouseId) found.warehouseId = "Select a warehouse";
    if (supplierIds.length === 0)
      found.suppliers = "Select at least one supplier";
    if (filled.length === 0)
      found.items = "Add at least one item with a quantity greater than zero";
    if (new Set(filled.map((l) => l.productId)).size !== filled.length) {
      found.items = "A product appears on more than one line — combine them";
    }
    if (!/^[A-Za-z]{3}$/.test(form.currency))
      found.currency = "Use a 3-letter currency code";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        requisitionId: fromRequisition?.id,
        supplierIds,
        issueDate: form.issueDate,
        responseDueDate: form.responseDueDate || undefined,
        warehouseId: Number(form.warehouseId),
        deliveryLocation: form.deliveryLocation,
        currency: form.currency.toUpperCase(),
        paymentTerms: form.paymentTerms,
        deliveryTerms: form.deliveryTerms,
        notes: form.notes,
        items: filled.map((l) => ({
          productId: l.productId,
          quantity: Number(l.values.quantity),
          notes: l.values.notes || undefined,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not create the RFQ.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormGrid cols={3}>
        <SelectField
          label="Warehouse"
          required
          value={form.warehouseId}
          error={errors.warehouseId}
          onChange={(v) => set("warehouseId", v)}
          options={(warehouses.data ?? [])
            .filter((w) => w.status === "Active")
            .map((w) => ({ value: String(w.id), label: w.name }))}
        />
        <TextField
          label="Issue Date"
          type="date"
          required
          value={form.issueDate}
          onChange={(v) => set("issueDate", v)}
        />
        <TextField
          label="Response Due"
          type="date"
          value={form.responseDueDate}
          onChange={(v) => set("responseDueDate", v)}
        />
        <TextField
          label="Delivery Location"
          value={form.deliveryLocation}
          onChange={(v) => set("deliveryLocation", v)}
        />
        <TextField
          label="Currency"
          upper
          value={form.currency}
          error={errors.currency}
          onChange={(v) => set("currency", v.slice(0, 3))}
        />
        <TextField
          label="Payment Terms"
          value={form.paymentTerms}
          onChange={(v) => set("paymentTerms", v)}
        />
      </FormGrid>
      <TextField
        label="Delivery Terms"
        value={form.deliveryTerms}
        onChange={(v) => set("deliveryTerms", v)}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Invite suppliers <span className="text-error-500">*</span>
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(suppliers.data ?? []).map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-theme-sm dark:border-gray-800"
            >
              <input
                type="checkbox"
                checked={supplierIds.includes(s.id)}
                onChange={(e) =>
                  setSupplierIds((ids) =>
                    e.target.checked
                      ? [...ids, s.id]
                      : ids.filter((id) => id !== s.id),
                  )
                }
              />
              <span className="truncate">{s.companyName}</span>
              <span className="ml-auto font-mono text-theme-xs text-gray-500">
                {s.supplierCode}
              </span>
            </label>
          ))}
          {suppliers.data?.length === 0 ? (
            <p className="text-theme-sm text-gray-500">
              No active suppliers. Add one first.
            </p>
          ) : null}
        </div>
        {errors.suppliers ? (
          <p
            role="alert"
            className="text-theme-xs text-error-600 dark:text-error-400"
          >
            {errors.suppliers}
          </p>
        ) : null}
      </fieldset>

      <ScmLinesEditor
        lines={lines}
        onChange={setLines}
        columns={COLUMNS}
        newLineDefaults={{ quantity: "", notes: "" }}
        disabled={submitting}
        locked={Boolean(fromRequisition)}
        error={errors.items}
      />
      <TextAreaField
        label="Notes"
        value={form.notes}
        onChange={(v) => set("notes", v)}
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
          Create RFQ (draft)
        </Button>
      </div>
    </form>
  );
}
