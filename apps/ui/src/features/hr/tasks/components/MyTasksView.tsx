"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { HrPageHeader } from "@/features/hr/components";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import type { MyTaskStatus } from "../api";
import { useMyTasks, useSetMyTaskStatus } from "../hooks";
import {
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
  SELF_SERVICE_UPDATE_STATUS,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import { TASK_STATUSES, type TaskItem, type TaskStatus } from "../types";
import { CreateMyTaskDialog } from "./CreateMyTaskDialog";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskStatusBadge";

const PAGE_SIZE = 20;

type SummaryFilter = "" | "PENDING" | "IN_PROGRESS" | "DONE" | "awaiting";

interface Filters {
  status: "" | TaskStatus;
  q: string;
  awaitingApproval: boolean;
}

const EMPTY_FILTERS: Filters = { status: "", q: "", awaitingApproval: false };

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

/** The next self-service move for a task (legacy `MyTasks.tsx`: "Start
 * Working", "Mark as Done", and the checkbox that reopens a DONE task).
 * `null` means no control — locked (approved) or cancelled. */
function nextMoves(task: TaskItem): MyTaskStatus[] {
  if (task.adminApproved) return [];
  switch (task.status) {
    case "PENDING":
      return ["IN_PROGRESS", "DONE"];
    case "IN_PROGRESS":
      return ["DONE"];
    case "DONE":
      return ["PENDING"];
    default:
      return [];
  }
}

const MOVE_LABELS: Record<MyTaskStatus, string> = {
  PENDING: "Mark as pending",
  IN_PROGRESS: "Start working",
  DONE: "Mark as done",
};

/**
 * Self-service "My Tasks" (legacy `employee/MyTasks.tsx`): tasks assigned to
 * or created by the authenticated employee. Start, complete or reopen a task
 * within the lifecycle the API allows; create a task for yourself, optionally
 * flagged for admin/HR attention.
 */
export function MyTasksView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const canUpdateStatus = usePermission(SELF_SERVICE_UPDATE_STATUS);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<SummaryFilter>("");
  const [createOpen, setCreateOpen] = useState(false);
  const setStatus = useSetMyTaskStatus();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const targetTaskId = searchParams?.get("id") || searchParams?.get("taskId");

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setSummary("");
    setPage(1);
  };

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.awaitingApproval ? { awaitingApproval: true } : {}),
      ...(summary === "PENDING" ? { status: "PENDING" as const } : {}),
      ...(summary === "IN_PROGRESS" ? { status: "IN_PROGRESS" as const } : {}),
      ...(summary === "DONE" ? { status: "DONE" as const } : {}),
      ...(summary === "awaiting" ? { awaitingApproval: true } : {}),
    }),
    [page, filters, summary],
  );

  const list = useMyTasks(query);

  useEffect(() => {
    if (targetTaskId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`task-row-${targetTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetTaskId, list.data]);
  // Unfiltered overview query to ensure card counts stay accurate regardless of active filters
  const overview = useMyTasks({ page: 1, limit: 100 });

  const overviewCounts = useMemo(() => {
    const items = overview.data?.data ?? [];
    return {
      PENDING: items.filter((t) => t.status === "PENDING").length,
      IN_PROGRESS: items.filter((t) => t.status === "IN_PROGRESS").length,
      DONE: items.filter((t) => t.status === "DONE").length,
      awaiting: items.filter((t) => t.awaitingApproval).length,
    };
  }, [overview.data?.data]);

  const hasFilters =
    filters.status !== "" || filters.q !== "" || filters.awaitingApproval;

  async function handleMove(task: TaskItem, status: MyTaskStatus) {
    try {
      await setStatus.mutateAsync({ id: task.id, status });
      toast({ title: "Task updated", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not update task",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to your tasks">
        Ask an administrator for the{" "}
        <code>employee_self_service.task.read</code> permission.
      </Alert>
    );
  }

  const summaryConfig = [
    {
      label: "Pending",
      value: "PENDING" as SummaryFilter,
      Icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "In Progress",
      value: "IN_PROGRESS" as SummaryFilter,
      Icon: PlayCircle,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Completed",
      value: "DONE" as SummaryFilter,
      Icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Awaiting Approval",
      value: "awaiting" as SummaryFilter,
      Icon: ShieldCheck,
      color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40",
    },
  ];

  const summaryCard = (
    label: string,
    value: SummaryFilter,
    Icon: React.ComponentType<{ className?: string }>,
    color: string,
  ) => {
    const isSelected = summary === value;
    const count = overview.isPending
      ? "—"
      : (overviewCounts[value as keyof typeof overviewCounts] ?? 0);
    return (
      <button
        key={value}
        type="button"
        onClick={() => {
          setSummary((s) => (s === value ? "" : value));
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }}
        className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all cursor-pointer ${
          isSelected
            ? "border-2 border-brand-500 bg-sky-50/80 shadow-xs ring-2 ring-brand-500/15 dark:bg-slate-800"
            : "border border-sky-200/90 bg-white hover:border-brand-300 hover:bg-sky-50/40 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
        }`}
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {label}
          </span>
          <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
            {count}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Standard Enterprise Page Header */}
      <HrPageHeader
        title="My Tasks"
        description="View and manage tasks assigned to you, track milestones, and create self-service requests."
        icon3d="tasks"
        action={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl font-bold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New task</span>
            </Button>
          ) : null
        }
      />

      {/* 2. Interactive Status Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryConfig.map((cfg) =>
          summaryCard(cfg.label, cfg.value, cfg.Icon, cfg.color),
        )}
      </div>

      {/* 3. Search & Filter Bar: Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search tasks by title..."
            aria-label="Search my tasks"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | TaskStatus)
            }
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters || summary ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSummary("");
              setPage(1);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Task List & DataTable */}
      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
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
      ) : list.data.data.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={
              hasFilters || summary
                ? "No tasks match these filters"
                : "No tasks yet"
            }
            description={
              hasFilters || summary
                ? "Try a different status, search term, or clear the active filter."
                : canCreate
                  ? "Tasks assigned to you, or tasks you create for yourself, will appear here."
                  : "Tasks assigned to you will appear here."
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable
            className="border-0 shadow-none rounded-none"
            caption="My tasks"
            rows={list.data.data}
            getRowKey={(t) => String(t.id)}
            columns={[
              {
                header: "Title",
                cell: (t) => {
                  const isHighlighted =
                    targetTaskId && String(t.id) === targetTaskId;
                  return (
                    <div
                      id={`task-row-${t.id}`}
                      className={`flex flex-col gap-1.5 py-1 transition-all ${
                        isHighlighted
                          ? "rounded-xl border border-brand-300 bg-sky-50/80 p-2 dark:border-sky-700 dark:bg-sky-950/60 ring-2 ring-[#1769F5]/40"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0a3271] dark:text-white">
                          {t.title}
                        </span>
                        {isHighlighted && (
                          <span className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TaskPriorityBadge priority={t.priority} />
                        {t.isOverdue ? (
                          <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                            Overdue
                          </span>
                        ) : null}
                        {t.requestToAdmin ? (
                          <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                            Sent to admin
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                },
              },
              {
                header: "Assigned by",
                cell: (t) => (
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.assignedBy.fullName}
                  </span>
                ),
              },
              {
                header: "Due date",
                cell: (t) => (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    {t.dueDate}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (t) => (
                  <div className="flex flex-col gap-1">
                    <TaskStatusBadge status={t.status} />
                    {t.awaitingApproval ? (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Awaiting approval
                      </span>
                    ) : null}
                    {t.adminApproved ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Approved
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (t: TaskItem) => {
                  const moves = canUpdateStatus ? nextMoves(t) : [];
                  if (moves.length === 0) return "—";
                  return (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {moves.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={status === "DONE" ? "primary" : "secondary"}
                          onClick={() => void handleMove(t, status)}
                          className="rounded-xl text-xs font-bold"
                        >
                          {status === "IN_PROGRESS" ? (
                            <PlayCircle className="mr-1 h-3.5 w-3.5" />
                          ) : status === "DONE" ? (
                            <Check className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          )}
                          {MOVE_LABELS[status]}
                        </Button>
                      ))}
                    </div>
                  );
                },
              },
            ]}
          />
          {list.data.meta.totalPages > 1 ? (
            <div className="border-t border-sky-100 p-4 dark:border-slate-800">
              <Pagination
                page={list.data.meta.page}
                totalPages={list.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}

      {canCreate ? (
        <CreateMyTaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}
