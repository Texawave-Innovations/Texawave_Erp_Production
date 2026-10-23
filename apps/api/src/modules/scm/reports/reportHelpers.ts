// Pure formatting, date-range and generic aggregation helpers shared by every SCM report
// page. Nothing here reads or writes Firebase — see `reportService.ts` for data fetching
// and `calculations/` for the per-domain KPI/chart formulas built on top of these.

import {
  MS_PER_DAY,
  daysBetween,
  formatCurrency,
  parseLocalDate,
  toLocalDateKey,
} from "../shared/format";

export const ALL = "__all__";
export { formatCurrency };

// ---------------------------------------------------------------------------
// Formatters (currency: use `formatCurrency` from `../shared/format`)
// ---------------------------------------------------------------------------

const numberFormat = new Intl.NumberFormat("en-IN");

export const formatNumber = (n: number | null | undefined): string =>
  n == null ? "N/A" : numberFormat.format(n);

/** Percentage formatter for an already-computed 0-100 value; `null` (ambiguous/insufficient
 * data, e.g. a zero denominator) renders as "N/A" rather than a misleading 0% or Infinity. */
export const formatPercent = (
  n: number | null | undefined,
  digits = 1,
): string =>
  n == null || !Number.isFinite(n) ? "N/A" : `${n.toFixed(digits)}%`;

export const formatDays = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "N/A"
    : `${n.toFixed(1)} day${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------------
// Safe math — never fabricate a rate/average from insufficient or zero data
// ---------------------------------------------------------------------------

/** `null` on a zero/invalid denominator instead of `Infinity`/`NaN` — callers render that as
 * "N/A" (spec: never show a misleading rate). */
export function safeDivide(
  numerator: number,
  denominator: number,
): number | null {
  if (!Number.isFinite(numerator) || !denominator) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

export function safeRatePercent(
  numerator: number,
  denominator: number,
): number | null {
  const r = safeDivide(numerator, denominator);
  return r == null ? null : r * 100;
}

export function average(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

/** Average gap in days between two millisecond timestamps across paired records — `null`
 * unless at least `minSamples` valid, non-negative pairs exist, so a single lucky pair never
 * renders as a confident "average". */
export function averageDurationDays(
  pairs: Array<{ from?: number; to?: number }>,
  minSamples = 3,
): number | null {
  const days = pairs
    .filter((p) => p.from != null && p.to != null && p.to >= p.from)
    .map((p) => ((p.to as number) - (p.from as number)) / MS_PER_DAY);
  if (days.length < minSamples) return null;
  return average(days);
}

// ---------------------------------------------------------------------------
// Date range filtering
// ---------------------------------------------------------------------------

export type DatePreset = "today" | "7d" | "30d" | "90d" | "thisYear" | "custom";

export interface DateRange {
  /** Inclusive, `YYYY-MM-DD` (local). Empty string = no lower bound. */
  from: string;
  /** Inclusive, `YYYY-MM-DD` (local). Empty string = no upper bound. */
  to: string;
  preset: DatePreset;
}

export function presetRange(preset: DatePreset): DateRange {
  const now = new Date();
  const end = toLocalDateKey(now);
  switch (preset) {
    case "today":
      return { from: end, to: end, preset };
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toLocalDateKey(d), to: end, preset };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toLocalDateKey(d), to: end, preset };
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      return { from: toLocalDateKey(d), to: end, preset };
    }
    case "thisYear":
      return { from: `${now.getFullYear()}-01-01`, to: end, preset };
    default:
      return { from: "", to: end, preset: "custom" };
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Millisecond timestamp for a ms number, a `YYYY-MM-DD` date (local midnight) or an ISO string. */
export function toTimestamp(value: number | string): number {
  if (typeof value === "number") return value;
  return DATE_ONLY.test(value)
    ? parseLocalDate(value).getTime()
    : new Date(value).getTime();
}

/** Millisecond bounds for a `DateRange`, inclusive of the whole `to` day. `null` bound means
 * unbounded on that side. */
export function rangeBoundsMs(range: DateRange): {
  fromMs: number | null;
  toMs: number | null;
} {
  const fromMs = range.from
    ? new Date(`${range.from}T00:00:00`).getTime()
    : null;
  const toMs = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
  return { fromMs, toMs };
}

/** True if a millisecond/ISO-date timestamp falls inside the range (inclusive). Undefined
 * timestamps never match a bounded range — a record with no date for the field a report is
 * filtering on is excluded rather than silently assumed "in range". */
export function inRange(
  ts: number | string | undefined | null,
  range: DateRange,
): boolean {
  if (ts == null) return !range.from && !range.to;
  const ms = toTimestamp(ts);
  if (!Number.isFinite(ms)) return false;
  const { fromMs, toMs } = rangeBoundsMs(range);
  if (fromMs != null && ms < fromMs) return false;
  if (toMs != null && ms > toMs) return false;
  return true;
}

export type Granularity = "day" | "week" | "month";

/** Daily buckets under ~6 weeks, weekly under a year, monthly beyond — keeps a time-series
 * chart readable regardless of how wide a range the user picks. */
export function pickGranularity(range: DateRange): Granularity {
  if (!range.from || !range.to) return "month";
  const days = daysBetween(
    parseLocalDate(range.from),
    parseLocalDate(range.to),
  );
  if (days <= 45) return "day";
  if (days <= 366) return "week";
  return "month";
}

/** Bucket key + axis label for a timestamp at the given granularity (local calendar dates). */
export function periodKey(
  ms: number,
  granularity: Granularity,
): { key: string; label: string } {
  const d = new Date(ms);
  if (granularity === "day") {
    return {
      key: toLocalDateKey(d),
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    };
  }
  if (granularity === "week") {
    const day = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() - d.getDay(),
    );
    return {
      key: toLocalDateKey(day),
      label: `Wk of ${day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`,
    };
  }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return {
    key,
    label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
  };
}

/** Multi-series variant of `bucketByPeriod`: `add(bucket, item)` increments whichever series
 * fields the item contributes to. Buckets are created from `empty()` and returned in order. */
export function bucketSeriesByPeriod<T, S extends object>(
  items: T[],
  dateOf: (item: T) => number | undefined,
  granularity: Granularity,
  empty: () => S,
  add: (bucket: S, item: T) => void,
): Array<{ period: string; label: string } & S> {
  const buckets = new Map<
    string,
    { label: string; sortMs: number; series: S }
  >();
  for (const item of items) {
    const ms = dateOf(item);
    if (ms == null || !Number.isFinite(ms)) continue;
    const { key, label } = periodKey(ms, granularity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, sortMs: ms, series: empty() };
      buckets.set(key, bucket);
    }
    add(bucket.series, item);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].sortMs - b[1].sortMs)
    .map(([period, v]) => ({ period, label: v.label, ...v.series }));
}

// ---------------------------------------------------------------------------
// Generic aggregation
// ---------------------------------------------------------------------------

/** Builds a chronological time series from any array, bucketed by the range's granularity.
 * `valueOf` defaults to counting records; pass it to sum a numeric field instead. Records
 * without a resolvable date are silently dropped (never plotted as a fake point at 0). */
export function bucketByPeriod<T>(
  items: T[],
  dateOf: (item: T) => number | string | undefined,
  granularity: Granularity,
  valueOf: (item: T) => number = () => 1,
): Array<{ period: string; label: string; value: number }> {
  const buckets = new Map<
    string,
    { label: string; value: number; sortMs: number }
  >();
  for (const item of items) {
    const raw = dateOf(item);
    if (raw == null) continue;
    const ms = toTimestamp(raw);
    if (!Number.isFinite(ms)) continue;
    const { key, label } = periodKey(ms, granularity);
    const existing = buckets.get(key);
    if (existing) existing.value += valueOf(item);
    else buckets.set(key, { label, value: valueOf(item), sortMs: ms });
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].sortMs - b[1].sortMs)
    .map(([period, v]) => ({ period, label: v.label, value: v.value }));
}

/** Joins several `bucketByPeriod` series on their period key (not array index — two series
 * rarely have the same buckets), e.g. `{ shipments, exceptions }` → one row per period with a
 * value per series (0 where a series has no bucket). Period keys sort chronologically. */
export function mergeByPeriod<K extends string>(
  series: Record<K, Array<{ period: string; label: string; value: number }>>,
): Array<{ period: string; label: string } & Record<K, number>> {
  const names = Object.keys(series) as K[];
  const rows = new Map<
    string,
    { period: string; label: string } & Record<K, number>
  >();
  for (const name of names) {
    for (const point of series[name]) {
      let row = rows.get(point.period);
      if (!row) {
        row = {
          period: point.period,
          label: point.label,
          ...Object.fromEntries(names.map((n) => [n, 0])),
        } as { period: string; label: string } & Record<K, number>;
        rows.set(point.period, row);
      }
      (row as Record<K, number>)[name] = point.value;
    }
  }
  return Array.from(rows.values()).sort((a, b) =>
    a.period.localeCompare(b.period),
  );
}

/** Count (or sum) of records grouped by a discrete key — the standard "status distribution"
 * shape used by every domain's donut/bar chart. */
export function groupBy<T>(
  items: T[],
  keyOf: (item: T) => string | undefined,
  valueOf: (item: T) => number = () => 1,
): Array<{ key: string; value: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key == null) continue;
    map.set(key, (map.get(key) || 0) + valueOf(item));
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

/** Top-N records by a numeric value, descending — used by every "Top suppliers / products by
 * X" table and chart. */
export function topN<T>(
  items: T[],
  keyOf: (item: T) => string | undefined,
  labelOf: (item: T) => string,
  valueOf: (item: T) => number,
  n = 10,
): Array<{ key: string; label: string; value: number }> {
  const map = new Map<string, { label: string; value: number }>();
  for (const item of items) {
    const key = keyOf(item);
    if (key == null) continue;
    const existing = map.get(key);
    const v = valueOf(item);
    if (existing) existing.value += v;
    else map.set(key, { label: labelOf(item), value: v });
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Consistent categorical palette reused across every SCM report chart, matching the
 * emerald/blue/amber/red/purple/slate status-tone colors already used throughout the SCM
 * module's badges (`*_STATUS_TONE` maps in each domain's helpers file). */
const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ef4444", // red
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f97316", // orange
  "#64748b", // slate
  "#0ea5e9", // sky
];

export function colorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
