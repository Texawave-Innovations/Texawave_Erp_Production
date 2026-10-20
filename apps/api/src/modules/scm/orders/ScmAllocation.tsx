import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Split, Lock, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  FULFILLMENT_STATUS_TONE,
  useOrderFulfillmentData,
} from "./orderHelpers";
import { reserveFulfillmentStock } from "./orderFulfillmentService";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

export default function ScmAllocation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, fulfillments, warehouses, reload } =
    useOrderFulfillmentData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingAllocation = useMemo(
    () =>
      fulfillments.filter(
        (f) =>
          (f.status === "AVAILABLE" || f.status === "PARTIALLY_AVAILABLE") &&
          f.reservationIds.length === 0,
      ),
    [fulfillments],
  );
  const reserved = useMemo(
    () =>
      fulfillments.filter(
        (f) =>
          f.reservationIds.length > 0 &&
          f.status !== "CANCELLED" &&
          f.status !== "FULFILLED",
      ),
    [fulfillments],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const allocate = async (fulfillmentId: string) => {
    setBusyId(fulfillmentId);
    try {
      await reserveFulfillmentStock(fulfillmentId, performedBy);
      toast.success("Stock allocated");
      reload();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to allocate stock"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Allocation</h2>
        <p className="text-muted-foreground mt-1">
          Allocate available stock against open sales orders. Allocation
          reserves stock via the Phase 3 reservation engine — it never posts a
          ledger entry or reduces on-hand.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">
            Pending Allocation ({loading ? "—" : pendingAllocation.length})
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fulfillment #</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : pendingAllocation.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Split className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          Nothing waiting for allocation.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingAllocation.map((f) => (
                    <TableRow
                      key={f.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {f.fulfillmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>{f.customerNameSnapshot}</TableCell>
                      <TableCell>{warehouseName(f.warehouseId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={FULFILLMENT_STATUS_TONE[f.status]}
                        >
                          {formatStatusLabel(f.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={() =>
                              navigate(`/scm/orders/fulfillment/${f.id}`)
                            }
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            size="sm"
                            disabled={busyId === f.id}
                            onClick={() => allocate(f.id)}
                          >
                            <Lock className="h-3.5 w-3.5 mr-1" /> Allocate
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

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">
            Allocated / Reserved ({loading ? "—" : reserved.length})
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fulfillment #</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reserved.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No active allocations.
                    </TableCell>
                  </TableRow>
                ) : (
                  reserved.map((f) => (
                    <TableRow
                      key={f.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {f.fulfillmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>{warehouseName(f.warehouseId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={FULFILLMENT_STATUS_TONE[f.status]}
                        >
                          {formatStatusLabel(f.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() =>
                            navigate(`/scm/orders/fulfillment/${f.id}`)
                          }
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
    </div>
  );
}
