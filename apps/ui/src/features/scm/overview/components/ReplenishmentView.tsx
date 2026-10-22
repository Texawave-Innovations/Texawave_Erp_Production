"use client";

import type { ReplenishmentRow } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  DataTable,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { PackageSearch } from "lucide-react";
import { formatMoney, formatQty } from "../../shared/format";
import { useReplenishment } from "../hooks";

/** Legacy `ScmReplenishment`: deterministic reorder recommendations from
 * stock and the reorder level a product is configured with — never a
 * forecast, just "bring available stock back up to its configured
 * maximum (or twice the reorder level, when no maximum is set)". */
export function ReplenishmentView() {
  const query = useReplenishment();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={PackageSearch}
        title="Replenishment"
        description="Products at or below their reorder level, with a recommended reorder quantity."
        badge={
          query.data ? (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
              {query.data.length} to reorder
            </span>
          ) : undefined
        }
      />
      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to replenishment"
          >
            Ask an administrator for the <code>scm.overview.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <PackageSearch className="mx-auto mb-4 h-10 w-10 stroke-[1.5] text-gray-400" />
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            Nothing needs reordering
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            Every product with a reorder level is above it.
          </p>
        </div>
      ) : (
        <DataTable<ReplenishmentRow>
          caption="Replenishment"
          rows={query.data}
          getRowKey={(r) => `${r.productId}-${r.warehouseId}`}
          columns={[
            {
              header: "Product",
              cell: (r) => `${r.productName} (${r.productCode})`,
            },
            { header: "Warehouse", cell: (r) => r.warehouse },
            {
              header: "Available",
              align: "right",
              cell: (r) => formatQty(r.available),
            },
            {
              header: "Reorder Level",
              align: "right",
              cell: (r) => formatQty(r.reorderLevel),
            },
            {
              header: "Target",
              align: "right",
              cell: (r) => formatQty(r.target),
            },
            {
              header: "Recommend Ordering",
              align: "right",
              cell: (r) => formatQty(r.recommendedQty),
            },
            {
              header: "Est. Cost",
              align: "right",
              cell: (r) => formatMoney(r.estimatedCost),
            },
          ]}
        />
      )}
    </div>
  );
}
