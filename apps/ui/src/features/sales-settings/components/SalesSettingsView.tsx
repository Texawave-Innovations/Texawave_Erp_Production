"use client";

import { PageHeader, Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { SalesSettingsTab } from "./SalesSettingsTab";
import { SealsSignaturesTab } from "./SealsSignaturesTab";
import { TermsInventoryTab } from "./TermsInventoryTab";

type TopLevelTab = "sales-settings" | "seals-signatures" | "terms-inventory";

const TABS: TabItem<TopLevelTab>[] = [
  { id: "sales-settings", label: "Sales Settings" },
  { id: "seals-signatures", label: "Seals & Signatures" },
  { id: "terms-inventory", label: "Terms & Inventory" },
];

/** "Sales & Document Masters" screen — the parent page for the whole
 * sales-settings module (Docs/SALES_SETTINGS_FOUNDATION.md). */
export function SalesSettingsView() {
  const [active, setActive] = useState<TopLevelTab>("sales-settings");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales & Document Masters"
        description="Company details, document numbering, banking, salespersons, seals, signatures, and sales terms used across quotations, orders, and invoices."
      />
      <Tabs
        label="Sales & Document Masters sections"
        idPrefix="sales-document-masters"
        tabs={TABS}
        value={active}
        onChange={setActive}
      >
        {active === "sales-settings" ? <SalesSettingsTab /> : null}
        {active === "seals-signatures" ? <SealsSignaturesTab /> : null}
        {active === "terms-inventory" ? <TermsInventoryTab /> : null}
      </Tabs>
    </div>
  );
}
