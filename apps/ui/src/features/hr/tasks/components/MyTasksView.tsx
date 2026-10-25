"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock,
  LoaderCircle,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMe, usePermission } from "@/hooks/usePermission";
import type { MyTaskStatus } from "../api";
import { useCreateMyTask, useMyTasks, useSetMyTaskStatus } from "../hooks";
import {
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
  SELF_SERVICE_UPDATE_STATUS,
} from "../permissions";
import {
  TASK_PRIORITIES,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from "../types";

// Legacy employee/MyTasks.tsx priorityConfig / statusConfig.
const PRIORITY: Record<
  TaskPriority,
  { label: string; cls: string; bar: string }
> = {
  LOW: {
    label: "Low",
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    bar: "bg-gray-300",
  },
  MEDIUM: {
    label: "Medium",
    cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    bar: "bg-blue-400",
  },
  HIGH: {
    label: "High",
    cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
    bar: "bg-orange-400",
  },
  URGENT: {
    label: "Urgent",
    cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    bar: "bg-red-500",
  },
};

const STATUS: Record<
  TaskStatus,
  { label: string; cls: string; icon: LucideIcon }
> = {
  PENDING: {
    label: "Pending",
    cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: LoaderCircle,
  },
  DONE: {
    label: "Done",
    cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: CircleCheck,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    icon: X,
  },
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

type Filter = "active" | "done" | "all" | "PENDING" | "IN_PROGRESS" | "DONE";

function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA").format(d);
}

function describeStatusError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to update this task.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This task can no longer move to that status — it may already be approved.";
    }
    if (error.statusCode === 404) {
      return "This task is no longer yours to update.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

const EMPTY_FORM = {
  title: "",
  description: "",
  priority: "MEDIUM" as TaskPriority,
  dueDate: "",
  requestToAdmin: false,
};

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const create = useCreateMyTask();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const today = isoIn(0);
  const ready = form.title.trim() !== "" && form.dueDate !== "";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!form.dueDate) {
      setError("Please set a due date");
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title.trim(),
        dueDate: form.dueDate,
        priority: form.priority,
        requestToAdmin: form.requestToAdmin,
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
      });
      toast({
        title: form.requestToAdmin
          ? "Task sent to Admin/HR for review"
          : "Task created successfully",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create task");
    }
  }

  return (
    <Card className="animate-reveal">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <ClipboardList className="h-4 w-4 text-brand-500" aria-hidden="true" />
        Create New Task
      </h2>
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          label="Task Title"
          required
          labelAction={
            <span className="text-[10px] tabular-nums text-gray-400">
              {form.title.length}/80
            </span>
          }
        >
          {(f) => (
            <Input
              {...f}
              maxLength={80}
              placeholder="Brief task title"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          )}
        </FormField>

        <div className="space-y-1.5">
          <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Priority
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Priority"
          >
            {TASK_PRIORITIES.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                role="radio"
                aria-checked={form.priority === p}
                variant={form.priority === p ? "primary" : "outline"}
                className="rounded-full text-xs font-semibold"
                onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
              >
                {PRIORITY[p].label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Today", days: 0 },
              { label: "Tomorrow", days: 1 },
              { label: "Next Week", days: 7 },
            ].map(({ label, days }) => {
              const iso = isoIn(days);
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={form.dueDate === iso ? "secondary" : "ghost"}
                  className="h-6 rounded-full px-2.5 text-[11px]"
                  onClick={() => setForm((p) => ({ ...p, dueDate: iso }))}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          <FormField label="Due Date" required>
            {(f) => (
              <Input
                {...f}
                type="date"
                min={today}
                value={form.dueDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dueDate: e.target.value }))
                }
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Description"
          labelAction={
            <span className="text-[10px] tabular-nums text-gray-400">
              {form.description.length}/500
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              maxLength={500}
              placeholder="Describe what needs to be done..."
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          )}
        </FormField>

        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
            form.requestToAdmin
              ? "border-brand-300 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/30"
              : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/40"
          }`}
        >
          <input
            type="checkbox"
            checked={form.requestToAdmin}
            onChange={(e) =>
              setForm((p) => ({ ...p, requestToAdmin: e.target.checked }))
            }
            className="h-4 w-4 accent-brand-500"
          />
          <span className="text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              Request Admin/HR attention
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Admin will be notified and can take action on this task
            </span>
          </span>
        </label>

        {form.title.trim() || form.dueDate ? (
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-green-500" : "bg-amber-400"}`}
            />
            {ready
              ? "Ready to create — looks good!"
              : !form.title.trim()
                ? "Add a task title to continue"
                : "Pick a due date to continue"}
          </p>
        ) : null}

        {error ? (
          <Alert variant="error" title="Could not create task">
            {error}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!ready}>
            {form.requestToAdmin ? "Send to Admin" : "Create Task"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TaskCard({
  task,
  myName,
  canUpdate,
}: {
  task: TaskItem;
  myName: string | undefined;
  canUpdate: boolean;
}) {
  const setStatus = useSetMyTaskStatus();
  const { toast } = useToast();
  const today = isoIn(0);
  const s = STATUS[task.status];
  const p = PRIORITY[task.priority];
  const isClosed = task.status === "DONE" || task.status === "CANCELLED";
  const isOverdue = !isClosed && task.dueDate < today;
  const dueToday = !isClosed && task.dueDate === today;
  const awaitingApproval = task.status === "DONE" && !task.adminApproved;
  const canToggle =
    canUpdate && !task.adminApproved && task.status !== "CANCELLED";
  const createdByMe =
    task.isEmployeeCreated &&
    myName !== undefined &&
    task.assignedBy.fullName === myName &&
    task.assignee.fullName !== myName;

  async function move(status: MyTaskStatus) {
    try {
      await setStatus.mutateAsync({ id: task.id, status });
      toast({
        title: `Task marked as ${STATUS[status].label}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to update task status",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  const border = task.adminApproved
    ? "border border-green-300 bg-green-50/20 dark:border-green-900/60"
    : awaitingApproval
      ? "border border-amber-300 dark:border-amber-800"
      : isOverdue
        ? "border border-red-300 dark:border-red-800"
        : dueToday
          ? "border border-amber-200 dark:border-amber-900"
          : "";

  return (
    <Card
      className={`flex h-full flex-col transition-all hover:shadow-md ${border}`}
    >
      <div className="flex flex-1 items-start gap-3">
        <button
          type="button"
          disabled={!canToggle || setStatus.isPending}
          onClick={() => void move(task.status === "DONE" ? "PENDING" : "DONE")}
          aria-label={task.status === "DONE" ? "Reopen task" : "Complete task"}
          title={task.status === "DONE" ? "Mark as pending" : "Mark as done"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40 ${
            task.status === "DONE"
              ? "border-0 bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan text-white"
              : "border-gray-300 hover:border-brand-500 dark:border-gray-600"
          }`}
        >
          {task.status === "DONE" ? (
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
        </button>

        <div
          aria-hidden="true"
          className={`w-1 shrink-0 self-stretch rounded-full ${p.bar}`}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <p
            className={`text-sm font-semibold ${
              task.status === "DONE"
                ? "text-gray-400 line-through"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${p.cls}`}
            >
              {p.label}
            </span>
            <span
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
            >
              <s.icon className="h-3 w-3" aria-hidden="true" />
              {s.label}
            </span>
            {createdByMe ? (
              <span className="rounded border border-gray-300 px-1.5 text-[10px] text-gray-600 dark:border-gray-700 dark:text-gray-300">
                Created by you
              </span>
            ) : null}
            {task.requestToAdmin ? (
              <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                Admin requested
              </span>
            ) : null}
            {awaitingApproval ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Awaiting admin approval
              </span>
            ) : null}
            {task.adminApproved ? (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                ✓ Approved by Admin
              </span>
            ) : null}
          </div>

          {task.description ? (
            <p className="mt-2 line-clamp-3 text-xs text-gray-500 dark:text-gray-400">
              {task.description}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>By: {task.assignedBy.fullName}</span>
            <span
              className={
                isOverdue
                  ? "font-semibold text-red-600"
                  : dueToday
                    ? "font-semibold text-amber-600"
                    : ""
              }
            >
              {isOverdue ? "⚠ Overdue: " : "Due: "}
              {task.dueDate}
            </span>
            {task.approvedAt ? (
              <span className="text-green-600">
                Approved:{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  day: "2-digit",
                  month: "short",
                }).format(new Date(task.approvedAt))}
              </span>
            ) : null}
          </div>

          {canUpdate && !isClosed && !task.adminApproved ? (
            <div className="mt-auto flex gap-2 pt-3">
              {task.status === "PENDING" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full text-xs"
                  disabled={setStatus.isPending}
                  onClick={() => void move("IN_PROGRESS")}
                >
                  Start Working
                </Button>
              ) : null}
              <Button
                size="sm"
                className="h-7 rounded-full text-xs"
                disabled={setStatus.isPending}
                onClick={() => void move("DONE")}
              >
                Mark as Done
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * Self-service "My Tasks", laid out like the legacy page
 * (TexaWave_ERP_old src/modules/employee/MyTasks.tsx): New Task toggle with
 * an inline create form (title, priority pills, due-date chips, description,
 * "Request Admin/HR attention"), overdue / due-today alerts, Pending /
 * In Progress / Done / Admin Approved tiles, Active / Completed / All tabs
 * with a due-date sort, and a two-column grid of task cards with Start
 * Working / Mark as Done and a round complete/reopen toggle.
 */
export function MyTasksView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const canUpdateStatus = usePermission(SELF_SERVICE_UPDATE_STATUS);
  const me = useMe();
  const [filter, setFilter] = useState<Filter>("active");
  const [sortByDue, setSortByDue] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const list = useMyTasks({ page: 1, limit: 100 });

  const tasks = useMemo(
    () =>
      [...(list.data?.data ?? [])].sort((a, b) => {
        const d = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return d !== 0 ? d : a.dueDate.localeCompare(b.dueDate);
      }),
    [list.data],
  );

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to your tasks">
        Ask an administrator for the{" "}
        <code>employee_self_service.task.read</code> permission.
      </Alert>
    );
  }

  const today = isoIn(0);
  const open = (t: TaskItem) => t.status !== "DONE" && t.status !== "CANCELLED";
  const overdue = tasks.filter((t) => open(t) && t.dueDate < today);
  const dueToday = tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate === today,
  );

  const filtered = tasks
    .filter((t) => {
      if (filter === "active")
        return t.status === "PENDING" || t.status === "IN_PROGRESS";
      if (filter === "done") return t.status === "DONE";
      if (filter === "all") return true;
      return t.status === filter;
    })
    .sort((a, b) => (sortByDue ? a.dueDate.localeCompare(b.dueDate) : 0));

  const tiles = [
    { key: "PENDING" as const, label: "Pending", color: "text-gray-600" },
    {
      key: "IN_PROGRESS" as const,
      label: "In Progress",
      color: "text-blue-600",
    },
    { key: "DONE" as const, label: "Done", color: "text-brand-600" },
  ];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Tasks
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tasks assigned to you and tasks you created
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus
              className={`h-4 w-4 transition-transform ${showForm ? "rotate-45" : ""}`}
              aria-hidden="true"
            />
            {showForm ? "Cancel" : "New Task"}
          </Button>
        ) : null}
      </div>

      {showForm && canCreate ? (
        <CreateTaskForm onClose={() => setShowForm(false)} />
      ) : null}

      {overdue.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{overdue.length}</strong> overdue task
            {overdue.length > 1 ? "s" : ""}. Please update or complete them.
          </span>
        </div>
      ) : null}
      {dueToday.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{dueToday.length}</strong> task
            {dueToday.length > 1 ? "s are" : " is"} due today.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(filter === key ? "all" : key)}
            className={`rounded-2xl border bg-white p-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 dark:bg-gray-900 ${
              filter === key
                ? "border-brand-400"
                : "border-gray-200 hover:border-brand-300 dark:border-gray-800"
            }`}
          >
            <p className={`text-2xl font-bold ${color}`}>
              {tasks.filter((t) => t.status === key).length}
            </p>
            <p className="mt-1 text-xs text-gray-500">{label}</p>
          </button>
        ))}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-2xl font-bold text-brand-600">
            {tasks.filter((t) => t.adminApproved).length}
          </p>
          <p className="mt-1 text-xs text-gray-500">Admin Approved</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist" aria-label="Task filter">
          {(
            [
              { value: "active", label: "Active" },
              { value: "done", label: "Completed" },
              { value: "all", label: "All" },
            ] as const
          ).map((f) => (
            <Button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              size="sm"
              variant={filter === f.value ? "primary" : "ghost"}
              className="rounded-full px-4"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant={sortByDue ? "secondary" : "outline"}
          className="rounded-full text-xs"
          aria-pressed={sortByDue}
          onClick={() => setSortByDue((v) => !v)}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {sortByDue ? "Sorted by due date" : "Sort by due date"}
        </Button>
      </div>

      {list.isPending ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to your tasks">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-gray-500">
          <ClipboardList
            className="mx-auto mb-2 h-10 w-10 opacity-30"
            aria-hidden="true"
          />
          <p className="text-sm">
            No tasks{" "}
            {filter === "active"
              ? "active"
              : filter === "done"
                ? "completed"
                : "found"}
          </p>
          {canCreate ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create your first task
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              myName={me.data?.fullName}
              canUpdate={canUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
