"use client";

import type { LogisticsReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { Truck } from "lucide-react";
import {
  formatDateTime,
  formatMoney,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useLogisticsReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmLogisticsReport`: shipment status, delays and freight analysis. */
export function LogisticsReportView() {
  const query = useLogisticsReport({});

  return (
    <ReportTableView<LogisticsReportRow>
      title="Logistics Report"
      description="Shipment status, carrier performance and freight cost."
      icon={Truck}
      noun="shipments"
      query={query}
      getRowKey={(r) => r.shipmentNumber}
      fileName="scm-logistics-report.csv"
      emptyDescription="Shipments will appear here once fulfillments are packed and shipped."
      columns={[
        {
          header: "Shipment #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.shipmentNumber}</span>
          ),
        },
        { header: "Customer", cell: (r) => r.customer },
        { header: "Carrier", cell: (r) => r.carrier },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        { header: "Packages", align: "right", cell: (r) => r.packages },
        {
          header: "Shipping Cost",
          align: "right",
          cell: (r) => formatMoney(r.shippingCost),
        },
        { header: "Dispatched", cell: (r) => formatDateTime(r.dispatchedAt) },
        { header: "Delivered", cell: (r) => formatDateTime(r.deliveredAt) },
      ]}
      csvColumns={[
        { header: "Shipment Number", value: (r) => r.shipmentNumber },
        { header: "Customer", value: (r) => r.customer },
        { header: "Carrier", value: (r) => r.carrier },
        { header: "Status", value: (r) => r.status },
        { header: "Packages", value: (r) => r.packages },
        { header: "Shipping Cost", value: (r) => r.shippingCost },
        { header: "Dispatched At", value: (r) => r.dispatchedAt },
        { header: "Delivered At", value: (r) => r.deliveredAt },
      ]}
    />
  );
}
