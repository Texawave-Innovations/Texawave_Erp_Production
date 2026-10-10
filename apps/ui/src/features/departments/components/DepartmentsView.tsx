"use client";

import { useMemo, useState } from "react";
import type { Department } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  Input,
  Pagination,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Building2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from "../hooks";
import {
  formatDepartmentDate,
  getDepartmentCode,
  getDepartmentVisual,
} from "../utils";
import { DepartmentDialog } from "./DepartmentDialog";

const PAGE_SIZE = 10;

/**
 * Enterprise HR Departments Management View.
 * Conforms to TexaWave ERP Production design system and the approved 4-screen reference specification.
 */
export function DepartmentsView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [deletingDepartment, setDeletingDepartment] =
    useState<Department | null>(null);

  const { toast } = useToast();

  const query = useDepartments({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const rawDepartments = useMemo(
    () => query.data?.data ?? [],
    [query.data?.data],
  );
  const meta = query.data?.meta;

  // Client-side filtering by active/inactive status if selected
  const filteredDepartments = useMemo(() => {
    return rawDepartments.filter((dept) => {
      if (statusFilter === "active" && !dept.isActive) return false;
      if (statusFilter === "inactive" && dept.isActive) return false;
      return true;
    });
  }, [rawDepartments, statusFilter]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all");

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setPage(1);
  }

  async function handleCreate(values: {
    name: string;
    isActive?: boolean;
    customFields?: Record<string, unknown>;
  }) {
    try {
      await createMutation.mutateAsync(values);
      setCreateOpen(false);
      toast({ title: "Department created", variant: "success" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not create department";
      toast({ title: msg, variant: "error" });
      throw err;
    }
  }

  async function handleUpdate(values: {
    name: string;
    isActive?: boolean;
    customFields?: Record<string, unknown>;
  }) {
    if (!editingDepartment) return;
    try {
      await updateMutation.mutateAsync({
        id: editingDepartment.id,
        input: values,
      });
      setEditingDepartment(null);
      toast({ title: "Department updated", variant: "success" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not update department";
      toast({ title: msg, variant: "error" });
      throw err;
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingDepartment) return;
    try {
      await deleteMutation.mutateAsync(deletingDepartment.id);
      toast({
        title: `Deleted "${deletingDepartment.name}"`,
        variant: "success",
      });
      setDeletingDepartment(null);
    } catch {
      toast({
        title: `Could not delete "${deletingDepartment.name}"`,
        variant: "error",
      });
    }
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        <TableSkeleton rowsCount={6} columnsCount={6} />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access Denied">
          You do not have permission to view departments.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const totalRecords = meta?.total ?? rawDepartments.length;

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
              Departments
            </span>
          </div>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            Departments
          </h1>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage organizational departments and their active status.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Department</span>
        </Button>
      </div>

      {/* 2. Compact Search & Status Filter Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="Search departments"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as "all" | "active" | "inactive",
                  );
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasActiveFilters}
            onClick={handleResetFilters}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 self-end sm:self-auto"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* 3. Data Table or Empty States */}
      {rawDepartments.length === 0 ? (
        /* Screen 2: Empty State */
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500 mb-4">
            <Building2 className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            No departments yet
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            Add your first department to organize your workforce.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Department</span>
            </Button>
          </div>
        </div>
      ) : filteredDepartments.length === 0 ? (
        /* Filtered Empty State */
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500 mb-4">
            <Building2 className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            No departments match your filters
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            Try searching with a different term or reset the active filters.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filters
            </Button>
          </div>
        </div>
      ) : (
        /* Screen 1: Populated List */
        <div className="flex flex-col gap-4">
          <DataTable<Department>
            caption="Organizational departments"
            columns={[
              {
                header: "#",
                className: "w-12 text-center",
                headerClassName: "w-12 text-center",
                cell: (dept) => (
                  <span className="font-medium text-gray-500 dark:text-gray-400">
                    {(page - 1) * PAGE_SIZE +
                      filteredDepartments.indexOf(dept) +
                      1}
                  </span>
                ),
              },
              {
                header: "Department Name",
                cell: (dept) => {
                  const visual = getDepartmentVisual(dept.name);
                  const Icon = visual.icon;
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${visual.bgColor} ${visual.textColor} ${visual.borderColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white/90">
                        {dept.name}
                      </span>
                    </div>
                  );
                },
              },
              {
                header: "Code",
                cell: (dept) => {
                  const code = getDepartmentCode(dept.name, dept.customFields);
                  return (
                    <span className="font-mono text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                      {code}
                    </span>
                  );
                },
              },
              {
                header: "Status",
                cell: (dept) => (
                  <StatusBadge
                    label={dept.isActive ? "Active" : "Inactive"}
                    colorToken={dept.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Created On",
                cell: (dept) => (
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {formatDepartmentDate(dept.createdAt)}
                  </span>
                ),
              },
              {
                header: "Actions",
                className: "text-center w-16",
                headerClassName: "text-center w-16",
                cell: (dept) => (
                  <div className="flex items-center justify-center">
                    <ActionMenu
                      ariaLabel={`Actions for ${dept.name} department`}
                      triggerIcon="horizontal"
                      buttonClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      items={[
                        {
                          label: "Edit department",
                          icon: <Pencil className="h-3.5 w-3.5" />,
                          onClick: () => setEditingDepartment(dept),
                        },
                        {
                          label: "Delete department",
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          variant: "destructive",
                          onClick: () => setDeletingDepartment(dept),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            rows={filteredDepartments}
            getRowKey={(dept) => String(dept.id)}
          />

          {/* Table Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-1">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords}{" "}
              records
            </span>
            {meta && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        </div>
      )}

      {/* 4. New Department Modal (Screen 3) */}
      <DepartmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* 5. Edit / View Department Modal (Screen 4) */}
      <DepartmentDialog
        open={Boolean(editingDepartment)}
        onClose={() => setEditingDepartment(null)}
        department={editingDepartment}
        onSubmit={handleUpdate}
      />

      {/* 6. Accessible Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingDepartment)}
        onClose={() => setDeletingDepartment(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete department"
        itemName={deletingDepartment?.name ?? ""}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
