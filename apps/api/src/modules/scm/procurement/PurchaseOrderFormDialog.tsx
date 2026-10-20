import { useEffect, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  SupplierQuotation,
  ScmPurchaseOrderItem,
  Vendor,
  Warehouse,
} from "@/types";
import type { SellableProduct } from "@/modules/scm/inventory/productCatalog";
import { DEFAULT_UOM } from "@/modules/scm/inventory/productCatalog";
import { logRecordAudit } from "@/services/auditLog";
import { isSupplierActive } from "@/modules/scm/shared/businessRules";
import {
  errorMessage,
  formatCurrency,
  toLocalDateKey,
} from "@/modules/scm/shared/format";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  documentTotals,
  duplicateProductCode,
  lineTotal,
  validatePricing,
} from "./procurementHelpers";
import { createPurchaseOrder } from "./purchaseOrderService";

type ItemDraft = {
  productCode: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};
function emptyItem(): ItemDraft {
  return {
    productCode: "",
    quantity: "",
    unitPrice: "",
    discount: "0",
    taxRate: "0",
  };
}

function emptyForm(warehouseId = "", q?: SupplierQuotation | null) {
  return {
    vendorId: q?.vendorId || "",
    poDate: toLocalDateKey(),
    expectedDeliveryDate: q?.validUntil || "",
    warehouseId,
    deliveryLocation: "",
    paymentTerms: q?.paymentTerms || "",
    currency: q?.currency || "INR",
    freight: String(q?.freight || 0),
    discount: String(q?.discount || 0),
    notes: "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceQuotation: SupplierQuotation | null;
  vendors: Vendor[];
  activeVendors: Vendor[];
  products: SellableProduct[];
  warehouses: Warehouse[];
  performedBy: string;
  onSaved: () => void;
}

export default function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  sourceQuotation,
  vendors,
  activeVendors,
  products,
  warehouses,
  performedBy,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(warehouses[0]?.id || "", sourceQuotation));
    setItems(
      sourceQuotation
        ? sourceQuotation.items.map((it) => ({
            productCode: it.productCode,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
            discount: String(it.discount),
            taxRate: String(it.taxRate),
          }))
        : [emptyItem()],
    );
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceQuotation]);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((arr) => arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const computedItems = (): ScmPurchaseOrderItem[] =>
    items
      .filter((it) => it.productCode && Number(it.quantity) > 0)
      .map((it) => {
        const product = products.find((p) => p.productCode === it.productCode);
        const quantity = Number(it.quantity) || 0;
        const unitPrice = Number(it.unitPrice) || 0;
        const discount = Number(it.discount) || 0;
        const taxRate = Number(it.taxRate) || 0;
        const { taxAmount, total } = lineTotal(
          quantity,
          unitPrice,
          discount,
          taxRate,
        );
        return {
          productCode: it.productCode,
          productName: product?.name || it.productCode,
          uom: product?.uom || DEFAULT_UOM,
          quantity,
          receivedQuantity: 0,
          unitPrice,
          discount,
          taxRate,
          taxAmount,
          total,
        };
      });

  const handleSave = async () => {
    if (!form.vendorId) {
      toast.error("Select a supplier");
      return;
    }
    const vendor = vendors.find((v) => v.id === form.vendorId);
    if (!vendor || !isSupplierActive(vendor.status)) {
      toast.error("Purchase orders can only be raised for active suppliers");
      return;
    }
    if (!form.warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    const lineItems = computedItems();
    if (lineItems.length === 0) {
      toast.error("Add at least one item with a positive quantity");
      return;
    }
    const dup = duplicateProductCode(lineItems);
    if (dup) {
      toast.error(
        `${dup} appears on more than one line — combine them into one line`,
      );
      return;
    }
    const freight = Number(form.freight) || 0;
    const discount = Number(form.discount) || 0;
    const invalid = validatePricing(lineItems, freight, discount);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setSaving(true);
    try {
      const { subtotal, taxAmount, total } = documentTotals(
        lineItems,
        freight,
        discount,
      );
      const { id, poNumber } = await createPurchaseOrder({
        vendorId: form.vendorId,
        vendorNameSnapshot: vendor.companyName,
        vendorGSTINSnapshot: vendor.gst,
        sourceQuotationId: sourceQuotation?.id,
        sourceQuotationNumber: sourceQuotation?.quotationNumber,
        sourceRfqId: sourceQuotation?.rfqId,
        sourceRfqNumber: sourceQuotation?.rfqNumber,
        poDate: form.poDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        warehouseId: form.warehouseId,
        deliveryLocation: form.deliveryLocation.trim() || undefined,
        paymentTerms: form.paymentTerms.trim() || undefined,
        currency: form.currency.trim().toUpperCase() || "INR",
        items: lineItems,
        freight,
        discount,
        subtotal,
        taxAmount,
        total,
        notes: form.notes.trim() || undefined,
        createdBy: performedBy,
      });
      await logRecordAudit(
        PROCUREMENT_PATHS.purchaseOrders,
        id,
        "Purchase order created",
        performedBy,
        `${poNumber} — ${vendor.companyName}`,
      );
      toast.success(`Purchase order ${poNumber} created as draft`);
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create purchase order"));
    } finally {
      setSaving(false);
    }
  };

  const chosenCodes = new Set(
    items.map((it) => it.productCode).filter(Boolean),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            New Purchase Order
            {sourceQuotation ? ` from ${sourceQuotation.quotationNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select
                value={form.vendorId}
                onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v }))}
                disabled={!!sourceQuotation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {(sourceQuotation
                    ? vendors.filter((v) => v.id === sourceQuotation.vendorId)
                    : activeVendors
                  ).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse *</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, warehouseId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>PO Date *</Label>
              <Input
                type="date"
                value={form.poDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, poDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery</Label>
              <Input
                type="date"
                value={form.expectedDeliveryDate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expectedDeliveryDate: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                maxLength={3}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    currency: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Location</Label>
            <Input
              value={form.deliveryLocation}
              onChange={(e) =>
                setForm((f) => ({ ...f, deliveryLocation: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              {!sourceQuotation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((i) => [...i, emptyItem()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const computed = lineTotal(
                  Number(it.quantity) || 0,
                  Number(it.unitPrice) || 0,
                  Number(it.discount) || 0,
                  Number(it.taxRate) || 0,
                );
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end border rounded-md p-2"
                  >
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={it.productCode}
                        onValueChange={(v) =>
                          updateItem(idx, { productCode: v })
                        }
                        disabled={!!sourceQuotation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter(
                              (p) =>
                                p.productCode === it.productCode ||
                                !chosenCodes.has(p.productCode),
                            )
                            .map((p) => (
                              <SelectItem
                                key={p.productCode}
                                value={p.productCode}
                              >
                                {p.name} ({p.productCode})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) =>
                          updateItem(idx, { unitPrice: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Disc.</Label>
                      <Input
                        type="number"
                        min="0"
                        value={it.discount}
                        onChange={(e) =>
                          updateItem(idx, { discount: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Tax %</Label>
                      <Input
                        type="number"
                        min="0"
                        value={it.taxRate}
                        onChange={(e) =>
                          updateItem(idx, { taxRate: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 text-sm text-right font-medium pb-2">
                      {formatCurrency(computed.total, form.currency)}
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      {!sourceQuotation && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems((arr) => arr.filter((_, i2) => i2 !== idx))
                          }
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Freight</Label>
              <Input
                type="number"
                min="0"
                value={form.freight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, freight: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Overall Discount</Label>
              <Input
                type="number"
                min="0"
                value={form.discount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
