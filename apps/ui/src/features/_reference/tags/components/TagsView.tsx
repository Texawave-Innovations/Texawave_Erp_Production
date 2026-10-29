"use client";

import { useMemo, useState } from "react";
import type { Tag } from "@texawave-erp/api-types";
import { TAG_COLOR_TOKENS } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus } from "lucide-react";
import { ManagementToolbar } from "@/components/layout/ManagementToolbar";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { useCreateTag, useDeleteTag, useTags } from "../hooks";
import { TagForm } from "./TagForm";

const PAGE_SIZE = 10;

const COLOR_OPTIONS: FilterOption[] = [
  { value: "all", label: "All colors" },
  ...TAG_COLOR_TOKENS.map((token) => ({
    value: token,
    label: token.charAt(0).toUpperCase() + token.slice(1),
  })),
];

/**
 * Enterprise Reference Tags Management View.
 * Standardized on the Settings module layout with PageHeader and ManagementToolbar.
 * Conforms to Docs/DESIGN_SYSTEM.md and Docs/SETTNGS.md.
 */
export function TagsView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const query = useTags({
    page,
    limit: PAGE_SIZE,
    ...(searchTerm ? { search: searchTerm } : {}),
  });
  const createMutation = useCreateTag();
  const deleteMutation = useDeleteTag();

  const tags = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const meta = query.data?.meta;

  const filteredTags = useMemo(() => {
    return tags.filter((tag) => {
      if (colorFilter !== "all" && tag.colorToken !== colorFilter) return false;
      return true;
    });
  }, [tags, colorFilter]);

  const hasActiveFilters = Boolean(searchTerm || colorFilter !== "all");

  function handleClearFilters() {
    setSearchTerm("");
    setColorFilter("all");
  }

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

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Shared Page Header */}
      <PageHeader
        breadcrumbs={["Settings", "Configuration", "Reference Tags"]}
        title="Reference tags"
        description="Manage organization-wide classification tags used across modules."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            className="gap-2 shadow-theme-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New tag</span>
          </Button>
        }
      />

      {/* 2. Management Toolbar Card */}
      <ManagementToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search tags..."
        searchLabel="Search tags"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              id="tag-color-filter"
              label="Filter by color"
              prefix="Color"
              value={colorFilter}
              onChange={setColorFilter}
              options={COLOR_OPTIONS}
            />
          </div>
        }
      />

      {/* 3. Table / Results Content */}
      {tags.length === 0 ? (
        <Card>
          <EmptyState
            title="No tags yet"
            description="Create your first tag to see it here."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                + New tag
              </Button>
            }
          />
        </Card>
      ) : filteredTags.length === 0 ? (
        <Card>
          <EmptyState
            title="No tags match your filters"
            description="Try searching with a different name or clear the active filters."
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
          <DataTable<Tag>
            caption="Reference tags list"
            columns={[
              {
                header: "Name",
                sortable: true,
                sortKey: "name",
                cell: (tag) => (
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    {tag.name}
                  </span>
                ),
              },
              {
                header: "Color",
                sortable: true,
                sortKey: "colorToken",
                cell: (tag) => (
                  <StatusBadge
                    label={tag.colorToken}
                    colorToken={tag.colorToken}
                  />
                ),
              },
              {
                header: "Actions",
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
            rows={filteredTags}
            getRowKey={(tag) => String(tag.id)}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={(key, dir) => {
              setSortColumn(key);
              setSortDirection(dir);
            }}
            selectable={true}
            selectedRowKeys={selectedKeys}
            onSelectRow={(key, selected) => {
              setSelectedKeys((prev) => {
                const next = new Set(prev);
                if (selected) next.add(key);
                else next.delete(key);
                return next;
              });
            }}
            onSelectAll={(selected) => {
              if (selected) {
                setSelectedKeys(new Set(tags.map((t) => String(t.id))));
              } else {
                setSelectedKeys(new Set());
              }
            }}
          />
          {meta && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Showing 1–{filteredTags.length} of {meta.total} tags
              </span>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                totalItems={meta.total}
                pageSize={PAGE_SIZE}
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
