import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Truck,
  ClipboardList,
  PackageSearch,
  Lock,
  ClipboardCheck,
  PackageOpen,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Eye,
  ShoppingCart,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  FULFILLMENT_STATUS_TONE,
  useOrderFulfillmentData,
} from "./orderHelpers";
import {
  checkAvailabilityByWarehouse,
  computeRemainingByLine,
  createFulfillment,
} from "./orderFulfillmentService";
import type { FulfillmentStatus, OrderAcknowledgement } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { FULFILLABLE_SO_STATUSES } from "@/modules/scm/shared/businessRules";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

const FILTER_STATUSES: FulfillmentStatus[] = [
  "PARTIALLY_AVAILABLE",
  "AVAILABLE",
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
  "FULFILLED",
  "CANCELLED",
];

export default function ScmOrderFulfillmentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, salesOrders, fulfillments, warehouses, reload } =
    useOrderFulfillmentData();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [availability, setAvailability] = useState<
    Record<
      string,
      {
        warehouseId: string;
        onHand: number;
        reserved: number;
        available: number;
      }[]
    >
  >({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const openSalesOrders = useMemo(
    () =>
      salesOrders.filter(
        (so) =>
          FULFILLABLE_SO_STATUSES.has(so.status) &&
          so.shippedStatus !== "Shipped",
      ),
    [salesOrders],
  );

  /** Remaining quantity per SO line — a partially fulfilled order stays eligible for its remainder. */
  const remainingBySo = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const so of openSalesOrders)
      map.set(so.id, computeRemainingByLine(so, fulfillments));
    return map;
  }, [openSalesOrders, fulfillments]);

  const eligibleForNewFulfillment = useMemo(
    () =>
      openSalesOrders.filter((so) =>
        [...(remainingBySo.get(so.id)?.values() || [])].some((q) => q > 0),
      ),
    [openSalesOrders, remainingBySo],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of fulfillments) c[f.status] = (c[f.status] || 0) + 1;
    return c;
  }, [fulfillments]);

  const kpis: DashboardKpi[] = [
    {
      id: "open-so",
      label: "Open Sales Orders",
      value: openSalesOrders.length,
      icon: ClipboardList,
      onClick: () => navigate("/scm/orders/sales-orders"),
    },
    {
      id: "available",
      label: "Fully Reservable",
      value: counts["AVAILABLE"] || 0,
      icon: CheckCircle2,
    },
    {
      id: "shortage",
      label: "Orders With Shortage",
      value: counts["PARTIALLY_AVAILABLE"] || 0,
      icon: AlertTriangle,
      onClick: () => navigate("/scm/orders/backorders"),
    },
    {
      id: "reserved",
      label: "Reserved Orders",
      value: counts["RESERVED"] || 0,
      icon: Lock,
      onClick: () => navigate("/scm/orders/allocation"),
    },
    {
      id: "picking",
      label: "Picking In Progress",
      value: counts["PICKING"] || 0,
      icon: ClipboardCheck,
      onClick: () => navigate("/scm/warehouse/picking"),
    },
    {
      id: "packing",
      label: "Pending Packing",
      value: counts["PACKING"] || 0,
      icon: PackageOpen,
      onClick: () => navigate("/scm/warehouse/packing"),
    },
    {
      id: "ready",
      label: "Ready for Shipment",
      value: counts["READY_TO_SHIP"] || 0,
      icon: PackageCheck,
    },
    {
      id: "fulfilled",
      label: "Fulfilled Orders",
      value: counts["FULFILLED"] || 0,
      icon: Truck,
    },
  ];

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? fulfillments
        : fulfillments.filter((f) => f.status === statusFilter),
    [fulfillments, statusFilter],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const selectedSo = salesOrders.find((s) => s.id === selectedSoId) || null;

  const openCreate = () => {
    setSelectedSoId("");
    setWarehouseId("");
    setAvailability({});
    setFormOpen(true);
  };

  const loadAvailability = async (so: OrderAcknowledgement) => {
    setCheckingAvailability(true);
    try {
      const warehouseIds = warehouses.map((w) => w.id);
      const map: typeof availability = {};
      for (const li of so.lineItems || []) {
        if (!li.itemCode || map[li.itemCode]) continue;
        map[li.itemCode] = await checkAvailabilityByWarehouse(
          li.itemCode,
          warehouseIds,
        );
      }
      setAvailability(map);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load stock availability"));
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSelectSo = async (soId: string) => {
    setSelectedSoId(soId);
    setWarehouseId("");
    const so = salesOrders.find((s) => s.id === soId);
    if (so) await loadAvailability(so);
  };

  const handleCreate = async () => {
    if (!selectedSo) {
      toast.error("Select a sales order");
      return;
    }
    if (!warehouseId) {
      toast.error("Select a warehouse to fulfill from");
      return;
    }
    setSaving(true);
    try {
      const id = await createFulfillment(
        selectedSo.id,
        warehouseId,
        performedBy,
      );
      toast.success("Fulfillment created");
      setFormOpen(false);
      reload();
      if (id) navigate(`/scm/orders/fulfillment/${id}`);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create fulfillment"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Order Fulfillment
          </h2>
          <p className="text-muted-foreground mt-1">
            Stock check → reservation → picking → packing → sales issue,
            orchestrated over existing sales orders, reservations and Phase 5
            warehouse execution.
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={eligibleForNewFulfillment.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Start Fulfillment
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <DashboardKpiGrid kpis={kpis} loading={loading} />

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Quick Actions</div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/orders/sales-orders")}
          >
            <ClipboardList className="h-4 w-4 mr-2" /> View Sales Orders
          </Button>
          <Button variant="outline" onClick={openCreate}>
            <PackageSearch className="h-4 w-4 mr-2" /> Check Stock / Create
            Reservation
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/picking")}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" /> Picking Workspace
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/packing")}
          >
            <PackageOpen className="h-4 w-4 mr-2" /> View Packing
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/orders/backorders")}
          >
            <ShoppingCart className="h-4 w-4 mr-2" /> Backorders
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {FILTER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {fulfillments.length} fulfillments
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
                  <TableHead>Items</TableHead>
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
                      Loading fulfillments...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ScrollText className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No fulfillments yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow
                      key={f.id}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(`/scm/orders/fulfillment/${f.id}`)
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {f.fulfillmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>{f.customerNameSnapshot}</TableCell>
                      <TableCell>{warehouseName(f.warehouseId)}</TableCell>
                      <TableCell>{f.items.length}</TableCell>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/scm/orders/fulfillment/${f.id}`);
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Start Fulfillment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Sales Order *</Label>
              <Select value={selectedSoId} onValueChange={handleSelectSo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sales order" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleForNewFulfillment.map((so) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.soNumber} — {so.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSo && (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Stock availability by warehouse
                </div>
                {checkingAvailability ? (
                  <div className="text-sm text-muted-foreground">
                    Checking stock...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(selectedSo.lineItems || [])
                      .map((li, idx) => ({
                        li,
                        idx,
                        remaining:
                          remainingBySo.get(selectedSo.id)?.get(idx) || 0,
                      }))
                      .filter((r) => r.li.itemCode && r.remaining > 0)
                      .map(({ li, idx, remaining }) => (
                        <div
                          key={`${li.itemCode}-${idx}`}
                          className="border rounded-md p-2"
                        >
                          <div className="text-sm font-medium mb-1">
                            {li.itemDescription}{" "}
                            <span className="text-xs text-muted-foreground font-mono">
                              ({li.itemCode})
                            </span>{" "}
                            — ordered {li.salesQty}, remaining {remaining}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Warehouse</TableHead>
                                <TableHead>On Hand</TableHead>
                                <TableHead>Reserved</TableHead>
                                <TableHead>Available</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(availability[li.itemCode] || []).map((row) => (
                                <TableRow key={row.warehouseId}>
                                  <TableCell className="text-sm">
                                    {warehouseName(row.warehouseId)}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {row.onHand}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {row.reserved}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    {row.available}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Fulfill From Warehouse *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
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
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !selectedSo || !warehouseId}
            >
              {saving ? "Creating..." : "Create Fulfillment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
