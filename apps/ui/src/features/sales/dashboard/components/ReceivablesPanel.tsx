import { SectionCard } from "@texawave-erp/ui-kit";
import { Meter } from "../../shared/components/Meter";
import { formatInr } from "../../shared/format";
import type { SalesDashboard } from "../types";

export function ReceivablesPanel({
  receivables,
}: {
  receivables: SalesDashboard["receivables"];
}) {
  const max = Math.max(...receivables.aging.map((b) => Number(b.amount)), 0);
  return (
    <SectionCard title="Receivables" description="Outstanding by days past due">
      <Meter
        label="Collected of billed"
        percent={receivables.collectedPercent}
      />
      <ul className="flex flex-col gap-3" aria-label="Outstanding by age">
        {receivables.aging.map((b) => (
          <li key={b.bucket} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-theme-sm">
              <span className="text-gray-700 dark:text-gray-300">
                {b.bucket} days · {b.count} invoice{b.count === 1 ? "" : "s"}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white/90">
                {formatInr(b.amount)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-sky-500"
                style={{
                  width: max > 0 ? `${(Number(b.amount) / max) * 100}%` : "0%",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
