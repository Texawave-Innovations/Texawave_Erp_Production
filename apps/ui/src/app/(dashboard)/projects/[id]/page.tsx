"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Flag,
  History,
  Pencil,
  Play,
  Plus,
  Receipt,
  Square,
  Trash2,
  Users2,
} from "lucide-react";
import {
  Button,
  Dialog,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useActiveTimer,
  useAddProjectMember,
  useCreateExpense,
  useDeleteMilestone,
  useDeleteTask,
  useProject,
  useRemoveProjectMember,
  useStartTimer,
  useStopTimer,
  useUpdateTask,
} from "@/features/projects/hooks";
import {
  HealthBadge,
  PriorityBadge,
  StatusBadge,
  normalizeHealth,
} from "@/features/projects/components/HealthBadge";
import { TaskModal } from "@/features/projects/components/TaskModal";
import { MilestoneModal } from "@/features/projects/components/MilestoneModal";
import { TaskTimeLogsModal } from "@/features/projects/components/TaskTimeLogsModal";
import {
  errorMessage,
  formatCurrency,
  formatDate,
  isPastDue,
  percent,
  todayInput,
} from "@/features/projects/format";
import type {
  Project,
  ProjectMilestone,
  ProjectTask,
} from "@/features/projects/types";
import { ProjectMomHistory } from "@/features/mom/components/ProjectMomHistory";
import { useEmployees } from "@/features/hr/employees/hooks";

const DEPENDENCY_BADGE: Record<string, string> = {
  client:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  employee:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  task: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300",
};

type PendingDelete =
  | { kind: "milestone"; id: number; name: string }
  | { kind: "task"; id: number; name: string }
  | { kind: "member"; id: number; name: string };

function dependencyLabel(
  t: ProjectTask,
): { kind: string; label: string } | null {
  const kind = (
    t.dependencyType ?? (t.dependencyTaskId ? "task" : "")
  ).toLowerCase();
  if (!kind) return null;
  if (t.dependencyTask) {
    return {
      kind: "task",
      label: `${t.dependencyTask.taskCode} ${t.dependencyTask.title}`,
    };
  }
  if (kind === "client") {
    return { kind, label: `Client: ${t.dependencyTargetName ?? "Client"}` };
  }
  return { kind, label: t.dependencyTargetName ?? kind };
}

// Legacy `ProjectDetail.tsx` has no "Team Members" section, no "Project
// Incurred Expenses" card, no "Earned Revenue" row and no per-task
// "Stopwatch" column — these were additive new-module extras. The
// underlying hooks/mutations/API routes are kept (other screens and the
// Add Member / Add Expense modals still use them); only the on-page
// rendering is suppressed here to match legacy parity exactly.
const SHOW_TEAM_MEMBERS_SECTION = false;
const SHOW_EXPENSES_SECTION = false;
const SHOW_EARNED_REVENUE_ROW = false;
const SHOW_STOPWATCH_COLUMN = false;

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  const { toast } = useToast();

  const projectQuery = useProject(projectId);
  const project = projectQuery.data;
  const { data: activeTimer } = useActiveTimer();

  // Legacy auto-expands every milestone on load; track the collapsed ones.
  const [collapsed, setCollapsed] = useState<Set<number | "general">>(
    new Set(),
  );
  const toggleGroup = (id: number | "general") =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [milestoneModal, setMilestoneModal] = useState<{
    open: boolean;
    edit: ProjectMilestone | null;
  }>({ open: false, edit: null });
  const [taskModal, setTaskModal] = useState<{
    open: boolean;
    edit: ProjectTask | null;
    milestoneId: number | null;
  }>({ open: false, edit: null, milestoneId: null });
  const [logsTask, setLogsTask] = useState<ProjectTask | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );

  const deleteMilestone = useDeleteMilestone();
  const deleteTask = useDeleteTask();
  const removeMember = useRemoveProjectMember();
  const updateTask = useUpdateTask();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const tasks = useMemo(() => project?.tasks ?? [], [project]);
  const milestones = useMemo(
    () => [...(project?.milestones ?? [])].sort((a, b) => a.order - b.order),
    [project],
  );

  if (projectQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <ErrorState
          title="Project not found or has been deleted."
          description={errorMessage(projectQuery.error, "")}
          onRetry={() => projectQuery.refetch()}
        />
        <Link
          href="/projects/list"
          className="text-xs font-bold text-brand-600 hover:underline dark:text-cyan-400"
        >
          Return to Projects List
        </Link>
      </div>
    );
  }

  // Legacy progress bar = milestones completed / total.
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(
    (m) => m.status === "completed",
  ).length;
  const milestoneProgress = percent(completedMilestones, totalMilestones);
  const delayedMilestones = milestones.filter((m) =>
    isPastDue(m.targetDate, m.status),
  ).length;
  const health = normalizeHealth(project.health);
  const isDelayed = health === "DELAYED";

  const projectPrice = Number(project.projectPrice) || 0;
  const actualSpend = Number(project.actualCost) || 0;
  const totalTaskHoursLogged = tasks.reduce(
    (s, t) => s + (Number(t.loggedHours) || 0),
    0,
  );
  const generalTasks = tasks.filter((t) => !t.milestoneId);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "milestone") {
        await deleteMilestone.mutateAsync(pendingDelete.id);
        toast({ title: "Milestone removed", variant: "success" });
      } else if (pendingDelete.kind === "task") {
        await deleteTask.mutateAsync(pendingDelete.id);
        toast({ title: "Task removed", variant: "success" });
      } else {
        await removeMember.mutateAsync({
          projectId,
          employeeId: pendingDelete.id,
        });
        toast({ title: "Team member removed", variant: "success" });
      }
      setPendingDelete(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  async function handleTimer(task: ProjectTask) {
    try {
      if (activeTimer?.taskId === task.id) {
        await stopTimer.mutateAsync({ taskId: task.id });
        toast({
          title: `Timer stopped for ${task.taskCode}`,
          variant: "success",
        });
      } else {
        await startTimer.mutateAsync(task.id);
        toast({
          title: `Timer started for ${task.taskCode}`,
          variant: "success",
        });
      }
    } catch (err) {
      toast({
        title: "Timer action failed",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  async function handleStatusChange(task: ProjectTask, status: string) {
    try {
      await updateTask.mutateAsync({ taskId: task.id, input: { status } });
    } catch (err) {
      toast({
        title: "Could not update task status",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  const openNewTask = (milestoneId: number | null) =>
    setTaskModal({ open: true, edit: null, milestoneId });

  function renderTaskTable(groupTasks: ProjectTask[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-gray-200/80 text-[11px] font-extrabold uppercase text-gray-400 dark:border-gray-700">
            <tr>
              <th className="py-2.5 pr-3">Task ID / Description</th>
              <th className="px-3 py-2.5 text-center">Assigned To</th>
              <th className="px-3 py-2.5 text-center">Dates</th>
              <th className="px-3 py-2.5 text-center">Est / Logged</th>
              <th className="px-3 py-2.5 text-center">Priority</th>
              <th className="px-3 py-2.5 text-center">Status &amp; %</th>
              {SHOW_STOPWATCH_COLUMN ? (
                <th className="px-3 py-2.5 text-center">Stopwatch</th>
              ) : null}
              <th className="py-2.5 pl-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {groupTasks.map((t) => {
              const dep = dependencyLabel(t);
              const running = activeTimer?.taskId === t.id;
              const overdue = isPastDue(t.endDate, t.status);
              return (
                <tr
                  key={t.id}
                  className="hover:bg-white dark:hover:bg-gray-900/60"
                >
                  <td className="py-3 pr-3">
                    <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                      {t.taskCode}
                    </span>
                    <p className="mt-1 font-bold text-gray-800 dark:text-gray-100">
                      {t.title}
                    </p>
                    {t.description ? (
                      <p className="line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {t.description}
                      </p>
                    ) : null}
                    {dep ? (
                      <div className="space-y-0.5 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            DEPENDENCY_BADGE[dep.kind] ?? DEPENDENCY_BADGE.task
                          }`}
                        >
                          Depends on: {dep.label}
                        </span>
                        {t.dependencyRequirement ? (
                          <p className="line-clamp-1 text-[10px] italic text-gray-500">
                            Req: {t.dependencyRequirement}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                    {t.assignedTo?.fullName ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {formatDate(t.startDate)} → {formatDate(t.endDate)}
                    {overdue ? (
                      <span className="mt-0.5 block font-bold text-rose-600 dark:text-rose-400">
                        Overdue
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <span className="font-extrabold text-brand-700 dark:text-cyan-300">
                      {Number(t.hoursToComplete)}h
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {" "}
                      / {Number(t.loggedHours) || 0}h
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <Select
                        aria-label={`Status for ${t.taskCode}`}
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value)}
                        triggerClassName="h-8 text-xs"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="hold">On Hold</option>
                        <option value="completed">Completed</option>
                      </Select>
                      <span className="text-[10px] font-bold text-gray-500">
                        {t.completionPercent ?? 0}% • +{t.points} pts
                      </span>
                    </div>
                  </td>
                  {SHOW_STOPWATCH_COLUMN ? (
                    <td className="px-3 py-3 text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={running ? "destructive" : "outline"}
                        onClick={() => handleTimer(t)}
                        disabled={startTimer.isPending || stopTimer.isPending}
                      >
                        {running ? (
                          <>
                            <Square className="h-3 w-3 fill-current" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-current" /> Start
                          </>
                        )}
                      </Button>
                    </td>
                  ) : null}
                  <td className="py-3 pl-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLogsTask(t)}
                        title="View Start & Stop Time Logs"
                        aria-label={`Time logs for ${t.taskCode}`}
                        className="rounded-lg p-1.5 text-brand-600 transition-colors hover:bg-sky-50 dark:text-cyan-400 dark:hover:bg-sky-950/40"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTaskModal({
                            open: true,
                            edit: t,
                            milestoneId: null,
                          })
                        }
                        title="Edit Task"
                        aria-label={`Edit ${t.taskCode}`}
                        className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            kind: "task",
                            id: t.id,
                            name: `${t.taskCode} ${t.title}`,
                          })
                        }
                        title="Delete Task"
                        aria-label={`Delete ${t.taskCode}`}
                        className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header banner (legacy gradient hero, brand palette) */}
      <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-500/15 md:flex-row md:items-center sm:p-8">
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/projects/list"
              aria-label="Back to projects list"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="rounded-xl border border-white/20 bg-white/20 px-2.5 py-1 text-xs font-black text-cyan-50 backdrop-blur-md">
              {project.projectCode}
            </span>
            <StatusBadge status={project.status} />
            {isDelayed ? (
              <span className="rounded-md border border-rose-600 bg-rose-500 px-2 py-0.5 text-xs font-black text-white motion-safe:animate-pulse">
                Delayed Milestone
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {project.name}
          </h1>
          <p className="max-w-2xl text-xs text-cyan-50/90 sm:text-sm">
            {project.description ||
              "Enterprise project deliverable tracking with real-time milestones & tasks"}
          </p>
        </div>

        <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openNewTask(null)}
            className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-blue-800 shadow-md transition-colors hover:bg-cyan-50"
          >
            <Plus className="h-4 w-4" /> Add Task
          </button>
          <button
            type="button"
            onClick={() => setMilestoneModal({ open: true, edit: null })}
            className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-blue-900/40 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-900/60"
          >
            <Flag className="h-4 w-4 text-cyan-200" /> Add Milestone
          </button>
          <Link
            href={`/projects/mom/create?projectId=${project.id}`}
            className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-blue-900/40 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-900/60"
          >
            <ClipboardList className="h-4 w-4 text-cyan-200" /> New MoM
          </Link>
          <Link
            href={`/projects/edit/${project.id}`}
            className="flex items-center gap-1 rounded-2xl bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-white/25"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>

      {/* 2. Overall milestone delivery progress */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Flag className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Overall Milestone Delivery Progress
            </p>
            <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">
              {completedMilestones} of {totalMilestones} Milestones Completed
              <span className="ml-2 text-xs font-semibold text-gray-400">
                • Task delivery {project.progressPercent ?? 0}%
              </span>
            </p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-brand-700 dark:text-cyan-300">
              {milestoneProgress}%
            </span>
            <span className="text-xs font-bold text-gray-400">completed</span>
          </div>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-gray-200/60 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 transition-all duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${milestoneProgress}%` }}
          />
        </div>
      </div>

      {/* 3. Project information + financials */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <div className="border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Project Information
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-6 text-xs sm:grid-cols-2">
            <InfoBlock label="Customer / Client">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {project.customerName || project.customer?.name || "—"}
              </p>
              {project.customerId ? (
                <span className="text-[11px] text-gray-400">
                  ID: {project.customerId}
                </span>
              ) : null}
            </InfoBlock>

            <InfoBlock label="Departments">
              <div className="flex flex-wrap gap-1.5">
                {(project.departments ?? []).length > 0 ? (
                  project.departments?.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="italic text-gray-400">General</span>
                )}
              </div>
            </InfoBlock>

            <InfoBlock label="Client Handling Person">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  {(project.clientHandlingPerson?.fullName ?? "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-100">
                  {project.clientHandlingPerson?.fullName ?? "Not Assigned"}
                </span>
              </div>
            </InfoBlock>

            <InfoBlock label="Assigned Resources / Team">
              <div className="flex flex-wrap gap-1.5">
                {(project.resourceNames ?? []).length > 0 ? (
                  project.resourceNames?.map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="italic text-gray-400">
                    No resource members specified
                  </span>
                )}
              </div>
            </InfoBlock>

            <InfoBlock label="Timeline Schedule">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-100">
                <Calendar className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
                {formatDate(project.startDate)} →{" "}
                {project.plannedEndDate
                  ? formatDate(project.plannedEndDate)
                  : "TBD"}
              </p>
            </InfoBlock>

            <InfoBlock label="Actual Completion Date">
              {project.actualEndDate ? (
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatDate(project.actualEndDate)}
                </span>
              ) : (
                <span className="italic text-gray-400">
                  In progress / Pending
                </span>
              )}
            </InfoBlock>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Financial &amp; Hours
            </h2>
          </div>
          <div className="flex flex-col gap-4 p-6 text-xs">
            <div className="flex flex-col gap-1">
              <Row label="Project Contract Price">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {formatCurrency(projectPrice)}
                </span>
              </Row>
              <Row label="Actual Spend (Expenses)">
                <span
                  className={`font-black ${
                    actualSpend > projectPrice && projectPrice > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {formatCurrency(actualSpend)}
                </span>
              </Row>
              {SHOW_EARNED_REVENUE_ROW ? (
                <Row label="Earned Revenue">
                  <span className="font-black text-brand-700 dark:text-cyan-300">
                    {formatCurrency(project.earnedAmount ?? 0)}
                  </span>
                </Row>
              ) : null}
              <Row label="Budget Variance">
                <span
                  className={`font-black ${
                    (project.budgetVariance ?? 0) >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatCurrency(project.budgetVariance ?? 0)}
                </span>
              </Row>
            </div>

            <div className="flex flex-col gap-1 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Row label="Expected Hours">
                <span className="text-sm font-black text-brand-700 dark:text-cyan-300">
                  {Number(project.expectedHours) || 0}h
                </span>
              </Row>
              <Row label="Total Task Hours Logged">
                <span className="font-black text-gray-800 dark:text-gray-100">
                  {totalTaskHoursLogged}h
                </span>
              </Row>
              <Row label="Team Hours Logged">
                <span className="font-black text-gray-800 dark:text-gray-100">
                  {project.totalLoggedHours ?? 0}h
                </span>
              </Row>
            </div>

            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              {isDelayed ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Project delayed: {delayedMilestones} milestone(s) past
                    target date
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {health === "COMPLETED"
                      ? "Project deliverables are complete"
                      : "Project deliverables are on track"}
                  </span>
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <HealthBadge health={project.health} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Milestones & nested deliverables */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
              <Flag className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Milestones &amp; Nested Deliverables
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Expand any milestone row to inspect and manage assigned child
              tasks
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setMilestoneModal({ open: true, edit: null })}
          >
            <Plus className="h-3.5 w-3.5" /> Add Milestone
          </Button>
        </div>

        {milestones.length === 0 && generalTasks.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title="No milestones configured yet"
              description="Break this project into sequenced milestones to track progress."
              action={
                <Button
                  size="sm"
                  onClick={() => setMilestoneModal({ open: true, edit: null })}
                >
                  <Plus className="h-4 w-4" /> Create First Milestone
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {milestones.map((m) => {
              const expanded = !collapsed.has(m.id);
              const milestoneTasks = tasks.filter(
                (t) => t.milestoneId === m.id,
              );
              const overdue = isPastDue(m.targetDate, m.status);
              return (
                <div
                  key={m.id}
                  className="transition-colors hover:bg-gray-50/40 dark:hover:bg-gray-800/20"
                >
                  <div className="flex flex-col justify-between gap-4 p-4 sm:p-5 md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleGroup(m.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${m.title}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-sky-100 hover:text-sky-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-sky-950"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                            {m.title}
                          </span>
                          <StatusBadge status={m.status} />
                          {overdue ? (
                            <span className="rounded-md border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-400">
                          <span>Target: {formatDate(m.targetDate)}</span>
                          {m.actualDate ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Actual: {formatDate(m.actualDate)}
                            </span>
                          ) : null}
                          <span>
                            • {milestoneTasks.length} task
                            {milestoneTasks.length !== 1 ? "s" : ""}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNewTask(m.id)}
                      >
                        <Plus className="h-3 w-3" /> Add Task
                      </Button>
                      <button
                        type="button"
                        onClick={() =>
                          setMilestoneModal({ open: true, edit: m })
                        }
                        aria-label={`Edit ${m.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            kind: "milestone",
                            id: m.id,
                            name: m.title,
                          })
                        }
                        aria-label={`Delete ${m.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/20 sm:px-8">
                      {milestoneTasks.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400">
                          <p>No tasks under this milestone yet.</p>
                          <button
                            type="button"
                            onClick={() => openNewTask(m.id)}
                            className="mt-1 text-xs font-bold text-brand-600 hover:underline dark:text-cyan-400"
                          >
                            + Click to add task
                          </button>
                        </div>
                      ) : (
                        renderTaskTable(milestoneTasks)
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Tasks with no milestone (legacy "General / No Milestone"). */}
            {generalTasks.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => toggleGroup("general")}
                    aria-expanded={!collapsed.has("general")}
                    aria-label="Toggle general tasks"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-sky-100 hover:text-sky-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-sky-950"
                  >
                    {collapsed.has("general") ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <div>
                    <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                      General Deliverables (No Milestone)
                    </span>
                    <p className="text-[11px] font-semibold text-gray-400">
                      {generalTasks.length} task
                      {generalTasks.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {!collapsed.has("general") ? (
                  <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/20 sm:px-8">
                    {renderTaskTable(generalTasks)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 5. Team members (new-module feature; hidden — not in legacy ProjectDetail) */}
      {SHOW_TEAM_MEMBERS_SECTION ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                <Users2 className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                Assigned Project Members
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {project.members?.length ?? 0}
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Engineers, architects and managers allocating capacity to this
                project.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowMemberModal(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Member
            </Button>
          </div>
          {(project.members?.length ?? 0) === 0 ? (
            <div className="py-10">
              <EmptyState
                title="No team members yet"
                description="Add employees to allocate capacity and track their logged hours."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 text-[11px] font-extrabold uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-5 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Est. Hours</th>
                    <th className="px-3 py-2.5 text-right">Logged</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {project.members.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {m.employee.fullName}
                        </span>{" "}
                        <span className="text-gray-400">
                          ({m.employee.employeeCode})
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-300">
                        {m.role}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">
                        ₹{Number(m.hourlyRate)}/hr
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">
                        {Number(m.estimatedHours)}h
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-gray-800 dark:text-gray-100">
                        {Number(m.loggedHours)}h
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: "member",
                              id: m.employeeId,
                              name: m.employee.fullName,
                            })
                          }
                          aria-label={`Remove ${m.employee.fullName}`}
                          className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* 6. Project expenses (new-module feature; hidden — not in legacy ProjectDetail) */}
      {SHOW_EXPENSES_SECTION ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                <Receipt className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                Project Incurred Expenses
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Automatically rolled up into actual cost for budget variance
                tracking. Total:{" "}
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(actualSpend)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/projects/expenses"
                className="text-xs font-bold text-brand-600 hover:underline dark:text-cyan-400"
              >
                All expenses
              </Link>
              <Button size="sm" onClick={() => setShowExpenseModal(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Expense
              </Button>
            </div>
          </div>
          {(project.expenses?.length ?? 0) === 0 ? (
            <div className="py-10">
              <EmptyState
                title="No expenses recorded"
                description="Record vendor invoices and other spend against this project."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 text-[11px] font-extrabold uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Vendor</th>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-3 py-2.5">Department</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {project.expenses?.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-gray-600 dark:text-gray-400">
                        {formatDate(e.expenseDate)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-100">
                        {e.vendor || "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {e.referenceNo || "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {e.department || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            e.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : e.status === "cancelled"
                                ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* 7. Meeting history (MoM) */}
      <ProjectMomHistory projectId={project.id} />

      {/* Modals */}
      <MilestoneModal
        open={milestoneModal.open}
        onClose={() => setMilestoneModal({ open: false, edit: null })}
        projectId={project.id}
        milestoneToEdit={milestoneModal.edit}
        currentMilestoneCount={milestones.length}
      />
      <TaskModal
        open={taskModal.open}
        onClose={() =>
          setTaskModal({ open: false, edit: null, milestoneId: null })
        }
        project={project}
        initialMilestoneId={taskModal.milestoneId}
        taskToEdit={taskModal.edit}
      />
      <TaskTimeLogsModal
        open={logsTask !== null}
        onClose={() => setLogsTask(null)}
        task={logsTask}
        projectLabel={`${project.name} (${project.projectCode})`}
      />
      <AddMemberDialog
        open={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        project={project}
      />
      <AddExpenseDialog
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        project={project}
      />
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={
          pendingDelete?.kind === "milestone"
            ? "Delete milestone"
            : pendingDelete?.kind === "task"
              ? "Delete task"
              : "Remove team member"
        }
        itemName={pendingDelete?.name ?? ""}
        description={
          pendingDelete?.kind === "milestone"
            ? "Tasks under this milestone will be unlinked."
            : undefined
        }
        loading={
          deleteMilestone.isPending ||
          deleteTask.isPending ||
          removeMember.isPending
        }
      />
    </div>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-bold text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function AddMemberDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="md" title="Add Team Member">
      {open ? <AddMemberForm onClose={onClose} project={project} /> : null}
    </Dialog>
  );
}

function AddMemberForm({
  onClose,
  project,
}: {
  onClose: () => void;
  project: Project;
}) {
  const { toast } = useToast();
  const addMember = useAddProjectMember();
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("Contributor");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [estimatedHours, setEstimatedHours] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const existing = new Set((project.members ?? []).map((m) => m.employeeId));
  const options = (employeesQuery.data?.data ?? []).filter(
    (e) => !existing.has(e.id),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!employeeId) {
      setFormError("Please select an employee.");
      return;
    }
    try {
      await addMember.mutateAsync({
        projectId: project.id,
        input: {
          employeeId: Number(employeeId),
          role: role.trim() || "Contributor",
          hourlyRate: Number(hourlyRate) || 0,
          estimatedHours: Number(estimatedHours) || 0,
        },
      });
      toast({ title: "Team member added", variant: "success" });
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to add team member"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {formError}
        </p>
      ) : null}
      <FormField label="Employee" required>
        {(field) => (
          <Select
            {...field}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">
              {employeesQuery.isPending
                ? "Loading employees..."
                : "Select employee"}
            </option>
            {options.map((emp) => (
              <option key={emp.id} value={String(emp.id)}>
                {emp.fullName} ({emp.employeeCode}) — {emp.team.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Role">
        {(field) => (
          <Input
            {...field}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Hourly Rate (₹)">
          {(field) => (
            <Input
              {...field}
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Estimated Hours">
          {(field) => (
            <Input
              {...field}
              type="number"
              min="0"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={addMember.isPending}>
          Add to Team
        </Button>
      </div>
    </form>
  );
}

function AddExpenseDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Record Project Expense"
    >
      {open ? <AddExpenseForm onClose={onClose} project={project} /> : null}
    </Dialog>
  );
}

function AddExpenseForm({
  onClose,
  project,
}: {
  onClose: () => void;
  project: Project;
}) {
  const { toast } = useToast();
  const createExpense = useCreateExpense();
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayInput());
  const [vendor, setVendor] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [department, setDepartment] = useState(project.departments?.[0] ?? "");
  const [status, setStatus] = useState("unpaid");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!(Number(amount) > 0)) {
      setFormError("Amount must be greater than ₹0.");
      return;
    }
    try {
      await createExpense.mutateAsync({
        projectId: project.id,
        input: {
          amount: Number(amount),
          expenseDate,
          status,
          ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
          ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
          ...(department ? { department } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      toast({ title: "Expense recorded", variant: "success" });
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to record expense"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {formError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount (₹)" required>
          {(field) => (
            <Input
              {...field}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Expense Date" required>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Vendor">
          {(field) => (
            <Input
              {...field}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. AWS"
            />
          )}
        </FormField>
        <FormField label="Reference No">
          {(field) => (
            <Input
              {...field}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. INV-1002"
            />
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Department">
          {(field) => (
            <Select
              {...field}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">General</option>
              {(project.departments ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Payment Status">
          {(field) => (
            <Select
              {...field}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          )}
        </FormField>
      </div>
      <FormField label="Notes">
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={createExpense.isPending}>
          Record Expense
        </Button>
      </div>
    </form>
  );
}
