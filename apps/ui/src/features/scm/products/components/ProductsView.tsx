"use client";

import type { ScmProduct } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney, formatQty } from "../../shared/format";
import { ScmFormDialog, type ScmFormValues } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { usePostOpeningBalance } from "../../inventory/hooks";
import {
  useCreateScmProduct,
  useDeleteScmProduct,
  useScmProducts,
  useUpdateScmProduct,
} from "../hooks";

const yn = (b: boolean) => (b ? "yes" : "no");

function toForm(p: ScmProduct): Partial<ScmFormValues> {
  return {
    productCode: p.productCode,
    name: p.name,
    category: p.category ?? "",
    uom: p.uom,
    hsn: p.hsn ?? "",
    unitPrice: Number(p.unitPrice),
    costPrice: Number(p.costPrice),
    reorderLevel: p.reorderLevel === null ? "" : Number(p.reorderLevel),
    minimumStock: p.minimumStock === null ? "" : Number(p.minimumStock),
    maximumStock: p.maximumStock === null ? "" : Number(p.maximumStock),
    batchTracked: yn(p.batchTracked),
    serialTracked: yn(p.serialTracked),
    description: p.description ?? "",
    isActive: yn(p.isActive),
  };
}

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

/** SCM product master: the SKU catalogue with the inventory-owned settings
 * (reorder/min/max, cost, batch/serial tracking). */
export function ProductsView() {
  const c = useListControls();
  const [active, setActive] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScmProduct | null>(null);
  const [deleting, setDeleting] = useState<ScmProduct | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.product.write");
  const create = useCreateScmProduct();
  const update = useUpdateScmProduct();
  const remove = useDeleteScmProduct();
  const openingBalance = usePostOpeningBalance();

  const query = useScmProducts({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    isActive: active === "" ? undefined : active === "true",
  });

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <ScmListView<ScmProduct>
      title="Products"
      description="SKU catalogue with unit of measure, cost, reorder levels and batch/serial tracking."
      icon={Package}
      noun="products"
      readPermission="scm.product.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(p) => String(p.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by code, name, category or HSN...",
      }}
      filters={
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by status"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || active)}
      onResetFilters={() => {
        c.setSearch("");
        setActive("");
      }}
      emptyTitle="No products yet"
      emptyDescription="Add your first product to start tracking stock."
      columns={[
        {
          header: "Code",
          cell: (p) => (
            <span className="font-mono text-theme-xs">{p.productCode}</span>
          ),
        },
        {
          header: "Name",
          cell: (p) => (
            <div className="flex flex-col">
              <span className="font-semibold">{p.name}</span>
              {p.category ? (
                <span className="text-theme-xs text-gray-500">
                  {p.category}
                </span>
              ) : null}
            </div>
          ),
        },
        { header: "UOM", cell: (p) => p.uom },
        { header: "HSN", cell: (p) => p.hsn ?? "—" },
        {
          header: "Cost",
          align: "right",
          cell: (p) => formatMoney(p.costPrice),
        },
        {
          header: "Price",
          align: "right",
          cell: (p) => formatMoney(p.unitPrice),
        },
        {
          header: "Reorder",
          align: "right",
          cell: (p) => formatQty(p.reorderLevel),
        },
        {
          header: "Tracking",
          cell: (p) =>
            [p.batchTracked ? "Batch" : null, p.serialTracked ? "Serial" : null]
              .filter(Boolean)
              .join(" · ") || "—",
        },
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
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (p) =>
            canWrite ? (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => {
                    setEditing(p);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null,
        },
      ]}
    >
      <ScmFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={closeForm}
        size="2xl"
        title={editing ? "Edit Product" : "Add Product"}
        submitLabel={editing ? "Save Changes" : "Create Product"}
        initialValues={
          editing
            ? toForm(editing)
            : {
                uom: "PCS",
                unitPrice: 0,
                costPrice: 0,
                batchTracked: "no",
                serialTracked: "no",
                isActive: "yes",
              }
        }
        fields={[
          {
            name: "productCode",
            label: "Product Code",
            type: "text",
            required: true,
            upper: true,
            mono: true,
          },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "category", label: "Category", type: "text" },
          {
            name: "uom",
            label: "Unit of Measure",
            type: "text",
            required: true,
            upper: true,
          },
          { name: "hsn", label: "HSN", type: "text" },
          {
            name: "unitPrice",
            label: "Unit Price",
            type: "number",
            min: 0,
            step: 0.01,
          },
          {
            name: "costPrice",
            label: "Cost Price",
            type: "number",
            min: 0,
            step: 0.01,
            hint: "Stock is valued at cost",
          },
          {
            name: "reorderLevel",
            label: "Reorder Level",
            type: "number",
            min: 0,
          },
          {
            name: "minimumStock",
            label: "Minimum Stock",
            type: "number",
            min: 0,
          },
          {
            name: "maximumStock",
            label: "Maximum Stock",
            type: "number",
            min: 0,
          },
          {
            name: "batchTracked",
            label: "Batch Tracked",
            type: "select",
            required: true,
            options: YES_NO,
          },
          {
            name: "serialTracked",
            label: "Serial Tracked",
            type: "select",
            required: true,
            options: YES_NO,
          },
          {
            name: "isActive",
            label: "Active",
            type: "select",
            required: true,
            options: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ],
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            span: 2,
          },
          // Create-only: barcode and opening stock have their own flows once the product exists.
          ...(editing
            ? []
            : ([
                {
                  name: "barcode",
                  label: "Barcode / QR Value",
                  type: "text",
                  mono: true,
                  span: 2,
                  placeholder:
                    "Optional — leave blank to auto-generate from the product code",
                },
                {
                  name: "openingWarehouseId",
                  label: "Opening Stock Warehouse",
                  type: "warehouse",
                  hint: "Optional — also becomes the product's warehouse",
                },
                {
                  name: "openingQuantity",
                  label: "Opening Quantity",
                  type: "number",
                  min: 0,
                  step: 0.001,
                  hint: "Optional — seeds stock with an Opening Balance ledger entry",
                },
                {
                  name: "openingUnitCost",
                  label: "Opening Unit Cost",
                  type: "number",
                  min: 0,
                  step: 0.01,
                },
              ] as const)),
        ]}
        validate={(v) => {
          const qty = Number(v.openingQuantity || 0);
          if (!editing && qty > 0 && !v.openingWarehouseId) {
            return {
              openingWarehouseId: "Select a warehouse for the opening quantity",
            };
          }
          return null;
        }}
        onSubmit={async (v) => {
          const input = {
            productCode: v.productCode as string,
            name: v.name as string,
            category: (v.category as string | undefined) ?? "",
            uom: v.uom as string,
            hsn: (v.hsn as string | undefined) ?? "",
            unitPrice: (v.unitPrice as number | undefined) ?? 0,
            costPrice: (v.costPrice as number | undefined) ?? 0,
            reorderLevel: (v.reorderLevel as number | undefined) ?? null,
            minimumStock: (v.minimumStock as number | undefined) ?? null,
            maximumStock: (v.maximumStock as number | undefined) ?? null,
            batchTracked: v.batchTracked === "yes",
            serialTracked: v.serialTracked === "yes",
            isActive: v.isActive !== "no",
            description: (v.description as string | undefined) ?? "",
          };
          let createdProduct: ScmProduct | null = null;
          try {
            if (editing) await update.mutateAsync({ id: editing.id, input });
            else {
              createdProduct = await create.mutateAsync({
                ...input,
                barcode: (v.barcode as string | undefined) || undefined,
                warehouseId:
                  (v.openingWarehouseId as number | undefined) || undefined,
              });
            }
          } catch (err) {
            throw new Error(errorText(err, "Failed to save product"));
          }
          const openingQty = Number(v.openingQuantity ?? 0);
          if (createdProduct && openingQty > 0 && v.openingWarehouseId) {
            // Opening stock is best-effort: the product exists either way, so a
            // failure here is reported separately instead of failing the save.
            try {
              await openingBalance.mutateAsync({
                productId: createdProduct.id,
                warehouseId: Number(v.openingWarehouseId),
                quantity: openingQty,
                unitCost:
                  v.openingUnitCost === undefined || v.openingUnitCost === ""
                    ? undefined
                    : Number(v.openingUnitCost),
              });
            } catch (err) {
              toast({
                title: errorText(
                  err,
                  "Product created, but opening stock failed to post",
                ),
                variant: "error",
              });
              closeForm();
              return;
            }
          }
          toast({
            title: editing
              ? "Product updated"
              : openingQty > 0
                ? `Product created with ${openingQty} opening stock`
                : "Product created",
            variant: "success",
          });
          closeForm();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete product?"
        description={`"${deleting?.name ?? ""}" will be removed. Products with stock history can't be deleted — mark them inactive instead.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast({ title: `Deleted "${deleting.name}"`, variant: "success" });
          } catch (err) {
            toast({
              title: errorText(err, "Could not delete product"),
              variant: "error",
            });
          }
          setDeleting(null);
        }}
      />
    </ScmListView>
  );
}
