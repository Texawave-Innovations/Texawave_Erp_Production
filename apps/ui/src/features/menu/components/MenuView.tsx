"use client";

import type { MenuItem } from "@texawave-erp/api-types";
import { ApiError, type CreateMenuItemFormValues } from "@texawave-erp/core";
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
  useCreateMenuItem,
  useDeleteMenuItem,
  useMenuItems,
  useUpdateMenuItem,
} from "../hooks";
import { MenuItemForm } from "./MenuItemForm";

const PAGE_SIZE = 20;

export function MenuView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const { toast } = useToast();

  const query = useMenuItems({ page, limit: PAGE_SIZE, order: "asc" });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

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
          You do not have permission to view menu items.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const items = query.data.items;
  const total = query.data.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const itemMap = new Map(items.map((i) => [i.id, i.label]));

  async function handleCreate(values: CreateMenuItemFormValues) {
    try {
      await createMutation.mutateAsync({
        ...values,
        parentId: values.parentId ?? null,
      });
      setCreateOpen(false);
      toast({ title: "Menu item created", variant: "success" });
    } catch {
      toast({ title: "Could not create menu item", variant: "error" });
    }
  }

  async function handleUpdate(values: CreateMenuItemFormValues) {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        input: {
          ...values,
          parentId: values.parentId ?? null,
        },
      });
      setEditingItem(null);
      toast({ title: "Menu item updated", variant: "success" });
    } catch {
      toast({ title: "Could not update menu item", variant: "error" });
    }
  }

  async function handleDelete(item: MenuItem) {
    try {
      await deleteMutation.mutateAsync(item.id);
      toast({ title: `Deleted "${item.label}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${item.label}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Navigation Menu Management
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New menu item</Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No menu items yet"
            description="Add navigation items to organize the application sidebar."
          />
        </Card>
      ) : (
        <>
          <DataTable<MenuItem>
            columns={[
              {
                header: "Label",
                cell: (item) => (
                  <span className="flex items-center gap-2 font-medium">
                    {item.icon && <span>{item.icon}</span>}
                    <span>{item.label}</span>
                  </span>
                ),
              },
              { header: "Code", cell: (item) => item.code },
              { header: "Path", cell: (item) => item.path ?? "—" },
              {
                header: "Parent",
                cell: (item) =>
                  item.parentId
                    ? (itemMap.get(item.parentId) ?? `#${item.parentId}`)
                    : "None",
              },
              { header: "Order", cell: (item) => String(item.order) },
              {
                header: "Permission Gate",
                cell: (item) =>
                  item.permission ? (
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-theme-xs dark:bg-gray-800">
                      {item.permission}
                    </code>
                  ) : (
                    <span className="text-theme-xs text-gray-400">Public</span>
                  ),
              },
              {
                header: "Status",
                cell: (item) => (
                  <StatusBadge
                    label={item.isActive ? "Active" : "Inactive"}
                    colorToken={item.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (item) => (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingItem(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(item)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={items}
            getRowKey={(item) => String(item.id)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New menu item"
      >
        <MenuItemForm
          existingItems={items}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create item"
        />
      </Dialog>

      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit menu item"
      >
        {editingItem && (
          <MenuItemForm
            currentItemId={editingItem.id}
            existingItems={items}
            initialValues={{
              code: editingItem.code,
              label: editingItem.label,
              path: editingItem.path ?? "",
              icon: editingItem.icon ?? "",
              order: editingItem.order,
              parentId: editingItem.parentId,
              permission: editingItem.permission ?? "",
              isActive: editingItem.isActive,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditingItem(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>
    </div>
  );
}
