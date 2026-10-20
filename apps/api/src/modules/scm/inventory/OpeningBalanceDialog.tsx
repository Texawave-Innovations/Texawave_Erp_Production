import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Warehouse } from "@/types";
import type { SellableProduct } from "./productCatalog";
import { postLedgerEntry } from "./stockLedgerService";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage } from "@/modules/scm/shared/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: SellableProduct[];
  warehouses: Warehouse[];
  /** Pre-selected product when opened from a product's inventory detail. */
  defaultProductCode?: string;
  onPosted: () => void;
}

export default function OpeningBalanceDialog({
  open,
  onOpenChange,
  products,
  warehouses,
  defaultProductCode,
  onPosted,
}: Props) {
  const { user } = useAuth();
  const [productCode, setProductCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductCode(defaultProductCode || products[0]?.productCode || "");
    setWarehouseId(warehouses[0]?.id || "");
    setQuantity("");
    setUnitCost("");
    setNotes("");
  }, [open, defaultProductCode, products, warehouses]);

  const handleSubmit = async () => {
    const qty = Number(quantity);
    if (!productCode || !warehouseId) {
      toast.error("Select a product and a warehouse");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Opening quantity must be a positive number");
      return;
    }
    const product = products.find((p) => p.productCode === productCode);
    setSaving(true);
    try {
      await postLedgerEntry({
        productCode,
        productName: product?.name || productCode,
        warehouseId,
        transactionType: "OPENING_BALANCE",
        referenceType: "OPENING_BALANCE",
        quantityIn: qty,
        unitCost: unitCost ? Number(unitCost) : undefined,
        notes: notes.trim() || undefined,
        createdBy: actorName(user),
      });
      toast.success("Opening balance posted to the stock ledger");
      onPosted();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to post opening balance"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post Opening Balance</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Creates an authoritative OPENING_BALANCE entry in the stock ledger.
          This is the only way to seed stock for a product that has no ledger
          history yet — it cannot be edited afterwards; use an Adjustment to
          correct it.
        </p>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Product *</Label>
            <Select value={productCode} onValueChange={setProductCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.productCode} value={p.productCode}>
                    {p.name} ({p.productCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Warehouse *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Opening Quantity *</Label>
              <Input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Cost</Label>
              <Input
                type="number"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
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
            onClick={handleSubmit}
            disabled={
              saving || warehouses.length === 0 || products.length === 0
            }
          >
            {saving ? "Posting..." : "Post Opening Balance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
