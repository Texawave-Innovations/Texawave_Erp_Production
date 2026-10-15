"use client";

import { Button, Dialog, Skeleton, useToast } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { AddProductsDialog } from "./AddProductsDialog";
import { useOpportunityProducts, useRemoveOpportunityProduct } from "../hooks";

/** The Deal Products section of the Opportunity drawer — the real,
 * persisted relationship to the CRM Products catalog
 * (Docs/CRM_PRODUCTS_LEGACY_PARITY.md §4/§6). Reproduces legacy
 * DealDetail.tsx's Products tab: a line-item table (snapshotted
 * name/unit price/tax/total, never re-reading the live catalog) plus
 * "Add Products" (AddProductsDialog) and a per-line Remove action. */
export function DealProductsSection({
  opportunityId,
}: {
  opportunityId: number;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();
  const query = useOpportunityProducts(opportunityId);
  const removeMutation = useRemoveOpportunityProduct();

  async function handleRemove(itemId: number) {
    try {
      await removeMutation.mutateAsync({ opportunityId, itemId });
      toast({ title: "Product removed from deal", variant: "success" });
    } catch {
      toast({ title: "Could not remove this product", variant: "error" });
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
          Products {query.data ? `(${query.data.length})` : ""}
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          Add Products
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-theme-xs text-gray-400">
          No products added to this deal yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-theme-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="py-1 pr-2 font-medium">Product</th>
                <th className="py-1 pr-2 font-medium">Qty</th>
                <th className="py-1 pr-2 font-medium">Unit Price</th>
                <th className="py-1 pr-2 font-medium">Discount %</th>
                <th className="py-1 pr-2 font-medium">Tax %</th>
                <th className="py-1 pr-2 font-medium">Total</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {query.data.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200">
                    {item.productName}
                  </td>
                  <td className="py-1.5 pr-2">{item.quantity}</td>
                  <td className="py-1.5 pr-2">{item.unitPrice}</td>
                  <td className="py-1.5 pr-2">{item.discountPercent ?? "0"}</td>
                  <td className="py-1.5 pr-2">{item.taxPercent ?? "0"}</td>
                  <td className="py-1.5 pr-2 font-medium">{item.total}</td>
                  <td className="py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemove(item.id)}
                      aria-label={`Remove ${item.productName}`}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add products"
      >
        <AddProductsDialog
          opportunityId={opportunityId}
          onDone={() => setAddOpen(false)}
          onCancel={() => setAddOpen(false)}
        />
      </Dialog>
    </section>
  );
}
