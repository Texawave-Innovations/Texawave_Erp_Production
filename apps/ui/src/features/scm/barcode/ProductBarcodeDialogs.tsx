"use client";

import type { BarcodeProductRow, ScmProduct } from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePostOpeningBalance } from "../inventory/hooks";
import { useCreateScmProduct, useUpdateScmProduct } from "../products/hooks";
import { TextField } from "../shared/form-bits";
import { useLocationOptions, useWarehouseOptions } from "../shared/masters";
import { ProductBinFields } from "../shared/ProductBinFields";
import { ScmFormDialog } from "../shared/ScmFormDialog";
import { errorText } from "../shared/use-list-controls";

const nameOf = (p: Pick<BarcodeProductRow, "name" | "productCode">) =>
  `${p.name} (${p.productCode})`;

/** "Generate Barcode": assigns the barcode value and — for a SKU with no
 * batch dates — records its expiry (or marks it not applicable) in the same
 * step, since the printed label carries both. */
export function GenerateBarcodeDialog({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow | null;
  full: ScmProduct | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      title="Generate Barcode"
      size="sm"
    >
      {product ? (
        <GenerateBody
          key={product.id}
          product={product}
          full={full}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function GenerateBody({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow;
  full: ScmProduct | undefined;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const batchDated = product.expiry.source === "BATCH";
  const [value, setValue] = useState(product.barcode ?? product.productCode);
  const [expiry, setExpiry] = useState(
    full?.expiryDate?.slice(0, 10) ??
      (product.expiry.source === "PRODUCT" ? (product.expiry.date ?? "") : ""),
  );
  const [notApplicable, setNotApplicable] = useState(
    full?.expiryNotApplicable ?? product.expiry.source === "NOT_APPLICABLE",
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    // Expiry must be entered when a barcode is generated (or flagged not
    // applicable). Batch-tracked products carry real per-batch dates.
    if (!batchDated) {
      if (!notApplicable && !expiry) {
        return setError("Enter the expiry date (or mark it not applicable)");
      }
      if (
        !notApplicable &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
          Number.isNaN(new Date(expiry).getTime()))
      ) {
        return setError("Enter a valid expiry date");
      }
    }
    setError(null);
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          barcode: value.trim() || null,
          ...(batchDated
            ? {}
            : {
                expiryDate: notApplicable ? null : expiry,
                expiryNotApplicable: notApplicable,
              }),
        },
      });
      toast({ title: "Barcode assigned", variant: "success" });
      onClose();
    } catch (err) {
      // A 409 means another product already uses this barcode.
      setError(errorText(err, "Failed to assign barcode"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-500">{nameOf(product)}</p>
      <TextField
        label="Barcode Value"
        value={value}
        onChange={(v) => {
          setValue(v);
          setError(null);
        }}
      />
      {batchDated ? (
        <p className="text-theme-xs text-gray-500">
          Batch tracked — expiry is taken from each batch.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-theme-sm">
            <span>Expiry not applicable</span>
            <Checkbox
              checked={notApplicable}
              onChange={(e) => {
                setNotApplicable(e.target.checked);
                setError(null);
              }}
            />
          </label>
          {!notApplicable ? (
            <TextField
              label="Expiry Date"
              type="date"
              required
              value={expiry}
              onChange={(v) => {
                setExpiry(v);
                setError(null);
              }}
            />
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-theme-xs text-error-600">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={update.isPending}
        >
          Cancel
        </Button>
        <Button loading={update.isPending} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** "Assign Bin Location" for one product. */
export function AssignBinDialog({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow | null;
  full: ScmProduct | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={product !== null && full !== undefined}
      onClose={onClose}
      title="Assign Bin Location"
      size="sm"
    >
      {product && full ? (
        <AssignBinBody
          key={product.id}
          product={product}
          full={full}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function AssignBinBody({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow;
  full: ScmProduct;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const warehouses = useWarehouseOptions();
  const locations = useLocationOptions();
  const locs = locations.data ?? [];
  const fromBin = full.binLocationId
    ? locs.find((l) => l.id === full.binLocationId)?.warehouseId
    : undefined;
  const [warehouseOverride, setWarehouseOverride] = useState<string | null>(
    null,
  );
  const [bin, setBin] = useState(
    full.binLocationId ? String(full.binLocationId) : "",
  );
  const derived = full.warehouseId ?? fromBin;
  const warehouseId = warehouseOverride ?? (derived ? String(derived) : "");

  async function save() {
    if (!warehouseId) {
      return toast({
        title: "Select a warehouse before assigning a bin",
        variant: "error",
      });
    }
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          warehouseId: Number(warehouseId),
          binLocationId: bin ? Number(bin) : null,
        },
      });
      toast({ title: "Bin location assigned", variant: "success" });
      onClose();
    } catch (err) {
      toast({
        title: errorText(err, "Failed to assign bin location"),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-500">{nameOf(product)}</p>
      <ProductBinFields
        warehouses={warehouses.data ?? []}
        locations={locs}
        warehouseId={warehouseId}
        onWarehouseChange={setWarehouseOverride}
        binLocationId={bin}
        onBinChange={setBin}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={update.isPending}
        >
          Cancel
        </Button>
        <Button loading={update.isPending} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** "Set Expiry Date" for a non-batch SKU. */
export function SetExpiryDialog({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow | null;
  full: ScmProduct | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      title="Set Expiry Date"
      size="sm"
    >
      {product ? (
        <ExpiryBody
          key={product.id}
          product={product}
          full={full}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function ExpiryBody({
  product,
  full,
  onClose,
}: {
  product: BarcodeProductRow;
  full: ScmProduct | undefined;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const [date, setDate] = useState(full?.expiryDate?.slice(0, 10) ?? "");
  const [na, setNa] = useState(full?.expiryNotApplicable ?? false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const v = date.trim();
    if (v && Number.isNaN(new Date(v).getTime()))
      return setError("Enter a valid date");
    setError(null);
    try {
      await update.mutateAsync({
        id: product.id,
        input: { expiryDate: na ? null : v || null, expiryNotApplicable: na },
      });
      toast({ title: "Expiry date saved", variant: "success" });
      onClose();
    } catch (err) {
      toast({
        title: errorText(err, "Failed to save expiry date"),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-500">{nameOf(product)}</p>
      <label className="flex items-center justify-between gap-3 text-theme-sm">
        <span>Not applicable (this SKU doesn&apos;t expire)</span>
        <Checkbox
          checked={na}
          onChange={(e) => {
            setNa(e.target.checked);
            setError(null);
          }}
        />
      </label>
      {!na ? (
        <label className="flex flex-col gap-1.5 text-theme-sm">
          Expiry Date
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </label>
      ) : null}
      {error ? <p className="text-theme-xs text-error-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={update.isPending}
        >
          Cancel
        </Button>
        <Button loading={update.isPending} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** "Add Product": the one place the barcode workspace creates a product —
 * prefilled with a scanned value that matched nothing. */
export function AddProductDialog({
  open,
  initialCode,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialCode: string | undefined;
  onClose: () => void;
  onCreated: (product: ScmProduct) => void;
}) {
  const { toast } = useToast();
  const create = useCreateScmProduct();
  const opening = usePostOpeningBalance();

  return (
    <ScmFormDialog
      key={initialCode ?? "new"}
      open={open}
      onClose={onClose}
      title="Add Product"
      submitLabel="Create Product"
      initialValues={{
        uom: "PCS",
        unitPrice: 0,
        productCode: initialCode ?? "",
      }}
      fields={[
        {
          name: "name",
          label: "Product Name",
          type: "text",
          required: true,
          span: 2,
          placeholder: "e.g., Bolt Net",
        },
        {
          name: "productCode",
          label: "SKU / Product Code",
          type: "text",
          required: true,
          upper: true,
          mono: true,
        },
        {
          name: "category",
          label: "Category",
          type: "text",
          placeholder: "Optional",
        },
        {
          name: "unitPrice",
          label: "Unit Price (₹)",
          type: "number",
          required: true,
          min: 0,
          step: 0.01,
        },
        {
          name: "uom",
          label: "Unit (UOM)",
          type: "text",
          required: true,
          upper: true,
        },
        {
          name: "hsn",
          label: "HSN (Tax Code)",
          type: "text",
          placeholder: "Optional",
        },
        {
          name: "barcode",
          label: "Barcode / QR Value",
          type: "text",
          mono: true,
          span: 2,
          placeholder: "Optional — leave blank to auto-generate from SKU",
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
          placeholder: "Optional",
        },
        {
          name: "openingUnitCost",
          label: "Unit Cost",
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "Optional",
        },
      ]}
      validate={(v) =>
        Number(v.openingQuantity || 0) > 0 && !v.openingWarehouseId
          ? {
              openingWarehouseId: "Select a warehouse for the opening quantity",
            }
          : null
      }
      onSubmit={async (v) => {
        let product: ScmProduct;
        try {
          product = await create.mutateAsync({
            productCode: v.productCode as string,
            name: v.name as string,
            category: (v.category as string | undefined) ?? "",
            uom: v.uom as string,
            hsn: (v.hsn as string | undefined) ?? "",
            unitPrice: (v.unitPrice as number | undefined) ?? 0,
            barcode: (v.barcode as string | undefined) || undefined,
            warehouseId:
              (v.openingWarehouseId as number | undefined) || undefined,
          });
        } catch (err) {
          throw new Error(errorText(err, "Failed to create product"));
        }
        const qty = Number(v.openingQuantity ?? 0);
        if (qty > 0 && v.openingWarehouseId) {
          // Best-effort: the product exists either way.
          try {
            await opening.mutateAsync({
              productId: product.id,
              warehouseId: Number(v.openingWarehouseId),
              quantity: qty,
              unitCost:
                v.openingUnitCost === undefined || v.openingUnitCost === ""
                  ? undefined
                  : Number(v.openingUnitCost),
            });
          } catch (err) {
            toast({
              title: `Product created, but opening stock failed: ${errorText(err, "could not post")}`,
              variant: "error",
            });
            onCreated(product);
            return;
          }
        }
        toast({
          title:
            qty > 0
              ? `Product "${product.name}" created with ${qty} opening stock`
              : `Product "${product.name}" created`,
          variant: "success",
        });
        onCreated(product);
      }}
    />
  );
}
