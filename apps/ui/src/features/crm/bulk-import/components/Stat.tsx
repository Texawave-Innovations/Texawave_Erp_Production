import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const STAT_TONE: Record<string, string> = {
  slate: "bg-slate-50 text-slate-700 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

export type StatTone = "slate" | "emerald" | "red" | "amber" | "blue";

export const STAT_ICON: Record<StatTone, LucideIcon> = {
  slate: FileSpreadsheet,
  emerald: CheckCircle2,
  red: XCircle,
  amber: AlertTriangle,
  blue: CheckCircle2,
};

/** Legacy BulkImportDialog StatCard. */
export function Stat({
  label,
  value,
  tone = "slate",
  icon,
}: {
  label: string;
  value: number;
  tone?: StatTone;
  icon?: LucideIcon;
}) {
  const Icon = icon ?? STAT_ICON[tone];
  return (
    <div className={`rounded-xl border p-3 ${STAT_TONE[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
