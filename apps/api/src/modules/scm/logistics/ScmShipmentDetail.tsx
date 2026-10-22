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
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Tag,
  Truck,
  MapPinned,
  Home,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  RefreshCcw,
  ExternalLink,
  Printer,
  RotateCcw,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllRecords,
  getRecordById,
  getRecordsWhere,
} from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { LOGISTICS_PATHS } from "./logisticsPaths";
import { ORDER_PATHS } from "../orders/orderPaths";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { SHIPMENT_STATUS_TONE } from "./logisticsHelpers";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import {
  assignCarrier,
  canTransitionShipment,
  cancelShipment,
  createShipmentLabel,
  dispatchShipment,
  markShipmentDelivered,
  recordDeliveryException,
  recordFailedDelivery,
  updateShipmentStatus,
} from "./logisticsService";
import {
  CarrierDialog,
  DeliveredDialog,
  ExceptionDialog,
  LabelDialog,
  ReasonDialog,
  TransitDialog,
  type TransitStatus,
} from "./components/ShipmentDialogs";
import type {
  LogisticsCarrier,
  OrderFulfillment,
  ScmShipment,
  ShipmentException,
  ShipmentTrackingEvent,
  Warehouse,
} from "@/types";
import type { RecordAuditEntry } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { DetailRow } from "@/modules/scm/shared/components/DetailRow";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

type OpenDialog =
  | "carrier"
  | "label"
  | "transit"
  | "delivered"
  | "exception"
  | "failed"
  | "cancel"
  | null;

export default function ScmShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);

  const [shipment, setShipment] = useState<ScmShipment | null>(null);
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [events, setEvents] = useState<ShipmentTrackingEvent[]>([]);
  const [exceptions, setExceptions] = useState<ShipmentException[]>([]);
  const [fulfillment, setFulfillment] = useState<OrderFulfillment | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [transitStatus, setTransitStatus] = useState<TransitStatus | null>(
    null,
  );
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, ca, te, ex] = await Promise.all([
        getRecordById(
          LOGISTICS_PATHS.shipments,
          id,
        ) as Promise<ScmShipment | null>,
        getAllRecords(LOGISTICS_PATHS.carriers) as Promise<LogisticsCarrier[]>,
        getRecordsWhere<ShipmentTrackingEvent>(
          LOGISTICS_PATHS.trackingEvents,
          "shipmentId",
          id,
        ),
        getRecordsWhere<ShipmentException>(
          LOGISTICS_PATHS.exceptions,
          "shipmentId",
          id,
        ),
      ]);
      setShipment(s);
      setCarriers(ca);
      setEvents(te.sort((a, b) => (b.eventTime || 0) - (a.eventTime || 0)));
      setExceptions(
        ex.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0)),
      );
      const [f, wh] = s
        ? await Promise.all([
            getRecordById(
              ORDER_PATHS.fulfillments,
              s.fulfillmentId,
            ) as Promise<OrderFulfillment | null>,
            getRecordById(
              INVENTORY_PATHS.warehouses,
              s.warehouseId,
            ) as Promise<Warehouse | null>,
          ])
        : [null, null];
      setFulfillment(f);
      setWarehouse(wh);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load shipment"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const auditLogs = useMemo(
    () =>
      Object.values(shipment?.auditLogs || {}).sort(
        (a: RecordAuditEntry, b: RecordAuditEntry) =>
          (b.timestamp || 0) - (a.timestamp || 0),
      ),
    [shipment],
  );
  const currentCarrier = carriers.find((c) => c.id === shipment?.carrierId);

  /** Runs an action; closes the dialog and reloads on success. */
  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      setDialog(null);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Action failed"));
      load();
    } finally {
      setBusy(false);
    }
  };

  const openTransit = (status: TransitStatus) => {
    setTransitStatus(status);
    setDialog("transit");
  };

  if (loading)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Loading shipment...
      </div>
    );
  if (!shipment)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Shipment not found.
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/shipments")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );

  const s = shipment;
  const can = (to: Parameters<typeof canTransitionShipment>[1]) =>
    canTransitionShipment(s.status, to);
  const canAssignCarrier =
    s.status === "READY_TO_SHIP" || s.status === "CARRIER_ASSIGNED";
  const isRetry =
    s.status === "FAILED_DELIVERY" || s.status === "DELIVERY_EXCEPTION";
  const isTerminal = s.status === "DELIVERED" || s.status === "CANCELLED";
  const dialogProps = (key: Exclude<OpenDialog, null>) => ({
    open: dialog === key,
    onOpenChange: (o: boolean) => setDialog(o ? key : null),
    busy,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate("/scm/logistics/shipments")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground font-mono">
            {s.shipmentNumber}
          </h2>
          <p className="text-muted-foreground mt-1">
            SO {s.salesOrderNumberSnapshot} · {s.customerNameSnapshot} ·{" "}
            {warehouse?.name || s.warehouseId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" /> Print Label / QR
          </Button>
          <Badge
            variant="outline"
            className={`${SHIPMENT_STATUS_TONE[s.status]} text-sm px-3 py-1`}
          >
            {formatStatusLabel(s.status)}
          </Badge>
        </div>
      </div>

      {!isTerminal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Actions</div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canAssignCarrier && (
              <Button disabled={busy} onClick={() => setDialog("carrier")}>
                <Building2 className="h-4 w-4 mr-2" />{" "}
                {s.carrierId ? "Change Carrier" : "Assign Carrier"}
              </Button>
            )}
            {can("LABEL_CREATED") && (
              <Button disabled={busy} onClick={() => setDialog("label")}>
                <Tag className="h-4 w-4 mr-2" /> Add Tracking # / Create Label
              </Button>
            )}
            {can("DISPATCHED") && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => dispatchShipment(s, performedBy),
                    "Shipment dispatched",
                  )
                }
              >
                <Truck className="h-4 w-4 mr-2" /> Dispatch
              </Button>
            )}
            {can("IN_TRANSIT") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => openTransit("IN_TRANSIT")}
              >
                {isRetry ? (
                  <RotateCcw className="h-4 w-4 mr-2" />
                ) : (
                  <MapPinned className="h-4 w-4 mr-2" />
                )}{" "}
                {isRetry ? "Resume In Transit" : "Mark In Transit"}
              </Button>
            )}
            {can("OUT_FOR_DELIVERY") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => openTransit("OUT_FOR_DELIVERY")}
              >
                {isRetry ? (
                  <RotateCcw className="h-4 w-4 mr-2" />
                ) : (
                  <Home className="h-4 w-4 mr-2" />
                )}{" "}
                {isRetry ? "Retry Delivery" : "Mark Out for Delivery"}
              </Button>
            )}
            {can("DELIVERED") && (
              <Button disabled={busy} onClick={() => setDialog("delivered")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Delivered
              </Button>
            )}
            {can("DELIVERY_EXCEPTION") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setDialog("exception")}
              >
                <AlertTriangle className="h-4 w-4 mr-2" /> Record Exception
              </Button>
            )}
            {can("FAILED_DELIVERY") && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => setDialog("failed")}
              >
                <XCircle className="h-4 w-4 mr-2" /> Record Failed Delivery
              </Button>
            )}
            {can("CANCELLED") && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => setDialog("cancel")}
              >
                <Ban className="h-4 w-4 mr-2" /> Cancel Shipment
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => load()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Overview</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Shipment #" value={s.shipmentNumber} mono />
            <DetailRow
              label="Sales Order"
              value={s.salesOrderNumberSnapshot}
              mono
            />
            <DetailRow
              label="Fulfillment"
              value={fulfillment?.fulfillmentNumber || s.fulfillmentId}
              mono
            />
            <DetailRow
              label="Warehouse"
              value={warehouse?.name || s.warehouseId}
            />
            <DetailRow label="Shipment Date" value={s.shipmentDate || "—"} />
            <DetailRow
              label="Expected Delivery"
              value={s.expectedDeliveryDate || "—"}
            />
            <DetailRow
              label="Actual Delivery"
              value={s.actualDeliveryDate || "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Customer</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Customer" value={s.customerNameSnapshot} />
            <div className="border-b pb-2">
              <div className="text-muted-foreground">Shipping Address</div>
              <div className="mt-1 whitespace-pre-wrap">
                {s.shippingAddress || "—"}
              </div>
            </div>
            {s.billingAddress && (
              <div>
                <div className="text-muted-foreground">Billing Address</div>
                <div className="mt-1 whitespace-pre-wrap">
                  {s.billingAddress}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Carrier</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Carrier"
              value={s.carrierNameSnapshot || "Not assigned"}
            />
            <DetailRow
              label="Service Type"
              value={s.serviceType ? formatStatusLabel(s.serviceType) : "—"}
            />
            <DetailRow
              label="Tracking #"
              value={s.trackingNumber || "—"}
              mono
            />
            {s.trackingUrl && (
              <a
                href={s.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
              >
                Track on carrier site <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Delivery</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Recipient" value={s.recipientName || "—"} />
            <DetailRow label="Delivered By" value={s.deliveredBy || "—"} />
            <DetailRow label="Notes" value={s.deliveryNotes || "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4 flex items-center justify-between">
          <div className="font-semibold">
            Shipment Packages ({s.totalPackages}, {s.totalWeight || 0}kg total)
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print Summary
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package #</TableHead>
                <TableHead>Pack #</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Contents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.packages.map((p, idx) => (
                <TableRow key={`${p.packingId}-${p.packageNumber}-${idx}`}>
                  <TableCell className="font-mono text-xs">
                    {p.packageNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.packNumber}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.weight ? `${p.weight}kg` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.length && p.width && p.height
                      ? `${p.length}×${p.width}×${p.height}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.items
                      .map((i) => `${i.productName} ×${i.quantity}`)
                      .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Tracking Timeline</div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No tracking events yet.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start justify-between text-sm border-b last:border-0 pb-3 last:pb-0"
                >
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        SHIPMENT_STATUS_TONE[
                          e.status as keyof typeof SHIPMENT_STATUS_TONE
                        ] || ""
                      }
                    >
                      {formatStatusLabel(e.status)}
                    </Badge>
                    {e.description && (
                      <div className="mt-1 text-muted-foreground">
                        {e.description}
                      </div>
                    )}
                    {e.location && (
                      <div className="text-xs text-muted-foreground">
                        Location: {e.location}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0 ml-4">
                    {new Date(e.eventTime).toLocaleString()}
                    <br />
                    {e.createdBy} · {e.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {exceptions.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Delivery Exceptions</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {exceptions.map((ex) => (
              <div key={ex.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={
                      ex.resolvedAt
                        ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                        : "text-orange-600 border-orange-200 bg-orange-50"
                    }
                  >
                    {formatStatusLabel(ex.exceptionCode)}{" "}
                    {ex.resolvedAt ? "— Resolved" : "— Open"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ex.occurredAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {ex.description}
                </div>
                {ex.resolution && (
                  <div className="mt-1 text-xs text-emerald-700">
                    Resolution: {ex.resolution} ({ex.resolvedBy})
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Related Documents</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Sales Order</span>
            <span className="font-mono">{s.salesOrderNumberSnapshot}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Fulfillment</span>
            <span
              className="font-mono cursor-pointer text-primary hover:underline"
              onClick={() =>
                navigate(`/scm/orders/fulfillment/${s.fulfillmentId}`)
              }
            >
              {fulfillment?.fulfillmentNumber || s.fulfillmentId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice</span>
            <span>
              {s.invoiceNumberSnapshot || "Finance integration pending"}
            </span>
          </div>
        </CardContent>
      </Card>

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

      <CarrierDialog
        {...dialogProps("carrier")}
        shipment={s}
        carriers={carriers}
        onSubmit={(v) =>
          run(() => assignCarrier(s, v, performedBy), "Carrier assigned")
        }
      />
      <LabelDialog
        {...dialogProps("label")}
        initialTrackingNumber={s.trackingNumber}
        onSubmit={(tn) =>
          run(
            () => createShipmentLabel(s, tn, currentCarrier, performedBy),
            "Shipping label created",
          )
        }
      />
      <TransitDialog
        {...dialogProps("transit")}
        status={transitStatus}
        onSubmit={(v) =>
          transitStatus &&
          run(
            () => updateShipmentStatus(s, transitStatus, performedBy, v),
            `Status updated to ${formatStatusLabel(transitStatus)}`,
          )
        }
      />
      <DeliveredDialog
        {...dialogProps("delivered")}
        onSubmit={(v) =>
          run(
            () => markShipmentDelivered(s, v, performedBy),
            "Shipment marked delivered",
          )
        }
      />
      <ExceptionDialog
        {...dialogProps("exception")}
        onSubmit={(v) =>
          run(async () => {
            await recordDeliveryException(
              s,
              v.code,
              v.description,
              performedBy,
            );
          }, "Delivery exception recorded")
        }
      />
      <ReasonDialog
        {...dialogProps("failed")}
        title="Record Failed Delivery"
        submitLabel="Record Failed Delivery"
        required
        onSubmit={(reason) =>
          run(
            () => recordFailedDelivery(s, reason, performedBy),
            "Failed delivery recorded",
          )
        }
      />
      <ReasonDialog
        {...dialogProps("cancel")}
        title="Cancel Shipment"
        submitLabel="Confirm Cancel"
        hint="This is only possible before dispatch. Stock already issued for this fulfillment is not affected."
        onSubmit={(reason) =>
          run(
            () => cancelShipment(s, reason || "Cancelled by user", performedBy),
            "Shipment cancelled",
          )
        }
      />
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Shipment Label / QR</DialogTitle>
          </DialogHeader>
          <ScmBarcodeLabel
            format="QR"
            value={buildQrPayload("SHIPMENT", s.shipmentNumber, s.id)}
            title={s.shipmentNumber}
            subtitle={`SO ${s.salesOrderNumberSnapshot}`}
            lines={[s.customerNameSnapshot]}
            footer={
              s.trackingNumber ? `Tracking: ${s.trackingNumber}` : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
