import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Undo2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  CUSTOMER_RETURN_STATUSES,
  RETURNABLE_FULFILLMENT_STATUSES,
  RETURN_REASON_CODES,
  RETURN_STATUS_TONE,
  sumPreviouslyReturned,
} from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import { createCustomerReturn } from "./customerReturnService";
import type { OrderFulfillment, ReturnReasonCode } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

interface DraftLine {
  itemCode: string;
  itemDescription: string;
  fulfilledQty: number;
  eligible: number;
  requestedQuantity: string;
}

export default function ScmCustomerReturns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, returns, fulfillments, warehouses, reload } =
    useReturnsData();

  const customerReturns = useMemo(
    () => returns.filter((r) => r.returnType === "CUSTOMER_RETURN"),
    [returns],
  );

  const eligibleFulfillments = useMemo(
    // Only issued (shipped) stock is returnable — the service re-checks this server-side.
    () =>
      fulfillments.filter(
        (f) =>
          RETURNABLE_FULFILLMENT_STATUSES.has(f.status) &&
          (f.items || []).some((i) => i.issuedQty > 0),
      ),
    [fulfillments],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [fulfillmentId, setFulfillmentId] = useState("");
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("DAMAGED");
  const [reasonDescription, setReasonDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedFulfillment =
    fulfillments.find((f) => f.id === fulfillmentId) || null;

  const openCreate = () => {
    setFulfillmentId("");
    setReasonCode("DAMAGED");
    setReasonDescription("");
    setNotes("");
    setLines([]);
    setCreateOpen(true);
  };

  const pickFulfillment = (id: string) => {
    setFulfillmentId(id);
    const f = fulfillments.find((x) => x.id === id);
    if (!f) {
      setLines([]);
      return;
    }
    const next: DraftLine[] = (f.items || [])
      .filter((i) => i.issuedQty > 0)
      .map((i) => {
        const previouslyReturned = sumPreviouslyReturned(customerReturns, {
          fulfillmentId: f.id,
          productCode: i.itemCode,
        });
        const eligible = Math.max(0, i.issuedQty - previouslyReturned);
        return {
          itemCode: i.itemCode,
          itemDescription: i.itemDescription,
          fulfilledQty: i.issuedQty,
          eligible,
          requestedQuantity: "",
        };
      });
    setLines(next);
  };

  const updateLine = (idx: number, qty: string) => {
    setLines((arr) =>
      arr.map((l, i) => (i === idx ? { ...l, requestedQuantity: qty } : l)),
    );
  };

  const handleCreate = async () => {
    if (!selectedFulfillment) {
      toast.error("Select a source fulfillment");
      return;
    }
    const activeLines = lines.filter((l) => Number(l.requestedQuantity) > 0);
    if (activeLines.length === 0) {
      toast.error("Enter a return quantity for at least one item");
      return;
    }
    for (const l of activeLines) {
      if (Number(l.requestedQuantity) > l.eligible) {
        toast.error(`${l.itemCode}: max returnable is ${l.eligible}`);
        return;
      }
    }
    setSaving(true);
    try {
      // Fulfillment lines carry no batch/serial data, so none is passed; quantities and cost
      // are recomputed server-side from the fulfillment and inventory settings.
      const id = await createCustomerReturn(
        {
          fulfillmentId: selectedFulfillment.id,
          reasonCode,
          reasonDescription: reasonDescription || undefined,
          notes: notes || undefined,
          items: activeLines.map((l) => ({
            productCode: l.itemCode,
            requestedQuantity: Number(l.requestedQuantity),
          })),
        },
        performedBy,
      );
      toast.success("Customer return created");
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
        ? customerReturns
        : customerReturns.filter((r) => r.status === statusFilter),
    [customerReturns, statusFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Customer Returns
          </h2>
          <p className="text-muted-foreground mt-1">
            Returns raised against delivered/fulfilled sales orders, from
            request through disposition.
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={eligibleFulfillments.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Create Customer Return
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
              {CUSTOMER_RETURN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {customerReturns.length} customer returns
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Sales Order</TableHead>
                <TableHead>Customer</TableHead>
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
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    Loading returns...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Undo2 className="h-10 w-10 text-muted-foreground/40" />
                      <div className="text-lg font-medium text-foreground">
                        No customer returns yet.
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
                      {r.salesOrderNumberSnapshot}
                    </TableCell>
                    <TableCell>{r.customerNameSnapshot}</TableCell>
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
            <DialogTitle>Create Customer Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Source Fulfillment *</Label>
              <Select value={fulfillmentId} onValueChange={pickFulfillment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a fulfilled sales order" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleFulfillments.map((f: OrderFulfillment) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.fulfillmentNumber} — {f.salesOrderNumberSnapshot} —{" "}
                      {f.customerNameSnapshot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFulfillment && (
              <div className="border rounded-md p-3 text-sm space-y-2">
                <div className="text-muted-foreground">
                  Warehouse:{" "}
                  {warehouses.find(
                    (w) => w.id === selectedFulfillment.warehouseId,
                  )?.name || selectedFulfillment.warehouseId}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Fulfilled</TableHead>
                      <TableHead>Eligible</TableHead>
                      <TableHead className="w-28">Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => (
                      <TableRow key={l.itemCode}>
                        <TableCell>
                          {l.itemDescription}
                          <div className="text-xs text-muted-foreground font-mono">
                            {l.itemCode}
                          </div>
                        </TableCell>
                        <TableCell>{l.fulfilledQty}</TableCell>
                        <TableCell>{l.eligible}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={l.eligible}
                            className="w-24 ml-auto"
                            value={l.requestedQuantity}
                            disabled={l.eligible === 0}
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
            <Button
              onClick={handleCreate}
              disabled={saving || !selectedFulfillment}
            >
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
