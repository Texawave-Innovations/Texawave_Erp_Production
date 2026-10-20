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
import { Plus, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "./inventoryPaths";
import { applyReservationDelta, postOnce } from "./stockLedgerService";
import { transitionWithSideEffect } from "@/modules/scm/shared/statusTransition";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { useInventoryData } from "./useInventoryData";
import { useAuth } from "@/context/AuthContext";
import type {
  OrderAcknowledgement,
  ReservationStatus,
  StockReservation,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { actorName } from "@/modules/scm/shared/actor";
import { ALL, errorMessage } from "@/modules/scm/shared/format";

const STATUSES: ReservationStatus[] = [
  "ACTIVE",
  "RELEASED",
  "FULFILLED",
  "CANCELLED",
];

export default function ScmReservations() {
  const { user } = useAuth();
  const {
    products,
    warehouses,
    error: inventoryError,
    reload: reloadInventory,
  } = useInventoryData();
  useErrorToast(inventoryError);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [salesOrders, setSalesOrders] = useState<OrderAcknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productCode: "",
    warehouseId: "",
    quantity: "",
    salesOrderId: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r, so] = await Promise.all([
        getAllRecords(INVENTORY_PATHS.reservations) as Promise<
          StockReservation[]
        >,
        getAllRecords(SCM_CROSS_MODULE_PATHS.salesOrders).catch(
          () => [],
        ) as Promise<OrderAcknowledgement[]>,
      ]);
      setReservations(
        r.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
      setSalesOrders(so);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load reservations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === ALL) return reservations;
    return reservations.filter((r) => r.status === statusFilter);
  }, [reservations, statusFilter]);

  const openForm = () => {
    setForm({
      productCode: products[0]?.productCode || "",
      warehouseId: warehouses[0]?.id || "",
      quantity: "",
      salesOrderId: "",
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
      await applyReservationDelta(form.productCode, form.warehouseId, qty);
      const product = products.find((p) => p.productCode === form.productCode);
      const so = salesOrders.find((s) => s.id === form.salesOrderId);
      const performedBy = actorName(user);
      const id = await createRecord(INVENTORY_PATHS.reservations, {
        productCode: form.productCode,
        productName: product?.name || form.productCode,
        warehouseId: form.warehouseId,
        salesOrderId: form.salesOrderId || undefined,
        salesOrderNumber: so?.soNumber,
        quantity: qty,
        status: "ACTIVE",
        createdBy: performedBy,
        notes: form.notes.trim() || undefined,
      });
      if (id)
        await logRecordAudit(
          INVENTORY_PATHS.reservations,
          id,
          "Reservation created",
          performedBy,
          `${qty} × ${form.productCode}`,
        );
      toast.success("Stock reserved");
      setFormOpen(false);
      load();
      reloadInventory();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to reserve stock"));
    } finally {
      setSaving(false);
    }
  };

  const release = async (
    res: StockReservation,
    status: "RELEASED" | "CANCELLED",
  ) => {
    try {
      await transitionWithSideEffect<ReservationStatus>(
        INVENTORY_PATHS.reservations,
        res.id,
        ["ACTIVE"],
        status,
        async () => {
          await postOnce("RESERVATION_RELEASE", res.id, async () => {
            await applyReservationDelta(
              res.productCode,
              res.warehouseId,
              -res.quantity,
            );
            return "released";
          });
        },
        { releasedBy: actorName(user), releasedAt: Date.now() },
      );
      await logRecordAudit(
        INVENTORY_PATHS.reservations,
        res.id,
        `Reservation ${status.toLowerCase()}`,
        actorName(user),
        `${res.quantity} × ${res.productCode}`,
      );
      toast.success(`Reservation ${status.toLowerCase()}`);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to release reservation"));
    } finally {
      load();
      reloadInventory();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reservations</h2>
          <p className="text-muted-foreground mt-1">
            Stock reserved against confirmed sales orders. Reserving stock never
            posts a ledger transaction — it only reduces Available.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={products.length === 0 || warehouses.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Reserve Stock
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
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {reservations.length} reservations
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading reservations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Lock className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No reservations yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="font-medium">{r.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.productCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {warehouses.find((w) => w.id === r.warehouseId)?.name ||
                          r.warehouseId}
                      </TableCell>
                      <TableCell>{r.salesOrderNumber || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {r.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.createdBy}
                      </TableCell>
                      <TableCell>
                        {r.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Release"
                            onClick={() => release(r, "RELEASED")}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
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
            <DialogTitle>Reserve Stock</DialogTitle>
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
            <div className="space-y-1.5">
              <Label>Sales Order (optional)</Label>
              <Select
                value={form.salesOrderId || ALL}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, salesOrderId: v === ALL ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Not linked</SelectItem>
                  {salesOrders.map((so) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.soNumber} — {so.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Optional"
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
              {saving ? "Reserving..." : "Reserve Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
