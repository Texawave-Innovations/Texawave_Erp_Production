"use client";

import type { CrmQuota } from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import { Label } from "@/components/legacy-ui/label";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { ArrowLeft, Pencil, Target, TrendingUp } from "lucide-react";
import { METRIC_LABEL, formatMetricValue } from "../format";

function Field({
  label,
  value,
  strong,
  icon,
}: {
  label: string;
  value: string;
  strong?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold text-black flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <p
        className={`min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

/** Read-only target view — legacy `viewingQuota` screen. */
export function QuotaDetail({
  quota,
  canManage,
  onBack,
  onEdit,
}: {
  quota: CrmQuota;
  canManage: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const live = quota.live;
  const currency = quota.currency || "INR";
  const pct =
    quota.targetAmount > 0
      ? Math.min(100, Math.round((live.achieved / quota.targetAmount) * 100))
      : 0;
  const gap = Math.max(0, quota.targetAmount - live.achieved);
  const fmt = (v: number) => formatMetricValue(quota.metric, currency, v);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-2 flex-wrap">
        <BackToDashboardButton />
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Target
        </Button>
      </div>
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
              {quota.repName}
            </h2>
            <p className="text-sm text-slate-600">
              {quota.period === "monthly" ? "Monthly" : "Quarterly"} —{" "}
              {quota.periodKey}
              {quota.team ? ` · ${quota.team}` : ""}
              {" · "}
              {METRIC_LABEL[quota.metric]}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {(quota.managerName || quota.targetOwner || quota.notes) && (
            <div className="grid md:grid-cols-3 gap-3 pb-1">
              {quota.managerName && (
                <Field label="Manager" value={quota.managerName} />
              )}
              {quota.targetOwner && (
                <Field label="Target Owner" value={quota.targetOwner} />
              )}
              {quota.notes && (
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-sm font-bold text-black">Notes</Label>
                  <p className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                    {quota.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Attainment" value={`${pct}%`} strong />
            <Field label="Target" value={fmt(quota.targetAmount)} strong />
            <Field label="Closed Won" value={fmt(live.achieved)} strong />
            <Field label="Gap" value={fmt(gap)} />
            <Field label="Days Left" value={String(live.daysRemaining)} />
            {gap > 0 && live.daysRemaining > 0 && (
              <Field
                label="Forecast at pace"
                value={fmt(live.forecast)}
                strong
                icon={<TrendingUp className="h-3 w-3" />}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-600">
          View-only — use Edit to change this target.
        </div>
        {canManage && (
          <Button className="rounded-xl gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
    </div>
  );
}
