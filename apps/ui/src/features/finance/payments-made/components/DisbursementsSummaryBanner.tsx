"use client";

import { useMemo } from "react";
import type { FinancePaymentMade } from "@texawave-erp/api-types";
import { Building2, CircleDollarSign, Clock, Wallet } from "lucide-react";
import { formatMoney } from "../../shared/format";

export interface DisbursementsSummaryBannerProps {
  payments: FinancePaymentMade[];
  totalServerCount?: number | undefined;
}

export function DisbursementsSummaryBanner({
  payments,
  totalServerCount,
}: DisbursementsSummaryBannerProps) {
  const {
    totalDisbursed,
    bankDisbursed,
    cashDisbursed,
    draftCount,
    draftAmount,
  } = useMemo(() => {
    let disbursedSum = 0;
    let bankSum = 0;
    let cashSum = 0;
    let drafts = 0;
    let draftSum = 0;

    for (const p of payments) {
      const amt = Number(p.amount || 0);
      if (p.status === "VOID") continue;

      if (p.status === "DRAFT") {
        drafts += 1;
        draftSum += amt;
        continue;
      }

      disbursedSum += amt;

      const modeStr = (p.paymentMode?.value ?? "").toLowerCase();
      if (
        p.bankAccountId ||
        modeStr.includes("bank") ||
        modeStr.includes("transfer") ||
        modeStr.includes("cheque") ||
        modeStr.includes("upi")
      ) {
        bankSum += amt;
      } else if (modeStr.includes("cash")) {
        cashSum += amt;
      } else {
        // Fallback: If bankAccountId exists, count as bank, else cash
        if (p.bankAccountId) {
          bankSum += amt;
        } else {
          cashSum += amt;
        }
      }
    }

    return {
      totalDisbursed: disbursedSum,
      bankDisbursed: bankSum,
      cashDisbursed: cashSum,
      draftCount: drafts,
      draftAmount: draftSum,
    };
  }, [payments]);

  if (payments.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200/70 bg-linear-to-r from-blue-50/80 via-sky-50/50 to-slate-50/60 p-4 sm:p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:via-sky-950/20 dark:to-slate-900/40 shadow-xs relative focus-within:z-30">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/80 pb-3 dark:border-blue-900/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Disbursements Summary
              </h2>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Current view breakdown across {payments.length} displayed record
                {payments.length === 1 ? "" : "s"}
                {totalServerCount !== undefined &&
                totalServerCount > payments.length
                  ? ` (of ${totalServerCount} total in system)`
                  : ""}
              </p>
            </div>
          </div>

          <div className="text-theme-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            Page View Aggregate
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Total Disbursed */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <CircleDollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
              <span>Confirmed Paid</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(totalDisbursed)}
            </span>
          </div>

          {/* Bank Outflows */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <Building2 className="h-3.5 w-3.5 text-sky-600 dark:text-cyan-400" />
              <span>Bank Transfers</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(bankDisbursed)}
            </span>
          </div>

          {/* Cash Outflows */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <Wallet className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span>Cash Payments</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(cashDisbursed)}
            </span>
          </div>

          {/* Draft Staged */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Draft Staging ({draftCount})</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(draftAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
