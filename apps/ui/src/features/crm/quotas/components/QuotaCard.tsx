"use client";

import type { CrmQuota } from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { METRIC_LABEL, formatMetricValue } from "../format";

export interface QuotaCardProps {
  quota: CrmQuota;
  canManage: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
}

/** One rep's target card — legacy `QuotaCard` (Quotas.tsx): attainment bar,
 * Attainment / Gap / Days Left, and the forecast line while the target is
 * still open. Numbers come from the server's live summary. */
export function QuotaCard({
  quota,
  canManage,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: QuotaCardProps) {
  const live = quota.live;
  const currency = quota.currency || "INR";
  const pct =
    quota.targetAmount > 0
      ? Math.min(100, Math.round((live.achieved / quota.targetAmount) * 100))
      : 0;
  const gap = Math.max(0, quota.targetAmount - live.achieved);

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
            {formatMetricValue(quota.metric, currency, live.achieved)}
          </span>
          <span className="text-black">
            of {formatMetricValue(quota.metric, currency, quota.targetAmount)}
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
            {formatMetricValue(quota.metric, currency, gap)}
          </p>
          <p className="text-xs text-black uppercase font-bold">Gap</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">
            {live.daysRemaining}
          </p>
          <p className="text-xs text-black uppercase font-bold">Days Left</p>
        </div>
      </div>
      {gap > 0 && live.daysRemaining > 0 && (
        <p className="text-sm text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100">
          Forecast at current pace:{" "}
          <span className="font-bold text-slate-700">
            {formatMetricValue(quota.metric, currency, live.forecast)}
          </span>
        </p>
      )}
    </div>
  );
}

export const STATUS_STYLE: Record<string, string> = {
  Achieved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Track": "bg-brand-50 text-brand-700 border-brand-200",
  "At Risk": "bg-amber-50 text-amber-700 border-amber-200",
  Behind: "bg-red-50 text-red-700 border-red-200",
};
