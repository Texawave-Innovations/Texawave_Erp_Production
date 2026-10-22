"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  Input,
  PageHeader,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { Database, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { useMasterDataSearch } from "../hooks";

/** Legacy `ScmMasterData`: read-only lookup across every SCM master
 * (suppliers, products, warehouses, customers, carriers) from one search box. */
export function MasterDataView() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 250);
  const query = useMasterDataSearch(q);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Database}
        title="Master Data"
        description="Search suppliers, products, warehouses, customers and carriers in one place."
      />
      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search master data"
        />
      </div>
      {q.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Start typing a supplier, product, warehouse, customer or carrier name
          or code.
        </p>
      ) : query.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={3} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to master data">
            Ask an administrator for the <code>scm.overview.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No matches for &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800/60 dark:border-gray-800 dark:bg-gray-dark">
          {query.data.map((hit, idx) => (
            <Link
              key={`${hit.type}-${hit.id}-${idx}`}
              href={hit.path}
              className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <div className="flex flex-col">
                <span className="text-theme-sm text-gray-900 dark:text-white/90">
                  {hit.label}
                </span>
                {hit.sublabel ? (
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {hit.sublabel}
                  </span>
                ) : null}
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {hit.type}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
