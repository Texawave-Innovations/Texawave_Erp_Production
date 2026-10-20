import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Layers, Tag } from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS, batchKey } from "./inventoryPaths";
import { upsertBatchQuantity } from "./stockLedgerService";
import { useInventoryData } from "./useInventoryData";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { useAuth } from "@/context/AuthContext";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import type { BatchStatus, StockBatch } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { ALL, errorMessage } from "@/modules/scm/shared/format";

const STATUS_TONE: Record<BatchStatus, string> = {
  ACTIVE: "text-emerald-600 border-emerald-200 bg-emerald-50",
  EXPIRED: "text-red-600 border-red-200 bg-red-50",
  QUARANTINED: "text-purple-600 border-purple-200 bg-purple-50",
  BLOCKED: "text-muted-foreground",
};

export default function ScmBatches() {
  const { user } = useAuth();
  const { products, warehouses, error: inventoryError } = useInventoryData();
  useErrorToast(inventoryError);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batchNumber: "",
    productCode: "",
    warehouseId: "",
    manufacturingDate: "",
    expiryDate: "",
  });
  const [labelBatch, setLabelBatch] = useState<StockBatch | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const b = (await getAllRecords(INVENTORY_PATHS.batches)) as StockBatch[];
      setBatches(b.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load batches"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? batches
        : batches.filter((b) => b.status === statusFilter),
    [batches, statusFilter],
  );

  const openForm = () => {
    setForm({
      batchNumber: "",
      productCode: products[0]?.productCode || "",
      warehouseId: warehouses[0]?.id || "",
      manufacturingDate: "",
      expiryDate: "",
    });
    setFormOpen(true);
  };

  // Manual entry only registers the lot's metadata (quantity 0). Batch quantities grow through
  // goods receipts, so creating a batch here never changes on-hand stock.
  const handleSubmit = async () => {
    const batchNumber = form.batchNumber.trim();
    if (!batchNumber || !form.productCode || !form.warehouseId) {
      toast.error("Batch number, product and warehouse are required");
      return;
    }
    if (
      form.manufacturingDate &&
      form.expiryDate &&
      form.expiryDate < form.manufacturingDate
    ) {
      toast.error("Expiry date cannot be before the manufacturing date");
      return;
    }
    const id = batchKey(batchNumber, form.productCode, form.warehouseId);
    if (batches.some((b) => b.id === id)) {
      toast.error(
        `Batch ${batchNumber} already exists for this product and warehouse`,
      );
      return;
    }
    setSaving(true);
    try {
      const product = products.find((p) => p.productCode === form.productCode);
      const performedBy = actorName(user);
      await upsertBatchQuantity({
        batchNumber,
        productCode: form.productCode,
        productName: product?.name || form.productCode,
        warehouseId: form.warehouseId,
        manufacturingDate: form.manufacturingDate || undefined,
        expiryDate: form.expiryDate || undefined,
        quantity: 0,
        createdBy: performedBy,
      });
      await logRecordAudit(
        INVENTORY_PATHS.batches,
        id,
        "Batch created",
        performedBy,
        `${batchNumber} — ${form.productCode}`,
      );
      toast.success("Batch registered");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create batch"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Batches</h2>
          <p className="text-muted-foreground mt-1">
            Batch/lot tracked stock. Batch quantities are updated by goods
            receipts — registering a batch here records its details only and
            never changes on-hand stock.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={products.length === 0 || warehouses.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Batch
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {(Object.keys(STATUS_TONE) as BatchStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {batches.length} batches
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Mfg Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading batches...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Layers className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No batches yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow
                      key={b.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {b.batchNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{b.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {b.productCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {warehouses.find((w) => w.id === b.warehouseId)?.name ||
                          b.warehouseId}
                      </TableCell>
                      <TableCell>{b.manufacturingDate || "—"}</TableCell>
                      <TableCell>{b.expiryDate || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {b.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[b.status]}
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Label"
                          onClick={() => setLabelBatch(b)}
                        >
                          <Tag className="h-4 w-4 text-brand-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Batch Number *</Label>
              <Input
                value={form.batchNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, batchNumber: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select
                value={form.productCode}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, productCode: v }))
                }
              >
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Manufacturing Date</Label>
                <Input
                  type="date"
                  value={form.manufacturingDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      manufacturingDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiryDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The batch is registered with quantity 0. Stock is added to it when
              goods are received against a purchase order.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : "Register Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!labelBatch}
        onOpenChange={(o) => {
          if (!o) setLabelBatch(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Batch Label</DialogTitle>
          </DialogHeader>
          {labelBatch && (
            <ScmBarcodeLabel
              format="CODE128"
              value={labelBatch.batchNumber}
              title={labelBatch.productName}
              subtitle={`Batch ${labelBatch.batchNumber}`}
              footer={`Warehouse: ${warehouses.find((w) => w.id === labelBatch.warehouseId)?.name || labelBatch.warehouseId}${labelBatch.expiryDate ? ` · Exp ${labelBatch.expiryDate}` : ""}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
