"use client";

import type { QualityReportRow } from "@texawave-erp/api-types";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { ShieldCheck } from "lucide-react";
import {
  formatDate,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useQualityReport } from "../hooks";
import { ReportTableView } from "./ReportTableView";

/** Legacy `ScmQualityReport`: QC results, defect mix and quarantine trend. */
export function QualityReportView() {
  const query = useQualityReport({});

  return (
    <ReportTableView<QualityReportRow>
      title="Quality Report"
      description="QC inspection results and defect counts by source type."
      icon={ShieldCheck}
      noun="inspections"
      query={query}
      getRowKey={(r) => r.inspectionNumber}
      fileName="scm-quality-report.csv"
      emptyDescription="QC inspections will appear here once one is created."
      columns={[
        {
          header: "Inspection #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.inspectionNumber}
            </span>
          ),
        },
        { header: "Type", cell: (r) => formatStatusLabel(r.type) },
        { header: "Source", cell: (r) => r.source },
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
          header: "Result",
          cell: (r) =>
            r.result ? (
              <StatusBadge
                label={formatStatusLabel(r.result)}
                colorToken={scmStatusToken(r.result)}
              />
            ) : (
              "—"
            ),
        },
        { header: "Defects", align: "right", cell: (r) => r.defects },
        { header: "Date", cell: (r) => formatDate(r.inspectionDate) },
      ]}
      csvColumns={[
        { header: "Inspection Number", value: (r) => r.inspectionNumber },
        { header: "Type", value: (r) => r.type },
        { header: "Source", value: (r) => r.source },
        { header: "Status", value: (r) => r.status },
        { header: "Result", value: (r) => r.result },
        { header: "Defects", value: (r) => r.defects },
        { header: "Inspection Date", value: (r) => r.inspectionDate },
        { header: "Completed At", value: (r) => r.completedAt },
      ]}
    />
  );
}
