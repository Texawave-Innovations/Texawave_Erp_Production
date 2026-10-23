"use client";

import type {
  ScmLocation,
  ScmProduct,
  ScmWarehouse,
} from "@texawave-erp/api-types";
import { Button, Card, Checkbox, Input, useToast } from "@texawave-erp/ui-kit";
import { Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { useUpdateScmProduct } from "../../products/hooks";
import {
  expiryStatusLabel,
  expiryTone,
  formatProductExpiry,
  type ProductExpiryInfo,
} from "../../shared/expiry";
import { ProductBinFields } from "../../shared/ProductBinFields";
import { errorText } from "../../shared/use-list-controls";

export interface ProductBinCardProps {
  product: ScmProduct;
  warehouses: readonly ScmWarehouse[];
  locations: readonly ScmLocation[];
  /** Warehouses that hold stock of the product (used to pre-pick a warehouse). */
  stockWarehouseIds: readonly number[];
  canEdit: boolean;
  /** True when the product has batch/serial records (their bins are per lot). */
  lotTracked: boolean;
}

/** Product page "Bin Location": the product's warehouse and default bin.
 * The warehouse is never guessed from the first one in the list — it is
 * derived from the product's own warehouse, else its bin's warehouse, else the
 * single warehouse that holds stock — until the user picks one themselves. */
export function ProductBinCard({
  product,
  warehouses,
  locations,
  stockWarehouseIds,
  canEdit,
  lotTracked,
}: ProductBinCardProps) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const [warehouseOverride, setWarehouseOverride] = useState<string | null>(
    null,
  );
  const [binOverride, setBinOverride] = useState<string | null>(null);

  const fromBin = product.binLocationId
    ? locations.find((l) => l.id === product.binLocationId)?.warehouseId
    : undefined;
  const derivedIds = product.warehouseId
    ? [product.warehouseId]
    : fromBin
      ? [fromBin]
      : stockWarehouseIds;
  const warehouseId =
    warehouseOverride ?? (derivedIds.length === 1 ? String(derivedIds[0]) : "");
  const binLocationId =
    binOverride ?? (product.binLocationId ? String(product.binLocationId) : "");

  async function save() {
    if (!warehouseId) {
      toast({
        title: "Select a warehouse before assigning a bin",
        variant: "error",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          warehouseId: Number(warehouseId),
          binLocationId: binLocationId ? Number(binLocationId) : null,
        },
      });
      toast({ title: "Bin location saved", variant: "success" });
      setWarehouseOverride(null);
      setBinOverride(null);
    } catch (err) {
      toast({
        title: errorText(err, "Failed to save bin location"),
        variant: "error",
      });
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Bin Location
        </h2>
        <ProductBinFields
          warehouses={warehouses}
          locations={locations}
          warehouseId={warehouseId}
          onWarehouseChange={setWarehouseOverride}
          binLocationId={binLocationId}
          onBinChange={setBinOverride}
          stockWarehouseIds={stockWarehouseIds}
        />
        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              loading={update.isPending}
              onClick={() => void save()}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
            {!lotTracked ? (
              <p className="text-theme-xs text-gray-500">
                Not batch/serial tracked — this sets the bin shown on scans and
                the Barcode Utilities table.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export interface ProductExpiryCardProps {
  product: ScmProduct;
  expiryInfo: ProductExpiryInfo;
  canEdit: boolean;
}

/** Product page "Product Life & Expiry". Batch-tracked products always show
 * their real per-lot dates (never overwritten); the editable product-level
 * date only applies when there is no batch expiry data to defer to. */
export function ProductExpiryCard({
  product,
  expiryInfo,
  canEdit,
}: ProductExpiryCardProps) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftNotApplicable, setDraftNotApplicable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = draftDate.trim();
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(new Date(value).getTime()))
    ) {
      setError("Enter a valid date");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          expiryDate: draftNotApplicable ? null : value || null,
          expiryNotApplicable: draftNotApplicable,
        },
      });
      toast({ title: "Expiry date saved", variant: "success" });
      setEditing(false);
    } catch (err) {
      toast({
        title: errorText(err, "Failed to save expiry date"),
        variant: "error",
      });
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Product Life &amp; Expiry
        </h2>
        {expiryInfo.source === "BATCH" ? (
          <>
            <p className="text-theme-xs text-gray-500">
              This SKU is batch tracked — expiry is per batch and shown below
              (also see Batches). The manual product-level date doesn&apos;t
              apply here.
            </p>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {expiryInfo.batches.map((b) => (
                <div
                  key={b.batchNumber}
                  className="flex items-center justify-between border-b border-gray-100 pb-2 text-theme-sm last:border-0 dark:border-gray-800"
                >
                  <span className="font-mono">{b.batchNumber}</span>
                  <span className="flex items-center gap-2">
                    <span>{b.expiryDate}</span>
                    <span
                      className={`text-theme-xs font-medium ${expiryTone(b.status)}`}
                    >
                      {expiryStatusLabel(b.status)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : editing ? (
          <div className="flex max-w-sm flex-col gap-3">
            <label className="flex items-center justify-between gap-3 text-theme-sm">
              <span>Not applicable (this SKU doesn&apos;t expire)</span>
              <Checkbox
                checked={draftNotApplicable}
                onChange={(e) => {
                  setDraftNotApplicable(e.target.checked);
                  setError(null);
                }}
              />
            </label>
            {!draftNotApplicable ? (
              <label className="flex flex-col gap-1.5 text-theme-sm">
                Expiry Date
                <Input
                  type="date"
                  value={draftDate}
                  onChange={(e) => {
                    setDraftDate(e.target.value);
                    setError(null);
                  }}
                />
              </label>
            ) : null}
            {error ? (
              <p className="text-theme-xs text-error-600">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={update.isPending}
                onClick={() => void save()}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={update.isPending}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-theme-xs text-gray-500">Expiry Date</div>
              <div
                className={`text-theme-sm font-medium ${expiryTone(expiryInfo.status)}`}
              >
                {formatProductExpiry(expiryInfo)}
              </div>
            </div>
            {canEdit ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraftDate(product.expiryDate?.slice(0, 10) ?? "");
                  setDraftNotApplicable(product.expiryNotApplicable);
                  setError(null);
                  setEditing(true);
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
