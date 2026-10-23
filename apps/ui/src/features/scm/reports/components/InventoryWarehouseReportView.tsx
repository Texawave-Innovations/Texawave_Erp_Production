"use client";

import { Tabs } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { InventoryReportView } from "./InventoryReportView";
import { WarehouseReportView } from "./WarehouseReportView";

const TABS = [
  { id: "inventory", label: "Inventory" },
  { id: "warehouse", label: "Warehouse" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Combined "Inventory & Warehouse" reports entry — one unified nav entry
 * tabbing between the Inventory and Warehouse reports (mirroring the same
 * consolidation already done for the main SCM sidebar's Inventory &
 * Warehouse nav group). The underlying report pages are unchanged and still
 * individually reachable at their own routes. */
export function InventoryWarehouseReportView() {
  const [tab, setTab] = useState<TabId>("inventory");

  return (
    <Tabs
      label="Inventory & Warehouse reports"
      idPrefix="inventory-warehouse-report"
      tabs={TABS}
      value={tab}
      onChange={setTab}
    >
      {tab === "inventory" ? <InventoryReportView /> : <WarehouseReportView />}
    </Tabs>
  );
}
