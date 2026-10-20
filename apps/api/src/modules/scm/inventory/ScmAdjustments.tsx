import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, SlidersHorizontal, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "./inventoryPaths";
import {
  postLedgerEntry,
  getStockBalance,
  postOnce,
} from "./stockLedgerService";
import {
  transitionWithSideEffect,
  transitionStatus,
} from "@/modules/scm/shared/statusTransition";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { useInventoryData } from "./useInventoryData";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import type {
  AdjustmentDirection,
  AdjustmentReason,
  AdjustmentStatus,
  StockAdjustment,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { ALL, errorMessage } from "@/modules/scm/shared/format";
const REASONS: AdjustmentReason[] = [
  "Physical Count Difference",
  "Damage",
  "Loss",
  "Found Stock",
  "Opening Correction",
  "Other Approved Reason",
];

const STATUS_TONE: Record<AdjustmentStatus, string> = {
  PENDING: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  REJECTED: "text-red-600 border-red-200 bg-red-50",
};

export default function ScmAdjustments() {
  const { user } = useAuth();
  const {
    products,
    warehouses,
    error: inventoryError,
    reload: reloadInventory,
  } = useInventoryData();
  useErrorToast(inventoryError);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    productCode: "",
    warehouseId: "",
    quantity: "",
    direction: "IN" as AdjustmentDirection,
    reason: REASONS[0],
    notes: "",
  });

  const performedBy = actorName(user);

  const load = async () => {
    setLoading(true);
    try {
      const a = (await getAllRecords(
        INVENTORY_PATHS.adjustments,
      )) as StockAdjustment[];
      setAdjustments(a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load adjustments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === ALL) return adjustments;
    return adjustments.filter((a) => a.status === statusFilter);
  }, [adjustments, statusFilter]);

  const openForm = () => {
    setForm({
      productCode: products[0]?.productCode || "",
      warehouseId: warehouses[0]?.id || "",
      quantity: "",
      direction: "IN",
      reason: REASONS[0],
      notes: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const qty = Number(form.quantity);
    if (!form.productCode || !form.warehouseId) {
      toast.error("Select a product and warehouse");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be a positive number");
      return;
    }

    setSaving(true);
    try {
      const product = products.find((p) => p.productCode === form.productCode);
      const adjustmentNumber = await reserveDocumentNumber("stockAdjustment");
      const id = await createRecord(INVENTORY_PATHS.adjustments, {
        adjustmentNumber,
        productCode: form.productCode,
        productName: product?.name || form.productCode,
        warehouseId: form.warehouseId,
        quantity: qty,
        direction: form.direction,
        reason: form.reason,
        notes: form.notes.trim() || undefined,
        status: "PENDING" as AdjustmentStatus,
        requestedBy: performedBy,
      });
      if (id)
        await logRecordAudit(
          INVENTORY_PATHS.adjustments,
          id,
          "Adjustment requested",
          performedBy,
          `${adjustmentNumber}: ${form.direction} ${qty} × ${form.productCode} (${form.reason})`,
        );
      toast.success("Adjustment recorded, pending approval");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create adjustment"));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (a: StockAdjustment) => {
    setBusyId(a.id);
    try {
      // postLedgerEntry's balance guard is the authoritative stock check for OUT adjustments;
      // this read only gives a friendlier message up front.
      if (a.direction === "OUT") {
        const balance = await getStockBalance(a.productCode, a.warehouseId);
        const available = balance
          ? balance.onHand - (balance.reserved || 0)
          : 0;
        if (a.quantity > available)
          throw new Error(
            `Only ${available} available — cannot adjust out ${a.quantity}`,
          );
      }
      await transitionWithSideEffect<AdjustmentStatus>(
        INVENTORY_PATHS.adjustments,
        a.id,
        ["PENDING"],
        "APPROVED",
        async () => {
          await postOnce("ADJUSTMENT", a.id, () =>
            postLedgerEntry({
              productCode: a.productCode,
              productName: a.productName,
              warehouseId: a.warehouseId,
              transactionType:
                a.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
              referenceType: "ADJUSTMENT",
              referenceId: a.id,
              referenceNumber: a.adjustmentNumber,
              quantityIn: a.direction === "IN" ? a.quantity : undefined,
              quantityOut: a.direction === "OUT" ? a.quantity : undefined,
              notes: a.reason,
              createdBy: performedBy,
            }),
          );
        },
        { approvedBy: performedBy, approvedAt: Date.now() },
      );
      await logRecordAudit(
        INVENTORY_PATHS.adjustments,
        a.id,
        "Adjustment approved",
        performedBy,
        `${a.adjustmentNumber}: ledger entry posted`,
      );
      toast.success("Adjustment approved and posted to the stock ledger");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to approve adjustment"));
    } finally {
      setBusyId(null);
      load();
      reloadInventory();
    }
  };

  const reject = async (a: StockAdjustment) => {
    setBusyId(a.id);
    try {
      await transitionStatus<AdjustmentStatus>(
        INVENTORY_PATHS.adjustments,
        a.id,
        ["PENDING"],
        "REJECTED",
      );
      await logRecordAudit(
        INVENTORY_PATHS.adjustments,
        a.id,
        "Adjustment rejected",
        performedBy,
        a.adjustmentNumber,
      );
      toast.success("Adjustment rejected");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to reject adjustment"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Adjustments</h2>
          <p className="text-muted-foreground mt-1">
            Manual stock corrections with an audited reason. Approving an
            adjustment posts a stock ledger entry — nothing edits on-hand
            quantity silently.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={products.length === 0 || warehouses.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> New Adjustment
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
              {(Object.keys(STATUS_TONE) as AdjustmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {adjustments.length} adjustments
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adjustment #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading adjustments...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <SlidersHorizontal className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No stock adjustments yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow
                      key={a.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {a.adjustmentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{a.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {a.productCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {warehouses.find((w) => w.id === a.warehouseId)?.name ||
                          a.warehouseId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            a.direction === "IN"
                              ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                              : "text-red-600 border-red-200 bg-red-50"
                          }
                        >
                          {a.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.quantity}
                      </TableCell>
                      <TableCell className="text-sm">{a.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[a.status]}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.requestedBy}
                      </TableCell>
                      <TableCell>
                        {a.status === "PENDING" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Approve"
                              disabled={busyId === a.id}
                              onClick={() => approve(a)}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reject"
                              disabled={busyId === a.id}
                              onClick={() => reject(a)}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
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
            <DialogTitle>New Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                <Label>Direction *</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      direction: v as AdjustmentDirection,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Increase (IN)</SelectItem>
                    <SelectItem value="OUT">Decrease (OUT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Select
                value={form.reason}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, reason: v as AdjustmentReason }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Optional"
                rows={2}
              />
            </div>
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
              {saving ? "Saving..." : "Submit Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
