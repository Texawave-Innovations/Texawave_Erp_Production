import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  Undo2,
  Clock,
  Truck,
  PackageCheck,
  SearchCheck,
  Split,
  RotateCcw,
  ShieldAlert,
  RotateCw,
  CheckCircle2,
  Plus,
  ScrollText,
} from "lucide-react";
import { RETURN_STATUS_TONE } from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import { PENDING_APPROVAL_RETURN_STATUSES } from "@/modules/scm/shared/businessRules";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";

export default function ScmReturnsDashboard() {
  const navigate = useNavigate();
  const { loading, error, returns, dispositions } = useReturnsData();

  const customerReturns = useMemo(
    () => returns.filter((r) => r.returnType === "CUSTOMER_RETURN"),
    [returns],
  );
  const vendorReturns = useMemo(
    () => returns.filter((r) => r.returnType === "VENDOR_RETURN"),
    [returns],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of returns) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [returns]);

  // Actual dispositioned quantities, from the disposition records (a line may be split).
  const dispositionedQty = useMemo(() => {
    const q: Record<string, number> = {};
    for (const d of dispositions)
      q[d.disposition] = (q[d.disposition] || 0) + (d.quantity || 0);
    return q;
  }, [dispositions]);
  const pendingApproval = useMemo(
    () =>
      returns.filter((r) => PENDING_APPROVAL_RETURN_STATUSES.has(r.status))
        .length,
    [returns],
  );

  const kpis: DashboardKpi[] = [
    {
      id: "cr-requests",
      label: "Customer Return Requests",
      value: customerReturns.length,
      icon: Undo2,
      onClick: () => navigate("/scm/returns/customer"),
    },
    {
      id: "pending-approval",
      label: "Pending Return Approval",
      value: pendingApproval,
      icon: Clock,
      onClick: () => navigate("/scm/returns/all"),
    },
    {
      id: "in-transit",
      label: "Returns In Transit",
      value: (counts["IN_TRANSIT"] || 0) + (counts["SHIPPED"] || 0),
      icon: Truck,
      onClick: () => navigate("/scm/returns/all"),
    },
    {
      id: "received",
      label: "Returns Received",
      value: (counts["RECEIVED"] || 0) + (counts["VENDOR_RECEIVED"] || 0),
      icon: PackageCheck,
      onClick: () => navigate("/scm/returns/all"),
    },
    {
      id: "pending-inspection",
      label: "Pending Inspection",
      value: counts["INSPECTION_PENDING"] || 0,
      icon: SearchCheck,
      onClick: () => navigate("/scm/returns/inspection"),
    },
    {
      id: "pending-disposition",
      label: "Pending Disposition",
      value: counts["DISPOSITION_PENDING"] || 0,
      icon: Split,
      onClick: () => navigate("/scm/returns/disposition"),
    },
    {
      id: "restocked",
      label: "Restocked Returns",
      value: dispositionedQty.RESTOCK || 0,
      icon: RotateCcw,
      onClick: () => navigate("/scm/returns/customer"),
    },
    {
      id: "quarantined",
      label: "Quarantined Returns",
      value: dispositionedQty.QUARANTINE || 0,
      icon: ShieldAlert,
      onClick: () => navigate("/scm/quality/quarantine"),
    },
    {
      id: "vendor-returns",
      label: "Vendor Returns",
      value: vendorReturns.length,
      icon: RotateCw,
      onClick: () => navigate("/scm/returns/vendor"),
    },
    {
      id: "completed",
      label: "Completed Returns",
      value: counts["COMPLETED"] || 0,
      icon: CheckCircle2,
      onClick: () => navigate("/scm/returns/all"),
    },
  ];

  const recentActivity = useMemo(
    () =>
      [...returns]
        .sort(
          (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
        )
        .slice(0, 10),
    [returns],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Returns Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Customer and vendor returns — approval, receipt, inspection,
            disposition and inventory reversal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/scm/returns/customer")}>
            <Plus className="h-4 w-4 mr-2" /> Create Customer Return
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/vendor")}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Vendor Return
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
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
            onClick={() => navigate("/scm/returns/customer")}
          >
            <Undo2 className="h-4 w-4 mr-2" /> Create Customer Return
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/vendor")}
          >
            <RotateCw className="h-4 w-4 mr-2" /> Create Vendor Return
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/inspection")}
          >
            <SearchCheck className="h-4 w-4 mr-2" /> Inspect Return
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/disposition")}
          >
            <Split className="h-4 w-4 mr-2" /> Process Return
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/returns/all")}
          >
            <ScrollText className="h-4 w-4 mr-2" /> View Returns
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Recent Return Activity</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>No return activity yet.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                  onClick={() => navigate(`/scm/returns/${r.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.returnNumber}
                    </span>
                    <Badge
                      variant="outline"
                      className={RETURN_STATUS_TONE[r.status]}
                    >
                      {formatStatusLabel(r.status)}
                    </Badge>
                    <span className="text-muted-foreground">
                      —{" "}
                      {r.returnType === "CUSTOMER_RETURN"
                        ? r.customerNameSnapshot
                        : r.vendorNameSnapshot}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.updatedAt || r.createdAt).toLocaleString()}
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
