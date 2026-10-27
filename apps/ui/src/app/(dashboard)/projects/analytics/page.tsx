"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Flag,
  IndianRupee,
  TrendingUp,
  Users2,
} from "lucide-react";
import {
  ErrorState,
  Skeleton,
  StatCard,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import {
  useDashboardMetrics,
  useResourceTracking,
} from "@/features/projects/hooks";
import { formatCurrency, percent } from "@/features/projects/format";
import { PageBanner } from "@/features/projects/components/PageBanner";

export default function AnalyticsPage() {
  const metricsQuery = useDashboardMetrics();
  const metrics = metricsQuery.data;
  const trackingQuery = useResourceTracking();
  const tracking = trackingQuery.data;

  // Milestone health and over-run counters come from the org-wide aggregate
  // (`GET /projects/analytics/dashboard`) — previously these were computed
  // client-side from only the first 100 projects.
  const milestoneHealth = metrics?.milestoneHealth ?? {
    onTrack: 0,
    delayed: 0,
    completed: 0,
    onTimeCompleted: 0,
    total: 0,
  };
  const overHoursOverBudget = {
    overHours: metrics?.overHoursProjects ?? 0,
    overBudget: metrics?.overBudgetProjects ?? 0,
  };

  // Real team workload — legacy listed each employee's department and project
  // names, sorted by logged hours (desc); utilization = logged vs expected.
  const workload = useMemo(() => {
    return [...(tracking?.resources ?? [])]
      .sort((a, b) => Number(b.loggedHours) - Number(a.loggedHours))
      .map((r) => ({
        ...r,
        projectNames: (r.projects ?? []).map((p) => p.name),
        expectedPct: percent(Number(r.loggedHours), Number(r.estimatedHours)),
      }));
  }, [tracking?.resources]);

  const totalBudget = metrics?.financials.totalContractPrice ?? 0;
  const totalSpent = metrics?.financials.totalActualSpend ?? 0;
  const totalExpHours = Number(metrics?.hours.totalExpectedHours ?? 0);
  const totalLogged = Number(metrics?.hours.totalLoggedHours ?? 0);
  const projectCount = metrics?.totalProjects ?? 0;

  if (metricsQuery.isError) {
    return (
      <ErrorState
        title="Could not load project analytics"
        onRetry={() => metricsQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <PageBanner
        icon={BarChart3}
        title="Project Health & Workload Analytics"
        description="Milestone health diagnostics, real-time per-employee workload distribution & budget variances."
      />

      {/* Legacy top KPIs: utilisation & over-run counters */}
      {metricsQuery.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            headingId="an-kpi-budget"
            label="Budget Utilisation"
            value={
              totalBudget > 0 ? `${percent(totalSpent, totalBudget)}%` : "—"
            }
            note={`${formatCurrency(totalSpent)} of ${formatCurrency(totalBudget)}`}
            tone="emerald"
            icon={IndianRupee}
          />
          <StatCard
            headingId="an-kpi-hours"
            label="Hours Utilisation"
            value={
              totalExpHours > 0
                ? `${percent(totalLogged, totalExpHours)}%`
                : "—"
            }
            note={`${totalLogged.toFixed(1)}h of ${totalExpHours.toFixed(1)}h`}
            tone="cyan"
            icon={Clock}
          />
          <StatCard
            headingId="an-kpi-overhours"
            label="Over-Hours Projects"
            value={overHoursOverBudget.overHours}
            note={`${projectCount - overHoursOverBudget.overHours} on track`}
            tone={overHoursOverBudget.overHours > 0 ? "error" : "success"}
            icon={AlertTriangle}
          />
          <StatCard
            headingId="an-kpi-overbudget"
            label="Over-Budget Projects"
            value={overHoursOverBudget.overBudget}
            note={`${projectCount - overHoursOverBudget.overBudget} within budget`}
            tone={overHoursOverBudget.overBudget > 0 ? "error" : "success"}
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Milestone Health & Delivery Diagnostics — legacy card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Flag className="h-5 w-5 text-brand-600 dark:text-cyan-400" />
            Milestone Health &amp; Delivery Diagnostics
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time audit of on-time milestones vs overdue / delayed
            deliverable goals
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              On-Track / Completed
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {milestoneHealth.onTrack + milestoneHealth.completed}
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Milestones meeting schedule targets
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
              <Flag className="h-3.5 w-3.5" />
              Delayed / Overdue
            </span>
            <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400">
              {milestoneHealth.delayed}
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Target date passed &amp; pending completion
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-cyan-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Total Active Goals
            </span>
            <p className="mt-1 text-2xl font-black text-blue-700 dark:text-cyan-400">
              {milestoneHealth.total}
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {milestoneHealth.completed} milestones already closed
            </p>
          </div>
        </div>
      </div>

      {/* Real Team Workload — legacy `ProjectAnalytics.tsx` table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Users2 className="h-5 w-5 text-brand-600 dark:text-cyan-400" />
            Real Team Workload (From Tasks)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Actual logged and estimated hours derived dynamically from active
            Task records
          </p>
        </div>
        {trackingQuery.isPending ? (
          <div className="p-4">
            <TableSkeleton rowsCount={4} columnsCount={6} />
          </div>
        ) : trackingQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Could not load workload data"
              onRetry={() => trackingQuery.refetch()}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                  <th className="py-3 pl-4 pr-3 font-bold">Employee</th>
                  <th className="px-3 py-3 font-bold">Department</th>
                  <th className="px-3 py-3 font-bold">Assigned Projects</th>
                  <th className="px-3 py-3 font-bold">Expected Hours</th>
                  <th className="px-3 py-3 font-bold">Logged Task Hours</th>
                  <th className="min-w-[160px] px-3 py-3 font-bold">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {workload.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      <Users2 className="mx-auto mb-2 h-7 w-7 opacity-30" />
                      No task hours logged for team members yet.
                    </td>
                  </tr>
                ) : (
                  workload.map((r) => (
                    <tr
                      key={r.employeeId}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                    >
                      <td className="py-3 pl-4 pr-3 font-semibold text-gray-900 dark:text-white">
                        {r.employeeName}
                        <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                          {r.employeeCode}
                        </span>
                        {r.designation ? (
                          <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400">
                            {r.designation}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {r.department ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {r.projectNames.length === 0 ? (
                          <span className="text-gray-400">
                            {r.assignedProjectsCount}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.projectNames.map((pn) => (
                              <span
                                key={pn}
                                className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {pn}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {Number(r.estimatedHours).toFixed(1)}h
                      </td>
                      <td className="px-3 py-3 font-bold text-brand-700 dark:text-cyan-400">
                        {Number(r.loggedHours).toFixed(1)}h
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full ${
                                r.expectedPct >= 100
                                  ? "bg-rose-500"
                                  : "bg-gradient-to-r from-blue-600 to-cyan-500"
                              }`}
                              style={{ width: `${r.expectedPct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-[11px] font-bold text-gray-600 dark:text-gray-400">
                            {Number(r.estimatedHours) > 0
                              ? `${r.expectedPct}%`
                              : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
