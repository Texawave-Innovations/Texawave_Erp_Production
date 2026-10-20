import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
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
  Search,
  Plus,
  PackageCheck,
  Eye,
  RotateCcw,
  ScanLine,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { getLedgerEntries } from "@/modules/scm/inventory/stockLedgerService";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import { GRN_STATUS_TONE, useProcurementMasters } from "./procurementHelpers";
import { postGrn } from "./grnService";
import GrnReceiveDialog from "./GrnReceiveDialog";
import type { ScmPurchaseOrder, GoodsReceipt } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { RECEIVABLE_PO_STATUSES } from "@/modules/scm/shared/businessRules";
import {
  errorMessage,
  formatCurrency,
  formatStatusLabel,
} from "@/modules/scm/shared/format";
import { buildQrPayload } from "@/modules/scm/barcode/barcodeHelpers";
import { addScanHistoryEntry } from "@/modules/scm/barcode/barcodeService";
import ScmBarcodeScanner from "@/modules/scm/barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "@/modules/scm/barcode/components/ScmBarcodeLabel";

interface GrnLocationState {
  fromPo?: Pick<ScmPurchaseOrder, "id">;
}

export default function ScmGrn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    warehouses,
    settingsByCode,
    loading: mastersLoading,
    error: mastersError,
  } = useProcurementMasters();
  useErrorToast(mastersError);

  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ScmPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [initialPoId, setInitialPoId] = useState<string | undefined>();

  const [viewGrn, setViewGrn] = useState<GoodsReceipt | null>(null);
  const [viewLedgerCount, setViewLedgerCount] = useState(0);

  const [findOpen, setFindOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Header-level "Scan PO / Scan GRN" — finds an existing GRN by scanning its number (filters
  // the list) or opens "Receive Goods" pre-selected to a scanned PO number, per Phase 12b's
  // GRN scan entry points.
  const handleFindScan = (code: string) => {
    const scanned = code.trim();
    const grn = grns.find(
      (g) => g.grnNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (grn) {
      setSearch(grn.grnNumber);
      toast.success(`Found GRN ${grn.grnNumber}`);
      addScanHistoryEntry({
        code: scanned,
        type: "GRN",
        label: grn.grnNumber,
        source: "GRN",
      });
      return;
    }
    const po = purchaseOrders.find(
      (p) => p.poNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (po) {
      if (receivablePos.some((p) => p.id === po.id)) {
        openCreate(po.id);
        toast.success(`Receiving against PO ${po.poNumber}`);
      } else {
        toast.error(
          `PO ${po.poNumber} is not currently receivable (${po.status.replace(/_/g, " ")})`,
        );
      }
      addScanHistoryEntry({
        code: scanned,
        type: "PURCHASE_ORDER",
        label: po.poNumber,
        source: "GRN",
      });
      return;
    }
    toast.error(`No PO or GRN found for "${scanned}"`);
    addScanHistoryEntry({
      code: scanned,
      type: "UNKNOWN",
      label: "Not found",
      source: "GRN",
    });
  };

  const openView = async (g: GoodsReceipt) => {
    setViewGrn(g);
    try {
      const entries = await getLedgerEntries();
      setViewLedgerCount(
        entries.filter(
          (e) => e.referenceType === "GRN" && e.referenceId === g.id,
        ).length,
      );
    } catch {
      setViewLedgerCount(0);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, p] = await Promise.all([
        getAllRecords(PROCUREMENT_PATHS.grns) as Promise<GoodsReceipt[]>,
        getAllRecords(PROCUREMENT_PATHS.purchaseOrders) as Promise<
          ScmPurchaseOrder[]
        >,
      ]);
      setGrns(g.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setPurchaseOrders(p);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load goods receipts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const receivablePos = useMemo(
    () => purchaseOrders.filter((p) => RECEIVABLE_PO_STATUSES.has(p.status)),
    [purchaseOrders],
  );

  const openCreate = (poId?: string) => {
    setInitialPoId(poId);
    setFormOpen(true);
  };

  useEffect(() => {
    const fromPo = (location.state as GrnLocationState | null)?.fromPo;
    if (fromPo && purchaseOrders.length > 0) {
      openCreate(fromPo.id);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, purchaseOrders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grns;
    const q = search.trim().toLowerCase();
    return grns.filter((g) =>
      `${g.grnNumber} ${g.purchaseOrderNumber || ""} ${g.vendorNameSnapshot || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [grns, search]);

  /** A DRAFT GRN is one whose stock posting didn't finish — posting is idempotent, so retry. */
  const retryPosting = async (g: GoodsReceipt) => {
    setBusyId(g.id);
    try {
      const poStatus = await postGrn(g, performedBy);
      toast.success(
        `${g.grnNumber} posted — PO is now ${formatStatusLabel(poStatus)}`,
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to post goods receipt"));
    } finally {
      setBusyId(null);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">
            Goods Receipt (GRN)
          </h2>
          <p className="text-muted-foreground mt-1">
            Receive goods against an open purchase order. Finalizing posts a
            PURCHASE_RECEIPT entry to the authoritative stock ledger — nothing
            here edits on-hand quantity directly.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setFindOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan PO / GRN
          </Button>
          <Button
            onClick={() => openCreate()}
            disabled={mastersLoading || receivablePos.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" /> Receive Goods
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by GRN number, PO or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {grns.length} goods receipts
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Purchase Order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Receipt Date</TableHead>
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
                      Loading goods receipts...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageCheck className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          {grns.length === 0
                            ? "No goods receipts recorded yet"
                            : "No GRNs match your search"}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((g) => (
                    <TableRow
                      key={g.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {g.grnNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {g.purchaseOrderNumber}
                      </TableCell>
                      <TableCell>{g.vendorNameSnapshot}</TableCell>
                      <TableCell>{g.receiptDate}</TableCell>
                      <TableCell>{g.items.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={GRN_STATUS_TONE[g.status]}
                        >
                          {g.status === "DRAFT"
                            ? "Posting Incomplete"
                            : formatStatusLabel(g.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {g.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Retry posting"
                            disabled={busyId === g.id}
                            onClick={() => retryPosting(g)}
                          >
                            <RotateCcw className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => openView(g)}
                        >
                          <Eye className="h-4 w-4 text-primary" />
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

      <GrnReceiveDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        receivablePos={receivablePos}
        initialPoId={initialPoId}
        warehouses={warehouses}
        settingsByCode={settingsByCode}
        performedBy={performedBy}
        onSaved={load}
      />

      <Dialog
        open={!!viewGrn}
        onOpenChange={(o) => {
          if (!o) setViewGrn(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-6">
            <DialogTitle>{viewGrn?.grnNumber}</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
              <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR
            </Button>
          </DialogHeader>
          {viewGrn && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                PO {viewGrn.purchaseOrderNumber} · {viewGrn.vendorNameSnapshot}{" "}
                · {viewGrn.receiptDate}
              </div>
              <div className="text-xs text-muted-foreground">
                {viewLedgerCount > 0 ? (
                  <button
                    className="text-primary hover:underline"
                    onClick={() => navigate("/scm/inventory/ledger")}
                  >
                    {viewLedgerCount} stock ledger entr
                    {viewLedgerCount === 1 ? "y" : "ies"} posted →
                  </button>
                ) : (
                  "No stock ledger entries posted for this GRN."
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewGrn.items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">
                        {it.productName}
                        {it.batchNumber && (
                          <div className="text-xs text-muted-foreground">
                            Batch {it.batchNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.receivingQuantity}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.rejectedQuantity}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.acceptedQuantity}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatCurrency(it.totalCost)}
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
        open={findOpen}
        onOpenChange={setFindOpen}
        onResult={(code) => {
          setFindOpen(false);
          handleFindScan(code);
        }}
        title="Scan PO / GRN"
        placeholder="PO number or GRN number"
      />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>GRN QR Code</DialogTitle>
          </DialogHeader>
          {viewGrn && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload("GRN", viewGrn.grnNumber, viewGrn.id)}
              title={viewGrn.grnNumber}
              subtitle={viewGrn.vendorNameSnapshot}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
