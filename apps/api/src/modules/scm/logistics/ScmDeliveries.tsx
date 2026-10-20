import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PackageCheck, PackageOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLogisticsData } from "./logisticsHelpers";
import {
  createShipment,
  getShipmentBlockers,
  getUnshippedPackings,
} from "./logisticsService";
import type { OrderFulfillment, WarehousePacking } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage } from "@/modules/scm/shared/format";

export default function ScmDeliveries() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    loading,
    error,
    fulfillments,
    packings,
    salesOrders,
    warehouses,
    shipments,
    reload,
  } = useLogisticsData();

  const [shipDialogFulfillment, setShipDialogFulfillment] =
    useState<OrderFulfillment | null>(null);
  const [selectedPackingIds, setSelectedPackingIds] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return fulfillments
      .filter((f) => ["READY_TO_SHIP", "FULFILLED"].includes(f.status))
      .map((f) => {
        const order =
          salesOrders.find((so) => so.id === f.salesOrderId) || null;
        const relevantPackings = packings.filter(
          (p) => p.fulfillmentId === f.id,
        );
        const unshipped = getUnshippedPackings(f.id, packings, shipments);
        const blockers = getShipmentBlockers(f, relevantPackings, order);
        return {
          fulfillment: f,
          order,
          unshipped,
          blockers,
          warehouseName:
            warehouses.find((w) => w.id === f.warehouseId)?.name ||
            f.warehouseId,
        };
      })
      .filter((r) => r.unshipped.length > 0 || r.blockers.length > 0);
  }, [fulfillments, packings, salesOrders, warehouses, shipments]);

  const openShipDialog = (fulfillment: OrderFulfillment) => {
    const unshipped = getUnshippedPackings(fulfillment.id, packings, shipments);
    setShipDialogFulfillment(fulfillment);
    setSelectedPackingIds(new Set(unshipped.map((p) => p.id)));
  };

  const togglePacking = (id: string) => {
    setSelectedPackingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateShipment = async () => {
    if (!shipDialogFulfillment) return;
    const order = salesOrders.find(
      (so) => so.id === shipDialogFulfillment.salesOrderId,
    );
    if (!order) {
      toast.error("Sales order not found");
      return;
    }
    if (selectedPackingIds.size === 0) {
      toast.error("Select at least one package to ship");
      return;
    }
    setSaving(true);
    try {
      const id = await createShipment(
        shipDialogFulfillment,
        order,
        [...selectedPackingIds],
        performedBy,
      );
      toast.success("Shipment created");
      setShipDialogFulfillment(null);
      reload();
      if (id) navigate(`/scm/logistics/shipments/${id}`);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create shipment"));
    } finally {
      setSaving(false);
    }
  };

  const dialogUnshipped = shipDialogFulfillment
    ? getUnshippedPackings(shipDialogFulfillment.id, packings, shipments)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Deliveries</h2>
        <p className="text-muted-foreground mt-1">
          Fulfillments with packed, unshipped packages — ready to become
          shipments.
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fulfillment #</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Unshipped Packages</TableHead>
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
                      Loading deliveries...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageOpen className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          Nothing ready to ship
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.fulfillment.id}>
                      <TableCell className="font-mono text-xs">
                        {r.fulfillment.fulfillmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.fulfillment.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>
                        {r.fulfillment.customerNameSnapshot}
                      </TableCell>
                      <TableCell>{r.warehouseName}</TableCell>
                      <TableCell>
                        {r.unshipped.reduce((s, p) => s + p.packages.length, 0)}{" "}
                        package(s) in {r.unshipped.length} pack(s)
                      </TableCell>
                      <TableCell>
                        {r.blockers.length > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-200 bg-amber-50"
                            title={r.blockers.join("; ")}
                          >
                            {r.blockers[0]}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-teal-600 border-teal-200 bg-teal-50"
                          >
                            Ready
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={
                            r.blockers.length > 0 || r.unshipped.length === 0
                          }
                          onClick={() => openShipDialog(r.fulfillment)}
                        >
                          <PackageCheck className="h-4 w-4 mr-2" /> Create
                          Shipment
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

      <Dialog
        open={!!shipDialogFulfillment}
        onOpenChange={(open) => !open && setShipDialogFulfillment(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Shipment</DialogTitle>
          </DialogHeader>
          {shipDialogFulfillment && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {shipDialogFulfillment.fulfillmentNumber} —{" "}
                {shipDialogFulfillment.customerNameSnapshot}. Select which
                packed package(s) to include in this shipment.
              </p>
              <div className="space-y-2">
                {dialogUnshipped.map((p: WarehousePacking) => (
                  <div key={p.id} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={selectedPackingIds.has(p.id)}
                        onCheckedChange={() => togglePacking(p.id)}
                      />
                      <span className="font-mono text-xs font-medium">
                        {p.packNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.packages.length} package(s)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-6">
                      {p.packages
                        .map(
                          (pkg) =>
                            `${pkg.packageNumber}${pkg.weight ? ` (${pkg.weight}kg)` : ""}`,
                        )
                        .join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShipDialogFulfillment(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateShipment}
              disabled={saving || selectedPackingIds.size === 0}
            >
              {saving ? (
                "Creating..."
              ) : (
                <>
                  Create Shipment <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
