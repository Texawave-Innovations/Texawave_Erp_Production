// Phase 11 — SCM Control Tower: a read-only view over every open exception the
// deterministic `exceptionEngine.ts` detects across the existing SCM data. Nothing here is a
// fabricated metric — every count and alert traces back to a real Phase 1-10 record.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { useControlTowerData } from "./useControlTowerData";
import { getAllRecords } from "@/services/firebase";
import { ADVANCED_PATHS } from "./advancedPaths";
import {
  EXCEPTION_TYPE_LABEL,
  SEVERITY_TONE,
  SOURCE_MODULE_TONE,
  formatAge,
} from "./advancedHelpers";
import type {
  ExceptionSeverity,
  ExceptionSourceModule,
  ExceptionStatus,
  PersistedScmException,
  ScmException,
} from "./advancedTypes";
import { SEVERITY_ORDER } from "./advancedTypes";
import { ReportEmptyState } from "../reports/reportComponents";
import { ALL, errorMessage } from "../shared/format";

const SEVERITIES: ExceptionSeverity[] = ["Critical", "High", "Medium", "Low"];
const SOURCES: ExceptionSourceModule[] = [
  "Inventory",
  "Procurement",
  "Warehouse",
  "Fulfillment",
  "Logistics",
  "Returns",
  "Quality",
  "Suppliers",
];

export default function ScmControlTower() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    automationError,
    exceptions,
    reconciling,
    reconcileCount,
    reload,
  } = useControlTowerData();
  const [severity, setSeverity] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [warehouseId, setWarehouseId] = useState(ALL);
  const [vendorId, setVendorId] = useState(ALL);
  const [status, setStatus] = useState<ExceptionStatus>("OPEN");
  const [resolved, setResolved] = useState<PersistedScmException[]>([]);
  const [resolvedLoading, setResolvedLoading] = useState(false);
  const [resolvedError, setResolvedError] = useState<string | null>(null);
  const [resolvedVersion, setResolvedVersion] = useState(0);

  const loadResolved = useCallback(async () => {
    setResolvedLoading(true);
    setResolvedError(null);
    try {
      const all = (await getAllRecords(
        ADVANCED_PATHS.exceptions,
      )) as PersistedScmException[];
      setResolved(all.filter((e) => e.status === "RESOLVED"));
    } catch (err) {
      setResolvedError(
        errorMessage(err, "Failed to load resolved exceptions."),
      );
    } finally {
      setResolvedLoading(false);
    }
  }, []);

  // Resolved records change on every reconcile and on Refresh — refetch while that tab is shown.
  useEffect(() => {
    if (status === "RESOLVED" && !reconciling) void loadResolved();
  }, [status, reconciling, reconcileCount, resolvedVersion, loadResolved]);

  const handleRefresh = () => {
    reload();
    setResolvedVersion((v) => v + 1);
  };

  const severityCounts = useMemo(() => {
    const c: Record<ExceptionSeverity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const e of exceptions) c[e.severity] += 1;
    return c;
  }, [exceptions]);

  const warehouseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of exceptions)
      if (e.warehouseId)
        map.set(e.warehouseId, e.warehouseName || e.warehouseId);
    return Array.from(map.entries());
  }, [exceptions]);

  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of exceptions)
      if (e.vendorId) map.set(e.vendorId, e.vendorName || e.vendorId);
    return Array.from(map.entries());
  }, [exceptions]);

  const filtered = useMemo(() => {
    const source_: (ScmException | PersistedScmException)[] =
      status === "OPEN" ? exceptions : resolved;
    return source_
      .filter((e) => severity === ALL || e.severity === severity)
      .filter((e) => source === ALL || e.source === source)
      .filter((e) => warehouseId === ALL || e.warehouseId === warehouseId)
      .filter((e) => vendorId === ALL || e.vendorId === vendorId)
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          (b.createdAt || 0) - (a.createdAt || 0),
      );
  }, [exceptions, resolved, status, severity, source, warehouseId, vendorId]);

  const isLoading = status === "OPEN" ? loading : resolvedLoading;
  const shownError = status === "OPEN" ? error : resolvedError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Siren className="h-6 w-6 text-brand-600" /> SCM Control Tower
          </h2>
          <p className="text-muted-foreground mt-1">
            Operational exceptions across procurement, inventory, warehouse,
            fulfillment, logistics, returns and quality.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading || reconciling}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading || reconciling ? "animate-spin" : ""}`}
          />{" "}
          {reconciling ? "Syncing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SEVERITIES.map((s) => (
          <Card
            key={s}
            className={
              severity === s
                ? "ring-2 ring-brand-400"
                : "cursor-pointer hover:shadow-md transition-shadow"
            }
            onClick={() => setSeverity(severity === s ? ALL : s)}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{s}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {loading ? "…" : severityCounts[s]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ExceptionStatus)}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Severities</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Module</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Modules</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {warehouseOptions.length > 0 && (
            <div>
              <Label className="text-xs">Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Warehouses</SelectItem>
                  {warehouseOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {vendorOptions.length > 0 && (
            <div>
              <Label className="text-xs">Supplier</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Suppliers</SelectItem>
                  {vendorOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="ml-auto text-sm text-muted-foreground self-center">
            {filtered.length} alert{filtered.length === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>

      {automationError && (
        <p className="text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Alerts shown are current, but
          saving them failed: {automationError}
        </p>
      )}

      {shownError ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            {shownError}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <ReportEmptyState
              title={
                status === "OPEN"
                  ? "No open exceptions — supply chain is healthy."
                  : "No resolved exceptions match these filters."
              }
              subtitle={
                status === "OPEN"
                  ? "Every deterministic rule below currently finds nothing to flag."
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Card
              key={e.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(e.navigationPath)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {status === "RESOLVED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={SEVERITY_TONE[e.severity]}
                    >
                      {e.severity}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={SOURCE_MODULE_TONE[e.source]}
                    >
                      {e.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {EXCEPTION_TYPE_LABEL[e.type]}
                    </span>
                    {e.sourceNumber && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {e.sourceNumber}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground mt-1 truncate">
                    {e.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {e.description}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {e.warehouseName && <span>{e.warehouseName}</span>}
                    {e.vendorName && <span>{e.vendorName}</span>}
                    <span>{formatAge(e.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
