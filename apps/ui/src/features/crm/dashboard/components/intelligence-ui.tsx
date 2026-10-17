"use client";

// Ports of the shared presentational blocks of legacy `intelligence/components.tsx` and the
// Dashboard-local widgets of `intelligence/CrmDashboard.tsx` (ChartCard, HorizontalBarList,
// DonutChart, StackedHealthBar). Shared with the Calendar and Search screens.
import type { CrmDashboardWorkItem } from "@texawave-erp/api-types";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarClock,
  Clock3,
  ListChecks,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { withDashboardOrigin } from "@/features/crm/legacy-ui/BackToDashboardButton";

export { EmptyState };

export const STATUS_GOOD = "#10b981";
export const STATUS_CRITICAL = "#ef4444";
export const STATUS_AMBER = "#f59e0b";
export const STATUS_BLUE = "#3b82f6";

export const chartTooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
};
export const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

const TONE_STYLE: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 border-brand-200",
  red: "bg-red-50 text-red-600 border-red-200",
  amber: "bg-amber-50 text-amber-600 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
  blue: "bg-blue-50 text-blue-600 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

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

// Every class below is a complete literal string (Tailwind scanner requirement).
export const CARD_TONE_STYLE: Record<
  CardTone,
  { iconBg: string; valueText: string }
> = {
  brand: { iconBg: "from-brand-400 to-brand-600", valueText: "text-brand-700" },
  emerald: {
    iconBg: "from-emerald-400 to-emerald-600",
    valueText: "text-emerald-700",
  },
  blue: { iconBg: "from-blue-400 to-blue-600", valueText: "text-blue-700" },
  purple: {
    iconBg: "from-purple-400 to-purple-600",
    valueText: "text-purple-700",
  },
  indigo: {
    iconBg: "from-indigo-400 to-indigo-600",
    valueText: "text-indigo-700",
  },
  cyan: { iconBg: "from-cyan-400 to-cyan-600", valueText: "text-cyan-700" },
  amber: { iconBg: "from-amber-400 to-amber-500", valueText: "text-amber-700" },
  orange: {
    iconBg: "from-orange-400 to-orange-600",
    valueText: "text-orange-700",
  },
  red: { iconBg: "from-red-400 to-red-600", valueText: "text-red-700" },
  rose: { iconBg: "from-rose-400 to-rose-600", valueText: "text-rose-700" },
  gold: { iconBg: "from-amber-400 to-yellow-500", valueText: "text-amber-800" },
  teal: { iconBg: "from-teal-400 to-teal-600", valueText: "text-teal-700" },
  slate: { iconBg: "from-slate-400 to-slate-500", valueText: "text-slate-700" },
};

export type StatTileTone = CardTone | "violet" | "sky";

export const TILE_STYLE: Record<
  StatTileTone,
  { bg: string; icon: string; text: string; border: string }
> = {
  brand: {
    bg: "bg-brand-50/70",
    border: "border-brand-200",
    icon: "bg-brand-500",
    text: "text-brand-700",
  },
  emerald: {
    bg: "bg-emerald-50/70",
    border: "border-emerald-200",
    icon: "bg-emerald-500",
    text: "text-emerald-700",
  },
  blue: {
    bg: "bg-blue-50/70",
    border: "border-blue-200",
    icon: "bg-blue-500",
    text: "text-blue-700",
  },
  purple: {
    bg: "bg-purple-50/70",
    border: "border-purple-200",
    icon: "bg-purple-500",
    text: "text-purple-700",
  },
  indigo: {
    bg: "bg-indigo-50/70",
    border: "border-indigo-200",
    icon: "bg-indigo-500",
    text: "text-indigo-700",
  },
  cyan: {
    bg: "bg-cyan-50/70",
    border: "border-cyan-200",
    icon: "bg-cyan-500",
    text: "text-cyan-700",
  },
  amber: {
    bg: "bg-amber-50/70",
    border: "border-amber-200",
    icon: "bg-amber-500",
    text: "text-amber-700",
  },
  orange: {
    bg: "bg-orange-50/70",
    border: "border-orange-200",
    icon: "bg-orange-500",
    text: "text-orange-700",
  },
  red: {
    bg: "bg-red-50/70",
    border: "border-red-200",
    icon: "bg-red-500",
    text: "text-red-700",
  },
  rose: {
    bg: "bg-rose-50/70",
    border: "border-rose-200",
    icon: "bg-rose-500",
    text: "text-rose-700",
  },
  gold: {
    bg: "bg-amber-50/70",
    border: "border-amber-200",
    icon: "bg-gradient-to-br from-amber-400 to-yellow-500",
    text: "text-amber-800",
  },
  teal: {
    bg: "bg-teal-50/70",
    border: "border-teal-200",
    icon: "bg-teal-500",
    text: "text-teal-700",
  },
  slate: {
    bg: "bg-slate-50/70",
    border: "border-slate-200",
    icon: "bg-slate-500",
    text: "text-slate-700",
  },
  violet: {
    bg: "bg-violet-50/70",
    border: "border-violet-200",
    icon: "bg-violet-500",
    text: "text-violet-700",
  },
  sky: {
    bg: "bg-sky-50/70",
    border: "border-sky-200",
    icon: "bg-sky-500",
    text: "text-sky-700",
  },
};

/** Dashboard-style vertical KPI tile. `onClick` omitted => purely informational. */
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
  onClick?: (() => void) | undefined;
}) {
  const v = TILE_STYLE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center w-full h-full shadow-[0_6px_20px_-4px_rgba(100,116,139,0.28)] transition-all duration-200",
        v.bg,
        v.border,
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

/** Dashboard-scoped chart/section container (legacy `ChartCard`). */
export function ChartCard({
  icon: Icon,
  title,
  description,
  tone = "brand",
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string | undefined;
  tone?: StatTileTone;
  action?: ReactNode;
  children: ReactNode;
}) {
  const v = TILE_STYLE[tone];
  return (
    <div
      className={cn(
        "crm-panel-frame rounded-3xl overflow-hidden transition-shadow duration-200 hover:shadow-lg",
        v.bg,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              v.icon,
            )}
          >
            <Icon className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-slate-500 truncate">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="mx-3 mb-3 rounded-2xl bg-white/80 border border-white">
        {children}
      </div>
    </div>
  );
}

const BAR_LIST_COLOR: Record<string, string> = {
  blue: "bg-gradient-to-r from-blue-400 to-blue-600",
  brand: "bg-gradient-to-r from-brand-400 to-brand-600",
  amber: "bg-gradient-to-r from-amber-400 to-amber-600",
  red: "bg-gradient-to-r from-red-400 to-red-600",
  emerald: "bg-gradient-to-r from-emerald-400 to-emerald-600",
};

/** One distinct colour per category, cycled with `% length`. */
export const CATEGORY_PALETTE = [
  "#2563EB",
  "#0D9488",
  "#7C3AED",
  "#D97706",
  "#0EA5E9",
  "#4F46E5",
  "#64748B",
  "#059669",
];
/** Warm counterpart to CATEGORY_PALETTE (index-paired). */
export const CATEGORY_PALETTE_WARM = [
  "#F59E0B",
  "#FB923C",
  "#FBBF24",
  "#F472B6",
  "#FCD34D",
  "#FDBA74",
  "#EAB308",
  "#FDA4AF",
];

/** Lightens a `#rrggbb` colour by `amt` (0-1). */
export function lightenHex(hex: string, amt: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + Math.round(255 * amt));
  const g = clamp(((num >> 8) & 0x00ff) + Math.round(255 * amt));
  const b = clamp((num & 0x0000ff) + Math.round(255 * amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function ChartGradient({
  id,
  from,
  to,
  diagonal,
}: {
  id: string;
  from: string;
  to: string;
  diagonal?: boolean;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2={diagonal ? "1" : "0"} y2="1">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

export function HorizontalBarList({
  items,
  color = "brand",
  perItemColors,
  valueFormatter = (v: number) => String(v),
  onItemClick,
}: {
  items: { label: string; value: number }[];
  color?: keyof typeof BAR_LIST_COLOR;
  perItemColors?: string[];
  valueFormatter?: (v: number) => string;
  onItemClick?: (label: string) => void;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="p-4 space-y-3">
      {items.map((item, i) => {
        const dotColor = perItemColors?.[i % perItemColors.length];
        const row = (
          <>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold text-slate-600 truncate",
                  onItemClick && "group-hover:text-slate-900",
                )}
              >
                {dotColor && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: dotColor }}
                    aria-hidden
                  />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-sm font-bold text-slate-500 shrink-0">
                {valueFormatter(item.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  !dotColor && BAR_LIST_COLOR[color],
                )}
                style={{
                  width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%`,
                  ...(dotColor
                    ? {
                        background: `linear-gradient(90deg, ${lightenHex(dotColor, 0.3)}, ${dotColor})`,
                      }
                    : {}),
                }}
              />
            </div>
          </>
        );
        return onItemClick ? (
          <button
            key={item.label}
            type="button"
            onClick={() => onItemClick(item.label)}
            className="w-full text-left cursor-pointer group"
          >
            {row}
          </button>
        ) : (
          <div key={item.label} className="w-full text-left">
            {row}
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  idPrefix,
  onSliceClick,
}: {
  data: { name: string; value: number; fill: string }[];
  centerValue: string;
  centerLabel: string;
  /** Unique per instance on the page (SVG gradient ids resolve document-wide). */
  idPrefix: string;
  onSliceClick?: (name: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="p-4">
      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((entry, i) => (
                <linearGradient
                  key={entry.name}
                  id={`${idPrefix}-${i}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor={lightenHex(entry.fill, 0.3)} />
                  <stop offset="100%" stopColor={entry.fill} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 3 : 0}
              cornerRadius={6}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={`url(#${idPrefix}-${i})`}
                  className={onSliceClick ? "cursor-pointer" : undefined}
                  {...(onSliceClick
                    ? { onClick: () => onSliceClick(entry.name) }
                    : {})}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-slate-800 leading-none">
            {centerValue}
          </p>
          <p className="text-sm text-slate-400 font-medium mt-1">
            {centerLabel}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2">
        {data.map((d) => (
          <span
            key={d.name}
            className="flex items-center gap-1.5 text-sm text-slate-500"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: d.fill }}
            />
            {d.name} <span className="font-bold text-slate-700">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function StackedHealthBar({
  segments,
  onClick,
}: {
  segments: { label: string; value: number; color: string }[];
  onClick?: () => void;
}) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  return (
    <div className="p-4">
      <div
        className={cn(
          "h-3 rounded-full bg-slate-100 overflow-hidden flex",
          onClick && "cursor-pointer",
        )}
        onClick={onClick}
      >
        {total === 0
          ? null
          : segments.map((s) => (
              <div
                key={s.label}
                style={{
                  width: `${(s.value / total) * 100}%`,
                  background: `linear-gradient(90deg, ${lightenHex(s.color, 0.25)}, ${s.color})`,
                }}
                className="h-full first:rounded-l-full last:rounded-r-full"
              />
            ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
        {segments.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-sm text-slate-500"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}{" "}
            <span className="font-bold text-slate-700">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const KIND_ICON: Record<CrmDashboardWorkItem["kind"], LucideIcon> = {
  Meeting: CalendarClock,
  "Follow-up": Clock3,
  Task: Target,
};

/** Legacy `SourceTag` — the record kind stands in for the legacy source tab. */
export function KindTag({ kind }: { kind: CrmDashboardWorkItem["kind"] }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Icon className="h-3 w-3" /> {kind}
    </span>
  );
}

function dueLabel(item: CrmDashboardWorkItem): string {
  const d = new Date(item.dueAt);
  return item.kind !== "Follow-up"
    ? d.toLocaleDateString("en-IN", { timeZone: "UTC", dateStyle: "medium" })
    : d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
}

/** Legacy `ActivityRow`, fed by a dashboard work item; opens the record's page. */
export function ActivityRow({
  item,
  urgencyLabel,
  urgencyTone,
}: {
  item: CrmDashboardWorkItem;
  urgencyLabel?: string | undefined;
  urgencyTone?: keyof typeof TONE_STYLE | undefined;
}) {
  const router = useRouter();
  const tone = TONE_STYLE[urgencyTone || "brand"];
  return (
    <button
      type="button"
      onClick={() => router.push(withDashboardOrigin(item.href))}
      className="w-full text-left px-4 py-3 hover:bg-brand-50/40 transition-colors border-b border-slate-100 last:border-b-0 flex items-start gap-3"
    >
      <span
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border",
          tone,
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {item.accountName || item.title || "Unknown Company"}
          </p>
          {urgencyLabel && (
            <span
              className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0",
                tone,
              )}
            >
              {urgencyLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {item.owner && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <User className="h-3 w-3" /> {item.owner}
            </span>
          )}
          <span className="flex items-center gap-1 text-sm text-slate-500">
            <Calendar className="h-3 w-3" /> {dueLabel(item)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <KindTag kind={item.kind} />
          {item.accountName && (
            <span className="text-sm text-slate-400 truncate">
              {item.title}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** Legacy `renderList`: first rows, "+N more", empty state. */
export function ActivityList({
  bucket,
  emptyTitle,
  urgencyLabel,
  urgencyTone,
}: {
  bucket: { count: number; items: CrmDashboardWorkItem[] };
  emptyTitle: string;
  urgencyLabel?: string;
  urgencyTone?: "red" | "amber" | "blue" | "emerald";
}) {
  if (bucket.count === 0) {
    return <EmptyState icon={ListChecks} title={emptyTitle} />;
  }
  return (
    <div className="max-h-80 overflow-y-auto">
      {bucket.items.map((a) => (
        <ActivityRow
          key={a.id}
          item={a}
          urgencyLabel={urgencyLabel}
          urgencyTone={urgencyTone}
        />
      ))}
      {bucket.count > bucket.items.length && (
        <div className="px-4 py-2 text-center text-sm text-slate-400 border-t border-slate-100">
          +{bucket.count - bucket.items.length} more
        </div>
      )}
    </div>
  );
}

/** The legacy dashboard showed Search / Calendar as inline panels with this button above them. */
export function BackToDashboardPanelButton() {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2"
      onClick={() => router.push("/crm/dashboard")}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
    </Button>
  );
}
