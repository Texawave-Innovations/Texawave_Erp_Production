"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { ScmPanelHost } from "@/features/scm/shared/ScmPanel";
import { SuppliersView } from "@/features/scm/suppliers/components/SuppliersView";
import { RequisitionsView } from "@/features/scm/procurement/components/RequisitionsView";
import { RfqsView } from "@/features/scm/procurement/components/RfqsView";
import { QuotationsView } from "@/features/scm/procurement/components/QuotationsView";
import { QuotationComparisonView } from "@/features/scm/procurement/components/QuotationComparisonView";
import { PurchaseOrdersView } from "@/features/scm/procurement/components/PurchaseOrdersView";
import { GoodsReceiptsView } from "@/features/scm/procurement/components/GoodsReceiptsView";
import { PaymentsMadeView } from "@/features/finance/payments-made/components/PaymentsMadeView";

type PurchasesTabId =
  | "vendors"
  | "requisitions"
  | "rfqs"
  | "quotations"
  | "comparison"
  | "purchase-orders"
  | "goods-receipts"
  | "payments-made";

const TABS: readonly TabItem<PurchasesTabId>[] = [
  { id: "vendors", label: "Suppliers" },
  { id: "requisitions", label: "Material Requisitions" },
  { id: "rfqs", label: "RFQs" },
  { id: "quotations", label: "Supplier Quotations" },
  { id: "comparison", label: "Quotation Comparison" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "goods-receipts", label: "Goods Receipts" },
  { id: "payments-made", label: "Payments Made" },
];

/**
 * Purchases is a thin tabbed shell over existing SCM/Finance screens — no new
 * data model (Docs/ARCHITECTURE.md §5.6). Every tab reuses the real SCM
 * procurement pipeline as-is: Suppliers = scm/suppliers, Material Requisitions =
 * scm/procurement/requisitions, RFQs = scm/procurement/rfqs, Supplier
 * Quotations = scm/procurement/quotations, Quotation Comparison =
 * scm/procurement/comparison, Purchase Orders =
 * scm/procurement/purchase-orders, Goods Receipts =
 * scm/procurement/goods-receipts, Payments Made = finance/payments-made.
 * Supplier Quotations is included alongside Quotation Comparison even though
 * it isn't its own task-sheet line item — Comparison has nothing to compare
 * without a place to record quotations first.
 * Switching tabs updates the `tab` query param on this one route instead of
 * navigating to those screens' own routes, so it behaves like a real tab
 * switch rather than a full page-to-page navigation.
 */
export function PurchasesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as PurchasesTabId | null) ?? "vendors";

  const setTab = useCallback(
    (id: PurchasesTabId) => {
      router.replace(`/purchases?tab=${id}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Purchase Management
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Manage vendor directory, purchase requisitions, RFQs, quotations,
          purchase orders, goods receipts, and payment records.
        </p>
      </div>

      <Tabs
        label="Purchases sections"
        idPrefix="purchases"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {/* Every embedded SCM view below opens its create/edit forms through
         * the shared `ScmPanel` component. On the standalone /scm/* pages,
         * `ScmShell` provides this same `ScmPanelHost` so a form portals into
         * a slot above the list, auto-scrolls into view, and hides the list
         * underneath — without it, `ScmPanel` falls back to rendering the
         * form inline wherever it sits in the tree (after the table), with no
         * scroll and no visual cue, which reads as "did clicking New do
         * anything?" until the user scrolls down to find it. */}
        <ScmPanelHost>
          {tab === "vendors" ? (
            <SuppliersView />
          ) : tab === "requisitions" ? (
            <RequisitionsView />
          ) : tab === "rfqs" ? (
            <Suspense>
              <RfqsView />
            </Suspense>
          ) : tab === "quotations" ? (
            <Suspense>
              <QuotationsView />
            </Suspense>
          ) : tab === "comparison" ? (
            <Suspense>
              <QuotationComparisonView />
            </Suspense>
          ) : tab === "purchase-orders" ? (
            <Suspense>
              <PurchaseOrdersView />
            </Suspense>
          ) : tab === "goods-receipts" ? (
            <Suspense>
              <GoodsReceiptsView />
            </Suspense>
          ) : (
            <PaymentsMadeView />
          )}
        </ScmPanelHost>
      </Tabs>
    </div>
  );
}
