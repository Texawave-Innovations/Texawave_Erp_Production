"use client";

import type { Quotation } from "@texawave-erp/api-types";
import {
  Button,
  EmptyState,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useQuotations } from "../../../quotations/hooks";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  Draft: "gray",
  Sent: "brand",
  Accepted: "success",
  Rejected: "error",
  Expired: "warning",
};

/** Quotations tab — reuses the existing Quotations hook (does not rebuild
 * Quotations), scoped to this account via `accountId`. */
export function QuotationsTab({ accountId }: { accountId: number }) {
  const query = useQuotations({ accountId, limit: 50 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Quotations
        </h3>
        <Link href={`/crm/quotes/new?accountId=${accountId}`}>
          <Button size="sm">New Quote</Button>
        </Link>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          description="Create the first quote."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((q: Quotation) => (
            <li key={q.id} className="flex items-center justify-between py-3">
              <Link
                href={`/crm/quotes/${q.id}`}
                className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {q.quotationNumber} — {q.subject}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {q.grandTotal} {q.currency ?? ""}
                </span>
                <StatusBadge
                  label={q.status}
                  colorToken={STATUS_COLOR[q.status] ?? "gray"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
