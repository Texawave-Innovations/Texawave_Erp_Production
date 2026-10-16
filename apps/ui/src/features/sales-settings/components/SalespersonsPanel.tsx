"use client";

import type { Salesperson } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateSalesperson,
  useDeleteSalesperson,
  useSalespersons,
  useUpdateSalesperson,
} from "../hooks";
import { SALESPERSON_READ, SALESPERSON_WRITE } from "../permissions";
import type { SalespersonFormValues } from "../schema";
import { SalespersonForm } from "./SalespersonForm";

const PAGE_SIZE = 10;

export function SalespersonsPanel() {
  const canRead = usePermission(SALESPERSON_READ);
  const canWrite = usePermission(SALESPERSON_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Salesperson | null>(null);
  const [deleting, setDeleting] = useState<Salesperson | null>(null);
  const { toast } = useToast();

  const query = useSalespersons({ page, limit: PAGE_SIZE });
  const createMutation = useCreateSalesperson();
  const updateMutation = useUpdateSalesperson();
  const deleteMutation = useDeleteSalesperson();

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to salespersons">
        Ask an administrator for the <code>{SALESPERSON_READ}</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const salespersons = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: SalespersonFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Salesperson added", variant: "success" });
  }

  async function handleUpdate(values: SalespersonFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    toast({ title: "Salesperson updated", variant: "success" });
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast({ title: `Deleted "${deleting.name}"`, variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${SALESPERSON_WRITE} permission.`
            : `Could not delete "${deleting.name}"`,
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 p-1">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Salespersons
          </h3>
          {canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add salesperson
            </Button>
          ) : null}
        </div>

        {salespersons.length === 0 ? (
          <EmptyState
            title="No salespersons yet"
            description="Add a salesperson to assign them to quotations and orders."
          />
        ) : (
          <>
            <DataTable<Salesperson>
              caption="Salespersons"
              columns={[
                { header: "Name", cell: (s) => s.name },
                { header: "Code", cell: (s) => s.code ?? "" },
                { header: "Email", cell: (s) => s.email ?? "" },
                { header: "Phone", cell: (s) => s.phone ?? "" },
                {
                  header: "Commission %",
                  cell: (s) => s.commissionPercent ?? "",
                },
                ...(canWrite
                  ? [
                      {
                        header: "Actions",
                        headerClassName: "sr-only",
                        className: "text-right",
                        cell: (s: Salesperson) => (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(s)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleting(s)}
                            >
                              Delete
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={salespersons}
              getRowKey={(s) => String(s.id)}
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add salesperson"
      >
        <SalespersonForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Add salesperson"
        />
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit salesperson"
      >
        {editing ? (
          <SalespersonForm
            initialValues={{
              name: editing.name,
              code: editing.code ?? "",
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              commissionPercent: editing.commissionPercent ?? undefined,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete salesperson"
        itemName={deleting?.name ?? ""}
        loading={deleteMutation.isPending}
      />
    </Card>
  );
}
