/**
 * Pure metric definitions ported from legacy `intelligence/CrmDashboard.tsx`
 * (+ `domain/config.ts`). The SQL in `dashboard.repository.ts` mirrors the
 * same formulas for the bulk aggregation; these functions are the readable,
 * unit-tested statement of each rule and do the final assembly.
 *
 * Month / day bucketing is Asia/Kolkata (like the Overall Data tracker).
 */

const DAY_MS = 86400000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ---- dates (IST) ----------------------------------------------------------

/** yyyy-MM-dd of `d` in IST. */
export function istDayKeyOf(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds whole days to a yyyy-MM-dd key. */
export function addDaysToKey(key: string, days: number): string {
  const t = Date.parse(`${key}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** The instant an IST calendar day starts. */
export function istDayStart(key: string): Date {
  return new Date(Date.parse(`${key}T00:00:00Z`) - IST_OFFSET_MS);
}

/** The last `count` yyyy-MM keys ending with `now`'s IST month (oldest first). */
export function lastMonthKeys(now: Date, count: number): string[] {
  const [y, m] = istDayKeyOf(now).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const idx = y * 12 + (m - 1) - offset;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    return `${yy}-${String(mm).padStart(2, "0")}`;
  });
}

/** "2026-10" -> "Oct 26" (legacy `format(monthStart, 'MMM yy')`). */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-") as [string, string];
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

// ---- headline pipeline metrics ----------------------------------------------

/** Legacy: `won / (won + lost)` rounded, 0 when nothing closed. */
export function winRate(won: number, lost: number): number {
  return won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
}

export function avgDealSize(totalRevenue: number, won: number): number {
  return won > 0 ? Math.round(totalRevenue / won) : 0;
}

export type DealHealth = "Healthy" | "Delayed" | "Critical";

/** Legacy `STUCK_THRESHOLD_DAYS` fallback (no SLA on the stage). */
export const STUCK_THRESHOLD_DAYS = { delayed: 7, critical: 14 } as const;

/** Legacy `computeOpportunityHealth` for an OPEN deal: age in its current
 * stage against the stage SLA. `sla ?? 7` for "delayed", `sla ? sla*2 : 14`
 * for "critical" — a 0 SLA is falsy for the second rule exactly as legacy. */
export function classifyHealth(
  ageDays: number,
  slaDays: number | null | undefined,
): DealHealth {
  const delayed = slaDays ?? STUCK_THRESHOLD_DAYS.delayed;
  const critical = slaDays ? slaDays * 2 : STUCK_THRESHOLD_DAYS.critical;
  if (ageDays >= critical) return "Critical";
  if (ageDays >= delayed) return "Delayed";
  return "Healthy";
}

/** Legacy Deal Aging buckets (open deals, days since creation). */
export const AGING_BUCKETS = [
  "0-7 days",
  "8-14 days",
  "15-30 days",
  "30+ days",
] as const;

export function agingBucket(ageDays: number): (typeof AGING_BUCKETS)[number] {
  if (ageDays <= 7) return "0-7 days";
  if (ageDays <= 14) return "8-14 days";
  if (ageDays <= 30) return "15-30 days";
  return "30+ days";
}

// ---- revenue trend -----------------------------------------------------------

export interface TrendMonth {
  monthKey: string;
  label: string;
  pipelineCreated: number;
  wonRevenue: number;
  target: number;
}

/** Legacy `revenueTrendChart` + `revenueTrendTotals`: per month, the value of
 * every deal created (estimated value, any status), the Closed Won value of
 * deals won (closing amount, else estimated), and the summed monthly quota
 * targets. Totals: attainment = won / target. */
export function buildRevenueTrend(
  monthKeys: string[],
  createdByMonth: ReadonlyMap<string, number>,
  wonByMonth: ReadonlyMap<string, number>,
  targetByMonth: ReadonlyMap<string, number>,
) {
  const months: TrendMonth[] = monthKeys.map((monthKey) => ({
    monthKey,
    label: monthLabel(monthKey),
    pipelineCreated: createdByMonth.get(monthKey) ?? 0,
    wonRevenue: wonByMonth.get(monthKey) ?? 0,
    target: targetByMonth.get(monthKey) ?? 0,
  }));
  const pipelineCreated = months.reduce((s, m) => s + m.pipelineCreated, 0);
  const wonRevenue = months.reduce((s, m) => s + m.wonRevenue, 0);
  const target = months.reduce((s, m) => s + m.target, 0);
  return {
    months,
    totals: {
      pipelineCreated,
      wonRevenue,
      target,
      attainmentPct: target > 0 ? Math.round((wonRevenue / target) * 100) : 0,
    },
  };
}

// ---- stage-wise ----------------------------------------------------------------

export interface StageDef {
  id: number;
  label: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  isOnHold: boolean;
  isActive: boolean;
}

/** Legacy `boardStages`: active, not won/lost/on-hold, by order. */
export function boardStages<T extends StageDef>(stages: T[]): T[] {
  return stages
    .filter((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);
}

/** Stage-Wise Deal Count / Value: one row per board stage (zero when no open
 * deal sits there), from the open-deal groups per stage. */
export function stageWiseRows(
  stages: StageDef[],
  openByStage: ReadonlyMap<number, { count: number; value: number }>,
) {
  return boardStages(stages).map((s) => ({
    stageId: s.id,
    label: s.label,
    count: openByStage.get(s.id)?.count ?? 0,
    value: openByStage.get(s.id)?.value ?? 0,
  }));
}

/** Avg. Time in Stage: only stages with a non-zero average, 1 decimal. */
export function stageDurationRows(
  stages: StageDef[],
  avgMsByStage: ReadonlyMap<number, number>,
) {
  return boardStages(stages)
    .map((s) => {
      const ms = avgMsByStage.get(s.id);
      return {
        stageId: s.id,
        label: s.label,
        avgDays: ms ? Math.round((ms / DAY_MS) * 10) / 10 : 0,
      };
    })
    .filter((d) => d.avgDays > 0);
}

// ---- team performance ------------------------------------------------------------

export interface RepStatusGroup {
  ownerName: string;
  status: string;
  count: number;
  value: number;
}

export interface QuotaLite {
  repName: string;
  targetAmount: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Legacy `teamPerformance`: group by exact owner name, won/open/lost counts,
 * won value, win rate; the rep's FIRST matching quota (trim + case
 * insensitive) supplies the target and attainment is the rep's all-time won
 * value / target. Sorted by won value desc. */
export function buildTeamRows<Q extends QuotaLite>(
  groups: RepStatusGroup[],
  quotas: Q[],
) {
  const reps = new Map<
    string,
    { won: number; wonValue: number; open: number; lost: number }
  >();
  for (const g of groups) {
    const rep = reps.get(g.ownerName) ?? {
      won: 0,
      wonValue: 0,
      open: 0,
      lost: 0,
    };
    if (g.status === "WON") {
      rep.won += g.count;
      rep.wonValue += g.value;
    } else if (g.status === "OPEN") rep.open += g.count;
    else if (g.status === "LOST") rep.lost += g.count;
    reps.set(g.ownerName, rep);
  }
  return Array.from(reps.entries())
    .map(([repName, s]) => {
      const quota = quotas.find((q) => norm(q.repName) === norm(repName));
      return {
        repName,
        ...s,
        winRate: winRate(s.won, s.lost),
        quota: quota ?? null,
        target: quota?.targetAmount ?? null,
        attainmentPct:
          quota && quota.targetAmount > 0
            ? Math.round((s.wonValue / quota.targetAmount) * 100)
            : null,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue);
}

// ---- leads ------------------------------------------------------------------------

/** Legacy Leads by Source: trimmed source, blank sources skipped, sorted by
 * total desc. Raw group rows may differ only by surrounding whitespace, so
 * they are merged after trimming. */
export function mergeLeadSources(
  rows: { source: string | null; total: number; converted: number }[],
) {
  const bySource = new Map<string, { total: number; converted: number }>();
  for (const r of rows) {
    const source = r.source?.trim();
    if (!source) continue;
    const cur = bySource.get(source) ?? { total: 0, converted: 0 };
    bySource.set(source, {
      total: cur.total + r.total,
      converted: cur.converted + r.converted,
    });
  }
  return Array.from(bySource.entries())
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.total - a.total);
}

export type TrendGranularity = "Daily" | "Weekly" | "Monthly";

/** Legacy Leads Trend granularity from the span of the data. */
export function leadsTrendGranularity(spanDays: number): TrendGranularity {
  if (spanDays <= 31) return "Daily";
  if (spanDays <= 180) return "Weekly";
  return "Monthly";
}

/** Monday of the week containing a yyyy-MM-dd key. */
export function weekStartKey(key: string): string {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7));
}

/** Zero-filled bucket sequence between two day keys at a granularity;
 * bucket keys are yyyy-MM-dd (day/week start) or yyyy-MM (month). */
export function bucketKeysBetween(
  firstDay: string,
  lastDay: string,
  granularity: TrendGranularity,
): string[] {
  const out: string[] = [];
  if (granularity === "Daily") {
    for (let k = firstDay; k <= lastDay; k = addDaysToKey(k, 1)) out.push(k);
  } else if (granularity === "Weekly") {
    for (let k = weekStartKey(firstDay); k <= lastDay; k = addDaysToKey(k, 7))
      out.push(k);
  } else {
    const [ly, lm] = lastDay.split("-").map(Number) as [number, number];
    let [y, m] = firstDay.split("-").map(Number) as [number, number];
    while (y < ly || (y === ly && m <= lm)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return out;
}

export function trendLabel(bucketKey: string, g: TrendGranularity): string {
  if (g === "Monthly") return monthLabel(bucketKey);
  const [, m, d] = bucketKey.split("-") as [string, string, string];
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

/** Legacy `leadsTrendChart`: counts are keyed by bucket; empty buckets in the
 * data's range are zero-filled. Needs data on at least 2 distinct days. */
export function buildLeadsTrend(
  firstDay: string | null,
  lastDay: string | null,
  distinctDays: number,
  counts: ReadonlyMap<string, { total: number; converted: number }>,
) {
  if (!firstDay || !lastDay || distinctDays < 2) {
    return { granularity: null, points: [] };
  }
  const spanDays = Math.round(
    (Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) /
      DAY_MS,
  );
  const granularity = leadsTrendGranularity(spanDays);
  const points = bucketKeysBetween(firstDay, lastDay, granularity).map((k) => ({
    label: trendLabel(k, granularity),
    ...(counts.get(k) ?? { total: 0, converted: 0 }),
  }));
  return { granularity, points };
}
