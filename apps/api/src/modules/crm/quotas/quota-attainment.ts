/**
 * Pure, dependency-free port of legacy `domain/quotasService.ts`
 * (computeQuotaAttainment / getPeriodBounds / computeQuotaLiveSummary).
 * Attainment is computed on read from WON opportunities, never stored.
 * Imported by the quotas service and (later) the CRM dashboard.
 *
 * Like legacy, calendar math uses the runtime's LOCAL time zone; `now` is
 * injectable so tests are deterministic.
 */

export type QuotaPeriod = "monthly" | "quarterly";
export type QuotaMetric = "revenue" | "closedWonValue" | "dealsWon";
export type QuotaStatus = "Achieved" | "On Track" | "At Risk" | "Behind";

export interface QuotaForAttainment {
  repName: string;
  period: QuotaPeriod;
  periodKey: string;
  targetAmount: number;
  metric: QuotaMetric;
}

export interface OpportunityForAttainment {
  status: string;
  ownerName: string | null;
  wonAt: Date | null;
  closingAmount: number | null;
  estimatedValue: number | null;
}

export interface QuotaLiveSummary {
  target: number;
  achieved: number;
  remaining: number;
  attainmentPct: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  requiredDailyRunRate: number;
  forecast: number;
  status: QuotaStatus;
}

const DAY_MS = 86400000;

export function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentQuarterKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function wonWithinPeriod(
  wonAt: Date,
  period: QuotaPeriod,
  periodKey: string,
): boolean {
  return period === "monthly"
    ? currentMonthKey(wonAt) === periodKey
    : currentQuarterKey(wonAt) === periodKey;
}

/** Sum of Closed Won value (or count for `dealsWon`) credited to the quota's
 * rep within its period. Owner match is trim + case-insensitive. */
export function computeQuotaAttainment(
  quota: QuotaForAttainment,
  opportunities: OpportunityForAttainment[],
): number {
  const targetRep = quota.repName.trim().toLowerCase();
  const wonDeals = opportunities.filter(
    (o) =>
      o.status === "WON" &&
      o.ownerName?.trim().toLowerCase() === targetRep &&
      o.wonAt !== null &&
      wonWithinPeriod(o.wonAt, quota.period, quota.periodKey),
  );
  if (quota.metric === "dealsWon") return wonDeals.length;
  return wonDeals.reduce(
    (sum, o) => sum + (o.closingAmount ?? o.estimatedValue ?? 0),
    0,
  );
}

/** Calendar bounds of a quota period; null for an invalid `periodKey`. */
export function getPeriodBounds(
  period: QuotaPeriod,
  periodKey: string,
): { start: Date; end: Date } | null {
  let start: Date;
  let end: Date;
  if (period === "monthly") {
    if (!/^\d{4}-\d{1,2}$/.test(periodKey)) return null;
    const [y, m] = periodKey.split("-").map(Number) as [number, number];
    if (m < 1 || m > 12) return null;
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 0, 23, 59, 59);
  } else {
    if (!/^\d{4}-Q[1-4]$/.test(periodKey)) return null;
    const [yStr, qStr] = periodKey.split("-Q");
    const y = Number(yStr);
    const q = Number(qStr);
    start = new Date(y, (q - 1) * 3, 1);
    end = new Date(y, q * 3, 0, 23, 59, 59);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

/** Whole days left in the period (card "Days Left"). */
export function daysRemainingInPeriod(
  period: QuotaPeriod,
  periodKey: string,
  now: Date = new Date(),
): number {
  const bounds = getPeriodBounds(period, periodKey);
  if (!bounds) return 0;
  return Math.max(
    0,
    Math.ceil((bounds.end.getTime() - now.getTime()) / DAY_MS),
  );
}

export function computeQuotaLiveSummary(
  quota: QuotaForAttainment,
  opportunities: OpportunityForAttainment[],
  now: Date = new Date(),
): QuotaLiveSummary {
  const achieved = computeQuotaAttainment(quota, opportunities);
  const target = quota.targetAmount;
  const remaining = Math.max(0, target - achieved);
  const attainmentPct = target > 0 ? Math.round((achieved / target) * 100) : 0;
  const bounds = getPeriodBounds(quota.period, quota.periodKey);

  let daysRemaining = 0;
  let daysElapsed = 0;
  let totalDays = 0;
  if (bounds) {
    totalDays = Math.max(
      1,
      Math.round((bounds.end.getTime() - bounds.start.getTime()) / DAY_MS) + 1,
    );
    daysRemaining = Math.max(
      0,
      Math.ceil((bounds.end.getTime() - now.getTime()) / DAY_MS),
    );
    daysElapsed = Math.min(totalDays, Math.max(0, totalDays - daysRemaining));
  }

  const requiredDailyRunRate =
    daysRemaining > 0 ? remaining / daysRemaining : remaining;
  const actualDailyRunRate = daysElapsed > 0 ? achieved / daysElapsed : 0;
  const forecast = daysElapsed > 0 ? actualDailyRunRate * totalDays : achieved;

  let status: QuotaStatus;
  if (target <= 0) {
    status = "On Track";
  } else if (achieved >= target) {
    status = "Achieved";
  } else if (daysRemaining <= 0) {
    status = "Behind";
  } else {
    const expectedPct =
      totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;
    status =
      attainmentPct >= expectedPct
        ? "On Track"
        : attainmentPct >= expectedPct * 0.7
          ? "At Risk"
          : "Behind";
  }

  return {
    target,
    achieved,
    remaining,
    attainmentPct,
    daysRemaining,
    daysElapsed,
    totalDays,
    requiredDailyRunRate,
    forecast,
    status,
  };
}
