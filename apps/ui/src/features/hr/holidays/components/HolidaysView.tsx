"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { ApiError, formatDate } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DatePicker,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import {
  useCreateHoliday,
  useHolidays,
  useSetHolidayActive,
  useUpdateHoliday,
} from "../hooks";
import { READ, WRITE } from "../permissions";
import type { Holiday } from "../types";
import type { HolidayFormSubmitValues } from "./HolidayForm";
import { HolidayForm } from "./HolidayForm";

const PAGE_SIZE = 10;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const parts = monthStr.split("-").map(Number);
  const y = parts[0] ?? CURRENT_YEAR;
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = pad(d.getUTCMonth() + 1);
  return `${ny}-${nm}`;
}

function formatMonthLabel(monthStr: string): string {
  const parts = monthStr.split("-").map(Number);
  const y = parts[0] ?? CURRENT_YEAR;
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatHolidayDate(dateStr: string) {
  if (!dateStr)
    return { formatted: "", weekday: "", dayNumber: "", monthName: "" };
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(date.getTime())) {
    return { formatted: dateStr, weekday: "", dayNumber: "", monthName: "" };
  }
  const formatted = formatDate(date) || dateStr;
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const dayNumber = date.toLocaleDateString("en-US", {
    day: "2-digit",
    timeZone: "UTC",
  });
  const monthName = date.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return { formatted, weekday, dayNumber, monthName };
}

export function HolidaysView() {
  const canRead = usePermission(READ);
  const canWrite = usePermission(WRITE);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [periodMode, setPeriodMode] = useState<"year" | "month">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "DEACTIVATED"
  >("ALL");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  // Derive target year based on periodMode
  const activeYear = useMemo(() => {
    if (periodMode === "month") {
      const parts = selectedMonth.split("-").map(Number);
      return parts[0] ?? selectedYear;
    }
    return selectedYear;
  }, [periodMode, selectedMonth, selectedYear]);

  // Comprehensive query for all holidays in active year to allow instant filtering
  const allYearQuery = useHolidays({
    page: 1,
    limit: 100,
    year: activeYear,
  });

  const createMutation = useCreateHoliday();
  const updateMutation = useUpdateHoliday();
  const activeMutation = useSetHolidayActive();

  // Calculate annual summary metrics
  const stats = useMemo(() => {
    const list = allYearQuery.data?.data ?? [];
    const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

    const total = allYearQuery.data?.meta.total ?? list.length;
    const active = list.filter((h) => h.isActive).length;
    const upcoming = list.filter(
      (h) => h.isActive && h.holidayDate >= todayStr,
    ).length;
    const deactivated = list.filter((h) => !h.isActive).length;

    return { total, active, upcoming, deactivated };
  }, [allYearQuery.data]);

  // Filter holidays based on periodMode (Year vs Month), search query, and status
  const filteredHolidays = useMemo(() => {
    const list = allYearQuery.data?.data ?? [];
    return list.filter((h) => {
      // Month filter
      if (periodMode === "month") {
        if (!h.holidayDate.startsWith(selectedMonth)) return false;
      }
      // Status filter
      if (statusFilter === "ACTIVE" && !h.isActive) return false;
      if (statusFilter === "DEACTIVATED" && h.isActive) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = h.name.toLowerCase().includes(q);
        const descMatch = (h.description ?? "").toLowerCase().includes(q);
        const locMatch = (h.workLocation?.name ?? "").toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !locMatch) return false;
      }
      return true;
    });
  }, [allYearQuery.data, periodMode, selectedMonth, statusFilter, searchQuery]);

  // Paginated subset of filtered holidays
  const totalPages = Math.ceil(filteredHolidays.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredHolidays.slice(start, start + PAGE_SIZE).map((h, idx) => ({
      ...h,
      rowNumber: start + idx + 1,
    }));
  }, [filteredHolidays, page]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to holidays">
        Ask an administrator for the <code>hr.holiday.read</code> permission.
      </Alert>
    );
  }

  async function handleCreate(values: HolidayFormSubmitValues) {
    await createMutation.mutateAsync({
      holidayDate: values.holidayDate,
      name: values.name,
      ...(values.description ? { description: values.description } : {}),
      ...(values.workLocationId
        ? { workLocationId: values.workLocationId }
        : {}),
    });
    setCreateOpen(false);
    toast({ title: "Holiday created", variant: "success" });
  }

  async function handleUpdate(values: HolidayFormSubmitValues) {
    if (!editingHoliday) return;

    if (
      values.isActive !== undefined &&
      values.isActive !== editingHoliday.isActive
    ) {
      await activeMutation.mutateAsync({
        id: editingHoliday.id,
        isActive: values.isActive,
      });
    }

    await updateMutation.mutateAsync({
      id: editingHoliday.id,
      body: { name: values.name, description: values.description ?? "" },
    });

    setEditingHoliday(null);
    toast({ title: "Holiday updated", variant: "success" });
  }

  async function handleToggleActive(holiday: Holiday) {
    const nextActive = !holiday.isActive;
    try {
      await activeMutation.mutateAsync({
        id: holiday.id,
        isActive: nextActive,
      });
      toast({
        title: `${nextActive ? "Activated" : "Deactivated"} "${holiday.name}"`,
        variant: "success",
      });
    } catch {
      toast({
        title: `Could not update "${holiday.name}"`,
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <HrPageHeader
        title="Holidays Management"
        description="Company annual holiday calendar & observances • Sundays are auto-applied as weekly off."
        icon={CalendarDays}
        badge={
          <span className="rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
            Year {activeYear} ({stats.total} holidays)
          </span>
        }
        action={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>New holiday</span>
            </Button>
          ) : null
        }
      />

      {/* 4 Executive Summary KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Holidays */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#f0f9ff] to-[#e0f2fe] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Total Holidays
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-sky-900 dark:text-white">
              {stats.total}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              For calendar year {activeYear}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Active Holidays */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Active Holidays
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-emerald-900 dark:text-white">
              {stats.active}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Applicable working day off
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Upcoming Holidays */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fef3c7] p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Upcoming
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
              {stats.upcoming}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Remaining this year
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Deactivated Holidays */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-50 to-slate-100/70 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Deactivated
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {stats.deactivated}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Disabled holidays
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-300/80 bg-white text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <Ban className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Executive Control Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          {/* Left: View Mode (Month vs Whole Year) + Month/Year Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  setPeriodMode("month");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  periodMode === "month"
                    ? "bg-white text-brand-500 shadow-2xs dark:bg-slate-700 dark:text-sky-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Month View
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodMode("year");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  periodMode === "year"
                    ? "bg-white text-brand-500 shadow-2xs dark:bg-slate-700 dark:text-sky-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Whole Year
              </button>
            </div>

            {/* If Month View: Render Month Picker with Prev/Next buttons */}
            {periodMode === "month" ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Previous month"
                  onClick={() => {
                    setSelectedMonth((m) => shiftMonth(m, -1));
                    setPage(1);
                  }}
                  className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="relative min-w-50">
                  <DatePicker
                    mode="month"
                    value={selectedMonth}
                    onChangeDate={(newVal) => {
                      if (newVal) {
                        setSelectedMonth(newVal);
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
                    setSelectedMonth((m) => shiftMonth(m, 1));
                    setPage(1);
                  }}
                  className="h-10 w-10 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              /* If Year View: Render Year Dropdown */
              <div className="w-36">
                <Select
                  aria-label="Filter by year"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Holiday Search Input */}
            <div className="relative min-w-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search holiday name…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
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

          {/* Right: Status Filter Chips & View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Pills */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ACTIVE");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("DEACTIVATED");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  statusFilter === "DEACTIVATED"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Deactivated
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
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
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {allYearQuery.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={6} />
      ) : allYearQuery.isError ? (
        allYearQuery.error instanceof ApiError &&
        allYearQuery.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to holidays">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void allYearQuery.refetch()} />
        )
      ) : filteredHolidays.length === 0 ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 text-center shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title={
              periodMode === "month"
                ? `No holidays in ${formatMonthLabel(selectedMonth)}`
                : `No holidays found for ${activeYear}`
            }
            description={
              searchQuery || statusFilter !== "ALL"
                ? "Try searching for a different keyword or resetting your status filter."
                : "Add a holiday to mark non-working days for this period."
            }
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
              ) : canWrite ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New holiday
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : viewMode === "table" ? (
        /* Reference-Matching Table View with Separate Date & Day Columns */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-500" />
              <span>
                {periodMode === "month"
                  ? `Holidays in ${formatMonthLabel(selectedMonth)}`
                  : `Holidays in ${activeYear}`}
              </span>
              <span className="text-theme-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-brand-500 dark:bg-sky-950/50 dark:text-sky-300">
                {filteredHolidays.length}
              </span>
            </h3>
          </div>

          <DataTable<Holiday & { rowNumber: number }>
            caption="Holidays list"
            rows={paginatedRows}
            getRowKey={(h) => String(h.id)}
            columns={[
              {
                header: "#",
                className: "w-12 text-gray-400 dark:text-gray-500",
                cell: (h) => h.rowNumber,
              },
              {
                header: "Date",
                cell: (h) => {
                  const { formatted } = formatHolidayDate(h.holidayDate);
                  return (
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatted}
                    </span>
                  );
                },
              },
              {
                header: "Day",
                cell: (h) => {
                  const { weekday } = formatHolidayDate(h.holidayDate);
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {weekday}
                    </span>
                  );
                },
              },
              {
                header: "Holiday Name",
                cell: (h) => (
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {h.name}
                    </span>
                    {h.description ? (
                      <span
                        className="max-w-xs truncate text-[11px] text-gray-500 dark:text-gray-400 mt-0.5"
                        title={h.description}
                      >
                        {h.description}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Applied To",
                cell: (h) => (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-slate-50/60 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{h.workLocation?.name ?? "Whole organization"}</span>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (h) => (
                  <StatusBadge
                    label={h.isActive ? "Active" : "Deactivated"}
                    colorToken={h.isActive ? "success" : "gray"}
                  />
                ),
              },
              ...(canWrite
                ? [
                    {
                      header: "Actions",
                      className: "text-right",
                      cell: (h: Holiday) => (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingHoliday(h)}
                            aria-label={`Edit ${h.name}`}
                            title={`Edit ${h.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-brand-500 hover:bg-sky-50 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-sky-400 dark:hover:bg-slate-700 dark:hover:text-sky-300 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(h)}
                            aria-label={`${h.isActive ? "Deactivate" : "Activate"} ${h.name}`}
                            title={`${h.isActive ? "Deactivate" : "Activate"} ${h.name}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer ${
                              h.isActive
                                ? "border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-gray-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                : "border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            {h.isActive ? (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <CheckCircle2
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      ) : (
        /* Holiday Cards Grid View */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {paginatedRows.map((h) => {
              const { dayNumber, monthName, weekday, formatted } =
                formatHolidayDate(h.holidayDate);

              return (
                <div
                  key={h.id}
                  className="group flex flex-col justify-between rounded-2xl border border-sky-100/90 bg-white/95 p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-sky-200 dark:border-sky-950/40 dark:bg-gray-900/90"
                >
                  <div>
                    {/* Top Row: Weekday pill & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-brand-500 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                        {weekday}
                      </span>
                      <StatusBadge
                        label={h.isActive ? "Active" : "Deactivated"}
                        colorToken={h.isActive ? "success" : "gray"}
                      />
                    </div>

                    {/* Middle: Date Squircle + Title & Description */}
                    <div className="mt-3.5 flex items-start gap-3.5">
                      <div className="flex h-13 w-13 shrink-0 flex-col items-center justify-center rounded-2xl border border-sky-200/90 bg-linear-to-b from-sky-50 to-white text-center shadow-2xs dark:border-sky-900/60 dark:from-slate-800 dark:to-slate-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          {monthName}
                        </span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                          {dayNumber}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <h4 className="font-bold text-slate-900 dark:text-white text-theme-sm">
                          {h.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatted}
                        </p>
                        {h.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                            {h.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Location Badge */}
                    <div className="mt-3.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {h.workLocation?.name ?? "Whole organization"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  {canWrite && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingHoliday(h)}
                        className="text-xs font-semibold text-brand-500 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleToggleActive(h)}
                        className={`text-xs font-semibold flex items-center gap-1.5 ${
                          h.isActive
                            ? "text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {h.isActive ? (
                          <>
                            <Trash2 className="h-3.5 w-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Bottom Informational Policy Card (Matching Reference UX) */}
      <div className="rounded-2xl border border-sky-100/90 bg-linear-to-r from-sky-50/70 via-blue-50/30 to-slate-50/50 p-4.5 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-500 shadow-2xs border border-sky-200/80 dark:bg-slate-800 dark:border-sky-800 dark:text-sky-300">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-theme-sm font-bold text-slate-900 dark:text-white">
              Sundays & Weekly Offs are Auto-Applied
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All recurring Sundays (and employee shift weekly offs) are
              automatically recognized as non-working days in employee
              attendance and payroll calculations. You do not need to manually
              add recurring weekly offs here; only add national, festival, or
              regional public holidays.
            </p>
          </div>
        </div>
      </div>

      {/* Centered Modals */}
      {canWrite ? (
        <>
          <Dialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="New holiday"
            size="md"
          >
            <HolidayForm
              mode="create"
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              submitLabel="Create holiday"
            />
          </Dialog>

          {editingHoliday ? (
            <Dialog
              open={Boolean(editingHoliday)}
              onClose={() => setEditingHoliday(null)}
              title={`Edit: ${editingHoliday.name}`}
              size="md"
            >
              <HolidayForm
                mode="edit"
                initialValues={{
                  holidayDate: editingHoliday.holidayDate,
                  name: editingHoliday.name,
                  description: editingHoliday.description ?? "",
                  isActive: editingHoliday.isActive ? "true" : "false",
                }}
                initialWorkLocationName={
                  editingHoliday.workLocation?.name ?? "Whole organization"
                }
                onSubmit={handleUpdate}
                onCancel={() => setEditingHoliday(null)}
                submitLabel="Save changes"
              />
            </Dialog>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
