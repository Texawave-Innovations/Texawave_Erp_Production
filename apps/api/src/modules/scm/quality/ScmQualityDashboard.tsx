import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  ThumbsUp,
  SplitSquareHorizontal,
  ThumbsDown,
  ShieldAlert,
  PackageX,
  BadgeAlert,
  Plus,
  ScrollText,
  SearchCheck,
} from "lucide-react";
import {
  INSPECTION_STATUS_TONE,
  INSPECTION_TYPE_LABEL,
  RESULT_TONE,
} from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import { OPEN_QUARANTINE_STATUSES } from "./quarantineService";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";

function isToday(ts?: number): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function ScmQualityDashboard() {
  const navigate = useNavigate();
  const { loading, error, inspections, defects, quarantine } = useQualityData();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of inspections) c[i.status] = (c[i.status] || 0) + 1;
    return c;
  }, [inspections]);

  const resultCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of inspections)
      if (i.result) c[i.result] = (c[i.result] || 0) + 1;
    return c;
  }, [inspections]);

  const completedToday = useMemo(
    () =>
      inspections.filter(
        (i) => i.status === "COMPLETED" && isToday(i.completedAt),
      ).length,
    [inspections],
  );
  const quarantinedActive = useMemo(
    () => quarantine.filter((q) => OPEN_QUARANTINE_STATUSES.includes(q.status)),
    [quarantine],
  );
  const criticalDefects = useMemo(
    () =>
      defects.filter(
        (d) => d.active && (d.severity === "CRITICAL" || d.severity === "HIGH"),
      ).length,
    [defects],
  );

  const avgInspectionMinutes = useMemo(() => {
    const timed = inspections.filter((i) => i.startedAt && i.completedAt);
    if (timed.length === 0) return null;
    const total = timed.reduce(
      (s, i) => s + ((i.completedAt as number) - (i.startedAt as number)),
      0,
    );
    return Math.round(total / timed.length / 60000);
  }, [inspections]);

  const kpis: DashboardKpi[] = [
    {
      id: "pending",
      label: "Pending Inspections",
      value: counts["PENDING_INSPECTION"] || 0,
      icon: ClipboardList,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "in-progress",
      label: "In Progress",
      value: counts["IN_PROGRESS"] || 0,
      icon: Loader2,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "completed-today",
      label: "Completed Today",
      value: completedToday,
      icon: CheckCircle2,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "passed",
      label: "Passed",
      value: resultCounts["PASSED"] || 0,
      icon: ThumbsUp,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "partial",
      label: "Partially Passed",
      value: resultCounts["PARTIALLY_PASSED"] || 0,
      icon: SplitSquareHorizontal,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "failed",
      label: "Failed",
      value: resultCounts["FAILED"] || 0,
      icon: ThumbsDown,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "on-hold",
      label: "On Hold",
      value: resultCounts["ON_HOLD"] || 0,
      icon: ShieldAlert,
      onClick: () => navigate("/scm/quality/inspections"),
    },
    {
      id: "quarantined",
      label: "Quarantined",
      value: quarantinedActive.length,
      icon: PackageX,
      onClick: () => navigate("/scm/quality/quarantine"),
    },
    {
      id: "critical-defects",
      label: "Critical Defects",
      value: criticalDefects,
      icon: BadgeAlert,
      onClick: () => navigate("/scm/quality/defects"),
    },
  ];
  if (avgInspectionMinutes !== null) {
    kpis.push({
      id: "avg-time",
      label: "Avg. Inspection Time (min)",
      value: avgInspectionMinutes,
      icon: ClipboardList,
    });
  }

  const pendingInspections = useMemo(
    () =>
      inspections.filter((i) => i.status === "PENDING_INSPECTION").slice(0, 8),
    [inspections],
  );
  const recentInspections = useMemo(
    () =>
      [...inspections]
        .sort(
          (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
        )
        .slice(0, 8),
    [inspections],
  );

  const defectSummary = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of inspections)
      for (const it of i.items)
        if (it.defectCode) c[it.defectCode] = (c[it.defectCode] || 0) + 1;
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [inspections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Quality Control
          </h2>
          <p className="text-muted-foreground mt-1">
            Incoming, return, inventory and pre-dispatch QC — inspections,
            defects and quarantine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/scm/quality/inspections")}>
            <Plus className="h-4 w-4 mr-2" /> New Inspection
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/quality/quarantine")}
          >
            <ShieldAlert className="h-4 w-4 mr-2" /> Quarantine
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <DashboardKpiGrid kpis={kpis} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Pending Inspections</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Loading...
              </div>
            ) : pendingInspections.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <SearchCheck className="h-10 w-10 text-muted-foreground/40" />
                <div>No pending inspections.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInspections.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                    onClick={() => navigate(`/scm/quality/inspections/${i.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {i.inspectionNumber}
                      </span>
                      <span className="text-muted-foreground">
                        — {INSPECTION_TYPE_LABEL[i.inspectionType]}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={INSPECTION_STATUS_TONE[i.status]}
                    >
                      {formatStatusLabel(i.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Recent Inspections</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Loading...
              </div>
            ) : recentInspections.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <ScrollText className="h-10 w-10 text-muted-foreground/40" />
                <div>No QC activity yet.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInspections.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                    onClick={() => navigate(`/scm/quality/inspections/${i.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {i.inspectionNumber}
                      </span>
                      <Badge
                        variant="outline"
                        className={INSPECTION_STATUS_TONE[i.status]}
                      >
                        {formatStatusLabel(i.status)}
                      </Badge>
                    </div>
                    {i.result && (
                      <Badge
                        variant="outline"
                        className={RESULT_TONE[i.result]}
                      >
                        {formatStatusLabel(i.result)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Defect Summary</div>
          </CardHeader>
          <CardContent>
            {defectSummary.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No defects recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {defectSummary.map(([code, count]) => (
                  <div
                    key={code}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <span className="font-mono">{code}</span>
                    <span className="text-muted-foreground">
                      {count} occurrence{count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Quarantine Summary</div>
          </CardHeader>
          <CardContent>
            {quarantinedActive.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No stock currently quarantined.
              </div>
            ) : (
              <div className="space-y-2">
                {quarantinedActive.slice(0, 6).map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                    onClick={() => navigate("/scm/quality/quarantine")}
                  >
                    <span>
                      {q.productCode} × {q.quantity}
                    </span>
                    <span className="text-muted-foreground">
                      {q.warehouseNameSnapshot || q.warehouseId}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
