"use client";

import type { SupplierReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { Users } from "lucide-react";
import { formatMoney, scmStatusToken } from "../../shared/format";
import { useSuppliersReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmSupplierReport`: supplier spend, receipts and returns. */
export function SuppliersReportView() {
  const query = useSuppliersReport();

  return (
    <ReportTableView<SupplierReportRow>
      title="Supplier Report"
      description="Supplier spend, purchase orders, goods receipts and vendor returns."
      icon={Users}
      noun="suppliers"
      query={query}
      getRowKey={(r) => r.supplier}
      fileName="scm-supplier-report.csv"
      emptyDescription="Suppliers will appear here once they're added."
      columns={[
        { header: "Supplier", cell: (r) => r.supplier },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={r.status}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "Purchase Orders",
          align: "right",
          cell: (r) => r.purchaseOrders,
        },
        {
          header: "Total Spend",
          align: "right",
          cell: (r) => formatMoney(r.totalSpend),
        },
        {
          header: "Goods Receipts",
          align: "right",
          cell: (r) => r.goodsReceipts,
        },
        {
          header: "Vendor Returns",
          align: "right",
          cell: (r) => r.vendorReturns,
        },
      ]}
      csvColumns={[
        { header: "Supplier", value: (r) => r.supplier },
        { header: "Status", value: (r) => r.status },
        { header: "Purchase Orders", value: (r) => r.purchaseOrders },
        { header: "Total Spend", value: (r) => r.totalSpend },
        { header: "Goods Receipts", value: (r) => r.goodsReceipts },
        { header: "Vendor Returns", value: (r) => r.vendorReturns },
      ]}
    />
  );
}
