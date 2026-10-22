import { useCallback, useEffect, useState } from "react";
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
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  SearchCheck,
  Split,
  Ban,
  RefreshCcw,
  QrCode,
  ScanLine,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getAllRecords, getRecordById } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import type { RecordAuditEntry } from "@/services/auditLog";
import { RETURNS_PATHS } from "./returnsPaths";
import {
  DISPOSITION_TONE,
  RETURN_STATUS_TONE,
  TERMINAL_RETURN_STATUSES,
  dispositionBreakdown,
  hasPostedInventory,
  isFullyDispositioned,
} from "./returnHelpers";
import {
  approveReturn,
  cancelReturn,
  rejectReturn,
  submitReturn,
} from "./returnsMasterService";
import {
  markCustomerReturnInTransit,
  receiveCustomerReturn,
} from "./customerReturnService";
import { completeCustomerReturn } from "./customerReturnDispositionService";
import {
  completeVendorReturn,
  markVendorReturnReadyToShip,
  markVendorReturnReceived,
  shipVendorReturn,
} from "./vendorReturnService";
import {
  ReasonDialog,
  ReceiveDialog,
  ShipmentDialog,
} from "./ReturnActionDialogs";
import { DispositionSummary } from "./DispositionSummary";
import type {
  GoodsReceipt,
  OrderFulfillment,
  ScmPurchaseOrder,
  ScmReturn,
  ScmReturnDispositionRecord,
  ScmReturnInspection,
  ScmShipment,
  StockLedgerEntry,
} from "@/types";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { ORDER_PATHS } from "../orders/orderPaths";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import { DetailRow } from "@/modules/scm/shared/components/DetailRow";
import { useAsyncAction } from "@/modules/scm/shared/useAsyncAction";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";

type DialogKind = "reject" | "cancel" | "transit" | "receive" | "ship" | null;

interface Related {
  inspections: ScmReturnInspection[];
  dispositions: ScmReturnDispositionRecord[];
  ledgerEntries: StockLedgerEntry[];
  fulfillment: OrderFulfillment | null;
  shipment: ScmShipment | null;
  grn: GoodsReceipt | null;
  purchaseOrder: ScmPurchaseOrder | null;
}

const NO_RELATED: Related = {
  inspections: [],
  dispositions: [],
  ledgerEntries: [],
  fulfillment: null,
  shipment: null,
  grn: null,
  purchaseOrder: null,
};

export default function ScmReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);

  const [ret, setRet] = useState<ScmReturn | null>(null);
  const [related, setRelated] = useState<Related>(NO_RELATED);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = (await getRecordById(
        RETURNS_PATHS.returns,
        id,
      )) as ScmReturn | null;
      setRet(r ? { ...r, items: r.items || [] } : null);
      if (!r) return;
      const [insp, disp, ledger, fulfillment, shipment, grn, purchaseOrder] =
        await Promise.all([
          getAllRecords(RETURNS_PATHS.inspections) as Promise<
            ScmReturnInspection[]
          >,
          getAllRecords(RETURNS_PATHS.dispositions) as Promise<
            ScmReturnDispositionRecord[]
          >,
          getAllRecords(INVENTORY_PATHS.ledger) as Promise<StockLedgerEntry[]>,
          r.fulfillmentId
            ? (getRecordById(
                ORDER_PATHS.fulfillments,
                r.fulfillmentId,
              ) as Promise<OrderFulfillment | null>)
            : null,
          r.shipmentId
            ? (getRecordById(
                LOGISTICS_PATHS.shipments,
                r.shipmentId,
              ) as Promise<ScmShipment | null>)
            : null,
          r.grnId
            ? (getRecordById(
                PROCUREMENT_PATHS.grns,
                r.grnId,
              ) as Promise<GoodsReceipt | null>)
            : null,
          r.purchaseOrderId
            ? (getRecordById(
                PROCUREMENT_PATHS.purchaseOrders,
                r.purchaseOrderId,
              ) as Promise<ScmPurchaseOrder | null>)
            : null,
        ]);
      setRelated({
        inspections: insp.filter((i) => i.returnId === id),
        dispositions: disp.filter((d) => d.returnId === id),
        ledgerEntries: ledger.filter(
          (e) =>
            (e.referenceType === "CUSTOMER_RETURN" ||
              e.referenceType === "VENDOR_RETURN") &&
            (e.referenceId || "").startsWith(`${id}:`),
        ),
        fulfillment,
        shipment,
        grn,
        purchaseOrder,
      });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load return"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  const { busy, run } = useAsyncAction(load);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    if (await run(fn, msg)) setDialog(null);
  };

  if (loading && !ret)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Loading return...
      </div>
    );
  if (!ret)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Return not found.
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/all")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );

  const r = ret;
  const {
    inspections,
    dispositions,
    ledgerEntries,
    fulfillment,
    shipment,
    grn,
    purchaseOrder,
  } = related;
  const isCustomer = r.returnType === "CUSTOMER_RETURN";
  const isTerminal = TERMINAL_RETURN_STATUSES.has(r.status);
  const hasPosted = hasPostedInventory(r);
  const totalRequested = r.items.reduce((s, i) => s + i.requestedQuantity, 0);

  const canSubmit = r.status === "REQUESTED";
  const canApproveReject = r.status === "PENDING_APPROVAL";
  const canMarkInTransit = isCustomer && r.status === "APPROVED";
  const canReceive = isCustomer && r.status === "IN_TRANSIT";
  const canComplete =
    isCustomer &&
    r.status === "DISPOSITION_PENDING" &&
    r.items.every(isFullyDispositioned);
  const canReadyToShip = !isCustomer && r.status === "APPROVED";
  const canShip = !isCustomer && r.status === "READY_TO_SHIP";
  const canVendorReceived = !isCustomer && r.status === "SHIPPED";
  const canCompleteVendor = !isCustomer && r.status === "VENDOR_RECEIVED";
  const canCancel =
    !isTerminal &&
    !hasPosted &&
    !["SHIPPED", "VENDOR_RECEIVED"].includes(r.status);
  const auditLogs: RecordAuditEntry[] = Object.values(r.auditLogs || {}).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  );
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const handleScan = (code: string) => {
    const scanned = code.trim().toLowerCase();
    const item = r.items.find(
      (it) =>
        it.productCode.toLowerCase() === scanned ||
        it.batchNumber?.toLowerCase() === scanned ||
        it.serialNumbers?.some((s) => s.toLowerCase() === scanned),
    );
    if (!item) {
      toast.error(`No return item matches "${code.trim()}"`);
      addScanHistoryEntry({
        code: code.trim(),
        type: "UNKNOWN",
        label: "Not found",
        source: "RETURN",
      });
      return;
    }
    toast.success(`Matched: ${item.productNameSnapshot}`);
    addScanHistoryEntry({
      code: code.trim(),
      type: "PRODUCT",
      label: item.productNameSnapshot,
      source: "RETURN",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate("/scm/returns/all")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground font-mono">
            {r.returnNumber}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isCustomer
              ? `Customer Return · ${r.customerNameSnapshot}`
              : `Vendor Return · ${r.vendorNameSnapshot}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Item
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" /> QR
          </Button>
          <Badge
            variant="outline"
            className={`${RETURN_STATUS_TONE[r.status]} text-sm px-3 py-1`}
          >
            {formatStatusLabel(r.status)}
          </Badge>
        </div>
      </div>

      {!isTerminal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Actions</div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canSubmit && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(() => submitReturn(r, performedBy), "Return submitted")
                }
              >
                Submit for Approval
              </Button>
            )}
            {canApproveReject && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(() => approveReturn(r, performedBy), "Return approved")
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
              </Button>
            )}
            {canApproveReject && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => setDialog("reject")}
              >
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            )}
            {canMarkInTransit && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setDialog("transit")}
              >
                <Truck className="h-4 w-4 mr-2" /> Mark In Transit
              </Button>
            )}
            {canReceive && (
              <Button disabled={busy} onClick={() => setDialog("receive")}>
                <PackageCheck className="h-4 w-4 mr-2" /> Receive
              </Button>
            )}
            {(r.status === "RECEIVED" || r.status === "INSPECTION_PENDING") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => navigate("/scm/returns/inspection")}
              >
                <SearchCheck className="h-4 w-4 mr-2" />{" "}
                {r.status === "RECEIVED" ? "Begin Inspection" : "Inspect"}
              </Button>
            )}
            {(r.status === "INSPECTED" ||
              r.status === "DISPOSITION_PENDING") && (
              <Button
                disabled={busy}
                onClick={() => navigate("/scm/returns/disposition")}
              >
                <Split className="h-4 w-4 mr-2" /> Set Disposition
              </Button>
            )}
            {canComplete && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => completeCustomerReturn(r.id, performedBy),
                    "Return completed",
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Return
              </Button>
            )}
            {canReadyToShip && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => markVendorReturnReadyToShip(r, performedBy),
                    "Marked ready to ship",
                  )
                }
              >
                Mark Ready to Ship
              </Button>
            )}
            {canShip && (
              <Button disabled={busy} onClick={() => setDialog("ship")}>
                <Truck className="h-4 w-4 mr-2" /> Ship to Vendor
              </Button>
            )}
            {canVendorReceived && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => markVendorReturnReceived(r, performedBy),
                    "Vendor receipt recorded",
                  )
                }
              >
                <PackageCheck className="h-4 w-4 mr-2" /> Mark Vendor Received
              </Button>
            )}
            {canCompleteVendor && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => completeVendorReturn(r, performedBy),
                    "Return completed",
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Return
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => setDialog("cancel")}
              >
                <Ban className="h-4 w-4 mr-2" /> Cancel Return
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => load()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {hasPosted && !isTerminal && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Inventory has already been posted for one or more lines on this return
          — normal cancellation is now blocked. A reversal would require a
          separate controlled transaction.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Overview</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Return #" value={r.returnNumber} mono />
            <DetailRow
              label="Type"
              value={isCustomer ? "Customer Return" : "Vendor Return"}
            />
            <DetailRow label="Reason" value={formatStatusLabel(r.reasonCode)} />
            {r.reasonDescription && (
              <DetailRow label="Reason Detail" value={r.reasonDescription} />
            )}
            <DetailRow
              label="Requested Date"
              value={new Date(r.requestedDate).toLocaleString()}
            />
            {r.approvedDate && (
              <DetailRow
                label="Approved Date"
                value={new Date(r.approvedDate).toLocaleString()}
              />
            )}
            {r.receivedDate && (
              <DetailRow
                label="Received Date"
                value={new Date(r.receivedDate).toLocaleString()}
              />
            )}
            {r.inspectedDate && (
              <DetailRow
                label="Inspected Date"
                value={new Date(r.inspectedDate).toLocaleString()}
              />
            )}
            {r.shippedDate && (
              <DetailRow
                label="Shipped Date"
                value={new Date(r.shippedDate).toLocaleString()}
              />
            )}
            {r.receivedByVendorDate && (
              <DetailRow
                label="Vendor Received Date"
                value={new Date(r.receivedByVendorDate).toLocaleString()}
              />
            )}
            {r.completedDate && (
              <DetailRow
                label="Completed Date"
                value={new Date(r.completedDate).toLocaleString()}
              />
            )}
            {r.rejectionReason && (
              <DetailRow label="Rejection Reason" value={r.rejectionReason} />
            )}
            {r.cancellationReason && (
              <DetailRow
                label="Cancellation Reason"
                value={r.cancellationReason}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">
              {isCustomer ? "Customer" : "Vendor"}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label={isCustomer ? "Customer" : "Vendor"}
              value={
                (isCustomer ? r.customerNameSnapshot : r.vendorNameSnapshot) ||
                "—"
              }
            />
            <DetailRow label="Warehouse" value={r.warehouseId} />
            <DetailRow label="Created By" value={r.createdBy} />
            {r.approvedBy && (
              <DetailRow label="Approved By" value={r.approvedBy} />
            )}
            {r.receivedBy && (
              <DetailRow label="Received By" value={r.receivedBy} />
            )}
            {r.inspectedBy && (
              <DetailRow label="Inspected By" value={r.inspectedBy} />
            )}
            {r.shippedBy && (
              <DetailRow label="Shipped By" value={r.shippedBy} />
            )}
            {r.completedBy && (
              <DetailRow label="Completed By" value={r.completedBy} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">
            Items ({totalRequested} requested)
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>{isCustomer ? "Fulfilled" : "Received"}</TableHead>
                  <TableHead>Prev. Returned</TableHead>
                  <TableHead>Requested</TableHead>
                  {isCustomer && <TableHead>Accepted / Rejected</TableHead>}
                  {isCustomer && <TableHead>Condition</TableHead>}
                  {isCustomer && <TableHead>Disposition</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {it.productNameSnapshot}
                      <div className="text-xs text-muted-foreground font-mono">
                        {it.productCode}
                        {it.batchNumber ? ` · Batch ${it.batchNumber}` : ""}
                        {it.serialNumbers?.length
                          ? ` · ${it.serialNumbers.join(", ")}`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(isCustomer
                        ? it.fulfilledQuantity
                        : it.receivedQuantity) ?? "—"}
                    </TableCell>
                    <TableCell>{it.previouslyReturnedQuantity}</TableCell>
                    <TableCell>{it.requestedQuantity}</TableCell>
                    {isCustomer && (
                      <TableCell>
                        {it.acceptedQuantity ?? "—"} /{" "}
                        {it.rejectedQuantity ?? "—"}
                      </TableCell>
                    )}
                    {isCustomer && (
                      <TableCell>
                        {it.condition ? formatStatusLabel(it.condition) : "—"}
                      </TableCell>
                    )}
                    {isCustomer && (
                      <TableCell>
                        <DispositionSummary
                          breakdown={dispositionBreakdown(it)}
                          pending={!!it.pendingDisposition}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {inspections.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Inspection</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {inspections.map((i) => (
              <div
                key={i.id}
                className="border rounded-md p-3 text-sm flex justify-between"
              >
                <div>
                  <Badge variant="outline">
                    {formatStatusLabel(i.inspectionResult)}
                  </Badge>
                  <span className="ml-2">
                    Condition: {formatStatusLabel(i.condition)}
                  </span>
                  <div className="text-muted-foreground mt-1">
                    Accepted {i.acceptedQuantity} · Rejected{" "}
                    {i.rejectedQuantity}
                  </div>
                  {i.notes && (
                    <div className="text-muted-foreground text-xs mt-1">
                      {i.notes}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {i.inspectorId}
                  <br />
                  {new Date(i.inspectionDate).toLocaleString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dispositions.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Disposition</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {dispositions.map((d) => (
              <div
                key={d.id}
                className="border rounded-md p-3 text-sm flex justify-between"
              >
                <div>
                  <Badge
                    variant="outline"
                    className={DISPOSITION_TONE[d.disposition]}
                  >
                    {formatStatusLabel(d.disposition)}
                  </Badge>
                  <span className="ml-2">
                    {d.productCode} × {d.quantity}
                  </span>
                  {d.notes && (
                    <div className="text-muted-foreground text-xs mt-1">
                      {d.notes}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {d.createdBy}
                  <br />
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ledgerEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Inventory Ledger Entries</div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.productName}
                      <div className="text-xs text-muted-foreground font-mono">
                        {e.productCode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatStatusLabel(e.transactionType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.quantityIn || "—"}</TableCell>
                    <TableCell>{e.quantityOut || "—"}</TableCell>
                    <TableCell>
                      {new Date(e.transactionDate).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Related Documents</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isCustomer ? (
            <>
              <RelRow label="Sales Order" value={r.salesOrderNumberSnapshot} />
              <RelRow
                label="Fulfillment"
                value={
                  fulfillment?.fulfillmentNumber ||
                  r.fulfillmentNumberSnapshot ||
                  r.fulfillmentId
                }
                onClick={
                  fulfillment
                    ? () =>
                        navigate(`/scm/orders/fulfillment/${fulfillment.id}`)
                    : undefined
                }
              />
              <RelRow
                label="Shipment"
                value={shipment?.shipmentNumber || r.shipmentId}
                onClick={
                  shipment
                    ? () => navigate(`/scm/logistics/shipments/${shipment.id}`)
                    : undefined
                }
              />
              {r.qualityInspectionId && (
                <RelRow
                  label="QC Inspection"
                  value={
                    r.qualityInspectionNumberSnapshot || r.qualityInspectionId
                  }
                  onClick={() =>
                    navigate(
                      `/scm/quality/inspections/${r.qualityInspectionId}`,
                    )
                  }
                />
              )}
            </>
          ) : (
            <>
              <RelRow
                label="Purchase Order"
                value={purchaseOrder?.poNumber || r.purchaseOrderNumberSnapshot}
                onClick={
                  purchaseOrder
                    ? () => navigate("/scm/procurement/purchase-orders")
                    : undefined
                }
              />
              <RelRow
                label="GRN"
                value={grn?.grnNumber || r.grnNumberSnapshot}
                onClick={
                  grn ? () => navigate("/scm/procurement/grn") : undefined
                }
              />
            </>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">
              {isCustomer ? "Credit Note" : "Debit Note"}
            </span>
            <span className="text-amber-700 text-right">
              Not generated — finance integration pending. Raise it manually in
              Finance.
            </span>
          </div>
          {r.returnShipment &&
            (r.returnShipment.carrier || r.returnShipment.trackingNumber) && (
              <div className="border-t pt-2">
                <div className="text-muted-foreground mb-1">
                  Return Shipment (manual tracking)
                </div>
                <div>
                  {r.returnShipment.carrier} — {r.returnShipment.trackingNumber}
                </div>
              </div>
            )}
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

      <ReasonDialog
        open={dialog === "reject"}
        onOpenChange={closeDialog}
        busy={busy}
        title="Reject Return"
        required
        confirmLabel="Reject"
        onConfirm={(reason) =>
          act(() => rejectReturn(r, reason, performedBy), "Return rejected")
        }
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={closeDialog}
        busy={busy}
        title="Cancel Return"
        confirmLabel="Confirm Cancel"
        description="Only possible before any inventory has been posted for this return."
        onConfirm={(reason) =>
          act(() => cancelReturn(r.id, reason, performedBy), "Return cancelled")
        }
      />
      <ShipmentDialog
        open={dialog === "transit"}
        onOpenChange={closeDialog}
        busy={busy}
        title="Mark In Transit"
        onConfirm={(carrier, trackingNumber) =>
          act(
            () =>
              markCustomerReturnInTransit(
                r,
                {
                  carrier: carrier || undefined,
                  trackingNumber: trackingNumber || undefined,
                },
                performedBy,
              ),
            "Marked in transit",
          )
        }
      />
      <ShipmentDialog
        open={dialog === "ship"}
        onOpenChange={closeDialog}
        busy={busy}
        title="Ship Return to Vendor"
        required
        note="Posts a PURCHASE_RETURN ledger entry for every line — on-hand stock decreases now, since this is when the stock physically leaves."
        onConfirm={(carrier, trackingNumber) =>
          act(
            () =>
              shipVendorReturn(r.id, { carrier, trackingNumber }, performedBy),
            "Return shipped",
          )
        }
      />
      <ReceiveDialog
        open={dialog === "receive"}
        onOpenChange={closeDialog}
        busy={busy}
        items={r.items}
        onConfirm={(receivedQuantities) =>
          act(
            () =>
              receiveCustomerReturn(r.id, { receivedQuantities }, performedBy),
            "Return received",
          )
        }
      />
      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Return Item"
        placeholder="Product, batch or serial"
      />
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Return Label / QR</DialogTitle>
          </DialogHeader>
          <ScmBarcodeLabel
            format="QR"
            value={buildQrPayload("RETURN", r.returnNumber, r.id)}
            title={r.returnNumber}
            subtitle={
              isCustomer ? r.customerNameSnapshot : r.vendorNameSnapshot
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex justify-between border-b last:border-0 pb-2 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          onClick
            ? "font-mono cursor-pointer text-primary hover:underline"
            : "font-mono"
        }
        onClick={onClick}
      >
        {value || "—"}
      </span>
    </div>
  );
}
