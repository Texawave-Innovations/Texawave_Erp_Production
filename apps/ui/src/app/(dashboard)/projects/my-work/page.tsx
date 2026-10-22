"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Award,
  Calendar,
  Clock,
  FolderKanban,
  ListTodo,
  Loader2,
  Play,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  useActiveTimer,
  useMyWork,
  useStartTimer,
  useStopTimer,
  useUpdateTask,
} from "@/features/projects/hooks";
import { createManualTimeEntry } from "@/features/projects/api";
import { PriorityBadge } from "@/features/projects/components/HealthBadge";
import type { ProjectTask } from "@/features/projects/types";

export default function MyWorkPage() {
  const { data: tasks, isLoading, refetch } = useMyWork();
  const { data: activeTimer } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const updateTaskMutation = useUpdateTask();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Manual Time Entry Dialog
  const [logModalTask, setLogModalTask] = useState<ProjectTask | null>(null);
  const [manualHours, setManualHours] = useState<number>(1);
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [manualNotes, setManualNotes] = useState("");
  const [isLoggingTime, setIsLoggingTime] = useState(false);

  // Confetti Celebration Modal
  const [celebrationTask, setCelebrationTask] = useState<ProjectTask | null>(
    null,
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      const matchSearch =
        (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.taskCode || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.project?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.project?.projectCode || "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          (t.status === "in_progress" || t.status === "not_started")) ||
        t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [tasks, search, statusFilter]);

  const handleStartTimer = async (taskId: number) => {
    try {
      await startTimerMutation.mutateAsync(taskId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start stopwatch");
    }
  };

  const handleStopTimer = async (taskId: number) => {
    try {
      await stopTimerMutation.mutateAsync({ taskId });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to stop stopwatch");
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

      if (willComplete) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
        setCelebrationTask(task);
      }
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to update task status",
      );
    }
  };

  const handleManualLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logModalTask) return;

    try {
      setIsLoggingTime(true);
      await createManualTimeEntry(logModalTask.id, {
        date: manualDate,
        durationMinutes: Math.round(Number(manualHours) * 60),
        notes: manualNotes || undefined,
      });
      setLogModalTask(null);
      setManualHours(1);
      setManualNotes("");
      refetch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to log time");
    } finally {
      setIsLoggingTime(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Work & Active Assignments
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Track individual work packages, start your live stopwatch, and
            record completed milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-cyan-300">
            <ListTodo className="h-3.5 w-3.5" />
            {tasks?.length || 0} Total Assigned
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, task codes, projects..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-4 text-xs text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: "all", label: "All Tasks" },
            { id: "active", label: "Active" },
            { id: "in_progress", label: "In Progress" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
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
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <ListTodo className="h-10 w-10 text-gray-400" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No tasks found
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters or search term."
                : "You currently have no tasks assigned in active projects."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.map((task) => {
            const isRunning = activeTimer?.taskId === task.id;

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
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-cyan-400">
                      {task.taskCode}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-cyan-300"
                    >
                      <FolderKanban className="h-3 w-3" />
                      {task.project?.projectCode ||
                        `PRJ-${task.projectId}`} —{" "}
                      {task.project?.name || "Project"}
                    </Link>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <PriorityBadge priority={task.priority} />
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <Award className="h-3 w-3" />+{task.points} pts
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>

                    {isRunning ? (
                      <button
                        onClick={() => handleStopTimer(task.id)}
                        disabled={stopTimerMutation.isPending}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" />
                        Stop Timer
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartTimer(task.id)}
                        disabled={startTimerMutation.isPending}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Start Timer
                      </button>
                    )}

                    <button
                      onClick={() => setLogModalTask(task)}
                      className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                      title="Log manual time"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
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
                </div>

                {/* Footer bar: progress & hours */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {task.startDate?.slice(0, 10)} to{" "}
                      {task.endDate?.slice(0, 10)}
                    </span>
                    <span>•</span>
                    <span className="font-mono">
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
                    <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
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
      {logModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Log Time: {logModalTask.taskCode}
                </h3>
              </div>
              <button
                onClick={() => setLogModalTask(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {logModalTask.title}
            </p>

            <form
              onSubmit={handleManualLogSubmit}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Hours Spent <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  required
                  value={manualHours}
                  onChange={(e) => setManualHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Work Notes / Deliverables
                </label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Completed circuit analysis, verified pullup..."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLogModalTask(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingTime}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                >
                  {isLoggingTime ? "Logging..." : "Save Time Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confetti Celebration Modal */}
      {celebrationTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-cyan-300 bg-gradient-to-b from-white to-cyan-50/30 p-6 text-center shadow-2xl dark:border-cyan-700 dark:from-gray-900 dark:to-gray-950">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
              <Sparkles className="h-8 w-8 animate-bounce" />
            </div>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
              Task Completed!
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {celebrationTask.taskCode} — {celebrationTask.title}
            </p>

            <div className="my-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/40">
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

            <button
              onClick={() => setCelebrationTask(null)}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-95"
            >
              Keep Crushing It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
