"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
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

const PAGE_SIZE = 20;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i);

interface Filters {
  year: number;
  isActive: "" | "true" | "false";
}

export function HolidaysView() {
  const canRead = usePermission(READ);
  const canWrite = usePermission(WRITE);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    year: CURRENT_YEAR,
    isActive: "true",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const query = useHolidays({
    page,
    limit: PAGE_SIZE,
    year: filters.year,
    ...(filters.isActive ? { isActive: filters.isActive === "true" } : {}),
  });
  const createMutation = useCreateHoliday();
  const updateMutation = useUpdateHoliday();
  const activeMutation = useSetHolidayActive();

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            Holidays
          </h1>
          {query.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {query.data.meta.total} holidays in {filters.year}
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>New holiday</Button>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <Select
            aria-label="Filter by status"
            value={filters.isActive}
            onChange={(e) =>
              update("isActive", e.target.value as Filters["isActive"])
            }
          >
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
            <option value="">All statuses</option>
          </Select>
        </div>
      </Card>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to holidays">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No holidays defined"
            description={`No holidays are set up for ${filters.year}${
              filters.isActive === "true" ? " (active)" : ""
            }.`}
          />
        </Card>
      ) : (
        <>
          <DataTable<Holiday>
            caption="Holidays"
            rows={query.data.data}
            getRowKey={(h) => String(h.id)}
            columns={[
              { header: "Date", cell: (h) => h.holidayDate },
              { header: "Name", cell: (h) => h.name },
              {
                header: "Applies to",
                cell: (h) => h.workLocation?.name ?? "Whole organization",
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
                      header: "",
                      headerClassName: "sr-only",
                      className: "text-right",
                      cell: (h: Holiday) => (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingHoliday(h)}
                            aria-label={`Edit ${h.name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleActive(h)}
                            aria-label={`${h.isActive ? "Deactivate" : "Activate"} ${h.name}`}
                          >
                            {h.isActive ? "Deactivate" : "Activate"}
                          </Button>
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

      {canWrite ? (
        <>
          <Dialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="New holiday"
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
          >
            {editingHoliday ? (
              <HolidayForm
                mode="edit"
                initialValues={{
                  holidayDate: editingHoliday.holidayDate,
                  name: editingHoliday.name,
                  description: editingHoliday.description ?? "",
                }}
                onSubmit={handleUpdate}
                onCancel={() => setEditingHoliday(null)}
                submitLabel="Save changes"
              />
            ) : null}
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
