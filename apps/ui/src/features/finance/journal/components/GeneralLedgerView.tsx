"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  FinanceAccount,
  GeneralLedgerTransactionItem,
} from "@texawave-erp/api-types";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CreditCard,
} from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";
import { AccountBadge } from "../../../finance/coa/components/AccountBadge";
import { useAccounts } from "../../../finance/coa/hooks";
import { useGeneralLedger } from "../hooks";
import { FINANCE_JOURNAL_READ } from "../permissions";
import { usePermission } from "@/hooks/usePermission";
import { JournalEntryTypeBadge } from "./JournalEntryTypeBadge";

export function GeneralLedgerView() {
  const canRead = usePermission(FINANCE_JOURNAL_READ);
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("accountId");
  const initialAccountCode = searchParams.get("accountCode");

  const [userSelectedAccountId, setUserSelectedAccountId] = useState<
    number | undefined
  >(initialAccountId ? Number(initialAccountId) : undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const accountsQuery = useAccounts({ limit: 200, isActive: true });
  const accountsList: FinanceAccount[] = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data?.data],
  );

  const activeAccountId = useMemo(() => {
    if (userSelectedAccountId !== undefined) return userSelectedAccountId;
    if (initialAccountId) return Number(initialAccountId);
    if (initialAccountCode && accountsList.length > 0) {
      const match = accountsList.find(
        (a) => a.accountCode === initialAccountCode,
      );
      if (match) return match.id;
    }
    return accountsList[0]?.id;
  }, [
    userSelectedAccountId,
    initialAccountId,
    initialAccountCode,
    accountsList,
  ]);

  const queryParams = useMemo(() => {
    return {
      accountId: activeAccountId,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }, [activeAccountId, startDate, endDate]);

  const ledgerQuery = useGeneralLedger(queryParams);
  const report = ledgerQuery.data;

  const transactions = useMemo(
    () => report?.transactions ?? [],
    [report?.transactions],
  );

  const columns: DataTableColumn<GeneralLedgerTransactionItem>[] = [
    {
      header: "Date",
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.entryDate)}
        </span>
      ),
    },
    {
      header: "Voucher #",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-blue-600 dark:text-sky-400">
          {row.entryNumber}
        </span>
      ),
    },
    {
      header: "Type",
      cell: (row) => <JournalEntryTypeBadge type={row.entryType} />,
    },
    {
      header: "Narration / Description",
      cell: (row) => (
        <div className="flex flex-col min-w-0 max-w-sm">
          <span className="font-medium text-theme-sm text-gray-900 dark:text-white truncate">
            {row.description || row.narration}
          </span>
          {row.referenceNumber ? (
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate">
              Ref: {row.referenceNumber}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Debit",
      align: "right",
      cell: (row) => (
        <span className="font-medium text-theme-sm text-gray-900 dark:text-white">
          {row.debit > 0 ? formatMoney(row.debit) : "—"}
        </span>
      ),
    },
    {
      header: "Credit",
      align: "right",
      cell: (row) => (
        <span className="font-medium text-theme-sm text-gray-900 dark:text-white">
          {row.credit > 0 ? formatMoney(row.credit) : "—"}
        </span>
      ),
    },
    {
      header: "Running Balance",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.runningBalance)}
        </span>
      ),
    },
  ];

  if (!canRead) {
    return (
      <ErrorState
        title="Access Restricted"
        description="You do not have permission to view the General Ledger (finance.journal.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="General Ledger"
        description="Chronological audit records of all posted debits, credits, and sequential running balances per account."
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-theme-xs font-semibold">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Account Statement</span>
          </div>
        }
      />

      {/* Account & Date Filters Bar */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-center">
          <div className="flex flex-col gap-1.5">
            <label className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
              Select Ledger Account
            </label>
            <Select
              value={activeAccountId ? String(activeAccountId) : ""}
              onChange={(e) => setUserSelectedAccountId(Number(e.target.value))}
            >
              {accountsList.map((acc) => (
                <option key={acc.id} value={String(acc.id)}>
                  {acc.accountCode} — {acc.accountName} ({acc.accountType})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
              End Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Account Summary & Balances Banner */}
      {report ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Active Account
              </span>
              <AccountBadge type={report.account.accountType} />
            </div>
            <div>
              <span className="font-bold text-theme-lg text-gray-900 dark:text-white">
                {report.account.accountCode}
              </span>
              <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {report.account.accountName}
              </p>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
              Normal balance: {report.account.normalBalance}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Opening Balance
              </span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <div>
              <span className="font-bold text-theme-xl text-gray-900 dark:text-white">
                {formatMoney(report.openingBalance)}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
              Prior to {formatDate(report.period.startDate)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Period Activity
              </span>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-theme-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="h-3 w-3" /> Debits:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatMoney(report.totalDebit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-theme-xs">
                <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                  <ArrowUpRight className="h-3 w-3" /> Credits:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatMoney(report.totalCredit)}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
              {report.totalTransactions} transactions
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-theme-xs font-semibold text-blue-800 dark:text-blue-300">
                Closing Balance
              </span>
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            </div>
            <div>
              <span className="font-bold text-theme-xl text-blue-950 dark:text-white">
                {formatMoney(report.closingBalance)}
              </span>
            </div>
            <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-2">
              As of {formatDate(report.period.endDate)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
        {ledgerQuery.isPending ? (
          <TableSkeleton columnsCount={7} rowsCount={6} />
        ) : ledgerQuery.isError ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load General Ledger"
              description="Unable to fetch ledger account transactions from the server."
              onRetry={() => void ledgerQuery.refetch()}
            />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No transactions recorded"
              description="No posted transactions found for this account within the selected date range."
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={transactions}
            getRowKey={(row) => String(row.id)}
          />
        )}
      </div>
    </div>
  );
}
