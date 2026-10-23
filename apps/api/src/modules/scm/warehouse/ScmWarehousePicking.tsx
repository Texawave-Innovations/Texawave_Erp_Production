import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  ClipboardCheck,
  PlayCircle,
  Check,
  X,
  Eye,
  ScanLine,
  QrCode,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import {
  ALL,
  PICK_STATUS_TONE,
  locationLabel,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import { useAuth } from "@/context/AuthContext";
import { notifyAdminFeed } from "@/services/notifications";
import { syncFulfillmentProgress } from "../orders/orderFulfillmentService";
import type { PickItem, PickStatus, WarehousePicking } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";

const STATUSES: PickStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "PARTIALLY_PICKED",
  "COMPLETED",
  "CANCELLED",
];

export default function ScmWarehousePicking() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const navigate = useNavigate();
  const { warehouses, locations, error: mastersError } = useWarehouseMasters();
  const { loading, error, pickings, reload: load } = useWarehouseOperations();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pickDialog, setPickDialog] = useState<WarehousePicking | null>(null);
  const [pickDraft, setPickDraft] = useState<
    { pickedQuantity: string; sourceLocationId: string }[]
  >([]);
  const [closeShort, setCloseShort] = useState(false);
  const [viewPick, setViewPick] = useState<WarehousePicking | null>(null);

  const [scanTarget, setScanTarget] = useState<{
    idx: number;
    kind: "PRODUCT" | "LOCATION";
  } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [qrFor, setQrFor] = useState<WarehousePicking | null>(null);
  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? pickings
        : pickings.filter((p) => p.status === statusFilter),
    [pickings, statusFilter],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  /** Keeps the linked fulfillment's status/pick list in step; a failure here is reported but the
   *  pick change itself stands (re-syncs on the next pick/pack action). */
  const syncFulfillment = async (p: WarehousePicking) => {
    if (!p.fulfillmentId) return;
    try {
      await syncFulfillmentProgress(p.fulfillmentId);
    } catch (err: unknown) {
      toast.error(
        errorMessage(
          err,
          "Pick saved, but the fulfillment could not be updated",
        ),
      );
    }
  };

  const start = async (p: WarehousePicking) => {
    if (p.status !== "PENDING" && p.status !== "ASSIGNED") return;
    setBusyId(p.id);
    try {
      await transitionStatus<PickStatus>(
        WAREHOUSE_PATHS.pickings,
        p.id,
        ["PENDING", "ASSIGNED"],
        "IN_PROGRESS",
        { startedAt: Date.now() },
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.pickings,
        p.id,
        "Picking started",
        performedBy,
        p.pickNumber,
      );
      toast.success("Picking started");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to start picking"));
    } finally {
      setBusyId(null);
    }
  };

  const openPickDialog = (p: WarehousePicking) => {
    setPickDialog(p);
    setCloseShort(false);
    setPickDraft(
      p.items.map((it) => ({
        pickedQuantity: String(it.pickedQuantity || it.requestedQuantity),
        sourceLocationId: it.sourceLocationId || "",
      })),
    );
  };

  const locationsInWarehouse = useMemo(
    () =>
      pickDialog
        ? locations.filter(
            (l) =>
              l.warehouseId === pickDialog.warehouseId &&
              (l.locationType || "BIN") === "BIN",
          )
        : [],
    [locations, pickDialog],
  );

  const submitPickProgress = async () => {
    if (!pickDialog) return;
    for (let i = 0; i < pickDialog.items.length; i++) {
      const qty = Number(pickDraft[i]?.pickedQuantity) || 0;
      if (qty < 0) {
        toast.error("Picked quantity cannot be negative");
        return;
      }
      if (qty > pickDialog.items[i].requestedQuantity) {
        toast.error(
          `${pickDialog.items[i].productName}: cannot pick more than requested (${pickDialog.items[i].requestedQuantity})`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const items: PickItem[] = pickDialog.items.map((it, i) => ({
        ...it,
        pickedQuantity: Number(pickDraft[i]?.pickedQuantity) || 0,
        sourceLocationId: pickDraft[i]?.sourceLocationId || undefined,
      }));
      const allPicked = items.every(
        (it) => it.pickedQuantity >= it.requestedQuantity,
      );
      const anyPicked = items.some((it) => it.pickedQuantity > 0);
      // "Close short" completes a pick that can't be fully picked; only picked units are issued.
      const nextStatus: PickStatus =
        allPicked || (closeShort && anyPicked)
          ? "COMPLETED"
          : anyPicked
            ? "PARTIALLY_PICKED"
            : "IN_PROGRESS";

      await transitionStatus<PickStatus>(
        WAREHOUSE_PATHS.pickings,
        pickDialog.id,
        ["IN_PROGRESS", "PARTIALLY_PICKED"],
        nextStatus,
        {
          items,
          completedAt: nextStatus === "COMPLETED" ? Date.now() : null,
        },
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.pickings,
        pickDialog.id,
        "Pick quantities recorded",
        performedBy,
        `${pickDialog.pickNumber}: ${nextStatus}${!allPicked && nextStatus === "COMPLETED" ? " (closed short)" : ""}`,
      );
      if (nextStatus === "COMPLETED") {
        await notifyAdminFeed(
          "Picking Completed",
          `${pickDialog.pickNumber} fully picked for ${pickDialog.salesOrderNumber}. Ready for packing.`,
          "inventory",
        );
      }
      toast.success(
        nextStatus === "COMPLETED"
          ? "Picking completed"
          : "Pick progress saved",
      );
      setPickDialog(null);
      await syncFulfillment(pickDialog);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save pick progress"));
    } finally {
      setSaving(false);
    }
  };

  const handleScanResult = (code: string) => {
    if (!scanTarget || !pickDialog) return;
    const { idx, kind } = scanTarget;
    const scanned = code.trim();
    const item = pickDialog.items[idx];
    if (kind === "PRODUCT") {
      if (item.productCode.toLowerCase() !== scanned.toLowerCase()) {
        toast.error(
          `Product mismatch — Expected: ${item.productCode} · Scanned: ${scanned}`,
        );
        addScanHistoryEntry({
          code: scanned,
          type: "UNKNOWN",
          label: "Product mismatch",
          source: "PICKING",
        });
        return;
      }
      toast.success(`Product confirmed: ${item.productName}`);
      addScanHistoryEntry({
        code: scanned,
        type: "PRODUCT",
        label: item.productName,
        source: "PICKING",
      });
      return;
    }
    // LOCATION — match against bin locations in this pick's warehouse.
    const loc = locationsInWarehouse.find(
      (l) =>
        (l.locationCode || l.binCode).toLowerCase() === scanned.toLowerCase(),
    );
    if (!loc) {
      toast.error(
        `Location "${scanned}" was not found in ${warehouseName(pickDialog.warehouseId)}`,
      );
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Location not found",
        source: "PICKING",
      });
      return;
    }
    setPickDraft((arr) =>
      arr.map((r, i) => (i === idx ? { ...r, sourceLocationId: loc.id } : r)),
    );
    toast.success(`Source bin set: ${locationLabel(loc)}`);
    addScanHistoryEntry({
      code: scanned,
      type: "LOCATION",
      label: locationLabel(loc),
      source: "PICKING",
    });
  };

  const handleFindScan = (code: string) => {
    const scanned = code.trim();
    const pick = pickings.find(
      (p) =>
        p.pickNumber.toLowerCase() === scanned.toLowerCase() ||
        p.salesOrderNumber?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!pick) {
      toast.error(`No pick list found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "PICKING",
      });
      return;
    }
    setViewPick(pick);
    toast.success(`Found ${pick.pickNumber}`);
    addScanHistoryEntry({
      code: scanned,
      type: "SALES_ORDER",
      label: pick.pickNumber,
      source: "PICKING",
    });
  };

  const cancel = async (p: WarehousePicking) => {
    if (p.status === "COMPLETED" || p.status === "CANCELLED") return;
    setBusyId(p.id);
    try {
      await transitionStatus<PickStatus>(
        WAREHOUSE_PATHS.pickings,
        p.id,
        ["PENDING", "ASSIGNED", "IN_PROGRESS", "PARTIALLY_PICKED"],
        "CANCELLED",
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.pickings,
        p.id,
        "Picking cancelled",
        performedBy,
        p.pickNumber,
      );
      toast.success("Pick list cancelled");
      await syncFulfillment(p);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel pick list"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">Picking</h2>
          <p className="text-muted-foreground mt-1">
            Pick lists are created from reserved order fulfillments, so every
            pick is backed by a stock reservation. Nothing here reduces on-hand
            stock — the sales issue is posted when the fulfillment is finalized.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setFindOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Order
          </Button>
          <Button onClick={() => navigate("/scm/orders/fulfillment")}>
            Create from Fulfillment <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      {(error || mastersError) && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error || mastersError}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[190px]">
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
            {filtered.length} of {pickings.length} pick lists
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pick #</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
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
                      Loading pick lists...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No pick lists yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {p.pickNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.salesOrderNumber}
                      </TableCell>
                      <TableCell>{warehouseName(p.warehouseId)}</TableCell>
                      <TableCell>{p.priority}</TableCell>
                      <TableCell>{p.items.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PICK_STATUS_TONE[p.status]}
                        >
                          {formatStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={() => setViewPick(p)}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Print QR"
                            onClick={() => setQrFor(p)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          {(p.status === "PENDING" ||
                            p.status === "ASSIGNED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Start Picking"
                              disabled={busyId === p.id}
                              onClick={() => start(p)}
                            >
                              <PlayCircle className="h-4 w-4 text-sky-600" />
                            </Button>
                          )}
                          {(p.status === "IN_PROGRESS" ||
                            p.status === "PARTIALLY_PICKED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Record Picked Quantities"
                              disabled={busyId === p.id}
                              onClick={() => openPickDialog(p)}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {p.status !== "COMPLETED" &&
                            p.status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancel"
                                disabled={busyId === p.id}
                                onClick={() => cancel(p)}
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

      <Dialog
        open={!!pickDialog}
        onOpenChange={(o) => {
          if (!o) setPickDialog(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pickDialog?.pickNumber} — Record Picked Quantities
            </DialogTitle>
          </DialogHeader>
          {pickDialog && (
            <div className="space-y-3">
              {pickDialog.items.map((it, idx) => (
                <div
                  key={`${it.productCode}-${idx}`}
                  className="border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {it.productName}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        ({it.productCode})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setScanTarget({ idx, kind: "PRODUCT" })}
                    >
                      <ScanLine className="h-3.5 w-3.5 mr-1.5" /> Scan Product
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Requested {it.requestedQuantity}
                    {it.notes ? ` · ${it.notes}` : ""}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Picked Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        max={it.requestedQuantity}
                        value={pickDraft[idx]?.pickedQuantity ?? ""}
                        onChange={(e) =>
                          setPickDraft((arr) =>
                            arr.map((r, i) =>
                              i === idx
                                ? { ...r, pickedQuantity: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Source Bin</Label>
                      <div className="flex gap-1">
                        <Select
                          value={pickDraft[idx]?.sourceLocationId || ""}
                          onValueChange={(v) =>
                            setPickDraft((arr) =>
                              arr.map((r, i) =>
                                i === idx ? { ...r, sourceLocationId: v } : r,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            {locationsInWarehouse.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.locationCode || l.binCode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Scan Bin"
                          onClick={() =>
                            setScanTarget({ idx, kind: "LOCATION" })
                          }
                        >
                          <ScanLine className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={closeShort}
              onCheckedChange={(v) => setCloseShort(v === true)}
            />
            Close pick with shortages (complete with the quantities entered)
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPickDialog(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={submitPickProgress} disabled={saving}>
              {saving ? "Saving..." : "Save Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewPick}
        onOpenChange={(o) => {
          if (!o) setViewPick(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewPick?.pickNumber}</DialogTitle>
          </DialogHeader>
          {viewPick && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                SO {viewPick.salesOrderNumber} ·{" "}
                {warehouseName(viewPick.warehouseId)} ·{" "}
                {viewPick.pickerName || "Unassigned"}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Picked</TableHead>
                    <TableHead>Bin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPick.items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">
                        {it.productName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.requestedQuantity}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.pickedQuantity}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {it.sourceLocationId
                          ? locationLabel(
                              locations.find(
                                (l) => l.id === it.sourceLocationId,
                              ),
                            )
                          : "Unassigned"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={!!scanTarget}
        onOpenChange={(o) => {
          if (!o) setScanTarget(null);
        }}
        onResult={(code) => {
          handleScanResult(code);
          setScanTarget(null);
        }}
        title={
          scanTarget?.kind === "LOCATION" ? "Scan Bin Location" : "Scan Product"
        }
        placeholder={
          scanTarget?.kind === "LOCATION"
            ? "Bin / location code"
            : "Product SKU or barcode"
        }
      />
      <ScmBarcodeScanner
        open={findOpen}
        onOpenChange={setFindOpen}
        onResult={(code) => {
          setFindOpen(false);
          handleFindScan(code);
        }}
        title="Scan Order"
        placeholder="Pick number or sales order number"
      />

      <Dialog
        open={!!qrFor}
        onOpenChange={(o) => {
          if (!o) setQrFor(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick List QR Code</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload("PICK_LIST", qrFor.pickNumber, qrFor.id)}
              title={qrFor.pickNumber}
              subtitle={qrFor.salesOrderNumber}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
