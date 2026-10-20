"use client";

import type { ReturnsReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { Undo2 } from "lucide-react";
import {
  formatDate,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useReturnsReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmReturnsReport`: return volume, reasons, dispositions. */
export function ReturnsReportView() {
  const query = useReturnsReport({});

  return (
    <ReportTableView<ReturnsReportRow>
      title="Returns Report"
      description="Return volume by reason, type and status, with dispositioned quantity."
      icon={Undo2}
      noun="returns"
      query={query}
      getRowKey={(r) => r.returnNumber}
      fileName="scm-returns-report.csv"
      emptyDescription="Returns will appear here once customers or vendors raise one."
      columns={[
        {
          header: "Return #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.returnNumber}</span>
          ),
        },
        { header: "Type", cell: (r) => formatStatusLabel(r.type) },
        { header: "Party", cell: (r) => r.party },
        { header: "Reason", cell: (r) => formatStatusLabel(r.reasonCode) },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        { header: "Lines", align: "right", cell: (r) => r.lines },
        {
          header: "Dispositioned",
          align: "right",
          cell: (r) => formatQty(r.dispositionedQty),
        },
        { header: "Requested", cell: (r) => formatDate(r.requestedDate) },
      ]}
      csvColumns={[
        { header: "Return Number", value: (r) => r.returnNumber },
        { header: "Type", value: (r) => r.type },
        { header: "Party", value: (r) => r.party },
        { header: "Reason", value: (r) => r.reasonCode },
        { header: "Status", value: (r) => r.status },
        { header: "Lines", value: (r) => r.lines },
        { header: "Dispositioned Qty", value: (r) => r.dispositionedQty },
        { header: "Requested Date", value: (r) => r.requestedDate },
        { header: "Completed At", value: (r) => r.completedAt },
      ]}
    />
  );
}
