"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  CheckSquare,
  Clock,
  Flag,
  FolderKanban,
  IndianRupee,
  Plus,
  TrendingUp,
  Users2,
} from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  SectionCard,
  Skeleton,
  StatCard,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import {
  useDashboardMetrics,
  useMyWork,
  useProjects,
  useResourceTracking,
} from "@/features/projects/hooks";
import {
  HealthBadge,
  PriorityBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";
import { ProjectMeter } from "@/features/projects/components/ProjectMeter";
import {
  formatCurrency,
  formatDate,
  isPastDue,
  percent,
} from "@/features/projects/format";
import type { Project } from "@/features/projects/types";

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

const STATUS_ORDER = ["active", "on_hold", "completed", "cancelled"] as const;

const QUICK_OPERATIONS = [
  {
    href: "/projects/new",
    title: "Create Project",
    sub: "Auto-numbered PRJ sequence",
    icon: Plus,
  },
  {
    href: "/projects/my-work",
    title: "My Work & Timer",
    sub: "Track tasks and live stopwatch",
    icon: Clock,
  },
  {
    href: "/projects/points-master",
    title: "Points Leaderboard",
    sub: "Top contributors & rewards",
    icon: Award,
  },
] as const;

export default function ProjectsDashboardPage() {
  const metricsQuery = useDashboardMetrics();
  const metrics = metricsQuery.data;
  // The latest 8 projects for the directory table.
  const projectsQuery = useProjects({ limit: 8 });
  // Projects with a milestone past its due date, worst first as the API orders them.
  const delayedQuery = useProjects({ health: "delayed", limit: 5 });
  const myWorkQuery = useMyWork();
  const { data: resourcesData } = useResourceTracking();

  const projects = projectsQuery.data?.data ?? [];
  const delayed = delayedQuery.data?.data ?? [];
  const myOpenTasks = (myWorkQuery.data ?? [])
    .filter((t) => t.status !== "completed")
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 5);

  const statusRow = (s: string) =>
    metrics?.statusBreakdown.find((b) => b.status === s);
  const statusCount = (s: string) => statusRow(s)?.count ?? 0;
  const activeTasksInProgress = (resourcesData?.resources ?? []).reduce(
    (sum, r) => sum + (r.activeTasksCount ?? 0),
    0,
  );

  if (metricsQuery.isError) {
    return (
      <ErrorState
        title="Could not load the project dashboard"
        onRetry={() => metricsQuery.refetch()}
      />
    );
  }

  const columns: DataTableColumn<Project>[] = [
    {
      header: "Project",
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-theme-xs font-semibold text-brand-700 dark:text-cyan-300">
            {p.projectCode}
          </p>
          <Link
            href={`/projects/${p.id}`}
            className="block text-theme-sm font-semibold text-gray-900 hover:text-brand-700 hover:underline dark:text-white/90 dark:hover:text-cyan-300"
          >
            {p.name}
          </Link>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {p.customerName || p.salesCustomer?.companyName || "—"}
          </p>
        </div>
      ),
    },
    {
      header: "Status & Health",
      cell: (p) => (
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={p.status} />
          <HealthBadge health={p.health} />
        </div>
      ),
    },
    {
      header: "Milestones",
      cell: (p) =>
        `${p.milestones.filter((m) => m.status === "completed").length} / ${p.milestones.length} done`,
    },
    {
      header: "Hours",
      cell: (p) => {
        const expected = Number(p.expectedHours) || 0;
        const logged = p.totalLoggedHours ?? 0;
        return (
          <ProjectMeter
            label={`Hours used for ${p.name}`}
            used={`${logged}h`}
            total={`/ ${expected}h`}
            pct={percent(logged, expected)}
          />
        );
      },
    },
    {
      header: "Contract Price",
      align: "right",
      cell: (p) => formatCurrency(p.projectPrice),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Portfolio KPIs: each card links to the filtered view */}
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

      {/* 2. Health and delivery signals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          headingId="prj-dash-on-track"
          label="Projects On Track"
          value={metrics?.onTrackProjects ?? 0}
          note="All milestones within target date"
          tone="success"
          icon={CheckCircle2}
          href="/projects/list?filter=on-track"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-delayed"
          label="Delayed Projects"
          value={metrics?.delayedProjects ?? 0}
          note="Milestones past due date"
          tone={(metrics?.delayedProjects ?? 0) > 0 ? "error" : "success"}
          icon={AlertTriangle}
          href="/projects/list?filter=delayed"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-upcoming"
          label="Upcoming Milestones"
          value={metrics?.upcomingMilestonesCount ?? 0}
          note="Due in next 7 business days"
          tone="amber"
          icon={Flag}
          href="/projects/list?filter=upcoming"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-open-tasks"
          label="Open Tasks"
          value={metrics?.openTasksCount ?? 0}
          note={`${activeTasksInProgress} currently active`}
          tone="cyan"
          icon={CheckSquare}
          href="/projects/my-work"
          LinkComponent={NextLink}
        />
        <StatCard
          headingId="prj-dash-utilization"
          label="Resource Utilization"
          value={`${resourcesData?.overallUtilizationPercent ?? 0}%`}
          note={`${activeTasksInProgress} tasks in progress by ${resourcesData?.activeEngineersCount ?? 0} team`}
          tone="blue"
          icon={Users2}
          href="/projects/resources"
          LinkComponent={NextLink}
        />
      </div>

      {/* 3. Needs attention, my tasks, portfolio by status */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard
          title="Needs attention"
          description="Projects with a milestone past its due date"
          action={
            <Link href="/projects/list?filter=delayed">
              <Button variant="glass" size="sm">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        >
          {delayedQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : delayedQuery.isError ? (
            <ErrorState
              title="Could not load delayed projects"
              onRetry={() => delayedQuery.refetch()}
            />
          ) : delayed.length === 0 ? (
            <EmptyState title="Nothing is delayed" />
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {delayed.map((p) => (
                <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-theme-xs font-semibold text-brand-700 dark:text-cyan-300">
                        {p.projectCode}
                      </span>
                      <span className="block truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {p.name}
                      </span>
                    </span>
                    <HealthBadge health={p.health} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="My open tasks"
          description="Next due first"
          action={
            <Link href="/projects/my-work">
              <Button variant="glass" size="sm">
                My Work <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        >
          {myWorkQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : myWorkQuery.isError ? (
            <ErrorState
              title="Could not load your tasks"
              onRetry={() => myWorkQuery.refetch()}
            />
          ) : myOpenTasks.length === 0 ? (
            <EmptyState title="No open tasks assigned to you" />
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {myOpenTasks.map((t) => (
                <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href="/projects/my-work"
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {t.title}
                      </span>
                      <span
                        className={
                          isPastDue(t.endDate, t.status)
                            ? "block text-theme-xs font-semibold text-error-700 dark:text-error-400"
                            : "block text-theme-xs text-gray-500 dark:text-gray-400"
                        }
                      >
                        {t.project?.name ?? "—"} · Due {formatDate(t.endDate)}
                      </span>
                    </span>
                    <PriorityBadge priority={t.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Portfolio by status"
          description="Project count and contract value"
        >
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {STATUS_ORDER.map((status) => {
              const row = statusRow(status);
              return (
                <li key={status} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/projects/list?status=${status}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <StatusBadge status={status} />
                    <span className="text-right">
                      <span className="block text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {row?.count ?? 0}
                      </span>
                      <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(row?.totalValue ?? 0)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      {/* 4. Recent projects and quick operations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <SectionCard
          className="xl:col-span-3"
          title="Recent Projects"
          description="Latest project status, milestone delivery health and hours used"
          action={
            <Link href="/projects/list">
              <Button variant="glass" size="sm">
                View All Projects <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        >
          {projectsQuery.isError ? (
            <ErrorState
              title="Could not load recent projects"
              onRetry={() => projectsQuery.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={projects}
              getRowKey={(p) => String(p.id)}
              caption="Recent projects"
              loading={projectsQuery.isPending}
              loadingRowsCount={5}
              emptyState={
                <div className="py-8">
                  <EmptyState
                    title="No projects created yet"
                    action={
                      <Link href="/projects/new">
                        <Button size="sm">
                          <Plus className="h-4 w-4" /> Create First Project
                        </Button>
                      </Link>
                    }
                  />
                </div>
              }
            />
          )}
        </SectionCard>

        <SectionCard
          title="Quick Operations"
          description="Direct access to essential workflows"
        >
          <div className="flex flex-col gap-2">
            {QUICK_OPERATIONS.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-blue-950 dark:text-cyan-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {q.title}
                      </span>
                      <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                        {q.sub}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
