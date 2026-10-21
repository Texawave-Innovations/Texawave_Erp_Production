"use client";

import type {
  PurchaseRequisition,
  RequisitionPayload,
  RequisitionPriority,
} from "@texawave-erp/api-types";
import { REQUISITION_PRIORITIES } from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from "../../shared/form-bits";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import {
  useDefaultWarehouseId,
  useWarehouseOptions,
} from "../../shared/masters";
import {
  emptyLine,
  filledLines,
  ScmLinesEditor,
  type LineColumn,
  type LineDraft,
} from "../../shared/ScmLinesEditor";
import { today } from "../../shared/pricing";

import { ScmPanel } from "../../shared/ScmPanel";
const COLUMNS: readonly LineColumn[] = [
  { key: "quantity", label: "Qty", type: "number", min: 0, step: 0.001 },
  {
    key: "requiredDate",
    label: "Required By",
    type: "date",
    width: "md:col-span-3",
  },
];

function fromRequisition(r: PurchaseRequisition): LineDraft[] {
  return r.items.map((it) => ({
    productId: it.productId,
    values: {
      quantity: String(Number(it.quantity)),
      estimatedUnitCost: String(Number(it.estimatedUnitCost)),
      requiredDate: it.requiredDate ? it.requiredDate.slice(0, 10) : "",
    },
  }));
}

export interface RequisitionFormProps {
  open: boolean;
  onClose: () => void;
  requisition?: PurchaseRequisition | null;
  onSubmit: (payload: RequisitionPayload) => Promise<void>;
}

/** Legacy `RequisitionFormDialog`: draft material requisition with line
 * items (quantity and required-by date only — no cost or tax inputs). */
export function RequisitionForm({
  open,
  onClose,
  requisition,
  onSubmit,
}: RequisitionFormProps) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title={
        requisition
          ? `Edit ${requisition.requisitionNumber}`
          : "New Material Requisition"
      }
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? (
        <Body
          key={requisition?.id ?? "new"}
          requisition={requisition ?? null}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  requisition,
  onClose,
  onSubmit,
}: {
  requisition: PurchaseRequisition | null;
  onClose: () => void;
  onSubmit: (payload: RequisitionPayload) => Promise<void>;
}) {
  const warehouses = useWarehouseOptions();
  const defaultWarehouseId = useDefaultWarehouseId();
  const [form, setForm] = useState({
    department: requisition?.department ?? "",
    requestDate: requisition?.requestDate.slice(0, 10) ?? today(),
    requiredDate: requisition?.requiredDate?.slice(0, 10) ?? "",
    priority: (requisition?.priority ?? "Normal") as RequisitionPriority,
    warehouseId: requisition ? String(requisition.warehouseId) : "",
    purpose: requisition?.purpose ?? "",
    notes: requisition?.notes ?? "",
  });
  const [lines, setLines] = useState<LineDraft[]>(
    requisition
      ? fromRequisition(requisition)
      : [emptyLine({ quantity: "", estimatedUnitCost: "" })],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const filled = filledLines(lines);
  // Client-demo has no warehouse concept — default to the one implicit
  // warehouse instead of showing a picker.
  const effectiveWarehouseId =
    SCM_CLIENT_DEMO && !form.warehouseId
      ? defaultWarehouseId
      : form.warehouseId;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!effectiveWarehouseId) found.warehouseId = "Select a warehouse";
    if (!form.requestDate) found.requestDate = "Request date is required";
    if (filled.length === 0)
      found.items = "Add at least one item with a quantity greater than zero";
    if (new Set(filled.map((l) => l.productId)).size !== filled.length) {
      found.items = "A product appears on more than one line — combine them";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        department: form.department,
        requestDate: form.requestDate,
        requiredDate: form.requiredDate || undefined,
        priority: form.priority,
        warehouseId: Number(effectiveWarehouseId),
        purpose: form.purpose,
        notes: form.notes,
        // Not editable here; an existing requisition keeps whatever it had.
        tax: requisition ? Number(requisition.tax) : 0,
        items: filled.map((l) => ({
          productId: l.productId,
          quantity: Number(l.values.quantity),
          estimatedUnitCost: Number(l.values.estimatedUnitCost) || 0,
          requiredDate: l.values.requiredDate || undefined,
        })),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save the requisition.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormGrid cols={3}>
        {SCM_CLIENT_DEMO ? null : (
          <SelectField
            label="Warehouse"
            required
            value={form.warehouseId}
            error={errors.warehouseId}
            onChange={(v) => set("warehouseId", v)}
            placeholder="Select warehouse"
            options={(warehouses.data ?? [])
              .filter((w) => w.status === "Active")
              .map((w) => ({ value: String(w.id), label: w.name }))}
          />
        )}
        <TextField
          label="Department"
          value={form.department}
          onChange={(v) => set("department", v)}
        />
        <SelectField
          label="Priority"
          value={form.priority}
          onChange={(v) => set("priority", v)}
          options={REQUISITION_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <TextField
          label="Request Date"
          type="date"
          required
          value={form.requestDate}
          error={errors.requestDate}
          onChange={(v) => set("requestDate", v)}
        />
        <TextField
          label="Required By"
          type="date"
          value={form.requiredDate}
          onChange={(v) => set("requiredDate", v)}
        />
      </FormGrid>
      <TextField
        label="Purpose"
        value={form.purpose}
        onChange={(v) => set("purpose", v)}
      />
      <ScmLinesEditor
        lines={lines}
        onChange={setLines}
        columns={COLUMNS}
        newLineDefaults={{ quantity: "", estimatedUnitCost: "" }}
        disabled={submitting}
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
          {requisition ? "Save Changes" : "Save as Draft"}
        </Button>
      </div>
    </form>
  );
}
