"use client";

import type { Tag } from "@texawave-erp/api-types";
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
import { useCreateTag, useDeleteTag, useTags } from "../hooks";
import { TagForm } from "./TagForm";

const PAGE_SIZE = 10;

/**
 * The reference feature's screen, demonstrating every state
 * Docs/DESIGN_SYSTEM.md "Screen interaction states" requires: initial
 * loading, empty, no-results, request error with retry, permission denied,
 * save in progress, and field-validation errors (inside `TagForm`).
 */
export function TagsView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const query = useTags({ page, limit: PAGE_SIZE });
  const createMutation = useCreateTag();
  const deleteMutation = useDeleteTag();

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
        <Alert
          variant="warning"
          title="You don't have access to reference tags"
        >
          Ask an administrator for the <code>reference.tags.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const tags = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: {
    name: string;
    colorToken: Tag["colorToken"];
  }) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Tag created", variant: "success" });
  }

  async function handleDelete(tag: Tag) {
    try {
      await deleteMutation.mutateAsync(tag.id);
      toast({ title: `Deleted "${tag.name}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${tag.name}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Reference tags
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New tag</Button>
      </div>

      {tags.length === 0 ? (
        // No second "New tag" action here — the header button above is
        // already the one entry point, so this isn't a duplicate control.
        <Card>
          <EmptyState
            title="No tags yet"
            description="Create your first tag to see it here."
          />
        </Card>
      ) : (
        <>
          <DataTable<Tag>
            columns={[
              { header: "Name", cell: (tag) => tag.name },
              {
                header: "Color",
                cell: (tag) => (
                  <StatusBadge
                    label={tag.colorToken}
                    colorToken={tag.colorToken}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (tag) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(tag)}
                    aria-label={`Delete ${tag.name}`}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
            rows={tags}
            getRowKey={(tag) => String(tag.id)}
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
        title="New tag"
      >
        <TagForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create tag"
        />
      </Dialog>
    </div>
  );
}
