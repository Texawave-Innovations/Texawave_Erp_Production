"use client";

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
import { useState } from "react";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from "../hooks";
import { DepartmentForm } from "./DepartmentForm";

const PAGE_SIZE = 10;

export function DepartmentsView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const { toast } = useToast();

  const query = useDepartments({ page, limit: PAGE_SIZE });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
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

  const departments = query.data.data;
  const meta = query.data.meta;

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

  async function handleDelete(dept: Department) {
    try {
      await deleteMutation.mutateAsync(dept.id);
      toast({ title: `Deleted "${dept.name}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${dept.name}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Departments
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New department</Button>
      </div>

      {departments.length === 0 ? (
        <Card>
          <EmptyState
            title="No departments yet"
            description="Create your first department to organize teams."
          />
        </Card>
      ) : (
        <>
          <DataTable<Department>
            columns={[
              { header: "Name", cell: (dept) => dept.name },
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
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (dept) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingDepartment(dept)}
                      aria-label={`Edit ${dept.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(dept)}
                      aria-label={`Delete ${dept.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={departments}
            getRowKey={(dept) => String(dept.id)}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

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
    </div>
  );
}
