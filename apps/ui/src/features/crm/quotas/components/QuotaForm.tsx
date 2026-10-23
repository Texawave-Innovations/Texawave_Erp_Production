"use client";

import type {
  CreateCrmQuotaInput,
  CrmQuota,
  CrmQuotaMetric,
  CrmQuotaPeriod,
} from "@texawave-erp/api-types";
import { ApiError, createQuotaSchema } from "@texawave-erp/core";
import { Button } from "@/components/legacy-ui/button";
import { Calendar } from "@/components/legacy-ui/calendar";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileText,
  Gauge,
  IndianRupee,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  currentMonthKey,
  currentQuarterKey,
  formatMetricValue,
  periodDefaults,
} from "../format";
import { useQuotaLiveSummary } from "../hooks";
import { STATUS_STYLE } from "./QuotaCard";

const STATUS_ICON = {
  Achieved: CheckCircle2,
  "On Track": TrendingUp,
  "At Risk": AlertTriangle,
  Behind: AlertOctagon,
} as const;

interface FormState {
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

function initial(editing: CrmQuota | null, currentUser: string): FormState {
  if (editing) {
    const d = periodDefaults(editing.period, editing.periodKey);
    return {
      repName: editing.repName,
      team: editing.team ?? "",
      managerName: editing.managerName ?? "",
      targetOwner: editing.targetOwner ?? currentUser,
      period: editing.period,
      periodKey: editing.periodKey,
      startDate: editing.startDate?.slice(0, 10) ?? d.startDate,
      endDate: editing.endDate?.slice(0, 10) ?? d.endDate,
      targetAmount: String(editing.targetAmount),
      metric: editing.metric,
      currency: editing.currency ?? "INR",
      notes: editing.notes ?? "",
    };
  }
  const periodKey = currentMonthKey();
  return {
    repName: currentUser,
    team: "",
    managerName: "",
    targetOwner: currentUser,
    period: "monthly",
    periodKey,
    ...periodDefaults("monthly", periodKey),
    targetAmount: "",
    metric: "closedWonValue",
    currency: "INR",
    notes: "",
  };
}

function toInput(v: ReturnType<typeof createQuotaSchema.parse>) {
  const input: CreateCrmQuotaInput = {
    repName: v.repName,
    period: v.period,
    periodKey: v.periodKey,
    targetAmount: v.targetAmount,
    metric: v.metric,
    currency: v.currency || "INR",
    team: v.team || undefined,
    managerName: v.managerName || undefined,
    targetOwner: v.targetOwner || undefined,
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    notes: v.notes || undefined,
  };
  return input;
}

const LBL = "text-sm font-bold text-black";
const SECTION_ICON =
  "h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]";

/** Set / Edit Target form with the read-only Live Quota Summary panel —
 * legacy Quotas.tsx `dialogOpen` screen. The summary is computed server-side
 * (POST /crm/quotas/live-summary) by the same pure function the cards use. */
export function QuotaForm({
  editing,
  currentUser,
  knownReps,
  canManage,
  onCancel,
  onSubmit,
}: {
  editing: CrmQuota | null;
  currentUser: string;
  knownReps: string[];
  canManage: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateCrmQuotaInput, id: number | null) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initial(editing, currentUser),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const changePeriod = (period: CrmQuotaPeriod) => {
    const periodKey =
      period === "monthly" ? currentMonthKey() : currentQuarterKey();
    setForm((f) => ({
      ...f,
      period,
      periodKey,
      ...periodDefaults(period, periodKey),
    }));
  };
  const changeKey = (periodKey: string) =>
    setForm((f) => ({
      ...f,
      periodKey,
      ...periodDefaults(f.period, periodKey),
    }));

  const draft = useMemo(() => {
    const amount = Number(form.targetAmount);
    const key = form.periodKey.trim();
    const keyOk =
      form.period === "monthly"
        ? /^\d{4}-(0?[1-9]|1[0-2])$/.test(key)
        : /^\d{4}-Q[1-4]$/.test(key);
    if (!form.repName.trim() || !keyOk || !(amount > 0)) return null;
    return {
      repName: form.repName.trim(),
      period: form.period,
      periodKey: key,
      targetAmount: amount,
      metric: form.metric,
    };
  }, [form]);
  const summary = useQuotaLiveSummary(draft);
  const live = draft ? summary.data : undefined;
  const fmt = (v: number) => formatMetricValue(form.metric, form.currency, v);

  async function handleSave() {
    const parsed = createQuotaSchema.safeParse({
      ...form,
      targetAmount:
        form.targetAmount === "" ? Number.NaN : Number(form.targetAmount),
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit(toInput(parsed.data), editing?.id ?? null);
    } catch (e) {
      setFormError(
        e instanceof ApiError && e.statusCode === 409
          ? e.message
          : "Failed to save quota. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const metricOptions: [CrmQuotaMetric, string][] = [
    ["revenue", "Revenue"],
    ["closedWonValue", "Closed Won Value"],
    ["dealsWon", "Deals Won"],
  ];
  const StatusIcon = live ? STATUS_ICON[live.status] : null;
  const firstError = formError ?? Object.values(errors)[0] ?? null;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-2 flex-wrap">
        <BackToDashboardButton />
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={onCancel}
          disabled={saving}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotas
        </Button>
      </div>

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
              {editing ? "Edit Target" : "Set Target"}
            </h2>
            <p className="text-sm text-slate-600">
              {canManage
                ? "Team targets and attainment."
                : "Your target for the current period."}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {firstError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {firstError}
            </div>
          )}

          {/* Rep / Team details */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black">
              <span
                className={`${SECTION_ICON} bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-500 border-indigo-200/60`}
              >
                <Users className="h-3 w-3" />
              </span>{" "}
              Rep / Team Details
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={LBL}>Rep Name *</Label>
                <Input
                  list="crm-quota-rep-names"
                  value={form.repName}
                  onChange={(e) => set("repName", e.target.value)}
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
                <Label className={LBL}>Team / Sales Team</Label>
                <Input
                  value={form.team}
                  onChange={(e) => set("team", e.target.value)}
                  placeholder="e.g. Enterprise Sales"
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`${LBL} flex items-center gap-1`}>
                  <UserCog className="h-3 w-3" /> Manager / Reporting Manager
                </Label>
                <Input
                  value={form.managerName}
                  onChange={(e) => set("managerName", e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`${LBL} flex items-center gap-1`}>
                  <UserCheck className="h-3 w-3" /> Target Owner
                </Label>
                <Input
                  value={form.targetOwner}
                  onChange={(e) => set("targetOwner", e.target.value)}
                  placeholder="e.g. Sales Head"
                  className="h-9 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Target period */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black pt-4">
              <span
                className={`${SECTION_ICON} bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60`}
              >
                <CalendarRange className="h-3 w-3" />
              </span>{" "}
              Target Period
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={LBL}>Period Type *</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => changePeriod(v as CrmQuotaPeriod)}
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
                <Label className={LBL}>Period Key *</Label>
                <Input
                  value={form.periodKey}
                  onChange={(e) => changeKey(e.target.value)}
                  placeholder={
                    form.period === "monthly" ? "YYYY-MM" : "YYYY-Q#"
                  }
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={LBL}>Start Date</Label>
                <DateButton
                  label="Start Date"
                  value={form.startDate}
                  onChange={(v) => set("startDate", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={LBL}>End Date</Label>
                <DateButton
                  label="End Date"
                  value={form.endDate}
                  onChange={(v) => set("endDate", v)}
                />
              </div>
            </div>
          </div>

          {/* Target details */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-black pt-4">
              <span
                className={`${SECTION_ICON} bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60`}
              >
                <Wallet className="h-3 w-3" />
              </span>{" "}
              Target Details
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={LBL}>Target Amount (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.targetAmount}
                  onChange={(e) => set("targetAmount", e.target.value)}
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={LBL}>Target Type / Metric</Label>
                <Select
                  value={form.metric}
                  onValueChange={(v) => set("metric", v as CrmQuotaMetric)}
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={LBL}>Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => set("currency", v)}
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
                <Label className={`${LBL} flex items-center gap-1`}>
                  <FileText className="h-3 w-3" /> Target Notes (optional)
                </Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
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
            <span
              className={`${SECTION_ICON} bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-200/60`}
            >
              <Gauge className="h-3 w-3" />
            </span>{" "}
            Live Quota Summary
          </div>
          {live && StatusIcon && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border",
                STATUS_STYLE[live.status],
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" /> {live.status}
            </span>
          )}
        </div>

        {!live ? (
          <p className="text-sm text-slate-600">
            Enter a rep, valid period and target amount to see live attainment.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(
                [
                  ["Target", fmt(live.target), "text-slate-900"],
                  [
                    "Closed Won / Achieved",
                    fmt(live.achieved),
                    "text-emerald-700",
                  ],
                  ["Remaining", fmt(live.remaining), "text-slate-900"],
                  ["Attainment %", `${live.attainmentPct}%`, "text-brand-700"],
                  [
                    "Days Remaining",
                    String(live.daysRemaining),
                    "text-slate-900",
                  ],
                  [
                    "Required Daily Run Rate",
                    fmt(live.requiredDailyRunRate),
                    "text-slate-900",
                  ],
                ] as const
              ).map(([label, value, tone]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
                >
                  <p className="text-sm font-bold uppercase text-black">
                    {label}
                  </p>
                  <p className={`text-lg font-extrabold mt-0.5 ${tone}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-brand-50/40 px-3 py-2.5 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-bold uppercase text-black flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Forecast / Expected
                Achievement
              </span>
              <span className="text-base font-extrabold text-slate-900">
                {fmt(live.forecast)}
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
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save Target"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function fromLocalIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DateButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = fromLocalIsoDate(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full rounded-xl justify-between font-normal text-slate-800"
        >
          {selected
            ? selected.toLocaleDateString("en-IN", {
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
          <p className="text-xs font-bold text-slate-800">{label}</p>
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
          selected={selected}
          onSelect={(date) => date && onChange(toLocalIsoDate(date))}
          className="rounded-md border-0"
        />
      </PopoverContent>
    </Popover>
  );
}
