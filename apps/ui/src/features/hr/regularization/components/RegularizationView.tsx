"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  Pagination,
  SearchInput,
  Select,
  TableSkeleton,
  cn,
  type FilterChipItem,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import { formatTime } from "@/features/hr/attendance/status";
import { useCorrections } from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
} from "../permissions";
import { CORRECTION_TYPE_LABELS, STATUS_LABELS } from "../status";
import {
  CORRECTION_STATUSES,
  type AttendanceCorrectionItem,
  type CorrectionStatus,
} from "../types";
import { CorrectionStatusBadge } from "./CorrectionStatusBadge";
import { DecideCorrectionDialog } from "./DecideCorrectionDialog";
import { RegularizationCard } from "./RegularizationCard";
import { SubmitCorrectionDialog } from "./SubmitCorrectionDialog";

const PAGE_SIZE = 20;

interface Filters {
  status: "" | CorrectionStatus;
  employeeId: string;
}

const EMPTY_FILTERS: Filters = { status: "", employeeId: "" };

type Decision = {
  correction: AttendanceCorrectionItem;
  decision: "approve" | "reject";
} | null;

/**
 * Attendance corrections ("Regularization"):
 * - Modern executive feed with card view (default) and table view toggle.
 * - Summary KPI tiles for Pending, Approved, Rejected, Total.
 * - Quick one-click approval actions for authorized HR managers.
 * - Pure Nunito Sans typography (zero font-mono).
 */
export function RegularizationView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const canCreate = usePermission(SELF_SERVICE_CREATE);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const employeeIdNum = Number(filters.employeeId);
  const hasValidEmployeeId =
    filters.employeeId !== "" &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0;

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(hasValidEmployeeId ? { employeeId: employeeIdNum } : {}),
  };

  const list = useCorrections(query);
  const hasFilters =
    filters.status !== "" || filters.employeeId !== "" || search.trim() !== "";

  // Summary Metrics from server data
  const metrics = useMemo(() => {
    if (!list.data) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    const items = list.data.data;
    const total = list.data.meta.total;
    const pending = items.filter((c) => c.status === "SUBMITTED").length;
    const approved = items.filter((c) => c.status === "APPROVED").length;
    const rejected = items.filter((c) => c.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [list.data]);

  // Client-side text search across employee name, code, date, reason and type
  const displayedItems = useMemo(() => {
    if (!list.data?.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return list.data.data;
    return list.data.data.filter((c) => {
      const name = c.employee.fullName.toLowerCase();
      const code = c.employee.employeeCode.toLowerCase();
      const date = c.attendanceDate.toLowerCase();
      const reason = c.reason.toLowerCase();
      const type = (
        CORRECTION_TYPE_LABELS[c.correctionType] || ""
      ).toLowerCase();
      const decider = (c.decidedBy?.fullName || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        date.includes(q) ||
        reason.includes(q) ||
        type.includes(q) ||
        decider.includes(q)
      );
    });
  }, [list.data, search]);

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABELS[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    if (filters.employeeId) {
      chips.push({
        id: "employeeId",
        label: "Employee ID",
        value: `#${filters.employeeId}`,
        onRemove: () => update("employeeId", ""),
      });
    }
    if (search.trim()) {
      chips.push({
        id: "search",
        label: "Search",
        value: `"${search.trim()}"`,
        onRemove: () => setSearch(""),
      });
    }
    return chips;
  }, [filters, search]);

  function handleResetFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  }

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to attendance corrections"
      >
        Ask an administrator for the <code>hr.attendance_correction.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Page Header */}
      <HrPageHeader
        title="Regularization"
        description="Review and manage employee attendance correction and regularizations."
        icon={CalendarCheck}
        badge={
          list.data ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3.5 py-1 text-xs font-bold text-white shadow-xs">
              {metrics.pending > 0
                ? `${metrics.pending} Pending ${metrics.pending === 1 ? "Request" : "Requests"}`
                : `${metrics.total} Total Requests`}
            </span>
          ) : null
        }
        action={
          canCreate ? (
            <Button
              onClick={() => setSubmitOpen(true)}
              className="gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Request a correction</span>
            </Button>
          ) : null
        }
      />

      {/* 2. Executive Presence KPI Tiles */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Total Requests */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
              Total Requests
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-[#0a3271] dark:text-white">
              {metrics.total}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              In your viewing scope
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <CalendarCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Pending Approval */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fef3c7] p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Pending Approval
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
              {metrics.pending}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Needs manager review
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Approved */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Approved
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-white">
              {metrics.approved}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Punches regularized
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Rejected */}
        <div className="flex items-center justify-between rounded-2xl border border-rose-200/80 bg-linear-to-r from-[#fff1f2] to-[#fff5f5] p-4 shadow-xs dark:border-rose-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Rejected
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-rose-800 dark:text-white">
              {metrics.rejected}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Disapproved requests
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/80 bg-white text-rose-600 shadow-xs dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Executive Integrated Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search and filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr] flex-1">
              <SearchInput
                placeholder="Search by name, date, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                className="w-full"
              />

              <Select
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) =>
                  update("status", e.target.value as "" | CorrectionStatus)
                }
              >
                <option value="">All Status</option>
                {CORRECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "SUBMITTED" ? "Pending" : STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>

            {/* View Mode Toggle and Reset */}
            <div className="flex items-center gap-2 self-end lg:self-center">
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-theme-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </Button>
              )}

              {/* Cards vs Table View Toggle */}
              <div className="flex items-center rounded-xl border border-sky-100/90 bg-sky-50/50 p-1 dark:border-sky-900/40 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer",
                    viewMode === "cards"
                      ? "bg-white text-brand-500 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
                  )}
                  title="Card Feed View"
                  aria-label="Card Feed View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer",
                    viewMode === "table"
                      ? "bg-white text-brand-500 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
                  )}
                  title="Table View"
                  aria-label="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <FilterChips
              chips={activeChips}
              onClearAll={handleResetFilters}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          )}
        </div>
      </div>

      {/* 4. Content Area: Requests Feed / Table */}
      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to attendance corrections"
          >
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : displayedItems.length === 0 ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title={
              hasFilters
                ? "No requests match these filters"
                : "No regularization requests yet"
            }
            description={
              hasFilters
                ? "Try searching for a different name, date, or reset your filters."
                : canCreate
                  ? "Click 'Request a correction' above to submit your first request."
                  : "Attendance regularization requests you are allowed to see will appear here."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View - Exact match to Reference Image Feed */
        <div className="flex flex-col gap-3.5">
          {displayedItems.map((correction) => (
            <RegularizationCard
              key={correction.id}
              correction={correction}
              canApprove={canApprove}
              onApprove={(c) =>
                setDecision({ correction: c, decision: "approve" })
              }
              onReject={(c) =>
                setDecision({ correction: c, decision: "reject" })
              }
            />
          ))}

          {list.data && list.data.meta.totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={list.data.meta.page}
                totalPages={list.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <>
          <DataTable
            caption="Attendance corrections"
            rows={displayedItems}
            getRowKey={(c) => String(c.id)}
            columns={[
              {
                header: "Employee",
                cell: (c) => (
                  <EmployeeIdentity
                    name={c.employee.fullName}
                    code={c.employee.employeeCode}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Date",
                cell: (c) => (
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-theme-xs">
                    {c.attendanceDate}
                  </span>
                ),
              },
              {
                header: "Type",
                cell: (c) => {
                  const hasIn = Boolean(c.requestedCheckInAt);
                  const hasOut = Boolean(c.requestedCheckOutAt);
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-900 dark:text-white text-theme-xs">
                        {CORRECTION_TYPE_LABELS[c.correctionType]}
                      </span>
                      {hasIn || hasOut ? (
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] text-brand-600 dark:text-sky-400">
                          <Clock className="h-3 w-3 text-brand-500 shrink-0" />
                          <span>
                            {hasIn
                              ? `In: ${formatTime(c.requestedCheckInAt!)}`
                              : ""}
                            {hasIn && hasOut ? " • " : ""}
                            {hasOut
                              ? `Out: ${formatTime(c.requestedCheckOutAt!)}`
                              : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                header: "Reason",
                cell: (c) => (
                  <span
                    title={c.reason}
                    className="block max-w-xs truncate text-theme-xs text-gray-600 dark:text-gray-300"
                  >
                    {c.reason}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (c) => <CorrectionStatusBadge status={c.status} />,
              },
              {
                header: "Decided by",
                cell: (c) => (
                  <div className="flex flex-col">
                    <span className="text-theme-xs text-gray-800 dark:text-gray-200 font-medium">
                      {c.decidedBy?.fullName ?? "—"}
                    </span>
                    {c.decisionNote ? (
                      <span
                        title={c.decisionNote}
                        className="text-[11px] text-gray-400 truncate max-w-36 italic"
                      >
                        &ldquo;{c.decisionNote}&rdquo;
                      </span>
                    ) : null}
                  </div>
                ),
              },
              ...(canApprove
                ? [
                    {
                      header: "Actions",
                      cell: (c: AttendanceCorrectionItem) =>
                        c.status === "SUBMITTED" ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({
                                  correction: c,
                                  decision: "approve",
                                })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({
                                  correction: c,
                                  decision: "reject",
                                })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        ),
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

      {/* 5. Modals */}
      {submitOpen ? (
        <SubmitCorrectionDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}

      {decision ? (
        <DecideCorrectionDialog
          open
          onClose={() => setDecision(null)}
          correction={decision.correction}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}
