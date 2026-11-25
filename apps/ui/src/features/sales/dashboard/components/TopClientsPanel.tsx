import Link from "next/link";
import { EmptyState, SectionCard } from "@texawave-erp/ui-kit";
import { formatInrWhole } from "../../shared/format";
import type { SalesDashboard } from "../types";

export function TopClientsPanel({
  clients,
  year,
}: {
  clients: SalesDashboard["topClients"];
  year: number;
}) {
  return (
    <SectionCard
      title="Top clients"
      description={`By tax-invoice revenue, ${year}`}
    >
      {clients.length === 0 ? (
        <EmptyState title={`No revenue in ${year}`} />
      ) : (
        <ol className="flex flex-col gap-3">
          {clients.map((c) => (
            <li key={c.customerId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-theme-sm">
                <Link
                  href={`/sales/customers/${c.customerId}`}
                  className="truncate text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                >
                  {c.rank}. {c.companyName}
                </Link>
                <span className="shrink-0 font-semibold text-gray-900 dark:text-white/90">
                  {formatInrWhole(c.revenue)}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                role="meter"
                aria-label={`${c.companyName} share of revenue`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, c.sharePercent)}
              >
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.min(100, c.sharePercent)}%` }}
                />
              </div>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {c.sharePercent}% of revenue
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
