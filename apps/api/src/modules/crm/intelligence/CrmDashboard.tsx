// Feature 1 — CRM Dashboard. Single-page executive command center: read-only against the 8
// existing source tabs plus the CRM Core Domain (Accounts/Opportunities/Products/Quotas). All
// analytics previously shown on the standalone Analytics page/route now live here — that page and
// its "Analytics" button have been retired; nothing below invents data, it only reuses/aggregates
// what the existing services already compute.
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isBefore,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  LayoutDashboard,
  CalendarClock,
  PhoneCall,
  AlertTriangle,
  Clock3,
  CalendarDays,
  Users,
  ThumbsUp,
  ThumbsDown,
  ListChecks,
  CalendarCheck,
  BarChart3,
  Mail,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ArrowLeft,
  Briefcase,
  Building2,
  IndianRupee,
  Trophy,
  XCircle as XCircleIcon,
  Flame,
  Percent,
  UserPlus,
  Package,
  Receipt,
  PhoneCall as PhoneCallIcon,
  Target,
  Timer,
  PieChart as PieChartIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrmSourceData } from "./useCrmSourceData";
import { buildActivities } from "./unify";
import {
  EmptyState,
  ActivityRow,
  SectionHeading,
  StatTile,
  TILE_STYLE,
  type StatTileTone,
} from "./components";
import { cn } from "@/lib/utils";
import { startOfToday } from "./shared";
import { parseLooseDate } from "../notifications/dateUtils";
import { UnifiedCrmActivity } from "./types";
import { useOverallDataAnalytics } from "./useOverallDataAnalytics";
import CrmSearch from "./CrmSearch";
import CrmCalendar from "./CrmCalendar";
import { useCrmDashboardPanel } from "./dashboardPanelContext";
import { useCrmDomainData } from "../domain/useCrmDomainData";
import {
  computeExpectedRevenue,
  computeOpportunityHealth,
} from "../domain/config";
import { useCrmPipelineStages } from "../domain/pipelineStagesService";
import { subscribeAllCrmStageHistory } from "../domain/opportunitiesService";
import { CrmOpportunity, CrmStageHistoryEntry } from "../domain/types";

// Dashboard-level Search / Calendar toggle (buttons live in CRMLayout.tsx's header, next to the
// notification bell — see dashboardPanelContext.tsx) opens its view inline here, in place of the
// regular dashboard sections below — it does not navigate to the top-nav CRM Search/Calendar
// pages. Those top-nav pages and routes are untouched. Analytics no longer has a toggle/panel of
// its own — its content is now a permanent, always-visible part of the dashboard below.

// Dashboard scroll-position restoration — the app's actual scrollable region is Layout.tsx's
// `<main overflow-y-auto>`, not `window`; the page itself never scrolls. Position is kept in
// sessionStorage (survives the Dashboard unmounting while another CRM tab is open, and normal
// browser Back/Forward, without touching the History API) under a single fixed key — there is
// only ever one Dashboard scroll position to remember, regardless of which card was clicked.
const DASHBOARD_SCROLL_STORAGE_KEY = "crm-dashboard-scroll-pos";

function getDashboardScrollContainer(
  node: HTMLElement | null,
): HTMLElement | null {
  return node?.closest("main") ?? null;
}

const STATUS_GOOD = "#10b981";
const STATUS_CRITICAL = "#ef4444";
const STATUS_AMBER = "#f59e0b";
const STATUS_BLUE = "#3b82f6";

const chartTooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
};
const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

/**
 * One vivid top-to-bottom (or diagonal, for pies) gradient per chart — referenced by a Bar/Pie's
 * `fill="url(#id)"`. Each id is namespaced per usage below so multiple charts on the same page
 * never collide (SVG `id`s are resolved document-wide, not per-chart).
 */
function ChartGradient({
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

// --- Bento-style presentational widgets (Dashboard-only visual language: pastel hero tiles,
// donut charts with a centered figure, and compact horizontal bar lists in place of dense axis
// charts for small distributions). Purely presentational — every widget below is fed by the same
// data already computed above; nothing here reads Firebase or invents a number.

type Tone = StatTileTone;

/**
 * Dashboard-scoped chart/section container — same muted tint + thin matching border + soft
 * matching shadow as StatTile, with an inner near-white panel so chart content stays crisp and
 * readable. Deliberately separate from the shared SectionCard in components.tsx (used by
 * AccountDetail/DealDetail/CompanyDetail) so this visual pass never touches those other pages.
 */
function ChartCard({
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
  tone?: Tone;
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

/** One distinct color per category (source, stage, etc.) — cycled with `% length` for lists
 *  longer than the palette — so every bar/segment in a multi-category chart reads apart from its
 *  neighbors at a glance instead of every bar sharing one flat tone. Muted, enterprise-SaaS blues/
 *  teals/indigos/ambers rather than a bright rainbow set. */
const CATEGORY_PALETTE = [
  "#2563EB",
  "#0D9488",
  "#7C3AED",
  "#D97706",
  "#0EA5E9",
  "#4F46E5",
  "#64748B",
  "#059669",
];

/** A warm counterpart to CATEGORY_PALETTE, index-paired with it — used wherever a bar pair needs
 *  each source to stay colorful/distinct (cool tone) while its second metric (e.g. Converted)
 *  still reads apart from the first at a glance (warm tone), instead of every pair sharing one
 *  repeated blue/green combination. */
const CATEGORY_PALETTE_WARM = [
  "#F59E0B",
  "#FB923C",
  "#FBBF24",
  "#F472B6",
  "#FCD34D",
  "#FDBA74",
  "#EAB308",
  "#FDA4AF",
];

/** Lightens a `#rrggbb` hex color by `amt` (0-1) — used to turn a single flat color into a
 *  light-to-vivid gradient pair for donut slices and the stacked health bar. */
function lightenHex(hex: string, amt: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + Math.round(255 * amt));
  const g = clamp(((num >> 8) & 0x00ff) + Math.round(255 * amt));
  const b = clamp((num & 0x0000ff) + Math.round(255 * amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function HorizontalBarList({
  items,
  color = "brand",
  /** One hex color per bar (cycled), overriding the flat `color` tone above — used wherever each
   *  row is its own category (e.g. lead source) rather than one repeated series. */
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

function DonutChart({
  data,
  centerValue,
  centerLabel,
  idPrefix,
}: {
  data: { name: string; value: number; fill: string }[];
  centerValue: string;
  centerLabel: string;
  /** Unique per DonutChart instance on the page — SVG gradient `id`s resolve document-wide, so
   *  two donuts using the same prefix would silently share (and overwrite) each other's colors. */
  idPrefix: string;
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
                <Cell key={entry.name} fill={`url(#${idPrefix}-${i})`} />
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

function StackedHealthBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  return (
    <div className="p-4">
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
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

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-teal-500",
];
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default function CrmDashboard() {
  const navigate = useNavigate();
  const { activePanel, setActivePanel } = useCrmDashboardPanel();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);
  const { sources, loading } = useCrmSourceData();
  const activities = useMemo(() => buildActivities(sources), [sources]);
  // Read-only Overall Data counters (crm/overallData) — separate dataset from the 8 tabs above,
  // shown here purely for the "Today's Performance" section. Never affects buckets/activities.
  const overallData = useOverallDataAnalytics();

  // CRM Core Domain (Accounts/Contacts/Opportunities/Pipeline/Products) — a separate relational
  // dataset from the 8 sheet tabs above, shown in the Pipeline/Team/Product sections below.
  const domain = useCrmDomainData();
  const { stages: pipelineStageDefs, boardStages } = useCrmPipelineStages();
  const pipelineStats = useMemo(() => {
    const open = domain.opportunities.filter((o) => o.status === "OPEN");
    const won = domain.opportunities.filter((o) => o.status === "WON");
    const lost = domain.opportunities.filter((o) => o.status === "LOST");
    const weightedValue = open.reduce((sum, o) => {
      const prob =
        o.probability ??
        pipelineStageDefs.find((s) => s.id === o.stage)?.probability;
      return sum + computeExpectedRevenue(o.estimatedValue, prob);
    }, 0);
    const totalRevenue = won.reduce(
      (sum, o) => sum + (o.closingAmount ?? o.estimatedValue ?? 0),
      0,
    );
    const winRate =
      won.length + lost.length > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0;
    const avgDealSize =
      won.length > 0 ? Math.round(totalRevenue / won.length) : 0;
    const cycleDurations = won
      .filter((o) => o.wonAt && o.createdAt)
      .map((o) => (o.wonAt! - o.createdAt) / 86400000);
    const avgSalesCycleDays =
      cycleDurations.length > 0
        ? Math.round(
            cycleDurations.reduce((s, d) => s + d, 0) / cycleDurations.length,
          )
        : 0;
    const dealsAtRisk = open.filter((o) => {
      const slaDays = pipelineStageDefs.find((s) => s.id === o.stage)?.slaDays;
      return (
        computeOpportunityHealth(o.stageEnteredAt, o.status, slaDays) ===
        "Critical"
      );
    }).length;
    const forecastBuckets = {
      "Best Case": open
        .filter((o) => o.forecastCategory === "Best Case")
        .reduce((s, o) => s + (o.estimatedValue || 0), 0),
      Commit: open
        .filter((o) => o.forecastCategory === "Commit")
        .reduce((s, o) => s + (o.estimatedValue || 0), 0),
      Pipeline: open
        .filter((o) => o.forecastCategory === "Pipeline")
        .reduce((s, o) => s + (o.estimatedValue || 0), 0),
    };
    return {
      openCount: open.length,
      openValue: open.reduce((sum, o) => sum + (o.estimatedValue || 0), 0),
      weightedValue,
      wonCount: won.length,
      lostCount: lost.length,
      totalRevenue,
      winRate,
      avgDealSize,
      avgSalesCycleDays,
      dealsAtRisk,
      forecastBuckets,
      stuckCount: open.filter((o) => {
        const slaDays = pipelineStageDefs.find(
          (s) => s.id === o.stage,
        )?.slaDays;
        return (
          computeOpportunityHealth(o.stageEnteredAt, o.status, slaDays) !==
          "Healthy"
        );
      }).length,
      accountsCount: domain.accounts.length,
    };
  }, [domain.opportunities, domain.accounts, pipelineStageDefs]);

  // Revenue Trend — layered area chart over the last 6 months: pipeline value created, revenue
  // won, and monthly quota target, all from the same live CRM Core Domain data used elsewhere on
  // this page (opportunities/quotas). Shown as the first chart on the dashboard.
  const revenueTrendChart = useMemo(() => {
    // Bucketed by month key in one O(n) pass each, instead of re-filtering the full opportunities
    // (twice) and quotas arrays independently for every one of the 6 months in the loop below.
    const createdByMonth = new Map<string, number>();
    const wonByMonth = new Map<string, number>();
    domain.opportunities.forEach((o) => {
      const createdKey = format(new Date(o.createdAt), "yyyy-MM");
      createdByMonth.set(
        createdKey,
        (createdByMonth.get(createdKey) || 0) + (o.estimatedValue || 0),
      );
      if (o.status === "WON" && o.wonAt) {
        const wonKey = format(new Date(o.wonAt), "yyyy-MM");
        wonByMonth.set(
          wonKey,
          (wonByMonth.get(wonKey) || 0) +
            (o.closingAmount ?? o.estimatedValue ?? 0),
        );
      }
    });
    const targetByMonth = new Map<string, number>();
    domain.quotas.forEach((q) => {
      if (q.period !== "monthly") return;
      targetByMonth.set(
        q.periodKey,
        (targetByMonth.get(q.periodKey) || 0) + q.targetAmount,
      );
    });

    const months = Array.from({ length: 6 }, (_, i) =>
      startOfMonth(subMonths(new Date(), 5 - i)),
    );
    return months.map((monthStart) => {
      const monthKey = format(monthStart, "yyyy-MM");
      return {
        month: format(monthStart, "MMM yy"),
        pipelineCreated: createdByMonth.get(monthKey) || 0,
        wonRevenue: wonByMonth.get(monthKey) || 0,
        target: targetByMonth.get(monthKey) || 0,
      };
    });
  }, [domain.opportunities, domain.quotas]);

  const revenueTrendTotals = useMemo(() => {
    const pipelineCreated = revenueTrendChart.reduce(
      (s, m) => s + m.pipelineCreated,
      0,
    );
    const wonRevenue = revenueTrendChart.reduce((s, m) => s + m.wonRevenue, 0);
    const target = revenueTrendChart.reduce((s, m) => s + m.target, 0);
    const attainmentPct =
      target > 0 ? Math.round((wonRevenue / target) * 100) : 0;
    return { pipelineCreated, wonRevenue, target, attainmentPct };
  }, [revenueTrendChart]);

  const teamPerformance = useMemo(() => {
    const reps = new Map<
      string,
      { won: number; wonValue: number; open: number; lost: number }
    >();
    domain.opportunities.forEach((o) => {
      const rep = reps.get(o.ownerName) || {
        won: 0,
        wonValue: 0,
        open: 0,
        lost: 0,
      };
      if (o.status === "WON") {
        rep.won += 1;
        rep.wonValue += o.closingAmount ?? o.estimatedValue ?? 0;
      } else if (o.status === "OPEN") rep.open += 1;
      else if (o.status === "LOST") rep.lost += 1;
      reps.set(o.ownerName, rep);
    });
    return Array.from(reps.entries())
      .map(([repName, stats]) => {
        const quota = domain.quotas.find(
          (q) =>
            q.repName.trim().toLowerCase() === repName.trim().toLowerCase(),
        );
        return {
          repName,
          ...stats,
          winRate:
            stats.won + stats.lost > 0
              ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
              : 0,
          target: quota?.targetAmount,
          // Attainment vs the rep's all-time Won value shown alongside it in this same row (not
          // `computeQuotaAttainment`'s current-period-only figure) — this section has no period
          // filter anywhere else, so scoping just the progress bar to "this month/quarter" made it
          // silently read 0% whenever a deal was won outside the quota's period, even though the
          // row's own "X won · ₹Y" text (all-time) showed real revenue.
          attainmentPct:
            quota && quota.targetAmount > 0
              ? Math.round((stats.wonValue / quota.targetAmount) * 100)
              : undefined,
        };
      })
      .sort((a, b) => b.wonValue - a.wonValue);
  }, [domain.opportunities, domain.quotas]);

  // Pipeline funnel — stage-wise open deal count + value, from the existing Analytics page.
  // Grouped once in a single O(n) pass rather than each chart re-filtering the full opportunities
  // array per stage (O(stages × n) each, twice over between the two charts).
  const openByStage = useMemo(() => {
    const map = new Map<string, CrmOpportunity[]>();
    domain.opportunities.forEach((o) => {
      if (o.status !== "OPEN") return;
      const list = map.get(o.stage);
      if (list) list.push(o);
      else map.set(o.stage, [o]);
    });
    return map;
  }, [domain.opportunities]);
  const funnelChart = useMemo(
    () =>
      boardStages.map((s) => ({
        stage: s.label,
        count: (openByStage.get(s.id) || []).length,
      })),
    [openByStage, boardStages],
  );
  const pipelineValueChart = useMemo(
    () =>
      boardStages.map((s) => ({
        stage: s.label,
        value: (openByStage.get(s.id) || []).reduce(
          (sum, o) => sum + (o.estimatedValue || 0),
          0,
        ),
      })),
    [openByStage, boardStages],
  );

  const [allStageHistory, setAllStageHistory] = useState<
    CrmStageHistoryEntry[]
  >([]);
  useEffect(() => subscribeAllCrmStageHistory(setAllStageHistory), []);
  const stageDurationChart = useMemo(() => {
    const byOpportunity = new Map<string, CrmStageHistoryEntry[]>();
    allStageHistory.forEach((h) => {
      const list = byOpportunity.get(h.opportunityId) || [];
      list.push(h);
      byOpportunity.set(h.opportunityId, list);
    });
    const durations = new Map<string, { totalMs: number; count: number }>();
    const addDuration = (stageId: string, ms: number) => {
      const cur = durations.get(stageId) || { totalMs: 0, count: 0 };
      durations.set(stageId, {
        totalMs: cur.totalMs + ms,
        count: cur.count + 1,
      });
    };
    byOpportunity.forEach((entries, opportunityId) => {
      const sorted = [...entries].sort((a, b) => a.changedAt - b.changedAt);
      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (next) {
          addDuration(current.toStage, next.changedAt - current.changedAt);
        } else {
          const opp = domain.opportunities.find((o) => o.id === opportunityId);
          if (opp && opp.status === "OPEN")
            addDuration(current.toStage, Date.now() - current.changedAt);
        }
      }
    });
    return boardStages
      .map((s) => {
        const d = durations.get(s.id);
        return {
          stage: s.label,
          avgDays: d
            ? Math.round((d.totalMs / d.count / 86400000) * 10) / 10
            : 0,
        };
      })
      .filter((d) => d.avgDays > 0);
  }, [allStageHistory, domain.opportunities, boardStages]);

  const dealAgingChart = useMemo(() => {
    const buckets = {
      "0-7 days": 0,
      "8-14 days": 0,
      "15-30 days": 0,
      "30+ days": 0,
    };
    domain.opportunities
      .filter((o) => o.status === "OPEN")
      .forEach((o) => {
        const ageDays = (Date.now() - o.createdAt) / 86400000;
        if (ageDays <= 7) buckets["0-7 days"]++;
        else if (ageDays <= 14) buckets["8-14 days"]++;
        else if (ageDays <= 30) buckets["15-30 days"]++;
        else buckets["30+ days"]++;
      });
    return Object.entries(buckets).map(([bucket, count]) => ({
      bucket,
      count,
    }));
  }, [domain.opportunities]);

  const lostReasonChart = useMemo(() => {
    const lost = domain.opportunities.filter((o) => o.status === "LOST");
    const byReason = new Map<string, number>();
    lost.forEach((o) =>
      byReason.set(
        o.lostReason || "Other",
        (byReason.get(o.lostReason || "Other") || 0) + 1,
      ),
    );
    return Array.from(byReason.entries()).map(([reason, count]) => ({
      reason,
      count,
    }));
  }, [domain.opportunities]);

  // Deal Health — Healthy/Delayed/Critical split of open opportunities, by time in current stage
  // against that stage's configured SLA. Same computeOpportunityHealth used for "Deals at Risk".
  const dealHealth = useMemo(() => {
    const open = domain.opportunities.filter((o) => o.status === "OPEN");
    const counts = { Healthy: 0, Delayed: 0, Critical: 0 };
    open.forEach((o) => {
      const slaDays = pipelineStageDefs.find((s) => s.id === o.stage)?.slaDays;
      counts[computeOpportunityHealth(o.stageEnteredAt, o.status, slaDays)]++;
    });
    return [
      { label: "Healthy", value: counts.Healthy, color: STATUS_GOOD },
      { label: "Delayed", value: counts.Delayed, color: STATUS_AMBER },
      { label: "Critical", value: counts.Critical, color: STATUS_CRITICAL },
    ];
  }, [domain.opportunities, pipelineStageDefs]);

  // Product / Revenue Insights — from CRM Core Domain deal line items (crm/dealProducts) joined
  // to WON opportunities. Product names are the snapshot stored on the deal product row, so a
  // renamed/deleted product never blanks out historical revenue.
  const revenueByProductChart = useMemo(() => {
    const wonIds = new Set(
      domain.opportunities.filter((o) => o.status === "WON").map((o) => o.id),
    );
    const byProduct = new Map<string, number>();
    domain.dealProducts
      .filter((dp) => wonIds.has(dp.opportunityId))
      .forEach((dp) => {
        byProduct.set(
          dp.productName,
          (byProduct.get(dp.productName) || 0) + (dp.total || 0),
        );
      });
    return Array.from(byProduct.entries())
      .map(([product, value]) => ({ product, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [domain.opportunities, domain.dealProducts]);

  // Leads by Source / Lead Source Performance — single source of truth over the live `crm/leads`
  // records' own `leadSource` column, so both widgets always agree with each other and with the
  // Leads tab itself. "Converted" mirrors the Leads tab's own Converted filter (`linkedAccountId`
  // set by LeadConvertDialog), not the freely-editable `leadStatus` text field, so a rep manually
  // typing "CONVERTED" into Lead Status without actually converting the lead can't inflate this
  // count. `leadSource` lives only on the Lead row and is never touched by conversion, so the
  // original source stays correctly attributed after a lead is promoted to an Account/Deal.
  const leadSourceChart = useMemo(() => {
    const rows = Object.values(sources.leads || {});
    const bySrc = new Map<string, { total: number; converted: number }>();
    rows.forEach((row) => {
      const source = row.leadSource?.trim();
      if (!source) return;
      const cur = bySrc.get(source) || { total: 0, converted: 0 };
      bySrc.set(source, {
        total: cur.total + 1,
        converted: cur.converted + (row.linkedAccountId ? 1 : 0),
      });
    });
    return Array.from(bySrc.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [sources.leads]);

  const leadSourceTotal = useMemo(
    () => leadSourceChart.reduce((sum, s) => sum + s.total, 0),
    [leadSourceChart],
  );
  const leadSourceConvertedTotal = useMemo(
    () => leadSourceChart.reduce((sum, s) => sum + s.converted, 0),
    [leadSourceChart],
  );

  // Leads Trend — fills the empty space beside "Leads by Source" with a real trend instead of
  // dead whitespace: lead volume over time, bucketed from each Lead row's own `date` field (the
  // same free-text column every other CRM tab date-parses via parseLooseDate). Granularity adapts
  // to how wide the actual data's date range is (day/week/month) so a handful of leads a few days
  // apart isn't stretched into a mostly-empty 6-month axis, and vice versa. Never invents points —
  // rows with an unparseable/blank date are simply excluded, same as everywhere else in the app.
  const leadsTrendChart = useMemo(() => {
    type TrendPoint = { label: string; total: number; converted: number };
    const dated = Object.values(sources.leads || {})
      .map((row) => ({
        date: parseLooseDate(row.date),
        converted: !!row.linkedAccountId,
      }))
      .filter((r): r is { date: Date; converted: boolean } => !!r.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const uniqueDayKeys = new Set(
      dated.map((d) => format(d.date, "yyyy-MM-dd")),
    );
    if (uniqueDayKeys.size < 2)
      return { points: [] as TrendPoint[], granularityLabel: "" };

    const first = dated[0].date;
    const last = dated[dated.length - 1].date;
    const spanDays = differenceInCalendarDays(last, first);

    const bucketBy = (keyOf: (d: Date) => string) => {
      const counts = new Map<string, { total: number; converted: number }>();
      dated.forEach((row) => {
        const k = keyOf(row.date);
        const cur = counts.get(k) || { total: 0, converted: 0 };
        counts.set(k, {
          total: cur.total + 1,
          converted: cur.converted + (row.converted ? 1 : 0),
        });
      });
      return counts;
    };

    if (spanDays <= 31) {
      const counts = bucketBy((d) => format(d, "yyyy-MM-dd"));
      const points = eachDayOfInterval({ start: first, end: last }).map((d) => {
        const c = counts.get(format(d, "yyyy-MM-dd")) || {
          total: 0,
          converted: 0,
        };
        return { label: format(d, "dd MMM"), ...c };
      });
      return { points, granularityLabel: "Daily" };
    }
    if (spanDays <= 180) {
      const counts = bucketBy((d) =>
        format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      );
      const points = eachWeekOfInterval(
        { start: first, end: last },
        { weekStartsOn: 1 },
      ).map((d) => {
        const c = counts.get(format(d, "yyyy-MM-dd")) || {
          total: 0,
          converted: 0,
        };
        return { label: format(d, "dd MMM"), ...c };
      });
      return { points, granularityLabel: "Weekly" };
    }
    const counts = bucketBy((d) => format(startOfMonth(d), "yyyy-MM"));
    const points = eachMonthOfInterval({ start: first, end: last }).map((d) => {
      const c = counts.get(format(d, "yyyy-MM")) || { total: 0, converted: 0 };
      return { label: format(d, "MMM yy"), ...c };
    });
    return { points, granularityLabel: "Monthly" };
  }, [sources.leads]);

  const buckets = useMemo(() => {
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const weekAhead = addDays(today, 7);

    const isDue = (a: UnifiedCrmActivity) => !!a.dueDate && !a.isClosedOut;

    const todaysMeetings = activities.filter(
      (a) =>
        a.activityKind === "meeting" &&
        isDue(a) &&
        isSameDay(a.dueDate!, today),
    );
    const todaysFollowups = activities.filter(
      (a) =>
        a.activityKind === "followup" &&
        isDue(a) &&
        isSameDay(a.dueDate!, today),
    );
    const todaysCallbacks = todaysFollowups.filter(
      (a) => a.sourceTab === "callBackSendInfo",
    );

    const tomorrowMeetings = activities.filter(
      (a) =>
        a.activityKind === "meeting" &&
        isDue(a) &&
        isSameDay(a.dueDate!, tomorrow),
    );
    const upcomingFollowups = activities.filter(
      (a) =>
        a.activityKind === "followup" &&
        isDue(a) &&
        a.dueDate! > today &&
        a.dueDate! <= weekAhead,
    );

    const overdueActivities = activities.filter(
      (a) =>
        (a.activityKind === "meeting" || a.activityKind === "followup") &&
        isDue(a) &&
        isBefore(a.dueDate!, today),
    );
    const missedFollowups = overdueActivities.filter(
      (a) => a.activityKind === "followup",
    );
    const pendingActivities = activities.filter(
      (a) =>
        (a.activityKind === "meeting" || a.activityKind === "followup") &&
        isDue(a),
    );
    const completedActivities = activities.filter((a) => a.isClosedOut).length;

    const tasksRequiringAttention = [
      ...todaysMeetings,
      ...todaysFollowups,
      ...overdueActivities,
    ];

    // Total Leads — the live `crm/leads` sheet only. `crm/yetToHappen` used to be added here too,
    // but that tab now shows CRM Core Domain tasks/follow-ups/meetings (see YetToHappen.tsx), not
    // sheet rows, so its old row count is stale/orphaned data and would inflate this number.
    const totalLeads = sources.leads ? Object.keys(sources.leads).length : 0;

    // Interested / Not Interested / Pending Follow-ups — Interested, Not Interested, Keep in
    // Touch and Call Back-Send Info are now all filtered views over `crm/accounts` (`statusTag`),
    // not their own sheets (see AccountStatusQueue.tsx). Counting from the live Accounts data here
    // keeps these numbers identical to what each tab actually shows when clicked.
    const interestedLeads = domain.accounts.filter(
      (a) => a.statusTag === "Interested",
    ).length;
    const notInterestedCount = domain.accounts.filter(
      (a) => a.statusTag === "Not Interested",
    ).length;
    const pendingFollowUpsCount = domain.accounts.filter(
      (a) => a.statusTag === "Keep in Touch",
    ).length;

    // Scheduled Meetings — live CRM Core Domain meetings (crm/meetings) not yet completed/
    // cancelled/no-show, matching what Yet to Happen now shows (see YetToHappen.tsx).
    const scheduledMeetingsCount = domain.meetings.filter(
      (m) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(m.status),
    ).length;

    return {
      todaysMeetings,
      todaysFollowups,
      todaysCallbacks,
      tasksRequiringAttention,
      tomorrowMeetings,
      upcomingFollowups,
      overdueActivities,
      missedFollowups,
      pendingActivities,
      completedActivities,
      overview: {
        totalLeads,
        interestedLeads,
        notInterestedCount,
        pendingFollowUpsCount,
        scheduledMeetingsCount,
      },
    };
  }, [activities, sources, domain.accounts, domain.meetings]);

  // Hero donut — same four status counts as the KPI tiles above it (buckets.overview), just
  // visualized as a colorful split instead of re-deriving anything from source data.
  const leadStatusPie = useMemo(
    () => [
      {
        name: "Interested",
        value: buckets.overview.interestedLeads,
        fill: STATUS_GOOD,
      },
      {
        name: "Not Interested",
        value: buckets.overview.notInterestedCount,
        fill: STATUS_CRITICAL,
      },
      {
        name: "Pending Follow-ups",
        value: buckets.overview.pendingFollowUpsCount,
        fill: STATUS_AMBER,
      },
      {
        name: "Scheduled Meetings",
        value: buckets.overview.scheduledMeetingsCount,
        fill: STATUS_BLUE,
      },
    ],
    [buckets.overview],
  );
  const leadStatusPieTotal = leadStatusPie.reduce((s, d) => s + d.value, 0);

  const renderList = (
    items: UnifiedCrmActivity[],
    emptyTitle: string,
    urgencyLabel?: string,
    urgencyTone?: "red" | "amber" | "blue" | "emerald",
  ) => {
    if (items.length === 0) {
      return <EmptyState icon={ListChecks} title={emptyTitle} />;
    }
    return (
      <div className="max-h-80 overflow-y-auto">
        {items.slice(0, 8).map((a) => (
          <ActivityRow
            key={a.id}
            activity={a}
            urgencyLabel={urgencyLabel}
            urgencyTone={urgencyTone}
          />
        ))}
        {items.length > 8 && (
          <div className="px-4 py-2 text-center text-sm text-slate-400 border-t border-slate-100">
            +{items.length - 8} more
          </div>
        )}
      </div>
    );
  };

  // Continuously mirror the scroll container's current position into sessionStorage while the
  // Dashboard is mounted, so whichever card the user clicks, the position right before that
  // navigation is always the one saved (no per-card bookkeeping needed).
  useEffect(() => {
    const container = getDashboardScrollContainer(rootRef.current);
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sessionStorage.setItem(
          DASHBOARD_SCROLL_STORAGE_KEY,
          JSON.stringify({
            top: container.scrollTop,
            left: container.scrollLeft,
          }),
        );
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Restore the saved position once — only after the real Dashboard content (not the loading
  // placeholder or an inline Search/Calendar panel) has actually mounted, so the container has
  // its full scrollHeight to scroll into. Runs after paint (useLayoutEffect + a settle frame) so
  // charts/images that affect layout height have had a chance to lay out first.
  useLayoutEffect(() => {
    if (scrollRestoredRef.current || loading || activePanel) return;
    const raw = sessionStorage.getItem(DASHBOARD_SCROLL_STORAGE_KEY);
    if (!raw) {
      scrollRestoredRef.current = true;
      return;
    }
    const container = getDashboardScrollContainer(rootRef.current);
    if (!container) return;
    scrollRestoredRef.current = true;
    let saved: { top: number; left: number };
    try {
      saved = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(DASHBOARD_SCROLL_STORAGE_KEY);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: saved.top,
          left: saved.left,
          behavior: "auto",
        });
        sessionStorage.removeItem(DASHBOARD_SCROLL_STORAGE_KEY);
      });
    });
  }, [loading, activePanel]);

  return (
    <div className="space-y-6" ref={rootRef}>
      <div className="crm-panel-frame crm-panel-header relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="p-2.5 bg-gradient-to-br from-brand-400 to-brand-600 text-white rounded-2xl shadow-md shadow-brand-500/20">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              CRM Dashboard
            </h2>
            <p className="text-sm text-slate-500">
              Everything a Team Lead needs, on one screen.
            </p>
          </div>
        </div>
      </div>

      {activePanel ? (
        <div className="space-y-4">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => setActivePanel(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Button>
          {activePanel === "search" && <CrmSearch />}
          {activePanel === "calendar" && <CrmCalendar />}
        </div>
      ) : loading || domain.loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Loading CRM data…
        </div>
      ) : (
        <>
          {/* Revenue Trend — first chart on the dashboard, layered area chart (Pipeline Created vs
              Revenue Won vs Monthly Target) over the last 6 months. */}
          <div className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-sky-400 to-indigo-600">
                  <TrendingUp className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    Revenue Trend
                  </h3>
                  <p className="text-sm text-slate-500 truncate">
                    Pipeline created vs Revenue won vs Target — last 6 months
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                    Pipeline Created
                  </p>
                  <p className="text-lg font-bold text-sky-600">
                    {inr(revenueTrendTotals.pipelineCreated)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                    Revenue Won
                  </p>
                  <p className="text-lg font-bold text-emerald-600">
                    {inr(revenueTrendTotals.wonRevenue)}
                  </p>
                </div>
                {revenueTrendTotals.target > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                      vs Target
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        revenueTrendTotals.attainmentPct >= 100
                          ? "text-emerald-600"
                          : "text-rose-600",
                      )}
                    >
                      {Math.abs(revenueTrendTotals.attainmentPct - 100)}%{" "}
                      {revenueTrendTotals.attainmentPct >= 100
                        ? "Over"
                        : "Under"}{" "}
                      Target
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="mx-3 mb-3 rounded-2xl bg-white/80 border border-white">
              {revenueTrendTotals.pipelineCreated +
                revenueTrendTotals.wonRevenue +
                revenueTrendTotals.target ===
              0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No revenue activity yet"
                  description="This trend appears once deals are created or won."
                />
              ) : (
                <div className="p-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={revenueTrendChart}
                      margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="gradTrendPipeline"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#38bdf8"
                            stopOpacity={0.55}
                          />
                          <stop
                            offset="95%"
                            stopColor="#38bdf8"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                        <linearGradient
                          id="gradTrendWon"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#34d399"
                            stopOpacity={0.55}
                          />
                          <stop
                            offset="95%"
                            stopColor="#34d399"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                        <linearGradient
                          id="gradTrendTarget"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#fbbf24"
                            stopOpacity={0.55}
                          />
                          <stop
                            offset="95%"
                            stopColor="#fbbf24"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eef2f6"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v: number) =>
                          `₹${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(v: number) => inr(v)}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="pipelineCreated"
                        name="Pipeline Created"
                        stroke="#0ea5e9"
                        fill="url(#gradTrendPipeline)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="wonRevenue"
                        name="Revenue Won"
                        stroke="#059669"
                        fill="url(#gradTrendWon)"
                        strokeWidth={2}
                      />
                      {revenueTrendTotals.target > 0 && (
                        <Area
                          type="monotone"
                          dataKey="target"
                          name="Target"
                          stroke="#d97706"
                          fill="url(#gradTrendTarget)"
                          strokeWidth={2}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Executive KPI Summary — the hero row, pastel bento tiles like the reference design,
              with a live donut on the right visualizing the same four status counts as the tiles
              (no separate/duplicate data — same `buckets.overview` numbers). */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-stretch">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatTile
                icon={Users}
                label="Total Leads"
                value={buckets.overview.totalLeads}
                tone="violet"
                onClick={() =>
                  navigate("/crm/leads", { state: { fromCrmDashboard: true } })
                }
              />
              <StatTile
                icon={ThumbsUp}
                label="Interested Leads"
                value={buckets.overview.interestedLeads}
                tone="emerald"
                onClick={() =>
                  navigate("/crm/interested", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={ThumbsDown}
                label="Not Interested"
                value={buckets.overview.notInterestedCount}
                tone="rose"
                onClick={() =>
                  navigate("/crm/not-interested", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Clock3}
                label="Pending Follow-ups"
                value={buckets.overview.pendingFollowUpsCount}
                tone="amber"
                onClick={() =>
                  navigate("/crm/keep-in-touch", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={CalendarCheck}
                label="Scheduled Meetings"
                value={buckets.overview.scheduledMeetingsCount}
                tone="sky"
                onClick={() =>
                  navigate("/crm/yet-to-happen", {
                    state: { fromCrmDashboard: true, subTab: "Meeting" },
                  })
                }
              />
              {/* 6th tile — fills what would otherwise be an empty cell in the 3-column grid (5
                  tiles leaves one gap on the last row). Reuses leadSourceConvertedTotal, the same
                  linkedAccountId-based Converted figure already computed for Lead Source
                  Performance below, rather than a new/duplicate calculation. */}
              <StatTile
                icon={CheckCircle2}
                label="Converted Leads"
                value={leadSourceConvertedTotal}
                tone="teal"
                onClick={() =>
                  navigate("/crm/leads", { state: { fromCrmDashboard: true } })
                }
              />
            </div>
            <ChartCard
              icon={PieChartIcon}
              title="Lead Status Split"
              tone="violet"
              description="Interested · Not Interested · Follow-ups · Meetings"
            >
              {leadStatusPieTotal === 0 ? (
                <EmptyState icon={PieChartIcon} title="No lead activity yet" />
              ) : (
                <DonutChart
                  idPrefix="leadStatusSplit"
                  data={leadStatusPie}
                  centerValue={String(leadStatusPieTotal)}
                  centerLabel="Tracked"
                />
              )}
            </ChartCard>
          </div>

          {/* Pipeline / Sales Overview — CRM Core Domain (Accounts/Opportunities), a separate
              relational dataset from the 8 sheet tabs above. */}
          <div>
            <SectionHeading
              icon={Briefcase}
              title="Sales / Pipeline Overview"
              tone="indigo"
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs rounded-lg"
                    onClick={() =>
                      navigate("/crm/accounts", {
                        state: { fromCrmDashboard: true },
                      })
                    }
                  >
                    Accounts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs rounded-lg"
                    onClick={() =>
                      navigate("/crm/pipeline", {
                        state: { fromCrmDashboard: true },
                      })
                    }
                  >
                    Pipeline
                  </Button>
                </div>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatTile
                icon={Building2}
                label="Accounts"
                value={pipelineStats.accountsCount}
                tone="blue"
                onClick={() =>
                  navigate("/crm/accounts", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Briefcase}
                label="Open Deals"
                value={pipelineStats.openCount}
                tone="indigo"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={IndianRupee}
                label="Open Pipeline Value"
                value={inr(pipelineStats.openValue)}
                tone="emerald"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={IndianRupee}
                label="Weighted Pipeline Value"
                value={inr(pipelineStats.weightedValue)}
                tone="purple"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Trophy}
                label="Closed Won"
                value={pipelineStats.wonCount}
                tone="teal"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={XCircleIcon}
                label="Closed Lost"
                value={pipelineStats.lostCount}
                tone="rose"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Percent}
                label="Win Rate"
                value={`${pipelineStats.winRate}%`}
                tone="cyan"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={IndianRupee}
                label="Total Revenue (Won)"
                value={inr(pipelineStats.totalRevenue)}
                tone="gold"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Flame}
                label="Stuck Deals"
                value={pipelineStats.stuckCount}
                tone="orange"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={IndianRupee}
                label="Avg Deal Size"
                value={inr(pipelineStats.avgDealSize)}
                tone="teal"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={Clock3}
                label="Avg Sales Cycle"
                value={
                  pipelineStats.avgSalesCycleDays > 0
                    ? `${pipelineStats.avgSalesCycleDays}d`
                    : "—"
                }
                tone="purple"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={AlertTriangle}
                label="Deals at Risk"
                value={pipelineStats.dealsAtRisk}
                tone="rose"
                onClick={() =>
                  navigate("/crm/pipeline", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
            </div>

            {pipelineStats.forecastBuckets["Best Case"] +
              pipelineStats.forecastBuckets["Commit"] +
              pipelineStats.forecastBuckets["Pipeline"] >
              0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <StatTile
                  icon={Trophy}
                  label="Forecast — Best Case"
                  value={inr(pipelineStats.forecastBuckets["Best Case"])}
                  tone="emerald"
                />
                <StatTile
                  icon={CheckCircle2}
                  label="Forecast — Commit"
                  value={inr(pipelineStats.forecastBuckets["Commit"])}
                  tone="blue"
                />
                <StatTile
                  icon={Briefcase}
                  label="Forecast — Pipeline"
                  value={inr(pipelineStats.forecastBuckets["Pipeline"])}
                  tone="purple"
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              <ChartCard
                icon={Briefcase}
                title="Stage-Wise Deal Value"
                tone="brand"
                description="Estimated value (₹) of open opportunities"
              >
                {pipelineValueChart.length === 0 ? (
                  <EmptyState icon={Briefcase} title="No pipeline deals yet" />
                ) : (
                  <div className="p-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={pipelineValueChart}
                        margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#eef2f6"
                        />
                        <XAxis
                          dataKey="stage"
                          tick={{ fontSize: 9, fill: "#64748b" }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(v: number) => inr(v)}
                          cursor={{ fill: "rgba(16,185,129,0.08)" }}
                        />
                        {/* Per-stage Cell fills, not a single `fill="url(#...)"` gradient reference on
                            the whole Bar — that pattern silently failed to paint here (see Lead Source
                            Performance below), leaving every bar invisible despite real data/axis scale. */}
                        <Bar
                          dataKey="value"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={40}
                          onClick={() =>
                            navigate("/crm/pipeline", {
                              state: { fromCrmDashboard: true },
                            })
                          }
                        >
                          {pipelineValueChart.map((entry, i) => (
                            <Cell
                              key={entry.stage}
                              fill={
                                CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <ChartCard
                icon={Trophy}
                title="Deal Outcome"
                tone="emerald"
                description="Open vs Won vs Lost opportunities"
              >
                {pipelineStats.openCount +
                  pipelineStats.wonCount +
                  pipelineStats.lostCount ===
                0 ? (
                  <EmptyState icon={Trophy} title="No opportunities yet" />
                ) : (
                  <DonutChart
                    idPrefix="dealOutcome"
                    data={[
                      {
                        name: "Open",
                        value: pipelineStats.openCount,
                        fill: STATUS_BLUE,
                      },
                      {
                        name: "Won",
                        value: pipelineStats.wonCount,
                        fill: STATUS_GOOD,
                      },
                      {
                        name: "Lost",
                        value: pipelineStats.lostCount,
                        fill: STATUS_CRITICAL,
                      },
                    ]}
                    centerValue={`${pipelineStats.winRate}%`}
                    centerLabel="Win Rate"
                  />
                )}
              </ChartCard>

              <ChartCard
                icon={Target}
                title="Deal Health"
                tone="rose"
                description="Open opportunities by time-in-stage vs SLA"
              >
                {pipelineStats.openCount === 0 ? (
                  <EmptyState icon={Target} title="No open deals yet" />
                ) : (
                  <StackedHealthBar segments={dealHealth} />
                )}
              </ChartCard>

              <ChartCard
                icon={Target}
                title="Stage-Wise Deal Count"
                tone="blue"
                description="Open opportunities per pipeline stage"
              >
                {funnelChart.length === 0 ? (
                  <EmptyState icon={Target} title="No pipeline deals yet" />
                ) : (
                  <HorizontalBarList
                    items={funnelChart.map((f) => ({
                      label: f.stage,
                      value: f.count,
                    }))}
                    color="blue"
                    onItemClick={() =>
                      navigate("/crm/pipeline", {
                        state: { fromCrmDashboard: true },
                      })
                    }
                  />
                )}
              </ChartCard>

              {stageDurationChart.length > 0 && (
                <ChartCard
                  icon={Timer}
                  title="Avg. Time in Stage"
                  tone="blue"
                  description="Average days spent in each pipeline stage"
                >
                  <HorizontalBarList
                    items={stageDurationChart.map((d) => ({
                      label: d.stage,
                      value: d.avgDays,
                    }))}
                    color="blue"
                    valueFormatter={(v) => `${v}d`}
                  />
                </ChartCard>
              )}

              {dealAgingChart.some((d) => d.count > 0) && (
                <ChartCard
                  icon={Timer}
                  title="Deal Aging"
                  tone="amber"
                  description="Open deals bucketed by days since creation"
                >
                  <HorizontalBarList
                    items={dealAgingChart.map((d) => ({
                      label: d.bucket,
                      value: d.count,
                    }))}
                    color="amber"
                  />
                </ChartCard>
              )}

              {lostReasonChart.length > 0 && (
                <ChartCard
                  icon={XCircle}
                  title="Lost Analysis"
                  tone="red"
                  description="Lost opportunities by reason"
                >
                  <HorizontalBarList
                    items={lostReasonChart.map((d) => ({
                      label: d.reason,
                      value: d.count,
                    }))}
                    color="red"
                  />
                </ChartCard>
              )}
            </div>
          </div>

          {/* Team Performance — rep-level rollup, joins live opportunity outcomes with the Phase 7
              Quota system where a target exists for that rep. */}
          <div>
            <SectionHeading
              icon={Users}
              title="Team Performance"
              tone="indigo"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs rounded-lg"
                  onClick={() =>
                    navigate("/crm/quotas", {
                      state: { fromCrmDashboard: true },
                    })
                  }
                >
                  Quotas
                </Button>
              }
            />
            {teamPerformance.length === 0 ? (
              <div className="crm-panel-frame rounded-2xl bg-white">
                <EmptyState
                  icon={Users}
                  title="No opportunities yet"
                  description="Team performance appears once deals are logged in Pipeline."
                />
              </div>
            ) : (
              <div className="crm-panel-frame rounded-2xl bg-white divide-y divide-slate-100">
                {teamPerformance.map((r, i) => {
                  // With a quota, the bar tracks attainment (won ₹ vs target). Without one — the
                  // common case until Quotas is set up — it falls back to win rate instead of a
                  // flat grey "No quota set" bar, so reps with real, good numbers still show a
                  // colored bar rather than none at all.
                  const hasQuota = r.attainmentPct !== undefined;
                  const barPct = hasQuota ? r.attainmentPct! : r.winRate;
                  const barColor =
                    barPct >= 100
                      ? "bg-emerald-500"
                      : barPct >= 60
                        ? "bg-amber-500"
                        : barPct > 0
                          ? "bg-rose-500"
                          : "bg-slate-200";
                  return (
                    <div
                      key={r.repName}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-extrabold shadow-sm",
                          AVATAR_COLORS[i % AVATAR_COLORS.length],
                        )}
                      >
                        {initialsFor(r.repName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {r.repName}
                          </p>
                          <span
                            className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                              r.winRate >= 50
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {r.winRate}% win
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {r.open} open &middot; {r.won} won &middot;{" "}
                          {inr(r.wonValue)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", barColor)}
                              style={{ width: `${Math.min(barPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-400 shrink-0 w-24 text-right">
                            {hasQuota
                              ? `${r.attainmentPct}% of ${inr(r.target!)}`
                              : `${r.winRate}% win rate`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lead & Source Analytics */}
          <div>
            <SectionHeading
              icon={BarChart3}
              title="Lead & Source Analytics"
              tone="brand"
            />
            {/* items-start (not the grid default of stretch) so neither column is force-stretched
                to match the other's height. The left column stacks "Leads by Source" with a Leads
                Trend area chart underneath, mirroring the right column's "Interested vs Not
                Interested" + "Lead Source Performance" stack, so neither side is left as empty
                whitespace next to the other. */}
            <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="space-y-4">
                <ChartCard
                  icon={BarChart3}
                  title="Leads by Source"
                  tone="brand"
                  description={`${leadSourceTotal} lead${leadSourceTotal === 1 ? "" : "s"} across ${leadSourceChart.length} source${leadSourceChart.length === 1 ? "" : "s"} (Leads tab's Lead Source column)`}
                >
                  {leadSourceChart.length === 0 ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No lead sources recorded yet"
                      description="Set a Lead Source on Leads to see this breakdown."
                    />
                  ) : (
                    <HorizontalBarList
                      items={leadSourceChart.map((s) => ({
                        label: s.source,
                        value: s.total,
                      }))}
                      perItemColors={CATEGORY_PALETTE}
                      valueFormatter={(v) =>
                        `${v} · ${leadSourceTotal > 0 ? Math.round((v / leadSourceTotal) * 100) : 0}%`
                      }
                      onItemClick={() =>
                        navigate("/crm/leads", {
                          state: { fromCrmDashboard: true },
                        })
                      }
                    />
                  )}
                </ChartCard>

                <ChartCard
                  icon={TrendingUp}
                  title="Leads Trend"
                  tone="brand"
                  description={
                    leadsTrendChart.points.length > 0
                      ? `${leadsTrendChart.granularityLabel} Total vs Converted leads, from each lead's entry date`
                      : "Lead volume over time"
                  }
                >
                  {leadsTrendChart.points.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="Not enough dated leads yet"
                      description="Once leads have entry dates spanning more than one day, a trend appears here."
                    />
                  ) : (
                    // Two overlaid mountains (Total behind, Converted in front) with deep gradients and a
                    // soft drop-shadow on the whole plot for a layered, dimensional look — taller than a
                    // single-metric area chart so it fills the height next to the two right-column cards
                    // instead of leaving empty space below it.
                    <div className="p-4 h-[27rem]">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        style={{
                          filter:
                            "drop-shadow(0 10px 14px rgba(15,23,42,0.12))",
                        }}
                      >
                        <AreaChart
                          data={leadsTrendChart.points}
                          margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                        >
                          <defs>
                            <linearGradient
                              id="gradLeadsTrendTotal"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#4D9F4B"
                                stopOpacity={0.65}
                              />
                              <stop
                                offset="60%"
                                stopColor="#4D9F4B"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="100%"
                                stopColor="#4D9F4B"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                            <linearGradient
                              id="gradLeadsTrendConverted"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#F59E0B"
                                stopOpacity={0.85}
                              />
                              <stop
                                offset="60%"
                                stopColor="#F59E0B"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="100%"
                                stopColor="#F59E0B"
                                stopOpacity={0.03}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#eef2f6"
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            allowDecimals={false}
                            width={28}
                          />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(v: number, name: string) => [
                              `${v} lead${v === 1 ? "" : "s"}`,
                              name,
                            ]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            name="Total Leads"
                            stroke="#4D9F4B"
                            strokeWidth={2.5}
                            fill="url(#gradLeadsTrendTotal)"
                            dot={{ r: 2.5, fill: "#4D9F4B", strokeWidth: 0 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="converted"
                            name="Converted"
                            stroke="#D97706"
                            strokeWidth={2.5}
                            fill="url(#gradLeadsTrendConverted)"
                            dot={{ r: 2.5, fill: "#D97706", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="space-y-4">
                <ChartCard
                  icon={ThumbsUp}
                  title="Interested vs Not Interested"
                  tone="emerald"
                  description="Current lead pipeline outcome"
                >
                  {buckets.overview.interestedLeads +
                    buckets.overview.notInterestedCount ===
                  0 ? (
                    <EmptyState icon={ThumbsUp} title="No leads yet" />
                  ) : (
                    <>
                      <DonutChart
                        idPrefix="interestedDonut"
                        data={[
                          {
                            name: "Interested",
                            value: buckets.overview.interestedLeads,
                            fill: STATUS_GOOD,
                          },
                          {
                            name: "Not Interested",
                            value: buckets.overview.notInterestedCount,
                            fill: STATUS_CRITICAL,
                          },
                        ]}
                        centerValue={String(
                          buckets.overview.interestedLeads +
                            buckets.overview.notInterestedCount,
                        )}
                        centerLabel="Total Leads"
                      />
                      <div className="flex items-center justify-center gap-4 -mt-1 pb-4 text-xs text-slate-500">
                        <span>
                          Interested Rate{" "}
                          <span className="font-bold text-emerald-600">
                            {Math.round(
                              (buckets.overview.interestedLeads /
                                (buckets.overview.interestedLeads +
                                  buckets.overview.notInterestedCount)) *
                                100,
                            )}
                            %
                          </span>
                        </span>
                        <span>
                          Not Interested Rate{" "}
                          <span className="font-bold text-rose-600">
                            {Math.round(
                              (buckets.overview.notInterestedCount /
                                (buckets.overview.interestedLeads +
                                  buckets.overview.notInterestedCount)) *
                                100,
                            )}
                            %
                          </span>
                        </span>
                      </div>
                    </>
                  )}
                </ChartCard>

                {leadSourceChart.length > 0 && (
                  <ChartCard
                    icon={TrendingUp}
                    title="Lead Source Performance"
                    tone="emerald"
                    description={`${leadSourceConvertedTotal} converted of ${leadSourceTotal} total (${leadSourceTotal > 0 ? Math.round((leadSourceConvertedTotal / leadSourceTotal) * 100) : 0}% overall)`}
                  >
                    <div className="p-4 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={leadSourceChart}
                          margin={{ top: 20, right: 12, left: 0, bottom: 8 }}
                          barCategoryGap="24%"
                          barGap={6}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#eef2f6"
                          />
                          <XAxis
                            dataKey="source"
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            allowDecimals={false}
                            width={28}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(37,99,235,0.06)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0)
                                return null;
                              const row = payload[0].payload as {
                                source: string;
                                total: number;
                                converted: number;
                              };
                              const rate =
                                row.total > 0
                                  ? Math.round(
                                      (row.converted / row.total) * 100,
                                    )
                                  : 0;
                              return (
                                <div
                                  style={{
                                    ...chartTooltipStyle,
                                    background: "#fff",
                                    padding: "8px 12px",
                                    boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
                                  }}
                                >
                                  <p className="font-bold text-slate-700 mb-1">
                                    {row.source}
                                  </p>
                                  <p className="text-slate-500">
                                    Total Leads:{" "}
                                    <span className="font-semibold text-slate-700">
                                      {row.total}
                                    </span>
                                  </p>
                                  <p className="text-slate-500">
                                    Converted:{" "}
                                    <span className="font-semibold text-emerald-600">
                                      {row.converted}
                                    </span>
                                  </p>
                                  <p className="text-slate-500">
                                    Conversion Rate:{" "}
                                    <span className="font-semibold text-slate-700">
                                      {rate}%
                                    </span>
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {/* Each source gets its own color pair — a cool tone for Total Leads, the
                              paired warm tone for Converted (same index in the two palettes) — so bars
                              are attractive and clearly distinct both across sources and between the two
                              metrics, never a `fill="url(#...)"` gradient reference (which silently failed
                              to paint here) and never one flat repeated color for every bar. */}
                          <Bar
                            dataKey="total"
                            name="Total Leads"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={44}
                          >
                            <LabelList
                              dataKey="total"
                              position="top"
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                fill: "#334155",
                              }}
                            />
                            {leadSourceChart.map((entry, i) => (
                              <Cell
                                key={entry.source}
                                fill={
                                  CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
                                }
                              />
                            ))}
                          </Bar>
                          <Bar
                            dataKey="converted"
                            name="Converted"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={44}
                          >
                            <LabelList
                              dataKey="converted"
                              position="top"
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                fill: "#334155",
                              }}
                            />
                            {leadSourceChart.map((entry, i) => (
                              <Cell
                                key={entry.source}
                                fill={
                                  CATEGORY_PALETTE_WARM[
                                    i % CATEGORY_PALETTE_WARM.length
                                  ]
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-4 pb-4 space-y-1.5">
                      {leadSourceChart.map((s, i) => (
                        <div
                          key={s.source}
                          className="flex items-center justify-between gap-2 text-xs text-slate-500"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                background:
                                  CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                              }}
                              aria-hidden
                            />
                            <span className="truncate font-medium text-slate-600">
                              {s.source}
                            </span>
                          </span>
                          <span className="shrink-0">
                            <span className="font-bold text-slate-700">
                              {s.total}
                            </span>{" "}
                            total ·{" "}
                            <span className="font-bold text-emerald-600">
                              {s.converted}
                            </span>{" "}
                            converted ·{" "}
                            {s.total > 0
                              ? Math.round((s.converted / s.total) * 100)
                              : 0}
                            % rate
                          </span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}
              </div>
            </div>
          </div>

          {/* Product / Revenue Insights — CRM Core Domain deal line items joined to WON deals. */}
          <div>
            <SectionHeading
              icon={Package}
              title="Product / Revenue Insights"
              tone="gold"
            />
            {/* Total Revenue (Won), Avg Deal Size and Closed Won are already shown above in
                Sales / Pipeline Overview — not repeated here to avoid duplicate KPI values. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <StatTile
                icon={Package}
                label="Products Sold (Won)"
                value={revenueByProductChart.length}
                tone="orange"
                onClick={() =>
                  navigate("/crm/products", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
              <StatTile
                icon={IndianRupee}
                label="Total Product Revenue"
                value={inr(
                  revenueByProductChart.reduce((sum, p) => sum + p.value, 0),
                )}
                tone="gold"
                onClick={() =>
                  navigate("/crm/products", {
                    state: { fromCrmDashboard: true },
                  })
                }
              />
            </div>
            <ChartCard
              icon={IndianRupee}
              title="Revenue by Product"
              tone="gold"
              description="Won-deal line item value (crm/dealProducts), top 10 products"
            >
              {revenueByProductChart.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No product revenue available"
                  description="Revenue appears once products are added to won deals."
                />
              ) : (
                <div className="p-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueByProductChart}
                      margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                    >
                      <ChartGradient
                        id="gradRevenueByProduct"
                        from="#FCD34D"
                        to="#D97706"
                      />
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eef2f6"
                      />
                      <XAxis
                        dataKey="product"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(v: number) => inr(v)}
                        cursor={{ fill: "rgba(217,119,6,0.08)" }}
                      />
                      <Bar
                        dataKey="value"
                        fill="url(#gradRevenueByProduct)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={40}
                        onClick={() =>
                          navigate("/crm/products", {
                            state: { fromCrmDashboard: true },
                          })
                        }
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Quick Actions */}
          <div>
            <SectionHeading icon={Flame} title="Quick Actions" tone="brand" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              {(
                [
                  {
                    icon: Users,
                    label: "Create Lead",
                    path: "/crm/leads",
                    tone: "purple",
                  },
                  {
                    icon: UserPlus,
                    label: "Create Contact",
                    path: "/crm/contacts",
                    tone: "cyan",
                  },
                  {
                    icon: Building2,
                    label: "Create Account",
                    path: "/crm/accounts",
                    tone: "blue",
                  },
                  {
                    icon: Briefcase,
                    label: "Create Deal",
                    path: "/crm/pipeline",
                    tone: "emerald",
                  },
                  {
                    icon: Package,
                    label: "Create Product",
                    path: "/crm/products",
                    tone: "orange",
                  },
                  {
                    icon: Receipt,
                    label: "Create Quote",
                    path: "/crm/quotes/new",
                    tone: "indigo",
                  },
                  {
                    icon: PhoneCallIcon,
                    label: "Log Activity",
                    path: "/crm/pipeline",
                    tone: "teal",
                  },
                ] as {
                  icon: LucideIcon;
                  label: string;
                  path: string;
                  tone: Tone;
                }[]
              ).map((action) => {
                const v = TILE_STYLE[action.tone];
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() =>
                      navigate(action.path, {
                        state: { fromCrmDashboard: true },
                      })
                    }
                    className={cn(
                      "crm-panel-frame flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                      v.bg,
                    )}
                  >
                    <action.icon
                      className={cn("h-6 w-6", v.text)}
                      strokeWidth={1.75}
                    />
                    <span className="text-xs font-semibold text-slate-600 text-center">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Today's Work */}
          <div>
            <SectionHeading
              icon={CalendarClock}
              title="Today's Work"
              tone="blue"
            />
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <ChartCard
                icon={CalendarClock}
                title="Today's Meetings"
                tone="blue"
                description={`${buckets.todaysMeetings.length} scheduled`}
              >
                {renderList(
                  buckets.todaysMeetings,
                  "No meetings today",
                  "Today",
                  "blue",
                )}
              </ChartCard>
              <ChartCard
                icon={Clock3}
                title="Today's Follow-ups"
                tone="amber"
                description={`${buckets.todaysFollowups.length} due`}
              >
                {renderList(
                  buckets.todaysFollowups,
                  "No follow-ups due today",
                  "Today",
                  "amber",
                )}
              </ChartCard>
              <ChartCard
                icon={PhoneCall}
                title="Today's Callbacks"
                tone="emerald"
                description={`${buckets.todaysCallbacks.length} due`}
              >
                {renderList(
                  buckets.todaysCallbacks,
                  "No callbacks due today",
                  "Today",
                  "emerald",
                )}
              </ChartCard>
              <ChartCard
                icon={ListChecks}
                title="Needs Attention"
                tone="red"
                description={`${buckets.tasksRequiringAttention.length} items`}
              >
                {renderList(
                  buckets.tasksRequiringAttention,
                  "Nothing needs attention",
                  undefined,
                  "red",
                )}
              </ChartCard>
            </div>
          </div>

          {/* Upcoming */}
          <div>
            <SectionHeading
              icon={CalendarDays}
              title="Upcoming"
              tone="indigo"
            />
            <div className="grid md:grid-cols-2 gap-4">
              <ChartCard
                icon={CalendarDays}
                title="Tomorrow's Meetings"
                tone="blue"
                description={`${buckets.tomorrowMeetings.length} scheduled`}
              >
                {renderList(
                  buckets.tomorrowMeetings,
                  "No meetings scheduled for tomorrow",
                  "Tomorrow",
                  "blue",
                )}
              </ChartCard>
              <ChartCard
                icon={Clock3}
                title="Upcoming Follow-ups"
                tone="brand"
                description="Next 7 days"
              >
                {renderList(
                  buckets.upcomingFollowups,
                  "No follow-ups in the next 7 days",
                )}
              </ChartCard>
            </div>
          </div>

          {/* Activity & Follow-up Health — Today's Performance (Overall Data counters) plus
              overall activity completion, from the existing crm/overallData sheet. */}
          <div>
            <SectionHeading
              icon={TrendingUp}
              title="Activity & Follow-up Health"
              tone="cyan"
            />
            {/* Overdue Activities, Pending Follow-ups and Scheduled Meetings are already shown
                above (Executive KPI Summary / Attention & Risk Area) — not repeated here. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <StatTile
                icon={CheckCircle2}
                label="Activities Completed"
                value={buckets.completedActivities}
                tone="emerald"
              />
            </div>
            {overallData.loading ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Loading performance data…
              </div>
            ) : (
              <div className="crm-panel-frame relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50/40 via-white to-emerald-50/30 p-5">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/20 blur-3xl"
                />
                <div className="relative flex items-center justify-between gap-3 mb-4">
                  <p className="text-sm text-slate-500">
                    Daily disposition counters from the Overall Data tab, for
                    today ({overallData.todayDateKey}).
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 shrink-0"
                    onClick={() =>
                      navigate("/crm/overall-data", {
                        state: { fromCrmDashboard: true },
                      })
                    }
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Overall Data
                  </Button>
                </div>
                <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
                  <StatTile
                    icon={Users}
                    label="Accounts Mined"
                    value={overallData.today.accountsMined}
                    tone="purple"
                  />
                  <StatTile
                    icon={Mail}
                    label="Emails Sent"
                    value={overallData.today.emailsSent}
                    tone="blue"
                  />
                  <StatTile
                    icon={PhoneCall}
                    label="Calls Made"
                    value={overallData.today.callsMade}
                    tone="emerald"
                  />
                  <StatTile
                    icon={CalendarClock}
                    label="Meetings Scheduled"
                    value={overallData.today.meetingsScheduled}
                    tone="indigo"
                  />
                  <StatTile
                    icon={CheckCircle2}
                    label="Meetings Completed"
                    value={overallData.today.meetingsCompleted}
                    tone="teal"
                  />
                  <StatTile
                    icon={XCircle}
                    label="Meetings Cancelled"
                    value={overallData.today.meetingsCancelled}
                    tone="rose"
                  />
                </div>
                <div className="relative h-56 bg-white/70 rounded-2xl border border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
                    Daily Activity Trend — last 14 days
                  </p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={overallData.dailyTrend.map((day) => ({
                        label: day.label,
                        accountsMined: day.totals.accountsMined,
                        callsMade: day.totals.callsMade,
                        emailsSent: day.totals.emailsSent,
                      }))}
                      margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                    >
                      <ChartGradient
                        id="gradTrendAccounts"
                        from="#6EE7B7"
                        to="#059669"
                        diagonal
                      />
                      <ChartGradient
                        id="gradTrendCalls"
                        from="#93C5FD"
                        to="#2563EB"
                        diagonal
                      />
                      <ChartGradient
                        id="gradTrendEmails"
                        from="#FCD34D"
                        to="#D97706"
                        diagonal
                      />
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eef2f6"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="accountsMined"
                        name="Accounts Mined"
                        fill="url(#gradTrendAccounts)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={16}
                      />
                      <Bar
                        dataKey="callsMade"
                        name="Calls Made"
                        fill="url(#gradTrendCalls)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={16}
                      />
                      <Bar
                        dataKey="emailsSent"
                        name="Emails Sent"
                        fill="url(#gradTrendEmails)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Attention / Risk Area — every existing risk signal in one place: overdue activities,
              stuck/at-risk deals, missed follow-ups, and pending work. Reuses the calculations
              above; no new risk logic. */}
          <div>
            <SectionHeading
              icon={AlertTriangle}
              title="Attention / Risk Area"
              tone="rose"
            />
            {/* Stuck Deals and Deals at Risk are already shown above in Sales / Pipeline
                Overview — not repeated here to avoid duplicate KPI values. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <StatTile
                icon={AlertTriangle}
                label="Overdue Activities"
                value={buckets.overdueActivities.length}
                tone="red"
              />
              <StatTile
                icon={Clock3}
                label="Missed Follow-ups"
                value={buckets.missedFollowups.length}
                tone="red"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <ChartCard
                icon={AlertTriangle}
                title="Overdue Activities"
                tone="red"
                description={`${buckets.overdueActivities.length} overdue`}
              >
                {renderList(
                  buckets.overdueActivities,
                  "Nothing overdue 🎉",
                  "Overdue",
                  "red",
                )}
              </ChartCard>
              <ChartCard
                icon={ListChecks}
                title="Pending Activities"
                tone="amber"
                description={`${buckets.pendingActivities.length} open`}
              >
                {renderList(buckets.pendingActivities, "No pending activities")}
              </ChartCard>
              <ChartCard
                icon={Clock3}
                title="Missed Follow-ups"
                tone="red"
                description={`${buckets.missedFollowups.length} missed`}
              >
                {renderList(
                  buckets.missedFollowups,
                  "No missed follow-ups",
                  "Overdue",
                  "red",
                )}
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
