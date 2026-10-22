"use client";

import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { usePermission } from "@/hooks/usePermission";
import type { Product } from "@texawave-erp/api-types";
import { ApiError, type CreateProductFormValues } from "@texawave-erp/core";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  IndianRupee,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
} from "../hooks";
import { ProductForm } from "./ProductForm";

const formatPrice = (value: string | number) =>
  Number(value).toLocaleString("en-IN");

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge
      variant="outline"
      className="bg-emerald-50 text-emerald-700 border-emerald-200 border gap-1"
    >
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="bg-slate-100 text-slate-500 border-slate-200 border gap-1"
    >
      <XCircle className="h-3 w-3" /> Inactive
    </Badge>
  );
}

function ReadOnlyField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-bold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const READONLY_BOX =
  "min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800";

/** Legacy Products.tsx: list card with search, import/export, Add Product,
 * gradient table (View / Edit / Delete), in-place view page and full-page
 * create/edit form. */
export function ProductList() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);

  const canManage = usePermission("crm.product.write");

  const query = useProducts({
    page,
    limit: pageSize,
    q: search.trim() || undefined,
  });
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  async function handleCreate(values: CreateProductFormValues) {
    await createMutation.mutateAsync(values);
    toast.success("Product created");
    setMode("list");
  }

  async function handleUpdate(values: CreateProductFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    toast.success("Product updated");
    setEditing(null);
  }

  async function handleDelete(product: Product) {
    try {
      await deleteMutation.mutateAsync(product.id);
      toast.success(`Deleted "${product.name}"`);
    } catch (err) {
      throw new Error(
        err instanceof ApiError
          ? err.message
          : `Could not delete "${product.name}"`,
      );
    }
  }

  const backButton = (onClick: () => void, disabled?: boolean) => (
    <div className="flex items-center gap-2">
      <BackToDashboardButton />
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={onClick}
        disabled={disabled}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
      </Button>
    </div>
  );

  if (viewing) {
    return (
      <div className="space-y-6 pb-8">
        {backButton(() => setViewing(null))}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {viewing.name}
                </h2>
                <p className="text-sm text-slate-400 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {viewing.code}
                </p>
              </div>
            </div>
            <ActiveBadge active={viewing.isActive} />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <ReadOnlyField label="Category">
              <p className={READONLY_BOX}>{viewing.category || "—"}</p>
            </ReadOnlyField>
            <ReadOnlyField label="Vendor">
              <p className={READONLY_BOX}>{viewing.vendor || "—"}</p>
            </ReadOnlyField>
            <ReadOnlyField label="Unit Price">
              <p
                className={`${READONLY_BOX} font-semibold flex items-center gap-0.5`}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                {formatPrice(viewing.unitPrice)}
              </p>
            </ReadOnlyField>
            <ReadOnlyField label="Tax %">
              <p className={READONLY_BOX}>{Number(viewing.taxPercent ?? 0)}%</p>
            </ReadOnlyField>
            <ReadOnlyField label="Used In Deals">
              <p className={READONLY_BOX}>{viewing.usageCount ?? 0}</p>
            </ReadOnlyField>
            {viewing.description && (
              <ReadOnlyField label="Description" className="md:col-span-3">
                <p className={`${READONLY_BOX} whitespace-pre-wrap`}>
                  {viewing.description}
                </p>
              </ReadOnlyField>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            View-only — use Edit to change these details.
          </div>
          {canManage && (
            <Button
              className="rounded-xl gap-1.5"
              onClick={() => {
                const p = viewing;
                setViewing(null);
                setEditing(p);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-6 pb-8">
        {backButton(() => setMode("list"))}
        <ProductForm
          title="Add Product"
          submitLabel="Create Product"
          onSubmit={handleCreate}
          onCancel={() => setMode("list")}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-6 pb-8">
        {backButton(() => setEditing(null))}
        <ProductForm
          key={editing.id}
          title="Edit Product"
          submitLabel="Save Changes"
          initialValues={{
            name: editing.name,
            code: editing.code,
            category: editing.category ?? undefined,
            vendor: editing.vendor ?? undefined,
            unitPrice: Number(editing.unitPrice),
            taxPercent: Number(editing.taxPercent ?? 0),
            description: editing.description ?? undefined,
            isActive: editing.isActive,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);
  const noAccess =
    query.isError &&
    query.error instanceof ApiError &&
    query.error.isPermissionError;

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-brand-600" /> Products
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Your product/service catalog — add these to Deals and Quotes as
              line items.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search products…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              entity="products"
              moduleLabel="Products"
              fileBaseName="crm-products"
              search={search}
            />
            {canManage && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={() => setMode("create")}
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Products…
            </div>
          ) : noAccess ? (
            <EmptyState
              icon={Package}
              title="You don't have access to CRM products"
              description="Ask an administrator for the crm.product.read permission."
            />
          ) : query.isError ? (
            <div className="text-center py-16 text-sm text-slate-500">
              Could not load products.{" "}
              <button
                type="button"
                className="text-brand-600 underline"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                search ? `No products match "${search}"` : "No products yet"
              }
              description="Add your first product to start attaching it to deals and quotes."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    {[
                      "Product",
                      "Category",
                      "Vendor",
                      "Unit Price",
                      "Tax %",
                      "Status",
                    ].map((h) => (
                      <TableHead
                        key={h}
                        className="font-black text-sm uppercase tracking-wider text-white py-2.5"
                      >
                        {h}
                      </TableHead>
                    ))}
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[220px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((p) => (
                    <TableRow
                      key={p.id}
                      className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                    >
                      <TableCell className="py-1">
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className="font-semibold text-slate-800">
                            {p.name}
                          </p>
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> {p.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {p.category || "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {p.vendor || "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-700 font-semibold">
                        <span className="inline-flex items-center gap-0.5">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {formatPrice(p.unitPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {Number(p.taxPercent ?? 0)}%
                      </TableCell>
                      <TableCell className="py-1">
                        <ActiveBadge active={p.isActive} />
                      </TableCell>
                      <TableCell className="py-1">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                            title="View product"
                            onClick={() => setViewing(p)}
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {canManage ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                                title="Edit product"
                                onClick={() => setEditing(p)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                }
                                title={`Delete "${p.name}"?`}
                                description="This product will be moved to the CRM Recycle Bin."
                                warning={
                                  (p.usageCount ?? 0) > 0
                                    ? `This product is used in ${p.usageCount} deal/quote line item${p.usageCount === 1 ? "" : "s"} — remove it from those first.`
                                    : undefined
                                }
                                onConfirm={() => handleDelete(p)}
                              />
                            </>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={Math.min(page, totalPages)}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
