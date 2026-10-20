import { useMemo, useState } from "react";
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
import { Plus, ArrowLeftRight, Check, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";
import { createRecord } from "@/services/firebase";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import {
  ALL,
  MOVEMENT_STATUS_TONE,
  capacityError,
  computeLocationStock,
  locationLabel,
  relocateTrackedStock,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { notifyAdminFeed } from "@/services/notifications";
import type {
  WarehouseMovement,
  WarehouseMovementStatus,
  WarehouseMovementType,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

const STATUSES: WarehouseMovementStatus[] = [
  "REQUESTED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

function inferMovementType(
  sourceType?: string,
  destType?: string,
): WarehouseMovementType {
  if (sourceType === "ZONE" && destType === "ZONE") return "ZONE_TO_ZONE";
  if (sourceType === "RACK" && destType === "RACK") return "RACK_TO_RACK";
  if (sourceType === "SHELF" && destType === "SHELF") return "SHELF_TO_SHELF";
  return "BIN_TO_BIN";
}

export default function ScmWarehouseMovements() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    warehouses,
    locations,
    products,
    loading: mastersLoading,
    error: mastersError,
  } = useWarehouseMasters();
  const {
    loading,
    error,
    putaways,
    movements,
    pickings,
    reload: load,
  } = useWarehouseOperations();
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    warehouseId: "",
    sourceLocationId: "",
    destinationLocationId: "",
    productCode: "",
    quantity: "",
    notes: "",
  });

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? movements
        : movements.filter((m) => m.status === statusFilter),
    [movements, statusFilter],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const locationStock = useMemo(
    () => computeLocationStock(putaways, movements, pickings),
    [putaways, movements, pickings],
  );

  const locationsInWarehouse = useMemo(
    () =>
      locations.filter(
        (l) => l.warehouseId === form.warehouseId && l.status === "Active",
      ),
    [locations, form.warehouseId],
  );

  const sourceAvailable = useMemo(() => {
    if (!form.sourceLocationId || !form.productCode) return 0;
    return (
      locationStock.get(
        `${form.productCode}__${form.warehouseId}__${form.sourceLocationId}`,
      ) || 0
    );
  }, [
    locationStock,
    form.sourceLocationId,
    form.productCode,
    form.warehouseId,
  ]);

  const openForm = () => {
    setForm({
      warehouseId: warehouses[0]?.id || "",
      sourceLocationId: "",
      destinationLocationId: "",
      productCode: "",
      quantity: "",
      notes: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const qty = Number(form.quantity);
    if (
      !form.warehouseId ||
      !form.sourceLocationId ||
      !form.destinationLocationId ||
      !form.productCode
    ) {
      toast.error("Warehouse, source, destination and product are required");
      return;
    }
    if (form.sourceLocationId === form.destinationLocationId) {
      toast.error("Source and destination location must differ");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be a positive number");
      return;
    }
    if (qty > sourceAvailable) {
      toast.error(`Only ${sourceAvailable} available at the source location`);
      return;
    }

    const destLoc = locations.find((l) => l.id === form.destinationLocationId);
    const capErr = capacityError(destLoc, locationStock, qty);
    if (capErr) {
      toast.error(capErr);
      return;
    }

    setSaving(true);
    try {
      const product = products.find((p) => p.productCode === form.productCode);
      const sourceLoc = locations.find((l) => l.id === form.sourceLocationId);
      const movementNumber = await reserveDocumentNumber("warehouseMovement");
      const id = await createRecord(WAREHOUSE_PATHS.movements, {
        movementNumber,
        movementType: inferMovementType(
          sourceLoc?.locationType,
          destLoc?.locationType,
        ),
        warehouseId: form.warehouseId,
        sourceLocationId: form.sourceLocationId,
        destinationLocationId: form.destinationLocationId,
        items: [
          {
            productCode: form.productCode,
            productName: product?.name || form.productCode,
            quantity: qty,
          },
        ],
        status: "REQUESTED" as WarehouseMovementStatus,
        requestedBy: performedBy,
        createdAt: Date.now(),
        notes: form.notes.trim() || undefined,
      });
      if (id)
        await logRecordAudit(
          WAREHOUSE_PATHS.movements,
          id,
          "Movement requested",
          performedBy,
          `${movementNumber}: ${qty} × ${form.productCode}`,
        );
      toast.success("Internal movement requested");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to request movement"));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (m: WarehouseMovement) => {
    if (m.status !== "REQUESTED") return;
    setBusyId(m.id);
    try {
      await transitionStatus<WarehouseMovementStatus>(
        WAREHOUSE_PATHS.movements,
        m.id,
        ["REQUESTED"],
        "APPROVED",
        { approvedBy: performedBy },
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.movements,
        m.id,
        "Movement approved",
        performedBy,
        m.movementNumber,
      );
      toast.success("Movement approved");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to approve movement"));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (m: WarehouseMovement) => {
    if (m.status !== "APPROVED" && m.status !== "IN_PROGRESS") return; // idempotency guard
    setBusyId(m.id);
    try {
      const item = m.items[0];
      const currentAvailable =
        locationStock.get(
          `${item.productCode}__${m.warehouseId}__${m.sourceLocationId}`,
        ) || 0;
      if (item.quantity > currentAvailable)
        throw new Error(
          `Only ${currentAvailable} currently available at source — another movement already used this stock`,
        );
      const capErr = capacityError(
        locations.find((l) => l.id === m.destinationLocationId),
        locationStock,
        item.quantity,
      );
      if (capErr) throw new Error(capErr);

      await transitionStatus<WarehouseMovementStatus>(
        WAREHOUSE_PATHS.movements,
        m.id,
        ["APPROVED", "IN_PROGRESS"],
        "COMPLETED",
        { completedBy: performedBy, completedAt: Date.now() },
      );
      const notes = await relocateTrackedStock({
        productCode: item.productCode,
        warehouseId: m.warehouseId,
        quantity: item.quantity,
        fromLocationId: m.sourceLocationId,
        toLocationId: m.destinationLocationId,
        serialNumbers: item.serialNumbers,
      });
      if (notes.length) toast.warning(notes.join(" "));

      await logRecordAudit(
        WAREHOUSE_PATHS.movements,
        m.id,
        "Movement completed",
        performedBy,
        `${m.movementNumber}: ${locationLabel(locations.find((l) => l.id === m.sourceLocationId))} → ${locationLabel(locations.find((l) => l.id === m.destinationLocationId))}`,
      );
      await notifyAdminFeed(
        "Internal Movement Completed",
        `${m.movementNumber} moved ${m.items[0].quantity} × ${m.items[0].productCode} within ${warehouseName(m.warehouseId)}.`,
        "inventory",
      );
      toast.success("Movement completed");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to complete movement"));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (m: WarehouseMovement) => {
    if (m.status === "COMPLETED" || m.status === "CANCELLED") return;
    setBusyId(m.id);
    try {
      await transitionStatus<WarehouseMovementStatus>(
        WAREHOUSE_PATHS.movements,
        m.id,
        ["DRAFT", "REQUESTED", "APPROVED", "IN_PROGRESS"],
        "CANCELLED",
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.movements,
        m.id,
        "Movement cancelled",
        performedBy,
        m.movementNumber,
      );
      toast.success("Movement cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel movement"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Internal Movements
          </h2>
          <p className="text-muted-foreground mt-1">
            Move stock between bins, shelves, racks or zones within the same
            warehouse. No ledger entry is posted — on-hand at the warehouse
            level is unchanged, only the location changes.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={mastersLoading || warehouses.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Request Movement
        </Button>
      </div>
      {(error || mastersError) && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error || mastersError}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {movements.length} movements
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movement #</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
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
                      Loading movements...
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
                          No internal movements yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow
                      key={m.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {m.movementNumber}
                      </TableCell>
                      <TableCell>{warehouseName(m.warehouseId)}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {m.items[0]?.productName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {m.items[0]?.productCode}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {locationLabel(
                          locations.find((l) => l.id === m.sourceLocationId),
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {locationLabel(
                          locations.find(
                            (l) => l.id === m.destinationLocationId,
                          ),
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.items[0]?.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={MOVEMENT_STATUS_TONE[m.status]}
                        >
                          {formatStatusLabel(m.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {m.status === "REQUESTED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Approve"
                              disabled={busyId === m.id}
                              onClick={() => approve(m)}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {(m.status === "APPROVED" ||
                            m.status === "IN_PROGRESS") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Complete"
                              disabled={busyId === m.id}
                              onClick={() => complete(m)}
                            >
                              <PlayCircle className="h-4 w-4 text-sky-600" />
                            </Button>
                          )}
                          {m.status !== "COMPLETED" &&
                            m.status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancel"
                                disabled={busyId === m.id}
                                onClick={() => cancel(m)}
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
            <DialogTitle>Request Internal Movement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Warehouse *</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    warehouseId: v,
                    sourceLocationId: "",
                    destinationLocationId: "",
                  }))
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
              <Label>Source Location *</Label>
              <Select
                value={form.sourceLocationId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, sourceLocationId: v }))
                }
                disabled={!form.warehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locationsInWarehouse.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {locationLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.sourceLocationId && form.productCode && (
                <div className="text-xs text-muted-foreground">
                  Available here: {sourceAvailable}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Destination Location *</Label>
              <Select
                value={form.destinationLocationId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, destinationLocationId: v }))
                }
                disabled={!form.warehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locationsInWarehouse
                    .filter((l) => l.id !== form.sourceLocationId)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {locationLabel(l)}
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
              {saving ? "Requesting..." : "Request Movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
