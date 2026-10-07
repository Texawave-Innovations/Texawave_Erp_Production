"use client";

import type { Designation } from "@texawave-erp/api-types";
import { ApiError, type CreateDesignationFormValues } from "@texawave-erp/core";
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
  useCreateDesignation,
  useDesignations,
  useSetDesignationActive,
  useUpdateDesignation,
} from "../hooks";
import { DesignationForm } from "./DesignationForm";

const PAGE_SIZE = 10;

export function DesignationsView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] =
    useState<Designation | null>(null);
  const { toast } = useToast();

  const query = useDesignations({ page, limit: PAGE_SIZE });
  const createMutation = useCreateDesignation();
  const updateMutation = useUpdateDesignation();
  const activeMutation = useSetDesignationActive();

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
          You do not have permission to view designations.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const designations = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: CreateDesignationFormValues) {
    try {
      await createMutation.mutateAsync({
        code: values.code,
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      });
      setCreateOpen(false);
      toast({ title: "Designation created", variant: "success" });
    } catch {
      toast({ title: "Could not create designation", variant: "error" });
    }
  }

  async function handleUpdate(values: CreateDesignationFormValues) {
    if (!editingDesignation) return;
    try {
      await updateMutation.mutateAsync({
        id: editingDesignation.id,
        // An empty description clears it (API: "Send an empty string to clear").
        input: { name: values.name, description: values.description ?? "" },
      });
      setEditingDesignation(null);
      toast({ title: "Designation updated", variant: "success" });
    } catch {
      toast({ title: "Could not update designation", variant: "error" });
    }
  }

  async function handleToggleActive(designation: Designation) {
    const nextActive = !designation.isActive;
    try {
      await activeMutation.mutateAsync({
        id: designation.id,
        isActive: nextActive,
      });
      toast({
        title: `${nextActive ? "Activated" : "Deactivated"} "${designation.name}"`,
        variant: "success",
      });
    } catch {
      toast({
        title: `Could not update "${designation.name}"`,
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Designations
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New designation</Button>
      </div>

      {designations.length === 0 ? (
        <Card>
          <EmptyState
            title="No designations yet"
            description="Create designations such as Software Engineer for new hires to choose from."
          />
        </Card>
      ) : (
        <>
          <DataTable<Designation>
            columns={[
              { header: "Code", cell: (d) => d.code },
              { header: "Name", cell: (d) => d.name },
              {
                header: "Status",
                cell: (d) => (
                  <StatusBadge
                    label={d.isActive ? "Active" : "Inactive"}
                    colorToken={d.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (d) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingDesignation(d)}
                      aria-label={`Edit ${d.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggleActive(d)}
                      aria-label={`${d.isActive ? "Deactivate" : "Activate"} ${d.name}`}
                    >
                      {d.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={designations}
            getRowKey={(d) => String(d.id)}
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
        title="New designation"
      >
        <DesignationForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create designation"
        />
      </Dialog>

      <Dialog
        open={Boolean(editingDesignation)}
        onClose={() => setEditingDesignation(null)}
        title="Edit designation"
      >
        {editingDesignation && (
          <DesignationForm
            mode="edit"
            initialValues={{
              code: editingDesignation.code,
              name: editingDesignation.name,
              description: editingDesignation.description ?? "",
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditingDesignation(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>
    </div>
  );
}
