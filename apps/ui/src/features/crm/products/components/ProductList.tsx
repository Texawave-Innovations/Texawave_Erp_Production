"use client";

import type { Product } from "@texawave-erp/api-types";
import { ApiError, type CreateProductFormValues } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ProductForm } from "./ProductForm";
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
} from "../hooks";

const PAGE_SIZE = 20;

/** Reproduces legacy Products.tsx: search across name/code/category/
 * vendor, the list columns (Product+Code, Category, Vendor, Unit Price,
 * Tax %, Status, Action), and the Edit/Delete row actions. No sort or
 * filter controls — legacy has none either
 * (Docs/CRM_PRODUCTS_LEGACY_PARITY.md §2.3). Create/Edit use a `Dialog`
 * (per the audit's UI-parity recommendation) rather than legacy's
 * full-page swap. */
export function ProductList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const { toast } = useToast();

  const query = useProducts({ page, limit: PAGE_SIZE, q: search || undefined });
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  async function handleCreate(values: CreateProductFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Product created", variant: "success" });
  }

  async function handleUpdate(values: CreateProductFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    toast({ title: "Product updated", variant: "success" });
  }

  async function handleDelete(product: Product) {
    try {
      await deleteMutation.mutateAsync(product.id);
      toast({ title: `Deleted "${product.name}"`, variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Could not delete "${product.name}"`;
      toast({ title: message, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Products
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Add Product</Button>
      </div>

      <Input
        placeholder="Search name, code, category, vendor..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to CRM products"
          >
            Ask an administrator for the <code>crm.product.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? `No products match "${search}"` : "No products yet"}
            description="Add your first product to start attaching it to deals."
          />
        </Card>
      ) : (
        <>
          <DataTable<Product>
            columns={[
              {
                header: "Product",
                cell: (p) => (
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-theme-xs text-gray-400">{p.code}</p>
                  </div>
                ),
              },
              { header: "Category", cell: (p) => p.category ?? "—" },
              { header: "Vendor", cell: (p) => p.vendor ?? "—" },
              { header: "Unit Price", cell: (p) => p.unitPrice },
              { header: "Tax %", cell: (p) => p.taxPercent ?? "0" },
              {
                header: "Status",
                cell: (p) => (
                  <StatusBadge
                    label={p.isActive ? "Active" : "Inactive"}
                    colorToken={p.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (p) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(p)}
                      aria-label={`Edit ${p.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(p) => String(p.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New product"
      >
        <ProductForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create product"
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit product"
      >
        {editing ? (
          <ProductForm
            initialValues={{
              name: editing.name,
              code: editing.code,
              category: editing.category ?? undefined,
              vendor: editing.vendor ?? undefined,
              unitPrice: Number(editing.unitPrice),
              taxPercent: editing.taxPercent
                ? Number(editing.taxPercent)
                : undefined,
              description: editing.description ?? undefined,
              isActive: editing.isActive,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>
    </div>
  );
}
