"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import {
  useApproveTask,
  useReopenTask,
  useSetTaskStatus,
  useTasks,
} from "../hooks";
import {
  READ_ANY_SCOPE,
  SELF_SERVICE_READ,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import { TASK_STATUSES, type TaskItem, type TaskStatus } from "../types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { ReassignTaskDialog } from "./ReassignTaskDialog";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskStatusBadge";

const PAGE_SIZE = 10;

type TabKey = "assigned" | "requests";

interface Filters {
  q: string;
  assigneeId: string;
  status: "" | TaskStatus;
}

const EMPTY_FILTERS: Filters = { q: "", assigneeId: "", status: "" };

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

function formatTaskDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(
      dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`,
    );
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function getInitials(title: string): string {
  const parts = title.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

interface TableTaskItem extends TaskItem {
  rowNumber: number;
}

/**
 * HR Task Assignment: assign, reassign, update status, review requests,
 * and track tasks in caller's scope (hr.task.read/write).
 */
export function TasksView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const canSelfService = usePermission(SELF_SERVICE_READ);

  const [activeTab, setActiveTab] = useState<TabKey>("assigned");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<TaskItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<TaskItem | null>(null);

  const setStatus = useSetTaskStatus();
  const approve = useApproveTask();
  const reopen = useReopenTask();
  const { toast } = useToast();

  // Load employees for filter & code mapping
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeOptions = useMemo(
    () => employeesQuery.data?.data ?? [],
    [employeesQuery.data?.data],
  );
  const employeeCodeMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const emp of employeeOptions) {
      map.set(emp.id, emp.employeeCode);
    }
    return map;
  }, [employeeOptions]);

  // Comprehensive overview query to calculate summary counts deterministically
  const overviewQuery = useTasks({ page: 1, limit: 100 });
  const allTasks = useMemo(
    () => overviewQuery.data?.data ?? [],
    [overviewQuery.data?.data],
  );

  // Active paginated query
  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.assigneeId ? { assigneeId: Number(filters.assigneeId) } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }),
    [page, filters],
  );

  const list = useTasks(query);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setStatusFilter("");
    setPage(1);
  };

  const hasFilters =
    filters.q !== "" ||
    filters.assigneeId !== "" ||
    filters.status !== "" ||
    statusFilter !== "";

  // Summary Metrics calculations
  const assignedMetrics = useMemo(() => {
    const total = allTasks.length;
    const pending = allTasks.filter((t) => t.status === "PENDING").length;
    const inProgress = allTasks.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const completed = allTasks.filter((t) => t.status === "DONE").length;
    return { total, pending, inProgress, completed };
  }, [allTasks]);

  const requestTasks = useMemo(() => {
    return allTasks.filter((t) => t.isEmployeeCreated || t.requestToAdmin);
  }, [allTasks]);

  const requestMetrics = useMemo(() => {
    const total = requestTasks.length;
    const pending = requestTasks.filter(
      (t) =>
        t.status === "PENDING" ||
        (!t.adminApproved && t.status !== "CANCELLED"),
    ).length;
    const approved = requestTasks.filter((t) => t.adminApproved).length;
    const rejected = requestTasks.filter(
      (t) => t.status === "CANCELLED",
    ).length;
    return { total, pending, approved, rejected };
  }, [requestTasks]);

  // Filtered rows for Employee Requests tab
  const displayedRows = useMemo(() => {
    const source =
      activeTab === "assigned" ? (list.data?.data ?? []) : requestTasks;

    let filtered = source;
    if (activeTab === "requests") {
      if (filters.q) {
        const qLower = filters.q.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(qLower) ||
            t.assignee.fullName.toLowerCase().includes(qLower),
        );
      }
      if (filters.assigneeId) {
        const idNum = Number(filters.assigneeId);
        filtered = filtered.filter((t) => t.assignee.id === idNum);
      }
      if (statusFilter === "PENDING") {
        filtered = filtered.filter(
          (t) =>
            t.status === "PENDING" ||
            (!t.adminApproved && t.status !== "CANCELLED"),
        );
      } else if (statusFilter === "APPROVED") {
        filtered = filtered.filter((t) => t.adminApproved);
      } else if (statusFilter === "REJECTED") {
        filtered = filtered.filter((t) => t.status === "CANCELLED");
      }
    }

    return filtered;
  }, [activeTab, list.data?.data, requestTasks, filters, statusFilter]);

  const paginatedRows: TableTaskItem[] = useMemo(() => {
    if (activeTab === "assigned") {
      return displayedRows.map((t, idx) => ({
        ...t,
        rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
      }));
    }
    // Client-side pagination for requests tab
    const start = (page - 1) * PAGE_SIZE;
    return displayedRows.slice(start, start + PAGE_SIZE).map((t, idx) => ({
      ...t,
      rowNumber: start + idx + 1,
    }));
  }, [activeTab, displayedRows, page]);

  const totalRecords =
    activeTab === "assigned"
      ? (list.data?.meta.total ?? 0)
      : displayedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Handlers for Request Tab Approve / Reject
  async function handleApproveRequest(task: TaskItem) {
    try {
      if (task.status === "DONE" && !task.adminApproved) {
        await approve.mutateAsync(task.id);
      } else {
        await setStatus.mutateAsync({ id: task.id, status: "DONE" });
        await approve.mutateAsync(task.id);
      }
      toast({ title: "Request approved", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not approve request",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  async function handleRejectRequest(task: TaskItem) {
    try {
      await setStatus.mutateAsync({ id: task.id, status: "CANCELLED" });
      toast({ title: "Request rejected", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not reject request",
        description: describeStatusError(error),
        variant: "error",
      });
    }
  }

  async function handleDirectApprove(task: TaskItem) {
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

  async function handleDirectReopen(task: TaskItem) {
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

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Home</span>
            <span>/</span>
            <span>HR</span>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              Tasks
            </span>
          </div>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            Task Assignment
          </h1>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Create tasks, track progress, and review employee requests.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canSelfService ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/tasks")}
            >
              My tasks
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          ) : null}
        </div>
      </div>

      {/* 2. Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab("assigned");
            setPage(1);
          }}
          className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
            activeTab === "assigned"
              ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Assigned Tasks
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("requests");
            setPage(1);
          }}
          className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "requests"
              ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Employee Requests
          {requestMetrics.pending > 0 ? (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-800 dark:bg-warning-950/60 dark:text-warning-300">
              {requestMetrics.pending}
            </span>
          ) : null}
        </button>
      </div>

      {/* 3. Summary Metrics Cards */}
      {activeTab === "assigned" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Total Tasks */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {assignedMetrics.total}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Total Tasks
              </p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-950/50 dark:text-warning-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {assignedMetrics.pending}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Pending
              </p>
            </div>
          </div>

          {/* In Progress */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Loader2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {assignedMetrics.inProgress}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                In Progress
              </p>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/50 dark:text-success-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {assignedMetrics.completed}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Completed
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Total Requests */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {requestMetrics.total}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Total Requests
              </p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-950/50 dark:text-warning-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {requestMetrics.pending}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Pending
              </p>
            </div>
          </div>

          {/* Approved */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/50 dark:text-success-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {requestMetrics.approved}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Approved
              </p>
            </div>
          </div>

          {/* Rejected */}
          <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-950/50 dark:text-error-400">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
                {requestMetrics.rejected}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Rejected
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={
                activeTab === "assigned"
                  ? "Search tasks by title, employee..."
                  : "Search by employee, title..."
              }
              aria-label={
                activeTab === "assigned" ? "Search tasks" : "Search requests"
              }
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
              className="pl-9.5"
            />
          </div>

          {/* Employee Filter */}
          <div className="w-full sm:w-56">
            <Select
              aria-label="Filter by employee"
              value={filters.assigneeId}
              onChange={(e) => update("assigneeId", e.target.value)}
            >
              <option value="">All employees</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            {activeTab === "assigned" ? (
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
            ) : (
              <Select
                aria-label="Filter by request status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            )}
          </div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </Card>

      {/* 5. Table State Views */}
      {list.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to tasks">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : paginatedRows.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No tasks match these filters"
                : activeTab === "assigned"
                  ? "No tasks yet"
                  : "No employee requests yet"
            }
            description={
              hasFilters
                ? "Try adjusting your search terms or reset the filters."
                : activeTab === "assigned"
                  ? "Tasks assigned to team members will appear here."
                  : "Tasks requested by employees will appear here for review."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </Button>
              ) : activeTab === "assigned" && canWrite ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Task
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {activeTab === "assigned" ? (
            /* Assigned Tasks Table */
            <DataTable
              caption="Tasks"
              rows={paginatedRows}
              getRowKey={(t) => String(t.id)}
              columns={[
                {
                  header: "#",
                  cell: (t) => (
                    <span className="text-theme-xs text-gray-500 font-medium">
                      {t.rowNumber}
                    </span>
                  ),
                },
                {
                  header: "Task Title",
                  cell: (t) => {
                    const initials = getInitials(t.title);
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 font-semibold text-xs border border-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white/90 truncate">
                            {t.title}
                          </span>
                          {t.description ? (
                            <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {t.description}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  header: "Assigned To",
                  cell: (t) => (
                    <EmployeeIdentity
                      name={t.assignee.fullName}
                      code={employeeCodeMap.get(t.assignee.id)}
                      size="sm"
                    />
                  ),
                },
                {
                  header: "Priority",
                  cell: (t) => <TaskPriorityBadge priority={t.priority} />,
                },
                {
                  header: "Due Date",
                  cell: (t) => (
                    <div className="flex flex-col">
                      <span className="text-theme-sm text-gray-800 dark:text-gray-200">
                        {formatTaskDate(t.dueDate)}
                      </span>
                      {t.isOverdue ? (
                        <span className="text-[11px] font-medium text-error-600 dark:text-error-400">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Status",
                  cell: (t) => (
                    <div className="flex flex-col gap-1 items-start">
                      <TaskStatusBadge status={t.status} />
                      {t.awaitingApproval ? (
                        <span className="text-[11px] font-medium text-warning-600 dark:text-warning-400">
                          Awaiting approval
                        </span>
                      ) : t.adminApproved ? (
                        <span className="text-[11px] font-medium text-success-600 dark:text-success-400">
                          Approved
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Actions",
                  cell: (t) => (
                    <div className="flex items-center gap-1.5">
                      {/* View Details */}
                      <button
                        type="button"
                        aria-label={`View ${t.title}`}
                        onClick={() => setDetailsTarget(t)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Edit / Details */}
                      {canWrite ? (
                        <button
                          type="button"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => setDetailsTarget(t)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}

                      {/* Reopen / Approve shortcuts for awaiting approval */}
                      {canWrite && t.awaitingApproval ? (
                        <div className="flex items-center gap-1 ml-1">
                          <Button
                            size="sm"
                            onClick={() => void handleDirectApprove(t)}
                            className="h-7 px-2 text-xs"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleDirectReopen(t)}
                            className="h-7 px-2 text-xs"
                          >
                            Reopen
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            /* Employee Requests Table */
            <DataTable
              caption="Tasks"
              rows={paginatedRows}
              getRowKey={(t) => String(t.id)}
              columns={[
                {
                  header: "#",
                  cell: (t) => (
                    <span className="text-theme-xs text-gray-500 font-medium">
                      {t.rowNumber}
                    </span>
                  ),
                },
                {
                  header: "Employee",
                  cell: (t) => (
                    <EmployeeIdentity
                      name={t.assignee.fullName}
                      code={employeeCodeMap.get(t.assignee.id)}
                      size="sm"
                    />
                  ),
                },
                {
                  header: "Task Title",
                  cell: (t) => (
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-theme-sm text-gray-900 dark:text-white/90 truncate">
                        {t.title}
                      </span>
                      {t.description ? (
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {t.description}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Priority",
                  cell: (t) => <TaskPriorityBadge priority={t.priority} />,
                },
                {
                  header: "Submitted On",
                  cell: (t) => (
                    <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                      {formatTaskDate(t.createdAt)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (t) => {
                    if (t.adminApproved) {
                      return (
                        <StatusBadge label="Approved" colorToken="success" />
                      );
                    }
                    if (t.status === "CANCELLED") {
                      return (
                        <StatusBadge label="Rejected" colorToken="error" />
                      );
                    }
                    return <StatusBadge label="Pending" colorToken="warning" />;
                  },
                },
                {
                  header: "Actions",
                  cell: (t) => {
                    const isPending =
                      !t.adminApproved && t.status !== "CANCELLED";
                    return (
                      <div className="flex items-center gap-1.5">
                        {canWrite && isPending ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Approve ${t.title}`}
                              onClick={() => void handleApproveRequest(t)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Reject ${t.title}`}
                              onClick={() => void handleRejectRequest(t)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-950/60 dark:text-error-300 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`View ${t.title}`}
                          onClick={() => setDetailsTarget(t)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-1 py-3 dark:border-gray-800">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords}{" "}
              records
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* 6. Centered Modals */}
      {canWrite ? (
        <CreateTaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      <TaskDetailsDialog
        open={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        task={detailsTarget}
        canWrite={canWrite}
      />

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
