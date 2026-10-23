"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  LayoutGrid,
  List,
  Search,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DatePicker,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  StatusBadge,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useFullMonthPresentList } from "../hooks";
import { READ_ANY_SCOPE } from "../permissions";
import { currentMonth } from "../status";
import type { FullMonthPresentRow } from "../types";
import { FullMonthPresentDetailDialog } from "./FullMonthPresentDetailDialog";

const PAGE_SIZE = 24;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, delta: number): string {
  const parts = month.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function formatMonthLabel(month: string): string {
  if (!MONTH_PATTERN.test(month)) return month;
  const parts = month.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Full Month Present: for a chosen calendar month, every active employee in
 * the caller's own/team/all scope with a per-day derived status and whether
 * every working day of the month was PRESENT.
 */
export function FullMonthPresentView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState<string>(currentMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "QUALIFIED" | "NOT_QUALIFIED"
  >("ALL");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [detailRow, setDetailRow] = useState<FullMonthPresentRow | null>(null);

  const monthValid = MONTH_PATTERN.test(month);
  const query = {
    page,
    limit: PAGE_SIZE,
    month,
  };

  const list = useFullMonthPresentList(query);
  const rows = list.data?.data ?? [];

  const qualifiedCount = useMemo(
    () => rows.filter((r) => r.fullMonthPresent).length,
    [rows],
  );
  const notQualifiedCount = rows.length - qualifiedCount;
  const qualifiedPct =
    rows.length > 0 ? Math.round((qualifiedCount / rows.length) * 100) : 0;

  // Search & Filter
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = r.employee.fullName.toLowerCase().includes(q);
        const codeMatch = r.employee.employeeCode.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch) return false;
      }
      if (statusFilter === "QUALIFIED" && !r.fullMonthPresent) return false;
      if (statusFilter === "NOT_QUALIFIED" && r.fullMonthPresent) return false;
      return true;
    });
  }, [rows, searchQuery, statusFilter]);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Full Month Present"
      >
        Ask an administrator for the <code>hr.attendance_report.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <HrPageHeader
        title="Full Month Present"
        description="Review monthly attendance streaks, 100% full-month qualifications, and attendance awards."
        icon={Award}
        badge={
          list.data ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
              {list.data.meta.total} in scope
            </span>
          ) : null
        }
        action={
          <span className="rounded-full bg-white/20 backdrop-blur-xs px-3.5 py-1.5 text-xs font-semibold text-white">
            {qualifiedCount} qualified ({qualifiedPct}%)
          </span>
        }
      />

      {/* 3 Executive KPI Summary Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Qualified */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              100% Full Month Present
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h3 className="text-2xl font-extrabold text-emerald-900 dark:text-white">
                {qualifiedCount}
              </h3>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                ({qualifiedPct}%)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Zero absent or unmarked days
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        {/* Not Qualified */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-50 to-slate-100/70 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Not Qualified / Incomplete
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {notQualifiedCount}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Absences, leaves, or partial streaks
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-300/80 bg-white text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <XCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Total In Scope */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#f0f9ff] to-[#e0f2fe] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Employees in Review
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-sky-900 dark:text-white">
              {rows.length}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              For {formatMonthLabel(month)}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Executive Control Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          {/* Left: Month Navigator & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigator */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Previous month"
                onClick={() => {
                  setMonth((m) => shiftMonth(m, -1));
                  setPage(1);
                }}
                className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="relative min-w-52.5">
                <DatePicker
                  mode="month"
                  value={month}
                  onChangeDate={(newVal) => {
                    if (newVal) {
                      setMonth(newVal);
                      setPage(1);
                    }
                  }}
                  clearable={false}
                  sizeVariant="md"
                  className="w-full"
                  inputClassName="font-bold text-slate-800 dark:text-white"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Next month"
                onClick={() => {
                  setMonth((m) => shiftMonth(m, 1));
                  setPage(1);
                }}
                className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Employee Search Input */}
            <div className="relative min-w-55">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search employee or code…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Status Filters & View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Qualification Filter */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("QUALIFIED")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "QUALIFIED"
                    ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Qualified ({qualifiedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("NOT_QUALIFIED")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "NOT_QUALIFIED"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Not Qualified ({notQualifiedCount})
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                aria-label="Cards view"
                onClick={() => setViewMode("card")}
                className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                  viewMode === "card"
                    ? "bg-white text-brand-500 shadow-2xs dark:bg-slate-700 dark:text-sky-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Table view"
                onClick={() => setViewMode("table")}
                className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-brand-500 shadow-2xs dark:bg-slate-700 dark:text-sky-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content & States */}
      {!monthValid ? (
        <Alert variant="warning" title="Invalid month">
          Choose a calendar month in YYYY-MM format.
        </Alert>
      ) : list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to Full Month Present"
          >
            Your access to this report has changed. Contact an administrator.
          </Alert>
        ) : list.error instanceof ApiError && list.error.isValidationError ? (
          <Alert variant="warning" title="Invalid filters">
            {list.error.message}
          </Alert>
        ) : list.error instanceof ApiError && list.error.isNotFound ? (
          <Alert variant="warning" title="Not found">
            {list.error.message}
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title="No employees match your filter"
            description="Try searching for another employee name or switch qualification status."
            action={
              searchQuery || statusFilter !== "ALL" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : viewMode === "card" ? (
        /* Executive Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredRows.map((r) => {
            const countedDays = Math.max(r.days.length, 1);
            const presentPercentage = Math.round(
              (r.presentDays / countedDays) * 100,
            );
            const absentDays = r.countsByStatus.ABSENT ?? 0;
            const halfDays = r.countsByStatus.HALF_DAY ?? 0;

            return (
              <div
                key={`${r.employee.id}-${r.month}`}
                className="group flex flex-col justify-between rounded-2xl border border-sky-100/90 bg-white/95 p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-sky-200 dark:border-sky-950/40 dark:bg-gray-900/90"
              >
                <div>
                  {/* Top: Identity & Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <EmployeeIdentity
                      name={r.employee.fullName}
                      code={r.employee.employeeCode}
                      avatarSize="md"
                      size="md"
                    />

                    {r.fullMonthPresent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                        <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        100% Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                        <XCircle className="h-3 w-3 text-slate-400" />
                        Not Qualified
                      </span>
                    )}
                  </div>

                  {/* Attendance Streak Progress Bar */}
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-300">
                        Present Streak
                      </span>
                      <span
                        className={
                          r.fullMonthPresent
                            ? "text-emerald-700 dark:text-emerald-300 font-bold"
                            : "text-slate-800 dark:text-white"
                        }
                      >
                        {r.presentDays} / {r.days.length} days ({presentPercentage}
                        %)
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          r.fullMonthPresent
                            ? "bg-emerald-500"
                            : presentPercentage >= 80
                              ? "-brand-500"
                              : presentPercentage >= 50
                                ? "bg-amber-500"
                                : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(presentPercentage, 100)}%` }}
                      />
                    </div>

                    {/* Breakdown micro-stats */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Absent: {absentDays}</span>
                      <span>Half days: {halfDays}</span>
                      <span>
                        Off/Hol:{" "}
                        {(r.countsByStatus.WEEKLY_OFF ?? 0) +
                          (r.countsByStatus.HOLIDAY ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Eligibility criteria badges */}
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                        r.monthComplete
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {r.monthComplete ? "Month Complete" : "In Progress"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                        r.employedWholeMonth
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {r.employedWholeMonth ? "Whole Month" : "Partial Month"}
                    </span>
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailRow(r)}
                    className="w-full text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 hover:border-slate-300"
                  >
                    View Details & Calendar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Executive Data Table */
        <>
          <DataTable
            caption="Full Month Present"
            rows={filteredRows}
            getRowKey={(r) => `${r.employee.id}-${r.month}`}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Present Days",
                cell: (r) => {
                  const countedDays = Math.max(r.days.length, 1);
                  const pct = Math.round((r.presentDays / countedDays) * 100);
                  return (
                    <div className="flex flex-col gap-1 min-w-30">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>{r.presentDays} days</span>
                        <span className="text-[11px] text-slate-500">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.fullMonthPresent
                              ? "bg-emerald-500"
                              : "-brand-500"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              },
              {
                header: "Month Complete",
                cell: (r) => (
                  <StatusBadge
                    label={r.monthComplete ? "Yes" : "No"}
                    colorToken={r.monthComplete ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Employed Whole Month",
                cell: (r) => (
                  <StatusBadge
                    label={r.employedWholeMonth ? "Yes" : "No"}
                    colorToken={r.employedWholeMonth ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Full Month Present",
                cell: (r) =>
                  r.fullMonthPresent ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-theme-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-theme-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      <XCircle className="h-3.5 w-3.5 text-gray-400" />
                      No
                    </span>
                  ),
              },
              {
                header: "Actions",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailRow(r)}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Details
                  </Button>
                ),
              },
            ]}
          />

          <Pagination
            page={list.data?.meta.page ?? 1}
            totalPages={list.data?.meta.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      {detailRow ? (
        <FullMonthPresentDetailDialog
          open
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      ) : null}
    </div>
  );
}
