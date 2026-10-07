"use client";

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <Card>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No active leave types are configured yet. Ask HR to set up leave types
          and entitlements before requesting leave.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => (
        <Card key={b.leaveTypeId}>
          <div className="flex flex-col gap-1">
            <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              {b.name}
            </p>
            {b.isPaid ? (
              <>
                <p className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
                  {b.available ?? 0}{" "}
                  <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                    days available
                  </span>
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Entitlement {b.entitlement} · Accrued {b.accrued} · Used{" "}
                  {b.used} · Pending {b.pending}
                </p>
              </>
            ) : (
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Unpaid leave — not balance-limited
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
