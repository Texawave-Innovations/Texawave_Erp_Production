"use client";

import { useMemo } from "react";
import type { FinanceExpense } from "@texawave-erp/api-types";
import { CheckCircle2, Clock, FileText, Receipt } from "lucide-react";
import { formatMoney } from "../../shared/format";

export interface ExpensesSummaryBannerProps {
  expenses: FinanceExpense[];
  totalServerCount?: number | undefined;
}

export function ExpensesSummaryBanner({
  expenses,
  totalServerCount,
}: ExpensesSummaryBannerProps) {
  const {
    totalPaid,
    totalPending,
    totalDraft,
    paidCount,
    pendingCount,
    draftCount,
  } = useMemo(() => {
    let paidSum = 0;
    let pendingSum = 0;
    let draftSum = 0;
    let paidC = 0;
    let pendingC = 0;
    let draftC = 0;

    for (const exp of expenses) {
      const amt = Number(exp.netAmount || exp.amount || 0);
      if (exp.status === "CANCELLED") continue;

      if (exp.status === "PAID") {
        paidSum += amt;
        paidC += 1;
      } else if (
        exp.status === "PENDING_APPROVAL" ||
        exp.status === "APPROVED"
      ) {
        pendingSum += amt;
        pendingC += 1;
      } else if (exp.status === "DRAFT") {
        draftSum += amt;
        draftC += 1;
      }
    }

    return {
      totalPaid: paidSum,
      totalPending: pendingSum,
      totalDraft: draftSum,
      paidCount: paidC,
      pendingCount: pendingC,
      draftCount: draftC,
    };
  }, [expenses]);

  if (expenses.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200/70 bg-linear-to-r from-blue-50/80 via-sky-50/50 to-slate-50/60 p-4 sm:p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:via-sky-950/20 dark:to-slate-900/40 shadow-xs relative focus-within:z-30">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/80 pb-3 dark:border-blue-900/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Operational Expenses Summary
              </h2>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Current view breakdown across {expenses.length} displayed record
                {expenses.length === 1 ? "" : "s"}
                {totalServerCount !== undefined &&
                totalServerCount > expenses.length
                  ? ` (of ${totalServerCount} total in system)`
                  : ""}
              </p>
            </div>
          </div>

          <div className="text-theme-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            Page View Aggregate
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {/* Total Paid & Settled */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Paid & Settled ({paidCount})</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(totalPaid)}
            </span>
          </div>

          {/* Pending Approval / Disbursal */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Pending Disbursal ({pendingCount})</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(totalPending)}
            </span>
          </div>

          {/* Draft Staged */}
          <div className="flex flex-col rounded-xl bg-white/90 p-3 border border-blue-100/60 dark:bg-gray-800/80 dark:border-gray-700/50 shadow-xs">
            <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>Draft Staging ({draftCount})</span>
            </div>
            <span className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
              {formatMoney(totalDraft)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
