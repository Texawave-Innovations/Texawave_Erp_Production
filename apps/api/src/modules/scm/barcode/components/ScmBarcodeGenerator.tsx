// Phase 12 / 12b — generate & print a barcode/QR. Section 7's "Source Type" requirement: pick an
// existing SCM record (Product/Warehouse/Location/Batch/Serial/PO/GRN/Sales Order/Shipment/
// Return) via the shared master-data autocomplete and the value/title/format are derived from
// that real record — never a randomly generated code for something that already exists. "Custom"
// stays available for values with no backing record (a manual document number, a test value).
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ScmBarcodeLabel from "./ScmBarcodeLabel";
import ScmAutocomplete, {
  type ScmAutocompleteOption,
} from "../../components/ScmAutocomplete";
import { buildQrPayload, productBarcodeValue } from "../barcodeHelpers";
import { locationLabel } from "../../warehouse/warehouseHelpers";
import type { BarcodeMasterData } from "../barcodeService";
import type { BarcodeFormat, ScmScanResultType } from "../barcodeTypes";

export interface ScmBarcodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFormat?: BarcodeFormat;
  /** Master data to build the Source Type autocompletes from. Omit to fall back to Custom-only
   * (a page that just wants a plain value → barcode/QR preview, no entity picker). */
  data?: BarcodeMasterData;
}

type SourceType = ScmScanResultType | "CUSTOM";

interface SelectedEntity {
  type: Exclude<SourceType, "CUSTOM">;
  code: string;
  id?: string;
  label: string;
  sublabel?: string;
}

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  PRODUCT: "Product",
  SUPPLIER: "Supplier",
  WAREHOUSE: "Warehouse",
  LOCATION: "Location",
  BATCH: "Batch",
  SERIAL: "Serial Number",
  PURCHASE_REQUISITION: "Purchase Requisition",
  RFQ: "RFQ",
  PURCHASE_ORDER: "Purchase Order",
  GRN: "GRN",
  SALES_ORDER: "Sales Order",
  PICK_LIST: "Pick List",
  PACKAGE: "Package",
  SHIPMENT: "Shipment",
  RETURN: "Return",
  QC_INSPECTION: "QC Inspection",
  QUARANTINE: "Quarantine",
  UNKNOWN: "Unknown",
  CUSTOM: "Custom / Manual Value",
};

const ENTITY_SOURCE_TYPES: Exclude<SourceType, "CUSTOM" | "UNKNOWN">[] = [
  "PRODUCT",
  "SUPPLIER",
  "WAREHOUSE",
  "LOCATION",
  "BATCH",
  "SERIAL",
  "PURCHASE_REQUISITION",
  "RFQ",
  "PURCHASE_ORDER",
  "GRN",
  "SALES_ORDER",
  "PICK_LIST",
  "PACKAGE",
  "SHIPMENT",
  "RETURN",
  "QC_INSPECTION",
  "QUARANTINE",
];

function buildOptions(
  sourceType: SourceType,
  data: BarcodeMasterData | undefined,
): ScmAutocompleteOption<SelectedEntity>[] {
  if (!data) return [];
  switch (sourceType) {
    case "PRODUCT":
      return data.products.map((p) => {
        const setting = data.settings.find(
          (s) => s.productCode === p.productCode,
        );
        const code = productBarcodeValue(p.productCode, setting?.barcode);
        return {
          value: p.productCode,
          label: p.name,
          sublabel: `SKU ${p.productCode}`,
          data: {
            type: "PRODUCT",
            code,
            id: p.productCode,
            label: p.name,
            sublabel: `SKU ${p.productCode}`,
          },
        };
      });
    case "SUPPLIER":
      return data.vendors.map((v) => ({
        value: v.id,
        label: v.companyName,
        sublabel: v.vendorCode,
        data: {
          type: "SUPPLIER",
          code: v.vendorCode,
          id: v.id,
          label: v.companyName,
          sublabel: v.vendorCode,
        },
      }));
    case "WAREHOUSE":
      return data.warehouses.map((w) => ({
        value: w.id,
        label: w.name,
        sublabel: w.code,
        data: {
          type: "WAREHOUSE",
          code: w.code,
          id: w.id,
          label: w.name,
          sublabel: w.code,
        },
      }));
    case "LOCATION":
      return data.locations.map((l) => {
        const code = l.locationCode || l.binCode;
        const wh = data.warehouses.find((w) => w.id === l.warehouseId);
        return {
          value: l.id,
          label: locationLabel(l),
          sublabel: wh?.name || l.warehouseId,
          data: {
            type: "LOCATION",
            code,
            id: l.id,
            label: locationLabel(l),
            sublabel: wh?.name,
          },
        };
      });
    case "BATCH":
      return data.batches.map((b) => ({
        value: b.id,
        label: b.batchNumber,
        sublabel: b.productName,
        data: {
          type: "BATCH",
          code: b.batchNumber,
          id: b.id,
          label: b.batchNumber,
          sublabel: b.productName,
        },
      }));
    case "SERIAL":
      return data.serials.map((s) => ({
        value: s.id,
        label: s.serialNumber,
        sublabel: s.productName,
        data: {
          type: "SERIAL",
          code: s.serialNumber,
          id: s.id,
          label: s.serialNumber,
          sublabel: s.productName,
        },
      }));
    case "PURCHASE_REQUISITION":
      return data.requisitions.map((r) => ({
        value: r.id,
        label: r.requisitionNumber,
        sublabel: r.requestedBy,
        data: {
          type: "PURCHASE_REQUISITION",
          code: r.requisitionNumber,
          id: r.id,
          label: r.requisitionNumber,
          sublabel: r.requestedBy,
        },
      }));
    case "RFQ":
      return data.rfqs.map((r) => ({
        value: r.id,
        label: r.rfqNumber,
        sublabel: r.sourceRequisitionNumber,
        data: {
          type: "RFQ",
          code: r.rfqNumber,
          id: r.id,
          label: r.rfqNumber,
          sublabel: r.sourceRequisitionNumber,
        },
      }));
    case "PURCHASE_ORDER":
      return data.purchaseOrders.map((po) => ({
        value: po.id,
        label: po.poNumber,
        sublabel: po.vendorNameSnapshot,
        data: {
          type: "PURCHASE_ORDER",
          code: po.poNumber,
          id: po.id,
          label: po.poNumber,
          sublabel: po.vendorNameSnapshot,
        },
      }));
    case "GRN":
      return data.grns.map((g) => ({
        value: g.id,
        label: g.grnNumber,
        sublabel: g.vendorNameSnapshot || g.purchaseOrderNumber,
        data: {
          type: "GRN",
          code: g.grnNumber,
          id: g.id,
          label: g.grnNumber,
          sublabel: g.vendorNameSnapshot,
        },
      }));
    case "SALES_ORDER":
      return data.salesOrders.map((so) => ({
        value: so.id,
        label: so.soNumber,
        sublabel: so.customerName,
        data: {
          type: "SALES_ORDER",
          code: so.soNumber,
          id: so.id,
          label: so.soNumber,
          sublabel: so.customerName,
        },
      }));
    case "PICK_LIST":
      return data.pickings.map((p) => ({
        value: p.id,
        label: p.pickNumber,
        sublabel: p.salesOrderNumber,
        data: {
          type: "PICK_LIST",
          code: p.pickNumber,
          id: p.id,
          label: p.pickNumber,
          sublabel: p.salesOrderNumber,
        },
      }));
    case "PACKAGE":
      return data.packings.flatMap((packing) =>
        packing.packages.map((pkg) => {
          const compositeId = `${packing.id}:${pkg.packageNumber}`;
          return {
            value: compositeId,
            label: pkg.packageNumber,
            sublabel: packing.packNumber,
            data: {
              type: "PACKAGE" as const,
              code: pkg.packageNumber,
              id: compositeId,
              label: pkg.packageNumber,
              sublabel: packing.packNumber,
            },
          };
        }),
      );
    case "SHIPMENT":
      return data.shipments.map((sh) => ({
        value: sh.id,
        label: sh.shipmentNumber,
        sublabel: sh.customerNameSnapshot,
        data: {
          type: "SHIPMENT",
          code: sh.shipmentNumber,
          id: sh.id,
          label: sh.shipmentNumber,
          sublabel: sh.customerNameSnapshot,
        },
      }));
    case "RETURN":
      return data.returns.map((r) => ({
        value: r.id,
        label: r.returnNumber,
        sublabel: r.returnType,
        data: {
          type: "RETURN",
          code: r.returnNumber,
          id: r.id,
          label: r.returnNumber,
          sublabel: r.returnType,
        },
      }));
    case "QC_INSPECTION":
      return data.qcInspections.map((i) => ({
        value: i.id,
        label: i.inspectionNumber,
        sublabel: i.inspectionType,
        data: {
          type: "QC_INSPECTION",
          code: i.inspectionNumber,
          id: i.id,
          label: i.inspectionNumber,
          sublabel: i.inspectionType,
        },
      }));
    case "QUARANTINE":
      return data.quarantine.map((q) => ({
        value: q.id,
        label: q.productNameSnapshot,
        sublabel: q.batchNumber || q.productCode,
        data: {
          type: "QUARANTINE",
          code: q.id,
          id: q.id,
          label: q.productNameSnapshot,
          sublabel: q.batchNumber || q.productCode,
        },
      }));
    default:
      return [];
  }
}

export default function ScmBarcodeGenerator({
  open,
  onOpenChange,
  initialFormat = "CODE128",
  data,
}: ScmBarcodeGeneratorProps) {
  const [sourceType, setSourceType] = useState<SourceType>("PRODUCT");
  const [format, setFormat] = useState<BarcodeFormat>(initialFormat);
  const [entity, setEntity] = useState<SelectedEntity | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormat(initialFormat);
    setSourceType(data ? "PRODUCT" : "CUSTOM");
    setEntity(null);
    setCustomValue("");
    setCustomTitle("");
    setCustomSubtitle("");
  }, [open, initialFormat, data]);

  const options = useMemo(
    () => buildOptions(sourceType, data),
    [sourceType, data],
  );

  const isCustom = sourceType === "CUSTOM";
  const rawValue = isCustom ? customValue.trim() : entity?.code || "";
  const title = isCustom ? customTitle.trim() || rawValue : entity?.label || "";
  const subtitle = isCustom
    ? customSubtitle.trim() || undefined
    : entity?.sublabel;
  const encodedValue = !rawValue
    ? ""
    : format === "QR" && !isCustom && entity
      ? buildQrPayload(entity.type, entity.code, entity.id)
      : rawValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Barcode / QR</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Source Type</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => {
                  setSourceType(v as SourceType);
                  setEntity(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data &&
                    ENTITY_SOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SOURCE_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  <SelectItem value="CUSTOM">
                    {SOURCE_TYPE_LABEL.CUSTOM}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as BarcodeFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">Code 128</SelectItem>
                  <SelectItem value="EAN13">EAN-13</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCustom ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Value *</Label>
                <Input
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="SKU, location code, document number..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Label Title</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtitle</Label>
                  <Input
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {SOURCE_TYPE_LABEL[sourceType]} *
              </Label>
              <ScmAutocomplete
                options={options}
                value={entity?.id ?? null}
                onSelect={(opt) => setEntity(opt?.data ?? null)}
                placeholder={
                  data
                    ? `Search ${SOURCE_TYPE_LABEL[sourceType].toLowerCase()}...`
                    : "Master data unavailable"
                }
                searchPlaceholder="Type to search..."
                disabled={!data}
                emptyText={`No ${SOURCE_TYPE_LABEL[sourceType].toLowerCase()} records found.`}
              />
            </div>
          )}

          <div className="pt-2 border-t">
            {encodedValue ? (
              <ScmBarcodeLabel
                format={format}
                value={encodedValue}
                title={title}
                subtitle={subtitle}
              />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">
                {isCustom
                  ? "Enter a value to preview the label."
                  : `Search and select a ${SOURCE_TYPE_LABEL[sourceType].toLowerCase()} to preview the label.`}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
