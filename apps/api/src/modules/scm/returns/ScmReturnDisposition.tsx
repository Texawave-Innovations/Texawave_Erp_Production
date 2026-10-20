import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Split, ArrowRightCircle, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  CUSTOMER_RETURN_DISPOSITIONS,
  RETURN_STATUS_TONE,
  dispositionBreakdown,
  dispositionCap,
  isFullyDispositioned,
  remainingToDisposition,
} from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import { moveCustomerReturnToDisposition } from "./customerReturnService";
import {
  completeCustomerReturn,
  retryPendingDisposition,
  setCustomerReturnItemDisposition,
} from "./customerReturnDispositionService";
import { DispositionSummary } from "./DispositionSummary";
import type { ReturnDisposition, ScmReturn, ScmReturnItem } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { useAsyncAction } from "@/modules/scm/shared/useAsyncAction";

const DISPOSITION_NOTE: Record<
  ReturnDisposition,
  { tone: string; text: string }
> = {
  RESTOCK: {
    tone: "text-amber-600",
    text: "Posts a SALES_RETURN ledger entry — on-hand stock increases and becomes sellable.",
  },
  QUARANTINE: {
    tone: "text-purple-600",
    text: "Posts SALES_RETURN then QUARANTINE — the units are held (not sellable) and added to the Quality quarantine register for release or rejection.",
  },
  DAMAGED: {
    tone: "text-red-600",
    text: "Posts SALES_RETURN then DAMAGE — the units are written off. No accounting/GL entry is created (operational only).",
  },
  SCRAP: {
    tone: "text-red-600",
    text: "Posts SALES_RETURN then DAMAGE — the units are written off. No accounting/GL entry is created (operational only).",
  },
  REJECT: {
    tone: "text-muted-foreground",
    text: "No inventory movement — these units are not accepted back.",
  },
};

export default function ScmReturnDisposition() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, returns, warehouses, reload } = useReturnsData();
  const { busy, run } = useAsyncAction(reload);

  const pending = useMemo(
    () =>
      returns.filter(
        (r) =>
          r.returnType === "CUSTOMER_RETURN" &&
          (r.status === "INSPECTED" || r.status === "DISPOSITION_PENDING"),
      ),
    [returns],
  );

  const [target, setTarget] = useState<{
    ret: ScmReturn;
    item: ScmReturnItem;
  } | null>(null);
  const [disposition, setDisposition] = useState<ReturnDisposition>("RESTOCK");
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  const openDispose = (
    ret: ScmReturn,
    item: ScmReturnItem,
    preset?: ReturnDisposition,
  ) => {
    const initial =
      preset ??
      (dispositionCap(item, "RESTOCK") > 0 &&
      item.condition !== "DAMAGED" &&
      item.condition !== "DEFECTIVE"
        ? "RESTOCK"
        : "QUARANTINE");
    setTarget({ ret, item });
    setDisposition(initial);
    setQuantity(String(dispositionCap(item, initial)));
    setWarehouseId(item.warehouseId || ret.warehouseId);
    setNotes("");
  };

  const changeDisposition = (d: ReturnDisposition) => {
    setDisposition(d);
    if (target) setQuantity(String(dispositionCap(target.item, d)));
  };

  const handleSetDisposition = async () => {
    if (!target) return;
    const { ret, item } = target;
    const ok = await run(
      () =>
        setCustomerReturnItemDisposition(
          ret.id,
          item.id,
          disposition,
          Number(quantity) || 0,
          { warehouseId, notes: notes || undefined },
          performedBy,
        ),
      "Disposition recorded",
    );
    if (ok) setTarget(null);
  };

  const cap = target ? dispositionCap(target.item, disposition) : 0;
  const qty = Number(quantity) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Return Disposition
        </h2>
        <p className="text-muted-foreground mt-1">
          Decide what happens to inspected return stock — a line can be split
          (e.g. restock 6, quarantine 4). Restock draws on accepted units,
          Reject on rejected units. Each decision posts to the stock ledger
          immediately.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          Loading...
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <Split className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-lg font-medium text-foreground">
                Nothing pending disposition.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        pending.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <div
                  className="font-semibold font-mono cursor-pointer hover:underline"
                  onClick={() => navigate(`/scm/returns/${r.id}`)}
                >
                  {r.returnNumber}
                </div>
                <div className="text-sm text-muted-foreground">
                  {r.customerNameSnapshot}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={RETURN_STATUS_TONE[r.status]}
                >
                  {formatStatusLabel(r.status)}
                </Badge>
                {r.status === "INSPECTED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => moveCustomerReturnToDisposition(r, performedBy),
                        "Moved to disposition",
                      )
                    }
                  >
                    <ArrowRightCircle className="h-4 w-4 mr-2" /> Proceed to
                    Disposition
                  </Button>
                )}
                {r.status === "DISPOSITION_PENDING" &&
                  r.items.every(isFullyDispositioned) && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => completeCustomerReturn(r.id, performedBy),
                          "Return completed",
                        )
                      }
                    >
                      Complete Return
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Dispositions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.items.map((it) => {
                    const remaining = remainingToDisposition(it);
                    const editable = r.status === "DISPOSITION_PENDING";
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          {it.productNameSnapshot}
                          <div className="text-xs text-muted-foreground font-mono">
                            {it.productCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          {it.condition ? formatStatusLabel(it.condition) : "—"}
                        </TableCell>
                        <TableCell>{it.acceptedQuantity ?? "—"}</TableCell>
                        <TableCell>{it.rejectedQuantity ?? "—"}</TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>
                          <DispositionSummary
                            breakdown={dispositionBreakdown(it)}
                            pending={!!it.pendingDisposition}
                          />
                        </TableCell>
                        <TableCell className="space-x-2">
                          {editable && it.pendingDisposition && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    retryPendingDisposition(
                                      r.id,
                                      it.id,
                                      performedBy,
                                    ),
                                  "Disposition posted",
                                )
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                              Posting
                            </Button>
                          )}
                          {editable &&
                            !it.pendingDisposition &&
                            remaining > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => openDispose(r, it)}
                              >
                                Set Disposition
                              </Button>
                            )}
                          {editable &&
                            !it.pendingDisposition &&
                            dispositionCap(it, "REJECT") > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => openDispose(r, it, "REJECT")}
                              >
                                Reject
                              </Button>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Set Disposition — {target?.item.productNameSnapshot}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Disposition *</Label>
              <Select
                value={disposition}
                onValueChange={(v) => changeDisposition(v as ReturnDisposition)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_RETURN_DISPOSITIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatStatusLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Quantity *{" "}
                <span className="text-muted-foreground font-normal">
                  (max {cap})
                </span>
              </Label>
              <Input
                type="number"
                min="1"
                max={cap}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <p className={`text-xs ${DISPOSITION_NOTE[disposition].tone}`}>
              {DISPOSITION_NOTE[disposition].text}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetDisposition}
              disabled={busy || !warehouseId || qty <= 0 || qty > cap}
            >
              {busy ? "Saving..." : "Confirm Disposition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
