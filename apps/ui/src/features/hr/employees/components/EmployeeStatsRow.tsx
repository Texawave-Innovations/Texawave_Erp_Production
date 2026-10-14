"use client";

import { ClipboardCheck, UserCheck, UserCog, Users } from "lucide-react";
import { Skeleton } from "@texawave-erp/ui-kit";
import { StatCard } from "@/features/hr/components";
import { useEmployeeStats } from "../hooks";

/**
 * Directory headline counts (GET /hr/employees/stats) — already narrowed to
 * the caller's read scope by the API, so a team lead sees their team's
 * numbers. A failed load hides the row; the table below still works.
 */
export function EmployeeStatsRow() {
  const stats = useEmployeeStats();

  if (stats.isPending) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (stats.isError) return null;

  const s = stats.data;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        headingId="employees-stat-total"
        label="Total employees"
        value={s.total}
        note={`${s.joinedThisMonth} joined this month`}
        icon={Users}
        tone="brand"
      />
      <StatCard
        headingId="employees-stat-active"
        label="Active"
        value={s.byStatus.ACTIVE ?? 0}
        note={`${s.withoutLogin} without a login`}
        icon={UserCheck}
        tone="success"
      />
      <StatCard
        headingId="employees-stat-review"
        label="Awaiting review"
        value={s.onboarding.pendingReview}
        note={
          s.onboarding.changesRequested > 0
            ? `${s.onboarding.changesRequested} sent back for changes`
            : "Submitted onboarding profiles"
        }
        icon={ClipboardCheck}
        tone={s.onboarding.pendingReview > 0 ? "warning" : "neutral"}
      />
      <StatCard
        headingId="employees-stat-onboarding"
        label="Onboarding in progress"
        value={s.onboarding.profileIncomplete}
        note="Profile not yet submitted"
        icon={UserCog}
        tone="info"
      />
    </div>
  );
}
