"use client";

import { AlertTriangle, Calendar, CheckCircle2, Clock } from "lucide-react";
import { Card, Skeleton } from "@texawave-erp/ui-kit";
import type { LeaveBalanceItem } from "../types";

/**
 * Balances are computed server-side (Docs/HR_LEAVE.md §5) — this renders
 * them, it never computes them. Unpaid leave types show "Not balance-limited"
 * instead of a number (`available` is null for them).
 */
export function LeaveBalanceCards({
  balances,
  isPending,
}: {
  balances: LeaveBalanceItem[] | undefined;
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <Skeleton className="h-3.5 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-theme-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              No active leave types configured
            </h3>
            <p className="text-theme-xs text-amber-700 leading-relaxed dark:text-amber-300/90">
              No active leave types are configured yet. Ask HR or an
              administrator to set up leave types and entitlements before
              requesting leave.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {balances.map((b) => (
        <Card
          key={b.leaveTypeId}
          className="group relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:border-brand-500/30 hover:shadow-sm"
        >
          {/* Top accent bar */}
          <div
            className={`absolute inset-x-0 top-0 h-1 ${
              b.isPaid
                ? "bg-linear-to-r from-brand-400 to-brand-600"
                : "bg-linear-to-r from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600"
            }`}
          />

          <div className="flex flex-col gap-3 pt-1">
            {/* Header: Title + Type Code & Paid Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                  {b.name}
                </span>
                <span className="text-theme-xs font-mono text-gray-500 dark:text-gray-400">
                  {b.code}
                </span>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  b.isPaid
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {b.isPaid ? "Paid" : "Unpaid"}
              </span>
            </div>

            {/* Primary Value: Available days */}
            <div>
              {b.isPaid ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {b.available ?? 0}
                  </span>
                  <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    days available
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-1 text-theme-sm font-medium text-gray-600 dark:text-gray-300">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Not balance-limited</span>
                </div>
              )}
            </div>

            {/* Breakdown statistics */}
            {b.isPaid ? (
              <div className="mt-1 border-t border-gray-100 pt-2.5 dark:border-gray-800/80">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Entitlement:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                      {b.entitlement}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Accrued:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                      {b.accrued}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Used:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                      {b.used}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Pending:</span>
                    <span className="font-semibold text-warning-600 dark:text-warning-400 font-mono">
                      {b.pending}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
