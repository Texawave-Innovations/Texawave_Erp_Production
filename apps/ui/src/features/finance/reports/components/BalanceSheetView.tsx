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
  Building2,
  Calendar,
  CheckCircle2,
  Landmark,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";
import { useBalanceSheet } from "../hooks";

export function BalanceSheetView() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [asOfDate, setAsOfDate] = useState(todayStr);

  const queryParams = useMemo(() => {
    return asOfDate ? { asOfDate } : {};
  }, [asOfDate]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useBalanceSheet(queryParams);

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

  return (
    <div className="space-y-6">
      {/* Filter & Date Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
              Statement of Financial Position
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Snapshot of organizational assets, liabilities, and equity
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              As of Date:
            </span>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-44 text-theme-xs"
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

      {isLoading ? (
        <TableSkeleton rowsCount={8} columnsCount={3} />
      ) : isError ? (
        <div className="p-8">
          <ErrorState
            title="Failed to Load Balance Sheet"
            description={
              (error as Error)?.message ||
              "Unable to generate the balance sheet from accounting records."
            }
            onRetry={() => void refetch()}
          />
        </div>
      ) : !data ? (
        <EmptyState
          title="No Statement Data"
          description="No financial ledger entries were found as of the selected date."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Assets */}
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4.5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-blue-700 dark:text-sky-300">
                <span>Total Assets</span>
                <Landmark className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-blue-900 dark:text-white">
                {formatMoney(data.assets.total)}
              </div>
              <span className="mt-1 text-theme-xs text-blue-600/80 dark:text-sky-400/80">
                {data.assets.accounts.length} active asset accounts
              </span>
            </div>

            {/* Total Liabilities */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>Total Liabilities</span>
                <Building2 className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {formatMoney(data.liabilities.total)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                {data.liabilities.accounts.length} active liability accounts
              </span>
            </div>

            {/* Total Equity */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>Total Equity</span>
                <ShieldCheck className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {formatMoney(data.equity.total)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                Incl. Retained Earnings:{" "}
                {formatMoney(data.equity.retainedEarnings)}
              </span>
            </div>

            {/* Invariant Verification */}
            <div
              className={`rounded-2xl border p-4.5 ${
                data.isBalanced
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex items-center justify-between text-theme-xs font-bold uppercase tracking-wider">
                <span
                  className={
                    data.isBalanced
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-amber-700 dark:text-amber-300"
                  }
                >
                  Accounting Equation
                </span>
                {data.isBalanced ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div
                className={`mt-2 text-base font-bold ${
                  data.isBalanced
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}
              >
                {data.isBalanced ? "Assets = Liab. + Equity" : "Out of Balance"}
              </div>
              <span
                className={`mt-1 text-theme-xs ${
                  data.isBalanced
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {data.isBalanced
                  ? "Double-entry verified"
                  : `Diff: ₹${formatMoney(data.difference)}`}
              </span>
            </div>
          </div>

          {/* Section 1: ASSETS */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1769F5]" />
                <h4 className="text-theme-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  1. Assets
                </h4>
              </div>
              <span className="text-theme-sm font-bold text-[#1769F5] dark:text-sky-400">
                Total: {formatMoney(data.assets.total)}
              </span>
            </div>

            {data.assets.accounts.length === 0 ? (
              <div className="p-6 text-center text-theme-xs text-gray-500">
                No asset accounts with balances recorded.
              </div>
            ) : (
              <DataTable
                columns={accountColumns}
                rows={data.assets.accounts}
                getRowKey={(row) => String(row.accountId)}
              />
            )}
          </div>

          {/* Section 2: LIABILITIES */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <h4 className="text-theme-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  2. Liabilities
                </h4>
              </div>
              <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Total: {formatMoney(data.liabilities.total)}
              </span>
            </div>

            {data.liabilities.accounts.length === 0 ? (
              <div className="p-6 text-center text-theme-xs text-gray-500">
                No liability accounts with balances recorded.
              </div>
            ) : (
              <DataTable
                columns={accountColumns}
                rows={data.liabilities.accounts}
                getRowKey={(row) => String(row.accountId)}
              />
            )}
          </div>

          {/* Section 3: EQUITY */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <h4 className="text-theme-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  3. Equity & Reserves
                </h4>
              </div>
              <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Total: {formatMoney(data.equity.total)}
              </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.equity.accounts.length > 0 && (
                <DataTable
                  columns={accountColumns}
                  rows={data.equity.accounts}
                  getRowKey={(row) => String(row.accountId)}
                />
              )}

              {/* Retained Earnings Row */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/40 dark:bg-gray-800/20 text-theme-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1769F5] dark:text-sky-400">
                    RE-EARN
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Retained Earnings / Cumulative P&L
                  </span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatMoney(data.equity.retainedEarnings)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Verification Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <span className="text-theme-xs uppercase font-semibold text-gray-500">
                Balance Sheet Integrity
              </span>
              <div className="text-base font-extrabold text-gray-900 dark:text-white">
                Total Liabilities & Equity:{" "}
                <span className="text-[#1769F5] dark:text-sky-400">
                  {formatMoney(data.liabilities.total + data.equity.total)}
                </span>
              </div>
            </div>

            <div className="text-right text-theme-xs text-gray-400">
              <span>As of {formatDate(data.asOfDate)}</span>
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
