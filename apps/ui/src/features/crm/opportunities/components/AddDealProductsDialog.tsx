"use client";

// Searchable multi-select product picker used from a Deal's Products tab (legacy
// `domain/AddDealProductsDialog.tsx`). `unitPrice`/`taxPercent` are snapshotted server-side from
// the live product when the line is added.
import { Button } from "@/components/legacy-ui/button";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Input } from "@/components/legacy-ui/input";
import { cn } from "@/components/legacy-ui/utils";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { Package, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useProducts } from "../../products/hooks";
import { useAddOpportunityProducts } from "../hooks";
import { fmtIN } from "../pipelineConfig";

interface SelectedLine {
  quantity: number;
  discountPercent: number;
}

export function AddDealProductsDialog({
  open,
  onOpenChange,
  opportunityId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunityId: number;
  opportunityTitle?: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<number, SelectedLine>>({});

  const productsQuery = useProducts({
    limit: 100,
    q: query.trim() || undefined,
  });
  const addMutation = useAddOpportunityProducts();

  const filtered = useMemo(
    () => (productsQuery.data?.data ?? []).filter((p) => p.isActive),
    [productsQuery.data],
  );

  const toggle = (productId: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[productId]) delete next[productId];
      else next[productId] = { quantity: 1, discountPercent: 0 };
      return next;
    });
  };

  const updateLine = (productId: number, patch: Partial<SelectedLine>) => {
    setSelected((prev) => ({
      ...prev,
      [productId]: { ...prev[productId]!, ...patch },
    }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleAdd = async () => {
    if (selectedCount === 0) return;
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
      toast.success(
        `${selectedCount} product${selectedCount === 1 ? "" : "s"} added to deal`,
      );
      setSelected({});
      setQuery("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to add products to deal. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-600" /> Add Products to Deal
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-8 h-9 rounded-xl"
          />
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active products found"
              description="Add products from the Products tab first."
            />
          ) : (
            filtered.map((p) => {
              const line = selected[p.id];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-colors",
                    line
                      ? "border-brand-300 bg-brand-50/40"
                      : "border-slate-200/80 bg-white",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={!!line}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggle(p.id)}
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {p.name}
                      </p>
                      <p className="text-sm text-slate-400">
                        {p.code} · ₹{fmtIN(p.unitPrice)}
                        {Number(p.taxPercent)
                          ? ` · ${Number(p.taxPercent)}% tax`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {line && (
                    <div className="grid grid-cols-2 gap-2 mt-2.5 pl-7">
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(p.id, {
                              quantity: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            })
                          }
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Discount %
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(e) =>
                            updateLine(p.id, {
                              discountPercent: Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={selectedCount === 0 || addMutation.isPending}
            onClick={() => void handleAdd()}
          >
            {addMutation.isPending
              ? "Adding…"
              : `Add ${selectedCount || ""} Product${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
