import { useEffect, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { ScmReturnItem } from "@/types";

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
}

/** Reason prompt used for reject (required) and cancel (optional). */
export function ReasonDialog({
  open,
  onOpenChange,
  busy,
  title,
  description,
  required,
  confirmLabel,
  onConfirm,
}: BaseDialogProps & {
  title: string;
  description?: string;
  required?: boolean;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <div className="space-y-1.5">
            <Label>Reason{required ? " *" : ""}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={busy || (required && !reason.trim())}
            onClick={() => onConfirm(reason)}
          >
            {busy ? "Saving..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Carrier + tracking prompt (optional for a customer return in transit, required to ship to a vendor). */
export function ShipmentDialog({
  open,
  onOpenChange,
  busy,
  title,
  required,
  note,
  onConfirm,
}: BaseDialogProps & {
  title: string;
  required?: boolean;
  note?: string;
  onConfirm: (carrier: string, trackingNumber: string) => void;
}) {
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  useEffect(() => {
    if (open) {
      setCarrier("");
      setTracking("");
    }
  }, [open]);
  const missing = required && (!carrier.trim() || !tracking.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Carrier{required ? " *" : ""}</Label>
            <Input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={required ? undefined : "Optional"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tracking Number{required ? " *" : ""}</Label>
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder={
                required ? undefined : "Optional — manual entry only"
              }
            />
          </div>
          {note && <p className="text-xs text-amber-600">{note}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || missing}
            onClick={() => onConfirm(carrier.trim(), tracking.trim())}
          >
            {busy ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Per-line received quantity entry (defaults to requested; 0..requested). */
export function ReceiveDialog({
  open,
  onOpenChange,
  busy,
  items,
  onConfirm,
}: BaseDialogProps & {
  items: ScmReturnItem[];
  onConfirm: (quantities: Record<string, number>) => void;
}) {
  const [qtys, setQtys] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open)
      setQtys(
        Object.fromEntries(
          items.map((it) => [it.id, String(it.requestedQuantity)]),
        ),
      );
  }, [open, items]);
  const invalid = items.some((it) => {
    const q = Number(qtys[it.id]);
    return !Number.isFinite(q) || q < 0 || q > it.requestedQuantity;
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="w-28">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.productNameSnapshot}</TableCell>
                  <TableCell>{it.requestedQuantity}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max={it.requestedQuantity}
                      className="w-24 ml-auto"
                      value={qtys[it.id] ?? ""}
                      onChange={(e) =>
                        setQtys((m) => ({ ...m, [it.id]: e.target.value }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Received stock does not increase on-hand yet — it enters inspection
            and disposition first.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || invalid}
            onClick={() =>
              onConfirm(
                Object.fromEntries(
                  Object.entries(qtys).map(([k, v]) => [k, Number(v) || 0]),
                ),
              )
            }
          >
            {busy ? "Saving..." : "Confirm Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
