import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, RotateCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL,
  RETURNABLE_GRN_STATUSES,
  RETURN_REASON_CODES,
  RETURN_STATUS_TONE,
  VENDOR_RETURN_STATUSES,
  sumPreviouslyReturned,
} from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import { createVendorReturn } from "./vendorReturnService";
import type { GoodsReceipt, ReturnReasonCode } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

interface DraftLine {
  lineIndex: number;
  productCode: string;
  productName: string;
  receivedQty: number;
  eligible: number;
  requestedQuantity: string;
  batchNumber?: string;
  /** Serials received on the GRN line; when present the return quantity is the selection size. */
  serialNumbers?: string[];
  selectedSerials: string[];
}

export default function ScmVendorReturns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, returns, grns, warehouses, reload } =
    useReturnsData();

  const vendorReturns = useMemo(
    () => returns.filter((r) => r.returnType === "VENDOR_RETURN"),
    [returns],
  );

  const eligibleGrns = useMemo(
    () =>
      grns.filter(
        (g) =>
          RETURNABLE_GRN_STATUSES.has(g.status) &&
          (g.items || []).some((i) => i.acceptedQuantity > 0),
      ),
    [grns],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [grnId, setGrnId] = useState("");
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("DEFECTIVE");
  const [reasonDescription, setReasonDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedGrn = grns.find((g) => g.id === grnId) || null;

  const openCreate = () => {
    setGrnId("");
    setReasonCode("DEFECTIVE");
    setReasonDescription("");
    setNotes("");
    setLines([]);
    setCreateOpen(true);
  };

  const buildLines = useCallback(
    (g: GoodsReceipt): DraftLine[] =>
      (g.items || [])
        .map((i, lineIndex) => ({ i, lineIndex }))
        .filter(({ i }) => i.acceptedQuantity > 0)
        .map(({ i, lineIndex }) => {
          const previouslyReturned = sumPreviouslyReturned(vendorReturns, {
            grnId: g.id,
            productCode: i.productCode,
            batchNumber: i.batchNumber,
          });
          return {
            lineIndex,
            productCode: i.productCode,
            productName: i.productName,
            receivedQty: i.acceptedQuantity,
            eligible: Math.max(0, i.acceptedQuantity - previouslyReturned),
            requestedQuantity: "",
            batchNumber: i.batchNumber,
            serialNumbers:
              i.serialNumbers && i.serialNumbers.length > 0
                ? i.serialNumbers
                : undefined,
            selectedSerials: [],
          };
        }),
    [vendorReturns],
  );

  const pickGrn = (id: string) => {
    setGrnId(id);
    const g = grns.find((x) => x.id === id);
    setLines(g ? buildLines(g) : []);
  };

  // Prefill from a link (e.g. a failed incoming QC): ?grnId=..&productCode=..&qty=..
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const prefillGrnId = searchParams.get("grnId");
    if (!prefillGrnId || loading) return;
    const g = grns.find((x) => x.id === prefillGrnId);
    setSearchParams({}, { replace: true });
    if (!g) {
      toast.error("The GRN to return against was not found.");
      return;
    }
    const productCode = searchParams.get("productCode");
    const qty = searchParams.get("qty");
    setGrnId(g.id);
    setReasonCode("QUALITY_ISSUE");
    setReasonDescription(searchParams.get("reason") || "");
    setNotes("");
    setLines(
      buildLines(g).map((l) =>
        l.productCode === productCode && qty && !l.serialNumbers
          ? {
              ...l,
              requestedQuantity: String(Math.min(Number(qty) || 0, l.eligible)),
            }
          : l,
      ),
    );
    setCreateOpen(true);
  }, [searchParams, loading, grns, buildLines, setSearchParams]);

  const updateLine = (idx: number, qty: string) => {
    setLines((arr) =>
      arr.map((l, i) => (i === idx ? { ...l, requestedQuantity: qty } : l)),
    );
  };

  const toggleSerial = (idx: number, sn: string, on: boolean) => {
    setLines((arr) =>
      arr.map((l, i) => {
        if (i !== idx) return l;
        const selectedSerials = on
          ? [...l.selectedSerials, sn]
          : l.selectedSerials.filter((x) => x !== sn);
        return {
          ...l,
          selectedSerials,
          requestedQuantity: String(selectedSerials.length),
        };
      }),
    );
  };

  const handleCreate = async () => {
    if (!selectedGrn) {
      toast.error("Select a source GRN");
      return;
    }
    const activeLines = lines.filter((l) => Number(l.requestedQuantity) > 0);
    if (activeLines.length === 0) {
      toast.error("Enter a return quantity for at least one item");
      return;
    }
    for (const l of activeLines) {
      if (Number(l.requestedQuantity) > l.eligible) {
        toast.error(`${l.productCode}: max returnable is ${l.eligible}`);
        return;
      }
    }
    setSaving(true);
    try {
      // Quantities, batch and cost are re-read from the GRN server-side; serials are the selection.
      const id = await createVendorReturn(
        {
          grnId: selectedGrn.id,
          reasonCode,
          reasonDescription: reasonDescription || undefined,
          notes: notes || undefined,
          items: activeLines.map((l) => ({
            grnLineIndex: l.lineIndex,
            requestedQuantity: Number(l.requestedQuantity),
            serialNumbers: l.serialNumbers ? l.selectedSerials : undefined,
          })),
        },
        performedBy,
      );
      toast.success("Vendor return created");
      setCreateOpen(false);
      reload();
      if (id) navigate(`/scm/returns/${id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create return"));
    } finally {
      setSaving(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState(ALL);
  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? vendorReturns
        : vendorReturns.filter((r) => r.status === statusFilter),
    [vendorReturns, statusFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vendor Returns</h2>
          <p className="text-muted-foreground mt-1">
            Stock returned to suppliers against a received GRN, from request
            through vendor receipt.
          </p>
        </div>
        <Button onClick={openCreate} disabled={eligibleGrns.length === 0}>
          <Plus className="h-4 w-4 mr-2" /> Create Vendor Return
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-row items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {VENDOR_RETURN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {vendorReturns.length} vendor returns
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>GRN</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-16 text-muted-foreground"
                  >
                    Loading returns...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <RotateCw className="h-10 w-10 text-muted-foreground/40" />
                      <div className="text-lg font-medium text-foreground">
                        No vendor returns yet.
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/scm/returns/${r.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {r.returnNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.purchaseOrderNumberSnapshot || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.grnNumberSnapshot || "—"}
                    </TableCell>
                    <TableCell>{r.vendorNameSnapshot}</TableCell>
                    <TableCell>{formatStatusLabel(r.reasonCode)}</TableCell>
                    <TableCell>
                      {r.items.reduce((s, i) => s + i.requestedQuantity, 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={RETURN_STATUS_TONE[r.status]}
                      >
                        {formatStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(r.requestedDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Vendor Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Source GRN *</Label>
              <Select value={grnId} onValueChange={pickGrn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a received GRN" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleGrns.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grnNumber} —{" "}
                      {g.purchaseOrderNumber || g.purchaseOrderId} —{" "}
                      {g.vendorNameSnapshot || g.vendorId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGrn && (
              <div className="border rounded-md p-3 text-sm space-y-2">
                <div className="text-muted-foreground">
                  Warehouse:{" "}
                  {warehouses.find((w) => w.id === selectedGrn.warehouseId)
                    ?.name || selectedGrn.warehouseId}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Eligible</TableHead>
                      <TableHead className="w-28">Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => (
                      <TableRow key={l.lineIndex}>
                        <TableCell>
                          {l.productName}
                          <div className="text-xs text-muted-foreground font-mono">
                            {l.productCode}
                            {l.batchNumber ? ` · Batch ${l.batchNumber}` : ""}
                          </div>
                          {l.serialNumbers && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {l.serialNumbers.map((sn) => (
                                <label
                                  key={sn}
                                  className="flex items-center gap-1 text-xs font-mono"
                                >
                                  <Checkbox
                                    checked={l.selectedSerials.includes(sn)}
                                    onCheckedChange={(v) =>
                                      toggleSerial(idx, sn, !!v)
                                    }
                                  />
                                  {sn}
                                </label>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{l.receivedQty}</TableCell>
                        <TableCell>{l.eligible}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={l.eligible}
                            className="w-24 ml-auto"
                            value={l.requestedQuantity}
                            disabled={l.eligible === 0 || !!l.serialNumbers}
                            onChange={(e) => updateLine(idx, e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Reason *</Label>
                <Select
                  value={reasonCode}
                  onValueChange={(v) => setReasonCode(v as ReturnReasonCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASON_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatStatusLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reason Description</Label>
                <Input
                  value={reasonDescription}
                  onChange={(e) => setReasonDescription(e.target.value)}
                  placeholder="Optional detail"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !selectedGrn}>
              {saving ? (
                "Creating..."
              ) : (
                <>
                  Create Return <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
