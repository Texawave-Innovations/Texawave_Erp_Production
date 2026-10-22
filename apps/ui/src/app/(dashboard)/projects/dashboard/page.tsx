"use client";

import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  useDashboardMetrics,
  useProjects,
  useResourceTracking,
} from "@/features/projects/hooks";
import { HealthBadge } from "@/features/projects/components/HealthBadge";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function ProjectsDashboardPage() {
  const { data: metrics } = useDashboardMetrics();
  const { data: projectsData } = useProjects({ limit: 5 });
  const { data: resourcesData } = useResourceTracking();

  const projects = projectsData?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total & Active Projects */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Projects
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {metrics?.activeProjects ?? 0}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              of {metrics?.totalProjects ?? 0} total
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>{metrics?.onTrackProjects ?? 0} on track</span>
          </div>
        </div>

        {/* Contract Value & Actual Cost */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Contract Value
            </span>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(metrics?.financials.totalContractPrice ?? 0)}
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Spend:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {formatCurrency(metrics?.financials.totalActualSpend ?? 0)}
            </span>{" "}
            ({metrics?.financials.overallBudgetUtilizationPercent ?? 0}%
            utilized)
          </div>
        </div>

        {/* Earned Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Earned Revenue
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(metrics?.financials.totalEarnedRevenue ?? 0)}
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Budget Variance:{" "}
            <span
              className={`font-semibold ${(metrics?.financials.budgetVariance ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            >
              {formatCurrency(metrics?.financials.budgetVariance ?? 0)}
            </span>
          </div>
        </div>

        {/* Logged Work Hours */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Logged Hours
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {metrics?.hours.totalLoggedHours ?? 0}h
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              of {metrics?.hours.totalExpectedHours ?? 0}h
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Resource Team:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {resourcesData?.activeEngineersCount ?? 0} engineers
            </span>{" "}
            ({resourcesData?.overallUtilizationPercent ?? 0}% capacity)
          </div>
        </div>
      </div>

      {/* Active Projects Table & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Projects List */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Recent Active Projects
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track progress, milestone health, and budget variance across
                projects.
              </p>
            </div>
            <Link
              href="/projects/list"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <tr>
                  <th className="py-3 pr-4">Code & Project</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Spend / Price</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-sm text-gray-500"
                    >
                      No active projects found. Create your first project to get
                      started.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr
                      key={p.id}
                      className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-cyan-400"
                        >
                          <span className="font-mono text-xs text-blue-600 dark:text-cyan-400">
                            {p.projectCode}
                          </span>{" "}
                          • {p.name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {p.department || "General"}{" "}
                          {p.customerName ? `• ${p.customerName}` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <HealthBadge health={p.health} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                              style={{
                                width: `${Math.min(100, p.progressPercent ?? 0)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {p.progressPercent ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(Number(p.actualCost))}
                        </span>
                        <span className="text-gray-400">
                          {" "}
                          / {formatCurrency(Number(p.projectPrice))}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <Link
                          href={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Details
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links & Shortcuts */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Quick Operations
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Direct access to essential workflows.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/projects/new"
                className="flex items-center justify-between rounded-xl border border-gray-100 p-3 transition-colors hover:bg-blue-50/50 hover:border-blue-200 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                      Create Project
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Auto-numbered PRJ sequence
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/projects/my-work"
                className="flex items-center justify-between rounded-xl border border-gray-100 p-3 transition-colors hover:bg-cyan-50/50 hover:border-cyan-200 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-100 p-2 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                      My Work & Timer
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Track tasks and live stopwatch
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/projects/points-master"
                className="flex items-center justify-between rounded-xl border border-gray-100 p-3 transition-colors hover:bg-indigo-50/50 hover:border-indigo-200 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                      Points Leaderboard
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Top contributors & gamification
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
