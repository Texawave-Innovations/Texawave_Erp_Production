import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { MapPinned, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { SHIPMENT_STATUS_TONE, useLogisticsData } from "./logisticsHelpers";
import { resolveDeliveryException } from "./logisticsService";
import type { ShipmentException } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import {
  IN_TRANSIT_SHIPMENT_STATUSES,
  PROBLEM_SHIPMENT_STATUSES,
} from "@/modules/scm/shared/businessRules";

const ACTIVE_STATUSES = new Set([
  ...IN_TRANSIT_SHIPMENT_STATUSES,
  ...PROBLEM_SHIPMENT_STATUSES,
]);

export default function ScmTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, shipments, exceptions, reload } = useLogisticsData();

  const [resolvingException, setResolvingException] =
    useState<ShipmentException | null>(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);

  const activeShipments = useMemo(
    () => shipments.filter((s) => ACTIVE_STATUSES.has(s.status)),
    [shipments],
  );
  const openExceptions = useMemo(
    () => exceptions.filter((e) => !e.resolvedAt),
    [exceptions],
  );
  const shipmentNumber = (id: string) =>
    shipments.find((s) => s.id === id)?.shipmentNumber || id;

  const handleResolve = async () => {
    if (!resolvingException) return;
    if (!resolution.trim()) {
      toast.error("Resolution notes are required");
      return;
    }
    setBusy(true);
    try {
      await resolveDeliveryException(
        resolvingException,
        resolution,
        performedBy,
      );
      toast.success("Exception resolved");
      setResolvingException(null);
      reload();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to resolve exception"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tracking</h2>
        <p className="text-muted-foreground mt-1">
          Shipment tracking events and delivery status across dispatched
          shipments.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Active Shipments</div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking</TableHead>
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
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activeShipments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <MapPinned className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No shipments in transit
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  activeShipments.map((s) => (
                    <TableRow
                      key={s.id}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(`/scm/logistics/shipments/${s.id}`)
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {s.shipmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>{s.customerNameSnapshot}</TableCell>
                      <TableCell>{s.carrierNameSnapshot || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.trackingNumber || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={SHIPMENT_STATUS_TONE[s.status]}
                        >
                          {formatStatusLabel(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Update Tracking"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/scm/logistics/shipments/${s.id}`);
                          }}
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

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Open Delivery Exceptions</div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">
              Loading...
            </div>
          ) : openExceptions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No open exceptions.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Occurred</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openExceptions.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell
                      className="font-mono text-xs cursor-pointer text-primary hover:underline"
                      onClick={() =>
                        navigate(`/scm/logistics/shipments/${ex.shipmentId}`)
                      }
                    >
                      {shipmentNumber(ex.shipmentId)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-200 bg-orange-50"
                      >
                        {formatStatusLabel(ex.exceptionCode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ex.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ex.occurredAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResolvingException(ex);
                          setResolution("");
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!resolvingException}
        onOpenChange={(open) => !open && setResolvingException(null)}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {resolvingException && (
              <p className="text-sm text-muted-foreground">
                {formatStatusLabel(resolvingException.exceptionCode)}:{" "}
                {resolvingException.description}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Resolution *</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolvingException(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={busy}>
              {busy ? "Saving..." : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
