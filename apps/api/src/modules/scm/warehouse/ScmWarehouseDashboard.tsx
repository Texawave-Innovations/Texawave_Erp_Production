import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Boxes,
  PackagePlus,
  ClipboardCheck,
  PackageOpen,
  Plus,
  LayoutGrid,
  CheckCircle2,
} from "lucide-react";
import { useInventoryData } from "../inventory/useInventoryData";
import {
  PUTAWAY_STATUS_TONE,
  PICK_STATUS_TONE,
  PACK_STATUS_TONE,
  MOVEMENT_STATUS_TONE,
  computeLocationStock,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";
import { stockValue } from "@/modules/scm/shared/businessRules";
import { formatCurrency, formatStatusLabel } from "@/modules/scm/shared/format";

export default function ScmWarehouseDashboard() {
  const navigate = useNavigate();
  const {
    loading: mastersLoading,
    error: mastersError,
    warehouses,
    locations,
  } = useWarehouseMasters();
  const {
    loading: opsLoading,
    error: opsError,
    putaways,
    movements,
    pickings,
    packings,
  } = useWarehouseOperations();
  const { loading: invLoading, rows } = useInventoryData();

  const loading = mastersLoading || opsLoading || invLoading;

  const activeWarehouses = warehouses.filter(
    (w) => w.status === "Active",
  ).length;
  const activeLocations = locations.filter((l) => l.status === "Active");
  const locationStock = useMemo(
    () => computeLocationStock(putaways, movements, pickings),
    [putaways, movements, pickings],
  );
  const occupiedLocationIds = useMemo(() => {
    const set = new Set<string>();
    for (const [key, qty] of locationStock.entries()) {
      if (qty > 0) set.add(key.split("__")[2]);
    }
    return set;
  }, [locationStock]);
  const occupiedLocations = activeLocations.filter((l) =>
    occupiedLocationIds.has(l.id),
  ).length;
  const availableLocations = activeLocations.length - occupiedLocations;

  const totalStockQty = rows.reduce((s, r) => s + r.onHand, 0);
  const totalStockValue = rows.reduce(
    (s, r) => s + stockValue(r.onHand, r.costPrice),
    0,
  );

  const pendingPutaway = putaways.filter(
    (p) => p.status === "PENDING" || p.status === "IN_PROGRESS",
  ).length;
  const pendingPicking = pickings.filter(
    (p) =>
      p.status === "PENDING" ||
      p.status === "ASSIGNED" ||
      p.status === "IN_PROGRESS" ||
      p.status === "PARTIALLY_PICKED",
  ).length;
  const pendingPacking = packings.filter(
    (p) => p.status === "PENDING" || p.status === "IN_PROGRESS",
  ).length;

  const kpis: DashboardKpi[] = [
    {
      id: "total-wh",
      label: "Total Warehouses",
      value: warehouses.length,
      icon: WarehouseIcon,
      onClick: () => navigate("/scm/warehouse/warehouses"),
    },
    {
      id: "active-wh",
      label: "Active Warehouses",
      value: activeWarehouses,
      icon: CheckCircle2,
      onClick: () => navigate("/scm/warehouse/warehouses"),
    },
    {
      id: "total-loc",
      label: "Total Storage Locations",
      value: activeLocations.length,
      icon: MapPin,
      onClick: () => navigate("/scm/warehouse/locations"),
    },
    {
      id: "occupied-loc",
      label: "Occupied Locations",
      value: occupiedLocations,
      icon: MapPin,
      onClick: () => navigate("/scm/warehouse/stock"),
    },
    {
      id: "available-loc",
      label: "Available Locations",
      value: availableLocations,
      icon: MapPin,
      onClick: () => navigate("/scm/warehouse/locations"),
    },
    {
      id: "total-qty",
      label: "Total Stock Quantity",
      value: totalStockQty.toLocaleString("en-IN"),
      icon: Boxes,
      onClick: () => navigate("/scm/warehouse/stock"),
    },
    {
      id: "stock-value",
      label: "Stock Value",
      value: formatCurrency(totalStockValue, "INR", 0),
      icon: LayoutGrid,
      onClick: () => navigate("/scm/warehouse/stock"),
    },
    {
      id: "pending-putaway",
      label: "Pending Put-away",
      value: pendingPutaway,
      icon: PackagePlus,
      onClick: () => navigate("/scm/warehouse/putaway"),
    },
    {
      id: "pending-picking",
      label: "Pending Picking",
      value: pendingPicking,
      icon: ClipboardCheck,
      onClick: () => navigate("/scm/warehouse/picking"),
    },
    {
      id: "pending-packing",
      label: "Pending Packing",
      value: pendingPacking,
      icon: PackageOpen,
      onClick: () => navigate("/scm/warehouse/packing"),
    },
  ];

  const recentActivity = [
    ...putaways.map((p) => ({
      id: p.id,
      type: "Put-away",
      label: p.putawayNumber,
      status: p.status,
      tone: PUTAWAY_STATUS_TONE[p.status],
      at: p.createdAt,
    })),
    ...movements.map((m) => ({
      id: m.id,
      type: "Movement",
      label: m.movementNumber,
      status: m.status,
      tone: MOVEMENT_STATUS_TONE[m.status],
      at: m.createdAt,
    })),
    ...pickings.map((p) => ({
      id: p.id,
      type: "Picking",
      label: p.pickNumber,
      status: p.status,
      tone: PICK_STATUS_TONE[p.status],
      at: p.createdAt,
    })),
    ...packings.map((p) => ({
      id: p.id,
      type: "Packing",
      label: p.packNumber,
      status: p.status,
      tone: PACK_STATUS_TONE[p.status],
      at: p.createdAt,
    })),
  ]
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Warehouse Dashboard
        </h2>
        <p className="text-muted-foreground mt-1">
          Real-time view of warehouse capacity, location occupancy and
          put-away/picking/packing progress.
        </p>
      </div>
      {(mastersError || opsError) && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {mastersError || opsError}
        </div>
      )}

      {!loading && warehouses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <WarehouseIcon className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="text-lg font-medium text-foreground">
              No warehouses yet
            </div>
            <p className="text-sm text-muted-foreground">
              Create a warehouse to start using the warehouse management
              workflows.
            </p>
            <Button onClick={() => navigate("/scm/warehouse/warehouses")}>
              <Plus className="h-4 w-4 mr-2" /> Add Warehouse
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DashboardKpiGrid kpis={kpis} loading={loading} />
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Quick Actions</div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/warehouses")}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Warehouse
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/locations")}
          >
            <Plus className="h-4 w-4 mr-2" /> Manage Locations
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/putaway")}
          >
            <PackagePlus className="h-4 w-4 mr-2" /> Create Put-away
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/picking")}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" /> Start Picking
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/packing")}
          >
            <PackageOpen className="h-4 w-4 mr-2" /> Start Packing
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/warehouse/stock")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" /> View Warehouse Stock
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Recent Warehouse Activity</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No warehouse activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a) => (
                <div
                  key={`${a.type}-${a.id}`}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <span className="text-muted-foreground">{a.type}</span>{" "}
                    <span className="font-mono">{a.label}</span>
                  </div>
                  <Badge variant="outline" className={a.tone}>
                    {formatStatusLabel(a.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
