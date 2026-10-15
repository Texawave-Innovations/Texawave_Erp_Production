"use client";

import type { Opportunity } from "@texawave-erp/api-types";
import {
  Button,
  EmptyState,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useOpportunities } from "../../../opportunities/hooks";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  OPEN: "brand",
  WON: "success",
  LOST: "error",
  ON_HOLD: "warning",
};

/** Opportunities tab — reuses the existing Opportunities hook (does not
 * rebuild Pipeline), scoped to this account via `accountId`. Links out to
 * the Pipeline board for the full kanban/edit workflow — no inline edit
 * here (out of scope: Opportunities already has its own full UI). */
export function OpportunitiesTab({ accountId }: { accountId: number }) {
  const query = useOpportunities({ accountId, limit: 50 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Opportunities
        </h3>
        <Link href="/crm/pipeline">
          <Button size="sm" variant="secondary">
            Open Pipeline
          </Button>
        </Link>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No opportunities yet"
          description="Create one from the Pipeline board."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((o: Opportunity) => (
            <li key={o.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {o.title}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {o.stage.label} · {o.estimatedValue} {o.currency ?? ""}
                </p>
              </div>
              <StatusBadge
                label={o.status}
                colorToken={STATUS_COLOR[o.status] ?? "gray"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
