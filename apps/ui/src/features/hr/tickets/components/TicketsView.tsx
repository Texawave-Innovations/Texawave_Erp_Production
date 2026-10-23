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
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Inbox,
  LayoutList,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  Table,
  Ticket,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import {
  useAddTicketComment,
  useSetTicketStatus,
  useTickets,
} from "../hooks";
import {
  READ_ANY_SCOPE,
  SELF_SERVICE_READ,
  WRITE_ANY_SCOPE,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketItem,
  type TicketStatus,
} from "../types";
import { formatTicketDate, formatTicketId } from "../utils";
import { RaiseTicketDialog } from "./RaiseTicketDialog";
import { TicketDetailDialog } from "./TicketDetailDialog";
import { TicketStatusBadge } from "./TicketStatusBadge";

const PAGE_SIZE = 10;

type ViewMode = "feed" | "table";

interface Filters {
  status: "" | TicketStatus | "RESOLVED_CLOSED";
  category: "" | TicketCategory;
  adminOnly?: boolean;
}

const EMPTY_FILTERS: Filters = { status: "", category: "" };

function getCategoryColor(category: TicketCategory): string {
  switch (category) {
    case "Attendance":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800";
    case "Salary":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "Leave":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    case "Documents":
      return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";
    case "IT Support":
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
    case "HR Query":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
    case "Notice":
      return "bg-sky-50 text-brand-600 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800";
    case "Warning":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    case "Other":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
}

interface TableTicketRow extends TicketItem {
  rowNumber: number;
}

/**
 * HR Employee Tickets View:
 * Features:
 * 1. 4 Interactive Metric Filter Cards (Employee Open, In Progress, Admin Sent, Resolved/Closed)
 * 2. Feed View (Reference 4) with direct description view and 1-click inline reply + status transition
 * 3. Dense Table View toggle
 * 4. 1-Click Excel / CSV Export
 * 5. Modernized Create Ticket Modal (Reference 5)
 */
export function TicketsView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const canSelfService = usePermission(SELF_SERVICE_READ);

  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Inline reply & status states per ticket
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<number, TicketStatus>>({});
  const [submittingMap, setSubmittingMap] = useState<Record<number, boolean>>({});

  const setStatusMutation = useSetTicketStatus();
  const addCommentMutation = useAddTicketComment();
  const { toast } = useToast();

  // Load employees for code mapping
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

  // Comprehensive overview query to calculate summary metric cards accurately
  const overviewQuery = useTickets({ page: 1, limit: 100 }, canRead);
  const allTickets = useMemo(
    () => overviewQuery.data?.data ?? [],
    [overviewQuery.data?.data],
  );

  // 4 Interactive Metric Cards (Reference 4 Inspiration)
  const metrics = useMemo(() => {
    const total = allTickets.length;
    const employeeOpen = allTickets.filter(
      (t) => !t.raisedByAdmin && t.status === "OPEN",
    ).length;
    const inProgress = allTickets.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const adminSent = allTickets.filter(
      (t) => t.raisedByAdmin && t.isActive,
    ).length;
    const resolvedClosed = allTickets.filter(
      (t) => t.status === "RESOLVED" || t.status === "CLOSED",
    ).length;
    return { total, employeeOpen, inProgress, adminSent, resolvedClosed };
  }, [allTickets]);

  // Client filtered items
  const filteredTickets = useMemo(() => {
    let items = allTickets;

    // Filter by search
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase().trim();
      items = items.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.employee.fullName.toLowerCase().includes(q) ||
          formatTicketId(t.id).toLowerCase().includes(q),
      );
    }

    // Filter by Category
    if (filters.category) {
      items = items.filter((t) => t.category === filters.category);
    }

    // Filter by Status / Admin
    if (filters.adminOnly) {
      items = items.filter((t) => t.raisedByAdmin && t.isActive);
    } else if (filters.status === "RESOLVED_CLOSED") {
      items = items.filter(
        (t) => t.status === "RESOLVED" || t.status === "CLOSED",
      );
    } else if (filters.status) {
      items = items.filter((t) => t.status === filters.status);
    }

    return items;
  }, [allTickets, searchInput, filters]);

  const paginatedTickets: TableTicketRow[] = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE).map((t, idx) => ({
      ...t,
      rowNumber: start + idx + 1,
    }));
  }, [filteredTickets, page]);

  const totalRecords = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const hasFilters =
    filters.status !== "" ||
    filters.category !== "" ||
    Boolean(filters.adminOnly) ||
    searchInput !== "";

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setPage(1);
  };

  // Interactive Metric Card Click
  function handleMetricClick(
    type: "EMPLOYEE_OPEN" | "IN_PROGRESS" | "ADMIN_SENT" | "RESOLVED_CLOSED",
  ) {
    setPage(1);
    if (type === "EMPLOYEE_OPEN") {
      if (filters.status === "OPEN" && !filters.adminOnly) {
        setFilters(EMPTY_FILTERS);
      } else {
        setFilters({ status: "OPEN", category: "", adminOnly: false });
      }
    } else if (type === "IN_PROGRESS") {
      if (filters.status === "IN_PROGRESS") {
        setFilters(EMPTY_FILTERS);
      } else {
        setFilters({ status: "IN_PROGRESS", category: "", adminOnly: false });
      }
    } else if (type === "ADMIN_SENT") {
      if (filters.adminOnly) {
        setFilters(EMPTY_FILTERS);
      } else {
        setFilters({ status: "", category: "", adminOnly: true });
      }
    } else if (type === "RESOLVED_CLOSED") {
      if (filters.status === "RESOLVED_CLOSED") {
        setFilters(EMPTY_FILTERS);
      } else {
        setFilters({ status: "RESOLVED_CLOSED", category: "", adminOnly: false });
      }
    }
  }

  // Fast Inline Reply & Status Update (Reference 4 Feature)
  async function handleInlineUpdate(ticket: TicketItem) {
    const replyText = (replyDrafts[ticket.id] || "").trim();
    const targetStatus = statusDrafts[ticket.id] || ticket.status;
    const isStatusChanged = targetStatus !== ticket.status;

    if (!replyText && !isStatusChanged) {
      toast({ title: "Nothing to update", description: "Write a reply or change the status.", variant: "warning" });
      return;
    }

    setSubmittingMap((prev) => ({ ...prev, [ticket.id]: true }));
    try {
      if (replyText) {
        await addCommentMutation.mutateAsync({ id: ticket.id, body: replyText });
      }
      if (isStatusChanged) {
        await setStatusMutation.mutateAsync({ id: ticket.id, status: targetStatus });
      }
      toast({ title: "Ticket updated successfully", variant: "success" });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update ticket";
      toast({ title: "Update failed", description: msg, variant: "error" });
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  // Export to Excel / CSV
  function handleExport() {
    if (allTickets.length === 0) {
      toast({ title: "No tickets to export", variant: "warning" });
      return;
    }
    const headers = [
      "Ticket ID",
      "Subject",
      "Category",
      "Status",
      "Employee Name",
      "Employee Code",
      "Raised By Admin",
      "Created At",
      "Resolved At",
    ];
    const rows = allTickets.map((t) => [
      formatTicketId(t.id),
      `"${(t.subject || "").replace(/"/g, '""')}"`,
      t.category,
      t.status,
      `"${(t.employee?.fullName || "").replace(/"/g, '""')}"`,
      employeeCodeMap.get(t.employee?.id) || "",
      t.raisedByAdmin ? "Yes" : "No",
      formatTicketDate(t.createdAt),
      t.resolvedAt ? formatTicketDate(t.resolvedAt) : "",
    ]);
    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `texaone_tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Tickets exported successfully", variant: "success" });
  }

  const activeTicket = useMemo(() => {
    if (detailId === null) return null;
    return allTickets.find((t) => t.id === detailId) ?? null;
  }, [detailId, allTickets]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the <code>hr.ticket.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header Banner with View Modes, Export & Primary Actions */}
      <HrPageHeader
        title="Employee Tickets"
        description="Raise a ticket and track the status of your employee service requests."
        icon={Ticket}
        badge={
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
            {metrics.employeeOpen} open · {metrics.total} total
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Segmented Controls */}
            <div className="flex items-center gap-1 rounded-xl bg-white/20 p-1 border border-white/30 backdrop-blur-xs">
              <button
                type="button"
                title="Feed View"
                aria-label="Feed View"
                onClick={() => setViewMode("feed")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "feed"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Feed</span>
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

            {/* My Tickets */}
            {canSelfService ? (
              <Button
                variant="secondary"
                onClick={() => router.push("/portal/tickets")}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-3.5 py-2 font-medium text-xs"
              >
                <span>My tickets</span>
              </Button>
            ) : null}

            {/* Raise Ticket Button */}
            {canWrite ? (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-xl">
                <Plus className="h-4 w-4" />
                <span>Create Ticket</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* 2. 4 Interactive Metric Cards (Reference 4 Layout) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Employee Open */}
        <button
          type="button"
          onClick={() => handleMetricClick("EMPLOYEE_OPEN")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "OPEN" && !filters.adminOnly
              ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
              : "border-gray-200/90 bg-white hover:border-brand-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {metrics.employeeOpen}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Employee Open
            </p>
          </div>
        </button>

        {/* Card 2: In Progress */}
        <button
          type="button"
          onClick={() => handleMetricClick("IN_PROGRESS")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "IN_PROGRESS"
              ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
              : "border-gray-200/90 bg-white hover:border-brand-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {metrics.inProgress}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              In Progress
            </p>
          </div>
        </button>

        {/* Card 3: Admin Sent (Active) */}
        <button
          type="button"
          onClick={() => handleMetricClick("ADMIN_SENT")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.adminOnly
              ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
              : "border-gray-200/90 bg-white hover:border-brand-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-cyan-700 dark:text-cyan-300">
              {metrics.adminSent}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Admin Sent (Active)
            </p>
          </div>
        </button>

        {/* Card 4: Resolved / Closed */}
        <button
          type="button"
          onClick={() => handleMetricClick("RESOLVED_CLOSED")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            filters.status === "RESOLVED_CLOSED"
              ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
              : "border-gray-200/90 bg-white hover:border-brand-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {metrics.resolvedClosed}
            </p>
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Resolved / Closed
            </p>
          </div>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            aria-label="Search tickets"
            placeholder="Search tickets by subject, description, or employee..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-9.5"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-48">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as Filters["status"],
                adminOnly: false,
              }));
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {/* Category Filter */}
        <div className="w-full sm:w-48">
          <Select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                category: e.target.value as "" | TicketCategory,
              }));
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
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

      {/* 4. Main Content Area */}
      {overviewQuery.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
      ) : overviewQuery.isError ? (
        <ErrorState onRetry={() => void overviewQuery.refetch()} />
      ) : paginatedTickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <EmptyState
            title={
              hasFilters ? "No tickets match these filters" : "No tickets yet"
            }
            description={
              hasFilters
                ? "Try adjusting your search terms or reset the filters."
                : "Support inquiries and service requests raised by employees will appear here."
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
              ) : canWrite ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Ticket
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* A. INTERACTIVE FEED VIEW (Reference 4 Highlight) */}
          {viewMode === "feed" && (
            <div className="flex flex-col gap-4">
              {/* Feed Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    TICKETS RAISED BY EMPLOYEES
                  </h3>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600 border border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800">
                    {filteredTickets.length} ACTIVE
                  </span>
                </div>
              </div>

              {/* Feed Cards Stack */}
              <div className="flex flex-col gap-3.5">
                {paginatedTickets.map((ticket) => {
                  const isSubmitting = Boolean(submittingMap[ticket.id]);
                  const currentDraftStatus =
                    statusDrafts[ticket.id] || ticket.status;

                  return (
                    <div
                      key={ticket.id}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200/90 bg-white p-4.5 shadow-xs hover:border-brand-300 hover:shadow-xs transition-all dark:border-gray-800 dark:bg-gray-dark"
                    >
                      {/* Top Row: Subject, Badges & Meta */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            onClick={() => setDetailId(ticket.id)}
                            className="font-bold text-base text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 cursor-pointer transition-colors"
                          >
                            {ticket.subject}
                          </h4>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold border ${getCategoryColor(ticket.category)}`}
                          >
                            {ticket.category}
                          </span>
                          <TicketStatusBadge status={ticket.status} />
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                            By{" "}
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              {ticket.employee.fullName}
                            </span>
                            {employeeCodeMap.get(ticket.employee.id) ? (
                              <span className="text-gray-400 ml-1">
                                ({employeeCodeMap.get(ticket.employee.id)})
                              </span>
                            ) : null}{" "}
                            · {formatTicketDate(ticket.createdAt)}
                          </span>

                          <button
                            type="button"
                            aria-label="View full ticket thread"
                            onClick={() => setDetailId(ticket.id)}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Description Box */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-theme-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 leading-relaxed">
                        {ticket.description}
                      </div>

                      {/* Inline Fast Reply & Status Transition (Reference 4 Feature) */}
                      <div className="pt-2 flex flex-col gap-2.5">
                        <textarea
                          rows={2}
                          placeholder="Type your reply (optional)..."
                          value={replyDrafts[ticket.id] || ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          disabled={isSubmitting}
                          className="w-full text-xs rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 resize-none"
                        />

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                              Status:
                            </span>
                            <div className="w-36">
                              <Select
                                className="h-8 py-1 text-xs"
                                aria-label="Change ticket status"
                                value={currentDraftStatus}
                                disabled={isSubmitting}
                                onChange={(e) =>
                                  setStatusDrafts((prev) => ({
                                    ...prev,
                                    [ticket.id]: e.target.value as TicketStatus,
                                  }))
                                }
                              >
                                {TICKET_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            loading={isSubmitting}
                            onClick={() => void handleInlineUpdate(ticket)}
                            className="gap-1.5 px-4 rounded-xl text-xs"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Send Reply</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* B. TABLE VIEW (Dense Tabular View) */}
          {viewMode === "table" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-dark">
              <DataTable
                caption="Employee Tickets"
                rows={paginatedTickets}
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
                    header: "Ticket ID",
                    cell: (t) => (
                      <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                        {formatTicketId(t.id)}
                      </span>
                    ),
                  },
                  {
                    header: "Subject",
                    cell: (t) => (
                      <span
                        onClick={() => setDetailId(t.id)}
                        className="font-semibold text-theme-sm text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 cursor-pointer"
                      >
                        {t.subject}
                      </span>
                    ),
                  },
                  {
                    header: "Category",
                    cell: (t) => (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold border ${getCategoryColor(t.category)}`}
                      >
                        {t.category}
                      </span>
                    ),
                  },
                  {
                    header: "Employee",
                    cell: (t) => (
                      <EmployeeIdentity
                        name={t.employee.fullName}
                        code={employeeCodeMap.get(t.employee.id)}
                        size="sm"
                      />
                    ),
                  },
                  {
                    header: "Created On",
                    cell: (t) => (
                      <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                        {formatTicketDate(t.createdAt)}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    cell: (t) => <TicketStatusBadge status={t.status} />,
                  },
                  {
                    header: "Actions",
                    cell: (t) => (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`View ticket ${formatTicketId(t.id)}`}
                          onClick={() => setDetailId(t.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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

      {/* 5. Modals */}
      {canWrite ? (
        <RaiseTicketDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      {detailId !== null ? (
        <TicketDetailDialog
          open={Boolean(detailId)}
          onClose={() => setDetailId(null)}
          ticketId={detailId}
          employeeCode={
            activeTicket
              ? employeeCodeMap.get(activeTicket.employee.id)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
