"use client";

import { Button, Checkbox, EmptyState, Input } from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import { useProducts } from "../../products/hooks";
import { useAddOpportunityProducts } from "../hooks";

interface SelectedLine {
  quantity: number;
  discountPercent: number;
}

/** Reproduces legacy domain/AddDealProductsDialog.tsx: a searchable
 * multi-select over ACTIVE products only, each with a quantity (min 1)
 * and discount % (0-100) once selected. `unitPrice`/`taxPercent` are
 * never shown as editable here — they are snapshotted server-side from
 * the live product at add time. */
export function AddProductsDialog({
  opportunityId,
  onDone,
  onCancel,
}: {
  opportunityId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<number, SelectedLine>>({});
  const [error, setError] = useState<string | null>(null);
  const productsQuery = useProducts({ limit: 100, q: query || undefined });
  const addMutation = useAddOpportunityProducts();

  const activeProducts = useMemo(
    () => (productsQuery.data?.data ?? []).filter((p) => p.isActive),
    [productsQuery.data],
  );

  function toggle(productId: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = { quantity: 1, discountPercent: 0 };
      }
      return next;
    });
  }

  function updateLine(productId: number, patch: Partial<SelectedLine>) {
    setSelected((prev) => ({
      ...prev,
      [productId]: { ...prev[productId]!, ...patch },
    }));
  }

  const selectedCount = Object.keys(selected).length;

  async function handleAdd() {
    if (selectedCount === 0) return;
    setError(null);
    try {
      await addMutation.mutateAsync({
        opportunityId,
        input: {
          items: Object.entries(selected).map(([productId, line]) => ({
            productId: Number(productId),
            quantity: line.quantity,
            discountPercent: line.discountPercent,
          })),
        },
      });
      onDone();
    } catch {
      setError("Could not add these products — please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
        Add Products to Deal
      </h2>
      <Input
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-96 overflow-y-auto space-y-2">
        {activeProducts.length === 0 ? (
          <EmptyState
            title="No active products found"
            description="Add products from the Products catalog first."
          />
        ) : (
          activeProducts.map((p) => {
            const isSelected = Boolean(selected[p.id]);
            return (
              <div
                key={p.id}
                className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggle(p.id)}
                  />
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => toggle(p.id)}
                  >
                    <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">
                      {p.name}
                    </p>
                    <p className="text-theme-xs text-gray-400">
                      {p.code} · {p.unitPrice}
                      {p.taxPercent ? ` · ${p.taxPercent}% tax` : ""}
                    </p>
                  </div>
                </div>
                {isSelected ? (
                  <div className="grid grid-cols-2 gap-2 mt-2 pl-7">
                    <div>
                      <label className="text-theme-xs font-medium text-gray-500">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={selected[p.id]!.quantity}
                        onChange={(e) =>
                          updateLine(p.id, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-theme-xs font-medium text-gray-500">
                        Discount %
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={selected[p.id]!.discountPercent}
                        onChange={(e) =>
                          updateLine(p.id, {
                            discountPercent: Math.min(
                              100,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {error ? <p className="text-theme-xs text-error-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={addMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={selectedCount === 0}
          loading={addMutation.isPending}
          onClick={() => void handleAdd()}
        >
          {`Add ${selectedCount || ""} Product${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
