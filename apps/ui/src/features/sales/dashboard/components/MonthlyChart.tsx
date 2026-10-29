"use client";

import { useState } from "react";
import { Button } from "@texawave-erp/ui-kit";
import { formatInr, formatInrWhole, monthLabel } from "../../shared/format";

interface Point {
  month: number;
  revenue: string;
  collections: string;
}

// Two categorical series, validated (dataviz palette check, light and dark):
// blue-500 vs orange-600 pass lightness, chroma, CVD and contrast in both
// modes. Identity also comes from the legend and the table view.
const SERIES = [
  { key: "revenue", label: "Revenue", swatch: "bg-blue-500" },
  { key: "collections", label: "Collections", swatch: "bg-orange-600" },
] as const;

/** A rounded axis maximum so gridlines land on readable values. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value) ?? 10;
  return step * pow;
}

/**
 * Revenue vs collections per month — grouped bars, one y-axis. Each bar is
 * focusable and shows its value on hover or focus; "Show table" gives the
 * same numbers as a table.
 */
export function MonthlyChart({ data, year }: { data: Point[]; year: number }) {
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(
    Math.max(
      0,
      ...data.flatMap((d) => [Number(d.revenue), Number(d.collections)]),
    ),
  );
  const ticks = [max, max / 2, 0];
  const empty = data.every(
    (d) => Number(d.revenue) === 0 && Number(d.collections) === 0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4" aria-label="Legend">
          {SERIES.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-300"
            >
              <span
                className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`}
                aria-hidden="true"
              />
              {s.label}
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
        >
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-theme-sm">
            <caption className="sr-only">
              Revenue and collections by month, {year}
            </caption>
            <thead>
              <tr className="text-left text-theme-xs text-gray-500 dark:text-gray-400">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Month
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Revenue
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Collections
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.map((d) => (
                <tr key={d.month}>
                  <th
                    scope="row"
                    className="py-1.5 pr-4 text-left font-normal text-gray-700 dark:text-gray-300"
                  >
                    {monthLabel(d.month)} {year}
                  </th>
                  <td className="py-1.5 pr-4 text-right text-gray-900 dark:text-white/90">
                    {formatInr(d.revenue)}
                  </td>
                  <td className="py-1.5 text-right text-gray-900 dark:text-white/90">
                    {formatInr(d.collections)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {empty ? (
            <p className="absolute inset-x-0 top-1/3 z-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              No invoices or payments in {year} yet.
            </p>
          ) : null}
          <div className="flex gap-2">
            {/* Y axis labels */}
            <div
              className="flex h-52 flex-col justify-between text-right text-theme-xs text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="-translate-y-1/2 first:translate-y-0 last:translate-y-0"
                >
                  {formatInrWhole(t)}
                </span>
              ))}
            </div>
            <div className="relative flex-1">
              {/* Recessive gridlines */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 flex h-52 flex-col justify-between"
                aria-hidden="true"
              >
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="border-t border-gray-100 dark:border-gray-800"
                  />
                ))}
              </div>
              <ol
                className="relative grid h-52 grid-cols-12 items-end gap-1 sm:gap-2"
                aria-label={`Revenue and collections by month, ${year}`}
              >
                {data.map((d) => (
                  <li
                    key={d.month}
                    className="flex h-full items-end justify-center gap-0.5"
                  >
                    {SERIES.map((s) => {
                      const value = Number(d[s.key]);
                      const pct = Math.max(0, (value / max) * 100);
                      return (
                        <div
                          key={s.key}
                          className="group relative flex h-full w-full max-w-4 items-end"
                        >
                          <button
                            type="button"
                            aria-label={`${s.label}, ${monthLabel(d.month)} ${year}: ${formatInr(d[s.key])}`}
                            // Hit target is the full column height, not just the bar.
                            className="flex h-full w-full items-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                          >
                            <span
                              className={`block w-full rounded-t ${s.swatch}`}
                              style={{ height: `${pct}%` }}
                            />
                          </button>
                          <div
                            role="tooltip"
                            className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-theme-xs text-white shadow-sm group-focus-within:visible group-hover:visible dark:bg-gray-700"
                          >
                            {monthLabel(d.month)} · {s.label}:{" "}
                            {formatInr(d[s.key])}
                          </div>
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ol>
              <div
                className="mt-1 grid grid-cols-12 gap-1 text-center text-theme-xs text-gray-500 sm:gap-2 dark:text-gray-400"
                aria-hidden="true"
              >
                {data.map((d) => (
                  <span key={d.month}>{monthLabel(d.month)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
