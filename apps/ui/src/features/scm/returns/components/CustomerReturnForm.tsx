"use client";

import type { CreateCustomerReturnInput } from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useMasterListItems } from "../../master-list-items/hooks";
import { formatQty, formatStatusLabel } from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import { useCustomerReturnSources } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
export function CustomerReturnForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCustomerReturnInput) => Promise<void>;
}) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="New Customer Return"
      size="2xl"
      className="sm:max-w-3xl"
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
  onSubmit: (input: CreateCustomerReturnInput) => Promise<void>;
}) {
  const sources = useCustomerReturnSources();
  const reasons = useMasterListItems({
    category: "return_reason",
    page: 1,
    limit: 100,
  });
  const reasonOptions = reasons.data?.data ?? [];
  const [fulfillmentId, setFulfillmentId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonDescription, setReasonDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fulfillment = (sources.data ?? []).find(
    (f) => String(f.fulfillmentId) === fulfillmentId,
  );
  const eligible = (fulfillment?.lines ?? []).filter((l) => l.eligibleQty > 0);

  function toggle(productId: number, eligibleQty: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else {
        next.add(productId);
        setQty((q) => ({
          ...q,
          [productId]: q[productId] ?? String(eligibleQty),
        }));
      }
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fulfillmentId)
      return setError("Select a fulfillment to return against");
    if (!reasonCode) return setError("Select a reason");
    const items = eligible
      .filter((l) => checked.has(l.productId))
      .map((l) => ({
        productId: l.productId,
        requestedQuantity: Number(qty[l.productId] || 0),
      }));
    if (items.length === 0)
      return setError("Select at least one item to return");
    for (const l of eligible) {
      if (!checked.has(l.productId)) continue;
      const q = Number(qty[l.productId] || 0);
      if (!(q > 0) || q > l.eligibleQty) {
        return setError(
          `${l.productCode}: quantity must be between 1 and ${l.eligibleQty}`,
        );
      }
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        fulfillmentId: Number(fulfillmentId),
        reasonCode,
        reasonDescription: reasonDescription || undefined,
        notes: notes || undefined,
        items,
      });
    } catch (err) {
      setError(errorText(err, "Failed to create return"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          aria-label="Fulfillment"
          value={fulfillmentId}
          onChange={(e) => {
            setFulfillmentId(e.target.value);
            setChecked(new Set());
          }}
        >
          <option value="">Select a fulfilled order</option>
          {(sources.data ?? [])
            .filter((f) => f.lines.some((l) => l.eligibleQty > 0))
            .map((f) => (
              <option key={f.fulfillmentId} value={f.fulfillmentId}>
                {f.fulfillmentNumber} — {f.salesOrderNumber} — {f.customerName}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Reason"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
        >
          <option value="">Select a reason</option>
          {reasonOptions.map((r) => (
            <option key={r.id} value={r.value}>
              {formatStatusLabel(r.value)}
            </option>
          ))}
        </Select>
      </div>
      {eligible.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          {eligible.map((l) => (
            <div
              key={l.productId}
              className="grid grid-cols-[auto_1fr_8rem] items-center gap-3"
            >
              <Checkbox
                aria-label={`Return ${l.productName}`}
                checked={checked.has(l.productId)}
                onChange={() => toggle(l.productId, l.eligibleQty)}
              />
              <span className="text-theme-sm">
                {l.productName}{" "}
                <span className="text-gray-500">({l.productCode})</span>{" "}
                <span className="text-theme-xs text-gray-500">
                  — eligible {formatQty(l.eligibleQty)}
                </span>
              </span>
              <Input
                type="number"
                min={0}
                max={l.eligibleQty}
                step={0.001}
                aria-label={`Quantity for ${l.productName}`}
                disabled={!checked.has(l.productId)}
                value={qty[l.productId] ?? ""}
                onChange={(e) =>
                  setQty((q) => ({ ...q, [l.productId]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      ) : fulfillmentId ? (
        <p className="text-theme-sm text-gray-500">
          Nothing on this order is still eligible to return.
        </p>
      ) : null}
      <Textarea
        aria-label="Reason description"
        placeholder="Reason details (optional)"
        rows={2}
        value={reasonDescription}
        onChange={(e) => setReasonDescription(e.target.value)}
      />
      <Textarea
        aria-label="Notes"
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create Return
        </Button>
      </div>
    </form>
  );
}
