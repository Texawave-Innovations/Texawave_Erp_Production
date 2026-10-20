"use client";

import type { ScmReturn } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useState } from "react";
import {
  formatDate,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useScmList } from "../../shared/scm-hooks";

const PAGE_SIZE = 10;

/** Vendor returns raised against this supplier (legacy `Returns` tab). */
export function SupplierReturnsTab({ supplierId }: { supplierId: number }) {
  const [page, setPage] = useState(1);
  const query = useScmList<ScmReturn>("supplier-returns", "/scm/returns", {
    returnType: "VENDOR_RETURN",
    supplierId,
    page,
    limit: PAGE_SIZE,
  });

  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to returns">
          Ask an administrator for the <code>scm.returns.read</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  const rows = query.data.data;
  const meta = query.data.meta;

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No returns yet"
          description="Purchase returns raised against this supplier appear here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTable<ScmReturn>
        caption="Vendor returns"
        rows={rows}
        getRowKey={(r) => String(r.id)}
        columns={[
          {
            header: "Return #",
            cell: (r) => (
              <Link
                href="/scm/returns/vendor"
                className="font-mono text-theme-xs text-brand-700 hover:underline dark:text-brand-300"
              >
                {r.returnNumber}
              </Link>
            ),
          },
          { header: "GRN", cell: (r) => r.grnNumber ?? "—" },
          { header: "PO", cell: (r) => r.purchaseOrderNumber ?? "—" },
          { header: "Reason", cell: (r) => formatStatusLabel(r.reasonCode) },
          { header: "Requested", cell: (r) => formatDate(r.requestedDate) },
          {
            header: "Status",
            cell: (r) => (
              <StatusBadge
                label={formatStatusLabel(r.status)}
                colorToken={scmStatusToken(r.status)}
              />
            ),
          },
        ]}
      />
      {meta && meta.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
