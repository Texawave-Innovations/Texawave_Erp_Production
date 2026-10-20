"use client";

import type { ProcurementReportRow } from "@texawave-erp/api-types";
import { LineChart } from "lucide-react";
import {
  formatDate,
  formatMoney,
  formatQty,
  formatStatusLabel,
} from "../../shared/format";
import { useProcurementReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmProcurementReport`: purchase analysis and PR/PO/GRN pipeline. */
export function ProcurementReportView() {
  const query = useProcurementReport({});

  return (
    <ReportTableView<ProcurementReportRow>
      title="Procurement Report"
      description="Purchase order pipeline, received quantity and committed spend."
      icon={LineChart}
      noun="purchase orders"
      query={query}
      getRowKey={(r) => r.poNumber}
      fileName="scm-procurement-report.csv"
      emptyDescription="Purchase orders will appear here once they're raised."
      columns={[
        {
          header: "PO #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.poNumber}</span>
          ),
        },
        { header: "Supplier", cell: (r) => r.supplier },
        { header: "Date", cell: (r) => formatDate(r.poDate) },
        { header: "Status", cell: (r) => formatStatusLabel(r.status) },
        { header: "Lines", align: "right", cell: (r) => r.lines },
        {
          header: "Ordered",
          align: "right",
          cell: (r) => formatQty(r.orderedQty),
        },
        {
          header: "Received",
          align: "right",
          cell: (r) => formatQty(r.receivedQty),
        },
        { header: "GRNs", align: "right", cell: (r) => r.goodsReceipts },
        { header: "Total", align: "right", cell: (r) => formatMoney(r.total) },
      ]}
      csvColumns={[
        { header: "PO Number", value: (r) => r.poNumber },
        { header: "Supplier", value: (r) => r.supplier },
        { header: "Date", value: (r) => r.poDate },
        { header: "Status", value: (r) => r.status },
        { header: "Lines", value: (r) => r.lines },
        { header: "Ordered Qty", value: (r) => r.orderedQty },
        { header: "Received Qty", value: (r) => r.receivedQty },
        { header: "Goods Receipts", value: (r) => r.goodsReceipts },
        { header: "Total", value: (r) => r.total },
      ]}
    />
  );
}
