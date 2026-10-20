import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  Plus,
  ArrowLeftRight,
  Check,
  Truck,
  PackageCheck,
  X,
} from "lucide-react";
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
import type { StockTransfer, TransferStatus } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import {
  ALL,
  errorMessage,
  formatStatusLabel,
} from "@/modules/scm/shared/format";

const STATUS_TONE: Record<TransferStatus, string> = {
  DRAFT: "text-muted-foreground",
  REQUESTED: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-sky-600 border-sky-200 bg-sky-50",
  IN_TRANSIT: "text-purple-600 border-purple-200 bg-purple-50",
  RECEIVED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export default function ScmTransfers() {
  const { user } = useAuth();
  const {
    products,
    warehouses,
    error: inventoryError,
    reload: reloadInventory,
  } = useInventoryData();
  useErrorToast(inventoryError);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    productCode: "",
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    quantity: "",
    notes: "",
  });

  const performedBy = actorName(user);

  const load = async () => {
    setLoading(true);
    try {
      const t = (await getAllRecords(
        INVENTORY_PATHS.transfers,
      )) as StockTransfer[];
      setTransfers(t.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load transfers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === ALL) return transfers;
    return transfers.filter((t) => t.status === statusFilter);
  }, [transfers, statusFilter]);

  const whName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const openForm = () => {
    setForm({
      productCode: products[0]?.productCode || "",
      sourceWarehouseId: warehouses[0]?.id || "",
      destinationWarehouseId: warehouses[1]?.id || "",
      quantity: "",
      notes: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const qty = Number(form.quantity);
    if (
      !form.productCode ||
      !form.sourceWarehouseId ||
      !form.destinationWarehouseId
    ) {
      toast.error("Select product, source and destination warehouse");
      return;
    }
    if (form.sourceWarehouseId === form.destinationWarehouseId) {
      toast.error("Source and destination warehouse must differ");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be a positive number");
      return;
    }

    setSaving(true);
    try {
      // UX hint only — the authoritative check runs when the transfer is dispatched.
      const balance = await getStockBalance(
        form.productCode,
        form.sourceWarehouseId,
      );
      const available = balance ? balance.onHand - (balance.reserved || 0) : 0;
      if (qty > available) {
        toast.error(`Only ${available} available at source warehouse`);
        setSaving(false);
        return;
      }

      const product = products.find((p) => p.productCode === form.productCode);
      const transferNumber = await reserveDocumentNumber("stockTransfer");
      const id = await createRecord(INVENTORY_PATHS.transfers, {
        transferNumber,
        productCode: form.productCode,
        productName: product?.name || form.productCode,
        sourceWarehouseId: form.sourceWarehouseId,
        destinationWarehouseId: form.destinationWarehouseId,
        quantity: qty,
        status: "REQUESTED" as TransferStatus,
        requestedBy: performedBy,
        notes: form.notes.trim() || undefined,
      });
      if (id)
        await logRecordAudit(
          INVENTORY_PATHS.transfers,
          id,
          "Transfer requested",
          performedBy,
          `${transferNumber}: ${qty} × ${form.productCode}`,
        );
      toast.success("Transfer requested");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create transfer"));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (t: StockTransfer) => {
    setBusyId(t.id);
    try {
      await transitionStatus<TransferStatus>(
        INVENTORY_PATHS.transfers,
        t.id,
        ["REQUESTED"],
        "APPROVED",
        { approvedBy: performedBy, approvedAt: Date.now() },
      );
      await logRecordAudit(
        INVENTORY_PATHS.transfers,
        t.id,
        "Transfer approved",
        performedBy,
        t.transferNumber,
      );
      toast.success("Transfer approved");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to approve transfer"));
    } finally {
      setBusyId(null);
    }
  };

  const dispatch = async (t: StockTransfer) => {
    setBusyId(t.id);
    try {
      // postLedgerEntry's balance guard is the authoritative availability check.
      await transitionWithSideEffect<TransferStatus>(
        INVENTORY_PATHS.transfers,
        t.id,
        ["APPROVED"],
        "IN_TRANSIT",
        async () => {
          await postOnce("TRANSFER_OUT", t.id, () =>
            postLedgerEntry({
              productCode: t.productCode,
              productName: t.productName,
              warehouseId: t.sourceWarehouseId,
              transactionType: "TRANSFER_OUT",
              referenceType: "TRANSFER",
              referenceId: t.id,
              referenceNumber: t.transferNumber,
              quantityOut: t.quantity,
              createdBy: performedBy,
            }),
          );
        },
        { dispatchedBy: performedBy, dispatchedAt: Date.now() },
      );
      await logRecordAudit(
        INVENTORY_PATHS.transfers,
        t.id,
        "Transfer dispatched",
        performedBy,
        `${t.transferNumber}: TRANSFER_OUT posted at ${whName(t.sourceWarehouseId)}`,
      );
      toast.success("Transfer marked in transit — source stock reduced");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to dispatch transfer"));
    } finally {
      setBusyId(null);
      load();
      reloadInventory();
    }
  };

  const receive = async (t: StockTransfer) => {
    setBusyId(t.id);
    try {
      await transitionWithSideEffect<TransferStatus>(
        INVENTORY_PATHS.transfers,
        t.id,
        ["IN_TRANSIT"],
        "RECEIVED",
        async () => {
          await postOnce("TRANSFER_IN", t.id, () =>
            postLedgerEntry({
              productCode: t.productCode,
              productName: t.productName,
              warehouseId: t.destinationWarehouseId,
              transactionType: "TRANSFER_IN",
              referenceType: "TRANSFER",
              referenceId: t.id,
              referenceNumber: t.transferNumber,
              quantityIn: t.quantity,
              createdBy: performedBy,
            }),
          );
        },
        { receivedBy: performedBy, receivedAt: Date.now() },
      );
      await logRecordAudit(
        INVENTORY_PATHS.transfers,
        t.id,
        "Transfer received",
        performedBy,
        `${t.transferNumber}: TRANSFER_IN posted at ${whName(t.destinationWarehouseId)}`,
      );
      toast.success("Transfer received — destination stock increased");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to receive transfer"));
    } finally {
      setBusyId(null);
      load();
      reloadInventory();
    }
  };

  const cancel = async (t: StockTransfer) => {
    setBusyId(t.id);
    try {
      await transitionStatus<TransferStatus>(
        INVENTORY_PATHS.transfers,
        t.id,
        ["DRAFT", "REQUESTED", "APPROVED"],
        "CANCELLED",
      );
      await logRecordAudit(
        INVENTORY_PATHS.transfers,
        t.id,
        "Transfer cancelled",
        performedBy,
        t.transferNumber,
      );
      toast.success("Transfer cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel transfer"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Transfers</h2>
          <p className="text-muted-foreground mt-1">
            Warehouse-to-warehouse stock transfers. Destination stock only
            increases once a transfer is marked Received.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={products.length === 0 || warehouses.length < 2}
        >
          <Plus className="h-4 w-4 mr-2" /> Request Transfer
        </Button>
      </div>

      {warehouses.length < 2 && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            At least two warehouses are required to create a transfer.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {(Object.keys(STATUS_TONE) as TransferStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {transfers.length} transfers
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading transfers...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ArrowLeftRight className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No warehouse transfers yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {t.transferNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {t.productCode}
                        </div>
                      </TableCell>
                      <TableCell>{whName(t.sourceWarehouseId)}</TableCell>
                      <TableCell>{whName(t.destinationWarehouseId)}</TableCell>
                      <TableCell className="font-medium">
                        {t.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[t.status]}
                        >
                          {formatStatusLabel(t.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.requestedBy}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {t.status === "REQUESTED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Approve"
                              disabled={busyId === t.id}
                              onClick={() => approve(t)}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {t.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark In Transit"
                              disabled={busyId === t.id}
                              onClick={() => dispatch(t)}
                            >
                              <Truck className="h-4 w-4 text-purple-600" />
                            </Button>
                          )}
                          {t.status === "IN_TRANSIT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark Received"
                              disabled={busyId === t.id}
                              onClick={() => receive(t)}
                            >
                              <PackageCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {(t.status === "DRAFT" ||
                            t.status === "REQUESTED" ||
                            t.status === "APPROVED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel"
                              disabled={busyId === t.id}
                              onClick={() => cancel(t)}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
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
            <DialogTitle>Request Transfer</DialogTitle>
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
              <Label>Source Warehouse *</Label>
              <Select
                value={form.sourceWarehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, sourceWarehouseId: v }))
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
              <Label>Destination Warehouse *</Label>
              <Select
                value={form.destinationWarehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, destinationWarehouseId: v }))
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
              {saving ? "Requesting..." : "Request Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
