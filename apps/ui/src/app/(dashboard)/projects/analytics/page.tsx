"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  PieChart,
  TrendingUp,
} from "lucide-react";
import {
  useDashboardMetrics,
  useDepartmentBreakdown,
} from "@/features/projects/hooks";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function AnalyticsPage() {
  const { data: metrics } = useDashboardMetrics();
  const { data: deptData, isLoading: loadingDepts } = useDepartmentBreakdown();

  const breakdown = useMemo(
    () => deptData?.breakdown || [],
    [deptData?.breakdown],
  );

  const totalDeptCost = useMemo(() => {
    return breakdown.reduce(
      (acc, d) => acc + (Number(d.totalActualCost) || 0),
      0,
    );
  }, [breakdown]);

  const totalDeptHours = useMemo(() => {
    return breakdown.reduce((acc, d) => acc + (Number(d.loggedHours) || 0), 0);
  }, [breakdown]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Projects Analytics & Department Velocity
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Portfolio health metrics, hours distribution across departments, and
            operational spend.
          </p>
        </div>

        <Link
          href="/projects/budget-utilization"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <PieChart className="h-4 w-4" />
          Budget & EVM Details
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Projects
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {metrics?.activeProjects || 0}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Out of {metrics?.totalProjects || 0} total registered
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Delayed Alerts
            </span>
            <div
              className={`rounded-xl p-2 ${
                (metrics?.delayedProjects || 0) > 0
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-extrabold ${
              (metrics?.delayedProjects || 0) > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {metrics?.delayedProjects || 0}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Incomplete milestones past target date
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Delivery Momentum
            </span>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
            {metrics?.totalProjects
              ? Math.round(
                  ((metrics.onTrackProjects + metrics.completedProjects) /
                    metrics.totalProjects) *
                    100,
                )
              : 100}
            %
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Portfolio on-time delivery rate
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Logged Hours
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {metrics?.hours?.totalLoggedHours
              ? Number(metrics.hours.totalLoggedHours).toFixed(1)
              : "0.0"}
            h
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Cumulative stopwatch tracking
          </p>
        </div>
      </div>

      {/* Main Grid: Department Breakdown and Velocity Signals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Breakdown Card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Department Distribution & Spend
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
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-cyan-400" />
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
                const costPct =
                  totalDeptCost > 0
                    ? Math.round((cost / totalDeptCost) * 100)
                    : 0;
                const hoursPct =
                  totalDeptHours > 0
                    ? Math.round((hours / totalDeptHours) * 100)
                    : 0;

                return (
                  <div
                    key={dept.department}
                    className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {dept.department}
                      </div>
                      <span className="rounded-lg bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-cyan-300">
                        {dept.projectsCount}{" "}
                        {dept.projectsCount === 1 ? "Project" : "Projects"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Hours Logged:
                        </span>
                        <div className="font-mono font-bold text-gray-800 dark:text-gray-200">
                          {hours.toFixed(1)}h ({hoursPct}%)
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Total Spend:
                        </span>
                        <div className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                          {formatCurrency(cost)}
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

        {/* Portfolio Status Distribution & Health */}
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Portfolio Status & Velocity Signals
              </h2>
            </div>
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
                <span className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
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
                <span className="font-mono text-sm font-extrabold text-blue-700 dark:text-cyan-400">
                  {metrics?.activeProjects || 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-blue-700/80 dark:text-cyan-400/80">
                Currently running tasks, milestones, and stopwatch sessions.
              </p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Delayed Target Date Risks
                </span>
                <span className="font-mono text-sm font-extrabold text-rose-700 dark:text-rose-400">
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
              and flagged as <strong>On Track</strong> when all active
              milestones remain within schedule.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
