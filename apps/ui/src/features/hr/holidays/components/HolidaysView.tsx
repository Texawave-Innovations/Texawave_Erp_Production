"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  ErrorState,
  Pagination,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { StatCard } from "@/features/hr/components/StatCard";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
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

interface Filters {
  year: number;
  isActive: "" | "true" | "false";
}

function formatHolidayDate(dateStr: string) {
  if (!dateStr) return { formatted: "", weekday: "" };
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(date.getTime())) return { formatted: dateStr, weekday: "" };
  const formatted = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return { formatted, weekday };
}

export function HolidaysView() {
  const canRead = usePermission(READ);
  const canWrite = usePermission(WRITE);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    year: CURRENT_YEAR,
    isActive: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  // Main paginated query for table
  const query = useHolidays({
    page,
    limit: PAGE_SIZE,
    year: filters.year,
    ...(filters.isActive ? { isActive: filters.isActive === "true" } : {}),
  });

  // Comprehensive query for all holidays in the year to power StatCards accurately
  const allYearQuery = useHolidays({
    page: 1,
    limit: 100,
    year: filters.year,
  });

  const createMutation = useCreateHoliday();
  const updateMutation = useUpdateHoliday();
  const activeMutation = useSetHolidayActive();

  // Calculate accurate summary metrics
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

  const rowsWithIndex = useMemo(() => {
    return (query.data?.data ?? []).map((h, idx) => ({
      ...h,
      rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
    }));
  }, [query.data?.data, page]);

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

  const hasNonDefaultFilters =
    filters.year !== CURRENT_YEAR || filters.isActive !== "";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            Holidays
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Manage organization holidays and their applicability.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New holiday
          </Button>
        ) : null}
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          headingId="stat-total-holidays"
          label="Total holidays"
          value={stats.total}
          note={`For calendar year ${filters.year}`}
          tone="brand"
          icon={Calendar}
        />
        <StatCard
          headingId="stat-active-holidays"
          label="Active"
          value={stats.active}
          note="Applicable holidays"
          tone="success"
          icon={CheckCircle2}
        />
        <StatCard
          headingId="stat-upcoming-holidays"
          label="Upcoming"
          value={stats.upcoming}
          note="Remaining this year"
          tone="warning"
          icon={Clock}
        />
        <StatCard
          headingId="stat-deactivated-holidays"
          label="Deactivated"
          value={stats.deactivated}
          note="Disabled holidays"
          tone="neutral"
          icon={Ban}
        />
      </div>

      {/* Filter Toolbar */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by year"
              value={filters.year}
              onChange={(e) => update("year", Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by status"
              value={filters.isActive}
              onChange={(e) =>
                update("isActive", e.target.value as Filters["isActive"])
              }
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Deactivated</option>
            </Select>
          </div>
          {hasNonDefaultFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilters({ year: CURRENT_YEAR, isActive: "" });
                setPage(1);
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Holiday Table / Loading / Empty State */}
      {query.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={6} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to holidays">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-8 ring-amber-50/50 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-950/20">
            <CalendarDays className="h-8 w-8" />
          </div>
          <h3 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            No holidays defined
          </h3>
          <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
            {filters.isActive !== ""
              ? `No holidays match the selected status filter in ${filters.year}.`
              : `Add a holiday to mark non-working days for ${filters.year}.`}
          </p>
          {canWrite ? (
            <div className="mt-5">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New holiday
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <DataTable<Holiday & { rowNumber: number }>
            caption="Holidays"
            rows={rowsWithIndex}
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
                  const { formatted, weekday } = formatHolidayDate(
                    h.holidayDate,
                  );
                  return (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white/90">
                        {formatted}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {weekday}
                      </span>
                    </div>
                  );
                },
              },
              {
                header: "Holiday name",
                cell: (h) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {h.name}
                    </span>
                    {h.description ? (
                      <span
                        className="max-w-xs truncate text-[11px] text-gray-500 dark:text-gray-400"
                        title={h.description}
                      >
                        {h.description}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Applies to",
                cell: (h) => (
                  <div className="flex items-center gap-1.5 text-theme-sm text-gray-700 dark:text-gray-300">
                    <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-400 dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(h)}
                            aria-label={`${h.isActive ? "Deactivate" : "Activate"} ${h.name}`}
                            title={`${h.isActive ? "Deactivate" : "Activate"} ${h.name}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                              h.isActive
                                ? "border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/40"
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
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Centered Modals */}
      {canWrite ? (
        <>
          <Dialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="New holiday"
            size="lg"
          >
            <HolidayForm
              mode="create"
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              submitLabel="Create holiday"
            />
          </Dialog>

          <Dialog
            open={Boolean(editingHoliday)}
            onClose={() => setEditingHoliday(null)}
            title="Edit holiday"
            size="lg"
          >
            {editingHoliday ? (
              <HolidayForm
                mode="edit"
                initialValues={{
                  holidayDate: editingHoliday.holidayDate,
                  name: editingHoliday.name,
                  description: editingHoliday.description ?? "",
                  workLocationId: editingHoliday.workLocation
                    ? String(editingHoliday.workLocation.id)
                    : "",
                  isActive: editingHoliday.isActive ? "true" : "false",
                }}
                initialWorkLocationName={
                  editingHoliday.workLocation?.name ?? "Whole organization"
                }
                onSubmit={handleUpdate}
                onCancel={() => setEditingHoliday(null)}
                submitLabel="Update holiday"
              />
            ) : null}
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
