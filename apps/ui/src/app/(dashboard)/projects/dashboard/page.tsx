"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  Flag,
  FolderKanban,
  IndianRupee,
  Pause,
  Plus,
  TrendingUp,
  Users2,
  XCircle,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  StatCard,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import {
  useDashboardMetrics,
  useProjects,
  useResourceTracking,
} from "@/features/projects/hooks";
import {
  HealthBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";
import { formatCurrency } from "@/features/projects/format";

// Legacy status tiles (`ProjectsDashboard.tsx` §3) — completed maps to the
// brand sky tone (legacy used a non-brand accent there).
const STATUS_TILES = {
  active: {
    label: "Active",
    icon: TrendingUp,
    className:
      "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400",
  },
  on_hold: {
    label: "On Hold",
    icon: Pause,
    className:
      "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className:
      "border-sky-200 bg-sky-50/60 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className:
      "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400",
  },
} as const;

/** Adapter so ui-kit `StatCard`'s stretched link uses client-side routing. */
function NextLink({
  href,
  className,
  children,
  "aria-label": ariaLabel,
  onClick,
}: {
  href: string;
  className?: string | undefined;
  children?: React.ReactNode | undefined;
  "aria-label"?: string | undefined;
  onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
}) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      {...(onClick ? { onClick } : {})}
    >
      {children}
    </Link>
  );
}

export default function ProjectsDashboardPage() {
  const metricsQuery = useDashboardMetrics();
  const metrics = metricsQuery.data;
  // Legacy "Recent Projects Directory" shows the latest 8.
  const projectsQuery = useProjects({ limit: 8 });
  const { data: resourcesData } = useResourceTracking();

  const projects = projectsQuery.data?.data ?? [];
  const statusCount = (s: string) =>
    metrics?.statusBreakdown.find((b) => b.status === s)?.count ?? 0;
  const activeTasksInProgress = (resourcesData?.resources ?? []).reduce(
    (s, r) => s + (r.activeTasksCount ?? 0),
    0,
  );

  const signalCards = [
    {
      label: "Projects On Track",
      value: metrics?.onTrackProjects ?? 0,
      sub: "All milestones within target date",
      icon: CheckCircle2,
      iconClass:
        "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      href: "/projects/list?filter=on-track",
    },
    {
      label: "Delayed Projects",
      value: metrics?.delayedProjects ?? 0,
      sub: "Milestones past due date",
      icon: AlertTriangle,
      iconClass:
        (metrics?.delayedProjects ?? 0) > 0
          ? "bg-rose-100/80 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
          : "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      href: "/projects/list?filter=delayed",
    },
    {
      label: "Resource Utilization",
      value: `${resourcesData?.overallUtilizationPercent ?? 0}%`,
      sub: `${activeTasksInProgress} tasks in progress by ${resourcesData?.activeEngineersCount ?? 0} team`,
      icon: Users2,
      iconClass:
        "bg-blue-100/80 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
      href: "/projects/resources",
    },
    {
      label: "Upcoming Milestones",
      value: metrics?.upcomingMilestonesCount ?? 0,
      sub: "Due in next 7 business days",
      icon: Flag,
      iconClass:
        "bg-amber-100/80 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      href: "/projects/list?filter=upcoming",
    },
    {
      label: "Open Tasks",
      value: metrics?.openTasksCount ?? 0,
      sub: `${activeTasksInProgress} currently active`,
      icon: CheckSquare,
      iconClass:
        "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
      href: "/projects/my-work",
    },
  ];

  if (metricsQuery.isError) {
    return (
      <ErrorState
        title="Could not load the project dashboard"
        onRetry={() => metricsQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Base summary cards (legacy statCards, each clickable) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headingId="prj-dash-total"
          label="Total Projects"
          value={metrics?.totalProjects ?? 0}
          note={`${statusCount("active")} active`}
          tone="blue"
          icon={FolderKanban}
          href="/projects/list"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-hours"
          label="Hours Logged"
          value={`${metrics?.hours.totalLoggedHours ?? 0}h`}
          note={`of ${metrics?.hours.totalExpectedHours ?? 0}h expected`}
          tone="cyan"
          icon={Clock}
          href="/projects/analytics"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-budget"
          label="Total Budget"
          value={formatCurrency(metrics?.financials.totalContractPrice ?? 0)}
          note={`${formatCurrency(metrics?.financials.totalActualSpend ?? 0)} spent`}
          tone="emerald"
          icon={IndianRupee}
          href="/projects/budget-utilization"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-completed"
          label="Completed"
          value={metrics?.completedProjects ?? 0}
          note={`${statusCount("on_hold")} on hold`}
          tone="brand"
          icon={TrendingUp}
          href="/projects/list?status=completed"
          LinkComponent={NextLink}
        />
      </div>

      {/* 2. Health & deliverable signals (clickable filters) */}
      <div>
        <h2 className="mb-3 pl-1 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Health &amp; Deliverable Signals (Clickable filters)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {signalCards.map((sc) => {
            const Icon = sc.icon;
            return (
              <Link
                key={sc.label}
                href={sc.href}
                className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="truncate text-[11px] font-extrabold uppercase text-gray-600 dark:text-gray-300">
                    {sc.label}
                  </span>
                  <span
                    className={`rounded-xl p-2 transition-transform group-hover:scale-110 motion-reduce:transition-none ${sc.iconClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  {sc.value}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">
                  {sc.sub}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. Status breakdown tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(metrics?.statusBreakdown ?? []).map((s) => {
          const tile = STATUS_TILES[s.status as keyof typeof STATUS_TILES];
          const Icon = tile?.icon ?? FolderKanban;
          return (
            <Link
              key={s.status}
              href={`/projects/list?status=${s.status}`}
              className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${tile?.className ?? ""}`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  {tile?.label ?? s.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-2xl font-extrabold">{s.count}</p>
              <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                {formatCurrency(s.totalValue)} value
              </p>
            </Link>
          );
        })}
      </div>

      {/* 4. Recent projects directory + quick operations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Recent Projects Directory
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Latest active project status, milestone delivery health &amp;
                budget utilization
              </p>
            </div>
            <Link
              href="/projects/list"
              className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-sky-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              View All Projects
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {projectsQuery.isPending ? (
            <TableSkeleton rowsCount={5} columnsCount={7} className="m-4" />
          ) : projectsQuery.isError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load recent projects"
                onRetry={() => projectsQuery.refetch()}
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No projects created yet"
                action={
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Project
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-xs font-black uppercase tracking-wider text-white">
                  <tr>
                    <th className="rounded-l-xl px-4 py-3.5 text-center">
                      Code / Project
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      Customer / Client
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      Status &amp; Health
                    </th>
                    <th className="px-4 py-3.5 text-center">Milestones</th>
                    <th className="px-4 py-3.5 text-center">
                      Hours (Logged / Exp)
                    </th>
                    <th className="px-4 py-3.5 text-center">Contract Price</th>
                    <th className="rounded-r-xl px-4 py-3.5 text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {projects.map((p) => {
                    const milestonesDone = p.milestones.filter(
                      (m) => m.status === "completed",
                    ).length;
                    return (
                      <tr
                        key={p.id}
                        className="group transition-colors hover:bg-sky-50/40 dark:hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-4 text-center">
                          <span className="mx-auto block w-fit rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                            {p.projectCode}
                          </span>
                          <Link
                            href={`/projects/${p.id}`}
                            className="mx-auto mt-1 block text-center text-sm font-bold text-gray-900 hover:underline group-hover:text-brand-700 dark:text-white dark:group-hover:text-cyan-300"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-gray-800 dark:text-gray-200">
                          {p.customerName || p.customer?.name || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <StatusBadge status={p.status} />
                            <HealthBadge health={p.health} />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {milestonesDone} / {p.milestones.length} Done
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs font-bold">
                          <span className="font-black text-brand-700 dark:text-cyan-300">
                            {p.totalLoggedHours ?? 0}h
                          </span>
                          <span className="text-gray-400">
                            {" "}
                            / {Number(p.expectedHours) || 0}h
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs font-black text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(p.projectPrice)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Link
                            href={`/projects/${p.id}`}
                            title="View Project Details"
                            aria-label={`View ${p.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-brand-600 shadow-sm transition-colors hover:bg-sky-50 dark:border-gray-700 dark:bg-gray-900 dark:text-cyan-400 dark:hover:bg-gray-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick operations (new-module addition, kept) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Quick Operations
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Direct access to essential workflows.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {[
              {
                href: "/projects/new",
                title: "Create Project",
                sub: "Auto-numbered PRJ sequence",
                icon: Plus,
                iconClass:
                  "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
              },
              {
                href: "/projects/my-work",
                title: "My Work & Timer",
                sub: "Track tasks and live stopwatch",
                icon: Clock,
                iconClass:
                  "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
              },
              {
                href: "/projects/points-master",
                title: "Points Leaderboard",
                sub: "Top contributors & rewards",
                icon: Award,
                iconClass:
                  "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
              },
            ].map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-3 transition-colors hover:border-sky-200 hover:bg-sky-50/50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${q.iconClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                        {q.title}
                      </h4>
                      <p className="text-[11px] text-gray-500">{q.sub}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
