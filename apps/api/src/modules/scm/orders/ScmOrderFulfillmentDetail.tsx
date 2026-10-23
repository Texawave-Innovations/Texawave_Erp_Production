import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Lock,
  Unlock,
  ShoppingCart,
  ClipboardCheck,
  PackageOpen,
  CheckCircle2,
  XCircle,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { getRecordById, getRecordsWhere } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import {
  PICK_STATUS_TONE,
  PACK_STATUS_TONE,
} from "../warehouse/warehouseHelpers";
import { REQUISITION_STATUS_TONE } from "../procurement/procurementHelpers";
import { ORDER_PATHS } from "./orderPaths";
import { FULFILLMENT_STATUS_TONE, normalizeFulfillment } from "./orderHelpers";
import {
  cancelFulfillment,
  createPickForFulfillment,
  createShortageRequisition,
  finalizeFulfillment,
  isOpenRequisition,
  releaseFulfillmentReservations,
  reserveFulfillmentStock,
} from "./orderFulfillmentService";
import type {
  OrderFulfillment,
  PurchaseRequisition,
  StockReservation,
  Warehouse,
  WarehousePacking,
  WarehousePicking,
} from "@/types";
import type { RecordAuditEntry } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

export default function ScmOrderFulfillmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);

  const [fulfillment, setFulfillment] = useState<OrderFulfillment | null>(null);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [pickings, setPickings] = useState<WarehousePicking[]>([]);
  const [packings, setPackings] = useState<WarehousePacking[]>([]);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [f, res, pk, pc, req] = await Promise.all([
        getRecordById(
          ORDER_PATHS.fulfillments,
          id,
        ) as Promise<OrderFulfillment | null>,
        getRecordsWhere<StockReservation>(
          INVENTORY_PATHS.reservations,
          "fulfillmentId",
          id,
        ),
        getRecordsWhere<WarehousePicking>(
          WAREHOUSE_PATHS.pickings,
          "fulfillmentId",
          id,
        ),
        getRecordsWhere<WarehousePacking>(
          WAREHOUSE_PATHS.packings,
          "fulfillmentId",
          id,
        ),
        getRecordsWhere<PurchaseRequisition>(
          PROCUREMENT_PATHS.requisitions,
          "fulfillmentId",
          id,
        ),
      ]);
      setFulfillment(f ? normalizeFulfillment(f) : null);
      setReservations(res);
      setPickings(pk);
      setPackings(pc);
      setRequisitions(req);
      setWarehouse(
        f
          ? ((await getRecordById(
              INVENTORY_PATHS.warehouses,
              f.warehouseId,
            )) as Warehouse | null)
          : null,
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load fulfillment"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const warehouseName = warehouse?.name || fulfillment?.warehouseId;
  const auditLogs = useMemo(
    () =>
      Object.values(fulfillment?.auditLogs || {}).sort(
        (a: RecordAuditEntry, b: RecordAuditEntry) =>
          (b.timestamp || 0) - (a.timestamp || 0),
      ),
    [fulfillment],
  );

  const shortageItems = useMemo(
    () =>
      fulfillment
        ? fulfillment.items.filter((i) => i.orderedQty - i.reservedQty > 0)
        : [],
    [fulfillment],
  );
  const hasShortage = shortageItems.length > 0;
  const hasOpenRequisition = requisitions.some(isOpenRequisition);
  const livePicks = pickings.filter((p) => p.status !== "CANCELLED");
  const livePacks = packings.filter((p) => p.status !== "CANCELLED");
  // A partially picked list is not done — the picker must finish it (or close it short).
  const allPicksCompleted =
    livePicks.length > 0 && livePicks.every((p) => p.status === "COMPLETED");
  const allPacksPacked =
    livePacks.length > 0 && livePacks.every((p) => p.status === "PACKED");
  const canFinalize =
    fulfillment &&
    ["RESERVED", "PICKING", "PACKING", "READY_TO_SHIP"].includes(
      fulfillment.status,
    ) &&
    fulfillment.reservationIds.length > 0 &&
    allPicksCompleted &&
    allPacksPacked;

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleReserve = () =>
    fulfillment &&
    run(
      () => reserveFulfillmentStock(fulfillment.id, performedBy),
      "Stock reserved",
    );
  // Status after release reflects the original stock check (reservation shortage mirrors it).
  const handleRelease = () =>
    fulfillment &&
    run(
      () =>
        releaseFulfillmentReservations(
          fulfillment.id,
          performedBy,
          hasShortage ? "PARTIALLY_AVAILABLE" : "AVAILABLE",
        ),
      "Reservation released",
    );
  const handleCreatePR = () =>
    fulfillment &&
    run(async () => {
      await createShortageRequisition(fulfillment.id, performedBy);
    }, "Purchase requisition raised for shortage");
  const handleCreatePick = () =>
    fulfillment &&
    run(async () => {
      await createPickForFulfillment(fulfillment.id, performedBy);
    }, "Pick list created");
  const handleFinalize = () =>
    fulfillment &&
    run(
      () => finalizeFulfillment(fulfillment.id, performedBy),
      "Stock issued — fulfillment complete",
    );
  const handleCancel = () =>
    fulfillment &&
    run(async () => {
      await cancelFulfillment(
        fulfillment.id,
        performedBy,
        cancelReason.trim() || "Cancelled by user",
      );
      setCancelOpen(false);
    }, "Fulfillment cancelled");

  if (loading)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Loading fulfillment...
      </div>
    );
  if (!fulfillment)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Fulfillment not found.
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/orders/fulfillment")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );

  const isTerminal =
    fulfillment.status === "FULFILLED" || fulfillment.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate("/scm/orders/fulfillment")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground font-mono">
            {fulfillment.fulfillmentNumber}
          </h2>
          <p className="text-muted-foreground mt-1">
            SO {fulfillment.salesOrderNumberSnapshot} ·{" "}
            {fulfillment.customerNameSnapshot} · {warehouseName}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`${FULFILLMENT_STATUS_TONE[fulfillment.status]} text-sm px-3 py-1`}
        >
          {formatStatusLabel(fulfillment.status)}
        </Badge>
      </div>

      {!isTerminal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Actions</div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {fulfillment.reservationIds.length === 0 && (
              <Button disabled={busy} onClick={handleReserve}>
                <Lock className="h-4 w-4 mr-2" /> Reserve Stock
              </Button>
            )}
            {fulfillment.reservationIds.length > 0 &&
              fulfillment.pickingIds.length === 0 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleRelease}
                >
                  <Unlock className="h-4 w-4 mr-2" /> Release Reservation
                </Button>
              )}
            {hasShortage && !hasOpenRequisition && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={handleCreatePR}
              >
                <ShoppingCart className="h-4 w-4 mr-2" /> Create PR for Shortage
              </Button>
            )}
            {fulfillment.status === "RESERVED" &&
              fulfillment.pickingIds.length === 0 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleCreatePick}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Create Pick
                </Button>
              )}
            {fulfillment.pickingIds.length > 0 && (
              <Button
                variant="outline"
                onClick={() => navigate("/scm/warehouse/picking")}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" /> Open Picking
                Workspace
              </Button>
            )}
            {allPicksCompleted && !allPacksPacked && (
              <Button
                variant="outline"
                onClick={() => navigate("/scm/warehouse/packing")}
              >
                <PackageOpen className="h-4 w-4 mr-2" /> Open Packing Workspace
              </Button>
            )}
            {canFinalize && (
              <Button disabled={busy} onClick={handleFinalize}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Finalize Fulfillment
              </Button>
            )}
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => load()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Stock Availability &amp; Progress</div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Shortage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fulfillment.items.map((it, idx) => (
                <TableRow key={`${it.itemCode}-${idx}`}>
                  <TableCell className="text-sm">
                    {it.itemDescription}{" "}
                    <span className="text-xs text-muted-foreground font-mono">
                      ({it.itemCode})
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{it.orderedQty}</TableCell>
                  <TableCell className="text-sm">{it.reservedQty}</TableCell>
                  <TableCell className="text-sm">{it.issuedQty}</TableCell>
                  <TableCell className="text-sm">
                    {Math.max(0, it.orderedQty - it.reservedQty) || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Reservations</div>
          </CardHeader>
          <CardContent className="p-0">
            {reservations.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No reservations yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.productName}</TableCell>
                      <TableCell className="text-sm">{r.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatStatusLabel(r.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Picking</div>
          </CardHeader>
          <CardContent className="p-0">
            {pickings.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No pick list yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pick #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.pickNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.items.length}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PICK_STATUS_TONE[p.status]}
                        >
                          {formatStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Packing</div>
          </CardHeader>
          <CardContent className="p-0">
            {packings.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No packing yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pack #</TableHead>
                    <TableHead>Packages</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.packNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.packages.length}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PACK_STATUS_TONE[p.status]}
                        >
                          {formatStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Related Documents</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Sales Order</span>
              <span className="font-mono">
                {fulfillment.salesOrderNumberSnapshot}
              </span>
            </div>
            {requisitions.length === 0 ? (
              <div className="text-muted-foreground">
                No shortage requisition raised.
              </div>
            ) : (
              requisitions.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between border-b last:border-0 pb-2 last:pb-0"
                >
                  <span className="text-muted-foreground">
                    Purchase Requisition
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{r.requisitionNumber}</span>
                    <Badge
                      variant="outline"
                      className={REQUISITION_STATUS_TONE[r.status]}
                    >
                      {formatStatusLabel(r.status)}
                    </Badge>
                  </span>
                </div>
              ))
            )}
            {fulfillment.deliveryStatus && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Delivery</span>
                <span>{formatStatusLabel(fulfillment.deliveryStatus)}</span>
              </div>
            )}
            {fulfillment.stockIssueLedgerEntryIds.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Ledger Entries (SALES_ISSUE)
                </span>
                <span>{fulfillment.stockIssueLedgerEntryIds.length}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Activity</div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No activity recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">— {a.details}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.performedBy} · {new Date(a.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancel Fulfillment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This cancels any open pick lists and packings and releases active
              reservations. This cannot be done once stock has been issued.
            </p>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={busy}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={busy}
            >
              {busy ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
