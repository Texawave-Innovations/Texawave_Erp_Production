import { Injectable } from "@nestjs/common";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  OVERALL_ROWS,
  countsFromRecords,
  deriveOverallData,
  monthQueryWindow,
} from "../overall-data/overall-data.derive.js";
import { CrmOverallDataRepository } from "../overall-data/overall-data.repository.js";
import {
  computeQuotaLiveSummary,
  getPeriodBounds,
  type QuotaMetric,
  type QuotaPeriod,
} from "../quotas/quota-attainment.js";
import { CrmQuotasRepository } from "../quotas/quotas.repository.js";
import { holdsRead } from "../shared/crm-read-access.js";
import {
  AGING_BUCKETS,
  addDaysToKey,
  avgDealSize,
  buildLeadsTrend,
  buildRevenueTrend,
  buildTeamRows,
  istDayKeyOf,
  istDayStart,
  lastMonthKeys,
  leadsTrendGranularity,
  mergeLeadSources,
  stageDurationRows,
  stageWiseRows,
  winRate,
} from "./dashboard.metrics.js";
import {
  CrmDashboardRepository,
  type DueWindow,
  type WorkKind,
  type WorkRow,
} from "./dashboard.repository.js";
import type {
  CrmDashboard,
  CrmDashboardAccess,
  CrmDashboardHealth,
  CrmDashboardPipeline,
  CrmDashboardTeamRow,
  CrmDashboardWork,
  CrmDashboardWorkItem,
} from "./dashboard.types.js";

const TREND_MONTHS = 6;
const TREND_DAYS = 14;
const WORK_TAKE = 8;
const DAY_MS = 86400000;

const MONTH_ABBR = [
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

interface Fetched {
  count: number;
  rows: WorkRow[];
}

type OrgScopeLike = { organizationId: number };

@Injectable()
export class CrmDashboardService {
  constructor(
    private readonly repository: CrmDashboardRepository,
    private readonly quotas: CrmQuotasRepository,
    private readonly overallData: CrmOverallDataRepository,
    private readonly permissions: PermissionsService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async getDashboard(now: Date = new Date()): Promise<CrmDashboard> {
    const orgScope = this.tenantContext.getOrgScope();
    const granted = await this.permissions.getPermissionsForUser(
      this.tenantContext.getUserId(),
    );
    const access: CrmDashboardAccess = {
      opportunities: holdsRead(granted, "crm.opportunity.read", true),
      leads: holdsRead(granted, "crm.lead.read", true),
      accounts: holdsRead(granted, "crm.account.read"),
      meetings: holdsRead(granted, "crm.meeting.read"),
      followUps: holdsRead(granted, "crm.followup.read"),
      tasks: holdsRead(granted, "crm.task.read"),
      quotas: holdsRead(granted, "crm.quota.read"),
      overallData: holdsRead(granted, "crm.overalldata.read"),
    };

    const [
      pipelineBundle,
      leadBundle,
      accountStats,
      scheduledMeetings,
      completed,
      work,
      health,
    ] = await Promise.all([
      access.opportunities
        ? this.opportunitySections(orgScope, access, now)
        : null,
      access.leads ? this.leadSections() : null,
      access.accounts ? this.repository.accountStats(orgScope) : null,
      access.meetings ? this.repository.scheduledMeetingsCount(orgScope) : null,
      access.meetings || access.followUps || access.tasks
        ? this.repository.completedCounts(orgScope)
        : null,
      this.workSections(orgScope, access, now),
      this.healthSection(orgScope, access, now),
    ]);

    const activitiesCompleted = completed
      ? (access.meetings ? completed.meetings : 0) +
        (access.followUps ? completed.followUps : 0) +
        (access.tasks ? completed.tasks : 0)
      : null;

    return {
      generatedAt: now.toISOString(),
      access,
      revenueTrend: pipelineBundle?.revenueTrend ?? null,
      overview: {
        totalLeads: leadBundle?.total ?? null,
        convertedLeads: leadBundle?.converted ?? null,
        interestedLeads: accountStats
          ? (accountStats.byTag.get("Interested") ?? 0)
          : null,
        notInterestedCount: accountStats
          ? (accountStats.byTag.get("Not Interested") ?? 0)
          : null,
        pendingFollowUpsCount: accountStats
          ? (accountStats.byTag.get("Keep in Touch") ?? 0)
          : null,
        scheduledMeetingsCount: scheduledMeetings,
      },
      pipeline: pipelineBundle?.pipeline ?? null,
      accountsCount: accountStats?.total ?? null,
      team: pipelineBundle?.team ?? null,
      leadSources: leadBundle?.sources ?? null,
      leadsTrend: leadBundle?.trend ?? null,
      productRevenue: pipelineBundle?.productRevenue ?? null,
      work,
      health: { ...health, activitiesCompleted },
    };
  }

  // ------------------------------------------------------------ opportunities

  private async opportunitySections(
    orgScope: OrgScopeLike,
    access: CrmDashboardAccess,
    now: Date,
  ) {
    const scope = await this.teamContext.resolveScope("crm.opportunity.read");
    const monthKeys = lastMonthKeys(now, TREND_MONTHS);
    const since = istDayStart(`${monthKeys[0]}-01`);

    const [
      stages,
      summary,
      byStage,
      durations,
      lostReasons,
      productRevenue,
      monthly,
      repGroups,
      quotaRows,
    ] = await Promise.all([
      this.repository.findStages(orgScope),
      this.repository.pipelineSummary(scope, now),
      this.repository.openByStage(scope),
      this.repository.avgStageDurationMs(scope, now),
      this.repository.lostReasons(scope),
      this.repository.productRevenue(scope),
      this.repository.revenueByMonth(scope, since),
      this.repository.repStatusGroups(scope),
      access.quotas ? this.quotas.findAllLive(orgScope) : [],
    ]);

    // Quotas come newest-first; legacy `quotas.find` walks oldest-first.
    const quotas = quotaRows
      .map((q) => ({
        repName: q.repName,
        targetAmount: Number(q.targetAmount),
        period: q.period as QuotaPeriod,
        periodKey: q.periodKey,
        metric: q.metric as QuotaMetric,
      }))
      .reverse();

    const targetByMonth = new Map<string, number>();
    for (const q of quotas) {
      if (q.period !== "monthly") continue;
      targetByMonth.set(
        q.periodKey,
        (targetByMonth.get(q.periodKey) ?? 0) + q.targetAmount,
      );
    }
    const revenueTrend = buildRevenueTrend(
      monthKeys,
      monthly.created,
      monthly.won,
      targetByMonth,
    );

    const pipeline: CrmDashboardPipeline = {
      openCount: summary.openCount,
      openValue: summary.openValue,
      weightedValue: summary.weightedValue,
      wonCount: summary.wonCount,
      lostCount: summary.lostCount,
      totalRevenue: summary.revenue,
      winRate: winRate(summary.wonCount, summary.lostCount),
      avgDealSize: avgDealSize(summary.revenue, summary.wonCount),
      avgSalesCycleDays: Math.round(summary.cycleDays ?? 0),
      dealsAtRisk: summary.critical,
      forecastBuckets: {
        bestCase: summary.forecast.bestCase,
        commit: summary.forecast.commit,
        pipeline: summary.forecast.pipeline,
      },
      stuckCount: summary.delayed + summary.critical,
      stageValue: stageWiseRows(
        stages,
        new Map(byStage.map((g) => [g.stageId, g])),
      ),
      dealHealth: {
        healthy: summary.healthy,
        delayed: summary.delayed,
        critical: summary.critical,
      },
      stageDuration: stageDurationRows(
        stages,
        new Map(durations.map((d) => [d.stageId, d.avgMs])),
      ),
      dealAging: AGING_BUCKETS.map((bucket, i) => ({
        bucket,
        count: summary.aging[i] ?? 0,
      })),
      lostReasons: lostReasons.map((r) => ({
        reason: r.reason,
        count: r.count,
      })),
    };

    // Team Performance: legacy attainment (all-time won value / first quota's
    // target) plus the CURRENT-period figure from the shared quota math.
    const teamBase = buildTeamRows(repGroups, quotas);
    const periodDeals = new Map<
      string,
      Awaited<ReturnType<CrmDashboardRepository["wonDealsBetween"]>>
    >();
    const team: CrmDashboardTeamRow[] = [];
    for (const r of teamBase) {
      let quotaLive: CrmDashboardTeamRow["quotaLive"] = null;
      const q = r.quota;
      const bounds = q ? getPeriodBounds(q.period, q.periodKey) : null;
      if (q && bounds) {
        const key = `${q.period}:${q.periodKey}`;
        let deals = periodDeals.get(key);
        if (!deals) {
          // ±1 day margin: the shared math re-checks the exact period.
          deals = await this.repository.wonDealsBetween(
            scope,
            new Date(bounds.start.getTime() - DAY_MS),
            new Date(bounds.end.getTime() + DAY_MS),
          );
          periodDeals.set(key, deals);
        }
        const live = computeQuotaLiveSummary(
          {
            repName: q.repName,
            period: q.period,
            periodKey: q.periodKey,
            targetAmount: q.targetAmount,
            metric: q.metric,
          },
          deals.map((d) => ({
            status: d.status,
            ownerName: d.ownerName,
            wonAt: d.wonAt,
            closingAmount:
              d.closingAmount === null ? null : Number(d.closingAmount),
            estimatedValue: Number(d.estimatedValue),
          })),
          now,
        );
        quotaLive = {
          period: q.period,
          periodKey: q.periodKey,
          status: live.status,
          attainmentPct: live.attainmentPct,
        };
      }
      team.push({
        repName: r.repName,
        won: r.won,
        wonValue: r.wonValue,
        open: r.open,
        lost: r.lost,
        winRate: r.winRate,
        target: r.target,
        attainmentPct: r.attainmentPct,
        quotaLive,
      });
    }

    return {
      revenueTrend,
      pipeline,
      team,
      productRevenue: productRevenue.map((p) => ({
        product: p.product,
        value: p.value,
      })),
    };
  }

  // -------------------------------------------------------------------- leads

  private async leadSections() {
    const scope = await this.teamContext.resolveScope("crm.lead.read");
    const [counts, sourceGroups, bounds] = await Promise.all([
      this.repository.leadCounts(scope),
      this.repository.leadSourceGroups(scope),
      this.repository.leadDayBounds(scope),
    ]);
    let trend: CrmDashboard["leadsTrend"] = { granularity: null, points: [] };
    if (bounds.firstDay && bounds.lastDay && bounds.days >= 2) {
      const span = Math.round(
        (Date.parse(`${bounds.lastDay}T00:00:00Z`) -
          Date.parse(`${bounds.firstDay}T00:00:00Z`)) /
          DAY_MS,
      );
      const buckets = await this.repository.leadTrendBuckets(
        scope,
        leadsTrendGranularity(span),
      );
      trend = buildLeadsTrend(
        bounds.firstDay,
        bounds.lastDay,
        bounds.days,
        buckets,
      );
    }
    return {
      total: counts.total,
      converted: counts.converted,
      sources: mergeLeadSources(sourceGroups),
      trend,
    };
  }

  // --------------------------------------------------------------------- work

  /** Today's Work / Upcoming / Attention buckets over the three due-dated
   * entities (meetings, follow-ups, tasks — what Yet to Happen lists), each
   * only when the caller can read it. Days are IST calendar days. */
  private async workSections(
    orgScope: OrgScopeLike,
    access: CrmDashboardAccess,
    now: Date,
  ): Promise<CrmDashboardWork> {
    const today = istDayKeyOf(now);
    const dayWindow = (
      kind: WorkKind,
      from?: string,
      toExclusive?: string,
    ): DueWindow => {
      const at = (k: string) =>
        kind === "followup" ? istDayStart(k) : new Date(`${k}T00:00:00Z`);
      return {
        ...(from ? { gte: at(from) } : {}),
        ...(toExclusive ? { lt: at(toExclusive) } : {}),
      };
    };
    const allowed = (kind: WorkKind) =>
      kind === "meeting"
        ? access.meetings
        : kind === "followup"
          ? access.followUps
          : access.tasks;

    const callbackIds = access.accounts
      ? await this.repository.callbackAccountIds(orgScope)
      : null;

    const fetchBucket = async (
      kinds: WorkKind[],
      from?: string,
      toExclusive?: string,
      relatedAccountIds?: number[] | null,
    ): Promise<Fetched> => {
      if (relatedAccountIds === null) return { count: 0, rows: [] };
      const parts = await Promise.all(
        kinds
          .filter(allowed)
          .map((k) =>
            this.repository.workItems(
              orgScope,
              k,
              dayWindow(k, from, toExclusive),
              k === "meeting" ? undefined : relatedAccountIds,
            ),
          ),
      );
      const rows = parts
        .flatMap((p) => p.rows)
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      return {
        count: parts.reduce((s, p) => s + p.count, 0),
        rows: rows.slice(0, WORK_TAKE),
      };
    };

    const FOLLOW: WorkKind[] = ["followup", "task"];
    const ALL: WorkKind[] = ["meeting", "followup", "task"];
    const tomorrow = addDaysToKey(today, 1);

    const [
      todaysMeetings,
      todaysFollowups,
      todaysCallbacks,
      tomorrowMeetings,
      upcomingFollowups,
      overdue,
      missedFollowups,
      pending,
    ] = await Promise.all([
      fetchBucket(["meeting"], today, tomorrow),
      fetchBucket(FOLLOW, today, tomorrow),
      fetchBucket(FOLLOW, today, tomorrow, callbackIds),
      fetchBucket(["meeting"], tomorrow, addDaysToKey(today, 2)),
      fetchBucket(FOLLOW, tomorrow, addDaysToKey(today, 8)),
      fetchBucket(ALL, undefined, today),
      fetchBucket(FOLLOW, undefined, today),
      fetchBucket(ALL),
    ]);
    // Legacy `tasksRequiringAttention` = today's meetings + today's follow-ups
    // + overdue, concatenated in that order.
    const needsAttention: Fetched = {
      count: todaysMeetings.count + todaysFollowups.count + overdue.count,
      rows: [
        ...todaysMeetings.rows,
        ...todaysFollowups.rows,
        ...overdue.rows,
      ].slice(0, WORK_TAKE),
    };

    const fetched: Record<keyof CrmDashboardWork, Fetched> = {
      todaysMeetings,
      todaysFollowups,
      todaysCallbacks,
      needsAttention,
      tomorrowMeetings,
      upcomingFollowups,
      overdue,
      missedFollowups,
      pending,
    };

    const relatedKeys = new Map<
      string,
      { relatedType: string; relatedId: number }
    >();
    for (const f of Object.values(fetched)) {
      for (const r of f.rows) {
        relatedKeys.set(`${r.relatedType}:${r.relatedId}`, {
          relatedType: r.relatedType,
          relatedId: r.relatedId,
        });
      }
    }
    const accountOf = access.accounts
      ? await this.repository.resolveAccounts(orgScope, [
          ...relatedKeys.values(),
        ])
      : new Map<string, { id: number; name: string }>();

    const toItem = (r: WorkRow): CrmDashboardWorkItem => {
      const acc = accountOf.get(`${r.relatedType}:${r.relatedId}`);
      return {
        id: `${r.kind}-${r.id}`,
        kind:
          r.kind === "meeting"
            ? "Meeting"
            : r.kind === "followup"
              ? "Follow-up"
              : "Task",
        title: r.title,
        accountId: acc?.id ?? null,
        accountName: acc?.name ?? null,
        dueAt: r.dueAt.toISOString(),
        owner: r.owner,
        href: acc ? `/crm/accounts/${acc.id}` : "/crm/yet-to-happen",
      };
    };
    const out = {} as CrmDashboardWork;
    for (const key of Object.keys(fetched) as (keyof CrmDashboardWork)[]) {
      const f = fetched[key];
      out[key] = { count: f.count, items: f.rows.map(toItem) };
    }
    return out;
  }

  // ------------------------------------------------------------------- health

  /** Today's Performance counters + 14-day trend, derived by the Overall
   * Data tracker's own derivation (same rules, same IST buckets). */
  private async healthSection(
    orgScope: OrgScopeLike,
    access: CrmDashboardAccess,
    now: Date,
  ): Promise<Omit<CrmDashboardHealth, "activitiesCompleted">> {
    const todayDateKey = istDayKeyOf(now);
    if (!access.overallData) {
      return { todayDateKey, today: null, dailyTrend: null };
    }
    const dayKeys = Array.from({ length: TREND_DAYS }, (_, i) =>
      addDaysToKey(todayDateKey, i - (TREND_DAYS - 1)),
    );
    const months = [...new Set(dayKeys.map((k) => k.slice(0, 7)))].map((m) => {
      const [y, mo] = m.split("-").map(Number) as [number, number];
      return { year: y, month: mo };
    });
    const firstMonth = months[0] as { year: number; month: number };
    const lastMonth = months[months.length - 1] as {
      year: number;
      month: number;
    };
    const sources = await this.overallData.loadSources(
      orgScope,
      monthQueryWindow(firstMonth.year, firstMonth.month).from,
      monthQueryWindow(lastMonth.year, lastMonth.month).to,
    );
    const daily: Record<string, Record<string, number>> = {};
    for (const { year, month } of months) {
      const { daily: d } = countsFromRecords(
        deriveOverallData(sources, year, month),
      );
      for (const { key } of OVERALL_ROWS) {
        daily[key] = { ...(daily[key] ?? {}), ...d[key] };
      }
    }
    const at = (row: string, day: string) => daily[row]?.[day] ?? 0;
    return {
      todayDateKey,
      today: {
        accountsMined: at("accountsMined", todayDateKey),
        emailsSent: at("emailsSent", todayDateKey),
        callsMade: at("callsMade", todayDateKey),
        meetingsScheduled: at("meetingsScheduled", todayDateKey),
        meetingsCompleted: at("meetingsCompleted", todayDateKey),
        meetingsCancelled: at("meetingsCancelled", todayDateKey),
      },
      dailyTrend: dayKeys.map((dateKey) => {
        const [, m, d] = dateKey.split("-") as [string, string, string];
        return {
          dateKey,
          label: `${d} ${MONTH_ABBR[Number(m) - 1]}`,
          accountsMined: at("accountsMined", dateKey),
          callsMade: at("callsMade", dateKey),
          emailsSent: at("emailsSent", dateKey),
        };
      }),
    };
  }
}
