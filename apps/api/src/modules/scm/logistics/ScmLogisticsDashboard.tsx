import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import {
  PackageCheck,
  Ship,
  Clock,
  Truck,
  MapPinned,
  Home,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Building2,
  ScrollText,
} from "lucide-react";
import { getUnshippedPackings } from "./logisticsService";
import { useLogisticsData, SHIPMENT_STATUS_TONE } from "./logisticsHelpers";
import { Badge } from "@/components/ui/badge";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";
import { PENDING_SHIPMENT_STATUSES } from "@/modules/scm/shared/businessRules";
import { formatStatusLabel } from "@/modules/scm/shared/format";

export default function ScmLogisticsDashboard() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    shipments,
    trackingEvents,
    exceptions,
    fulfillments,
    packings,
  } = useLogisticsData();

  const readyToShipCount = useMemo(() => {
    const eligible = fulfillments.filter((f) =>
      ["READY_TO_SHIP", "FULFILLED"].includes(f.status),
    );
    return eligible.filter(
      (f) => getUnshippedPackings(f.id, packings, shipments).length > 0,
    ).length;
  }, [fulfillments, packings, shipments]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of shipments) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [shipments]);

  const pendingDispatch = shipments.filter((s) =>
    PENDING_SHIPMENT_STATUSES.has(s.status),
  ).length;
  const openExceptions = exceptions.filter((e) => !e.resolvedAt).length;

  const kpis: DashboardKpi[] = [
    {
      id: "ready",
      label: "Ready to Ship",
      value: readyToShipCount,
      icon: PackageCheck,
      onClick: () => navigate("/scm/logistics/deliveries"),
    },
    {
      id: "created",
      label: "Shipments Created",
      value: shipments.length,
      icon: Ship,
      onClick: () => navigate("/scm/logistics/shipments"),
    },
    {
      id: "pending-dispatch",
      label: "Pending Dispatch",
      value: pendingDispatch,
      icon: Clock,
      onClick: () => navigate("/scm/logistics/shipments"),
    },
    {
      id: "dispatched",
      label: "Dispatched",
      value: counts["DISPATCHED"] || 0,
      icon: Truck,
      onClick: () => navigate("/scm/logistics/shipments"),
    },
    {
      id: "in-transit",
      label: "In Transit",
      value: counts["IN_TRANSIT"] || 0,
      icon: MapPinned,
      onClick: () => navigate("/scm/logistics/tracking"),
    },
    {
      id: "out-for-delivery",
      label: "Out for Delivery",
      value: counts["OUT_FOR_DELIVERY"] || 0,
      icon: Home,
      onClick: () => navigate("/scm/logistics/tracking"),
    },
    {
      id: "delivered",
      label: "Delivered",
      value: counts["DELIVERED"] || 0,
      icon: CheckCircle2,
      onClick: () => navigate("/scm/logistics/shipments"),
    },
    {
      id: "exceptions",
      label: "Delivery Exceptions",
      value: openExceptions,
      icon: AlertTriangle,
      onClick: () => navigate("/scm/logistics/tracking"),
    },
    {
      id: "failed",
      label: "Failed Deliveries",
      value: counts["FAILED_DELIVERY"] || 0,
      icon: XCircle,
      onClick: () => navigate("/scm/logistics/tracking"),
    },
  ];

  const shipmentNumber = (id: string) =>
    shipments.find((s) => s.id === id)?.shipmentNumber || id;
  const recentActivity = trackingEvents.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Logistics & Shipping
          </h2>
          <p className="text-muted-foreground mt-1">
            Shipment creation, carrier assignment, dispatch and delivery
            tracking over Phase 6 fulfillment and Phase 5 packing.
          </p>
        </div>
        <Button onClick={() => navigate("/scm/logistics/deliveries")}>
          <Plus className="h-4 w-4 mr-2" /> Create Shipment
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
            onClick={() => navigate("/scm/logistics/deliveries")}
          >
            <PackageCheck className="h-4 w-4 mr-2" /> Create Shipment
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/shipments")}
          >
            <Building2 className="h-4 w-4 mr-2" /> Assign Carrier
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/shipments")}
          >
            <Truck className="h-4 w-4 mr-2" /> Dispatch Shipment
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/tracking")}
          >
            <MapPinned className="h-4 w-4 mr-2" /> Update Tracking
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/tracking")}
          >
            <AlertTriangle className="h-4 w-4 mr-2" /> View Exceptions
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/logistics/carriers")}
          >
            <Building2 className="h-4 w-4 mr-2" /> Carriers
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Recent Logistics Activity</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>No logistics activity yet.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                  onClick={() =>
                    navigate(`/scm/logistics/shipments/${e.shipmentId}`)
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {shipmentNumber(e.shipmentId)}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        SHIPMENT_STATUS_TONE[
                          e.status as keyof typeof SHIPMENT_STATUS_TONE
                        ] || ""
                      }
                    >
                      {formatStatusLabel(e.status)}
                    </Badge>
                    {e.description && (
                      <span className="text-muted-foreground">
                        — {e.description}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.eventTime).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
