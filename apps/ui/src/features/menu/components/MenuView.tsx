"use client";

import { useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementToolbar } from "@/components/layout/ManagementToolbar";
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useMenuItems,
  useUpdateMenuItem,
} from "../hooks";
import { MenuItemForm } from "./MenuItemForm";

const PAGE_SIZE = 20;

/**
 * Enterprise Navigation Menu Management View.
 * Conforms to Section 17, 18 & Docs/DESIGN_SYSTEM.md.
 */
export function MenuView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [parentFilter, setParentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);

  const { toast } = useToast();

  const query = useMenuItems({
    page,
    limit: PAGE_SIZE,
    order: "asc",
    ...(searchTerm ? { search: searchTerm } : {}),
  });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

  const rawItems = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const itemMap = useMemo(
    () => new Map(rawItems.map((i) => [i.id, i.label])),
    [rawItems],
  );

  // Available parent options for filtering
  const availableParents = useMemo(() => {
    const parentIds = new Set(
      rawItems.map((i) => i.parentId).filter((id): id is number => id !== null),
    );
    return Array.from(parentIds)
      .map((id) => ({ id, label: itemMap.get(id) ?? `#${id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rawItems, itemMap]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (parentFilter !== "all" && String(item.parentId) !== parentFilter)
        return false;
      return true;
    });
  }, [rawItems, statusFilter, parentFilter]);

  const hasActiveFilters = Boolean(
    searchTerm || parentFilter !== "all" || statusFilter !== "all",
  );

  function handleClearFilters() {
    setSearchTerm("");
    setParentFilter("all");
    setStatusFilter("all");
  }

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

  async function handleDeleteConfirm() {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      toast({ title: `Deleted "${deletingItem.label}"`, variant: "success" });
      setDeletingItem(null);
    } catch {
      toast({
        title: `Could not delete "${deletingItem.label}"`,
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
          You do not have permission to view menu items.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Shared Page Header */}
      <PageHeader
        breadcrumbs={["HR", "People", "Navigation Menu"]}
        title="Navigation Menu"
        description="Manage the navigation structure and page visibility for HR module."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            className="gap-2 shadow-theme-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New menu item</span>
          </Button>
        }
      />

      {/* 2. Management Toolbar Card */}
      <ManagementToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search menu items..."
        searchLabel="Search menu items"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Parent Filter */}
            <label htmlFor="menu-parent-filter" className="sr-only">
              Filter by parent
            </label>
            <select
              id="menu-parent-filter"
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300"
            >
              <option value="all">Parent: All items</option>
              {availableParents.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <label htmlFor="menu-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="menu-status-filter"
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
      {rawItems.length === 0 ? (
        <Card>
          <EmptyState
            title="No menu items yet"
            description="Add navigation items to organize the application sidebar."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                + New menu item
              </Button>
            }
          />
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            title="No menu items match your filters"
            description="Try searching with a different label or clear the active filters."
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
          <DataTable<MenuItem>
            columns={[
              {
                header: "#",
                className:
                  "w-12 text-center text-gray-400 font-mono text-theme-xs",
                headerClassName: "w-12 text-center text-theme-xs",
                cell: (item) => (
                  <span className="font-mono text-gray-400">
                    {(page - 1) * PAGE_SIZE + filteredItems.indexOf(item) + 1}
                  </span>
                ),
              },
              {
                header: "Menu Item",
                cell: (item) => (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-base dark:bg-gray-800">
                      {item.icon || "📄"}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {item.label}
                    </span>
                  </div>
                ),
              },
              {
                header: "Path",
                cell: (item) => (
                  <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                    {item.path ?? "—"}
                  </span>
                ),
              },
              {
                header: "Parent",
                cell: (item) => (
                  <span className="text-theme-xs text-gray-600 dark:text-gray-300">
                    {item.parentId
                      ? (itemMap.get(item.parentId) ?? `#${item.parentId}`)
                      : "—"}
                  </span>
                ),
              },
              {
                header: "Order",
                className: "text-center w-20",
                headerClassName: "text-center w-20",
                cell: (item) => (
                  <span className="font-mono text-theme-xs font-semibold text-gray-600 dark:text-gray-400">
                    {item.order}
                  </span>
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
                header: "Actions",
                className: "text-right w-16",
                headerClassName: "text-right w-16",
                cell: (item) => (
                  <ActionMenu
                    ariaLabel={`Actions for ${item.label}`}
                    items={[
                      {
                        label: "Edit menu item",
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        onClick: () => setEditingItem(item),
                      },
                      {
                        label: "Delete menu item",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        variant: "destructive",
                        onClick: () => setDeletingItem(item),
                      },
                    ]}
                  />
                ),
              },
            ]}
            rows={filteredItems}
            getRowKey={(item) => String(item.id)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing 1–{filteredItems.length} of {total} menu items
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* 4. Create Modal Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New menu item"
      >
        <MenuItemForm
          existingItems={rawItems}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create item"
        />
      </Dialog>

      {/* 5. Edit Modal Dialog */}
      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit menu item"
      >
        {editingItem && (
          <MenuItemForm
            currentItemId={editingItem.id}
            existingItems={rawItems}
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

      {/* 6. Accessible Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete menu item"
        itemName={deletingItem?.label ?? ""}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
