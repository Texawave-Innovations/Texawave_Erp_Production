"use client";

import type { ControlTowerException } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { Siren } from "lucide-react";
import Link from "next/link";
import { formatStatusLabel } from "../../shared/format";
import { useControlTower } from "../hooks";

const SEVERITY_TONE: Record<
  string,
  "success" | "warning" | "error" | "brand" | "gray"
> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "gray",
};

/** Legacy `ScmControlTower`: real-time operational exceptions across every
 * SCM module, computed by deterministic rules (not a learned model). */
export function ControlTowerView() {
  const query = useControlTower();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Siren}
        title="Control Tower"
        description="Open exceptions across procurement, inventory, fulfillment, logistics and quality."
        badge={
          query.data ? (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
              {query.data.length} exceptions
            </span>
          ) : undefined
        }
      />
      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={4} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to the Control Tower"
          >
            Ask an administrator for the <code>scm.overview.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <Siren className="mx-auto mb-4 h-10 w-10 stroke-[1.5] text-gray-400" />
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            No open exceptions
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            Everything is within normal thresholds right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {query.data.map((e: ControlTowerException, idx) => (
            <Link
              key={idx}
              href={e.path}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-dark"
            >
              <div className="flex flex-col gap-1">
                <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {e.title}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {e.detail}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-theme-xs text-gray-400">
                  {formatStatusLabel(e.type)}
                </span>
                <StatusBadge
                  label={e.severity}
                  colorToken={SEVERITY_TONE[e.severity] ?? "gray"}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
