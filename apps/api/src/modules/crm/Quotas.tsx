// CRM Core Domain — Quotas / Sales Targets. New top-nav tab (net-new — nothing like this existed
// before). Reps see their own target/attainment/gap/forecast; admins/managers additionally see
// and manage the whole team's targets, gated by the same role check `Pipeline.tsx` already uses
// for pipeline-stage configuration.
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Target,
  Plus,
  TrendingUp,
  IndianRupee,
  Trash2,
  Pencil,
  Eye,
  Users,
  UserCog,
  UserCheck,
  CalendarRange,
  Wallet,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { celebrateCrm } from "./celebration";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  createCrmQuota,
  deleteCrmQuota,
  updateCrmQuota,
  currentMonthKey,
  currentQuarterKey,
  computeQuotaAttainment,
  computeQuotaLiveSummary,
  getPeriodBounds,
} from "./domain/quotasService";
import { formatMultiCurrencyTotal } from "./domain/currency";
import { canManagePipelineConfig, isCrmAdmin } from "./domain/roles";
import {
  CrmOpportunity,
  CrmQuota,
  CrmQuotaMetric,
  CrmQuotaPeriod,
} from "./domain/types";
import { EmptyState, DeleteConfirmDialog } from "./intelligence/components";
import { BackToDashboardButton } from "./components/BackToDashboardButton";

const METRIC_LABEL: Record<CrmQuotaMetric, string> = {
  revenue: "Revenue",
  closedWonValue: "Closed Won Value",
  dealsWon: "Deals Won",
};

const STATUS_STYLE: Record<string, string> = {
  Achieved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Track": "bg-brand-50 text-brand-700 border-brand-200",
  "At Risk": "bg-amber-50 text-amber-700 border-amber-200",
  Behind: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICON = {
  Achieved: CheckCircle2,
  "On Track": TrendingUp,
  "At Risk": AlertTriangle,
  Behind: AlertOctagon,
} as const;

interface QuotaFormState {
  repName: string;
  team: string;
  managerName: string;
  targetOwner: string;
  period: CrmQuotaPeriod;
  periodKey: string;
  startDate: string;
  endDate: string;
  targetAmount: string;
  metric: CrmQuotaMetric;
  currency: string;
  notes: string;
}

/** Formats a Date as 'YYYY-MM-DD' using its local calendar fields — `toISOString()` would convert
 *  through UTC first, which shifts local-midnight dates back a day in timezones ahead of UTC
 *  (e.g. IST), silently reporting the wrong Start Date. */
function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parses a 'YYYY-MM-DD' string back into a local Date for the calendar picker — constructing via
 *  the (y, m, d) numeric overload avoids the UTC-parsing shift `new Date(string)` would apply. */
function fromLocalIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function periodDefaults(
  period: CrmQuotaPeriod,
  periodKey: string,
): { startDate: string; endDate: string } {
  const bounds = getPeriodBounds(period, periodKey);
  if (!bounds) return { startDate: "", endDate: "" };
  return {
    startDate: toLocalIsoDate(bounds.start),
    endDate: toLocalIsoDate(bounds.end),
  };
}

function emptyForm(repName: string, targetOwner: string): QuotaFormState {
  const period: CrmQuotaPeriod = "monthly";
  const periodKey = currentMonthKey();
  return {
    repName,
    team: "",
    managerName: "",
    targetOwner,
    period,
    periodKey,
    ...periodDefaults(period, periodKey),
    targetAmount: "",
    metric: "closedWonValue",
    currency: "INR",
    notes: "",
  };
}

function formatMetricValue(
  metric: CrmQuotaMetric,
  currency: string,
  value: number,
): string {
  if (metric === "dealsWon")
    return `${Math.round(value).toLocaleString("en-IN")} deals`;
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${Math.round(value).toLocaleString("en-IN")}`;
}

// Delegates to `getPeriodBounds` (quotasService.ts) — the actual period end-date math — instead of
// re-deriving it independently, so a future leap-year/quarter-boundary fix there is guaranteed to
// reach the "Days Left" figure shown here too instead of silently not matching it.
function daysRemainingInPeriod(
  period: CrmQuotaPeriod,
  periodKey: string,
): number {
  const bounds = getPeriodBounds(period, periodKey);
  if (!bounds) return 0;
  return Math.max(0, Math.ceil((bounds.end.getTime() - Date.now()) / 86400000));
}

function QuotaCard({
  quota,
  attainment,
  opportunities,
  onView,
  onEdit,
  onDelete,
  canManage,
  canDelete,
}: {
  quota: CrmQuota;
  attainment: number;
  opportunities: CrmOpportunity[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
  canDelete: boolean;
}) {
  const pct =
    quota.targetAmount > 0
      ? Math.min(100, Math.round((attainment / quota.targetAmount) * 100))
      : 0;
  const gap = Math.max(0, quota.targetAmount - attainment);
  const daysLeft = daysRemainingInPeriod(quota.period, quota.periodKey);
  const forecast = computeQuotaLiveSummary(quota, opportunities).forecast;

  return (
    <div className="crm-panel-frame rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{quota.repName}</p>
          <p className="text-sm text-slate-600">
            {quota.period === "monthly" ? "Monthly" : "Quarterly"} —{" "}
            {quota.periodKey}
            {quota.team ? ` · ${quota.team}` : ""}
            <span className="text-slate-600">
              {" "}
              · {METRIC_LABEL[quota.metric || "closedWonValue"]}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
            title="View target"
            onClick={onView}
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                title="Edit target"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {canDelete && (
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  }
                  title={`Delete target for "${quota.repName}"?`}
                  description="This target will be moved to the CRM Recycle Bin."
                  onConfirm={onDelete}
                />
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold text-slate-700">
            {formatMetricValue(
              quota.metric || "closedWonValue",
              quota.currency || "INR",
              attainment,
            )}
          </span>
          <span className="text-black">
            of{" "}
            {formatMetricValue(
              quota.metric || "closedWonValue",
              quota.currency || "INR",
              quota.targetAmount,
            )}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              pct >= 100
                ? "bg-emerald-500"
                : pct >= 60
                  ? "bg-brand-500"
                  : "bg-amber-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-sm font-bold text-slate-800">{pct}%</p>
          <p className="text-xs text-black uppercase font-bold">Attainment</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">
            {formatMetricValue(
              quota.metric || "closedWonValue",
              quota.currency || "INR",
              gap,
            )}
          </p>
          <p className="text-xs text-black uppercase font-bold">Gap</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{daysLeft}</p>
          <p className="text-xs text-black uppercase font-bold">Days Left</p>
        </div>
      </div>
      {gap > 0 && daysLeft > 0 && (
        <p className="text-sm text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100">
          Forecast at current pace:{" "}
          <span className="font-bold text-slate-700">
            {formatMetricValue(
              quota.metric || "closedWonValue",
              quota.currency || "INR",
              forecast,
            )}
          </span>
        </p>
      )}
    </div>
  );
}

export default function Quotas() {
  const location = useLocation();
  const fromDashboard = !!(
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  // The dedicated CRM login (`role === 'crm'`) can see every rep's targets (like CRM Admin /
  // Sales Head) but is view-only — no Set Target, Edit, or Delete button. Only
  // `canManagePipelineConfig` (CRM Admin / Sales Head) can manage targets, and only `isCrmAdmin`
  // can delete them.
  const canViewAll = canManagePipelineConfig(user) || user?.role === "crm";
  const canManage = canManagePipelineConfig(user);
  const canDeleteQuotas = isCrmAdmin(user);
  const { opportunities, quotas, loading } = useCrmDomainData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuotaFormState>(() =>
    emptyForm(currentUser, currentUser),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingQuota, setViewingQuota] = useState<CrmQuota | null>(null);

  const knownReps = useMemo(() => {
    const names = new Set<string>();
    opportunities.forEach((o) => {
      if (o.ownerName?.trim()) names.add(o.ownerName.trim());
    });
    return Array.from(names).sort();
  }, [opportunities]);

  const visibleQuotas = useMemo(
    () =>
      canViewAll
        ? quotas
        : quotas.filter(
            (q) =>
              q.repName.trim().toLowerCase() ===
              currentUser.trim().toLowerCase(),
          ),
    [quotas, canViewAll, currentUser],
  );

  const teamTotals = useMemo(() => {
    const targetDisplay = formatMultiCurrencyTotal(
      quotas.map((q) => ({ amount: q.targetAmount, currency: q.currency })),
    );
    const attainedDisplay = formatMultiCurrencyTotal(
      quotas.map((q) => ({
        amount: computeQuotaAttainment(q, opportunities),
        currency: q.currency,
      })),
    );
    // A single blended "Team Attainment %" is only meaningful when every quota shares one
    // currency — summing raw target/attained amounts across currencies produces a number that
    // doesn't correspond to any real unit, while the cards next to it correctly group by
    // currency. `null` means "mixed currencies, no single percentage applies".
    const currencies = new Set(quotas.map((q) => q.currency || "INR"));
    let pct: number | null = 0;
    if (currencies.size <= 1) {
      const target = quotas.reduce((sum, q) => sum + q.targetAmount, 0);
      const attained = quotas.reduce(
        (sum, q) => sum + computeQuotaAttainment(q, opportunities),
        0,
      );
      pct = target > 0 ? Math.round((attained / target) * 100) : 0;
    } else {
      pct = null;
    }
    return { targetDisplay, attainedDisplay, pct };
  }, [quotas, opportunities]);

  const openCreate = () => {
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm(currentUser, currentUser));
    setDialogOpen(true);
  };
  const openEdit = (q: CrmQuota) => {
    setEditingId(q.id);
    setFormError(null);
    const defaults = periodDefaults(q.period, q.periodKey);
    setForm({
      repName: q.repName,
      team: q.team || "",
      managerName: q.managerName || "",
      targetOwner: q.targetOwner || q.createdBy || currentUser,
      period: q.period,
      periodKey: q.periodKey,
      startDate: q.startDate || defaults.startDate,
      endDate: q.endDate || defaults.endDate,
      targetAmount: String(q.targetAmount),
      metric: q.metric || "closedWonValue",
      currency: q.currency || "INR",
      notes: q.notes || "",
    });
    setDialogOpen(true);
  };

  const changePeriodType = (period: CrmQuotaPeriod) => {
    const periodKey =
      period === "monthly" ? currentMonthKey() : currentQuarterKey();
    setForm((f) => ({
      ...f,
      period,
      periodKey,
      ...periodDefaults(period, periodKey),
    }));
  };

  const changePeriodKey = (periodKey: string) => {
    setForm((f) => ({
      ...f,
      periodKey,
      ...periodDefaults(f.period, periodKey),
    }));
  };

  const liveSummaryQuota: CrmQuota | null = useMemo(() => {
    const amount = Number(form.targetAmount);
    if (
      !form.repName.trim() ||
      !form.periodKey.trim() ||
      !amount ||
      amount <= 0
    )
      return null;
    if (!getPeriodBounds(form.period, form.periodKey)) return null;
    return {
      id: editingId || "__draft__",
      repName: form.repName.trim(),
      period: form.period,
      periodKey: form.periodKey.trim(),
      targetAmount: amount,
      metric: form.metric,
      createdBy: currentUser,
      createdAt: 0,
    };
  }, [
    form.repName,
    form.period,
    form.periodKey,
    form.targetAmount,
    form.metric,
    editingId,
    currentUser,
  ]);

  const liveSummary = useMemo(
    () =>
      liveSummaryQuota
        ? computeQuotaLiveSummary(liveSummaryQuota, opportunities)
        : null,
    [liveSummaryQuota, opportunities],
  );

  const validateForm = (): string | null => {
    if (!form.repName.trim()) return "Rep is required.";
    if (!form.periodKey.trim()) return "Period is required.";
    if (!getPeriodBounds(form.period, form.periodKey)) {
      return form.period === "monthly"
        ? "Period Key must be in YYYY-MM format."
        : "Period Key must be in YYYY-Q# format.";
    }
    const amount = Number(form.targetAmount);
    if (!form.targetAmount || Number.isNaN(amount) || amount <= 0)
      return "Target Amount must be greater than 0.";
    const repKey = form.repName.trim().toLowerCase();
    const periodKey = form.periodKey.trim();
    const duplicate = quotas.some(
      (q) =>
        q.id !== editingId &&
        q.repName.trim().toLowerCase() === repKey &&
        q.period === form.period &&
        q.periodKey === periodKey,
    );
    if (duplicate)
      return `A ${form.period} target already exists for ${form.repName.trim()} in ${periodKey}. Edit that target instead of creating a duplicate.`;
    return null;
  };

  const save = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        repName: form.repName.trim(),
        period: form.period,
        periodKey: form.periodKey.trim(),
        targetAmount: Number(form.targetAmount),
        metric: form.metric,
        currency: form.currency.trim() || "INR",
      };
      if (form.team.trim()) payload.team = form.team.trim();
      if (form.managerName.trim())
        payload.managerName = form.managerName.trim();
      if (form.targetOwner.trim())
        payload.targetOwner = form.targetOwner.trim();
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (editingId) {
        await updateCrmQuota(editingId, payload, currentUser);
        toast.success("Quota updated");
        celebrateCrm("quota.updated");
      } else {
        await createCrmQuota(
          payload as Parameters<typeof createCrmQuota>[0],
          currentUser,
        );
        toast.success("Quota created");
        celebrateCrm("quota.created");
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save quota:", err);
      toast.error("Failed to save quota. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (viewingQuota) {
    const backButton = fromDashboard ? (
      <BackToDashboardButton />
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => setViewingQuota(null)}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Target
      </Button>
    );

    const attainment = computeQuotaAttainment(viewingQuota, opportunities);
    const pct =
      viewingQuota.targetAmount > 0
        ? Math.min(
            100,
            Math.round((attainment / viewingQuota.targetAmount) * 100),
          )
        : 0;
    const gap = Math.max(0, viewingQuota.targetAmount - attainment);
    const daysLeft = daysRemainingInPeriod(
      viewingQuota.period,
      viewingQuota.periodKey,
    );
    const forecast = computeQuotaLiveSummary(
      viewingQuota,
      opportunities,
    ).forecast;

    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden space-y-5">
          <div className="relative overflow-hidden flex items-center gap-2.5 p-6 pb-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
            />
            <span className="relative p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Target className="h-5 w-5" />
            </span>
            <div className="relative">
              <h2 className="text-lg font-bold text-slate-900">
                {viewingQuota.repName}
              </h2>
              <p className="text-sm text-slate-600">
                {viewingQuota.period === "monthly" ? "Monthly" : "Quarterly"} —{" "}
                {viewingQuota.periodKey}
                {viewingQuota.team ? ` · ${viewingQuota.team}` : ""}
                {" · "}
                {METRIC_LABEL[viewingQuota.metric || "closedWonValue"]}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {(viewingQuota.managerName ||
              viewingQuota.targetOwner ||
              viewingQuota.notes) && (
              <div className="grid md:grid-cols-3 gap-3 pb-1">
                {viewingQuota.managerName && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-black">
                      Manager
                    </Label>
                    <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                      {viewingQuota.managerName}
                    </p>
                  </div>
                )}
                {viewingQuota.targetOwner && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-black">
                      Target Owner
                    </Label>
                    <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                      {viewingQuota.targetOwner}
                    </p>
                  </div>
                )}
                {viewingQuota.notes && (
                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-sm font-bold text-black">
                      Notes
                    </Label>
                    <p className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                      {viewingQuota.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-black">
                  Attainment
                </Label>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 font-semibold">
                  {pct}%
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-black">Target</Label>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 font-semibold">
                  {formatMetricValue(
                    viewingQuota.metric || "closedWonValue",
                    viewingQuota.currency || "INR",
                    viewingQuota.targetAmount,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-black">
                  Closed Won
                </Label>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 font-semibold">
                  {formatMetricValue(
                    viewingQuota.metric || "closedWonValue",
                    viewingQuota.currency || "INR",
                    attainment,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-black">Gap</Label>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                  {formatMetricValue(
                    viewingQuota.metric || "closedWonValue",
                    viewingQuota.currency || "INR",
                    gap,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-black">
                  Days Left
                </Label>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                  {daysLeft}
                </p>
              </div>
              {gap > 0 && daysLeft > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Forecast at pace
                  </Label>
                  <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 font-semibold">
                    {formatMetricValue(
                      viewingQuota.metric || "closedWonValue",
                      viewingQuota.currency || "INR",
                      forecast,
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-600">
            View-only — use Edit to change this target.
          </div>
          {canManage && (
            <Button
              className="rounded-xl gap-1.5"
              onClick={() => {
                const q = viewingQuota;
                setViewingQuota(null);
                openEdit(q);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (dialogOpen) {
    const backButton = fromDashboard ? (
      <BackToDashboardButton />
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => setDialogOpen(false)}
        disabled={saving}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotas
      </Button>
    );

    const StatusIcon = liveSummary ? STATUS_ICON[liveSummary.status] : null;

    return (
      <div className="space-y-6 pb-8">
        {backButton}

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden space-y-6">
          <div className="relative overflow-hidden flex items-center gap-2.5 p-6 pb-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
            />
            <span className="relative p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <IndianRupee className="h-5 w-5" />
            </span>
            <div className="relative">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit Target" : "Set Target"}
              </h2>
              <p className="text-sm text-slate-600">
                {canManage
                  ? "Team targets and attainment."
                  : "Your target for the current period."}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            {/* Rep / Team details */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black">
                <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-500 border-indigo-200/60">
                  <Users className="h-3 w-3" />
                </span>{" "}
                Rep / Team Details
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Rep Name *
                  </Label>
                  <Input
                    list="crm-quota-rep-names"
                    value={form.repName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, repName: e.target.value }))
                    }
                    placeholder="e.g. John Doe"
                    className="h-9 rounded-xl"
                  />
                  <datalist id="crm-quota-rep-names">
                    {knownReps.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Team / Sales Team
                  </Label>
                  <Input
                    value={form.team}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, team: e.target.value }))
                    }
                    placeholder="e.g. Enterprise Sales"
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black flex items-center gap-1">
                    <UserCog className="h-3 w-3" /> Manager / Reporting Manager
                  </Label>
                  <Input
                    value={form.managerName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, managerName: e.target.value }))
                    }
                    placeholder="e.g. Priya Sharma"
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Target Owner
                  </Label>
                  <Input
                    value={form.targetOwner}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, targetOwner: e.target.value }))
                    }
                    placeholder="e.g. Sales Head"
                    className="h-9 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Target period */}
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black pt-4">
                <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60">
                  <CalendarRange className="h-3 w-3" />
                </span>{" "}
                Target Period
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Period Type *
                  </Label>
                  <Select
                    value={form.period}
                    onValueChange={(v) => changePeriodType(v as CrmQuotaPeriod)}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Period Key *
                  </Label>
                  <Input
                    value={form.periodKey}
                    onChange={(e) => changePeriodKey(e.target.value)}
                    placeholder={
                      form.period === "monthly" ? "YYYY-MM" : "YYYY-Q#"
                    }
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Start Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full rounded-xl justify-between font-normal text-slate-800"
                      >
                        {form.startDate
                          ? fromLocalIsoDate(
                              form.startDate,
                            )?.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Select date"}
                        <CalendarDays className="h-4 w-4 text-brand-600" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-3 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl"
                      align="start"
                    >
                      <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800">
                          Start Date
                        </p>
                        <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          Today:{" "}
                          {new Date().toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <Calendar
                        mode="single"
                        selected={fromLocalIsoDate(form.startDate)}
                        onSelect={(date) =>
                          date &&
                          setForm((f) => ({
                            ...f,
                            startDate: toLocalIsoDate(date),
                          }))
                        }
                        className="rounded-md border-0"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    End Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full rounded-xl justify-between font-normal text-slate-800"
                      >
                        {form.endDate
                          ? fromLocalIsoDate(form.endDate)?.toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "Select date"}
                        <CalendarDays className="h-4 w-4 text-brand-600" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-3 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl"
                      align="start"
                    >
                      <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800">
                          End Date
                        </p>
                        <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          Today:{" "}
                          {new Date().toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <Calendar
                        mode="single"
                        selected={fromLocalIsoDate(form.endDate)}
                        onSelect={(date) =>
                          date &&
                          setForm((f) => ({
                            ...f,
                            endDate: toLocalIsoDate(date),
                          }))
                        }
                        className="rounded-md border-0"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Target details */}
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black pt-4">
                <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60">
                  <Wallet className="h-3 w-3" />
                </span>{" "}
                Target Details
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Target Amount (₹) *
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.targetAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, targetAmount: e.target.value }))
                    }
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Target Type / Metric
                  </Label>
                  <Select
                    value={form.metric}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, metric: v as CrmQuotaMetric }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="closedWonValue">
                        Closed Won Value
                      </SelectItem>
                      <SelectItem value="dealsWon">Deals Won</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-black">
                    Currency
                  </Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, currency: v }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm font-bold text-black flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Target Notes (optional)
                  </Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Any context for this target…"
                    className="rounded-xl min-h-[72px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live quota summary */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black">
              <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-200/60">
                <Gauge className="h-3 w-3" />
              </span>{" "}
              Live Quota Summary
            </div>
            {liveSummary && StatusIcon && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border",
                  STATUS_STYLE[liveSummary.status],
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" /> {liveSummary.status}
              </span>
            )}
          </div>

          {!liveSummary ? (
            <p className="text-sm text-slate-600">
              Enter a rep, valid period and target amount to see live
              attainment.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Target
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {formatMetricValue(
                      form.metric,
                      form.currency,
                      liveSummary.target,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Closed Won / Achieved
                  </p>
                  <p className="text-lg font-extrabold text-emerald-700 mt-0.5">
                    {formatMetricValue(
                      form.metric,
                      form.currency,
                      liveSummary.achieved,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Remaining
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {formatMetricValue(
                      form.metric,
                      form.currency,
                      liveSummary.remaining,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Attainment %
                  </p>
                  <p className="text-lg font-extrabold text-brand-700 mt-0.5">
                    {liveSummary.attainmentPct}%
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Days Remaining
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {liveSummary.daysRemaining}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-sm font-bold uppercase text-black">
                    Required Daily Run Rate
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {formatMetricValue(
                      form.metric,
                      form.currency,
                      liveSummary.requiredDailyRunRate,
                    )}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-brand-50/40 px-3 py-2.5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold uppercase text-black flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Forecast / Expected
                  Achievement
                </span>
                <span className="text-base font-extrabold text-slate-900">
                  {formatMetricValue(
                    form.metric,
                    form.currency,
                    liveSummary.forecast,
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-600">
            Changes are only saved when you click Save Target.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save Target"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <div className="crm-panel-frame crm-panel-header relative overflow-hidden bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex items-center justify-between gap-3 flex-wrap rounded-3xl px-5 py-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-100">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Quotas / Sales Targets
            </h2>
            <p className="text-sm text-slate-500">
              {canViewAll
                ? "Team targets and attainment."
                : "Your target and attainment for the current period."}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            className="relative rounded-xl gap-1.5"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> Set Target
          </Button>
        )}
      </div>

      {canViewAll && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="crm-panel-frame rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase text-black">
                Team Target
              </p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {teamTotals.targetDisplay}
              </p>
            </CardContent>
          </Card>
          <Card className="crm-panel-frame rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase text-black">
                Team Closed Won
              </p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {teamTotals.attainedDisplay}
              </p>
            </CardContent>
          </Card>
          <Card className="crm-panel-frame rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase text-black">
                Team Attainment
              </p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {teamTotals.pct === null ? "Mixed" : `${teamTotals.pct}%`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Loading Quotas…
        </div>
      ) : visibleQuotas.length === 0 ? (
        <EmptyState
          icon={Target}
          title={canViewAll ? "No quotas set yet" : "No target set for you yet"}
          description={
            canManage
              ? "Set a monthly or quarterly target for a rep to start tracking attainment."
              : canViewAll
                ? "Ask a CRM Admin / Sales Head to set a target for a rep."
                : "Ask your manager to set a target for this period."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleQuotas.map((q) => (
            <QuotaCard
              key={q.id}
              quota={q}
              attainment={computeQuotaAttainment(q, opportunities)}
              opportunities={opportunities}
              canManage={canManage}
              canDelete={canDeleteQuotas}
              onView={() => setViewingQuota(q)}
              onEdit={() => openEdit(q)}
              onDelete={() =>
                deleteCrmQuota(q.id, user)
                  .then(() => toast.success("Quota removed"))
                  .catch(() => toast.error("Failed to remove quota"))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
