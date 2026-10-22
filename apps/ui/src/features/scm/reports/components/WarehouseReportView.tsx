"use client";

import type { WarehouseReportRow } from "@texawave-erp/api-types";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { formatStatusLabel } from "../../shared/format";
import { useWarehouseReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmWarehouseReport`: footprint and operations volume per warehouse. */
export function WarehouseReportView() {
  const query = useWarehouseReport();

  return (
    <ReportTableView<WarehouseReportRow>
      title="Warehouse Report"
      description="Warehouse footprint, location utilization and open operations."
      icon={WarehouseIcon}
      noun="warehouses"
      query={query}
      getRowKey={(r) => r.code}
      fileName="scm-warehouse-report.csv"
      emptyDescription="Warehouses will appear here once they're created."
      columns={[
        { header: "Warehouse", cell: (r) => r.warehouse },
        {
          header: "Code",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.code}</span>
          ),
        },
        { header: "Status", cell: (r) => formatStatusLabel(r.status) },
        {
          header: "Active Locations",
          align: "right",
          cell: (r) => r.activeLocations,
        },
        {
          header: "Occupied",
          align: "right",
          cell: (r) => r.occupiedLocations,
        },
        {
          header: "Pending Put-away",
          align: "right",
          cell: (r) => r.pendingPutaways,
        },
        {
          header: "Open Movements",
          align: "right",
          cell: (r) => r.openMovements,
        },
      ]}
      csvColumns={[
        { header: "Warehouse", value: (r) => r.warehouse },
        { header: "Code", value: (r) => r.code },
        { header: "Status", value: (r) => r.status },
        { header: "Active Locations", value: (r) => r.activeLocations },
        { header: "Occupied Locations", value: (r) => r.occupiedLocations },
        { header: "Pending Put-away", value: (r) => r.pendingPutaways },
        { header: "Open Movements", value: (r) => r.openMovements },
      ]}
    />
  );
}
