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
} from "lucide-react";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SectionCard,
  Skeleton,
  StatCard,
  StatusBadge,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import {
  useDashboardMetrics,
  useResourceTracking,
} from "@/features/projects/hooks";
import { formatCurrency, percent } from "@/features/projects/format";
import { PageBanner } from "@/features/projects/components/PageBanner";
import { ProjectMeter } from "@/features/projects/components/ProjectMeter";

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

  type WorkloadRow = (typeof workload)[number];

  const workloadColumns: DataTableColumn<WorkloadRow>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-white/90">
            {r.employeeName}
          </span>
          <span className="ml-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {r.employeeCode}
          </span>
          {r.designation ? (
            <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
              {r.designation}
            </span>
          ) : null}
        </div>
      ),
    },
    { header: "Department", cell: (r) => r.department ?? "—" },
    {
      header: "Assigned Projects",
      cell: (r) =>
        r.projectNames.length === 0 ? (
          <span className="text-gray-500 dark:text-gray-400">
            {r.assignedProjectsCount}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {r.projectNames.map((pn) => (
              <StatusBadge key={pn} label={pn} colorToken="gray" />
            ))}
          </div>
        ),
    },
    {
      header: "Expected Hours",
      cell: (r) => `${Number(r.estimatedHours).toFixed(1)}h`,
    },
    {
      header: "Utilization",
      cell: (r) =>
        Number(r.estimatedHours) > 0 ? (
          <ProjectMeter
            label={`Hours used by ${r.employeeName}`}
            used={`${Number(r.loggedHours).toFixed(1)}h`}
            total={`/ ${Number(r.estimatedHours).toFixed(1)}h`}
            pct={r.expectedPct}
            className="min-w-44"
          />
        ) : (
          <span className="text-gray-500 dark:text-gray-400">
            {Number(r.loggedHours).toFixed(1)}h logged
          </span>
        ),
    },
  ];

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

      {/* Milestone Health & Delivery Diagnostics */}
      <SectionCard
        title="Milestone Health & Delivery Diagnostics"
        description="Real-time audit of on-time milestones vs overdue / delayed deliverable goals"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            headingId="an-ms-ontrack"
            label="On-Track / Completed"
            value={milestoneHealth.onTrack + milestoneHealth.completed}
            note="Milestones meeting schedule targets"
            tone="success"
            icon={CheckCircle2}
          />
          <StatCard
            headingId="an-ms-delayed"
            label="Delayed / Overdue"
            value={milestoneHealth.delayed}
            note="Target date passed & pending completion"
            tone={milestoneHealth.delayed > 0 ? "error" : "success"}
            icon={Flag}
          />
          <StatCard
            headingId="an-ms-total"
            label="Total Active Goals"
            value={milestoneHealth.total}
            note={`${milestoneHealth.completed} milestones already closed`}
            tone="blue"
            icon={BarChart3}
          />
        </div>
      </SectionCard>

      {/* Real Team Workload */}
      <SectionCard
        title="Real Team Workload (From Tasks)"
        description="Actual logged and estimated hours derived dynamically from active Task records"
      >
        {trackingQuery.isError ? (
          <ErrorState
            title="Could not load workload data"
            onRetry={() => trackingQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={workloadColumns}
            rows={workload}
            getRowKey={(r) => String(r.employeeId)}
            caption="Team workload"
            loading={trackingQuery.isPending}
            loadingRowsCount={4}
            emptyState={
              <div className="py-8">
                <EmptyState title="No task hours logged for team members yet." />
              </div>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
