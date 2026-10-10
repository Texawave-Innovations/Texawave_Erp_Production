"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  Ticket,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue, useEmployees } from "@/features/hr/employees/hooks";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useTickets } from "../hooks";
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

interface Filters {
  status: "" | TicketStatus;
  category: "" | TicketCategory;
}

const EMPTY_FILTERS: Filters = { status: "", category: "" };

interface TableTicketRow extends TicketItem {
  rowNumber: number;
}

/**
 * HR Employee Tickets View:
 * Displays ticket overview metrics, search and filtering, enterprise ticket table,
 * empty states, and modals for raising tickets and viewing ticket details.
 */
export function TicketsView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const canSelfService = usePermission(SELF_SERVICE_READ);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const debouncedQ = useDebouncedValue(searchInput, 300);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Fetch employees for employee code mapping and default employee
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeOptions = useMemo(
    () => employeesQuery.data?.data ?? [],
    [employeesQuery.data?.data],
  );
  const firstEmployee = employeeOptions[0];
  const employeeCodeMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const emp of employeeOptions) {
      map.set(emp.id, emp.employeeCode);
    }
    return map;
  }, [employeeOptions]);

  // Comprehensive overview query to calculate summary metric cards accurately
  const overviewQuery = useTickets({ page: 1, limit: 100 }, canRead);

  const metrics = useMemo(() => {
    const allTickets = overviewQuery.data?.data ?? [];
    const total = overviewQuery.data?.meta.total ?? allTickets.length;
    const open = allTickets.filter((t) => t.status === "OPEN").length;
    const inProgress = allTickets.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const resolved = allTickets.filter((t) => t.status === "RESOLVED").length;
    return { total, open, inProgress, resolved };
  }, [overviewQuery.data]);

  // Active paginated query with debounced search and active filters
  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(debouncedQ ? { q: debouncedQ } : {}),
    }),
    [page, filters, debouncedQ],
  );

  const list = useTickets(query, canRead);

  const hasFilters =
    filters.status !== "" || filters.category !== "" || searchInput !== "";

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setPage(1);
  };

  const activeTicket = useMemo(() => {
    if (detailId === null || !list.data) return null;
    return list.data.data.find((t) => t.id === detailId) ?? null;
  }, [detailId, list.data]);

  const tableRows: TableTicketRow[] = useMemo(() => {
    if (!list.data?.data) return [];
    return list.data.data.map((item, idx) => ({
      ...item,
      rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
    }));
  }, [list.data, page]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the <code>hr.ticket.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Home</span>
            <span>/</span>
            <span>HR</span>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              Employee Tickets
            </span>
          </div>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            Employee Tickets
          </h1>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Raise a ticket and track the status of your requests.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Raise Ticket
            </Button>
          ) : null}
          {canSelfService ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/tickets")}
            >
              My tickets
            </Button>
          ) : null}
        </div>
      </div>

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Tickets */}
        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
              {metrics.total}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Total Tickets
            </p>
          </div>
        </div>

        {/* Open */}
        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-950/50 dark:text-warning-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
              {metrics.open}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Open
            </p>
          </div>
        </div>

        {/* In Progress */}
        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
              {metrics.inProgress}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              In Progress
            </p>
          </div>
        </div>

        {/* Resolved */}
        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/50 dark:text-success-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
              {metrics.resolved}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Resolved
            </p>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Search by subject or category */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="Search tickets"
                placeholder="Search by subject or category..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Status filter */}
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) =>
                  update("status", e.target.value as "" | TicketStatus)
                }
              >
                <option value="">All statuses</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>

            {/* Category filter */}
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by category"
                value={filters.category}
                onChange={(e) =>
                  update("category", e.target.value as "" | TicketCategory)
                }
              >
                <option value="">All categories</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Reset button */}
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasFilters}
            onClick={handleResetFilters}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 self-end lg:self-auto"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* 4. Table or Loading or Empty State */}
      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to tickets">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500 mb-4">
            <Inbox className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            {hasFilters ? "No tickets match these filters" : "No tickets yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            {hasFilters
              ? "Try a different status, category or search query, or reset the filters."
              : "Your support requests will appear here after you submit them."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {hasFilters ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            ) : canWrite ? (
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Raise Ticket
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable
            caption="Employee tickets"
            rows={tableRows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "#",
                cell: (r) => (
                  <span className="font-medium text-gray-500 dark:text-gray-400">
                    {r.rowNumber}
                  </span>
                ),
                className: "w-12 text-center",
                headerClassName: "w-12 text-center",
              },
              {
                header: "Ticket ID",
                cell: (r) => (
                  <span className="font-mono text-theme-xs font-semibold text-gray-800 dark:text-gray-200">
                    {formatTicketId(r.id, r.createdAt)}
                  </span>
                ),
              },
              {
                header: "Subject",
                cell: (r) => (
                  <span className="font-medium text-gray-900 dark:text-white/90 line-clamp-1 max-w-xs">
                    {r.subject}
                  </span>
                ),
              },
              {
                header: "Category",
                cell: (r) => (
                  <span className="text-gray-700 dark:text-gray-300">
                    {r.category}
                  </span>
                ),
              },
              {
                header: "Created On",
                cell: (r) => (
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {formatTicketDate(r.createdAt)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (r) => <TicketStatusBadge status={r.status} />,
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailId(r.id)}
                      aria-label={`View ticket ${formatTicketId(r.id, r.createdAt)}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                ),
                className: "w-20 text-center",
                headerClassName: "w-20 text-center",
              },
            ]}
          />

          {/* Table Footer with record count & pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-1">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, list.data.meta.total)} of{" "}
              {list.data.meta.total} records
            </p>
            <Pagination
              page={list.data.meta.page}
              totalPages={list.data.meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* 5. Centered Raise Ticket Modal (Panel 3) */}
      <RaiseTicketDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          void list.refetch();
          void overviewQuery.refetch();
        }}
        defaultEmployeeId={firstEmployee?.id}
        defaultEmployeeCode={firstEmployee?.employeeCode}
      />

      {/* 6. Centered View Ticket Details Modal (Panel 4) */}
      {detailId !== null ? (
        <TicketDetailDialog
          open
          ticketId={detailId}
          onClose={() => setDetailId(null)}
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
