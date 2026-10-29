"use client";

import { ArrowDownLeft, Wallet } from "lucide-react";
import { formatMoney } from "../../shared/format";

export interface AdvanceCreditBannerProps {
  unallocatedCount: number;
  unallocatedAmount: number;
  isFilterActive: boolean;
  onToggleFilter: () => void;
}

export function AdvanceCreditBanner({
  unallocatedCount,
  unallocatedAmount,
  isFilterActive,
  onToggleFilter,
}: AdvanceCreditBannerProps) {
  if (unallocatedCount === 0 && !isFilterActive) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-blue-200/90 bg-blue-50/80 p-4 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/80 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-theme-sm font-bold text-blue-950 dark:text-blue-100">
            On-Account Client Advance Credits
          </h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 px-2.5 py-0.5 text-theme-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800">
              <ArrowDownLeft
                className="h-3 w-3 shrink-0 text-blue-600 dark:text-sky-300"
                aria-hidden="true"
              />
              <span>
                {unallocatedCount}{" "}
                {unallocatedCount === 1
                  ? "Receipt with Unallocated Credit"
                  : "Receipts with Unallocated Credit"}{" "}
                ({formatMoney(unallocatedAmount)})
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={onToggleFilter}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-theme-xs font-semibold transition-all shadow-2xs ${
            isFilterActive
              ? "border-blue-600 bg-blue-600 text-white shadow-xs"
              : "border-blue-300/80 bg-white/90 text-blue-900 hover:bg-blue-100/70 hover:border-blue-400 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-950/50"
          }`}
          aria-pressed={isFilterActive}
        >
          <Wallet
            className={`h-3.5 w-3.5 ${
              isFilterActive ? "text-white" : "text-blue-600 dark:text-sky-400"
            }`}
            aria-hidden="true"
          />
          <span>
            {isFilterActive
              ? "Show All Receipts"
              : "Filter Advance Credits Only"}
          </span>
        </button>
      </div>
    </div>
  );
}
