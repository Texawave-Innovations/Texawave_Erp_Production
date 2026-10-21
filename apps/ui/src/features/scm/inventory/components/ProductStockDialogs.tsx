"use client";

import type {
  AdjustmentDirection,
  AdjustmentReason,
  ScmWarehouse,
} from "@texawave-erp/api-types";
import { ADJUSTMENT_REASONS } from "@texawave-erp/api-types";
import { Button, Dialog, useToast } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "../../shared/form-bits";
import { errorText } from "../../shared/use-list-controls";
import { useApplyAdjustment, useCreateReservation } from "../hooks";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  productId: number;
  productLabel: string;
  warehouses: readonly ScmWarehouse[];
  defaultWarehouseId: number | null;
}

export interface StockAdjustDialogProps extends BaseProps {
  direction: AdjustmentDirection;
}

/** Product page "On Hand" / "Rejected / Bad" edit. Applies immediately — the
 * same create-then-approve sequence the Adjustments page runs as two actions,
 * run back-to-back through the ledger-guarded path — and is still recorded
 * under Inventory → Adjustments for the audit trail. */
export function StockAdjustDialog(props: StockAdjustDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Adjust Stock"
      size="md"
    >
      {props.open ? <AdjustBody key={props.direction} {...props} /> : null}
    </Dialog>
  );
}

function AdjustBody({
  onClose,
  productId,
  productLabel,
  warehouses,
  defaultWarehouseId,
  direction: initialDirection,
}: StockAdjustDialogProps) {
  const { toast } = useToast();
  const apply = useApplyAdjustment();
  const [warehouseId, setWarehouseId] = useState(
    String(defaultWarehouseId ?? warehouses[0]?.id ?? ""),
  );
  const [direction, setDirection] =
    useState<AdjustmentDirection>(initialDirection);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>(
    initialDirection === "OUT" ? "Damage" : ADJUSTMENT_REASONS[0]!,
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    if (!warehouseId) return setError("Select a warehouse");
    if (!qty || qty <= 0) return setError("Quantity must be a positive number");
    setError(null);
    try {
      await apply.mutateAsync({
        productId,
        warehouseId: Number(warehouseId),
        quantity: qty,
        direction,
        reason,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Stock updated", variant: "success" });
      onClose();
    } catch (err) {
      setError(errorText(err, "Failed to apply adjustment"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-theme-sm text-gray-500">{productLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Warehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.map((w) => ({
            value: String(w.id),
            label: w.name,
          }))}
        />
        <SelectField
          label="Direction"
          value={direction}
          onChange={(v) => setDirection(v as AdjustmentDirection)}
          options={[
            { value: "IN", label: "IN (increase)" },
            { value: "OUT", label: "OUT (decrease / write-off)" },
          ]}
        />
      </div>
      <TextField
        label="Quantity"
        type="number"
        min={0}
        step={0.001}
        value={quantity}
        onChange={setQuantity}
      />
      <SelectField
        label="Reason"
        value={reason}
        onChange={(v) => setReason(v as AdjustmentReason)}
        options={ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r }))}
      />
      <TextAreaField
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
      />
      <p className="text-theme-xs text-gray-500">
        Applies immediately and posts to the stock ledger — also recorded under
        Inventory → Adjustments for the audit trail.
      </p>
      {error ? (
        <p role="alert" className="text-theme-xs text-error-600">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={apply.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={apply.isPending}>
          Apply
        </Button>
      </div>
    </form>
  );
}

/** Product page "Reserved" edit. Instant, same as Inventory → Reservations
 * (a tracked reservation); releasing an existing one stays on that page. */
export function ReserveStockDialog(props: BaseProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Reserve Stock"
      size="md"
    >
      {props.open ? <ReserveBody {...props} /> : null}
    </Dialog>
  );
}

function ReserveBody({
  onClose,
  productId,
  productLabel,
  warehouses,
  defaultWarehouseId,
}: BaseProps) {
  const { toast } = useToast();
  const reserve = useCreateReservation();
  const [warehouseId, setWarehouseId] = useState(
    String(defaultWarehouseId ?? warehouses[0]?.id ?? ""),
  );
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    if (!warehouseId) return setError("Select a warehouse");
    if (!qty || qty <= 0) return setError("Quantity must be a positive number");
    setError(null);
    try {
      await reserve.mutateAsync({
        productId,
        warehouseId: Number(warehouseId),
        quantity: qty,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Stock reserved", variant: "success" });
      onClose();
    } catch (err) {
      setError(errorText(err, "Failed to reserve stock"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-theme-sm text-gray-500">{productLabel}</p>
      <SelectField
        label="Warehouse"
        value={warehouseId}
        onChange={setWarehouseId}
        options={warehouses.map((w) => ({
          value: String(w.id),
          label: w.name,
        }))}
      />
      <TextField
        label="Quantity to Reserve"
        type="number"
        min={0}
        step={0.001}
        value={quantity}
        onChange={setQuantity}
      />
      <TextAreaField
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
      />
      <p className="text-theme-xs text-gray-500">
        Applies immediately, same as Inventory → Reservations. To link this to a
        specific sales order, or to release an existing reservation, use that
        page instead.
      </p>
      {error ? (
        <p role="alert" className="text-theme-xs text-error-600">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={reserve.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={reserve.isPending}>
          Reserve
        </Button>
      </div>
    </form>
  );
}
