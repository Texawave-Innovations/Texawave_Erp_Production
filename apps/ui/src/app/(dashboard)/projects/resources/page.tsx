"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  Clock,
  Eye,
  FolderKanban,
  ListTodo,
  Star,
  TrendingUp,
  Trophy,
  Users2,
} from "lucide-react";
import {
  Dialog,
  ErrorState,
  SearchInput,
  Select,
  StatCard,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { useAuthStore } from "@/stores/auth-store";
import {
  useProjects,
  usePointsLeaderboard,
  useResourceTracking,
} from "@/features/projects/hooks";
import { listProjectTasks } from "@/features/projects/api";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";
import { formatDate } from "@/features/projects/format";
import { PageBanner } from "@/features/projects/components/PageBanner";
import type { ProjectTask, ResourceItem } from "@/features/projects/types";

const RANK_BADGE: Record<number, string> = {
  0: "bg-amber-400 text-amber-950",
  1: "bg-slate-300 text-slate-800",
  2: "bg-amber-700 text-white",
};

export default function ResourcesPage() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  const trackingQuery = useResourceTracking();
  const tracking = trackingQuery.data;
  const { data: leaderboard } = usePointsLeaderboard();
  const { data: projectsData } = useProjects({ limit: 100 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [drilldownResource, setDrilldownResource] =
    useState<ResourceItem | null>(null);

  const allProjects = useMemo(
    () => projectsData?.data ?? [],
    [projectsData?.data],
  );

  // The employee's projects come from the org-wide resource aggregate (not
  // the first page of `/projects`); the loaded list only enriches the cards
  // with client/status/role when available.
  const drilldownProjects = useMemo(() => {
    if (!drilldownResource) return [];
    const byId = new Map(allProjects.map((p) => [p.id, p]));
    const ids = new Set((drilldownResource.projects ?? []).map((p) => p.id));
    for (const p of allProjects) {
      if (p.clientHandlingPersonId === drilldownResource.employeeId)
        ids.add(p.id);
    }
    return [...ids].map((id) => {
      const full = byId.get(id);
      const ref = drilldownResource.projects?.find((p) => p.id === id);
      return {
        id,
        projectCode: full?.projectCode ?? ref?.projectCode ?? "",
        name: full?.name ?? ref?.name ?? "",
        customerName: full?.customerName ?? null,
        status: full?.status ?? null,
        members: full?.members ?? [],
      };
    });
  }, [drilldownResource, allProjects]);

  // Legacy drilldown also listed the employee's deliverable tasks. There is
  // no "tasks by employee" endpoint, so load the task lists of the projects
  // they belong to (shares the `useProjectTasks` cache key) and filter.
  const drilldownTaskQueries = useQueries({
    queries: drilldownProjects.map((p) => ({
      queryKey: ["org", orgId, "projects", "tasks", p.id],
      queryFn: () => listProjectTasks(p.id),
      enabled: Boolean(orgId) && Boolean(drilldownResource),
    })),
  });
  const drilldownTasksLoading = drilldownTaskQueries.some((q) => q.isPending);
  const drilldownTasks = useMemo(() => {
    if (!drilldownResource) return [];
    const projectById = new Map(drilldownProjects.map((p) => [p.id, p]));
    const out: (ProjectTask & { projectLabel: string })[] = [];
    for (const q of drilldownTaskQueries) {
      for (const t of q.data ?? []) {
        if (t.assignedToId !== drilldownResource.employeeId) continue;
        const proj = projectById.get(t.projectId);
        out.push({
          ...t,
          projectLabel: proj ? `${proj.projectCode} • ${proj.name}` : "",
        });
      }
    }
    return out.sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [drilldownTaskQueries, drilldownResource, drilldownProjects]);

  const resources = useMemo(
    () => tracking?.resources || [],
    [tracking?.resources],
  );

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      const matchSearch =
        !q ||
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchDept =
        deptFilter === "all" || (r.department ?? "Unassigned") === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [resources, search, statusFilter, deptFilter]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>(tracking?.departments ?? []);
    if (resources.some((r) => !r.department)) set.add("Unassigned");
    return [...set].sort();
  }, [tracking?.departments, resources]);

  const totalActiveTasks = useMemo(
    () => resources.reduce((acc, r) => acc + (r.activeTasksCount || 0), 0),
    [resources],
  );
  const totalLoggedHours = useMemo(
    () => resources.reduce((acc, r) => acc + (Number(r.loggedHours) || 0), 0),
    [resources],
  );
  const totalPointsAwarded = useMemo(
    () => (leaderboard ?? []).reduce((acc, l) => acc + (l.totalPoints || 0), 0),
    [leaderboard],
  );
  const loggedByEmployee = useMemo(
    () =>
      new Map(resources.map((r) => [r.employeeId, Number(r.loggedHours) || 0])),
    [resources],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header — legacy `ResourceTracking.tsx` title + My Work shortcut */}
      <PageBanner
        icon={Users2}
        title="Resource Tracking & Capacity"
        description="Real-time team workload allocation, active task metrics, 160h monthly capacity & points leaderboard."
        actions={
          <>
            <Link
              href="/projects/points-master"
              className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <Award className="h-4 w-4 text-amber-300" />
              View Points Leaderboard
            </Link>
            <Link
              href="/projects/my-work"
              className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-md transition-colors hover:bg-cyan-50"
            >
              <Clock className="h-4 w-4" />
              Open My Work Workspace
            </Link>
          </>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headingId="res-kpi-members"
          label="Active Team Members"
          value={tracking?.activeEngineersCount ?? 0}
          note="Total workforce on projects"
          tone="blue"
          icon={Users2}
        />
        <StatCard
          headingId="res-kpi-tasks"
          label="Tasks In Progress"
          value={totalActiveTasks}
          note="Currently active deliverables"
          tone="cyan"
          icon={ListTodo}
        />
        <StatCard
          headingId="res-kpi-util"
          label="Resource Utilization"
          value={`${tracking?.overallUtilizationPercent ?? 0}%`}
          note="Workload vs active capacity"
          tone="emerald"
          icon={TrendingUp}
        />
        <StatCard
          headingId="res-kpi-points"
          label="Total Points Awarded"
          value={`${totalPointsAwarded} pts`}
          note="Gamification reward pool"
          tone="amber"
          icon={Award}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Team Resources & Allocations table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Team Resources &amp; Allocations
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Click on any row to drill into employee projects &amp; tasks
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-56">
                <SearchInput
                  sizeVariant="sm"
                  value={search}
                  onChangeValue={setSearch}
                  onClear={() => setSearch("")}
                  placeholder="Search member, code or department..."
                  aria-label="Search team members"
                />
              </div>
              <div className="w-44">
                <Select
                  aria-label="Department filter"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-44">
                <Select
                  aria-label="Workload filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Workloads</option>
                  <option value="NORMAL">Normal Load</option>
                  <option value="OVER_CAPACITY">Over Capacity</option>
                  <option value="UNDER_UTILIZED">Available Capacity</option>
                </Select>
              </div>
            </div>
          </div>

          {trackingQuery.isPending ? (
            <div className="p-4">
              <TableSkeleton rowsCount={5} columnsCount={7} />
            </div>
          ) : trackingQuery.isError ? (
            <div className="p-6">
              <ErrorState
                title="Could not load resource tracking"
                onRetry={() => trackingQuery.refetch()}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                    <th className="py-3 pl-4 pr-3 font-bold">Team Member</th>
                    <th className="px-3 py-3 font-bold">Code</th>
                    <th className="px-3 py-3 font-bold">Department</th>
                    <th className="px-3 py-3 font-bold">Projects</th>
                    <th className="px-3 py-3 font-bold">Active Tasks</th>
                    <th className="px-3 py-3 font-bold">Points</th>
                    <th className="min-w-[170px] px-3 py-3 font-bold">
                      Monthly Capacity (160h Base)
                    </th>
                    <th className="px-3 py-3 font-bold">Workload Status</th>
                    <th className="py-3 pl-3 pr-4 text-right font-bold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredResources.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-gray-400"
                      >
                        {resources.length === 0
                          ? "No resource records found."
                          : "No team members found matching your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredResources.map((res) => {
                      const logged = Number(res.loggedHours) || 0;
                      const base = res.baseCapacityHours || 160;
                      const capacityPct = Math.min(
                        100,
                        Math.round((logged / base) * 100),
                      );
                      const isOver = res.status === "OVER_CAPACITY";
                      const isOptimal = res.status === "NORMAL";

                      return (
                        <tr
                          key={res.employeeId}
                          onClick={() => setDrilldownResource(res)}
                          className="cursor-pointer hover:bg-sky-50/40 dark:hover:bg-gray-800/40"
                        >
                          <td className="py-3 pl-4 pr-3 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-cyan-300">
                                {res.employeeName.slice(0, 1).toUpperCase()}
                              </div>
                              <span>{res.employeeName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                            {res.employeeCode}
                          </td>
                          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                            {res.department ?? "—"}
                            {res.designation ? (
                              <span className="block text-[10px] text-gray-400">
                                {res.designation}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-bold text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
                              <FolderKanban className="h-3 w-3" />
                              {res.assignedProjectsCount} projects
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-cyan-300">
                              <ListTodo className="h-3 w-3" />
                              {res.activeTasksCount} tasks
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                              <Star className="h-3 w-3" />
                              {res.totalPoints}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${
                                    isOver
                                      ? "bg-rose-500"
                                      : isOptimal
                                        ? "bg-gradient-to-r from-blue-600 to-cyan-500"
                                        : "bg-blue-400"
                                  }`}
                                  style={{ width: `${capacityPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                                {logged.toFixed(1)}/{base}h
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {isOver ? (
                              <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                                High Workload
                              </span>
                            ) : isOptimal ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                Optimal Load
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-cyan-400">
                                Available Capacity
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-3 pr-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrilldownResource(res);
                              }}
                              aria-label={`View ${res.employeeName} details`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-sky-100 dark:text-cyan-400 dark:hover:bg-gray-800"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Points Leaderboard side panel — legacy "Top 5 point earners" */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-4 dark:border-gray-800">
            <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Points Leaderboard
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Top 5 gamification point earners this period
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {!leaderboard || leaderboard.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                No gamification activity recorded yet.
              </p>
            ) : (
              leaderboard.slice(0, 5).map((entry, idx) => (
                <div
                  key={entry.employeeId}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/80 p-3 transition-colors hover:bg-sky-50/60 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                        RANK_BADGE[idx] ??
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {entry.employee?.fullName ||
                          `Employee #${entry.employeeId}`}
                      </p>
                      <p className="text-[10px] font-semibold text-gray-400">
                        {entry.employee?.designation?.name || "Engineering"} •{" "}
                        {entry.tasksCompletedCount} tasks done
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                      {entry.totalPoints} pts
                    </span>
                    <p className="text-[10px] text-gray-400">
                      {(loggedByEmployee.get(entry.employeeId) ?? 0).toFixed(1)}
                      h logged
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Per-employee drilldown — legacy row-click dialog */}
      <Dialog
        open={Boolean(drilldownResource)}
        onClose={() => setDrilldownResource(null)}
        size="3xl"
        title={
          drilldownResource ? (
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sm font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                  {drilldownResource.employeeName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="block text-base font-bold text-gray-900 dark:text-white">
                    {drilldownResource.employeeName}
                  </span>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                    {drilldownResource.designation ?? "Team member"} •{" "}
                    {drilldownResource.department ?? "No department"} • ID:{" "}
                    {drilldownResource.employeeCode} •{" "}
                    {drilldownResource.activeTasksCount} active tasks •{" "}
                    {Number(drilldownResource.loggedHours).toFixed(1)}h logged
                  </span>
                </span>
              </span>
              <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                {drilldownResource.totalPoints} Total Points
              </span>
            </span>
          ) : null
        }
      >
        {drilldownResource ? (
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Briefcase className="h-3.5 w-3.5" />
                Assigned Projects ({drilldownProjects.length})
              </h4>
              {drilldownProjects.length === 0 ? (
                <p className="text-xs italic text-gray-400">
                  Not currently a member of any project.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {drilldownProjects.map((p) => {
                    const member = p.members?.find(
                      (m) => m.employeeId === drilldownResource.employeeId,
                    );
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="rounded-2xl border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-sky-50 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:bg-gray-800"
                      >
                        <span className="text-[10px] font-bold text-brand-700 dark:text-cyan-400">
                          {p.projectCode}
                        </span>
                        <p className="mt-0.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                          {p.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                          <span>{p.customerName || "Internal"}</span>
                          {p.status ? (
                            <>
                              <span>•</span>
                              <StatusBadge status={p.status} />
                            </>
                          ) : null}
                          {member ? (
                            <span>
                              • {member.role} • {Number(member.loggedHours)}h
                              logged
                            </span>
                          ) : (
                            <span>• Client Lead</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <ListTodo className="h-3.5 w-3.5" />
                Deliverable Tasks ({drilldownTasks.length})
              </h4>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {drilldownTasksLoading && drilldownProjects.length > 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    Loading tasks...
                  </div>
                ) : drilldownTasks.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    No tasks currently assigned
                  </div>
                ) : (
                  drilldownTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 text-xs hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-brand-700 dark:text-cyan-400">
                            {t.taskCode}
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {t.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {t.projectLabel} • Dates: {formatDate(t.startDate)} →{" "}
                          {formatDate(t.endDate)} • {Number(t.hoursToComplete)}h
                          est
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                        <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                          +{t.points} pts
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
