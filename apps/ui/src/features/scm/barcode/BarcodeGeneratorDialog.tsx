"use client";

import { Dialog } from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import { SelectField, TextField } from "../shared/form-bits";
import {
  useLocationOptions,
  useProductOptions,
  useSupplierOptions,
  useWarehouseOptions,
} from "../shared/masters";
import { BarcodeLabel } from "./BarcodeLabel";
import { buildQrPayload, productBarcodeValue } from "./codes";
import type { LabelFormat } from "./label-svg";

type Source = "PRODUCT" | "LOCATION" | "WAREHOUSE" | "SUPPLIER" | "CUSTOM";

const SOURCES: { value: Source; label: string }[] = [
  { value: "PRODUCT", label: "Product" },
  { value: "LOCATION", label: "Storage location" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "CUSTOM", label: "Custom value" },
];

/** Generate / print a barcode or QR label for a record — or any custom value. */
export function BarcodeGeneratorDialog({
  open,
  onClose,
  initialFormat,
}: {
  open: boolean;
  onClose: () => void;
  initialFormat: LabelFormat;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Generate Barcode / QR Label"
      size="md"
    >
      {open ? <Body key={initialFormat} initialFormat={initialFormat} /> : null}
    </Dialog>
  );
}

function Body({ initialFormat }: { initialFormat: LabelFormat }) {
  const products = useProductOptions();
  const locations = useLocationOptions();
  const warehouses = useWarehouseOptions();
  const suppliers = useSupplierOptions();
  const [format, setFormat] = useState<LabelFormat>(initialFormat);
  const [source, setSource] = useState<Source>("CUSTOM");
  const [recordId, setRecordId] = useState("");
  const [custom, setCustom] = useState("");
  const [title, setTitle] = useState("");

  const options = useMemo(() => {
    switch (source) {
      case "PRODUCT":
        return (products.data ?? []).map((p) => ({
          value: String(p.id),
          label: `${p.name} (${p.productCode})`,
        }));
      case "LOCATION":
        return (locations.data ?? []).map((l) => ({
          value: String(l.id),
          label: l.locationCode ?? l.binCode,
        }));
      case "WAREHOUSE":
        return (warehouses.data ?? []).map((w) => ({
          value: String(w.id),
          label: `${w.name} (${w.code})`,
        }));
      case "SUPPLIER":
        return (suppliers.data ?? []).map((s) => ({
          value: String(s.id),
          label: `${s.companyName} (${s.supplierCode})`,
        }));
      default:
        return [];
    }
  }, [source, products.data, locations.data, warehouses.data, suppliers.data]);

  const label = useMemo(() => {
    if (source === "CUSTOM") {
      const value = custom.trim();
      return value
        ? {
            value,
            title: title.trim() || value,
            subtitle: undefined,
            footer: undefined,
          }
        : null;
    }
    const id = Number(recordId);
    if (!id) return null;
    if (source === "PRODUCT") {
      const p = (products.data ?? []).find((x) => x.id === id);
      if (!p) return null;
      const value =
        format === "QR"
          ? buildQrPayload("PRODUCT", p.productCode, p.id)
          : productBarcodeValue(p.productCode, p.barcode);
      return {
        value,
        title: p.name,
        subtitle: `SKU ${p.productCode}`,
        footer: undefined,
      };
    }
    if (source === "LOCATION") {
      const l = (locations.data ?? []).find((x) => x.id === id);
      if (!l) return null;
      const code = l.locationCode ?? l.binCode;
      const wh = (warehouses.data ?? []).find((w) => w.id === l.warehouseId);
      return {
        value: format === "QR" ? buildQrPayload("LOCATION", code, l.id) : code,
        title: code,
        subtitle: l.locationName ?? undefined,
        footer: wh ? `Warehouse: ${wh.name}` : undefined,
      };
    }
    if (source === "WAREHOUSE") {
      const w = (warehouses.data ?? []).find((x) => x.id === id);
      if (!w) return null;
      return {
        value:
          format === "QR" ? buildQrPayload("WAREHOUSE", w.code, w.id) : w.code,
        title: w.name,
        subtitle: w.code,
        footer: undefined,
      };
    }
    const s = (suppliers.data ?? []).find((x) => x.id === id);
    if (!s) return null;
    return {
      value:
        format === "QR"
          ? buildQrPayload("SUPPLIER", s.supplierCode, s.id)
          : s.supplierCode,
      title: s.companyName,
      subtitle: s.supplierCode,
      footer: s.status ? `Status: ${s.status}` : undefined,
    };
  }, [
    source,
    recordId,
    custom,
    title,
    format,
    products.data,
    locations.data,
    warehouses.data,
    suppliers.data,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Format"
          value={format}
          onChange={(v) => setFormat(v as LabelFormat)}
          options={[
            { value: "CODE128", label: "Code 128 barcode" },
            { value: "EAN13", label: "EAN-13 barcode" },
            { value: "QR", label: "QR code" },
          ]}
        />
        <SelectField
          label="Source"
          value={source}
          onChange={(v) => {
            setSource(v as Source);
            setRecordId("");
          }}
          options={SOURCES}
        />
      </div>
      {source === "CUSTOM" ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Value" value={custom} onChange={setCustom} />
          <TextField
            label="Label title"
            value={title}
            onChange={setTitle}
            placeholder="Optional"
          />
        </div>
      ) : (
        <SelectField
          label={SOURCES.find((s) => s.value === source)?.label ?? "Record"}
          value={recordId}
          onChange={setRecordId}
          placeholder="Select..."
          options={options}
        />
      )}
      {label ? (
        <BarcodeLabel
          format={format}
          value={label.value}
          title={label.title}
          subtitle={label.subtitle}
          footer={label.footer}
        />
      ) : (
        <p className="text-theme-sm text-gray-500">
          Choose what to label to see a printable preview.
        </p>
      )}
    </div>
  );
}
