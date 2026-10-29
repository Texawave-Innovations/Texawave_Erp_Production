"use client";

import { useMemo } from "react";
import type {
  FinanceBankAccount,
  FinanceBankTransaction,
} from "@texawave-erp/api-types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Landmark,
} from "lucide-react";
import { formatMoney } from "../../shared/format";

export interface BankingSummaryCardsProps {
  accounts: FinanceBankAccount[];
  transactions: FinanceBankTransaction[];
  totalServerAccounts?: number | undefined;
}

export function BankingSummaryCards({
  accounts,
  transactions,
  totalServerAccounts,
}: BankingSummaryCardsProps) {
  const summary = useMemo(() => {
    let totalBalance = 0;
    let activeAccountsCount = 0;
    let savingsBalance = 0;
    let currentBalance = 0;

    for (const acc of accounts) {
      const bal = Number(acc.currentBalance || 0);
      if (acc.isActive) {
        activeAccountsCount += 1;
        totalBalance += bal;
      }
      if (acc.accountType === "SAVINGS") savingsBalance += bal;
      if (acc.accountType === "CURRENT") currentBalance += bal;
    }

    let totalCredits = 0;
    let totalDebits = 0;
    let reconciledCount = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount || 0);
      if (tx.transactionType === "CREDIT") {
        totalCredits += amt;
      } else if (tx.transactionType === "DEBIT") {
        totalDebits += amt;
      }
      if (tx.isReconciled) {
        reconciledCount += 1;
      }
    }

    const reconciliationRate =
      transactions.length > 0
        ? Math.round((reconciledCount / transactions.length) * 100)
        : 100;

    return {
      totalBalance,
      activeAccountsCount,
      savingsBalance,
      currentBalance,
      totalCredits,
      totalDebits,
      reconciledCount,
      reconciliationRate,
    };
  }, [accounts, transactions]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative focus-within:z-30">
      {/* 1. Total Treasury Balance */}
      <div className="flex flex-col gap-2 rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Total Treasury Balance
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Landmark className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {formatMoney(summary.totalBalance)}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {summary.activeAccountsCount} active bank{" "}
            {summary.activeAccountsCount === 1 ? "account" : "accounts"}
          </span>
        </div>
      </div>

      {/* 2. Registered Accounts */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Bank Accounts
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 shadow-xs">
            <Building2 className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {totalServerAccounts ?? accounts.length}
          </span>
          <span className="text-theme-xs text-sky-700 dark:text-sky-300 font-medium mt-1">
            {summary.activeAccountsCount} active ·{" "}
            {(totalServerAccounts ?? accounts.length) -
              summary.activeAccountsCount}{" "}
            archived
          </span>
        </div>
      </div>

      {/* 3. Credits / Inflows */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Deposits & Inflows
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs">
            <ArrowDownLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatMoney(summary.totalCredits)}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            Total credit movements
          </span>
        </div>
      </div>

      {/* 4. Debits / Outflows */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Withdrawals & Fees
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shadow-xs">
            <ArrowUpRight className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
            {formatMoney(summary.totalDebits)}
          </span>
          <div className="flex items-center gap-1.5 mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
            <span>{summary.reconciliationRate}% reconciled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
