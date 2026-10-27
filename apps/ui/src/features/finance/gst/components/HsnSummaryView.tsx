"use client";

import { useMemo, useState } from "react";
import type { FinanceGstEntryType } from "@texawave-erp/api-types";
import {
  EmptyState,
  ErrorState,
  SearchInput,
  Select,
} from "@texawave-erp/ui-kit";
import { Hash, Info, RefreshCw } from "lucide-react";
import { formatMoney } from "../../shared/format";
import { useHsnSummary } from "../hooks";

export interface HsnSummaryViewProps {
  period: string;
}

export function HsnSummaryView({ period }: HsnSummaryViewProps) {
  const [entryTypeFilter, setEntryTypeFilter] = useState<
    FinanceGstEntryType | "ALL"
  >("ALL");
  const [search, setSearch] = useState("");

  const queryParams = useMemo(() => {
    return {
      period,
      ...(entryTypeFilter !== "ALL" ? { entryType: entryTypeFilter } : {}),
    };
  }, [period, entryTypeFilter]);

  const {
    data: report,
    isLoading,
    isError,
    error,
  } = useHsnSummary(queryParams);

  const filteredItems = useMemo(() => {
    if (!report?.items) return [];
    if (!search.trim()) return report.items;
    const s = search.toLowerCase();
    return report.items.filter(
      (item) =>
        item.hsnSacCode.toLowerCase().includes(s) ||
        (item.description && item.description.toLowerCase().includes(s)),
    );
  }, [report, search]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 dark:bg-gray-900 dark:border-gray-800">
        <RefreshCw className="h-8 w-8 text-[#1769F5] animate-spin" />
        <span className="mt-3 text-theme-sm text-gray-500 dark:text-gray-400">
          Compiling HSN / SAC Code Summaries for {period}...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load HSN Summary"
        description={
          (error as Error)?.message ||
          "An error occurred while compiling HSN / SAC code tax summaries."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 relative focus-within:z-30">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search HSN / SAC code or description..."
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto relative focus-within:z-30">
          <div className="w-full sm:w-60 relative focus-within:z-30">
            <Select
              value={entryTypeFilter}
              onChange={(e) =>
                setEntryTypeFilter(
                  e.target.value as FinanceGstEntryType | "ALL",
                )
              }
            >
              <option value="ALL">All Supplies (Inward & Outward)</option>
              <option value="OUTPUT_GST">Outward Supplies (Table 12)</option>
              <option value="INPUT_TAX_CREDIT">
                Inward Supplies (Table 13)
              </option>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200/70 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
            Unique HSN Codes
          </span>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {report?.items.length ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
            Total Records
          </span>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {report?.totalRecords ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
            Total Taxable Base
          </span>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {formatMoney(report?.totalTaxableAmount ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
            Total Tax Amount
          </span>
          <div className="text-xl font-bold text-[#1769F5] dark:text-sky-400 mt-1">
            {formatMoney(report?.totalTaxAmount ?? 0)}
          </div>
        </div>
      </div>

      {/* HSN Summary Table */}
      {!report || filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No HSN / SAC Codes Found"
            description={
              search
                ? `No HSN or SAC code matches search query "${search}".`
                : `There are no classified HSN transactions recorded for period ${period}.`
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-theme-sm">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-gray-800 text-theme-xs font-bold text-gray-500 uppercase dark:text-gray-400">
                  <th className="py-3 px-4">HSN / SAC Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Txns</th>
                  <th className="py-3 px-4 text-right">Taxable Value</th>
                  <th className="py-3 px-4 text-right">CGST</th>
                  <th className="py-3 px-4 text-right">SGST</th>
                  <th className="py-3 px-4 text-right">IGST</th>
                  <th className="py-3 px-4 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((item) => (
                  <tr
                    key={item.hsnSacCode}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-blue-500" />
                        <span>{item.hsnSacCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-theme-xs max-w-xs truncate">
                      {item.description || "General Goods / Services"}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                      {item.transactionCount}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-800 dark:text-gray-200">
                      {formatMoney(item.taxableAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {formatMoney(item.cgstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {formatMoney(item.sgstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {formatMoney(item.igstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                      {formatMoney(item.totalTaxAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 font-bold text-gray-900 dark:text-white">
                  <td
                    colSpan={2}
                    className="py-3.5 px-4 uppercase text-theme-xs tracking-wider"
                  >
                    Total
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {report.totalRecords}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(report.totalTaxableAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(report.totalCgstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(report.totalSgstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(report.totalIgstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-[#1769F5] dark:text-sky-400 text-base">
                    {formatMoney(report.totalTaxAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Statutory Disclaimer Footer */}
      <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3.5 text-theme-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 border border-gray-200/60 dark:border-gray-800">
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <span>
          Statutory Notice: HSN and SAC code summaries are compiled from
          categorized line items in ERP vouchers. Ensure classification matches
          statutory GST tariff guidelines before tax return filing.
        </span>
      </div>
    </div>
  );
}
