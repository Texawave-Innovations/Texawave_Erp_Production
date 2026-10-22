import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
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
  Search,
  Plus,
  Send,
  Check,
  Ban,
  Lock,
  PackageCheck,
  Eye,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { notifyAdminFeed } from "@/services/notifications";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  PAGE_SIZE,
  PO_STATUS_TONE,
  useProcurementMasters,
} from "./procurementHelpers";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  CANCELLABLE_PO_STATUSES,
  CLOSABLE_PO_STATUSES,
} from "./purchaseOrderService";
import PurchaseOrderFormDialog from "./PurchaseOrderFormDialog";
import type {
  SupplierQuotation,
  ScmPurchaseOrder,
  ScmPOStatus,
  GoodsReceipt,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { RECEIVABLE_PO_STATUSES } from "@/modules/scm/shared/businessRules";
import {
  ALL,
  errorMessage,
  formatCurrency,
  formatStatusLabel,
} from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";

const STATUSES = Object.keys(PO_STATUS_TONE) as ScmPOStatus[];

interface PoLocationState {
  fromQuotation?: SupplierQuotation;
}

export default function ScmPurchaseOrders() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    vendors,
    activeVendors,
    products,
    warehouses,
    loading: mastersLoading,
    error: mastersError,
  } = useProcurementMasters();
  useErrorToast(mastersError);

  const [pos, setPos] = useState<ScmPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [sourceQuotation, setSourceQuotation] =
    useState<SupplierQuotation | null>(null);
  const [viewPo, setViewPo] = useState<ScmPurchaseOrder | null>(null);
  const [viewGrns, setViewGrns] = useState<GoodsReceipt[]>([]);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getAllRecords(
        PROCUREMENT_PATHS.purchaseOrders,
      )) as ScmPurchaseOrder[];
      setPos(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load purchase orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (fromQuotation?: SupplierQuotation) => {
    setSourceQuotation(fromQuotation || null);
    setFormOpen(true);
  };

  useEffect(() => {
    const fromQuotation = (location.state as PoLocationState | null)
      ?.fromQuotation;
    if (fromQuotation) {
      openCreate(fromQuotation);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const filtered = useMemo(() => {
    return pos.filter((p) => {
      if (statusFilter !== ALL && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${p.poNumber} ${p.vendorNameSnapshot}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [pos, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** Runs a row action with the busy flag, a toast and a reload either way. */
  const runAction = async (
    po: ScmPurchaseOrder,
    action: () => Promise<void>,
    success: string,
    failure: string,
  ) => {
    setBusyId(po.id);
    try {
      await action();
      toast.success(success);
    } catch (err: unknown) {
      toast.error(errorMessage(err, failure));
    } finally {
      setBusyId(null);
      load();
    }
  };

  const submit = (po: ScmPurchaseOrder) =>
    runAction(
      po,
      async () => {
        await transitionStatus<ScmPOStatus>(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          ["DRAFT"],
          "PENDING_APPROVAL",
        );
        await logRecordAudit(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          "PO submitted for approval",
          performedBy,
          po.poNumber,
        );
        await notifyAdminFeed(
          "Purchase Order Awaiting Approval",
          `${po.poNumber} (${po.vendorNameSnapshot}) submitted by ${performedBy}`,
          "procurement",
        );
      },
      "Submitted for approval",
      "Failed to submit",
    );

  const approve = (po: ScmPurchaseOrder) =>
    runAction(
      po,
      async () => {
        await approvePurchaseOrder(po.id, performedBy);
        await logRecordAudit(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          "PO approved",
          performedBy,
          po.poNumber,
        );
        await notifyAdminFeed(
          "Purchase Order Approved",
          `${po.poNumber} (${po.vendorNameSnapshot}) approved by ${performedBy}`,
          "procurement",
        );
      },
      "Purchase order approved",
      "Failed to approve",
    );

  const send = (po: ScmPurchaseOrder) =>
    runAction(
      po,
      async () => {
        await transitionStatus<ScmPOStatus>(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          ["APPROVED"],
          "SENT",
        );
        await logRecordAudit(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          "PO sent to supplier",
          performedBy,
          po.poNumber,
        );
      },
      "Purchase order marked as sent",
      "Failed to mark as sent",
    );

  const cancel = (po: ScmPurchaseOrder) => {
    if (
      !window.confirm(
        `Cancel purchase order ${po.poNumber}? This cannot be undone.`,
      )
    )
      return;
    return runAction(
      po,
      async () => {
        await cancelPurchaseOrder(po.id);
        await logRecordAudit(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          "PO cancelled",
          performedBy,
          po.poNumber,
        );
      },
      "Purchase order cancelled",
      "Failed to cancel",
    );
  };

  const close = (po: ScmPurchaseOrder) => {
    if (
      !window.confirm(
        `Close purchase order ${po.poNumber}? Any remaining un-received quantity will no longer be tracked as incoming.`,
      )
    )
      return;
    return runAction(
      po,
      async () => {
        await closePurchaseOrder(po.id);
        await logRecordAudit(
          PROCUREMENT_PATHS.purchaseOrders,
          po.id,
          "PO closed",
          performedBy,
          po.poNumber,
        );
      },
      "Purchase order closed",
      "Failed to close",
    );
  };

  const openView = async (po: ScmPurchaseOrder) => {
    setViewPo(po);
    try {
      const grns = (await getAllRecords(
        PROCUREMENT_PATHS.grns,
      )) as GoodsReceipt[];
      setViewGrns(grns.filter((g) => g.purchaseOrderId === po.id));
    } catch {
      setViewGrns([]);
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = pos.find(
      (p) => p.poNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No purchase order found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "PROCUREMENT",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "PURCHASE_ORDER",
      label: match.poNumber,
      source: "PROCUREMENT",
    });
    openView(match);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Purchase Orders
          </h2>
          <p className="text-muted-foreground mt-1">
            Purchase orders raised against approved supplier quotations, ready
            for goods receipt.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan PO
          </Button>
          <Button
            onClick={() => openCreate()}
            disabled={
              mastersLoading || vendors.length === 0 || warehouses.length === 0
            }
          >
            <Plus className="h-4 w-4 mr-2" /> New Purchase Order
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number or supplier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
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
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {pos.length} purchase orders
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO Date</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
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
                      Loading purchase orders...
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageCheck className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          {pos.length === 0
                            ? "No purchase orders yet"
                            : "No purchase orders match the current filters"}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((po) => (
                    <TableRow
                      key={po.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {po.poNumber}
                      </TableCell>
                      <TableCell>{po.vendorNameSnapshot}</TableCell>
                      <TableCell>{po.poDate}</TableCell>
                      <TableCell>{po.expectedDeliveryDate || "—"}</TableCell>
                      <TableCell>{po.items.length}</TableCell>
                      <TableCell>
                        {formatCurrency(po.total, po.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PO_STATUS_TONE[po.status]}
                        >
                          {formatStatusLabel(po.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Related Documents"
                            onClick={() => openView(po)}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          {po.status === "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Submit for Approval"
                              onClick={() => submit(po)}
                              disabled={busyId === po.id}
                            >
                              <Send className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {po.status === "PENDING_APPROVAL" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Approve"
                              onClick={() => approve(po)}
                              disabled={busyId === po.id}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {po.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark as Sent"
                              onClick={() => send(po)}
                              disabled={busyId === po.id}
                            >
                              <Send className="h-4 w-4 text-indigo-600" />
                            </Button>
                          )}
                          {RECEIVABLE_PO_STATUSES.has(po.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Receive Goods"
                              onClick={() =>
                                navigate("/scm/procurement/grn", {
                                  state: { fromPo: { id: po.id } },
                                })
                              }
                              disabled={busyId === po.id}
                            >
                              <PackageCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {CLOSABLE_PO_STATUSES.includes(po.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Close PO"
                              onClick={() => close(po)}
                              disabled={busyId === po.id}
                            >
                              <Lock className="h-4 w-4 text-gray-600" />
                            </Button>
                          )}
                          {CANCELLABLE_PO_STATUSES.includes(po.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel"
                              onClick={() => cancel(po)}
                              disabled={busyId === po.id}
                            >
                              <Ban className="h-4 w-4 text-red-600" />
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
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PurchaseOrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        sourceQuotation={sourceQuotation}
        vendors={vendors}
        activeVendors={activeVendors}
        products={products}
        warehouses={warehouses}
        performedBy={performedBy}
        onSaved={load}
      />

      <Dialog
        open={!!viewPo}
        onOpenChange={(o) => {
          if (!o) setViewPo(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Related Documents — {viewPo?.poNumber}</DialogTitle>
          </DialogHeader>
          {viewPo && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Source Requisition
                </span>
                <span className="font-mono">
                  {viewPo.sourceRequisitionNumber || "—"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Source RFQ</span>
                <span className="font-mono">
                  {viewPo.sourceRfqNumber || "—"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Source Quotation</span>
                <span className="font-mono">
                  {viewPo.sourceQuotationNumber || "—"}
                </span>
              </div>
              <div className="border-b pb-2">
                <div className="text-muted-foreground mb-1">Goods Receipts</div>
                {viewGrns.length === 0 ? (
                  <div className="text-muted-foreground italic">None yet</div>
                ) : (
                  viewGrns.map((g) => (
                    <div key={g.id} className="flex justify-between">
                      <span className="font-mono">{g.grnNumber}</span>
                      <Badge variant="outline">
                        {formatStatusLabel(g.status)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor Bill</span>
                <span className="text-muted-foreground italic">
                  Finance integration pending
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Purchase Order"
        placeholder="PO number"
      />
    </div>
  );
}
