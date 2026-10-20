"use client";

import type { FulfillmentReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { Target } from "lucide-react";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useFulfillmentReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmFulfillmentReport`: order fulfillment, backorders and availability. */
export function FulfillmentReportView() {
  const query = useFulfillmentReport({});

  return (
    <ReportTableView<FulfillmentReportRow>
      title="Fulfillment Report"
      description="Order fulfillment progress: ordered vs. issued quantity and delivery status."
      icon={Target}
      noun="fulfillments"
      query={query}
      getRowKey={(r) => r.fulfillmentNumber}
      fileName="scm-fulfillment-report.csv"
      emptyDescription="Fulfillments will appear here once sales orders are claimed."
      columns={[
        {
          header: "Fulfillment #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.fulfillmentNumber}
            </span>
          ),
        },
        { header: "Sales Order", cell: (r) => r.salesOrder },
        { header: "Customer", cell: (r) => r.customer },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "Ordered",
          align: "right",
          cell: (r) => formatQty(r.orderedQty),
        },
        {
          header: "Issued",
          align: "right",
          cell: (r) => formatQty(r.issuedQty),
        },
        {
          header: "Delivery",
          cell: (r) => formatStatusLabel(r.deliveryStatus),
        },
        { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
      ]}
      csvColumns={[
        { header: "Fulfillment Number", value: (r) => r.fulfillmentNumber },
        { header: "Sales Order", value: (r) => r.salesOrder },
        { header: "Customer", value: (r) => r.customer },
        { header: "Status", value: (r) => r.status },
        { header: "Ordered Qty", value: (r) => r.orderedQty },
        { header: "Issued Qty", value: (r) => r.issuedQty },
        { header: "Delivery Status", value: (r) => r.deliveryStatus },
        { header: "Created At", value: (r) => r.createdAt },
        { header: "Delivered At", value: (r) => r.deliveredAt },
      ]}
    />
  );
}
