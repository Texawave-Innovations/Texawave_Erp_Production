// Shared presentational building blocks for the new CRM Intelligence pages (Dashboard, Search,
// Calendar, Company 360, Analytics). Purely additive — never imported by any of the 9 existing
// CRM tab files.
import { type MouseEvent, type ReactNode, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Loader2,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  CrmPriority,
  CrmSourceTabKey,
  CrmTemperature,
  UnifiedCrmActivity,
} from "./types";
import { TAB_META } from "./tabMeta";
import { formatShortDate } from "./shared";

export function PriorityBadge({
  priority,
  muted,
}: {
  priority?: CrmPriority;
  muted?: boolean;
}) {
  if (!priority) return null;
  const style: Record<CrmPriority, string> = muted
    ? {
        High: "bg-slate-100 text-slate-600 border-slate-200",
        Medium: "bg-slate-100 text-slate-600 border-slate-200",
        Low: "bg-slate-100 text-slate-600 border-slate-200",
      }
    : {
        High: "bg-red-50 text-red-700 border-red-200",
        Medium: "bg-amber-50 text-amber-700 border-amber-200",
        Low: "bg-slate-100 text-slate-600 border-slate-200",
      };
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
        style[priority],
      )}
    >
      {priority} Priority
    </span>
  );
}

export function TemperatureBadge({
  temperature,
  muted,
  className,
}: {
  temperature?: CrmTemperature;
  muted?: boolean;
  className?: string;
}) {
  if (!temperature) return null;
  const style: Record<CrmTemperature, string> = muted
    ? {
        Hot: "bg-slate-100 text-slate-600 border-slate-200",
        Warm: "bg-slate-100 text-slate-600 border-slate-200",
        Cold: "bg-slate-100 text-slate-600 border-slate-200",
      }
    : {
        Hot: "bg-red-50 text-red-700 border-red-200",
        Warm: "bg-amber-50 text-amber-700 border-amber-200",
        Cold: "bg-blue-50 text-blue-700 border-blue-200",
      };
  const emoji: Record<CrmTemperature, string> = {
    Hot: "🔥",
    Warm: "🌤️",
    Cold: "❄️",
  };
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
        style[temperature],
        className,
      )}
    >
      {emoji[temperature]} {temperature}
    </span>
  );
}

export function SourceTag({ sourceTab }: { sourceTab: CrmSourceTabKey }) {
  const meta = TAB_META[sourceTab];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

const TONE_STYLE: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 border-brand-200",
  red: "bg-red-50 text-red-600 border-red-200",
  amber: "bg-amber-50 text-amber-600 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
  blue: "bg-blue-50 text-blue-600 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

/**
 * Semantic color-variant system for MetricCard/SectionCard/SectionHeading. One entry per brand +
 * supporting color used across the CRM Dashboard — keep colors assigned consistently by meaning
 * (e.g. "purple" = leads/analytics, "blue" = accounts/info, "rose" = negative outcomes) rather
 * than picking arbitrarily per card. Every class below is a complete literal string (required for
 * the Tailwind JIT scanner — no `from-${tone}-50` interpolation).
 */
export type CardTone =
  | "brand"
  | "emerald"
  | "blue"
  | "purple"
  | "indigo"
  | "cyan"
  | "amber"
  | "orange"
  | "red"
  | "rose"
  | "gold"
  | "teal"
  | "slate";

export const CARD_TONE_STYLE: Record<
  CardTone,
  {
    wrap: string;
    border: string;
    iconBg: string;
    valueText: string;
    glow: string;
    headerBg: string;
  }
> = {
  brand: {
    wrap: "from-brand-50 via-white to-white",
    border: "border-brand-200/70",
    iconBg: "from-brand-400 to-brand-600",
    valueText: "text-brand-700",
    glow: "bg-brand-300",
    headerBg: "from-brand-50/80 to-white",
  },
  emerald: {
    wrap: "from-emerald-50 via-white to-white",
    border: "border-emerald-200/70",
    iconBg: "from-emerald-400 to-emerald-600",
    valueText: "text-emerald-700",
    glow: "bg-emerald-300",
    headerBg: "from-emerald-50/80 to-white",
  },
  blue: {
    wrap: "from-blue-50 via-white to-white",
    border: "border-blue-200/70",
    iconBg: "from-blue-400 to-blue-600",
    valueText: "text-blue-700",
    glow: "bg-blue-300",
    headerBg: "from-blue-50/80 to-white",
  },
  purple: {
    wrap: "from-purple-50 via-white to-white",
    border: "border-purple-200/70",
    iconBg: "from-purple-400 to-purple-600",
    valueText: "text-purple-700",
    glow: "bg-purple-300",
    headerBg: "from-purple-50/80 to-white",
  },
  indigo: {
    wrap: "from-indigo-50 via-white to-white",
    border: "border-indigo-200/70",
    iconBg: "from-indigo-400 to-indigo-600",
    valueText: "text-indigo-700",
    glow: "bg-indigo-300",
    headerBg: "from-indigo-50/80 to-white",
  },
  cyan: {
    wrap: "from-cyan-50 via-white to-white",
    border: "border-cyan-200/70",
    iconBg: "from-cyan-400 to-cyan-600",
    valueText: "text-cyan-700",
    glow: "bg-cyan-300",
    headerBg: "from-cyan-50/80 to-white",
  },
  amber: {
    wrap: "from-amber-50 via-white to-white",
    border: "border-amber-200/70",
    iconBg: "from-amber-400 to-amber-500",
    valueText: "text-amber-700",
    glow: "bg-amber-300",
    headerBg: "from-amber-50/80 to-white",
  },
  orange: {
    wrap: "from-orange-50 via-white to-white",
    border: "border-orange-200/70",
    iconBg: "from-orange-400 to-orange-600",
    valueText: "text-orange-700",
    glow: "bg-orange-300",
    headerBg: "from-orange-50/80 to-white",
  },
  red: {
    wrap: "from-red-50 via-white to-white",
    border: "border-red-200/70",
    iconBg: "from-red-400 to-red-600",
    valueText: "text-red-700",
    glow: "bg-red-300",
    headerBg: "from-red-50/80 to-white",
  },
  rose: {
    wrap: "from-rose-50 via-white to-white",
    border: "border-rose-200/70",
    iconBg: "from-rose-400 to-rose-600",
    valueText: "text-rose-700",
    glow: "bg-rose-300",
    headerBg: "from-rose-50/80 to-white",
  },
  gold: {
    wrap: "from-amber-50 via-white to-white",
    border: "border-amber-300/70",
    iconBg: "from-amber-400 to-yellow-500",
    valueText: "text-amber-800",
    glow: "bg-yellow-300",
    headerBg: "from-amber-50/80 to-white",
  },
  teal: {
    wrap: "from-teal-50 via-white to-white",
    border: "border-teal-200/70",
    iconBg: "from-teal-400 to-teal-600",
    valueText: "text-teal-700",
    glow: "bg-teal-300",
    headerBg: "from-teal-50/80 to-white",
  },
  slate: {
    wrap: "from-slate-50 via-white to-white",
    border: "border-slate-200/70",
    iconBg: "from-slate-400 to-slate-500",
    valueText: "text-slate-700",
    glow: "bg-slate-300",
    headerBg: "from-slate-50/80 to-white",
  },
};

export type StatTileTone = CardTone | "violet" | "sky";

/**
 * One muted, professional tint per tone — very light background, a thin matching border, a
 * solid-color icon badge, and a soft matching-color glow/shadow. Shared by every Dashboard card
 * (StatTile for KPI numbers, ChartCard for chart/section containers) so the whole page reads as
 * one consistent visual system rather than a MetricCard/SectionCard grab-bag of white boxes.
 */
export const TILE_STYLE: Record<
  StatTileTone,
  {
    bg: string;
    border: string;
    icon: string;
    text: string;
    glow: string;
    shadow: string;
  }
> = {
  brand: {
    bg: "bg-brand-50/70",
    border: "border-brand-200/70",
    icon: "bg-brand-500",
    text: "text-brand-700",
    glow: "bg-brand-300",
    shadow: "rgba(77,159,75,0.18)",
  },
  emerald: {
    bg: "bg-emerald-50/70",
    border: "border-emerald-200/70",
    icon: "bg-emerald-500",
    text: "text-emerald-700",
    glow: "bg-emerald-300",
    shadow: "rgba(16,185,129,0.18)",
  },
  blue: {
    bg: "bg-blue-50/70",
    border: "border-blue-200/70",
    icon: "bg-blue-500",
    text: "text-blue-700",
    glow: "bg-blue-300",
    shadow: "rgba(59,130,246,0.18)",
  },
  purple: {
    bg: "bg-purple-50/70",
    border: "border-purple-200/70",
    icon: "bg-purple-500",
    text: "text-purple-700",
    glow: "bg-purple-300",
    shadow: "rgba(168,85,247,0.18)",
  },
  indigo: {
    bg: "bg-indigo-50/70",
    border: "border-indigo-200/70",
    icon: "bg-indigo-500",
    text: "text-indigo-700",
    glow: "bg-indigo-300",
    shadow: "rgba(99,102,241,0.18)",
  },
  cyan: {
    bg: "bg-cyan-50/70",
    border: "border-cyan-200/70",
    icon: "bg-cyan-500",
    text: "text-cyan-700",
    glow: "bg-cyan-300",
    shadow: "rgba(6,182,212,0.18)",
  },
  amber: {
    bg: "bg-amber-50/70",
    border: "border-amber-200/70",
    icon: "bg-amber-500",
    text: "text-amber-700",
    glow: "bg-amber-300",
    shadow: "rgba(245,158,11,0.18)",
  },
  orange: {
    bg: "bg-orange-50/70",
    border: "border-orange-200/70",
    icon: "bg-orange-500",
    text: "text-orange-700",
    glow: "bg-orange-300",
    shadow: "rgba(249,115,22,0.18)",
  },
  red: {
    bg: "bg-red-50/70",
    border: "border-red-200/70",
    icon: "bg-red-500",
    text: "text-red-700",
    glow: "bg-red-300",
    shadow: "rgba(239,68,68,0.18)",
  },
  rose: {
    bg: "bg-rose-50/70",
    border: "border-rose-200/70",
    icon: "bg-rose-500",
    text: "text-rose-700",
    glow: "bg-rose-300",
    shadow: "rgba(244,63,94,0.18)",
  },
  gold: {
    bg: "bg-amber-50/70",
    border: "border-amber-300/60",
    icon: "bg-gradient-to-br from-amber-400 to-yellow-500",
    text: "text-amber-800",
    glow: "bg-yellow-300",
    shadow: "rgba(217,119,6,0.2)",
  },
  teal: {
    bg: "bg-teal-50/70",
    border: "border-teal-200/70",
    icon: "bg-teal-500",
    text: "text-teal-700",
    glow: "bg-teal-300",
    shadow: "rgba(20,184,166,0.18)",
  },
  slate: {
    bg: "bg-slate-50/70",
    border: "border-slate-200/70",
    icon: "bg-slate-500",
    text: "text-slate-700",
    glow: "bg-slate-300",
    shadow: "rgba(100,116,139,0.15)",
  },
  violet: {
    bg: "bg-violet-50/70",
    border: "border-violet-200/70",
    icon: "bg-violet-500",
    text: "text-violet-700",
    glow: "bg-violet-300",
    shadow: "rgba(139,92,246,0.18)",
  },
  sky: {
    bg: "bg-sky-50/70",
    border: "border-sky-200/70",
    icon: "bg-sky-500",
    text: "text-sky-700",
    glow: "bg-sky-300",
    shadow: "rgba(14,165,233,0.18)",
  },
};

/**
 * Dashboard-style vertical KPI tile — plain colored icon on top, label, then a bold value, on a
 * very light tone-tinted background. Originally local to CrmDashboard.tsx; promoted here so other
 * CRM pages (e.g. AccountDetail's Overview tab) can match the Dashboard's stat-tile look instead
 * of the horizontal MetricCard above. `onClick` is optional — omit it for a purely informational,
 * non-interactive tile (no hover-lift, not a real button target).
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: StatTileTone;
  onClick?: () => void;
}) {
  const v = TILE_STYLE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "crm-panel-frame flex flex-col items-center justify-center gap-2 rounded-2xl p-5 text-center w-full h-full transition-all duration-200",
        v.bg,
        onClick
          ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
          : "cursor-default",
      )}
    >
      <Icon className={cn("h-7 w-7", v.text)} strokeWidth={1.75} />
      <p className="text-sm text-slate-500 font-medium truncate">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold leading-none tracking-tight truncate",
          v.text,
        )}
      >
        {value}
      </p>
    </button>
  );
}

/**
 * Small colored accent + icon used to introduce a dashboard section (replaces plain uppercase
 * `<h3>` labels). Purely presentational — carries no navigation or data behavior.
 */
export function SectionHeading({
  icon: Icon,
  title,
  tone = "brand",
  action,
}: {
  icon?: LucideIcon;
  title: string;
  tone?: CardTone;
  action?: ReactNode;
}) {
  const v = CARD_TONE_STYLE[tone] ?? CARD_TONE_STYLE.brand;
  return (
    <div className="flex items-center justify-between mb-2.5 px-1">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn("h-4 w-1.5 rounded-full bg-gradient-to-b", v.iconBg)}
        />
        {Icon && <Icon className={cn("h-3.5 w-3.5", v.valueText)} />}
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-10 text-slate-400">
      <Icon className="h-9 w-9 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && (
        <p className="text-sm text-slate-400/80 mt-1">{description}</p>
      )}
    </div>
  );
}

/**
 * One row representing a UnifiedCrmActivity, reused by the Dashboard, Calendar, and Search
 * pages. Clicking it navigates to the record's originating CRM tab (never edits anything).
 */
export function ActivityRow({
  activity,
  urgencyLabel,
  urgencyTone,
}: {
  activity: UnifiedCrmActivity;
  urgencyLabel?: string;
  urgencyTone?: keyof typeof TONE_STYLE;
}) {
  const navigate = useNavigate();
  const meta = TAB_META[activity.sourceTab];
  const dueLabel = activity.dueDate
    ? formatShortDate(activity.dueDate)
    : activity.dueRaw;

  return (
    <button
      type="button"
      onClick={() =>
        navigate(`${meta.route}?row=${activity.sourceRowId}`, {
          state: { fromCrmDashboard: true },
        })
      }
      className="w-full text-left px-4 py-3 hover:bg-brand-50/40 transition-colors border-b border-slate-100 last:border-b-0 flex items-start gap-3"
    >
      <span
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border",
          TONE_STYLE[urgencyTone || "brand"],
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {activity.companyName || "Unknown Company"}
          </p>
          {urgencyLabel && (
            <span
              className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0",
                TONE_STYLE[urgencyTone || "brand"],
              )}
            >
              {urgencyLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {activity.prospectName && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <User className="h-3 w-3" /> {activity.prospectName}
            </span>
          )}
          {dueLabel && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <Calendar className="h-3 w-3" /> {dueLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <SourceTag sourceTab={activity.sourceTab} />
          {activity.statusText && (
            <span className="text-sm text-slate-400 truncate">
              {activity.statusText}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function SectionCard({
  icon: Icon,
  title,
  description,
  tone = "brand",
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: CardTone;
  action?: ReactNode;
  children: ReactNode;
}) {
  const v = CARD_TONE_STYLE[tone] ?? CARD_TONE_STYLE.brand;
  return (
    <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
      <div
        aria-hidden
        className={cn("h-1 w-full bg-gradient-to-r", v.iconBg)}
      />
      <div
        className={cn(
          "crm-panel-header p-5 border-b border-slate-100 bg-gradient-to-br flex items-center justify-between gap-3",
          v.headerBg,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-sm",
              v.iconBg,
            )}
          >
            <Icon className="h-4 w-4 text-white" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Shared delete-confirmation dialog for every CRM delete action (Leads, Accounts, Contacts,
 * Opportunities, Meetings, Follow-ups, Activities, Notes, Documents, Quotations, Pipeline
 * stages). Never deletes instantly — always requires this explicit confirmation, and always
 * surfaces `warning` (e.g. "this account has 3 contacts and 2 opportunities…") when the caller
 * has one, so parent entities never get silently orphaned.
 */
export function DeleteConfirmDialog({
  trigger,
  title,
  description,
  warning,
  confirmLabel = "Delete",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  warning?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete — please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setOpen(v);
          if (!v) setError(null);
        }
      }}
    >
      <AlertDialogTrigger
        asChild
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="h-8 w-8 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
              <Trash2 className="h-4 w-4" />
            </span>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {warning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{warning}</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={busy}
            className="border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-400 gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {busy ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
