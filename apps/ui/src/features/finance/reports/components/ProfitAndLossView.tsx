"use client";

import { useMemo, useState } from "react";
import type { FinancialReportAccountItem } from "@texawave-erp/api-types";
import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Input,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  LineChart,
  Receipt,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";
import { useProfitAndLoss } from "../hooks";

export function ProfitAndLossView() {
  // Default to current month range
  const defaultStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  }, []);
  const defaultEnd = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const queryParams = useMemo(() => {
    return {
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }, [startDate, endDate]);

  const isInvalidDateRange = Boolean(
    startDate && endDate && startDate > endDate,
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useProfitAndLoss(queryParams, { enabled: !isInvalidDateRange });

  const accountColumns: DataTableColumn<FinancialReportAccountItem>[] = [
    {
      header: "ACCOUNT CODE",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-[#1769F5] dark:text-sky-400">
          {row.accountCode}
        </span>
      ),
    },
    {
      header: "ACCOUNT NAME",
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {row.accountName}
        </span>
      ),
    },
    {
      header: "AMOUNT",
      align: "right",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.amount)}
        </span>
      ),
    },
  ];

  const netMargin = useMemo(() => {
    if (!data || data.revenue.total <= 0) return 0;
    return Number(((data.netIncome / data.revenue.total) * 100).toFixed(1));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Filter & Date Range Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400">
            <LineChart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
              Statement of Profit or Loss
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Operating revenue, expenses, and bottom-line net income
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              From:
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40 text-theme-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
              To:
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40 text-theme-xs"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {isInvalidDateRange ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-theme-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">Invalid Date Range</p>
            <p className="text-theme-xs text-amber-700 dark:text-amber-300">
              Start date ({startDate}) cannot be after end date ({endDate}).
              Please adjust the date filter.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <TableSkeleton rowsCount={8} columnsCount={3} />
      ) : isError ? (
        <div className="p-8">
          <ErrorState
            title="Failed to Load Profit & Loss"
            description={
              (error as Error)?.message ||
              "Unable to calculate profit and loss from posted journal entries."
            }
            onRetry={() => void refetch()}
          />
        </div>
      ) : !data ? (
        <EmptyState
          title="No Statement Data"
          description="No posted transactions found in the selected date range."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>Operating Revenue</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMoney(data.revenue.total)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                {data.revenue.accounts.length} active revenue streams
              </span>
            </div>

            {/* Total Expenses */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>Operating Expenses</span>
                <Receipt className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {formatMoney(data.expenses.total)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                {data.expenses.accounts.length} operating expense heads
              </span>
            </div>

            {/* Net Income / Profit */}
            <div
              className={`rounded-2xl border p-4.5 ${
                data.isProfitable
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  : "border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
              }`}
            >
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider">
                <span
                  className={
                    data.isProfitable
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }
                >
                  {data.isProfitable ? "Net Profit" : "Net Deficit"}
                </span>
                {data.isProfitable ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div
                className={`mt-2 text-2xl font-extrabold ${
                  data.isProfitable
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-rose-900 dark:text-rose-200"
                }`}
              >
                {formatMoney(data.netIncome)}
              </div>
              <span
                className={`mt-1 text-theme-xs ${
                  data.isProfitable
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                Revenue minus Expenses
              </span>
            </div>

            {/* Net Margin */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>Operating Margin</span>
                <DollarSign className="h-4 w-4 text-[#1769F5]" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-[#1769F5] dark:text-sky-400">
                {netMargin}%
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                Net Profit / Revenue ratio
              </span>
            </div>
          </div>

          {/* Section 1: REVENUE */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h4 className="text-theme-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  1. Operating Revenue
                </h4>
              </div>
              <span className="text-theme-sm font-bold text-emerald-600 dark:text-emerald-400">
                Total Revenue: {formatMoney(data.revenue.total)}
              </span>
            </div>

            {data.revenue.accounts.length === 0 ? (
              <div className="p-6 text-center text-theme-xs text-gray-500">
                No revenue accounts with posted credits recorded in this period.
              </div>
            ) : (
              <DataTable
                columns={accountColumns}
                rows={data.revenue.accounts}
                getRowKey={(row) => String(row.accountId)}
              />
            )}
          </div>

          {/* Section 2: OPERATING EXPENSES */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <h4 className="text-theme-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  2. Operating Expenses
                </h4>
              </div>
              <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Total Expenses: {formatMoney(data.expenses.total)}
              </span>
            </div>

            {data.expenses.accounts.length === 0 ? (
              <div className="p-6 text-center text-theme-xs text-gray-500">
                No operating expenses with posted debits recorded in this
                period.
              </div>
            ) : (
              <DataTable
                columns={accountColumns}
                rows={data.expenses.accounts}
                getRowKey={(row) => String(row.accountId)}
              />
            )}
          </div>

          {/* Bottom Line Strip */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
              data.isProfitable
                ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-rose-200/80 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20"
            }`}
          >
            <div>
              <span className="text-theme-xs uppercase font-semibold text-gray-600 dark:text-gray-300">
                Bottom Line Result
              </span>
              <div
                className={`text-lg font-extrabold ${
                  data.isProfitable
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-rose-900 dark:text-rose-200"
                }`}
              >
                {data.isProfitable
                  ? "Net Operating Profit: "
                  : "Net Operating Deficit: "}
                <span>{formatMoney(data.netIncome)}</span>
              </div>
            </div>

            <div className="text-right text-theme-xs text-gray-500 dark:text-gray-400">
              <span>
                Period: {formatDate(data.period.startDate)} —{" "}
                {formatDate(data.period.endDate)}
              </span>
              <div className="text-[11px]">
                Generated {new Date(data.generatedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
