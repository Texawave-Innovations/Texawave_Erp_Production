import { useEffect, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createRecord, updateRecord } from "@/services/firebase";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { logRecordAudit } from "@/services/auditLog";
import type {
  PurchaseRequisition,
  PurchaseRequisitionItem,
  RequisitionPriority,
  RequisitionStatus,
  Warehouse,
} from "@/types";
import {
  emptyRequisitionForm,
  emptyRequisitionItem,
  type RequisitionFormState,
  type RequisitionItemDraft,
  type RequisitionPrefill,
} from "./requisitionForm";
import {
  DEFAULT_UOM,
  type SellableProduct,
} from "@/modules/scm/inventory/productCatalog";
import { errorMessage, formatCurrency } from "@/modules/scm/shared/format";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import { duplicateProductCode } from "./procurementHelpers";

const PRIORITIES: RequisitionPriority[] = ["Low", "Normal", "High", "Urgent"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: PurchaseRequisition | null;
  prefill: RequisitionPrefill | null;
  products: SellableProduct[];
  warehouses: Warehouse[];
  performedBy: string;
  onSaved: () => void;
}

export default function RequisitionFormDialog({
  open,
  onOpenChange,
  editing,
  prefill,
  products,
  warehouses,
  performedBy,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RequisitionFormState>(
    emptyRequisitionForm(),
  );
  const [items, setItems] = useState<RequisitionItemDraft[]>([
    emptyRequisitionItem(),
  ]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        department: editing.department || "",
        requestDate: editing.requestDate,
        requiredDate: editing.requiredDate || "",
        priority: editing.priority,
        warehouseId: editing.warehouseId,
        purpose: editing.purpose || "",
        notes: editing.notes || "",
        tax: String(editing.tax || 0),
      });
      setItems(
        editing.items.map((it) => ({
          productCode: it.productCode,
          quantity: String(it.quantity),
          estimatedUnitCost: String(it.estimatedUnitCost),
          requiredDate: it.requiredDate || "",
          notes: it.notes || "",
        })),
      );
    } else if (prefill) {
      setForm(prefill.form);
      setItems(prefill.items);
    } else {
      setForm(emptyRequisitionForm(warehouses[0]?.id || ""));
      setItems([emptyRequisitionItem()]);
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, prefill]);

  const updateItem = (idx: number, patch: Partial<RequisitionItemDraft>) =>
    setItems((arr) => arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const computedItems = (): PurchaseRequisitionItem[] =>
    items
      .filter((it) => it.productCode && Number(it.quantity) > 0)
      .map((it) => {
        const product = products.find((p) => p.productCode === it.productCode);
        const quantity = Number(it.quantity) || 0;
        const estimatedUnitCost = Number(it.estimatedUnitCost) || 0;
        return {
          productCode: it.productCode,
          productName: product?.name || it.productCode,
          uom: product?.uom || DEFAULT_UOM,
          quantity,
          estimatedUnitCost,
          estimatedTotal: Math.round(quantity * estimatedUnitCost * 100) / 100,
          requiredDate: it.requiredDate || undefined,
          notes: it.notes || undefined,
        };
      });

  const handleSave = async () => {
    if (!form.warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    const lineItems = computedItems();
    if (lineItems.length === 0) {
      toast.error("Add at least one item with a quantity greater than zero");
      return;
    }
    if (lineItems.some((it) => it.estimatedUnitCost < 0)) {
      toast.error("Estimated unit cost cannot be negative");
      return;
    }
    const dup = duplicateProductCode(lineItems);
    if (dup) {
      toast.error(
        `${dup} appears on more than one line — combine them into one line`,
      );
      return;
    }
    const tax = Number(form.tax) || 0;
    if (tax < 0) {
      toast.error("Tax cannot be negative");
      return;
    }

    setSaving(true);
    try {
      const subtotal = lineItems.reduce((s, it) => s + it.estimatedTotal, 0);
      const payload = {
        department: form.department.trim() || undefined,
        requestDate: form.requestDate,
        requiredDate: form.requiredDate || undefined,
        priority: form.priority,
        warehouseId: form.warehouseId,
        purpose: form.purpose.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: lineItems,
        subtotal,
        tax,
        total: subtotal + tax,
      };

      if (editing) {
        await updateRecord(PROCUREMENT_PATHS.requisitions, editing.id, payload);
        await logRecordAudit(
          PROCUREMENT_PATHS.requisitions,
          editing.id,
          "Requisition updated",
          performedBy,
          editing.requisitionNumber,
        );
        toast.success("Requisition updated");
      } else {
        const requisitionNumber = await reserveDocumentNumber(
          "purchaseRequisition",
        );
        const id = await createRecord(PROCUREMENT_PATHS.requisitions, {
          ...payload,
          requisitionNumber,
          requestedBy: performedBy,
          status: "DRAFT" as RequisitionStatus,
          createdBy: performedBy,
          sourceSalesOrderId: prefill?.sourceSalesOrder?.id,
          sourceSalesOrderNumber: prefill?.sourceSalesOrder?.number,
        });
        if (id)
          await logRecordAudit(
            PROCUREMENT_PATHS.requisitions,
            id,
            "Requisition created",
            performedBy,
            requisitionNumber,
          );
        toast.success(`Requisition ${requisitionNumber} created as draft`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save requisition"));
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
            {editing
              ? `Edit Requisition ${editing.requisitionNumber}`
              : "New Purchase Requisition"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Request Date *</Label>
              <Input
                type="date"
                value={form.requestDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requestDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Required Date</Label>
              <Input
                type="date"
                value={form.requiredDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiredDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority *</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, priority: v as RequisitionPriority }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) =>
                  setForm((f) => ({ ...f, department: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input
                value={form.purpose}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purpose: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((i) => [...i, emptyRequisitionItem()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end border rounded-md p-2"
                >
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select
                      value={it.productCode}
                      onValueChange={(v) => updateItem(idx, { productCode: v })}
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
                  <div className="col-span-2 space-y-1">
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
                    <Label className="text-xs">Est. Unit Cost</Label>
                    <Input
                      type="number"
                      min="0"
                      value={it.estimatedUnitCost}
                      onChange={(e) =>
                        updateItem(idx, { estimatedUnitCost: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Required By</Label>
                    <Input
                      type="date"
                      value={it.requiredDate}
                      onChange={(e) =>
                        updateItem(idx, { requiredDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-1 text-sm text-right font-medium pb-2">
                    {formatCurrency(
                      (Number(it.quantity) || 0) *
                        (Number(it.estimatedUnitCost) || 0),
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end pb-1">
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tax (amount)</Label>
              <Input
                type="number"
                min="0"
                value={form.tax}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tax: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="text-right text-sm font-semibold">
            Estimated Total:{" "}
            {formatCurrency(
              computedItems().reduce((s, it) => s + it.estimatedTotal, 0) +
                (Number(form.tax) || 0),
            )}
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
            {saving ? "Saving..." : editing ? "Save Changes" : "Save as Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
