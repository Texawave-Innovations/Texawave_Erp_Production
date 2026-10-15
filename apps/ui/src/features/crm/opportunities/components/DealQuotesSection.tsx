"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useQuotations } from "../../quotations/hooks";

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

/** Reproduces legacy `DealDetail.tsx`'s read-only Quotes tab: a list of
 * this Opportunity's quotations (Quote #/Status/Valid Until/Amount) and
 * a "New Quote" link that preselects the account + deal, matching
 * legacy's `/crm/quotes/new?dealId=&accountId=` navigation exactly
 * (Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1/§3). No write action lives here
 * — editing happens on the Quote's own combined view/edit screen, same
 * as legacy. */
export function DealQuotesSection({
  opportunityId,
  accountId,
}: {
  opportunityId: number;
  accountId: number;
}) {
  const query = useQuotations({ limit: 50, opportunityId });
  const quotations = query.data?.data ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
          Quotes {quotations.length > 0 ? `(${quotations.length})` : ""}
        </h3>
        <Link
          href={`/crm/quotes/new?accountId=${accountId}&dealId=${opportunityId}`}
          className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          New Quote
        </Link>
      </div>
      {quotations.length === 0 ? (
        <p className="text-theme-xs text-gray-400">
          No quotes yet for this deal.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {quotations.map((q) => (
            <li
              key={q.id}
              className="flex items-center justify-between text-theme-xs"
            >
              <Link
                href={`/crm/quotes/${q.id}`}
                className="text-gray-800 hover:underline dark:text-gray-200"
              >
                {q.quotationNumber}
              </Link>
              <div className="flex items-center gap-3 text-gray-500">
                <StatusBadge
                  label={q.status}
                  colorToken={STATUS_COLOR[q.status] ?? "gray"}
                />
                <span>{q.validUntil?.slice(0, 10) ?? "—"}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {q.currency ?? "INR"} {q.grandTotal}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
