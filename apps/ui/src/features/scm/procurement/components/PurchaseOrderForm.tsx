"use client";

import type {
  CreatePurchaseOrderInput,
  SupplierQuotation,
} from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import { Link2, X } from "lucide-react";
import { useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
  TotalsBar,
} from "../../shared/form-bits";
import { formatMoney, formatStatusLabel } from "../../shared/format";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import {
  useDefaultWarehouseId,
  useSupplierOptions,
  useWarehouseOptions,
} from "../../shared/masters";
import { documentTotals, lineTotal, today } from "../../shared/pricing";
import {
  emptyLine,
  filledLines,
  ScmLinesEditor,
  type LineColumn,
  type LineDraft,
} from "../../shared/ScmLinesEditor";

import { ScmPanel } from "../../shared/ScmPanel";
import { useRequisitions } from "../hooks";
import { LINKABLE_REQUISITION_STATUSES } from "../mr-coverage";

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
];

export interface PurchaseOrderFormProps {
  open: boolean;
  onClose: () => void;
  /** Selected quotation to raise the PO from; locks supplier and items. */
  fromQuotation?: SupplierQuotation | null;
  onSubmit: (input: CreatePurchaseOrderInput) => Promise<void>;
}

/** Legacy `PurchaseOrderFormDialog`: a DRAFT PO, either from a selected
 * quotation (supplier/items locked) or from scratch for an active supplier. */
export function PurchaseOrderForm({
  open,
  onClose,
  fromQuotation,
  onSubmit,
}: PurchaseOrderFormProps) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title={
        fromQuotation
          ? `New Purchase Order from ${fromQuotation.quotationNumber}`
          : "New Purchase Order"
      }
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? (
        <Body
          key={fromQuotation?.id ?? "new"}
          fromQuotation={fromQuotation ?? null}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  fromQuotation,
  onClose,
  onSubmit,
}: {
  fromQuotation: SupplierQuotation | null;
  onClose: () => void;
  onSubmit: (input: CreatePurchaseOrderInput) => Promise<void>;
}) {
  const warehouses = useWarehouseOptions();
  const defaultWarehouseId = useDefaultWarehouseId();
  const suppliers = useSupplierOptions();
  // Requisitions not yet on a PO — offered as a "Link Material Requisition" pick so a PO raised
  // directly (without RFQ/quotation) still connects back to the MR that justified it. Linking
  // flips the MR to CONVERTED (server side), so it never gets suggested twice.
  const requisitions = useRequisitions({ page: 1, limit: 100 });
  const linkable = (requisitions.data?.data ?? []).filter((r) =>
    LINKABLE_REQUISITION_STATUSES.includes(r.status),
  );
  const [requisitionId, setRequisitionId] = useState("");
  const linked = linkable.find((r) => String(r.id) === requisitionId) ?? null;
  const [form, setForm] = useState({
    supplierId: fromQuotation ? String(fromQuotation.supplierId) : "",
    warehouseId: "",
    poDate: today(),
    expectedDeliveryDate: "",
    deliveryLocation: "",
    paymentTerms: fromQuotation?.paymentTerms ?? "",
    currency: fromQuotation?.currency ?? "INR",
    freight: "0",
    discount: "0",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>(
    fromQuotation
      ? fromQuotation.items.map((it) => ({
          productId: it.productId,
          values: {
            quantity: String(Number(it.quantity)),
            unitPrice: String(Number(it.unitPrice)),
            discount: String(Number(it.discount)),
            taxRate: String(Number(it.taxRate)),
          },
        }))
      : [
          emptyLine({
            quantity: "",
            unitPrice: "",
            discount: "0",
            taxRate: "0",
          }),
        ],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  // Client-demo has no warehouse concept — default to the one implicit
  // warehouse instead of showing a picker.
  const effectiveWarehouseId =
    SCM_CLIENT_DEMO && !form.warehouseId
      ? defaultWarehouseId
      : form.warehouseId;

  function applyRequisition(id: string) {
    setRequisitionId(id);
    const mr = linkable.find((r) => String(r.id) === id);
    if (!mr) return;
    // Prefill from the requisition's own lines (product + quantity). Pricing still comes from the
    // supplier at PO time, so — unlike the quotation flow — the lines stay fully editable.
    setLines(
      mr.items.map((it) => ({
        productId: it.productId,
        values: {
          quantity: String(Number(it.quantity)),
          unitPrice: "",
          discount: "0",
          taxRate: "0",
        },
      })),
    );
    setForm((f) =>
      f.warehouseId ? f : { ...f, warehouseId: String(mr.warehouseId) },
    );
  }
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
    if (!form.supplierId) found.supplierId = "Select a supplier";
    if (!effectiveWarehouseId) found.warehouseId = "Select a warehouse";
    if (filled.length === 0)
      found.items = "Add at least one item with a positive quantity";
    if (new Set(filled.map((l) => l.productId)).size !== filled.length) {
      found.items = "A product appears on more than one line — combine them";
    }
    for (const [i, p] of priced.entries()) {
      if (p.discount > p.quantity * p.unitPrice)
        found.items = `Line ${i + 1}: discount cannot exceed the line amount`;
    }
    if (freight < 0) found.freight = "Freight cannot be negative";
    if (discount < 0) found.discount = "Overall discount cannot be negative";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        quotationId: fromQuotation?.id,
        requisitionId: !fromQuotation && linked ? linked.id : undefined,
        supplierId: Number(form.supplierId),
        poDate: form.poDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        warehouseId: Number(effectiveWarehouseId),
        deliveryLocation: form.deliveryLocation,
        paymentTerms: form.paymentTerms,
        currency: form.currency.toUpperCase(),
        freight,
        discount,
        notes: form.notes,
        items: filled.map((l, i) => ({
          productId: l.productId,
          quantity: priced[i]!.quantity,
          unitPrice: priced[i]!.unitPrice,
          discount: priced[i]!.discount,
          taxRate: priced[i]!.taxRate,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not create the purchase order.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {!fromQuotation ? (
        linked ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-theme-sm dark:border-brand-500/30 dark:bg-brand-500/10">
            <span className="flex min-w-0 items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0" />
              <span className="font-mono">{linked.requisitionNumber}</span>
              <span className="truncate text-gray-500">
                — {linked.requestedByName}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Unlink requisition"
              onClick={() => setRequisitionId("")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <SelectField
            label="Link Material Requisition (optional)"
            value={requisitionId}
            onChange={applyRequisition}
            placeholder={
              linkable.length
                ? "Search requisitions not yet on a PO..."
                : "No requisitions awaiting a PO"
            }
            disabled={linkable.length === 0}
            options={linkable.map((r) => ({
              value: String(r.id),
              label: [
                `${r.requisitionNumber} — ${r.requestedByName}`,
                r.department,
                r.purpose,
                `${r.items.length} item(s)`,
                formatStatusLabel(r.status),
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        )
      ) : null}
      <FormGrid cols={3}>
        <SelectField
          label="Supplier"
          required
          value={form.supplierId}
          error={errors.supplierId}
          disabled={Boolean(fromQuotation)}
          onChange={(v) => set("supplierId", v)}
          options={(suppliers.data ?? []).map((s) => ({
            value: String(s.id),
            label: s.companyName,
          }))}
        />
        {SCM_CLIENT_DEMO ? null : (
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
        )}
        <TextField
          label="PO Date"
          type="date"
          required
          value={form.poDate}
          onChange={(v) => set("poDate", v)}
        />
        <TextField
          label="Expected Delivery"
          type="date"
          value={form.expectedDeliveryDate}
          onChange={(v) => set("expectedDeliveryDate", v)}
        />
        <TextField
          label="Payment Terms"
          value={form.paymentTerms}
          onChange={(v) => set("paymentTerms", v)}
        />
        <TextField
          label="Currency"
          upper
          value={form.currency}
          onChange={(v) => set("currency", v.slice(0, 3))}
        />
      </FormGrid>
      <TextField
        label="Delivery Location"
        value={form.deliveryLocation}
        onChange={(v) => set("deliveryLocation", v)}
      />
      <ScmLinesEditor
        lines={lines}
        onChange={setLines}
        columns={COLUMNS}
        newLineDefaults={{
          quantity: "",
          unitPrice: "",
          discount: "0",
          taxRate: "0",
        }}
        locked={Boolean(fromQuotation)}
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
          Save as Draft
        </Button>
      </div>
    </form>
  );
}
