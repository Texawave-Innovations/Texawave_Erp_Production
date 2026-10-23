import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  Plus,
  Send,
  Trash2,
  Lock,
  Ban,
  ReceiptText,
  ScanLine,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  RFQ_STATUS_TONE,
  duplicateProductCode,
  useProcurementMasters,
} from "./procurementHelpers";
import { DEFAULT_UOM } from "@/modules/scm/inventory/productCatalog";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import type {
  PurchaseRequisition,
  RequisitionStatus,
  Rfq,
  RfqItem,
  RfqStatus,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  ALL,
  errorMessage,
  formatStatusLabel,
  toLocalDateKey,
} from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";

// Issuing an RFQ moves it straight to RESPONSES_PENDING, so ISSUED is never set and isn't offered.
const STATUSES = (Object.keys(RFQ_STATUS_TONE) as RfqStatus[]).filter(
  (s) => s !== "ISSUED",
);
const RESPONSE_STATUSES: RfqStatus[] = [
  "RESPONSES_PENDING",
  "PARTIALLY_RESPONDED",
  "RESPONDED",
];

interface RfqLocationState {
  fromRequisition?: PurchaseRequisition;
}

type ItemDraft = { productCode: string; quantity: string; notes: string };
function emptyItem(): ItemDraft {
  return { productCode: "", quantity: "", notes: "" };
}

export default function ScmRfqs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    activeVendors,
    products,
    warehouses,
    loading: mastersLoading,
    error: mastersError,
  } = useProcurementMasters();
  useErrorToast(mastersError);

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceRequisition, setSourceRequisition] =
    useState<PurchaseRequisition | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrFor, setQrFor] = useState<Rfq | null>(null);
  const [form, setForm] = useState({
    issueDate: toLocalDateKey(),
    responseDueDate: "",
    warehouseId: "",
    deliveryLocation: "",
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    notes: "",
  });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getAllRecords(PROCUREMENT_PATHS.rfqs)) as Rfq[];
      setRfqs(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load RFQs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Arriving from "Create RFQ" on an approved Purchase Requisition pre-fills the form.
  useEffect(() => {
    const fromRequisition = (location.state as RfqLocationState | null)
      ?.fromRequisition;
    if (fromRequisition) {
      openCreate(fromRequisition);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filtered = useMemo(() => {
    return rfqs.filter((r) => {
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !`${r.rfqNumber} ${r.sourceRequisitionNumber || ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rfqs, statusFilter, search]);

  const openCreate = (fromRequisition?: PurchaseRequisition) => {
    setSourceRequisition(fromRequisition || null);
    setForm({
      issueDate: toLocalDateKey(),
      responseDueDate: "",
      warehouseId: fromRequisition?.warehouseId || warehouses[0]?.id || "",
      deliveryLocation: "",
      currency: "INR",
      paymentTerms: "",
      deliveryTerms: "",
      notes: "",
    });
    setItems(
      fromRequisition
        ? fromRequisition.items.map((it) => ({
            productCode: it.productCode,
            quantity: String(it.quantity),
            notes: it.notes || "",
          }))
        : [emptyItem()],
    );
    setSelectedVendorIds([]);
    setFormOpen(true);
  };

  const computedItems = (): RfqItem[] =>
    items
      .filter((it) => it.productCode && Number(it.quantity) > 0)
      .map((it) => {
        const product = products.find((p) => p.productCode === it.productCode);
        return {
          productCode: it.productCode,
          productName: product?.name || it.productCode,
          uom: product?.uom || DEFAULT_UOM,
          quantity: Number(it.quantity) || 0,
          notes: it.notes || undefined,
        };
      });

  const handleSave = async () => {
    if (!form.warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    if (selectedVendorIds.length === 0) {
      toast.error("Select at least one supplier");
      return;
    }
    const lineItems = computedItems();
    if (lineItems.length === 0) {
      toast.error("Add at least one item with a quantity greater than zero");
      return;
    }
    const dup = duplicateProductCode(lineItems);
    if (dup) {
      toast.error(
        `${dup} appears on more than one line — combine them into one line`,
      );
      return;
    }
    const supplierIds = selectedVendorIds.filter((id) =>
      activeVendors.some((v) => v.id === id),
    );
    if (supplierIds.length === 0) {
      toast.error("Select at least one active supplier");
      return;
    }

    setSaving(true);
    let converted = false;
    try {
      // Claim the requisition first so it can never be converted into two RFQs.
      if (sourceRequisition) {
        await transitionStatus<RequisitionStatus>(
          PROCUREMENT_PATHS.requisitions,
          sourceRequisition.id,
          ["APPROVED"],
          "CONVERTED",
        );
        converted = true;
      }
      const rfqNumber = await reserveDocumentNumber("rfq");
      const supplierNamesSnapshot: Record<string, string> = {};
      supplierIds.forEach((id) => {
        const v = activeVendors.find((vv) => vv.id === id);
        if (v) supplierNamesSnapshot[id] = v.companyName;
      });
      const id = await createRecord(PROCUREMENT_PATHS.rfqs, {
        rfqNumber,
        sourceRequisitionId: sourceRequisition?.id,
        sourceRequisitionNumber: sourceRequisition?.requisitionNumber,
        supplierIds,
        supplierNamesSnapshot,
        issueDate: form.issueDate,
        responseDueDate: form.responseDueDate || undefined,
        warehouseId: form.warehouseId,
        deliveryLocation: form.deliveryLocation.trim() || undefined,
        currency: form.currency,
        paymentTerms: form.paymentTerms.trim() || undefined,
        deliveryTerms: form.deliveryTerms.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: lineItems,
        status: "DRAFT" as RfqStatus,
        createdBy: performedBy,
        createdAt: Date.now(),
      });
      if (id)
        await logRecordAudit(
          PROCUREMENT_PATHS.rfqs,
          id,
          "RFQ created",
          performedBy,
          rfqNumber,
        );
      if (sourceRequisition) {
        await logRecordAudit(
          PROCUREMENT_PATHS.requisitions,
          sourceRequisition.id,
          "Requisition converted to RFQ",
          performedBy,
          rfqNumber,
        );
      }
      toast.success(`RFQ ${rfqNumber} created as draft`);
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      if (converted && sourceRequisition) {
        await transitionStatus<RequisitionStatus>(
          PROCUREMENT_PATHS.requisitions,
          sourceRequisition.id,
          ["CONVERTED"],
          "APPROVED",
        ).catch(() => undefined);
      }
      toast.error(errorMessage(err, "Failed to create RFQ"));
    } finally {
      setSaving(false);
    }
  };

  const issue = async (r: Rfq) => {
    setBusyId(r.id);
    try {
      await transitionStatus<RfqStatus>(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        ["DRAFT"],
        "RESPONSES_PENDING",
      );
      await logRecordAudit(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        "RFQ issued to suppliers",
        performedBy,
        `${r.rfqNumber}: ${r.supplierIds.length} supplier(s)`,
      );
      toast.success("RFQ issued to selected suppliers");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to issue RFQ"));
    } finally {
      setBusyId(null);
    }
  };

  const close = async (r: Rfq) => {
    setBusyId(r.id);
    try {
      await transitionStatus<RfqStatus>(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        RESPONSE_STATUSES,
        "CLOSED",
      );
      await logRecordAudit(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        "RFQ closed",
        performedBy,
        r.rfqNumber,
      );
      toast.success("RFQ closed");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to close RFQ"));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (r: Rfq) => {
    if (!window.confirm(`Cancel RFQ ${r.rfqNumber}?`)) return;
    setBusyId(r.id);
    try {
      await transitionStatus<RfqStatus>(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        ["DRAFT", "RESPONSES_PENDING", "PARTIALLY_RESPONDED"],
        "CANCELLED",
      );
      await logRecordAudit(
        PROCUREMENT_PATHS.rfqs,
        r.id,
        "RFQ cancelled",
        performedBy,
        r.rfqNumber,
      );
      toast.success("RFQ cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel RFQ"));
    } finally {
      setBusyId(null);
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = rfqs.find(
      (r) => r.rfqNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No RFQ found for "${scanned}"`);
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
      type: "RFQ",
      label: match.rfqNumber,
      source: "PROCUREMENT",
    });
    setSearch(match.rfqNumber);
    toast.success(`Found: ${match.rfqNumber}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">RFQs</h2>
          <p className="text-muted-foreground mt-1">
            Request quotations from suppliers against an approved requisition or
            a direct requirement.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan RFQ
          </Button>
          <Button
            onClick={() => openCreate()}
            disabled={
              mastersLoading ||
              warehouses.length === 0 ||
              activeVendors.length === 0
            }
          >
            <Plus className="h-4 w-4 mr-2" /> New RFQ
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by RFQ number or source PR..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            {filtered.length} of {rfqs.length} RFQs
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ #</TableHead>
                  <TableHead>Source PR</TableHead>
                  <TableHead>Suppliers</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Response Due</TableHead>
                  <TableHead>Items</TableHead>
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
                      Loading RFQs...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Send className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          {rfqs.length === 0
                            ? "No RFQs yet"
                            : "No RFQs match the current filters"}
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
                      <TableCell className="font-mono text-xs">
                        {r.rfqNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.sourceRequisitionNumber || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.supplierIds.length} supplier(s)
                      </TableCell>
                      <TableCell>{r.issueDate}</TableCell>
                      <TableCell>{r.responseDueDate || "—"}</TableCell>
                      <TableCell>{r.items.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={RFQ_STATUS_TONE[r.status]}
                        >
                          {formatStatusLabel(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {r.status === "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Issue to Suppliers"
                              onClick={() => issue(r)}
                              disabled={busyId === r.id}
                            >
                              <Send className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {RESPONSE_STATUSES.includes(r.status) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Record Supplier Quotation"
                                onClick={() =>
                                  navigate("/scm/procurement/quotations", {
                                    state: { fromRfq: r },
                                  })
                                }
                                disabled={busyId === r.id}
                              >
                                <ReceiptText className="h-4 w-4 text-indigo-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Close RFQ"
                                onClick={() => close(r)}
                                disabled={busyId === r.id}
                              >
                                <Lock className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          )}
                          {(r.status === "DRAFT" ||
                            r.status === "RESPONSES_PENDING" ||
                            r.status === "PARTIALLY_RESPONDED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel"
                              onClick={() => cancel(r)}
                              disabled={busyId === r.id}
                            >
                              <Ban className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="QR Code"
                            onClick={() => setQrFor(r)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New RFQ
              {sourceRequisition
                ? ` from ${sourceRequisition.requisitionNumber}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Issue Date *</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Response Due</Label>
                <Input
                  type="date"
                  value={form.responseDueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, responseDueDate: e.target.value }))
                  }
                />
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
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Delivery Location</Label>
                <Input
                  value={form.deliveryLocation}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryLocation: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Terms</Label>
              <Input
                value={form.deliveryTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deliveryTerms: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Suppliers *</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {activeVendors.length === 0 && (
                  <div className="text-sm text-muted-foreground col-span-2">
                    No active suppliers.
                  </div>
                )}
                {activeVendors.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedVendorIds.includes(v.id)}
                      onCheckedChange={(checked) => {
                        setSelectedVendorIds((ids) =>
                          checked
                            ? [...ids, v.id]
                            : ids.filter((id) => id !== v.id),
                        );
                      }}
                    />
                    {v.companyName}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((i) => [...i, emptyItem()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end border rounded-md p-2"
                  >
                    <div className="col-span-6 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={it.productCode}
                        onValueChange={(v) =>
                          setItems((arr) =>
                            arr.map((r, i2) =>
                              i2 === idx ? { ...r, productCode: v } : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem
                              key={p.productCode}
                              value={p.productCode}
                            >
                              {p.name} ({p.productCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        value={it.quantity}
                        onChange={(e) =>
                          setItems((arr) =>
                            arr.map((r, i2) =>
                              i2 === idx
                                ? { ...r, quantity: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={it.notes}
                        onChange={(e) =>
                          setItems((arr) =>
                            arr.map((r, i2) =>
                              i2 === idx ? { ...r, notes: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setItems((arr) => arr.filter((_, i2) => i2 !== idx))
                        }
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan RFQ"
        placeholder="RFQ number"
      />

      <Dialog
        open={!!qrFor}
        onOpenChange={(o) => {
          if (!o) setQrFor(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>RFQ QR Code</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload("RFQ", qrFor.rfqNumber, qrFor.id)}
              title={qrFor.rfqNumber}
              subtitle={qrFor.sourceRequisitionNumber}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
