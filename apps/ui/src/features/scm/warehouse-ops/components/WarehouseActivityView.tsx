"use client";

import type { ScmActivityRow } from "@texawave-erp/api-types";
import { ScrollText } from "lucide-react";
import { formatDateTime, formatStatusLabel } from "../../shared/format";
import { ScmListView } from "../../shared/ScmListView";
import { useListControls } from "../../shared/use-list-controls";
import { useWarehouseActivity } from "../hooks";

/** Legacy `ScmWarehouseActivity`: audit trail of put-away and movement changes. */
export function WarehouseActivityView() {
  const c = useListControls(20);
  const query = useWarehouseActivity({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
  });

  return (
    <ScmListView<ScmActivityRow>
      title="Warehouse Activity"
      description="Audit trail of put-away and internal movement changes."
      icon={ScrollText}
      noun="activity entries"
      readPermission="scm.warehouse.read"
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
      emptyDescription="Changes to put-aways and internal movements appear here."
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
