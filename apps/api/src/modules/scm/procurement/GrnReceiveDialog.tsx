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
import { toast } from "sonner";
import type { InventorySettings, ScmPurchaseOrder, Warehouse } from "@/types";
import {
  errorMessage,
  formatStatusLabel,
  toLocalDateKey,
} from "@/modules/scm/shared/format";
import { pendingReceiptQty } from "@/modules/scm/shared/businessRules";
import {
  createAndPostGrn,
  parseSerials,
  validateGrnLines,
  type GrnLineInput,
} from "./grnService";

type ReceiveDraft = {
  poLineIndex: number;
  productCode: string;
  productName: string;
  uom: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  receivingQuantity: string;
  rejectedQuantity: string;
  batchNumber: string;
  serialNumbersText: string;
  unitCost: string;
  notes: string;
};

function buildDraftItems(po: ScmPurchaseOrder): ReceiveDraft[] {
  return po.items
    .map((it, poLineIndex) => ({ it, poLineIndex }))
    .filter(({ it }) => pendingReceiptQty(it) > 0)
    .map(({ it, poLineIndex }) => ({
      poLineIndex,
      productCode: it.productCode,
      productName: it.productName,
      uom: it.uom,
      orderedQuantity: it.quantity,
      previouslyReceivedQuantity: it.receivedQuantity || 0,
      receivingQuantity: String(pendingReceiptQty(it)),
      rejectedQuantity: "0",
      batchNumber: "",
      serialNumbersText: "",
      unitCost: String(it.unitPrice || 0),
      notes: "",
    }));
}

function toLineInput(d: ReceiveDraft): GrnLineInput {
  return {
    poLineIndex: d.poLineIndex,
    productCode: d.productCode,
    productName: d.productName,
    uom: d.uom,
    orderedQuantity: d.orderedQuantity,
    previouslyReceivedQuantity: d.previouslyReceivedQuantity,
    receivingQuantity: Number(d.receivingQuantity) || 0,
    rejectedQuantity: Number(d.rejectedQuantity) || 0,
    batchNumber: d.batchNumber,
    serialNumbers: parseSerials(d.serialNumbersText),
    unitCost: d.unitCost.trim() === "" ? 0 : Number(d.unitCost),
    notes: d.notes,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivablePos: ScmPurchaseOrder[];
  initialPoId?: string;
  warehouses: Warehouse[];
  settingsByCode: Map<string, InventorySettings>;
  performedBy: string;
  onSaved: () => void;
}

export default function GrnReceiveDialog({
  open,
  onOpenChange,
  receivablePos,
  initialPoId,
  warehouses,
  settingsByCode,
  performedBy,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [receiptDate, setReceiptDate] = useState(toLocalDateKey());
  const [notes, setNotes] = useState("");
  const [draftItems, setDraftItems] = useState<ReceiveDraft[]>([]);

  const selectPo = (id: string) => {
    setSelectedPoId(id);
    const po = receivablePos.find((p) => p.id === id);
    setDraftItems(po ? buildDraftItems(po) : []);
  };

  useEffect(() => {
    if (!open) return;
    setReceiptDate(toLocalDateKey());
    setNotes("");
    selectPo(initialPoId || "");
    // Only reset when the dialog opens — not on every list reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPoId]);

  const selectedPo = receivablePos.find((p) => p.id === selectedPoId) || null;
  const update = (idx: number, patch: Partial<ReceiveDraft>) =>
    setDraftItems((arr) =>
      arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );

  const handleFinalize = async () => {
    if (!selectedPo) {
      toast.error("Select a purchase order to receive against");
      return;
    }
    const lines = draftItems
      .filter((d) => Number(d.receivingQuantity) > 0)
      .map(toLineInput);
    const invalid = validateGrnLines(lines, settingsByCode);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setSaving(true);
    try {
      const { grnNumber, poStatus } = await createAndPostGrn({
        po: selectedPo,
        lines,
        receiptDate,
        notes,
        performedBy,
      });
      toast.success(
        `GRN ${grnNumber} finalized — stock ledger updated, PO is now ${formatStatusLabel(poStatus)}`,
      );
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to finalize goods receipt"));
    } finally {
      setSaving(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Purchase Order *</Label>
              <Select value={selectedPoId} onValueChange={selectPo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {receivablePos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.poNumber} — {p.vendorNameSnapshot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt Date *</Label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
          </div>
          {selectedPo && (
            <div className="text-sm text-muted-foreground">
              Warehouse:{" "}
              {warehouses.find((w) => w.id === selectedPo.warehouseId)?.name ||
                selectedPo.warehouseId}
            </div>
          )}

          {draftItems.length === 0 && selectedPo && (
            <div className="text-sm text-muted-foreground italic">
              Every item on this purchase order has already been fully received.
            </div>
          )}

          <div className="space-y-2">
            {draftItems.map((d, idx) => {
              const setting = settingsByCode.get(d.productCode);
              const remaining =
                d.orderedQuantity - d.previouslyReceivedQuantity;
              const accepted =
                (Number(d.receivingQuantity) || 0) -
                (Number(d.rejectedQuantity) || 0);
              return (
                <div
                  key={d.poLineIndex}
                  className="border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {d.productName}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        ({d.productCode})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ordered {d.orderedQuantity} · Received{" "}
                      {d.previouslyReceivedQuantity} · Remaining {remaining}
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Receiving Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        value={d.receivingQuantity}
                        onChange={(e) =>
                          update(idx, { receivingQuantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Rejected Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        value={d.rejectedQuantity}
                        onChange={(e) =>
                          update(idx, { rejectedQuantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Accepted</Label>
                      <Input value={accepted} disabled />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        value={d.unitCost}
                        onChange={(e) =>
                          update(idx, { unitCost: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={d.notes}
                        onChange={(e) => update(idx, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                  {setting?.batchTracked && (
                    <div className="space-y-1">
                      <Label className="text-xs">Batch Number *</Label>
                      <Input
                        value={d.batchNumber}
                        onChange={(e) =>
                          update(idx, { batchNumber: e.target.value })
                        }
                        placeholder="Required for batch-tracked items"
                      />
                    </div>
                  )}
                  {setting?.serialTracked && (
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Serial Numbers * (one per line or comma-separated — must
                        equal accepted quantity)
                      </Label>
                      <Textarea
                        rows={2}
                        value={d.serialNumbersText}
                        onChange={(e) =>
                          update(idx, { serialNumbersText: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
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
          <Button
            onClick={handleFinalize}
            disabled={saving || draftItems.length === 0}
          >
            {saving ? "Finalizing..." : "Finalize Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
