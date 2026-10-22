"use client";

import { useMemo, useState } from "react";
import type { Department } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  DataTable,
  DeleteConfirmDialog,
  ErrorState,
  Pagination,
  SearchInput,
  Select,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Building2,
  Download,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { HrPageHeader } from "@/features/hr/components";
import { downloadText } from "@/features/hr/payroll/download";
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
import { DepartmentCard } from "./DepartmentCard";

const PAGE_SIZE = 10;

type SortOption = "name" | "code" | "recent";

/**
 * Enterprise HR Departments Management View.
 * Matches Image 1 reference specification with integrated toolbar,
 * clean Nunito Sans typography (zero font-mono), brand status badges,
 * CSV export, and Table/Card view modes.
 */
export function DepartmentsView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

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

  // Filter and sort departments
  const filteredDepartments = useMemo(() => {
    let result = rawDepartments.filter((dept) => {
      if (statusFilter === "active" && !dept.isActive) return false;
      if (statusFilter === "inactive" && dept.isActive) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "code") {
        const codeA = getDepartmentCode(a.name, a.customFields);
        const codeB = getDepartmentCode(b.name, b.customFields);
        return codeA.localeCompare(codeB);
      }
      if (sortBy === "recent") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return 0;
    });

    return result;
  }, [rawDepartments, statusFilter, sortBy]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all");

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("name");
    setPage(1);
  }

  function handleExportCsv() {
    const headers = ["Code", "Department Name", "Status", "Created At"];
    const rows = filteredDepartments.map((dept) => [
      `#${getDepartmentCode(dept.name, dept.customFields)}`,
      dept.name,
      dept.isActive ? "Active" : "Inactive",
      formatDepartmentDate(dept.createdAt),
    ]);
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    downloadText("departments.csv", csvContent);
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

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Page Header (Standard HrPageHeader) */}
      <HrPageHeader
        title="Departments"
        description="Manage organizational departments, structural hierarchy, and active operating status."
        icon={Building2}
        badge={
          meta ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
              {meta.total} departments
            </span>
          ) : null
        }
        action={
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Department</span>
          </Button>
        }
      />

      {/* 2. Executive Toolbar (Matching Image 1 Reference) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="flex-1 min-w-60">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearchTerm("");
              setPage(1);
            }}
            placeholder="Search departments..."
            aria-label="Search departments"
            clearable
          />
        </div>

        {/* Filters, Sorters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="w-32 sm:w-36">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as "all" | "active" | "inactive",
                );
                setPage(1);
              }}
              className="h-10 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          {/* Sort By Dropdown */}
          <div className="w-36 sm:w-40">
            <Select
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 text-xs"
            >
              <option value="name">Sort: Name</option>
              <option value="code">Sort: Code</option>
              <option value="recent">Sort: Created Date</option>
            </Select>
          </div>

          {/* Export CSV Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredDepartments.length === 0}
            title="Export filtered departments to CSV"
            className="h-10 gap-1.5 rounded-xl border-slate-200/90 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="h-10 gap-1.5 rounded-xl border border-rose-200/80 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}

          {/* View Mode Toggle: Table vs Cards */}
          <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Table or Cards View */}
      {query.isPending ? (
        viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <TableSkeleton rowsCount={6} columnsCount={6} />
          </div>
        )
      ) : rawDepartments.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300 mb-4">
            <Building2 className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No departments created yet
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Get started by organizing your company into distinct departments
            like Engineering, Operations, and Sales.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#1769F5] to-[#0284c7] text-white font-semibold cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Department</span>
            </Button>
          </div>
        </div>
      ) : filteredDepartments.length === 0 ? (
        /* Filter Empty State */
        <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No departments match your filters
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Try searching with a different term or reset the active filters.
          </p>
          <div className="mt-4 flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset filters</span>
            </Button>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View (Grid Mode) */
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDepartments.map((dept) => (
              <DepartmentCard
                key={dept.id}
                department={dept}
                onEdit={(d) => setEditingDepartment(d)}
                onDelete={(d) => setDeletingDepartment(d)}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        /* Table View (Matching Image 1 Reference) */
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <DataTable<Department>
              caption="Organizational departments"
              columns={[
                {
                  header: "Code",
                  cell: (dept) => {
                    const code = getDepartmentCode(
                      dept.name,
                      dept.customFields,
                    );
                    return (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        #{code}
                      </span>
                    );
                  },
                },
                {
                  header: "Department",
                  cell: (dept) => {
                    const visual = getDepartmentVisual(dept.name);
                    const Icon = visual.icon;
                    return (
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${visual.bgColor} ${visual.textColor} ${visual.borderColor}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {dept.name}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  header: "Created On",
                  cell: (dept) => (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {formatDepartmentDate(dept.createdAt)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (dept) => (
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        dept.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {dept.isActive ? "Active" : "Inactive"}
                    </span>
                  ),
                },
                {
                  header: "Action",
                  className: "w-20 text-right",
                  headerClassName: "w-20 text-right",
                  cell: (dept) => (
                    <div className="flex justify-end">
                      <ActionMenu
                        ariaLabel={`Actions for ${dept.name}`}
                        items={[
                          {
                            label: "Edit",
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => setEditingDepartment(dept),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" />,
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
          </div>

          {meta && meta.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* 4. Create Department Dialog */}
      <DepartmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* 5. Edit Department Dialog */}
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
