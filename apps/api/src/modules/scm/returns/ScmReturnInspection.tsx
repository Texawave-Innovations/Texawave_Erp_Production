import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
import { SearchCheck, PlayCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  RETURN_CONDITIONS,
  RETURN_STATUS_TONE,
  receivedQty,
} from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import {
  completeCustomerReturnInspection,
  startCustomerReturnInspection,
  type InspectionLineResult,
} from "./customerReturnService";
import type { ReturnItemCondition, ScmReturn } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { useAsyncAction } from "@/modules/scm/shared/useAsyncAction";

interface LineDraft {
  condition: ReturnItemCondition;
  accepted: string;
  rejected: string;
}

export default function ScmReturnInspection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, returns, reload } = useReturnsData();
  const { busy, run } = useAsyncAction(reload);

  const pending = useMemo(
    () =>
      returns.filter(
        (r) =>
          r.returnType === "CUSTOMER_RETURN" &&
          (r.status === "RECEIVED" || r.status === "INSPECTION_PENDING"),
      ),
    [returns],
  );

  const [target, setTarget] = useState<ScmReturn | null>(null);
  const [lines, setLines] = useState<Record<string, LineDraft>>({});
  const [notes, setNotes] = useState("");

  const openInspect = (r: ScmReturn) => {
    setTarget(r);
    // Default: everything received is accepted.
    setLines(
      Object.fromEntries(
        r.items.map((it) => [
          it.id,
          {
            condition: "USED",
            accepted: String(receivedQty(it)),
            rejected: "0",
          },
        ]),
      ),
    );
    setNotes("");
  };

  const setLine = (itemId: string, patch: Partial<LineDraft>) =>
    setLines((m) => ({ ...m, [itemId]: { ...m[itemId], ...patch } }));

  const lineError = (r: ScmReturn): string | null => {
    for (const it of r.items) {
      const l = lines[it.id];
      if (!l) return `${it.productCode}: missing result`;
      const a = Number(l.accepted);
      const rj = Number(l.rejected);
      if (!(a >= 0) || !(rj >= 0))
        return `${it.productCode}: quantities cannot be negative`;
      if (a + rj !== receivedQty(it))
        return `${it.productCode}: accepted + rejected must equal ${receivedQty(it)} received`;
    }
    return null;
  };

  const handleComplete = async () => {
    if (!target) return;
    const itemResults: Record<string, InspectionLineResult> = {};
    for (const it of target.items) {
      const l = lines[it.id];
      itemResults[it.id] = {
        condition: l.condition,
        acceptedQuantity: Number(l.accepted) || 0,
        rejectedQuantity: Number(l.rejected) || 0,
      };
    }
    const id = target.id;
    const ok = await run(
      () =>
        completeCustomerReturnInspection(
          id,
          { itemResults, notes: notes || undefined },
          performedBy,
        ),
      "Inspection completed",
    );
    if (ok) {
      setTarget(null);
      navigate(`/scm/returns/${id}`);
    }
  };

  const validation = target ? lineError(target) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Return Inspection
        </h2>
        <p className="text-muted-foreground mt-1">
          Basic condition inspection for received customer returns — determines
          what can move to disposition. Not the full QC workflow.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Received Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-16 text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : pending.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <SearchCheck className="h-10 w-10 text-muted-foreground/40" />
                      <div className="text-lg font-medium text-foreground">
                        Nothing pending inspection.
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell
                      className="font-mono text-xs cursor-pointer"
                      onClick={() => navigate(`/scm/returns/${r.id}`)}
                    >
                      {r.returnNumber}
                    </TableCell>
                    <TableCell>{r.customerNameSnapshot}</TableCell>
                    <TableCell>
                      {r.items.reduce((s, i) => s + receivedQty(i), 0)}
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
                      {r.status === "RECEIVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                startCustomerReturnInspection(r, performedBy),
                              "Inspection started",
                            )
                          }
                        >
                          <PlayCircle className="h-4 w-4 mr-2" /> Begin
                          Inspection
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => openInspect(r)}
                        >
                          <SearchCheck className="h-4 w-4 mr-2" /> Inspect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspect {target?.returnNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="w-24">Accepted</TableHead>
                  <TableHead className="w-24">Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {target?.items.map((it) => {
                  const l = lines[it.id];
                  if (!l) return null;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        {it.productNameSnapshot}
                        <div className="text-xs text-muted-foreground font-mono">
                          {it.productCode}
                        </div>
                      </TableCell>
                      <TableCell>{receivedQty(it)}</TableCell>
                      <TableCell>
                        <Select
                          value={l.condition}
                          onValueChange={(v) =>
                            setLine(it.id, {
                              condition: v as ReturnItemCondition,
                            })
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RETURN_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {formatStatusLabel(c)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={l.accepted}
                          onChange={(e) =>
                            setLine(it.id, { accepted: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={l.rejected}
                          onChange={(e) =>
                            setLine(it.id, { rejected: e.target.value })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {validation && <p className="text-xs text-red-600">{validation}</p>}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional inspection notes"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The disposition (restock / quarantine / damaged / scrap / reject)
              is chosen separately on the Disposition page — inspection only
              records condition and acceptance.
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
            <Button onClick={handleComplete} disabled={busy || !!validation}>
              {busy ? "Saving..." : "Complete Inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
