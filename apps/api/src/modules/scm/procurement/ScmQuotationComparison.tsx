import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Scale, ShoppingCart, TrendingDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import { QUOTATION_STATUS_TONE } from "./procurementHelpers";
import {
  SELECTABLE_QUOTATION_STATUSES,
  selectQuotation,
} from "./quotationService";
import { findPurchaseOrdersForQuotation } from "./purchaseOrderService";
import type { Rfq, SupplierQuotation, QuotationComparison } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import {
  errorMessage,
  formatCurrency,
  formatStatusLabel,
} from "@/modules/scm/shared/format";

interface ComparisonLocationState {
  rfqId?: string;
}

export default function ScmQuotationComparison() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rfqId, setRfqId] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, q] = await Promise.all([
        getAllRecords(PROCUREMENT_PATHS.rfqs) as Promise<Rfq[]>,
        getAllRecords(PROCUREMENT_PATHS.quotations) as Promise<
          SupplierQuotation[]
        >,
      ]);
      setRfqs(r);
      setQuotations(q);
    } catch (err: unknown) {
      toast.error(
        errorMessage(err, "Failed to load quotations for comparison"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const stateRfqId = (location.state as ComparisonLocationState | null)
      ?.rfqId;
    if (stateRfqId) setRfqId(stateRfqId);
  }, [location.state]);

  const eligibleRfqs = useMemo(
    () => rfqs.filter((r) => quotations.some((q) => q.rfqId === r.id)),
    [rfqs, quotations],
  );
  const rfqQuotations = useMemo(
    () =>
      quotations
        .filter((q) => q.rfqId === rfqId && q.status !== "CANCELLED")
        .sort((a, b) => a.total - b.total),
    [quotations, rfqId],
  );

  const decidedQuotation =
    rfqQuotations.find((q) => q.status === "SELECTED") || null;

  const lowestTotalId =
    rfqQuotations.length > 0
      ? rfqQuotations.reduce((a, b) => (b.total < a.total ? b : a)).id
      : null;
  const earliestDeliveryId = useMemo(() => {
    let best: { id: string; date: string } | null = null;
    for (const q of rfqQuotations) {
      const earliest = q.items
        .map((it) => it.promisedDeliveryDate)
        .filter(Boolean)
        .sort()[0];
      if (earliest && (!best || earliest < best.date))
        best = { id: q.id, date: earliest };
    }
    return best?.id || null;
  }, [rfqQuotations]);

  const handleSaveComparison = async () => {
    if (!rfqId) {
      toast.error("Select an RFQ");
      return;
    }
    if (rfqQuotations.length === 0) {
      toast.error("No quotations to compare for this RFQ");
      return;
    }
    if (selectedQuotationId && decidedQuotation) {
      toast.error(
        `${decidedQuotation.quotationNumber} is already selected for this RFQ`,
      );
      return;
    }
    setSaving(true);
    try {
      const rfq = rfqs.find((r) => r.id === rfqId);
      // Status check first (atomic), so a stale page can't select an already-decided quotation.
      if (selectedQuotationId)
        await selectQuotation(selectedQuotationId, rfqQuotations);
      const payload: Omit<QuotationComparison, "id"> = {
        rfqId,
        rfqNumber: rfq?.rfqNumber,
        quotationIds: rfqQuotations.map((q) => q.id),
        selectedQuotationIds: selectedQuotationId ? [selectedQuotationId] : [],
        selectedBy: selectedQuotationId ? performedBy : undefined,
        selectedAt: selectedQuotationId ? Date.now() : undefined,
        remarks: remarks.trim() || undefined,
        status: selectedQuotationId ? "DECIDED" : "OPEN",
        createdBy: performedBy,
        createdAt: Date.now(),
      };
      const id = await createRecord(PROCUREMENT_PATHS.comparisons, payload);
      if (id)
        await logRecordAudit(
          PROCUREMENT_PATHS.comparisons,
          id,
          "Quotation comparison recorded",
          performedBy,
          `${rfq?.rfqNumber}: ${rfqQuotations.length} quotation(s) compared`,
        );
      if (selectedQuotationId) {
        await logRecordAudit(
          PROCUREMENT_PATHS.quotations,
          selectedQuotationId,
          "Quotation selected",
          performedBy,
          remarks.trim() || rfq?.rfqNumber || "",
        );
      }
      toast.success("Comparison saved");
      setSelectedQuotationId("");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save comparison"));
    } finally {
      setSaving(false);
      load();
    }
  };

  const createPoFromSelected = async () => {
    if (!decidedQuotation) {
      toast.error("Save a comparison with a selected quotation first");
      return;
    }
    try {
      const existing = await findPurchaseOrdersForQuotation(
        decidedQuotation.id,
      );
      if (existing.length > 0) {
        toast.error(
          `Purchase order ${existing[0].poNumber} already exists for ${decidedQuotation.quotationNumber}`,
        );
        return;
      }
      navigate("/scm/procurement/purchase-orders", {
        state: { fromQuotation: decidedQuotation },
      });
    } catch (err: unknown) {
      toast.error(
        errorMessage(err, "Failed to check existing purchase orders"),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Quotation Comparison
        </h2>
        <p className="text-muted-foreground mt-1">
          Compare supplier quotations side by side for an RFQ. The system
          highlights factual differences only — selection is always made by an
          authorized user, never automated.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="max-w-sm space-y-1.5">
            <Label>RFQ</Label>
            <Select
              value={rfqId}
              onValueChange={(v) => {
                setRfqId(v);
                setSelectedQuotationId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an RFQ with quotations" />
              </SelectTrigger>
              <SelectContent>
                {eligibleRfqs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.rfqNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              Loading...
            </div>
          ) : !rfqId ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Scale className="h-10 w-10 text-muted-foreground/40" />
                <div className="text-lg font-medium text-foreground">
                  {eligibleRfqs.length === 0
                    ? "No RFQs have received supplier quotations yet."
                    : "Select an RFQ to compare its supplier quotations."}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Earliest Promised Delivery</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Delivery Terms</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfqQuotations.map((q) => {
                    const earliest = q.items
                      .map((it) => it.promisedDeliveryDate)
                      .filter(Boolean)
                      .sort()[0];
                    return (
                      <TableRow
                        key={q.id}
                        className={
                          selectedQuotationId === q.id ||
                          q.status === "SELECTED"
                            ? "bg-emerald-50/60"
                            : "hover:bg-muted/50"
                        }
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="selectedQuotation"
                            checked={selectedQuotationId === q.id}
                            disabled={
                              !!decidedQuotation ||
                              !SELECTABLE_QUOTATION_STATUSES.includes(q.status)
                            }
                            onChange={() => setSelectedQuotationId(q.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {q.vendorNameSnapshot}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {q.quotationNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-end gap-1">
                            {q.id === lowestTotalId && (
                              <TrendingDown
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-label="Lowest quoted total"
                              />
                            )}
                            {formatCurrency(q.total)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {q.id === earliestDeliveryId && (
                              <Clock className="h-3.5 w-3.5 text-blue-600" />
                            )}
                            {earliest || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {q.paymentTerms || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {q.deliveryTerms || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {q.validUntil || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={QUOTATION_STATUS_TONE[q.status]}
                          >
                            {formatStatusLabel(q.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {rfqQuotations.length > 0 && (
                <div className="p-4 border-t space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    {rfqQuotations.map((q) => (
                      <div key={q.id} className="border rounded-md p-3">
                        <div className="font-medium mb-2">
                          {q.vendorNameSnapshot}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {q.items.map((it, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  {it.productName}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {it.quantity}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {formatCurrency(it.unitPrice)}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {formatCurrency(it.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      placeholder="Optional notes explaining the comparison / selection"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSaveComparison}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Comparison"}
                    </Button>
                    <Button
                      onClick={createPoFromSelected}
                      disabled={!decidedQuotation}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" /> Create Purchase
                      Order from Selected
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
