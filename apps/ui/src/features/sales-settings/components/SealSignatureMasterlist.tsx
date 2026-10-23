"use client";

import type { PaginatedEnvelope, SealSignature } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import type { SealSignatureFormValues } from "../schema";
import { SEAL_SIGNATURE_READ, SEAL_SIGNATURE_WRITE } from "../permissions";
import { usePermission } from "@/hooks/usePermission";
import { SealSignatureForm } from "./SealSignatureForm";

const PAGE_SIZE = 12;

export interface SealSignatureMasterlistProps {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  /** `true` for the Authorized Signature masterlist. */
  showSignatoryFields: boolean;
  useList: (query: {
    page: number;
    limit: number;
  }) => UseQueryResult<PaginatedEnvelope<SealSignature>>;
  onCreate: (values: SealSignatureFormValues) => Promise<SealSignature>;
  onDelete: (id: number) => Promise<void>;
  deletePending: boolean;
}

/** Shared shape of the Company Seal and Authorized Signature masterlists
 * (Docs/SALES_SETTINGS_FOUNDATION.md design decision #1 — one table, one UI
 * shape, `kind` fixed server-side). */
export function SealSignatureMasterlist({
  title,
  emptyTitle,
  emptyDescription,
  showSignatoryFields,
  useList,
  onCreate,
  onDelete,
  deletePending,
}: SealSignatureMasterlistProps) {
  const canRead = usePermission(SEAL_SIGNATURE_READ);
  const canWrite = usePermission(SEAL_SIGNATURE_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<SealSignature | null>(null);
  const { toast } = useToast();

  const query = useList({ page, limit: PAGE_SIZE });

  if (!canRead) {
    return (
      <Alert variant="warning" title={`You don't have access to ${title}`}>
        Ask an administrator for the <code>{SEAL_SIGNATURE_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const items = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: SealSignatureFormValues) {
    await onCreate(values);
    setCreateOpen(false);
    toast({ title: "Item added", variant: "success" });
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await onDelete(deleting.id);
      toast({ title: `Deleted "${deleting.title}"`, variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${SEAL_SIGNATURE_WRITE} permission.`
            : `Could not delete "${deleting.title}"`,
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
            {title}
          </h3>
          {canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                >
                  <img
                    src={item.imageDataUri}
                    alt={item.title}
                    className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-contain dark:border-gray-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-theme-sm font-medium text-gray-900 dark:text-white/90">
                      {item.title}
                    </p>
                    {showSignatoryFields && item.signatoryName ? (
                      <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                        {item.signatoryName}
                        {item.designation ? ` · ${item.designation}` : ""}
                      </p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => setDeleting(item)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
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
        title={`Add to ${title}`}
      >
        <SealSignatureForm
          showSignatoryFields={showSignatoryFields}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Add"
        />
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete item"
        itemName={deleting?.title ?? ""}
        loading={deletePending}
      />
    </Card>
  );
}
