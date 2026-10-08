"use client";

import { useMemo, useState } from "react";
import type { Department } from "@texawave-erp/api-types";
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
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementToolbar } from "@/components/layout/ManagementToolbar";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from "../hooks";
import { DepartmentForm } from "./DepartmentForm";

const PAGE_SIZE = 10;

/**
 * Enterprise Departments Management View.
 * Conforms to Section 9, 10 & Docs/DESIGN_SYSTEM.md.
 */
export function DepartmentsView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
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
    ...(searchTerm ? { search: searchTerm } : {}),
  });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const rawDepartments = useMemo(
    () => query.data?.data ?? [],
    [query.data?.data],
  );
  const meta = query.data?.meta;

  // Filter client-side by status if selected
  const filteredDepartments = useMemo(() => {
    return rawDepartments.filter((dept) => {
      if (statusFilter === "active" && !dept.isActive) return false;
      if (statusFilter === "inactive" && dept.isActive) return false;
      return true;
    });
  }, [rawDepartments, statusFilter]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all");

  function handleClearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
  }

  async function handleCreate(values: { name: string; isActive?: boolean }) {
    try {
      await createMutation.mutateAsync(values);
      setCreateOpen(false);
      toast({ title: "Department created", variant: "success" });
    } catch {
      toast({ title: "Could not create department", variant: "error" });
    }
  }

  async function handleUpdate(values: { name: string; isActive?: boolean }) {
    if (!editingDepartment) return;
    try {
      await updateMutation.mutateAsync({
        id: editingDepartment.id,
        input: values,
      });
      setEditingDepartment(null);
      toast({ title: "Department updated", variant: "success" });
    } catch {
      toast({ title: "Could not update department", variant: "error" });
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
        <Skeleton className="h-14 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Shared Page Header */}
      <PageHeader
        breadcrumbs={["HR", "People", "Departments"]}
        title="Departments"
        description="Manage organizational departments used across the company."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            className="gap-2 shadow-theme-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New department</span>
          </Button>
        }
      />

      {/* 2. Management Toolbar Card */}
      <ManagementToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search departments..."
        searchLabel="Search departments"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={
          <div className="flex items-center gap-2">
            <label htmlFor="dept-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="dept-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300"
            >
              <option value="all">Status: All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
      />

      {/* 3. Table / Results Content */}
      {rawDepartments.length === 0 ? (
        <Card>
          <EmptyState
            title="No departments yet"
            description="Create your first department to organize teams and organizational hierarchy."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                + New department
              </Button>
            }
          />
        </Card>
      ) : filteredDepartments.length === 0 ? (
        <Card>
          <EmptyState
            title="No departments match your filters"
            description="Try searching with a different term or clear the active filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable<Department>
            columns={[
              {
                header: "#",
                className:
                  "w-12 text-center text-gray-400 font-mono text-theme-xs",
                headerClassName: "w-12 text-center text-theme-xs",
                cell: (dept) => (
                  <span className="font-mono text-gray-400">
                    {(page - 1) * PAGE_SIZE +
                      filteredDepartments.indexOf(dept) +
                      1}
                  </span>
                ),
              },
              {
                header: "Department",
                cell: (dept) => (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-base dark:bg-gray-800">
                      🏢
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {dept.name}
                    </span>
                  </div>
                ),
              },
              {
                header: "Code",
                cell: (dept) => {
                  const code =
                    typeof dept.customFields?.code === "string"
                      ? dept.customFields.code
                      : dept.name.slice(0, 4).toUpperCase();
                  return (
                    <span className="font-mono text-theme-xs font-semibold text-gray-600 dark:text-gray-400">
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
                header: "Actions",
                className: "text-right w-16",
                headerClassName: "text-right w-16",
                cell: (dept) => (
                  <ActionMenu
                    ariaLabel={`Actions for ${dept.name} department`}
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
                ),
              },
            ]}
            rows={filteredDepartments}
            getRowKey={(dept) => String(dept.id)}
          />

          {meta && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Showing 1–{filteredDepartments.length} of {meta.total}{" "}
                departments
              </span>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Create Modal Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New department"
      >
        <DepartmentForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create department"
        />
      </Dialog>

      {/* 5. Edit Modal Dialog */}
      <Dialog
        open={Boolean(editingDepartment)}
        onClose={() => setEditingDepartment(null)}
        title="Edit department"
      >
        {editingDepartment && (
          <DepartmentForm
            initialValues={{
              name: editingDepartment.name,
              isActive: editingDepartment.isActive,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditingDepartment(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>

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
