// CRM Core Domain — searchable multi-select product picker used from a Deal's Products tab
// (`DealDetail.tsx`) to attach one or more `CrmProduct`s as `CrmDealProduct` line items.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  addCrmDealProducts,
  computeDealProductTotal,
} from "./dealProductsService";
import { CrmProduct } from "./types";
import { EmptyState } from "../intelligence/components";

interface SelectedLine {
  quantity: number;
  discountPercent: number;
}

export function AddDealProductsDialog({
  open,
  onOpenChange,
  products,
  opportunityId,
  opportunityTitle,
  currentUser,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: CrmProduct[];
  opportunityId: string;
  opportunityTitle: string;
  currentUser: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, SelectedLine>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const activeOnly = products.filter((p) => p.active);
    const q = query.trim().toLowerCase();
    if (!q) return activeOnly;
    return activeOnly.filter((p) =>
      [p.name, p.code, p.category]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [products, query]);

  const toggle = (product: CrmProduct) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        next[product.id] = { quantity: 1, discountPercent: 0 };
      }
      return next;
    });
  };

  const updateLine = (productId: string, patch: Partial<SelectedLine>) => {
    setSelected((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleAdd = async () => {
    if (selectedCount === 0) return;
    setSaving(true);
    try {
      const items = Object.entries(selected)
        .map(([productId, line]) => {
          const product = products.find((p) => p.id === productId);
          if (!product) return null;
          return {
            productId,
            productName: product.name,
            quantity: line.quantity,
            unitPrice: product.unitPrice,
            discountPercent: line.discountPercent,
            taxPercent: product.taxPercent || 0,
            total: computeDealProductTotal(
              line.quantity,
              product.unitPrice,
              line.discountPercent,
              product.taxPercent || 0,
            ),
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);

      await addCrmDealProducts(
        opportunityId,
        opportunityTitle,
        items,
        currentUser,
      );
      toast.success(
        `${items.length} product${items.length === 1 ? "" : "s"} added to deal`,
      );
      setSelected({});
      setQuery("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to add products to deal:", err);
      toast.error("Failed to add products to deal. Please try again.");
    } finally {
      setSaving(false);
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
              const isSelected = !!selected[p.id];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-colors",
                    isSelected
                      ? "border-brand-300 bg-brand-50/40"
                      : "border-slate-200/80 bg-white",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(p)}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggle(p)}
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {p.name}
                      </p>
                      <p className="text-sm text-slate-400">
                        {p.code} · ₹{p.unitPrice.toLocaleString("en-IN")}
                        {p.taxPercent ? ` · ${p.taxPercent}% tax` : ""}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="grid grid-cols-2 gap-2 mt-2.5 pl-7">
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={selected[p.id].quantity}
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
                          value={selected[p.id].discountPercent}
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
            disabled={selectedCount === 0 || saving}
            onClick={handleAdd}
          >
            {saving
              ? "Adding…"
              : `Add ${selectedCount || ""} Product${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
