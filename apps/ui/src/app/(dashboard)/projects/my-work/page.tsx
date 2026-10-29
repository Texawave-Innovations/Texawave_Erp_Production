"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  Flag,
  FolderKanban,
  History,
  ListTodo,
  Play,
  Square,
  Star,
  Timer,
  UserCheck,
  UserX,
  Users2,
} from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useActiveTimer,
  useCreateManualTimeEntry,
  useEmployeeWork,
  useMyAttendanceStatus,
  useMyTimeSummary,
  useMyWork,
  useResourceTracking,
  useStartTimer,
  useStopTimer,
  useUpdateTask,
} from "@/features/projects/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";
import { TaskTimeLogsModal } from "@/features/projects/components/TaskTimeLogsModal";
import { EmployeeTaskUpdateModal } from "@/features/projects/components/EmployeeTaskUpdateModal";
import { PageBanner } from "@/features/projects/components/PageBanner";
import {
  errorMessage,
  formatDate,
  isPastDue,
  todayInput,
} from "@/features/projects/format";
import type { ProjectTask } from "@/features/projects/types";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

const DEPENDENCY_TONE: Record<string, string> = {
  client:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  employee:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  task: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
};

/** Legacy employee switcher: managers holding `projects.work.review` pick a
 * team member (from the resource roster) to see their work read-only. */
function EmployeeSwitcher({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data } = useResourceTracking();
  const people = [...(data?.resources ?? [])].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );
  return (
    <div className="flex items-center gap-2">
      <Users2 className="h-4 w-4 text-gray-400" />
      <Select
        aria-label="View work of"
        value={value ? String(value) : ""}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : null)
        }
        className="w-64"
      >
        <option value="">My own work</option>
        {people.map((r) => (
          <option key={r.employeeId} value={r.employeeId}>
            {r.employeeName} ({r.employeeCode})
            {r.department ? ` — ${r.department}` : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

function minutesLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function MyWorkPage() {
  const { toast } = useToast();
  const canReview = usePermission("projects.work.review");
  const [viewEmployeeId, setViewEmployeeId] = useState<number | null>(null);
  const viewingOther = viewEmployeeId !== null;

  const myWork = useMyWork();
  const myTimer = useActiveTimer();
  const mySummary = useMyTimeSummary();
  const attendanceQuery = useMyAttendanceStatus(!viewingOther);
  const otherWork = useEmployeeWork(viewEmployeeId);

  const tasks = viewingOther ? otherWork.data?.tasks : myWork.data;
  const isLoading = viewingOther ? otherWork.isLoading : myWork.isLoading;
  const isError = viewingOther ? otherWork.isError : myWork.isError;
  const refetch = viewingOther ? otherWork.refetch : myWork.refetch;
  const activeTimer = viewingOther
    ? (otherWork.data?.activeTimer ?? null)
    : myTimer.data;
  const timeSummary = viewingOther
    ? otherWork.data?.timeSummary
    : mySummary.data;
  // Legacy gate: the stopwatch only starts while checked in. If the status
  // can't be read (e.g. no employee profile) the API still enforces it.
  const attendance = attendanceQuery.data;
  const checkedIn = attendance?.checkedIn ?? true;
  const readOnly = viewingOther;
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const updateTaskMutation = useUpdateTask();
  const manualEntryMutation = useCreateManualTimeEntry();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Manual Time Entry Dialog
  const [logModalTask, setLogModalTask] = useState<ProjectTask | null>(null);
  const [manualHours, setManualHours] = useState<number>(1);
  const [manualDate, setManualDate] = useState(todayInput());
  const [manualNotes, setManualNotes] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Legacy Edit (EmployeeTaskUpdateModal) & Logs (TaskTimeLogsModal) actions
  const [taskToUpdate, setTaskToUpdate] = useState<ProjectTask | null>(null);
  const [taskForLogs, setTaskForLogs] = useState<ProjectTask | null>(null);

  // Confetti Celebration Modal (legacy CompletionCelebration)
  const [celebrationTask, setCelebrationTask] = useState<ProjectTask | null>(
    null,
  );

  // Live stopwatch tick for the running task (legacy TaskTimer).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  // "Logged Today": closed entries for today plus the running timer's
  // elapsed time if it started today.
  const loggedTodayMinutes = useMemo(() => {
    const closed = timeSummary?.loggedTodayMinutes ?? 0;
    if (!activeTimer || !timeSummary) return closed;
    const started = new Date(activeTimer.startedAt);
    const startedDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(started);
    if (startedDay !== timeSummary.date) return closed;
    return closed + Math.max(0, Math.floor((now - started.getTime()) / 60000));
  }, [timeSummary, activeTimer, now]);

  const stats = useMemo(() => {
    const list = tasks ?? [];
    const completed = list.filter((t) => t.status === "completed");
    const inProgress = list.filter((t) => t.status === "in_progress");
    const earnedPoints = completed.reduce((acc, t) => acc + (t.points || 0), 0);
    const loggedHours = list.reduce(
      (acc, t) => acc + (Number(t.loggedHours) || 0),
      0,
    );
    const estimatedHours = list.reduce(
      (acc, t) => acc + (Number(t.hoursToComplete) || 0),
      0,
    );
    return {
      assigned: list.length,
      completed: completed.length,
      inProgress: inProgress.length,
      earnedPoints,
      loggedHours,
      estimatedHours,
    };
  }, [tasks]);

  // Legacy `MyWork.tsx` "Contributing Milestones Rollup" — the distinct set
  // of milestones the employee's assigned tasks feed into.
  const contributingMilestones = useMemo(() => {
    const list = tasks ?? [];
    const map = new Map<
      number,
      {
        id: number;
        title: string;
        targetDate: string;
        status: string;
        projectCode?: string | undefined;
      }
    >();
    for (const t of list) {
      if (t.milestone && !map.has(t.milestone.id)) {
        map.set(t.milestone.id, {
          id: t.milestone.id,
          title: t.milestone.title,
          targetDate: t.milestone.targetDate,
          status: t.milestone.status,
          projectCode: t.project?.projectCode,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.targetDate.localeCompare(b.targetDate),
    );
  }, [tasks]);

  // Legacy "Currently Active On" banner — projects with an in-progress task
  // or the running stopwatch.
  const activelyWorkingProjects = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string }>();
    for (const t of tasks ?? []) {
      if (t.status === "in_progress" || activeTimer?.taskId === t.id) {
        map.set(t.projectId, {
          id: t.projectId,
          name: t.project?.name ?? "Project",
          code: t.project?.projectCode ?? `#${t.projectId}`,
        });
      }
    }
    return Array.from(map.values());
  }, [tasks, activeTimer]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const matchSearch =
        (t.description || "").toLowerCase().includes(q) ||
        (t.title || "").toLowerCase().includes(q) ||
        (t.taskCode || "").toLowerCase().includes(q) ||
        (t.project?.name || "").toLowerCase().includes(q) ||
        (t.project?.projectCode || "").toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          (t.status === "in_progress" || t.status === "not_started")) ||
        t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [tasks, search, statusFilter]);

  function celebrate(task: ProjectTask) {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
    setCelebrationTask(task);
  }

  const handleStartTimer = async (taskId: number) => {
    try {
      await startTimerMutation.mutateAsync(taskId);
      toast({ title: "Stopwatch started", variant: "success" });
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to start stopwatch"),
        variant: "error",
      });
    }
  };

  const handleStopTimer = async (taskId: number) => {
    try {
      const stopped = await stopTimerMutation.mutateAsync({ taskId });
      toast({
        title: `Stopwatch stopped — ${stopped.durationMinutes} min logged`,
        variant: "success",
      });
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to stop stopwatch"),
        variant: "error",
      });
    }
  };

  const handleStatusChange = async (task: ProjectTask, newStatus: string) => {
    try {
      const willComplete =
        newStatus === "completed" && task.status !== "completed";
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        input: {
          status: newStatus,
          completionPercent:
            newStatus === "completed" ? 100 : task.completionPercent,
        },
      });

      if (willComplete) celebrate(task);
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to update task status"),
        variant: "error",
      });
    }
  };

  // Legacy TaskTimer "Finish": stop the running stopwatch, then complete.
  const handleFinish = async (task: ProjectTask) => {
    try {
      if (activeTimer?.taskId === task.id) {
        await stopTimerMutation.mutateAsync({ taskId: task.id });
      }
      await handleStatusChange(task, "completed");
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to finish task"),
        variant: "error",
      });
    }
  };

  const handleManualLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logModalTask) return;
    setManualError(null);
    const minutes = Math.round(Number(manualHours) * 60);
    if (!minutes || minutes < 1) {
      setManualError("Hours spent must be greater than zero.");
      return;
    }

    try {
      await manualEntryMutation.mutateAsync({
        taskId: logModalTask.id,
        input: {
          entryDate: manualDate,
          durationMinutes: minutes,
          ...(manualNotes.trim() ? { notes: manualNotes.trim() } : {}),
        },
      });
      toast({ title: "Time entry logged", variant: "success" });
      setLogModalTask(null);
      setManualHours(1);
      setManualNotes("");
    } catch (err: unknown) {
      setManualError(errorMessage(err, "Failed to log time"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header — legacy "My Work • Employee Workspace" */}
      <PageBanner
        icon={Briefcase}
        title={
          viewingOther && otherWork.data
            ? `${otherWork.data.employee.fullName}'s Work`
            : "My Work • Employee Workspace"
        }
        description="Live task execution timers, milestone deliverables & individual accomplishment points."
        actions={
          <>
            {canReview ? (
              <EmployeeSwitcher
                value={viewEmployeeId}
                onChange={setViewEmployeeId}
              />
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              <ListTodo className="h-3.5 w-3.5" />
              {tasks?.length || 0} Total Assigned
            </span>
          </>
        }
      />

      {viewingOther && otherWork.data ? (
        <Alert variant="info" title="Read-only view">
          Viewing {otherWork.data.employee.fullName} (
          {otherWork.data.employee.employeeCode}
          {otherWork.data.employee.department
            ? `, ${otherWork.data.employee.department}`
            : ""}
          ). Timers and task updates can only be changed by the employee.
        </Alert>
      ) : null}
      {viewingOther && otherWork.isError ? (
        <ErrorState
          title="Could not load this employee's work"
          onRetry={() => void otherWork.refetch()}
        />
      ) : null}

      {!viewingOther && attendance ? (
        attendance.checkedIn ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <UserCheck className="h-4 w-4" />
            Checked in — stopwatch timers are available. A running timer is
            paused automatically when you check out.
          </div>
        ) : (
          <Alert
            variant="warning"
            title={
              attendance.hasRecordToday
                ? "You are checked out"
                : "Not checked in today"
            }
          >
            <span className="inline-flex flex-wrap items-center gap-1">
              <UserX className="h-4 w-4" />
              Timers can only be started while you are checked in.
              <Link
                href="/self-service/attendance"
                className="font-semibold underline"
              >
                Go to Attendance
              </Link>
            </span>
          </Alert>
        )
      ) : null}

      {/* Stat Cards — legacy `MyWork.tsx` top metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headingId="mywork-assigned"
          label="Assigned Tasks"
          value={stats.assigned}
          note={`${stats.inProgress} in progress, ${stats.completed} done`}
          tone="blue"
          icon={CheckSquare}
        />
        <StatCard
          headingId="mywork-today"
          label="Logged Today"
          value={minutesLabel(loggedTodayMinutes)}
          note={`${loggedTodayMinutes} min today · ${minutesLabel(timeSummary?.loggedThisWeekMinutes ?? 0)} this week`}
          tone="info"
          icon={Timer}
        />
        <StatCard
          headingId="mywork-milestones"
          label="Contributing Milestones"
          value={contributingMilestones.length}
          note="Active milestone goals"
          tone="brand"
          icon={Flag}
        />
        <StatCard
          headingId="mywork-points"
          label="Earned Points"
          value={`${stats.earnedPoints} pts`}
          note="From completed tasks"
          tone="amber"
          icon={Award}
        />
      </div>

      {/* Currently Active On — legacy banner */}
      {activelyWorkingProjects.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 p-2.5 text-white">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-brand-800 dark:text-cyan-300">
                Currently Active On
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {activelyWorkingProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-bold text-gray-900 hover:border-brand-400 dark:border-cyan-900/50 dark:bg-gray-900 dark:text-white"
                  >
                    {p.name} ({p.code})
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {activeTimer ? (
            <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
              Live Timer Running •{" "}
              {formatElapsed(now - new Date(activeTimer.startedAt).getTime())}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Contributing Milestones Rollup — legacy `MyWork.tsx` */}
      {contributingMilestones.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Flag className="h-4 w-4 text-sky-500" />
            Contributing Milestone Rollup
          </h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            High-level goals where you have assigned tasks.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contributingMilestones.map((m) => {
              const overdue = isPastDue(m.targetDate, m.status);
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <span className="text-[10px] font-black uppercase text-brand-700 dark:text-cyan-400">
                    Milestone{m.projectCode ? ` • ${m.projectCode}` : ""}
                  </span>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {m.title}
                  </p>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <span className={overdue ? "font-bold text-rose-600" : ""}>
                      Due {formatDate(m.targetDate)}
                      {overdue ? " • Overdue" : ""}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="min-w-[260px] flex-1">
          <SearchInput
            value={search}
            onChangeValue={setSearch}
            onClear={() => setSearch("")}
            clearable
            sizeVariant="sm"
            placeholder="Search tasks, task codes, projects..."
            aria-label="Search my tasks"
          />
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: "all", label: "All Tasks" },
            { id: "active", label: "Active" },
            { id: "in_progress", label: "In Progress" },
            { id: "hold", label: "On Hold" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-sm dark:bg-cyan-600"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load your assigned work"
          onRetry={() => refetch()}
        />
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No tasks found"
            description={
              search || statusFilter !== "all"
                ? "Try adjusting your filters or search term."
                : "You currently have no tasks assigned in active projects."
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.map((task) => {
            const isRunning = activeTimer?.taskId === task.id;
            const otherRunning = Boolean(activeTimer) && !isRunning;
            const overdue = isPastDue(task.endDate, task.status);
            const depKind = (task.dependencyType ?? "").toLowerCase();
            const depLabel =
              task.dependencyTargetName ||
              (task.dependencyTaskId ? `Task #${task.dependencyTaskId}` : "");

            return (
              <div
                key={task.id}
                className={`group flex flex-col gap-3 rounded-2xl border bg-white p-4.5 shadow-sm transition-all hover:shadow-md dark:bg-gray-900 ${
                  isRunning
                    ? "border-cyan-400 bg-cyan-50/20 dark:border-cyan-600/60 dark:bg-cyan-950/20"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 dark:text-cyan-400">
                      {task.taskCode}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-cyan-300"
                    >
                      <FolderKanban className="h-3 w-3" />
                      {task.project?.projectCode || `#${task.projectId}`} —{" "}
                      {task.project?.name || "Project"}
                    </Link>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <PriorityBadge priority={task.priority} />
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <Award className="h-3 w-3" />+{task.points} pts
                    </span>
                    {task.milestone ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        <Flag className="h-3 w-3" />
                        {task.milestone.title}
                      </span>
                    ) : (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        General Deliverable
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Status for ${task.taskCode}`}
                      value={task.status}
                      disabled={readOnly}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>

                    {isRunning ? (
                      <>
                        <span className="rounded-lg bg-cyan-100 px-2.5 py-1 text-xs font-extrabold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                          {formatElapsed(
                            now - new Date(activeTimer.startedAt).getTime(),
                          )}
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStopTimer(task.id)}
                          loading={stopTimerMutation.isPending}
                          disabled={readOnly}
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          Stop Timer
                        </Button>
                      </>
                    ) : task.status !== "completed" && !readOnly ? (
                      <Button
                        size="sm"
                        onClick={() => handleStartTimer(task.id)}
                        disabled={
                          otherRunning ||
                          !checkedIn ||
                          startTimerMutation.isPending
                        }
                        title={
                          !checkedIn
                            ? "Check in on Attendance to start a timer"
                            : otherRunning
                              ? `Stop the running timer on ${activeTimer?.task?.taskCode ?? "another task"} first`
                              : "Start live stopwatch"
                        }
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Start Timer
                      </Button>
                    ) : null}

                    {task.status !== "completed" && !readOnly ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleFinish(task)}
                        title="Stop timer (if running) and mark completed"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finish
                      </Button>
                    ) : null}

                    {!readOnly ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTaskToUpdate(task)}
                        title="Update Status, Completion % & Dependency"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setTaskForLogs(task)}
                      title="View start & stop time records"
                    >
                      <History className="h-3.5 w-3.5" />
                      Logs
                    </Button>
                    {!readOnly ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setManualError(null);
                          setManualDate(todayInput());
                          setLogModalTask(task);
                        }}
                        title="Log manual time"
                        aria-label={`Log manual time for ${task.taskCode}`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      {task.description}
                    </p>
                  )}
                  {depKind && depKind !== "none" ? (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <span
                        className={`inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                          DEPENDENCY_TONE[depKind] ?? DEPENDENCY_TONE.task
                        }`}
                      >
                        Depends on ({depKind}): {depLabel || "—"}
                      </span>
                      {task.dependencyRequirement ? (
                        <p className="line-clamp-1 text-[10px] italic text-gray-500">
                          Req: {task.dependencyRequirement}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Footer bar: progress & hours */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      className={`flex items-center gap-1 ${overdue ? "font-bold text-rose-600" : ""}`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(task.startDate)} to {formatDate(task.endDate)}
                      {overdue ? " • Overdue" : ""}
                    </span>
                    <span>•</span>
                    <span className="font-semibold">
                      Logged:{" "}
                      <strong className="text-gray-900 dark:text-white">
                        {Number(task.loggedHours || 0).toFixed(1)}h
                      </strong>{" "}
                      / {Number(task.hoursToComplete || 0).toFixed(1)}h
                    </span>
                  </div>

                  <div className="flex min-w-[200px] items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300"
                        style={{ width: `${task.completionPercent || 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {task.completionPercent || 0}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Time Entry Modal */}
      <Dialog
        open={Boolean(logModalTask)}
        onClose={() => setLogModalTask(null)}
        size="md"
        title={logModalTask ? `Log Time: ${logModalTask.taskCode}` : "Log Time"}
      >
        {logModalTask ? (
          <form
            onSubmit={handleManualLogSubmit}
            className="flex flex-col gap-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {logModalTask.title}
            </p>
            {manualError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
              >
                {manualError}
              </p>
            ) : null}
            <FormField label="Hours Spent" required>
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min="0.25"
                  step="0.25"
                  required
                  value={manualHours}
                  onChange={(e) => setManualHours(Number(e.target.value))}
                />
              )}
            </FormField>
            <FormField label="Date" required>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Work Notes / Deliverables">
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Completed circuit analysis, verified pullup..."
                />
              )}
            </FormField>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLogModalTask(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={manualEntryMutation.isPending}>
                Save Time Entry
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <EmployeeTaskUpdateModal
        key={taskToUpdate?.id ?? "none"}
        open={Boolean(taskToUpdate)}
        onClose={() => setTaskToUpdate(null)}
        task={taskToUpdate}
        onFinished={celebrate}
      />

      <TaskTimeLogsModal
        open={Boolean(taskForLogs)}
        onClose={() => setTaskForLogs(null)}
        task={taskForLogs}
      />

      {/* Completion celebration — legacy CompletionCelebration */}
      <Dialog
        open={Boolean(celebrationTask)}
        onClose={() => setCelebrationTask(null)}
        size="sm"
        showHeader={false}
      >
        {celebrationTask ? (
          <div className="flex flex-col items-center text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
              <Star className="h-8 w-8 animate-bounce motion-reduce:animate-none" />
            </div>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
              Task Completed!
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {celebrationTask.taskCode} — {celebrationTask.title}
            </p>

            <div className="my-5 w-full rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/40">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Reward Awarded
              </span>
              <div className="mt-1 text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                +{celebrationTask.points} Points
              </div>
              <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                Added directly to your gamification ledger and company
                leaderboard.
              </p>
            </div>

            <Button className="w-full" onClick={() => setCelebrationTask(null)}>
              Keep Crushing It!
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
