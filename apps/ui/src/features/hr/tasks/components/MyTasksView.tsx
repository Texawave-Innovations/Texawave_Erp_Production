"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
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

  const summaryCard = (
    label: string,
    value: SummaryFilter,
    count: number | undefined,
  ) => (
    <button
      type="button"
      onClick={() => {
        setSummary((s) => (s === value ? "" : value));
        setFilters(EMPTY_FILTERS);
        setPage(1);
      }}
      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
        summary === value
          ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-dark dark:hover:bg-gray-800"
      }`}
    >
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        {count ?? "—"}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            My Tasks
          </h1>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters || summary
                ? `Showing ${list.data.meta.total} matching tasks`
                : `${list.data.meta.total} tasks`}
            </p>
          ) : null}
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            New task
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCard("Pending", "PENDING", undefined)}
        {summaryCard("In Progress", "IN_PROGRESS", undefined)}
        {summaryCard("Completed", "DONE", undefined)}
        {summaryCard("Awaiting Approval", "awaiting", undefined)}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Search title"
            aria-label="Search my tasks"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
          />
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
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
        <Card>
          <EmptyState
            title={
              hasFilters || summary
                ? "No tasks match these filters"
                : "No tasks yet"
            }
            description={
              hasFilters || summary
                ? "Try a different status, search term, or clear the filters."
                : canCreate
                  ? "Tasks assigned to you, or tasks you create for yourself, will appear here."
                  : "Tasks assigned to you will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My tasks"
            rows={list.data.data}
            getRowKey={(t) => String(t.id)}
            columns={[
              {
                header: "Title",
                cell: (t) => (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {t.title}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <TaskPriorityBadge priority={t.priority} />
                      {t.isOverdue ? (
                        <span className="text-theme-xs text-error-600 dark:text-error-400">
                          Overdue
                        </span>
                      ) : null}
                      {t.requestToAdmin ? (
                        <span className="text-theme-xs text-brand-600 dark:text-brand-400">
                          Sent to admin
                        </span>
                      ) : null}
                    </div>
                  </div>
                ),
              },
              { header: "Assigned by", cell: (t) => t.assignedBy.fullName },
              { header: "Due", cell: (t) => t.dueDate },
              {
                header: "Status",
                cell: (t) => (
                  <div className="flex flex-col gap-1">
                    <TaskStatusBadge status={t.status} />
                    {t.awaitingApproval ? (
                      <span className="text-theme-xs text-warning-600 dark:text-warning-400">
                        Awaiting approval
                      </span>
                    ) : null}
                    {t.adminApproved ? (
                      <span className="text-theme-xs text-success-600 dark:text-success-400">
                        Approved
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Actions",
                cell: (t: TaskItem) => {
                  const moves = canUpdateStatus ? nextMoves(t) : [];
                  if (moves.length === 0) return "—";
                  return (
                    <div className="flex flex-wrap gap-2">
                      {moves.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={status === "DONE" ? "primary" : "secondary"}
                          onClick={() => void handleMove(t, status)}
                        >
                          {MOVE_LABELS[status]}
                        </Button>
                      ))}
                    </div>
                  );
                },
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
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
