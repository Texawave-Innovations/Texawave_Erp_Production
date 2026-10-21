"use client";

import type { ScmProduct } from "@texawave-erp/api-types";
import { Button, Card, Checkbox, useToast } from "@texawave-erp/ui-kit";
import { Barcode as BarcodeIcon, Tag } from "lucide-react";
import { useState } from "react";
import { buildQrPayload, productBarcodeValue } from "../../barcode/codes";
import { LabelDialog } from "../../barcode/LabelDialog";
import type { BarcodeLabelProps } from "../../barcode/BarcodeLabel";
import { useUpdateScmProduct } from "../../products/hooks";
import { TextField } from "../../shared/form-bits";
import { type ProductExpiryInfo, productLabelLines } from "../../shared/expiry";
import { formatDateTime } from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";

/** Product barcode card for the Inventory product detail page: shows the
 * assigned (or derived) barcode value, generates one when missing — the
 * same expiry-first rule as Barcode Utilities, since the printed label
 * carries both — and opens a printable Code128 + secondary product-URL QR
 * label. */
export function ProductBarcodeCard({
  product,
  expiryInfo,
  canEdit,
  batchDated,
}: {
  product: ScmProduct;
  expiryInfo: ProductExpiryInfo;
  canEdit: boolean;
  batchDated: boolean;
}) {
  const { toast } = useToast();
  const update = useUpdateScmProduct();
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState<BarcodeLabelProps | null>(null);
  const [value, setValue] = useState(product.barcode ?? product.productCode);
  const [expiry, setExpiry] = useState(product.expiryDate?.slice(0, 10) ?? "");
  const [notApplicable, setNotApplicable] = useState(
    product.expiryNotApplicable,
  );
  const [error, setError] = useState<string | null>(null);

  const barcodeValue = productBarcodeValue(
    product.productCode,
    product.barcode,
  );

  async function generate() {
    if (!batchDated) {
      if (!notApplicable && !expiry) {
        setError("Enter the expiry date (or mark it not applicable)");
        return;
      }
      if (
        !notApplicable &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
          Number.isNaN(new Date(expiry).getTime()))
      ) {
        setError("Enter a valid expiry date");
        return;
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
      setGenerating(false);
    } catch (err) {
      setError(errorText(err, "Failed to assign barcode"));
    }
  }

  function openLabel() {
    setLabel({
      format: "CODE128",
      value: barcodeValue,
      title: product.name,
      subtitle: `SKU ${product.productCode}`,
      lines: productLabelLines(product.barcodeCreatedAt, expiryInfo),
      secondaryQr: buildQrPayload("PRODUCT", product.productCode, product.id),
      secondaryQrLabel: "Scan to open this product",
    });
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-theme-sm font-semibold">Barcode</h2>
        {!generating ? (
          product.barcode ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-theme-sm">{barcodeValue}</p>
                <p className="text-theme-xs text-gray-500">
                  {product.barcodeCreatedAt
                    ? `Created ${formatDateTime(product.barcodeCreatedAt)}`
                    : "Barcode assigned"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={openLabel}>
                  <Tag className="mr-1.5 h-3.5 w-3.5" /> View / Print Label
                </Button>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setGenerating(true)}
                  >
                    Change
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-theme-sm text-gray-500">
                No barcode assigned yet — derived from SKU (
                {product.productCode}) until one is generated.
              </p>
              {canEdit ? (
                <Button size="sm" onClick={() => setGenerating(true)}>
                  <BarcodeIcon className="mr-1.5 h-3.5 w-3.5" /> Generate
                  Barcode
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
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
                size="sm"
                onClick={() => setGenerating(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={update.isPending}
                onClick={() => void generate()}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
      <LabelDialog
        open={label !== null}
        onClose={() => setLabel(null)}
        dialogTitle="Product Label"
        label={label}
      />
    </Card>
  );
}
