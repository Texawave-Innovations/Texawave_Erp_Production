"use client";

import type { InventoryReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { BarChart3 } from "lucide-react";
import { formatMoney, formatQty, scmStatusToken } from "../../shared/format";
import { useInventoryReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmInventoryReport`: stock valuation and low/out-of-stock exposure. */
export function InventoryReportView() {
  const query = useInventoryReport({});

  return (
    <ReportTableView<InventoryReportRow>
      title="Inventory Report"
      description="Stock valuation by product and warehouse, with low/out-of-stock exposure."
      icon={BarChart3}
      noun="stock rows"
      query={query}
      getRowKey={(r) => `${r.productCode}-${r.warehouse}`}
      fileName="scm-inventory-report.xlsx"
      emptyDescription="Stock balances will appear here once products have inventory."
      columns={[
        {
          header: "Product",
          cell: (r) => `${r.productName} (${r.productCode})`,
        },
        { header: "Warehouse", cell: (r) => r.warehouse },
        { header: "On Hand", align: "right", cell: (r) => formatQty(r.onHand) },
        {
          header: "Reserved",
          align: "right",
          cell: (r) => formatQty(r.reserved),
        },
        {
          header: "Available",
          align: "right",
          cell: (r) => formatQty(r.available),
        },
        {
          header: "Incoming",
          align: "right",
          cell: (r) => formatQty(r.incoming),
        },
        {
          header: "Valuation",
          align: "right",
          cell: (r) => formatMoney(r.valuation),
        },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={r.status}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
      ]}
      exportColumns={[
        { header: "Product Code", value: (r) => r.productCode },
        { header: "Product Name", value: (r) => r.productName },
        { header: "Warehouse", value: (r) => r.warehouse },
        { header: "On Hand", value: (r) => r.onHand, type: "number" },
        { header: "Reserved", value: (r) => r.reserved, type: "number" },
        { header: "Available", value: (r) => r.available, type: "number" },
        { header: "Incoming", value: (r) => r.incoming, type: "number" },
        { header: "Damaged", value: (r) => r.damaged, type: "number" },
        { header: "Quarantine", value: (r) => r.quarantine, type: "number" },
        { header: "Valuation", value: (r) => r.valuation, type: "amount" },
        { header: "Status", value: (r) => r.status },
      ]}
    />
  );
}
