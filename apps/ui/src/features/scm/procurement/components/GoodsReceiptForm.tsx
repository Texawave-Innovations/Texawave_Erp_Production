"use client";

import type {
  CreateGoodsReceiptInput,
  PurchaseOrder,
} from "@texawave-erp/api-types";
import { Button, Input, Textarea } from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from "../../shared/form-bits";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import { formatQty } from "../../shared/format";
import { useLocationOptions, useProductOptions } from "../../shared/masters";
import { today } from "../../shared/pricing";
import { usePurchaseOrders } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
interface LineState {
  receiving: string;
  rejected: string;
  batchNumber: string;
  expiryDate: string;
  serials: string;
  unitCost: string;
}

const parseSerials = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export interface GoodsReceiptFormProps {
  open: boolean;
  onClose: () => void;
  initialPoId?: number | null;
  onSubmit: (input: CreateGoodsReceiptInput) => Promise<void>;
}

/** Legacy `GrnReceiveDialog`: receive goods against a sent PO. Batch-tracked
 * products need a batch number and serial-tracked ones exactly one serial
 * per accepted unit. The whole receipt posts atomically on the server. */
export function GoodsReceiptForm({
  open,
  onClose,
  initialPoId,
  onSubmit,
}: GoodsReceiptFormProps) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="Receive Goods (GRN)"
      size="2xl"
      className="sm:max-w-5xl"
    >
      {open ? (
        <Body
          initialPoId={initialPoId ?? null}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  initialPoId,
  onClose,
  onSubmit,
}: {
  initialPoId: number | null;
  onClose: () => void;
  onSubmit: (input: CreateGoodsReceiptInput) => Promise<void>;
}) {
  const pos = usePurchaseOrders({ receivable: "true", limit: 100 });
  const products = useProductOptions();
  const [poId, setPoId] = useState(initialPoId ? String(initialPoId) : "");
  const [receiptDate, setReceiptDate] = useState(today());
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<Record<number, LineState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const po: PurchaseOrder | undefined = pos.data?.data.find(
    (p) => p.id === Number(poId),
  );
  const locations = useLocationOptions(po?.warehouseId);
  const flags = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );

  const line = (id: number): LineState =>
    state[id] ?? {
      receiving: "",
      rejected: "",
      batchNumber: "",
      expiryDate: "",
      serials: "",
      unitCost: "",
    };
  const patch = (id: number, p: Partial<LineState>) =>
    setState((s) => ({ ...s, [id]: { ...line(id), ...p } }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!po) {
      setErrors({ po: "Select a purchase order" });
      return;
    }
    const found: Record<string, string> = {};
    const lines: CreateGoodsReceiptInput["lines"] = [];
    for (const item of po.items) {
      const s = line(item.id);
      const receiving = Number(s.receiving) || 0;
      if (receiving <= 0) continue;
      const rejected = Number(s.rejected) || 0;
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      const product = flags.get(item.productId);
      const accepted = receiving - rejected;
      const serials = parseSerials(s.serials);
      const name = item.productNameSnapshot;
      if (receiving > remaining)
        found[`l${item.id}`] =
          `${name}: cannot receive ${receiving}, only ${remaining} remaining on the PO`;
      else if (rejected < 0 || rejected > receiving)
        found[`l${item.id}`] =
          `${name}: rejected quantity cannot exceed receiving quantity`;
      else if (product?.batchTracked && accepted > 0 && !s.batchNumber.trim())
        found[`l${item.id}`] = `${name} requires a batch number`;
      else if (
        product?.serialTracked &&
        accepted > 0 &&
        serials.length !== accepted
      ) {
        found[`l${item.id}`] =
          `${name} requires exactly ${accepted} serial number(s), got ${serials.length}`;
      }
      lines.push({
        purchaseOrderItemId: item.id,
        receivingQuantity: receiving,
        rejectedQuantity: rejected,
        batchNumber: s.batchNumber.trim() || undefined,
        serialNumbers: serials.length ? serials : undefined,
        unitCost: s.unitCost ? Number(s.unitCost) : undefined,
        expiryDate: s.expiryDate || undefined,
      });
    }
    if (lines.length === 0)
      found.lines = "Enter a receiving quantity for at least one item";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        purchaseOrderId: po.id,
        receiptDate,
        locationId: locationId ? Number(locationId) : undefined,
        notes,
        lines,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not post the goods receipt.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormGrid cols={3}>
        <SelectField
          label="Purchase Order"
          required
          value={poId}
          error={errors.po}
          onChange={(v) => {
            setPoId(v);
            setState({});
          }}
          placeholder="Select a sent purchase order"
          options={(pos.data?.data ?? []).map((p) => ({
            value: String(p.id),
            label: `${p.poNumber} — ${p.vendorNameSnapshot}`,
          }))}
          hint={
            SCM_CLIENT_DEMO &&
            !pos.isPending &&
            (pos.data?.data ?? []).length === 0
              ? "No purchase order is ready to receive yet — create one under Purchase Order and get it sent to the supplier first."
              : undefined
          }
        />
        <TextField
          label="Receipt Date"
          type="date"
          required
          value={receiptDate}
          onChange={setReceiptDate}
        />
        <SelectField
          label="Putaway Location"
          value={locationId}
          onChange={setLocationId}
          placeholder="Default (no location)"
          options={(locations.data ?? [])
            .filter((l) => l.status === "Active")
            .map((l) => ({
              value: String(l.id),
              label: l.locationCode ?? l.binCode,
            }))}
        />
      </FormGrid>

      {po ? (
        <div className="flex flex-col gap-3">
          {po.items.map((item) => {
            const s = line(item.id);
            const product = flags.get(item.productId);
            const remaining =
              Number(item.quantity) - Number(item.receivedQuantity);
            const accepted =
              (Number(s.receiving) || 0) - (Number(s.rejected) || 0);
            return (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-theme-sm">
                    {item.productNameSnapshot}
                  </strong>
                  <span className="text-theme-xs text-gray-500">
                    Ordered {formatQty(item.quantity)} · Received{" "}
                    {formatQty(item.receivedQuantity)} · Remaining{" "}
                    {formatQty(remaining)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                  <div>
                    <label className="mb-1 block text-theme-xs text-gray-500">
                      Receiving
                    </label>
                    <Input
                      aria-label={`Receiving quantity for ${item.productNameSnapshot}`}
                      type="number"
                      min={0}
                      step={0.001}
                      value={s.receiving}
                      onChange={(e) =>
                        patch(item.id, { receiving: e.target.value })
                      }
                      disabled={remaining <= 0 || submitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-theme-xs text-gray-500">
                      Rejected
                    </label>
                    <Input
                      aria-label={`Rejected quantity for ${item.productNameSnapshot}`}
                      type="number"
                      min={0}
                      step={0.001}
                      value={s.rejected}
                      onChange={(e) =>
                        patch(item.id, { rejected: e.target.value })
                      }
                      disabled={remaining <= 0 || submitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-theme-xs text-gray-500">
                      Unit Cost
                    </label>
                    <Input
                      aria-label={`Unit cost for ${item.productNameSnapshot}`}
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={String(Number(item.unitPrice))}
                      value={s.unitCost}
                      onChange={(e) =>
                        patch(item.id, { unitCost: e.target.value })
                      }
                      disabled={submitting}
                    />
                  </div>
                  {product?.batchTracked ? (
                    <>
                      <div>
                        <label className="mb-1 block text-theme-xs text-gray-500">
                          Batch No.
                        </label>
                        <Input
                          aria-label={`Batch number for ${item.productNameSnapshot}`}
                          className="uppercase"
                          value={s.batchNumber}
                          onChange={(e) =>
                            patch(item.id, {
                              batchNumber: e.target.value.toUpperCase(),
                            })
                          }
                          disabled={submitting}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-theme-xs text-gray-500">
                          Expiry
                        </label>
                        <Input
                          aria-label={`Expiry date for ${item.productNameSnapshot}`}
                          type="date"
                          value={s.expiryDate}
                          onChange={(e) =>
                            patch(item.id, { expiryDate: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
                {product?.serialTracked ? (
                  <div className="mt-2">
                    <label className="mb-1 block text-theme-xs text-gray-500">
                      Serial numbers ({parseSerials(s.serials).length} of{" "}
                      {Math.max(0, accepted)} needed) — one per line or comma
                      separated
                    </label>
                    <Textarea
                      aria-label={`Serial numbers for ${item.productNameSnapshot}`}
                      rows={2}
                      value={s.serials}
                      onChange={(e) =>
                        patch(item.id, { serials: e.target.value })
                      }
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                {errors[`l${item.id}`] ? (
                  <p
                    role="alert"
                    className="mt-2 text-theme-xs text-error-600 dark:text-error-400"
                  >
                    {errors[`l${item.id}`]}
                  </p>
                ) : null}
              </div>
            );
          })}
          {errors.lines ? (
            <p
              role="alert"
              className="text-theme-xs text-error-600 dark:text-error-400"
            >
              {errors.lines}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-theme-sm text-gray-500">
          {pos.data?.data.length === 0
            ? "No purchase orders are waiting for goods. A PO must be sent before it can be received."
            : "Select a purchase order to enter what was received."}
        </p>
      )}
      <TextAreaField label="Notes" value={notes} onChange={setNotes} />
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
        <Button type="submit" loading={submitting} disabled={!po}>
          Post Goods Receipt
        </Button>
      </div>
    </form>
  );
}
