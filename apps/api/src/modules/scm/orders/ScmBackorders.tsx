import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, ShoppingCart, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useOrderFulfillmentData } from "./orderHelpers";
import {
  createShortageRequisition,
  isOpenRequisition,
} from "./orderFulfillmentService";
import { getAllRecords } from "@/services/firebase";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import type { PurchaseRequisition } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage } from "@/modules/scm/shared/format";

export default function ScmBackorders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, fulfillments, warehouses, reload } =
    useOrderFulfillmentData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);

  const loadRequisitions = useCallback(async () => {
    try {
      setRequisitions(
        (await getAllRecords(
          PROCUREMENT_PATHS.requisitions,
        )) as PurchaseRequisition[],
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load requisitions"));
    }
  }, []);
  useEffect(() => {
    loadRequisitions();
  }, [loadRequisitions]);

  /** Fulfillments already covered by an open (not rejected/cancelled) requisition. */
  const coveredFulfillmentIds = useMemo(
    () =>
      new Set(
        requisitions
          .filter((r) => r.fulfillmentId && isOpenRequisition(r))
          .map((r) => r.fulfillmentId as string),
      ),
    [requisitions],
  );

  const backorders = useMemo(
    () =>
      fulfillments.filter(
        (f) =>
          f.status !== "CANCELLED" &&
          f.status !== "FULFILLED" &&
          f.items.some((i) => i.orderedQty - i.reservedQty > 0),
      ),
    [fulfillments],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const raisePR = async (fulfillmentId: string) => {
    setBusyId(fulfillmentId);
    try {
      await createShortageRequisition(fulfillmentId, performedBy);
      toast.success("Purchase requisition raised for shortage");
      reload();
      loadRequisitions();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to raise requisition"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Backorders</h2>
        <p className="text-muted-foreground mt-1">
          Orders waiting on stock shortage or procurement. Raising a requisition
          here never auto-creates an RFQ/PO — that stays a deliberate
          procurement step.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="text-sm text-muted-foreground">
            {backorders.length} order(s) with shortage
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
                  <TableHead>Shortage Items</TableHead>
                  <TableHead>Requisitions</TableHead>
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
                      Loading backorders...
                    </TableCell>
                  </TableRow>
                ) : backorders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No backorders — nothing is short right now.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  backorders.map((f) => {
                    const shortageItems = f.items.filter(
                      (i) => i.orderedQty - i.reservedQty > 0,
                    );
                    return (
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
                        <TableCell className="text-sm">
                          {shortageItems.map((i, idx) => (
                            <div key={`${i.itemCode}-${idx}`}>
                              {i.itemDescription}:{" "}
                              <span className="font-medium">
                                {i.orderedQty - i.reservedQty}
                              </span>{" "}
                              short
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {(f.requisitionIds || []).length}
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
                            {!coveredFulfillmentIds.has(f.id) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyId === f.id}
                                onClick={() => raisePR(f.id)}
                              >
                                <ShoppingCart className="h-3.5 w-3.5 mr-1" />{" "}
                                Create PR
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
