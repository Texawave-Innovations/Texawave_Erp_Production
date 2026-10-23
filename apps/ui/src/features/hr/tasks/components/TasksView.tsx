"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  List,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Table,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import { useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
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
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { ReassignTaskDialog } from "./ReassignTaskDialog";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskStatusBadge";

const PAGE_SIZE = 10;

type TabKey = "assigned" | "requests";
type ViewMode = "grid" | "list" | "table";

interface Filters {
  q: string;
  assigneeId: string;
  status: "" | TaskStatus | "AWAITING_APPROVAL";
  priority: "" | TaskPriority;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  assigneeId: "",
  status: "",
  priority: "",
};

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

interface TableTaskItem extends TaskItem {
  rowNumber: number;
}

/**
 * HR Task Assignment: assign, reassign, update status, review requests,
 * and track tasks in caller's scope (hr.task.read/write).
 * Features 5 interactive metric cards, List, Grid (3-column), and Table views,
 * direct Approve / Reopen quick actions, and CSV/Excel export.
 */
export function TasksView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const canSelfService = usePermission(SELF_SERVICE_READ);

  const [activeTab, setActiveTab] = useState<TabKey>("assigned");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("");

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

  // Active paginated query for assigned tab
  const isAwaitingApprovalFilter = filters.status === "AWAITING_APPROVAL";
  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.assigneeId ? { assigneeId: Number(filters.assigneeId) } : {}),
      ...(filters.status && !isAwaitingApprovalFilter
        ? { status: filters.status as TaskStatus }
        : {}),
    }),
    [page, filters, isAwaitingApprovalFilter],
  );

  const list = useTasks(query);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setRequestStatusFilter("");
    setPage(1);
  };

  const hasFilters =
    filters.q !== "" ||
    filters.assigneeId !== "" ||
    filters.status !== "" ||
    filters.priority !== "" ||
    requestStatusFilter !== "";

  // Summary Metrics calculations (5 unified cards)
  const assignedMetrics = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "PENDING").length;
    const inProgress = allTasks.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const completed = allTasks.filter((t) => t.status === "DONE").length;
    const awaitingApproval = allTasks.filter(
      (t) => t.awaitingApproval || (t.status === "DONE" && !t.adminApproved),
    ).length;
    return { pending, inProgress, completed, awaitingApproval };
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

  // Filtered rows
  const displayedRows = useMemo(() => {
    let source =
      activeTab === "assigned"
        ? isAwaitingApprovalFilter
          ? allTasks.filter(
              (t) =>
                t.awaitingApproval ||
                (t.status === "DONE" && !t.adminApproved),
            )
          : (list.data?.data ?? [])
        : requestTasks;

    // Apply priority filter client-side
    if (filters.priority) {
      source = source.filter((t) => t.priority === filters.priority);
    }

    if (activeTab === "requests") {
      if (filters.q) {
        const qLower = filters.q.toLowerCase();
        source = source.filter(
          (t) =>
            t.title.toLowerCase().includes(qLower) ||
            t.assignee.fullName.toLowerCase().includes(qLower),
        );
      }
      if (filters.assigneeId) {
        const idNum = Number(filters.assigneeId);
        source = source.filter((t) => t.assignee.id === idNum);
      }
      if (requestStatusFilter === "PENDING") {
        source = source.filter(
          (t) =>
            t.status === "PENDING" ||
            (!t.adminApproved && t.status !== "CANCELLED"),
        );
      } else if (requestStatusFilter === "APPROVED") {
        source = source.filter((t) => t.adminApproved);
      } else if (requestStatusFilter === "REJECTED") {
        source = source.filter((t) => t.status === "CANCELLED");
      }
    }

    return source;
  }, [
    activeTab,
    isAwaitingApprovalFilter,
    allTasks,
    list.data?.data,
    requestTasks,
    filters,
    requestStatusFilter,
  ]);

  const paginatedRows: TableTaskItem[] = useMemo(() => {
    if (activeTab === "assigned" && !isAwaitingApprovalFilter && !filters.priority) {
      return displayedRows.map((t, idx) => ({
        ...t,
        rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
      }));
    }
    const start = (page - 1) * PAGE_SIZE;
    return displayedRows.slice(start, start + PAGE_SIZE).map((t, idx) => ({
      ...t,
      rowNumber: start + idx + 1,
    }));
  }, [
    activeTab,
    isAwaitingApprovalFilter,
    filters.priority,
    displayedRows,
    page,
  ]);

  const totalRecords =
    activeTab === "assigned" && !isAwaitingApprovalFilter && !filters.priority
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

  // Interactive Card Click
  function handleMetricCardClick(
    type: "PENDING" | "IN_PROGRESS" | "DONE" | "AWAITING_APPROVAL" | "REQUESTS",
  ) {
    if (type === "REQUESTS") {
      if (activeTab === "requests") {
        setActiveTab("assigned");
        handleResetFilters();
      } else {
        setActiveTab("requests");
        handleResetFilters();
      }
      return;
    }

    setActiveTab("assigned");
    if (filters.status === type) {
      update("status", "");
    } else {
      update("status", type);
    }
  }

  // Export to Excel / CSV
  function handleExport() {
    const tasksToExport =
      activeTab === "assigned"
        ? allTasks.length > 0
          ? allTasks
          : (list.data?.data ?? [])
        : requestTasks;

    if (!tasksToExport || tasksToExport.length === 0) {
      toast({ title: "No tasks to export", variant: "warning" });
      return;
    }

    const headers = [
      "Task ID",
      "Task Title",
      "Description",
      "Priority",
      "Status",
      "Awaiting Approval",
      "Admin Approved",
      "Assignee Name",
      "Assignee Code",
      "Due Date",
      "Created Date",
    ];

    const rows = tasksToExport.map((t) => [
      t.id,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      `"${(t.description || "").replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.awaitingApproval ? "Yes" : "No",
      t.adminApproved ? "Yes" : "No",
      `"${(t.assignee?.fullName || "").replace(/"/g, '""')}"`,
      employeeCodeMap.get(t.assignee?.id) || "",
      t.dueDate || "",
      t.createdAt ? formatTaskDate(t.createdAt) : "",
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `texaone_tasks_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Tasks exported successfully", variant: "success" });
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
      {/* 1. Header Banner with View Modes, Export & Primary Actions */}
      <HrPageHeader
        title="Task Assignment"
        description="Create tasks, delegate operational assignments, and review employee completion requests."
        icon={ListTodo}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Segmented Controls */}
            <div className="flex items-center gap-1 rounded-xl bg-white/20 p-1 border border-white/30 backdrop-blur-xs">
              <button
                type="button"
                title="Grid View"
                aria-label="Grid View"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                title="List View"
                aria-label="List View"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                title="Table View"
                aria-label="Table View"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* Export Excel Button */}
            <Button
              variant="secondary"
              onClick={handleExport}
              className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-3.5 py-2 font-medium text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </Button>

            {/* Self-service My tasks */}
            {canSelfService ? (
              <Button
                variant="secondary"
                onClick={() => router.push("/portal/tasks")}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-3.5 py-2 font-medium text-xs"
              >
                <span>My tasks</span>
              </Button>
            ) : null}

            {/* New Task button */}
            {canWrite ? (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-xl">
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* 2. 5 Top Interactive Metric Cards (Reference 1 Inspiration) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Card 1: Pending */}
        <button
          type="button"
          onClick={() => handleMetricCardClick("PENDING")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "PENDING"
              ? "border-warning-400 bg-warning-50/40 ring-2 ring-warning-500/20 dark:bg-warning-950/40 dark:border-warning-600"
              : "border-gray-200/90 bg-white hover:border-warning-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-950/60 dark:text-warning-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {assignedMetrics.pending}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Pending
            </p>
          </div>
        </button>

        {/* Card 2: In Progress */}
        <button
          type="button"
          onClick={() => handleMetricCardClick("IN_PROGRESS")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "IN_PROGRESS"
              ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
              : "border-gray-200/90 bg-white hover:border-brand-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
            <Loader2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">
              {assignedMetrics.inProgress}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              In Progress
            </p>
          </div>
        </button>

        {/* Card 3: Completed */}
        <button
          type="button"
          onClick={() => handleMetricCardClick("DONE")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "DONE"
              ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:border-emerald-600"
              : "border-gray-200/90 bg-white hover:border-emerald-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {assignedMetrics.completed}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Completed
            </p>
          </div>
        </button>

        {/* Card 4: Awaiting Approval (Warm highlight from Reference 1) */}
        <button
          type="button"
          onClick={() => handleMetricCardClick("AWAITING_APPROVAL")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "AWAITING_APPROVAL"
              ? "border-amber-400 bg-amber-100/50 ring-2 ring-amber-500/30 dark:bg-amber-950/60 dark:border-amber-600"
              : "border-amber-200/80 bg-amber-50/30 hover:border-amber-300 hover:shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
              {assignedMetrics.awaitingApproval}
            </p>
            <p className="text-theme-xs font-medium text-amber-900 dark:text-amber-200">
              Awaiting Approval
            </p>
          </div>
        </button>

        {/* Card 5: Employee Requests */}
        <button
          type="button"
          onClick={() => handleMetricCardClick("REQUESTS")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            activeTab === "requests"
              ? "border-cyan-400 bg-cyan-50/40 ring-2 ring-cyan-500/20 dark:bg-cyan-950/40 dark:border-cyan-600"
              : "border-gray-200/90 bg-white hover:border-cyan-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-cyan-700 dark:text-cyan-300">
              {requestMetrics.total}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Employee Requests
            </p>
          </div>
        </button>
      </div>

      {/* 3. Tab Navigation & Filter Toolbar Container */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark flex flex-col gap-4">
        {/* Tab Pills */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-850">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("assigned");
                setPage(1);
              }}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "assigned"
                  ? "bg-brand-50 text-brand-600 shadow-xs dark:bg-brand-950/60 dark:text-brand-300"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Assigned Tasks ({allTasks.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("requests");
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "requests"
                  ? "bg-brand-50 text-brand-600 shadow-xs dark:bg-brand-950/60 dark:text-brand-300"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Employee Requests
              {requestMetrics.pending > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {requestMetrics.pending}
                </span>
              ) : null}
            </button>
          </div>

          <div className="text-theme-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Showing <span className="font-semibold text-gray-800 dark:text-gray-200">{displayedRows.length}</span> {activeTab === "assigned" ? "tasks" : "requests"}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={
                activeTab === "assigned"
                  ? "Search tasks by title, employee..."
                  : "Search requests by employee, title..."
              }
              aria-label="Search tasks"
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
              className="pl-9.5"
            />
          </div>

          {/* Employee Filter */}
          <div className="w-full sm:w-52">
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
          <div className="w-full sm:w-44">
            {activeTab === "assigned" ? (
              <Select
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) =>
                  update(
                    "status",
                    e.target.value as "" | TaskStatus | "AWAITING_APPROVAL",
                  )
                }
              >
                <option value="">All statuses</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
                <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              </Select>
            ) : (
              <Select
                aria-label="Filter by request status"
                value={requestStatusFilter}
                onChange={(e) => {
                  setRequestStatusFilter(e.target.value);
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

          {/* Priority Filter */}
          <div className="w-full sm:w-36">
            <Select
              aria-label="Filter by priority"
              value={filters.priority}
              onChange={(e) =>
                update("priority", e.target.value as "" | TaskPriority)
              }
            >
              <option value="">All priorities</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>

          {/* Reset Button */}
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {/* 4. Content Area: Grid View, List View, or Table View */}
      {list.isPending ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl border border-gray-200 bg-gray-50/50 p-5 animate-pulse dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : (
          <TableSkeleton rowsCount={5} columnsCount={7} />
        )
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to tasks">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : paginatedRows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
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
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Task
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* A. GRID VIEW (Reference 2 Inspiration: 3-column interactive cards) */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {paginatedRows.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-brand-300 transition-all dark:border-gray-800 dark:bg-gray-dark group"
                >
                  <div>
                    {/* Header: Title + Badges */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h3
                        onClick={() => setDetailsTarget(t)}
                        className="font-bold text-base text-gray-900 group-hover:text-brand-600 dark:text-white/90 dark:group-hover:text-brand-400 cursor-pointer line-clamp-2 transition-colors"
                      >
                        {t.title}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TaskPriorityBadge priority={t.priority} />
                        <TaskStatusBadge status={t.status} />
                      </div>
                    </div>

                    {/* Description */}
                    {t.description ? (
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                        {t.description}
                      </p>
                    ) : (
                      <p className="text-theme-xs text-gray-400 italic mb-4">
                        No description provided
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Divider */}
                    <div className="h-px w-full bg-gray-100 dark:bg-gray-800 mb-3.5" />

                    {/* Assignee & Status Notice */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <EmployeeIdentity
                        name={t.assignee.fullName}
                        code={employeeCodeMap.get(t.assignee.id)}
                        size="sm"
                      />
                      {t.awaitingApproval || (!t.adminApproved && t.status === "DONE") ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                          Awaiting approval
                        </span>
                      ) : null}
                    </div>

                    {/* Footer: Due Date & Actions */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-850">
                      <div className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span
                          className={
                            t.isOverdue
                              ? "font-semibold text-rose-600 dark:text-rose-400"
                              : ""
                          }
                        >
                          {formatTaskDate(t.dueDate)}
                        </span>
                        {t.isOverdue ? (
                          <span className="rounded bg-rose-50 px-1 py-0.2 text-[10px] font-bold text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                            Overdue
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canWrite &&
                        (t.awaitingApproval ||
                          (!t.adminApproved && t.status === "DONE")) ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void (activeTab === "requests"
                                  ? handleApproveRequest(t)
                                  : handleDirectApprove(t))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void (activeTab === "requests"
                                  ? handleRejectRequest(t)
                                  : handleDirectReopen(t))
                              }
                              className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                              {activeTab === "requests" ? "Reject" : "Reopen"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`View ${t.title}`}
                              onClick={() => setDetailsTarget(t)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canWrite ? (
                              <button
                                type="button"
                                aria-label={`Edit ${t.title}`}
                                onClick={() => setDetailsTarget(t)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* B. LIST VIEW (Reference 1 Inspiration: Horizontal stacked cards with direct actions) */}
          {viewMode === "list" && (
            <div className="flex flex-col gap-3">
              {paginatedRows.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-4.5 shadow-xs hover:border-brand-300 hover:shadow-xs transition-all dark:border-gray-800 dark:bg-gray-dark"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    {/* Title & Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        onClick={() => setDetailsTarget(t)}
                        className="font-bold text-base text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400 cursor-pointer transition-colors"
                      >
                        {t.title}
                      </span>
                      <TaskPriorityBadge priority={t.priority} />
                      {t.isEmployeeCreated || t.requestToAdmin ? (
                        <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800 border border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800">
                          Employee Request
                        </span>
                      ) : null}
                      {t.awaitingApproval ||
                      (!t.adminApproved && t.status === "DONE") ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                          Awaiting Approval
                        </span>
                      ) : null}
                    </div>

                    {/* Description */}
                    {t.description ? (
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {t.description}
                      </p>
                    ) : null}

                    {/* Metadata Line */}
                    <div className="flex flex-wrap items-center gap-4 text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {activeTab === "requests"
                            ? "Requested by:"
                            : "Assigned to:"}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {t.assignee.fullName}
                        </span>
                        {employeeCodeMap.get(t.assignee.id) ? (
                          <span className="text-[11px] text-gray-400">
                            ({employeeCodeMap.get(t.assignee.id)})
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>Due:</span>
                        <span
                          className={
                            t.isOverdue
                              ? "font-semibold text-rose-600 dark:text-rose-400"
                              : "font-medium text-gray-700 dark:text-gray-300"
                          }
                        >
                          {formatTaskDate(t.dueDate)}
                        </span>
                        {t.isOverdue ? (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 ml-0.5">
                            (Overdue)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Status & Fast Actions */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <TaskStatusBadge status={t.status} />

                    {canWrite &&
                    (t.awaitingApproval ||
                      (!t.adminApproved && t.status === "DONE")) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void (activeTab === "requests"
                              ? handleApproveRequest(t)
                              : handleDirectApprove(t))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void (activeTab === "requests"
                              ? handleRejectRequest(t)
                              : handleDirectReopen(t))
                          }
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 transition-colors"
                        >
                          {activeTab === "requests" ? "Reject" : "Reopen"}
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      aria-label={`View ${t.title}`}
                      onClick={() => setDetailsTarget(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* C. TABLE VIEW (Dense Standard View) */}
          {viewMode === "table" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-dark">
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
                    cell: (t) => (
                      <div className="flex flex-col min-w-0">
                        <span
                          onClick={() => setDetailsTarget(t)}
                          className="font-semibold text-theme-sm text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400 cursor-pointer truncate"
                        >
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
                    header:
                      activeTab === "requests" ? "Requested By" : "Assigned To",
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
                          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
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
                        {t.awaitingApproval ||
                        (!t.adminApproved && t.status === "DONE") ? (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Awaiting approval
                          </span>
                        ) : t.adminApproved ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
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
                        {canWrite &&
                        (t.awaitingApproval ||
                          (!t.adminApproved && t.status === "DONE")) ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                void (activeTab === "requests"
                                  ? handleApproveRequest(t)
                                  : handleDirectApprove(t))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void (activeTab === "requests"
                                  ? handleRejectRequest(t)
                                  : handleDirectReopen(t))
                              }
                              className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                              {activeTab === "requests" ? "Reject" : "Reopen"}
                            </button>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          aria-label={`View ${t.title}`}
                          onClick={() => setDetailsTarget(t)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

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
                      </div>
                    ),
                  },
                ]}
              />
            </div>
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

      {/* 5. Centered Modals */}
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
