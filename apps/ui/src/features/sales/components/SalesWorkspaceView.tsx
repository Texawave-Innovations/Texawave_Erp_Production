"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { useAuthStore } from "@/stores/auth-store";
import { CustomersView } from "@/features/sales/customers/components/CustomersView";
import { QuotationsView } from "@/features/sales/quotations/components/QuotationsView";
import { InvoicesView } from "@/features/sales/invoices/components/InvoicesView";
import { ChallansView } from "@/features/sales/delivery-challans/components/ChallanViews";
import { RdcsView } from "@/features/sales/returnable-dcs/components/RdcViews";
import { PaymentsView } from "@/features/sales/payments/components/PaymentsView";
import {
  SALES_TABS,
  salesTabHref,
  type SalesTabId,
} from "@/features/sales/shared/tabs";

/**
 * Sales documents as one tabbed workspace, like Purchases: every list view
 * is the existing screen, switched via the `tab` query param on `/sales`.
 * Each view keeps its own banner header (count + "New" action). Create /
 * edit / detail stay on their own routes and link back to `salesTabHref`.
 * Tabs the user cannot read are hidden; the API stays the real guard.
 */
export function SalesWorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = useAuthStore((s) => s.permissions);

  const tabs: readonly TabItem<SalesTabId>[] = SALES_TABS.filter((t) =>
    permissions.includes(t.read),
  ).map(({ id, label }) => ({ id, label }));

  const requested = searchParams.get("tab");
  const tab = tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id;

  const setTab = useCallback(
    (id: SalesTabId) => router.replace(salesTabHref(id), { scroll: false }),
    [router],
  );

  if (!tab) {
    return (
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        You don&apos;t have access to any Sales screens.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Sales sections"
        idPrefix="sales"
        tabs={tabs}
        value={tab}
        onChange={setTab}
      >
        {tab === "customers" ? (
          <CustomersView />
        ) : tab === "quotations" ? (
          <QuotationsView />
        ) : tab === "proforma-invoices" ? (
          <InvoicesView key="PROFORMA" invoiceType="PROFORMA" />
        ) : tab === "tax-invoices" ? (
          <InvoicesView key="TAX" invoiceType="TAX" />
        ) : tab === "delivery-challans" ? (
          <ChallansView />
        ) : tab === "returnable-dcs" ? (
          <RdcsView />
        ) : (
          <PaymentsView />
        )}
      </Tabs>
    </div>
  );
}
