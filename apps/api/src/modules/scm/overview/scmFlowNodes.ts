export interface ScmFlowNode {
  id: string;
  label: string;
  path: string;
  /** Descriptive text used by the list view, e.g. "128 active suppliers". */
  metric: string;
  /** Headline number/short value shown under the stage illustration, e.g. "128", "—". */
  value: string;
  /** Short caption under the value, e.g. "Active Suppliers". */
  caption: string;
}

/** The primary SCM flow: SUPPLIERS → PROCUREMENT → INVENTORY & WAREHOUSE → ORDERS → QUALITY →
 * REPORTS. Inventory and Warehouse were consolidated into one stage (client request: "club
 * Inventory and Warehouse together and bring a flow"); Logistics and Returns are no longer part
 * of the primary flow (client request: "remove logistics" / "remove return") though both remain
 * fully reachable elsewhere in SCM (Orders, Quality, Ledger, Barcode, Reports) — only their
 * standalone flow stage and sidebar entries were removed. Driven by real counts from
 * `useScmOverviewData`; a stage shows "—" only when no data source exists yet. */
export function buildScmFlowNodes(opts: {
  supplierCount: number;
  openRequisitionCount: number;
  inventoryUnitsAvailable: number;
  openSalesOrderCount: number;
  openInspectionCount: number;
  /** Shows "…" instead of a false "0" while the data is loading. */
  loading?: boolean;
}): ScmFlowNode[] {
  const units = opts.inventoryUnitsAvailable.toLocaleString("en-IN");
  const v = (n: number | string) => (opts.loading ? "…" : String(n));

  return [
    {
      id: "suppliers",
      label: "Suppliers",
      path: "/scm/suppliers",
      value: v(opts.supplierCount),
      caption: "Active Suppliers",
      metric: `${opts.supplierCount} active suppliers`,
    },
    {
      id: "procurement",
      label: "Procurement",
      path: "/scm/procurement/purchase-orders",
      value: v(opts.openRequisitionCount),
      caption: "Open Requisitions",
      metric: `${opts.openRequisitionCount} open purchase requisitions`,
    },
    {
      id: "inventory-warehouse",
      label: "Inventory",
      path: "/scm/inventory/overview",
      value: v(units),
      caption: "Units Available",
      metric: `${units} units available across all warehouses`,
    },
    {
      id: "orders",
      label: "Orders",
      path: "/scm/orders/sales-orders",
      value: v(opts.openSalesOrderCount),
      caption: "Open Orders",
      metric: `${opts.openSalesOrderCount} open orders`,
    },
    {
      id: "quality",
      label: "Quality",
      path: "/scm/quality",
      value: v(opts.openInspectionCount),
      caption: "Open Inspections",
      metric: `${opts.openInspectionCount} inspections pending or in progress`,
    },
    {
      id: "reports",
      label: "Reports",
      path: "/scm/reports",
      value: "—",
      caption: "Executive Summary",
      metric: "Open the Reports dashboard for full SCM analytics",
    },
  ];
}
