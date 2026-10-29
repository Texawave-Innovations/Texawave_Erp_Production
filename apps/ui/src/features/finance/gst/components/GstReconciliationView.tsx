"use client";

import { useMemo, useState } from "react";
import type { FinanceGstEntry } from "@texawave-erp/api-types";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  SearchInput,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Scale,
} from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";
import { downloadCsv, toCsv } from "../../shared/csv";
import { useGstEntries } from "../hooks";

export interface GstReconciliationViewProps {
  initialPeriod?: string;
}

type DatePreset =
  "this_month" | "last_month" | "this_quarter" | "this_fy" | "all";
type ActiveView = "both" | "inward" | "outward";

const GST_STATUS_COLOR_MAP: Record<
  string,
  "brand" | "success" | "warning" | "error" | "gray"
> = {
  ACTIVE: "brand",
  FILED: "success",
  RECONCILED: "success",
  CANCELLED: "gray",
};

export function GstReconciliationView({
  initialPeriod = "2026-10",
}: GstReconciliationViewProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("both");

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
    return {
      limit: 100,
      ...(startDate && endDate ? {} : { period: initialPeriod }),
      ...(search.trim() ? { search: search.trim() } : {}),
    };
  }, [startDate, endDate, initialPeriod, search]);

  const {
    data: entriesEnvelope,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGstEntries(queryParams);

  const rawEntries: FinanceGstEntry[] = useMemo(
    () => entriesEnvelope?.data ?? [],
    [entriesEnvelope?.data],
  );

  // Filter entries locally if custom date range is selected
  const filteredEntries = useMemo(() => {
    if (!startDate && !endDate) return rawEntries;
    return rawEntries.filter((e) => {
      const docDate = e.createdAt ? e.createdAt.slice(0, 10) : "";
      if (startDate && docDate < startDate) return false;
      if (endDate && docDate > endDate) return false;
      return true;
    });
  }, [rawEntries, startDate, endDate]);

  // Separate into Inward ITC (Purchases/Bills/Expenses) vs Outward Liability (Sales Invoices)
  const inwardEntries = useMemo(
    () =>
      filteredEntries.filter(
        (e) => e.entryType === "INPUT_TAX_CREDIT" && e.status !== "CANCELLED",
      ),
    [filteredEntries],
  );

  const outwardEntries = useMemo(
    () =>
      filteredEntries.filter(
        (e) =>
          e.entryType === "OUTPUT_GST" &&
          !e.isProformaExcluded &&
          e.status !== "CANCELLED",
      ),
    [filteredEntries],
  );

  // Computations
  const inwardTotals = useMemo(() => {
    return inwardEntries.reduce(
      (acc, item) => ({
        taxable: acc.taxable + Number(item.taxableAmount),
        cgst: acc.cgst + Number(item.cgstAmount),
        sgst: acc.sgst + Number(item.sgstAmount),
        igst: acc.igst + Number(item.igstAmount),
        totalTax: acc.totalTax + Number(item.totalTaxAmount),
        count: acc.count + 1,
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, count: 0 },
    );
  }, [inwardEntries]);

  const outwardTotals = useMemo(() => {
    return outwardEntries.reduce(
      (acc, item) => ({
        taxable: acc.taxable + Number(item.taxableAmount),
        cgst: acc.cgst + Number(item.cgstAmount),
        sgst: acc.sgst + Number(item.sgstAmount),
        igst: acc.igst + Number(item.igstAmount),
        totalTax: acc.totalTax + Number(item.totalTaxAmount),
        count: acc.count + 1,
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, count: 0 },
    );
  }, [outwardEntries]);

  const netTaxPosition = outwardTotals.totalTax - inwardTotals.totalTax;
  const isPayable = netTaxPosition > 0;

  const handleExportCSV = () => {
    const listToExport =
      activeView === "inward"
        ? inwardEntries
        : activeView === "outward"
          ? outwardEntries
          : filteredEntries;

    if (listToExport.length === 0) return;

    const columns = [
      { header: "Type", value: (row: FinanceGstEntry) => row.entryType },
      { header: "Source", value: (row: FinanceGstEntry) => row.sourceType },
      {
        header: "Document / Invoice No",
        value: (row: FinanceGstEntry) => row.sourceReference,
      },
      { header: "GSTIN", value: (row: FinanceGstEntry) => row.gstin },
      {
        header: "HSN/SAC",
        value: (row: FinanceGstEntry) => row.hsnSacCode || "N/A",
      },
      {
        header: "Date",
        value: (row: FinanceGstEntry) => formatDate(row.createdAt),
      },
      {
        header: "Taxable Base (INR)",
        value: (row: FinanceGstEntry) => Number(row.taxableAmount).toFixed(2),
      },
      {
        header: "CGST (INR)",
        value: (row: FinanceGstEntry) => Number(row.cgstAmount).toFixed(2),
      },
      {
        header: "SGST (INR)",
        value: (row: FinanceGstEntry) => Number(row.sgstAmount).toFixed(2),
      },
      {
        header: "IGST (INR)",
        value: (row: FinanceGstEntry) => Number(row.igstAmount).toFixed(2),
      },
      {
        header: "Total Tax (INR)",
        value: (row: FinanceGstEntry) => Number(row.totalTaxAmount).toFixed(2),
      },
      { header: "Status", value: (row: FinanceGstEntry) => row.status },
    ];

    const csvData = toCsv(columns, listToExport);
    downloadCsv(
      `GST_Reconciliation_${startDate || initialPeriod}_to_${endDate || initialPeriod}.csv`,
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

          {/* Action Buttons: CSV & Print */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredEntries.length === 0}
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
              disabled={filteredEntries.length === 0}
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
              title="Refresh Reconciliation"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Custom Date Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="w-full md:col-span-6">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search by invoice/bill number or GSTIN..."
            />
          </div>

          <div className="w-full sm:col-span-1 md:col-span-3">
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

          <div className="w-full sm:col-span-1 md:col-span-3">
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
        </div>
      </div>

      {/* Net Reconciliation Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Output Tax Liability */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-theme-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Output GST (Sales)
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatMoney(outwardTotals.totalTax)}
            </span>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
              Base taxable: {formatMoney(outwardTotals.taxable)} ·{" "}
              {outwardTotals.count} invoices
            </p>
          </div>
        </div>

        {/* Input Tax Credit */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-theme-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Input Tax Credit (Purchases/Bills)
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(inwardTotals.totalTax)}
            </span>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
              Base taxable: {formatMoney(inwardTotals.taxable)} ·{" "}
              {inwardTotals.count} bills
            </p>
          </div>
        </div>

        {/* Net Tax Position */}
        <div
          className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between ${
            isPayable
              ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
              : "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-theme-xs font-bold uppercase tracking-wider ${
                isPayable
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-blue-800 dark:text-blue-300"
              }`}
            >
              {isPayable ? "Net GST Payable" : "Net ITC Available"}
            </span>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                isPayable
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
              }`}
            >
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div>
            <span
              className={`text-2xl font-bold ${
                isPayable
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-blue-900 dark:text-blue-200"
              }`}
            >
              {formatMoney(Math.abs(netTaxPosition))}
            </span>
            <p className="text-theme-xs text-gray-600 dark:text-gray-400 mt-1">
              {isPayable
                ? "Output liability exceeds eligible ITC"
                : "Eligible ITC exceeds output liability (Carried Forward)"}
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher: Inward vs Outward vs Both */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setActiveView("both")}
          className={`rounded-xl px-3.5 py-1.5 text-theme-xs font-bold transition-all cursor-pointer ${
            activeView === "both"
              ? "bg-[#1769F5] text-white shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          All Records ({filteredEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("inward")}
          className={`rounded-xl px-3.5 py-1.5 text-theme-xs font-bold transition-all cursor-pointer ${
            activeView === "inward"
              ? "bg-[#1769F5] text-white shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Inward ITC ({inwardEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("outward")}
          className={`rounded-xl px-3.5 py-1.5 text-theme-xs font-bold transition-all cursor-pointer ${
            activeView === "outward"
              ? "bg-[#1769F5] text-white shadow-xs"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Outward Liability ({outwardEntries.length})
        </button>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 dark:bg-gray-900 dark:border-gray-800">
          <RefreshCw className="h-8 w-8 text-[#1769F5] animate-spin" />
          <span className="mt-3 text-theme-sm text-gray-500 dark:text-gray-400">
            Loading GST reconciliation records...
          </span>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Reconciliation Data"
          description={
            (error as Error)?.message ||
            "Unable to compile purchase bills and sales invoices for GST reconciliation."
          }
          onRetry={() => void refetch()}
        />
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No GST Records Found"
            description={
              search
                ? `No GST records match search query "${search}".`
                : "No inward or outward tax records found for the selected period."
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-theme-sm">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-gray-800 text-theme-xs font-bold text-gray-500 uppercase dark:text-gray-400">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Document / Ref #</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Taxable Base</th>
                  <th className="py-3 px-4 text-right">CGST</th>
                  <th className="py-3 px-4 text-right">SGST</th>
                  <th className="py-3 px-4 text-right">IGST</th>
                  <th className="py-3 px-4 text-right">Total GST</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(activeView === "inward"
                  ? inwardEntries
                  : activeView === "outward"
                    ? outwardEntries
                    : filteredEntries
                ).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {item.entryType === "INPUT_TAX_CREDIT" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-theme-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <ArrowDownLeft className="h-3 w-3" />
                          <span>ITC (Inward)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-theme-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          <ArrowUpRight className="h-3 w-3" />
                          <span>Output (Sales)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {item.sourceReference}
                    </td>
                    <td className="py-3 px-4 text-theme-xs text-gray-600 dark:text-gray-300 font-medium">
                      {item.gstin}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-theme-xs">
                      {formatDate(item.createdAt)}
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
                    <td className="py-3 px-4 text-center">
                      <StatusBadge
                        label={item.status}
                        colorToken={GST_STATUS_COLOR_MAP[item.status] ?? "gray"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
