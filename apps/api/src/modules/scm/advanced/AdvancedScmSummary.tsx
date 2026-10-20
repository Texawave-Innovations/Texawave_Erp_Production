// Compact Advanced SCM summary embedded in the Overview dashboard. Lazy-loaded so it never delays
// the supply chain flow's first paint; it shares the cached SCM dataset with the Overview.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  ListChecks,
  PackageSearch,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { useControlTowerData } from "./useControlTowerData";
import { SEVERITY_TONE, EXCEPTION_TYPE_LABEL } from "./advancedHelpers";
import { SEVERITY_ORDER } from "./advancedTypes";

const TOP_ALERTS = 4;

export default function AdvancedScmSummary() {
  const navigate = useNavigate();
  const { loading, error, exceptions, replenishment, reload } =
    useControlTowerData();

  const criticalHighCount = useMemo(
    () =>
      exceptions.filter(
        (e) => e.severity === "Critical" || e.severity === "High",
      ).length,
    [exceptions],
  );
  const reorderNowCount = useMemo(
    () => replenishment.filter((r) => r.status === "Reorder Now").length,
    [replenishment],
  );
  const topAlerts = useMemo(
    () =>
      [...exceptions]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .slice(0, TOP_ALERTS),
    [exceptions],
  );

  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardContent className="p-3 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <Siren className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Advanced SCM
              </h3>
              <p className="text-sm text-muted-foreground">
                Operational exceptions, replenishment and action items
              </p>
            </div>
          </div>
          <button
            className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1"
            onClick={() => navigate("/scm/control-tower")}
          >
            Control Tower <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Couldn't load
              SCM alerts: {error}
            </span>
            <button
              className="text-sm font-medium text-brand-600 hover:underline"
              onClick={reload}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile
                icon={AlertTriangle}
                label="Critical/High Alerts"
                value={loading ? "…" : criticalHighCount}
                onClick={() => navigate("/scm/control-tower")}
                tone="text-red-600 bg-red-50"
              />
              <SummaryTile
                icon={ListChecks}
                label="Open Actions"
                value={loading ? "…" : exceptions.length}
                onClick={() => navigate("/scm/action-center")}
                tone="text-indigo-600 bg-indigo-50"
              />
              <SummaryTile
                icon={PackageSearch}
                label="Reorder Now"
                value={loading ? "…" : reorderNowCount}
                onClick={() => navigate("/scm/inventory/replenishment")}
                tone="text-emerald-600 bg-emerald-50"
              />
            </div>

            {!loading && topAlerts.length > 0 && (
              <div className="space-y-1.5">
                {topAlerts.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-1.5 last:pb-0 cursor-pointer hover:bg-muted/40 rounded px-1"
                    onClick={() => navigate(e.navigationPath)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={SEVERITY_TONE[e.severity]}
                      >
                        {e.severity}
                      </Badge>
                      <span className="truncate text-foreground">
                        {e.title}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {EXCEPTION_TYPE_LABEL[e.type]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!loading && topAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No open exceptions — supply chain is healthy.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  onClick,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      className="text-left rounded-xl border border-slate-200 p-3 hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div
        className={`inline-grid h-8 w-8 place-items-center rounded-lg ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-bold text-foreground mt-1.5">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}
