"use client";

import type { ScmActivityRow } from "@texawave-erp/api-types";
import { ScrollText } from "lucide-react";
import { formatDateTime, formatStatusLabel } from "../../shared/format";
import { ScmListView } from "../../shared/ScmListView";
import { useListControls } from "../../shared/use-list-controls";
import { useQualityActivity } from "../hooks";

/** Legacy `ScmQualityActivity`: audit trail of QC inspections, defects,
 * templates and quarantine changes. */
export function QualityActivityView() {
  const c = useListControls(20);
  const query = useQualityActivity({ page: c.page, limit: c.pageSize, q: c.q });

  return (
    <ScmListView<ScmActivityRow>
      title="Quality Activity"
      description="Audit trail of QC inspections, defects, templates and quarantine changes."
      icon={ScrollText}
      noun="activity entries"
      readPermission="scm.quality.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by action or reason...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No activity yet"
      emptyDescription="Changes to inspections, defects, templates and quarantine appear here."
      columns={[
        { header: "When", cell: (r) => formatDateTime(r.at) },
        {
          header: "Entity",
          cell: (r) => formatStatusLabel(r.entityType.replace("scm_", "")),
        },
        { header: "Action", cell: (r) => formatStatusLabel(r.action) },
        { header: "By", cell: (r) => r.byName ?? "System" },
        { header: "Reason", cell: (r) => r.reason ?? "—" },
      ]}
    />
  );
}
