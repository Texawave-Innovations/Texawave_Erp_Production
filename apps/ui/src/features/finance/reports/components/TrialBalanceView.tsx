"use client";

import { useMemo, useState } from "react";
import type { TrialBalanceItem } from "@texawave-erp/api-types";
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
  Calendar,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { AccountBadge } from "../../../finance/coa/components/AccountBadge";
import { formatMoney } from "../../shared/format";
import { useTrialBalance } from "../hooks";

export function TrialBalanceView() {
  const defaultStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  }, []);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [asOfDate, setAsOfDate] = useState(todayStr);

  const queryParams = useMemo(() => {
    return {
      ...(startDate ? { startDate } : {}),
      ...(asOfDate ? { asOfDate } : {}),
    };
  }, [startDate, asOfDate]);

  const isInvalidDateRange = Boolean(
    startDate && asOfDate && startDate > asOfDate,
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useTrialBalance(queryParams, { enabled: !isInvalidDateRange });

  const columns: DataTableColumn<TrialBalanceItem>[] = [
    {
      header: "ACCOUNT",
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-bold text-theme-sm text-[#1769F5] dark:text-sky-400">
            <span>{row.accountCode}</span>
          </div>
          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
            {row.accountName}
          </span>
        </div>
      ),
    },
    {
      header: "TYPE",
      cell: (row) => <AccountBadge type={row.accountType} />,
    },
    {
      header: "OPENING DEBIT",
      align: "right",
      cell: (row) => (
        <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
          {row.openingDebit > 0 ? formatMoney(row.openingDebit) : "—"}
        </span>
      ),
    },
    {
      header: "OPENING CREDIT",
      align: "right",
      cell: (row) => (
        <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
          {row.openingCredit > 0 ? formatMoney(row.openingCredit) : "—"}
        </span>
      ),
    },
    {
      header: "PERIOD DEBIT",
      align: "right",
      cell: (row) => (
        <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
          {row.periodDebit > 0 ? formatMoney(row.periodDebit) : "—"}
        </span>
      ),
    },
    {
      header: "PERIOD CREDIT",
      align: "right",
      cell: (row) => (
        <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
          {row.periodCredit > 0 ? formatMoney(row.periodCredit) : "—"}
        </span>
      ),
    },
    {
      header: "CLOSING DEBIT",
      align: "right",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {row.closingDebit > 0 ? formatMoney(row.closingDebit) : "—"}
        </span>
      ),
    },
    {
      header: "CLOSING CREDIT",
      align: "right",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {row.closingCredit > 0 ? formatMoney(row.closingCredit) : "—"}
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
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
              Trial Balance Statement
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Summarizes opening, movement, and closing balances across all
              ledger accounts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Period Start:
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
              As of Date:
            </span>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
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
              Period start date ({startDate}) cannot be after as-of date (
              {asOfDate}). Please adjust the date filter.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <TableSkeleton rowsCount={10} columnsCount={8} />
      ) : isError ? (
        <div className="p-8">
          <ErrorState
            title="Failed to Load Trial Balance"
            description={
              (error as Error)?.message ||
              "Unable to calculate trial balance from posted journal entries."
            }
            onRetry={() => void refetch()}
          />
        </div>
      ) : !data || data.accounts.length === 0 ? (
        <EmptyState
          title="No Ledger Activity"
          description="No chart of accounts or journal entries recorded as of the selected date."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary Balancing Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <span className="text-theme-xs font-bold uppercase tracking-wider text-gray-500">
                Total Closing Debits
              </span>
              <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {formatMoney(data.totalDebit)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                Aggregate debit balances
              </span>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white p-4.5 dark:border-gray-800 dark:bg-gray-900">
              <span className="text-theme-xs font-bold uppercase tracking-wider text-gray-500">
                Total Closing Credits
              </span>
              <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {formatMoney(data.totalCredit)}
              </div>
              <span className="mt-1 text-theme-xs text-gray-500">
                Aggregate credit balances
              </span>
            </div>

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
                  Balance Verification
                </span>
                {data.isBalanced ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div
                className={`mt-2 text-xl font-extrabold ${
                  data.isBalanced
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}
              >
                {data.isBalanced
                  ? "Debits = Credits Balanced"
                  : "Discrepancy Detected"}
              </div>
              <span
                className={`mt-1 text-theme-xs ${
                  data.isBalanced
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {data.isBalanced
                  ? "Difference: ₹0.00"
                  : `Diff: ₹${formatMoney(data.difference)}`}
              </span>
            </div>
          </div>

          {/* Statement Table */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <DataTable
              columns={columns}
              rows={data.accounts}
              getRowKey={(row) => String(row.accountId)}
            />

            {/* Table Summary Footer */}
            <div className="flex flex-wrap items-center justify-between border-t border-gray-200/80 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-850">
              <div className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Grand Totals ({data.accounts.length} accounts):
              </div>
              <div className="flex items-center gap-8 text-theme-sm font-extrabold">
                <div>
                  <span className="text-theme-xs font-semibold text-gray-500 mr-2">
                    Total Debit:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatMoney(data.totalDebit)}
                  </span>
                </div>
                <div>
                  <span className="text-theme-xs font-semibold text-gray-500 mr-2">
                    Total Credit:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatMoney(data.totalCredit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
