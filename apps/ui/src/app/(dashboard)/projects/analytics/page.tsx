"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  FolderKanban,
  IndianRupee,
  PieChart,
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
  useDepartmentBreakdown,
  useResourceTracking,
} from "@/features/projects/hooks";
import { formatCurrency, percent } from "@/features/projects/format";
import type { DepartmentSpendItem } from "@/features/projects/types";

/** `GET /projects/analytics/department-breakdown` returns a bare array from
 * the service, while `api.ts` types it as `{ breakdown }` — accept both. */
function normalizeBreakdown(raw: unknown): DepartmentSpendItem[] {
  if (Array.isArray(raw)) return raw as DepartmentSpendItem[];
  if (raw && typeof raw === "object" && "breakdown" in raw) {
    const inner = (raw as { breakdown?: unknown }).breakdown;
    if (Array.isArray(inner)) return inner as DepartmentSpendItem[];
  }
  return [];
}

export default function AnalyticsPage() {
  const metricsQuery = useDashboardMetrics();
  const metrics = metricsQuery.data;
  const { data: deptData, isLoading: loadingDepts } = useDepartmentBreakdown();
  const trackingQuery = useResourceTracking();
  const tracking = trackingQuery.data;
  const [deptFilter, setDeptFilter] = useState("");

  const breakdown = useMemo(() => normalizeBreakdown(deptData), [deptData]);

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
      .filter(
        (r) => !deptFilter || (r.department ?? "Unassigned") === deptFilter,
      )
      .sort((a, b) => Number(b.loggedHours) - Number(a.loggedHours))
      .map((r) => ({
        ...r,
        projectNames: (r.projects ?? []).map((p) => p.name),
        expectedPct: percent(Number(r.loggedHours), Number(r.estimatedHours)),
      }));
  }, [tracking?.resources, deptFilter]);

  const workloadDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const r of tracking?.resources ?? [])
      set.add(r.department ?? "Unassigned");
    return [...set].sort();
  }, [tracking?.resources]);

  const totalDeptCost = useMemo(
    () =>
      breakdown.reduce((acc, d) => acc + (Number(d.totalActualCost) || 0), 0),
    [breakdown],
  );
  const totalDeptHours = useMemo(
    () => breakdown.reduce((acc, d) => acc + (Number(d.loggedHours) || 0), 0),
    [breakdown],
  );

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Project Health &amp; Workload Analytics
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Milestone health diagnostics, per-employee workload distribution,
            department spend &amp; budget variances.
          </p>
        </div>

        <Link
          href="/projects/budget-utilization"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <PieChart className="h-4 w-4" />
          Budget &amp; EVM Details
        </Link>
      </div>

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

      {/* Portfolio KPIs (new-module additions) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          headingId="an-kpi-active"
          label="Active Projects"
          value={metrics?.activeProjects ?? 0}
          note={`Out of ${metrics?.totalProjects ?? 0} total registered`}
          tone="blue"
          icon={FolderKanban}
        />
        <StatCard
          headingId="an-kpi-delayed"
          label="Delayed Alerts"
          value={metrics?.delayedProjects ?? 0}
          note="Incomplete milestones past target date"
          tone={(metrics?.delayedProjects ?? 0) > 0 ? "error" : "success"}
          icon={AlertCircle}
        />
        <StatCard
          headingId="an-kpi-upcoming"
          label="Upcoming Milestones"
          value={metrics?.upcomingMilestonesCount ?? 0}
          note="Due in next 7 business days"
          tone={
            (metrics?.upcomingMilestonesCount ?? 0) > 0 ? "warning" : "success"
          }
          icon={AlertTriangle}
          href="/projects/list?filter=upcoming"
        />
        <StatCard
          headingId="an-kpi-momentum"
          label="Delivery Momentum"
          value={`${
            metrics?.totalProjects
              ? Math.round(
                  ((metrics.onTrackProjects + metrics.completedProjects) /
                    metrics.totalProjects) *
                    100,
                )
              : 100
          }%`}
          note="Portfolio on-time delivery rate"
          tone="brand"
          icon={TrendingUp}
        />
        <StatCard
          headingId="an-kpi-logged"
          label="Total Logged Hours"
          value={`${totalLogged.toFixed(1)}h`}
          note="Cumulative stopwatch tracking"
          tone="info"
          icon={Clock}
        />
      </div>

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
              Milestones meeting schedule targets (
              {milestoneHealth.onTimeCompleted} closed on time)
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

      {/* Department Breakdown and Velocity Signals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Department Distribution &amp; Spend
              </h2>
            </div>
            <span className="text-xs font-semibold text-gray-400">
              {breakdown.length} Departments
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Allocation of work packages, labor hours, and incurred expenditure
            categorized by business unit.
          </p>

          {loadingDepts ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : breakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No department breakdown data available yet.
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              {breakdown.map((dept) => {
                const cost = Number(dept.totalActualCost) || 0;
                const hours = Number(dept.loggedHours) || 0;
                const costPct = percent(cost, totalDeptCost);
                const hoursPct = percent(hours, totalDeptHours);

                return (
                  <div
                    key={dept.department}
                    className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {dept.department}
                      </div>
                      <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-cyan-300">
                        {dept.projectsCount}{" "}
                        {dept.projectsCount === 1 ? "Project" : "Projects"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Hours Logged:
                        </span>
                        <div className="font-bold text-gray-800 dark:text-gray-200">
                          {hours.toFixed(1)}h ({hoursPct}%)
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Total Spend:
                        </span>
                        <div className="font-bold text-blue-600 dark:text-cyan-400">
                          {formatCurrency(cost)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Contract Value:
                        </span>
                        <div className="font-bold text-gray-800 dark:text-gray-200">
                          {formatCurrency(dept.totalContractPrice)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                        style={{ width: `${Math.max(5, costPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Portfolio Status &amp; Velocity Signals
            </h2>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time milestone health inspection across all live contracts.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Completed Projects
                </span>
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                  {metrics?.completedProjects || 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Delivered and closed out successfully.
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-cyan-300">
                  <FolderKanban className="h-4 w-4 text-blue-600" />
                  Active Execution
                </span>
                <span className="text-sm font-extrabold text-blue-700 dark:text-cyan-400">
                  {metrics?.activeProjects || 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-blue-700/80 dark:text-cyan-400/80">
                Currently running tasks, milestones, and stopwatch sessions.
              </p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Upcoming Milestones
                </span>
                <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                  {metrics?.upcomingMilestonesCount || 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                Milestones due in the next 7 business days.
              </p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Delayed Target Date Risks
                </span>
                <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                  {metrics?.delayedProjects || 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80">
                Action needed: Milestones past target date require rescheduling
                or resource additions.
              </p>
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">
              Health Formula Notice
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              Projects are automatically flagged as <strong>Delayed</strong> if
              any milestone has a target date prior to today while incomplete,
              <strong> At Risk</strong> when an incomplete milestone is due
              within 7 days or an open task is past its end date, and{" "}
              <strong>On Track</strong> otherwise.
            </p>
          </div>
        </div>
      </div>

      {/* Real Team Workload — legacy `ProjectAnalytics.tsx` table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 p-5 dark:border-gray-800">
          <Users2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Real Team Workload (From Tasks)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Logged vs expected hours per team member, with department,
              assigned projects and 160h monthly capacity.
            </p>
          </div>
          <select
            aria-label="Filter workload by department"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="ml-auto h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All departments</option>
            {workloadDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-3 font-bold">Team Member</th>
                  <th className="px-3 py-3 font-bold">Department</th>
                  <th className="px-3 py-3 font-bold">Assigned Projects</th>
                  <th className="px-3 py-3 font-bold">Expected Hours</th>
                  <th className="px-3 py-3 font-bold">Logged Hours</th>
                  <th className="min-w-[160px] px-3 py-3 font-bold">
                    Utilization (vs Expected)
                  </th>
                  <th className="min-w-[140px] px-3 py-3 font-bold">
                    Capacity (160h)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {workload.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
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
                                  : "bg-emerald-500"
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
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full ${
                                r.status === "OVER_CAPACITY"
                                  ? "bg-rose-500"
                                  : "bg-gradient-to-r from-blue-600 to-cyan-500"
                              }`}
                              style={{
                                width: `${Math.min(100, r.utilizationPercent)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                            {r.utilizationPercent}%
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
