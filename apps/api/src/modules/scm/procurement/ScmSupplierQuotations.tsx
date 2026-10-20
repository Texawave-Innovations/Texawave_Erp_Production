import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Search, Plus, Trash2, Scale, Ban } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  QUOTATION_STATUS_TONE,
  documentTotals,
  duplicateProductCode,
  lineTotal,
  useProcurementMasters,
  validatePricing,
} from "./procurementHelpers";
import {
  RFQ_OPEN_FOR_RESPONSES,
  getOpenRfq,
  refreshRfqResponseStatus,
} from "./quotationService";
import { DEFAULT_UOM } from "@/modules/scm/inventory/productCatalog";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import type {
  Rfq,
  SupplierQuotation,
  SupplierQuotationItem,
  QuotationStatus,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  ALL,
  errorMessage,
  formatCurrency,
  formatStatusLabel,
  toLocalDateKey,
} from "@/modules/scm/shared/format";

const STATUSES = Object.keys(QUOTATION_STATUS_TONE) as QuotationStatus[];

interface QuotationLocationState {
  fromRfq?: Rfq;
}

type ItemDraft = {
  productCode: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  promisedDeliveryDate: string;
  notes: string;
};
function emptyItem(): ItemDraft {
  return {
    productCode: "",
    quantity: "",
    unitPrice: "",
    discount: "0",
    taxRate: "0",
    promisedDeliveryDate: "",
    notes: "",
  };
}

export default function ScmSupplierQuotations() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    vendors,
    products,
    loading: mastersLoading,
    error: mastersError,
  } = useProcurementMasters();
  useErrorToast(mastersError);

  const [quotations, setQuotations] = useState<SupplierQuotation[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rfqId: "",
    vendorId: "",
    supplierQuotationNumber: "",
    quotationDate: toLocalDateKey(),
    validUntil: "",
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    freight: "0",
    discount: "0",
    notes: "",
  });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, r] = await Promise.all([
        getAllRecords(PROCUREMENT_PATHS.quotations) as Promise<
          SupplierQuotation[]
        >,
        getAllRecords(PROCUREMENT_PATHS.rfqs) as Promise<Rfq[]>,
      ]);
      setQuotations(q.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setRfqs(r);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load supplier quotations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRfqs = useMemo(
    () => rfqs.filter((r) => RFQ_OPEN_FOR_RESPONSES.includes(r.status)),
    [rfqs],
  );

  useEffect(() => {
    const fromRfq = (location.state as QuotationLocationState | null)?.fromRfq;
    if (fromRfq) {
      openCreate(fromRfq);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== ALL && q.status !== statusFilter) return false;
      if (search.trim()) {
        const q2 = search.trim().toLowerCase();
        const vendor = vendors.find((v) => v.id === q.vendorId);
        if (
          !`${q.quotationNumber} ${q.rfqNumber || ""} ${vendor?.companyName || ""}`
            .toLowerCase()
            .includes(q2)
        )
          return false;
      }
      return true;
    });
  }, [quotations, statusFilter, search, vendors]);

  const openCreate = (fromRfq?: Rfq) => {
    setForm({
      rfqId: fromRfq?.id || "",
      vendorId: "",
      supplierQuotationNumber: "",
      quotationDate: toLocalDateKey(),
      validUntil: "",
      currency: fromRfq?.currency || "INR",
      paymentTerms: fromRfq?.paymentTerms || "",
      deliveryTerms: fromRfq?.deliveryTerms || "",
      freight: "0",
      discount: "0",
      notes: "",
    });
    setItems(
      fromRfq
        ? fromRfq.items.map((it) => ({
            productCode: it.productCode,
            quantity: String(it.quantity),
            unitPrice: "",
            discount: "0",
            taxRate: "0",
            promisedDeliveryDate: "",
            notes: "",
          }))
        : [emptyItem()],
    );
    setFormOpen(true);
  };

  const computedItems = (): SupplierQuotationItem[] =>
    items
      .filter((it) => it.productCode && Number(it.quantity) > 0)
      .map((it) => {
        const product = products.find((p) => p.productCode === it.productCode);
        const quantity = Number(it.quantity) || 0;
        const unitPrice = Number(it.unitPrice) || 0;
        const discount = Number(it.discount) || 0;
        const taxRate = Number(it.taxRate) || 0;
        const { taxAmount, total } = lineTotal(
          quantity,
          unitPrice,
          discount,
          taxRate,
        );
        return {
          productCode: it.productCode,
          productName: product?.name || it.productCode,
          uom: product?.uom || DEFAULT_UOM,
          quantity,
          unitPrice,
          discount,
          taxRate,
          taxAmount,
          total,
          promisedDeliveryDate: it.promisedDeliveryDate || undefined,
          notes: it.notes || undefined,
        };
      });

  const handleSave = async () => {
    if (!form.rfqId) {
      toast.error("Select the RFQ this quotation responds to");
      return;
    }
    if (!form.vendorId) {
      toast.error("Select the supplier");
      return;
    }
    const lineItems = computedItems();
    if (lineItems.length === 0) {
      toast.error("Add at least one item with quantity and unit price");
      return;
    }
    const dup = duplicateProductCode(lineItems);
    if (dup) {
      toast.error(
        `${dup} appears on more than one line — combine them into one line`,
      );
      return;
    }
    const freight = Number(form.freight) || 0;
    const discount = Number(form.discount) || 0;
    const invalid = validatePricing(lineItems, freight, discount);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setSaving(true);
    try {
      // Fresh read: the RFQ may have been closed or cancelled since the list loaded.
      const rfq = await getOpenRfq(form.rfqId);
      if (!(rfq.supplierIds || []).includes(form.vendorId))
        throw new Error("This supplier was not invited on the selected RFQ");
      const vendor = vendors.find((v) => v.id === form.vendorId);
      const {
        subtotal,
        taxAmount: tax,
        total,
      } = documentTotals(lineItems, freight, discount);
      const quotationNumber = await reserveDocumentNumber("supplierQuotation");
      const id = await createRecord(PROCUREMENT_PATHS.quotations, {
        quotationNumber,
        supplierQuotationNumber:
          form.supplierQuotationNumber.trim() || undefined,
        rfqId: form.rfqId,
        rfqNumber: rfq.rfqNumber,
        vendorId: form.vendorId,
        vendorNameSnapshot: vendor?.companyName,
        vendorGSTINSnapshot: vendor?.gst,
        quotationDate: form.quotationDate,
        validUntil: form.validUntil || undefined,
        currency: form.currency.trim().toUpperCase() || "INR",
        paymentTerms: form.paymentTerms.trim() || undefined,
        deliveryTerms: form.deliveryTerms.trim() || undefined,
        freight,
        discount,
        tax,
        subtotal,
        total,
        notes: form.notes.trim() || undefined,
        items: lineItems,
        status: "RECEIVED" as QuotationStatus,
        createdBy: performedBy,
        createdAt: Date.now(),
      });
      if (id)
        await logRecordAudit(
          PROCUREMENT_PATHS.quotations,
          id,
          "Supplier quotation recorded",
          performedBy,
          `${quotationNumber} from ${vendor?.companyName}`,
        );
      await refreshRfqResponseStatus(rfq);
      toast.success(`Quotation ${quotationNumber} recorded`);
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save quotation"));
    } finally {
      setSaving(false);
    }
  };

  const reject = async (q: SupplierQuotation) => {
    setBusyId(q.id);
    try {
      await transitionStatus<QuotationStatus>(
        PROCUREMENT_PATHS.quotations,
        q.id,
        ["RECEIVED", "UNDER_REVIEW", "SHORTLISTED"],
        "REJECTED",
      );
      await logRecordAudit(
        PROCUREMENT_PATHS.quotations,
        q.id,
        "Quotation rejected",
        performedBy,
        q.quotationNumber,
      );
      toast.success("Quotation rejected");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to reject quotation"));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (q: SupplierQuotation) => {
    if (!window.confirm(`Cancel quotation ${q.quotationNumber}?`)) return;
    setBusyId(q.id);
    try {
      await transitionStatus<QuotationStatus>(
        PROCUREMENT_PATHS.quotations,
        q.id,
        STATUSES.filter((st) => st !== "CANCELLED" && st !== "SELECTED"),
        "CANCELLED",
      );
      await logRecordAudit(
        PROCUREMENT_PATHS.quotations,
        q.id,
        "Quotation cancelled",
        performedBy,
        q.quotationNumber,
      );
      toast.success("Quotation cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel quotation"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Supplier Quotations
          </h2>
          <p className="text-muted-foreground mt-1">
            Record supplier responses to RFQs for comparison and approval.
          </p>
        </div>
        <Button
          onClick={() => openCreate()}
          disabled={mastersLoading || openRfqs.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Record Quotation
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number, RFQ or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
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
            {filtered.length} of {quotations.length} quotations
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Until</TableHead>
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
                      Loading quotations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Scale className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          {quotations.length === 0
                            ? "No supplier quotations recorded yet"
                            : "No quotations match the current filters"}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((q) => (
                    <TableRow
                      key={q.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {q.quotationNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {q.rfqNumber || "—"}
                      </TableCell>
                      <TableCell>{q.vendorNameSnapshot}</TableCell>
                      <TableCell>{q.quotationDate}</TableCell>
                      <TableCell>{q.validUntil || "—"}</TableCell>
                      <TableCell>
                        {formatCurrency(q.total, q.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={QUOTATION_STATUS_TONE[q.status]}
                        >
                          {formatStatusLabel(q.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(q.status === "RECEIVED" ||
                            q.status === "UNDER_REVIEW" ||
                            q.status === "SHORTLISTED") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Compare"
                                onClick={() =>
                                  navigate("/scm/procurement/comparison", {
                                    state: { rfqId: q.rfqId },
                                  })
                                }
                                disabled={busyId === q.id}
                              >
                                <Scale className="h-4 w-4 text-indigo-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject"
                                onClick={() => reject(q)}
                                disabled={busyId === q.id}
                              >
                                <Ban className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {q.status !== "CANCELLED" &&
                            q.status !== "SELECTED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancel"
                                onClick={() => cancel(q)}
                                disabled={busyId === q.id}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Supplier Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RFQ *</Label>
                <Select
                  value={form.rfqId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, rfqId: v, vendorId: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select RFQ" />
                  </SelectTrigger>
                  <SelectContent>
                    {openRfqs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.rfqNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Supplier *</Label>
                <Select
                  value={form.vendorId}
                  onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      rfqs.find((r) => r.id === form.rfqId)?.supplierIds || []
                    ).map((vid) => {
                      const v = vendors.find((vv) => vv.id === vid);
                      return v ? (
                        <SelectItem key={v.id} value={v.id}>
                          {v.companyName}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier's Quote #</Label>
                <Input
                  value={form.supplierQuotationNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      supplierQuotationNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quotation Date *</Label>
                <Input
                  type="date"
                  value={form.quotationDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quotationDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validUntil: e.target.value }))
                  }
                />
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
                <Label>Payment Terms</Label>
                <Input
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                  }
                />
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
                {items.map((it, idx) => {
                  const computed = lineTotal(
                    Number(it.quantity) || 0,
                    Number(it.unitPrice) || 0,
                    Number(it.discount) || 0,
                    Number(it.taxRate) || 0,
                  );
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end border rounded-md p-2"
                    >
                      <div className="col-span-3 space-y-1">
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
                      <div className="col-span-1 space-y-1">
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
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) =>
                            setItems((arr) =>
                              arr.map((r, i2) =>
                                i2 === idx
                                  ? { ...r, unitPrice: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">Disc.</Label>
                        <Input
                          type="number"
                          min="0"
                          value={it.discount}
                          onChange={(e) =>
                            setItems((arr) =>
                              arr.map((r, i2) =>
                                i2 === idx
                                  ? { ...r, discount: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          min="0"
                          value={it.taxRate}
                          onChange={(e) =>
                            setItems((arr) =>
                              arr.map((r, i2) =>
                                i2 === idx
                                  ? { ...r, taxRate: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Promised Delivery</Label>
                        <Input
                          type="date"
                          value={it.promisedDeliveryDate}
                          onChange={(e) =>
                            setItems((arr) =>
                              arr.map((r, i2) =>
                                i2 === idx
                                  ? {
                                      ...r,
                                      promisedDeliveryDate: e.target.value,
                                    }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1 text-sm text-right font-medium pb-2">
                        {formatCurrency(computed.total, form.currency)}
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
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Freight</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.freight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, freight: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Overall Discount</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discount: e.target.value }))
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
                />
              </div>
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
              {saving ? "Saving..." : "Save Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
