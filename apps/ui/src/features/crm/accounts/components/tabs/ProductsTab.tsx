"use client";

import type { Opportunity } from "@texawave-erp/api-types";
import { ArrowLeft, Eye, Package, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/legacy-ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { OpportunityDrawer } from "@/features/crm/opportunities/components/OpportunityDrawer";
import { useRemoveOpportunityProduct } from "@/features/crm/opportunities/hooks";
import { usePermission } from "@/hooks/usePermission";
import type { AccountRelated } from "../../useAccountRelated";
import {
  CRM_DELETE_BTN_CLASS,
  formatRupees,
  SectionShell,
  TABLE_HEAD_STYLE,
  TH_CLASS,
  VIEW_BTN_CLASS,
} from "../accountUi";

const OPPORTUNITY_WRITE = [
  "crm.opportunity.write.own",
  "crm.opportunity.write.team",
  "crm.opportunity.write.all",
] as const;

/** Read-only rollup of every product line item across this account's deals. Products are only
 * added via a deal, so this tab surfaces that relationship (view the deal / delete a line). */
export function ProductsTab({
  products,
}: {
  products: AccountRelated["products"];
}) {
  const [active, setActive] = useState<Opportunity | null>(null);
  const canDelete = usePermission(OPPORTUNITY_WRITE);
  const removeMutation = useRemoveOpportunityProduct();

  if (active) {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => setActive(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
        </Button>
        <OpportunityDrawer
          opportunity={active}
          accountName={active.account.name}

          open
          onOpenChange={(o) => !o && setActive(null)}
          renderAs="page"
        />
      </div>
    );
  }

  const subtotal = products.reduce((s, p) => s + Number(p.item.total || 0), 0);

  return (
    <SectionShell
      title={`Products (${products.length})${products.length ? ` · Subtotal ${formatRupees(subtotal)}` : ""}`}
    >
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Products are added to this account's Deals — open a Deal to add line items."
        />
      ) : (
        <Table>
          <TableHeader className="text-white">
            <TableRow
              className="hover:bg-transparent border-none"
              style={TABLE_HEAD_STYLE}
            >
              <TableHead className={TH_CLASS}>Product</TableHead>
              <TableHead className={TH_CLASS}>Deal</TableHead>
              <TableHead className={TH_CLASS}>Qty</TableHead>
              <TableHead className={TH_CLASS}>Unit Price</TableHead>
              <TableHead className={TH_CLASS}>Total</TableHead>
              <TableHead className={`w-40 ${TH_CLASS}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(({ item: dp, opportunity: deal }) => (
              <TableRow
                key={dp.id}
                className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
              >
                <TableCell className="font-semibold text-slate-700 text-base py-1">
                  {dp.productName}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {deal.title || "—"}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {Number(dp.quantity)}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {formatRupees(dp.unitPrice)}
                </TableCell>
                <TableCell className="text-base font-semibold text-slate-700 py-1">
                  {formatRupees(dp.total)}
                </TableCell>
                <TableCell className="text-base py-1">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className={VIEW_BTN_CLASS}
                      title="View deal"
                      onClick={() => setActive(deal)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    {canDelete && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className={CRM_DELETE_BTN_CLASS}
                            title="Delete product line item"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        }
                        title="Delete this product line item?"
                        description={`"${dp.productName}" will be moved to the CRM Recycle Bin.`}
                        onConfirm={async () => {
                          await removeMutation.mutateAsync({
                            opportunityId: deal.id,
                            itemId: dp.id,
                          });
                        }}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionShell>
  );
}
