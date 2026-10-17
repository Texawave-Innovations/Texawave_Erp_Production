"use client";

// Port of legacy `intelligence/CrmDashboard.tsx` (design, layout and feature set). The data layer is
// the single read-only `/crm/dashboard` endpoint; sections the caller cannot read arrive as `null`
// and are hidden.
import type { CrmDashboard } from "@texawave-erp/api-types";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  Mail,
  Package,
  PhoneCall,
  Percent,
  PieChart as PieChartIcon,
  Receipt,
  Target,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import { withDashboardOrigin } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { useCrmDashboard } from "../hooks";
import { initialsFor, pct } from "../format";
import {
  ActivityList,
  CATEGORY_PALETTE,
  CATEGORY_PALETTE_WARM,
  ChartCard,
  ChartGradient,
  DonutChart,
  EmptyState,
  HorizontalBarList,
  SectionHeading,
  StackedHealthBar,
  StatTile,
  STATUS_AMBER,
  STATUS_BLUE,
  STATUS_CRITICAL,
  STATUS_GOOD,
  TILE_STYLE,
  chartTooltipStyle,
  inr,
  type StatTileTone,
} from "./intelligence-ui";

// Scroll-position restoration (legacy): the position is mirrored into sessionStorage while the
// dashboard is mounted and restored once the real content has rendered.
const DASHBOARD_SCROLL_STORAGE_KEY = "crm-dashboard-scroll-pos";

function getScrollContainer(node: HTMLElement | null): HTMLElement | Window {
  const main = node?.closest("main");
  if (main && main.scrollHeight > main.clientHeight + 1) return main;
  return window;
}

function readScroll(c: HTMLElement | Window): { top: number; left: number } {
  return c instanceof Window
    ? { top: window.scrollY, left: window.scrollX }
    : { top: c.scrollTop, left: c.scrollLeft };
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

const QUICK_ACTIONS: {
  icon: LucideIcon;
  label: string;
  path: string;
  tone: StatTileTone;
}[] = [
  { icon: Users, label: "Create Lead", path: "/crm/leads", tone: "purple" },
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
    icon: PhoneCall,
    label: "Log Activity",
    path: "/crm/pipeline",
    tone: "teal",
  },
];

/** CRM Dashboard: legacy `intelligence/CrmDashboard.tsx`. */
export function CrmDashboardPage() {
  const router = useRouter();
  const query = useCrmDashboard();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);
  // Every dashboard card/button opens its page with the "Back to Dashboard" marker.
  const go = (path: string) => router.push(withDashboardOrigin(path));
  const ready = !query.isLoading && !!query.data;

  useEffect(() => {
    const container = getScrollContainer(rootRef.current);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(
            DASHBOARD_SCROLL_STORAGE_KEY,
            JSON.stringify(readScroll(container)),
          );
        } catch {
          /* storage unavailable */
        }
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready]);

  useLayoutEffect(() => {
    if (scrollRestoredRef.current || !ready) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(DASHBOARD_SCROLL_STORAGE_KEY);
    } catch {
      raw = null;
    }
    scrollRestoredRef.current = true;
    if (!raw) return;
    let saved: { top: number; left: number };
    try {
      saved = JSON.parse(raw) as { top: number; left: number };
    } catch {
      return;
    }
    const container = getScrollContainer(rootRef.current);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: saved.top,
          left: saved.left,
          behavior: "auto",
        });
        try {
          sessionStorage.removeItem(DASHBOARD_SCROLL_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      });
    });
  }, [ready]);

  const d = query.data;

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

      {query.isLoading ? (
        <div
          className="text-center py-16 text-slate-400 text-sm"
          aria-busy="true"
        >
          Loading CRM data…
        </div>
      ) : query.isError || !d ? (
        <div className="crm-panel-frame rounded-3xl bg-white p-10 text-center">
          <AlertTriangle className="h-9 w-9 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-900">
            Could not load the CRM dashboard
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <RevenueTrend d={d} />
          <ExecutiveKpis d={d} go={go} />
          <PipelineOverview d={d} go={go} />
          <TeamPerformance d={d} go={go} />
          <LeadAnalytics d={d} go={go} />
          <ProductInsights d={d} go={go} />
          <QuickActions go={go} />
          <TodaysWork d={d} />
          <Upcoming d={d} />
          <Health d={d} go={go} />
          <AttentionRisk d={d} />
        </>
      )}
    </div>
  );
}

type P = { d: CrmDashboard; go: (path: string) => void };

function RevenueTrend({ d }: { d: CrmDashboard }) {
  const t = d.revenueTrend;
  if (!t) return null;
  const totals = t.totals;
  const empty =
    totals.pipelineCreated + totals.wonRevenue + totals.target === 0;
  return (
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
              {inr(totals.pipelineCreated)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
              Revenue Won
            </p>
            <p className="text-lg font-bold text-emerald-600">
              {inr(totals.wonRevenue)}
            </p>
          </div>
          {totals.target > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                vs Target
              </p>
              <p
                className={cn(
                  "text-lg font-bold",
                  totals.attainmentPct >= 100
                    ? "text-emerald-600"
                    : "text-rose-600",
                )}
              >
                {Math.abs(totals.attainmentPct - 100)}%{" "}
                {totals.attainmentPct >= 100 ? "Over" : "Under"} Target
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="mx-3 mb-3 rounded-2xl bg-white/80 border border-white">
        {empty ? (
          <EmptyState
            icon={TrendingUp}
            title="No revenue activity yet"
            description="This trend appears once deals are created or won."
          />
        ) : (
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={t.months}
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
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradTrendWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient
                    id="gradTrendTarget"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#eef2f6"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v) => inr(Number(v))}
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
                {totals.target > 0 && (
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
  );
}

function ExecutiveKpis({ d, go }: P) {
  const o = d.overview;
  if (!Object.values(o).some((v) => v !== null)) return null;
  const split = [
    { name: "Interested", value: o.interestedLeads ?? 0, fill: STATUS_GOOD },
    {
      name: "Not Interested",
      value: o.notInterestedCount ?? 0,
      fill: STATUS_CRITICAL,
    },
    {
      name: "Pending Follow-ups",
      value: o.pendingFollowUpsCount ?? 0,
      fill: STATUS_AMBER,
    },
    {
      name: "Scheduled Meetings",
      value: o.scheduledMeetingsCount ?? 0,
      fill: STATUS_BLUE,
    },
  ];
  const splitTotal = split.reduce((s, x) => s + x.value, 0);
  const routeOf: Record<string, string> = {
    Interested: "/crm/interested",
    "Not Interested": "/crm/not-interested",
    "Pending Follow-ups": "/crm/keep-in-touch",
    "Scheduled Meetings": "/crm/yet-to-happen",
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-stretch">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {o.totalLeads !== null && (
          <StatTile
            icon={Users}
            label="Total Leads"
            value={o.totalLeads}
            tone="violet"
            onClick={() => go("/crm/leads")}
          />
        )}
        {o.interestedLeads !== null && (
          <StatTile
            icon={ThumbsUp}
            label="Interested Leads"
            value={o.interestedLeads}
            tone="emerald"
            onClick={() => go("/crm/interested")}
          />
        )}
        {o.notInterestedCount !== null && (
          <StatTile
            icon={ThumbsDown}
            label="Not Interested"
            value={o.notInterestedCount}
            tone="rose"
            onClick={() => go("/crm/not-interested")}
          />
        )}
        {o.pendingFollowUpsCount !== null && (
          <StatTile
            icon={Clock3}
            label="Pending Follow-ups"
            value={o.pendingFollowUpsCount}
            tone="amber"
            onClick={() => go("/crm/keep-in-touch")}
          />
        )}
        {o.scheduledMeetingsCount !== null && (
          <StatTile
            icon={CalendarCheck}
            label="Scheduled Meetings"
            value={o.scheduledMeetingsCount}
            tone="sky"
            onClick={() => go("/crm/yet-to-happen")}
          />
        )}
        {o.convertedLeads !== null && (
          <StatTile
            icon={CheckCircle2}
            label="Converted Leads"
            value={o.convertedLeads}
            tone="teal"
            onClick={() => go("/crm/leads")}
          />
        )}
      </div>
      <ChartCard
        icon={PieChartIcon}
        title="Lead Status Split"
        tone="violet"
        description="Interested · Not Interested · Follow-ups · Meetings"
      >
        {splitTotal === 0 ? (
          <EmptyState icon={PieChartIcon} title="No lead activity yet" />
        ) : (
          <DonutChart
            idPrefix="leadStatusSplit"
            data={split}
            centerValue={String(splitTotal)}
            centerLabel="Tracked"
            onSliceClick={(name) => go(routeOf[name] ?? "/crm/leads")}
          />
        )}
      </ChartCard>
    </div>
  );
}

function PipelineOverview({ d, go }: P) {
  const p = d.pipeline;
  if (!p) return null;
  const toPipeline = () => go("/crm/pipeline");
  const outcomeTotal = p.openCount + p.wonCount + p.lostCount;
  const hasStageData = p.stageValue.length > 0;
  const dealHealth = [
    { label: "Healthy", value: p.dealHealth.healthy, color: STATUS_GOOD },
    { label: "Delayed", value: p.dealHealth.delayed, color: STATUS_AMBER },
    { label: "Critical", value: p.dealHealth.critical, color: STATUS_CRITICAL },
  ];
  return (
    <div>
      <SectionHeading
        icon={Briefcase}
        title="Sales / Pipeline Overview"
        tone="indigo"
        action={
          <div className="flex gap-2">
            {d.accountsCount !== null && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs rounded-lg"
                onClick={() => go("/crm/accounts")}
              >
                Accounts
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs rounded-lg"
              onClick={toPipeline}
            >
              Pipeline
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {d.accountsCount !== null && (
          <StatTile
            icon={Building2}
            label="Accounts"
            value={d.accountsCount}
            tone="blue"
            onClick={() => go("/crm/accounts")}
          />
        )}
        <StatTile
          icon={Briefcase}
          label="Open Deals"
          value={p.openCount}
          tone="indigo"
          onClick={toPipeline}
        />
        <StatTile
          icon={IndianRupee}
          label="Open Pipeline Value"
          value={inr(p.openValue)}
          tone="emerald"
          onClick={toPipeline}
        />
        <StatTile
          icon={IndianRupee}
          label="Weighted Pipeline Value"
          value={inr(p.weightedValue)}
          tone="purple"
          onClick={toPipeline}
        />
        <StatTile
          icon={Trophy}
          label="Closed Won"
          value={p.wonCount}
          tone="teal"
          onClick={toPipeline}
        />
        <StatTile
          icon={XCircle}
          label="Closed Lost"
          value={p.lostCount}
          tone="rose"
          onClick={toPipeline}
        />
        <StatTile
          icon={Percent}
          label="Win Rate"
          value={`${p.winRate}%`}
          tone="cyan"
          onClick={toPipeline}
        />
        <StatTile
          icon={IndianRupee}
          label="Total Revenue (Won)"
          value={inr(p.totalRevenue)}
          tone="gold"
          onClick={toPipeline}
        />
        <StatTile
          icon={Flame}
          label="Stuck Deals"
          value={p.stuckCount}
          tone="orange"
          onClick={toPipeline}
        />
        <StatTile
          icon={IndianRupee}
          label="Avg Deal Size"
          value={inr(p.avgDealSize)}
          tone="teal"
          onClick={toPipeline}
        />
        <StatTile
          icon={Clock3}
          label="Avg Sales Cycle"
          value={p.avgSalesCycleDays > 0 ? `${p.avgSalesCycleDays}d` : "—"}
          tone="purple"
          onClick={toPipeline}
        />
        <StatTile
          icon={AlertTriangle}
          label="Deals at Risk"
          value={p.dealsAtRisk}
          tone="rose"
          onClick={toPipeline}
        />
      </div>

      {p.forecastBuckets.bestCase +
        p.forecastBuckets.commit +
        p.forecastBuckets.pipeline >
        0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <StatTile
            icon={Trophy}
            label="Forecast — Best Case"
            value={inr(p.forecastBuckets.bestCase)}
            tone="emerald"
          />
          <StatTile
            icon={CheckCircle2}
            label="Forecast — Commit"
            value={inr(p.forecastBuckets.commit)}
            tone="blue"
          />
          <StatTile
            icon={Briefcase}
            label="Forecast — Pipeline"
            value={inr(p.forecastBuckets.pipeline)}
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
          {!hasStageData ? (
            <EmptyState icon={Briefcase} title="No pipeline deals yet" />
          ) : (
            <div className="p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={p.stageValue}
                  margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eef2f6"
                  />
                  <XAxis
                    dataKey="label"
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
                    formatter={(v) => inr(Number(v))}
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  />
                  <Bar
                    dataKey="value"
                    name="Value"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={40}
                    onClick={toPipeline}
                  >
                    {p.stageValue.map((entry, i) => (
                      <Cell
                        key={entry.stageId}
                        fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}
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
          {outcomeTotal === 0 ? (
            <EmptyState icon={Trophy} title="No opportunities yet" />
          ) : (
            <DonutChart
              idPrefix="dealOutcome"
              data={[
                { name: "Open", value: p.openCount, fill: STATUS_BLUE },
                { name: "Won", value: p.wonCount, fill: STATUS_GOOD },
                { name: "Lost", value: p.lostCount, fill: STATUS_CRITICAL },
              ]}
              centerValue={`${p.winRate}%`}
              centerLabel="Win Rate"
              onSliceClick={toPipeline}
            />
          )}
        </ChartCard>

        <ChartCard
          icon={Target}
          title="Deal Health"
          tone="rose"
          description="Open opportunities by time-in-stage vs SLA"
        >
          {p.openCount === 0 ? (
            <EmptyState icon={Target} title="No open deals yet" />
          ) : (
            <StackedHealthBar segments={dealHealth} onClick={toPipeline} />
          )}
        </ChartCard>

        <ChartCard
          icon={Target}
          title="Stage-Wise Deal Count"
          tone="blue"
          description="Open opportunities per pipeline stage"
        >
          {!hasStageData ? (
            <EmptyState icon={Target} title="No pipeline deals yet" />
          ) : (
            <HorizontalBarList
              items={p.stageValue.map((s) => ({
                label: s.label,
                value: s.count,
              }))}
              color="blue"
              onItemClick={toPipeline}
            />
          )}
        </ChartCard>

        {p.stageDuration.length > 0 && (
          <ChartCard
            icon={Timer}
            title="Avg. Time in Stage"
            tone="blue"
            description="Average days spent in each pipeline stage"
          >
            <HorizontalBarList
              items={p.stageDuration.map((s) => ({
                label: s.label,
                value: s.avgDays,
              }))}
              color="blue"
              valueFormatter={(v) => `${v}d`}
            />
          </ChartCard>
        )}

        {p.dealAging.some((a) => a.count > 0) && (
          <ChartCard
            icon={Timer}
            title="Deal Aging"
            tone="amber"
            description="Open deals bucketed by days since creation"
          >
            <HorizontalBarList
              items={p.dealAging.map((a) => ({
                label: a.bucket,
                value: a.count,
              }))}
              color="amber"
            />
          </ChartCard>
        )}

        {p.lostReasons.length > 0 && (
          <ChartCard
            icon={XCircle}
            title="Lost Analysis"
            tone="red"
            description="Lost opportunities by reason"
          >
            <HorizontalBarList
              items={p.lostReasons.map((r) => ({
                label: r.reason,
                value: r.count,
              }))}
              color="red"
            />
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function TeamPerformance({ d, go }: P) {
  if (!d.team) return null;
  return (
    <div>
      <SectionHeading
        icon={Users}
        title="Team Performance"
        tone="indigo"
        action={
          d.access.quotas ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs rounded-lg"
              onClick={() => go("/crm/quotas")}
            >
              Quotas
            </Button>
          ) : undefined
        }
      />
      {d.team.length === 0 ? (
        <div className="crm-panel-frame rounded-2xl bg-white">
          <EmptyState
            icon={Users}
            title="No opportunities yet"
            description="Team performance appears once deals are logged in Pipeline."
          />
        </div>
      ) : (
        <div className="crm-panel-frame rounded-2xl bg-white divide-y divide-slate-100">
          {d.team.map((r, i) => {
            // With a quota the bar tracks attainment (won value vs target); without one it falls
            // back to win rate (legacy).
            const hasQuota = r.attainmentPct !== null && r.target !== null;
            const barPct = hasQuota ? (r.attainmentPct as number) : r.winRate;
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
                        ? `${r.attainmentPct}% of ${inr(r.target as number)}`
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
  );
}

function LeadAnalytics({ d, go }: P) {
  if (!d.leadSources || !d.leadsTrend) return null;
  const sources = d.leadSources;
  const trend = d.leadsTrend;
  const total = sources.reduce((s, x) => s + x.total, 0);
  const converted = sources.reduce((s, x) => s + x.converted, 0);
  const toLeads = () => go("/crm/leads");
  const o = d.overview;
  const interested = o.interestedLeads ?? 0;
  const notInterested = o.notInterestedCount ?? 0;
  const ni = interested + notInterested;
  return (
    <div>
      <SectionHeading
        icon={BarChart3}
        title="Lead & Source Analytics"
        tone="brand"
      />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <ChartCard
            icon={BarChart3}
            title="Leads by Source"
            tone="brand"
            description={`${total} lead${total === 1 ? "" : "s"} across ${sources.length} source${sources.length === 1 ? "" : "s"} (Leads tab's Lead Source column)`}
          >
            {sources.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No lead sources recorded yet"
                description="Set a Lead Source on Leads to see this breakdown."
              />
            ) : (
              <HorizontalBarList
                items={sources.map((s) => ({
                  label: s.source,
                  value: s.total,
                }))}
                perItemColors={CATEGORY_PALETTE}
                valueFormatter={(v) => `${v} · ${pct(v, total)}%`}
                onItemClick={toLeads}
              />
            )}
          </ChartCard>

          <ChartCard
            icon={TrendingUp}
            title="Leads Trend"
            tone="brand"
            description={
              trend.points.length > 0
                ? `${trend.granularity ?? ""} Total vs Converted leads, from each lead's entry date`
                : "Lead volume over time"
            }
          >
            {trend.points.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Not enough dated leads yet"
                description="Once leads have entry dates spanning more than one day, a trend appears here."
              />
            ) : (
              <div className="p-4 h-[27rem]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  style={{
                    filter: "drop-shadow(0 10px 14px rgba(15,23,42,0.12))",
                  }}
                >
                  <AreaChart
                    data={trend.points}
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
                          stopColor="#2454e8"
                          stopOpacity={0.65}
                        />
                        <stop
                          offset="60%"
                          stopColor="#2454e8"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#2454e8"
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
                      formatter={(v, name) => [
                        `${v} lead${Number(v) === 1 ? "" : "s"}`,
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Leads"
                      stroke="#2454e8"
                      strokeWidth={2.5}
                      fill="url(#gradLeadsTrendTotal)"
                      dot={{ r: 2.5, fill: "#2454e8", strokeWidth: 0 }}
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
          {o.interestedLeads !== null && (
            <ChartCard
              icon={ThumbsUp}
              title="Interested vs Not Interested"
              tone="emerald"
              description="Current lead pipeline outcome"
            >
              {ni === 0 ? (
                <EmptyState icon={ThumbsUp} title="No leads yet" />
              ) : (
                <>
                  <DonutChart
                    idPrefix="interestedDonut"
                    data={[
                      {
                        name: "Interested",
                        value: interested,
                        fill: STATUS_GOOD,
                      },
                      {
                        name: "Not Interested",
                        value: notInterested,
                        fill: STATUS_CRITICAL,
                      },
                    ]}
                    centerValue={String(ni)}
                    centerLabel="Total Leads"
                    onSliceClick={(n) =>
                      go(
                        n === "Interested"
                          ? "/crm/interested"
                          : "/crm/not-interested",
                      )
                    }
                  />
                  <div className="flex items-center justify-center gap-4 -mt-1 pb-4 text-xs text-slate-500">
                    <span>
                      Interested Rate{" "}
                      <span className="font-bold text-emerald-600">
                        {Math.round((interested / ni) * 100)}%
                      </span>
                    </span>
                    <span>
                      Not Interested Rate{" "}
                      <span className="font-bold text-rose-600">
                        {Math.round((notInterested / ni) * 100)}%
                      </span>
                    </span>
                  </div>
                </>
              )}
            </ChartCard>
          )}

          {sources.length > 0 && (
            <ChartCard
              icon={TrendingUp}
              title="Lead Source Performance"
              tone="emerald"
              description={`${converted} converted of ${total} total (${pct(converted, total)}% overall)`}
            >
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sources}
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
                        const row = payload[0]?.payload as {
                          source: string;
                          total: number;
                          converted: number;
                        };
                        const rate = pct(row.converted, row.total);
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
                      {sources.map((entry, i) => (
                        <Cell
                          key={entry.source}
                          fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}
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
                      {sources.map((entry, i) => (
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
                {sources.map((s, i) => (
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
                      converted · {pct(s.converted, s.total)}% rate
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductInsights({ d, go }: P) {
  if (!d.productRevenue) return null;
  const rows = d.productRevenue;
  const toProducts = () => go("/crm/products");
  return (
    <div>
      <SectionHeading
        icon={Package}
        title="Product / Revenue Insights"
        tone="gold"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <StatTile
          icon={Package}
          label="Products Sold (Won)"
          value={rows.length}
          tone="orange"
          onClick={toProducts}
        />
        <StatTile
          icon={IndianRupee}
          label="Total Product Revenue"
          value={inr(rows.reduce((sum, p) => sum + p.value, 0))}
          tone="gold"
          onClick={toProducts}
        />
      </div>
      <ChartCard
        icon={IndianRupee}
        title="Revenue by Product"
        tone="gold"
        description="Won-deal line item value, top 10 products"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No product revenue available"
            description="Revenue appears once products are added to won deals."
          />
        ) : (
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
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
                  formatter={(v) => inr(Number(v))}
                  cursor={{ fill: "rgba(217,119,6,0.08)" }}
                />
                <Bar
                  dataKey="value"
                  name="Revenue"
                  fill="url(#gradRevenueByProduct)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                  onClick={toProducts}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function QuickActions({ go }: { go: (p: string) => void }) {
  return (
    <div>
      <SectionHeading icon={Flame} title="Quick Actions" tone="brand" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {QUICK_ACTIONS.map((action) => {
          const v = TILE_STYLE[action.tone];
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => go(action.path)}
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
  );
}

function TodaysWork({ d }: { d: CrmDashboard }) {
  const w = d.work;
  return (
    <div>
      <SectionHeading icon={CalendarClock} title="Today's Work" tone="blue" />
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChartCard
          icon={CalendarClock}
          title="Today's Meetings"
          tone="blue"
          description={`${w.todaysMeetings.count} scheduled`}
        >
          <ActivityList
            bucket={w.todaysMeetings}
            emptyTitle="No meetings today"
            urgencyLabel="Today"
            urgencyTone="blue"
          />
        </ChartCard>
        <ChartCard
          icon={Clock3}
          title="Today's Follow-ups"
          tone="amber"
          description={`${w.todaysFollowups.count} due`}
        >
          <ActivityList
            bucket={w.todaysFollowups}
            emptyTitle="No follow-ups due today"
            urgencyLabel="Today"
            urgencyTone="amber"
          />
        </ChartCard>
        <ChartCard
          icon={PhoneCall}
          title="Today's Callbacks"
          tone="emerald"
          description={`${w.todaysCallbacks.count} due`}
        >
          <ActivityList
            bucket={w.todaysCallbacks}
            emptyTitle="No callbacks due today"
            urgencyLabel="Today"
            urgencyTone="emerald"
          />
        </ChartCard>
        <ChartCard
          icon={ListChecks}
          title="Needs Attention"
          tone="red"
          description={`${w.needsAttention.count} items`}
        >
          <ActivityList
            bucket={w.needsAttention}
            emptyTitle="Nothing needs attention"
            urgencyTone="red"
          />
        </ChartCard>
      </div>
    </div>
  );
}

function Upcoming({ d }: { d: CrmDashboard }) {
  const w = d.work;
  return (
    <div>
      <SectionHeading icon={CalendarDays} title="Upcoming" tone="indigo" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard
          icon={CalendarDays}
          title="Tomorrow's Meetings"
          tone="blue"
          description={`${w.tomorrowMeetings.count} scheduled`}
        >
          <ActivityList
            bucket={w.tomorrowMeetings}
            emptyTitle="No meetings scheduled for tomorrow"
            urgencyLabel="Tomorrow"
            urgencyTone="blue"
          />
        </ChartCard>
        <ChartCard
          icon={Clock3}
          title="Upcoming Follow-ups"
          tone="brand"
          description="Next 7 days"
        >
          <ActivityList
            bucket={w.upcomingFollowups}
            emptyTitle="No follow-ups in the next 7 days"
          />
        </ChartCard>
      </div>
    </div>
  );
}

function Health({ d, go }: P) {
  const h = d.health;
  if (h.activitiesCompleted === null && !h.today) return null;
  return (
    <div>
      <SectionHeading
        icon={TrendingUp}
        title="Activity & Follow-up Health"
        tone="cyan"
      />
      {h.activitiesCompleted !== null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <StatTile
            icon={CheckCircle2}
            label="Activities Completed"
            value={h.activitiesCompleted}
            tone="emerald"
          />
        </div>
      )}
      {h.today && h.dailyTrend && (
        <div className="crm-panel-frame relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50/40 via-white to-emerald-50/30 p-5">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/20 blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-slate-500">
              Daily disposition counters from the Overall Data tab, for today (
              {h.todayDateKey}).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => go("/crm/overall-data")}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Overall Data
            </Button>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
            <StatTile
              icon={Users}
              label="Accounts Mined"
              value={h.today.accountsMined}
              tone="purple"
            />
            <StatTile
              icon={Mail}
              label="Emails Sent"
              value={h.today.emailsSent}
              tone="blue"
            />
            <StatTile
              icon={PhoneCall}
              label="Calls Made"
              value={h.today.callsMade}
              tone="emerald"
            />
            <StatTile
              icon={CalendarClock}
              label="Meetings Scheduled"
              value={h.today.meetingsScheduled}
              tone="indigo"
            />
            <StatTile
              icon={CheckCircle2}
              label="Meetings Completed"
              value={h.today.meetingsCompleted}
              tone="teal"
            />
            <StatTile
              icon={XCircle}
              label="Meetings Cancelled"
              value={h.today.meetingsCancelled}
              tone="rose"
            />
          </div>
          <div className="relative h-56 bg-white/70 rounded-2xl border border-slate-100 p-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
              Daily Activity Trend — last 14 days
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={h.dailyTrend}
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
  );
}

function AttentionRisk({ d }: { d: CrmDashboard }) {
  const w = d.work;
  return (
    <div>
      <SectionHeading
        icon={AlertTriangle}
        title="Attention / Risk Area"
        tone="rose"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <StatTile
          icon={AlertTriangle}
          label="Overdue Activities"
          value={w.overdue.count}
          tone="red"
        />
        <StatTile
          icon={Clock3}
          label="Missed Follow-ups"
          value={w.missedFollowups.count}
          tone="red"
        />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <ChartCard
          icon={AlertTriangle}
          title="Overdue Activities"
          tone="red"
          description={`${w.overdue.count} overdue`}
        >
          <ActivityList
            bucket={w.overdue}
            emptyTitle="Nothing overdue 🎉"
            urgencyLabel="Overdue"
            urgencyTone="red"
          />
        </ChartCard>
        <ChartCard
          icon={ListChecks}
          title="Pending Activities"
          tone="amber"
          description={`${w.pending.count} open`}
        >
          <ActivityList bucket={w.pending} emptyTitle="No pending activities" />
        </ChartCard>
        <ChartCard
          icon={Clock3}
          title="Missed Follow-ups"
          tone="red"
          description={`${w.missedFollowups.count} missed`}
        >
          <ActivityList
            bucket={w.missedFollowups}
            emptyTitle="No missed follow-ups"
            urgencyLabel="Overdue"
            urgencyTone="red"
          />
        </ChartCard>
      </div>
    </div>
  );
}
