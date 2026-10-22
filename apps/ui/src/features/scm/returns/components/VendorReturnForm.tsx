"use client";

import type { CreateVendorReturnInput } from "@texawave-erp/api-types";
import { RETURN_REASON_CODES } from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { formatQty, formatStatusLabel } from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import { useVendorReturnSources } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
export function VendorReturnForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVendorReturnInput) => Promise<void>;
}) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="New Vendor Return"
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
  onSubmit: (input: CreateVendorReturnInput) => Promise<void>;
}) {
  const sources = useVendorReturnSources();
  const [grnId, setGrnId] = useState("");
  const [reasonCode, setReasonCode] = useState<
    (typeof RETURN_REASON_CODES)[number]
  >(RETURN_REASON_CODES[0]);
  const [reasonDescription, setReasonDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grn = (sources.data ?? []).find((g) => String(g.grnId) === grnId);
  const eligible = (grn?.lines ?? []).filter((l) => l.eligibleQty > 0);

  function toggle(grnItemId: number, eligibleQty: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(grnItemId)) next.delete(grnItemId);
      else {
        next.add(grnItemId);
        setQty((q) => ({
          ...q,
          [grnItemId]: q[grnItemId] ?? String(eligibleQty),
        }));
      }
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!grnId) return setError("Select a goods receipt to return against");
    const items = eligible
      .filter((l) => checked.has(l.grnItemId))
      .map((l) => ({
        grnItemId: l.grnItemId,
        requestedQuantity: Number(qty[l.grnItemId] || 0),
        ...(l.serialNumbers.length > 0
          ? { serialNumbers: l.serialNumbers }
          : {}),
      }));
    if (items.length === 0)
      return setError("Select at least one item to return");
    for (const l of eligible) {
      if (!checked.has(l.grnItemId)) continue;
      const q = Number(qty[l.grnItemId] || 0);
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
        grnId: Number(grnId),
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
          aria-label="Goods receipt"
          value={grnId}
          onChange={(e) => {
            setGrnId(e.target.value);
            setChecked(new Set());
          }}
        >
          <option value="">Select a received GRN</option>
          {(sources.data ?? [])
            .filter((g) => g.lines.some((l) => l.eligibleQty > 0))
            .map((g) => (
              <option key={g.grnId} value={g.grnId}>
                {g.grnNumber} — {g.poNumber} — {g.supplierName}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Reason"
          value={reasonCode}
          onChange={(e) =>
            setReasonCode(
              e.target.value as (typeof RETURN_REASON_CODES)[number],
            )
          }
        >
          {RETURN_REASON_CODES.map((r) => (
            <option key={r} value={r}>
              {formatStatusLabel(r)}
            </option>
          ))}
        </Select>
      </div>
      {eligible.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          {eligible.map((l) => (
            <div
              key={l.grnItemId}
              className="grid grid-cols-[auto_1fr_8rem] items-center gap-3"
            >
              <Checkbox
                aria-label={`Return ${l.productName}`}
                checked={checked.has(l.grnItemId)}
                onChange={() => toggle(l.grnItemId, l.eligibleQty)}
              />
              <span className="text-theme-sm">
                {l.productName}{" "}
                <span className="text-gray-500">({l.productCode})</span>
                {l.batchNumber ? (
                  <span className="text-theme-xs text-gray-500">
                    {" "}
                    batch {l.batchNumber}
                  </span>
                ) : null}{" "}
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
                disabled={!checked.has(l.grnItemId)}
                value={qty[l.grnItemId] ?? ""}
                onChange={(e) =>
                  setQty((q) => ({ ...q, [l.grnItemId]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      ) : grnId ? (
        <p className="text-theme-sm text-gray-500">
          Nothing on this GRN is still eligible to return.
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
