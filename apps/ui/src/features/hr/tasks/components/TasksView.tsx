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
import {
  useApproveTask,
  useReopenTask,
  useSetTaskStatus,
  useTasks,
} from "../hooks";
import { READ_ANY_SCOPE, WRITE_TEAM_OR_ALL } from "../permissions";
import { STATUS_LABELS } from "../status";
import { TASK_STATUSES, type TaskItem, type TaskStatus } from "../types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { ReassignTaskDialog } from "./ReassignTaskDialog";
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
      return "You don't have permission to change this task.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This task can no longer move to that status — it may already be approved or completed.";
    }
    if (error.statusCode === 404) {
      return "This task is no longer in your scope.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/**
 * HR Task Assignment: assign, reassign, update status, approve and reopen
 * tasks within the caller's scope (hr.task.read/write). Filtering and paging
 * happen server-side; this view only builds the query.
 */
export function TasksView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<SummaryFilter>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<TaskItem | null>(null);
  const setStatus = useSetTaskStatus();
  const approve = useApproveTask();
  const reopen = useReopenTask();
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

  const list = useTasks(query);
  const hasFilters =
    filters.status !== "" || filters.q !== "" || filters.awaitingApproval;

  async function handleStatusChange(task: TaskItem, status: TaskStatus) {
    try {
      await setStatus.mutateAsync({ id: task.id, status });
      toast({ title: "Status updated", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not update status",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  async function handleApprove(task: TaskItem) {
    try {
      await approve.mutateAsync(task.id);
      toast({ title: "Task approved", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not approve",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  async function handleReopen(task: TaskItem) {
    try {
      await reopen.mutateAsync(task.id);
      toast({ title: "Task reopened", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not reopen",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tasks">
        Ask an administrator for the <code>hr.task.read</code> permission.
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
            Task Assignment
          </h1>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters || summary
                ? `Showing ${list.data.meta.total} matching tasks`
                : `${list.data.meta.total} tasks`}
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            New Task
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input
            placeholder="Search title or assignee"
            aria-label="Search tasks"
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
          <Alert variant="warning" title="You don't have access to tasks">
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
                : "Tasks you assign will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Tasks"
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
                          Employee request
                        </span>
                      ) : null}
                    </div>
                  </div>
                ),
              },
              { header: "Assignee", cell: (t) => t.assignee.fullName },
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
              ...(canWrite
                ? [
                    {
                      header: "Actions",
                      cell: (t: TaskItem) => {
                        if (t.awaitingApproval) {
                          return (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => void handleApprove(t)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleReopen(t)}
                              >
                                Reopen
                              </Button>
                            </div>
                          );
                        }
                        if (t.adminApproved) {
                          return "—";
                        }
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              aria-label={`Set status for ${t.title}`}
                              value={t.status}
                              onChange={(e) =>
                                void handleStatusChange(
                                  t,
                                  e.target.value as TaskStatus,
                                )
                              }
                              className="w-auto min-w-[8rem]"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </Select>
                            {!t.isEmployeeCreated &&
                            (t.status === "PENDING" ||
                              t.status === "IN_PROGRESS") ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReassignTarget(t)}
                              >
                                Reassign
                              </Button>
                            ) : null}
                          </div>
                        );
                      },
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {canWrite ? (
        <CreateTaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
      {canWrite && reassignTarget ? (
        <ReassignTaskDialog
          open
          onClose={() => setReassignTarget(null)}
          task={reassignTarget}
        />
      ) : null}
    </div>
  );
}
