"use client";

import { useMemo, useState } from "react";
import type { FinanceGstEntryType } from "@texawave-erp/api-types";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  SearchInput,
  Select,
} from "@texawave-erp/ui-kit";
import {
  Calendar,
  FileSpreadsheet,
  Hash,
  Info,
  Printer,
  RefreshCw,
} from "lucide-react";
import { formatMoney } from "../../shared/format";
import { downloadCsv, toCsv } from "../../shared/csv";
import { useHsnSummary } from "../hooks";

export interface HsnSummaryViewProps {
  initialPeriod?: string;
}

type DatePreset =
  "this_month" | "last_month" | "this_quarter" | "this_fy" | "all";

export function HsnSummaryView({
  initialPeriod = "2026-10",
}: HsnSummaryViewProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<
    FinanceGstEntryType | "ALL"
  >("ALL");
  const [search, setSearch] = useState("");

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (preset === "this_month") {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      setStartDate(start.toISOString().split("T")[0] ?? "");
      setEndDate(end.toISOString().split("T")[0] ?? "");
    } else if (preset === "last_month") {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      setStartDate(start.toISOString().split("T")[0] ?? "");
      setEndDate(end.toISOString().split("T")[0] ?? "");
    } else if (preset === "this_quarter") {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      setStartDate(start.toISOString().split("T")[0] ?? "");
      setEndDate(end.toISOString().split("T")[0] ?? "");
    } else if (preset === "this_fy") {
      // Indian Financial Year: April 1 to March 31
      const fyStartYear = month >= 3 ? year : year - 1;
      const start = new Date(fyStartYear, 3, 1);
      const end = new Date(fyStartYear + 1, 2, 31);
      setStartDate(start.toISOString().split("T")[0] ?? "");
      setEndDate(end.toISOString().split("T")[0] ?? "");
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const queryParams = useMemo(() => {
    if (startDate && endDate) {
      return {
        startDate,
        endDate,
        ...(entryTypeFilter !== "ALL" ? { entryType: entryTypeFilter } : {}),
      };
    }
    return {
      period: initialPeriod,
      ...(entryTypeFilter !== "ALL" ? { entryType: entryTypeFilter } : {}),
    };
  }, [startDate, endDate, initialPeriod, entryTypeFilter]);

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
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

  const grandTotals = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => ({
        taxableAmount: acc.taxableAmount + item.taxableAmount,
        cgstAmount: acc.cgstAmount + item.cgstAmount,
        sgstAmount: acc.sgstAmount + item.sgstAmount,
        igstAmount: acc.igstAmount + item.igstAmount,
        totalTaxAmount: acc.totalTaxAmount + item.totalTaxAmount,
        transactionCount: acc.transactionCount + item.transactionCount,
      }),
      {
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTaxAmount: 0,
        transactionCount: 0,
      },
    );
  }, [filteredItems]);

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;
    const columns = [
      {
        header: "HSN / SAC Code",
        value: (row: (typeof filteredItems)[0]) => row.hsnSacCode,
      },
      {
        header: "Description",
        value: (row: (typeof filteredItems)[0]) =>
          row.description || "General Goods/Services",
      },
      {
        header: "Transactions",
        value: (row: (typeof filteredItems)[0]) => row.transactionCount,
      },
      {
        header: "Taxable Value (INR)",
        value: (row: (typeof filteredItems)[0]) => row.taxableAmount.toFixed(2),
      },
      {
        header: "CGST (INR)",
        value: (row: (typeof filteredItems)[0]) => row.cgstAmount.toFixed(2),
      },
      {
        header: "SGST (INR)",
        value: (row: (typeof filteredItems)[0]) => row.sgstAmount.toFixed(2),
      },
      {
        header: "IGST (INR)",
        value: (row: (typeof filteredItems)[0]) => row.igstAmount.toFixed(2),
      },
      {
        header: "Total Tax Amount (INR)",
        value: (row: (typeof filteredItems)[0]) =>
          row.totalTaxAmount.toFixed(2),
      },
    ];
    const csvData = toCsv(columns, filteredItems);
    downloadCsv(
      `HSN_Summary_${startDate || initialPeriod}_to_${endDate || initialPeriod}.csv`,
      csvData,
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* Date Presets and Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Presets:</span>
            </span>
            {(
              [
                ["this_month", "This Month"],
                ["last_month", "Last Month"],
                ["this_quarter", "This Quarter"],
                ["this_fy", "This FY"],
                ["all", "All Dates"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-lg px-2.5 py-1 text-theme-xs font-semibold transition-all cursor-pointer ${
                  datePreset === key
                    ? "bg-[#1769F5] text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Action Buttons: CSV & Print/PDF */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-1.5 h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-1.5 h-9"
            >
              <Printer className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <span>Print / PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="h-9 w-9 p-0 flex items-center justify-center"
              title="Refresh HSN Summary"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Custom Date Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="w-full md:col-span-5">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search HSN / SAC code or description..."
            />
          </div>

          <div className="w-full sm:col-span-1 md:col-span-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("all");
              }}
              aria-label="From Date"
            />
          </div>

          <div className="w-full sm:col-span-1 md:col-span-2">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("all");
              }}
              aria-label="To Date"
            />
          </div>

          <div className="w-full md:col-span-3 relative focus-within:z-30">
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

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Unique HSN Codes
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {filteredItems.length}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Transactions
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {grandTotals.transactionCount}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Taxable Base
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatMoney(grandTotals.taxableAmount)}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total GST Amount
          </span>
          <div className="text-2xl font-bold text-[#1769F5] dark:text-sky-400 mt-1">
            {formatMoney(grandTotals.totalTaxAmount)}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 dark:bg-gray-900 dark:border-gray-800">
          <RefreshCw className="h-8 w-8 text-[#1769F5] animate-spin" />
          <span className="mt-3 text-theme-sm text-gray-500 dark:text-gray-400">
            Compiling HSN / SAC Code Summaries...
          </span>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load HSN Summary"
          description={
            (error as Error)?.message ||
            "An error occurred while compiling HSN / SAC code tax summaries."
          }
          onRetry={() => void refetch()}
        />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No HSN / SAC Codes Found"
            description={
              search
                ? `No HSN or SAC code matches search query "${search}".`
                : "There are no classified HSN transactions recorded for the selected date range."
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
                    {grandTotals.transactionCount}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(grandTotals.taxableAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(grandTotals.cgstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(grandTotals.sgstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(grandTotals.igstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-[#1769F5] dark:text-sky-400 text-base">
                    {formatMoney(grandTotals.totalTaxAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Statutory Notice */}
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
