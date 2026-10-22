import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { RepStatusGroup, StageDef } from "./dashboard.metrics.js";

/** Opportunity/Lead own `teamId` + `createdBy` directly (same as their own
 * repositories' SCOPE_FIELDS). */
const SCOPE_FIELDS = { ownerField: "createdBy" };

export type WorkKind = "meeting" | "followup" | "task";

/** Half-open due window; either bound optional. Date-only entities (meeting,
 * task) take UTC-midnight dates, follow-ups take instants. */
export interface DueWindow {
  gte?: Date;
  lt?: Date;
}

export interface WorkRow {
  kind: WorkKind;
  id: number;
  title: string;
  dueAt: Date;
  owner: string | null;
  relatedType: string;
  relatedId: number;
}

export interface PipelineSummaryRow {
  openCount: number;
  openValue: number;
  weightedValue: number;
  wonCount: number;
  lostCount: number;
  revenue: number;
  cycleDays: number | null;
  healthy: number;
  delayed: number;
  critical: number;
  aging: [number, number, number, number];
  /** Open-deal estimated value per forecast category. */
  forecast: { bestCase: number; commit: number; pipeline: number };
}

const OPEN_MEETING_EXCLUDED = ["COMPLETED", "CANCELLED", "NO_SHOW"];
const OPEN_FOLLOWUP = ["PENDING"];
const WORK_TAKE = 8;

/** `timestamp without time zone` columns hold UTC; compare through text so
 * the session time zone can never shift the instant. */
function ts(d: Date): Prisma.Sql {
  return Prisma.sql`${d.toISOString()}::text::timestamp`;
}

/** Local IST wall-clock of a tz-less (UTC) column. */
function ist(col: string): Prisma.Sql {
  return Prisma.raw(
    `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')`,
  );
}

/** Raw-SQL twin of `teamWhere()` for the aggregate queries: org always
 * AND-ed in, then the scope clause; `team` with no teams matches nothing. */
function scopeSql(scope: TeamScope, alias: string): Prisma.Sql {
  const a = Prisma.raw(alias);
  const org = Prisma.sql`${a}.organization_id = ${scope.organizationId}`;
  switch (scope.level) {
    case "all":
      return org;
    case "team":
      return scope.teamIds.length === 0
        ? Prisma.sql`${org} AND FALSE`
        : Prisma.sql`${org} AND ${a}.team_id IN (${Prisma.join(scope.teamIds)})`;
    case "own":
      return Prisma.sql`${org} AND ${a}.created_by = ${scope.userId}`;
    default:
      return Prisma.sql`FALSE`;
  }
}

@Injectable()
export class CrmDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- stages

  @OrgScoped()
  async findStages(scope: OrgScope): Promise<StageDef[]> {
    const rows = await this.prisma.pipelineStage.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: {
        id: true,
        label: true,
        order: true,
        isWon: true,
        isLost: true,
        isOnHold: true,
        isActive: true,
      },
    });
    return rows;
  }

  // ----------------------------------------------------------- opportunities

  /** Headline pipeline numbers in ONE aggregate pass: counts, values,
   * weighted value (`ROUND(est * COALESCE(deal prob, stage prob, 0) / 100)`
   * per deal, as legacy), average sales cycle, deal health (same thresholds
   * as `classifyHealth`) and open-deal aging (same buckets as
   * `agingBucket`). */
  @TeamScoped()
  async pipelineSummary(
    scope: TeamScope,
    now: Date,
  ): Promise<PipelineSummaryRow> {
    const age = (col: string) =>
      Prisma.raw(
        `EXTRACT(EPOCH FROM (CAST(CAST('${now.toISOString()}' AS text) AS timestamp) - ${col})) / 86400.0`,
      );
    const stageAge = age("o.stage_entered_at");
    const createdAge = age("o.created_at");
    const criticalAt = Prisma.sql`(CASE WHEN COALESCE(s.sla_days, 0) <> 0 THEN s.sla_days * 2 ELSE 14 END)`;
    const delayedAt = Prisma.sql`COALESCE(s.sla_days, 7)`;
    const rows = await this.prisma.$queryRaw<
      {
        open_count: number;
        open_value: number;
        weighted_value: number;
        won_count: number;
        lost_count: number;
        revenue: number;
        cycle_days: number | null;
        critical: number;
        delayed: number;
        a1: number;
        a2: number;
        a3: number;
        a4: number;
        f_best: number;
        f_commit: number;
        f_pipeline: number;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE o.status = 'OPEN')::int AS open_count,
        COALESCE(SUM(o.estimated_value) FILTER (WHERE o.status = 'OPEN'), 0)::float8 AS open_value,
        COALESCE(SUM(ROUND(o.estimated_value * COALESCE(o.probability, s.probability, 0) / 100.0))
          FILTER (WHERE o.status = 'OPEN'), 0)::float8 AS weighted_value,
        COUNT(*) FILTER (WHERE o.status = 'WON')::int AS won_count,
        COUNT(*) FILTER (WHERE o.status = 'LOST')::int AS lost_count,
        COALESCE(SUM(COALESCE(o.closing_amount, o.estimated_value))
          FILTER (WHERE o.status = 'WON'), 0)::float8 AS revenue,
        (AVG(EXTRACT(EPOCH FROM (o.won_at - o.created_at)) / 86400.0)
          FILTER (WHERE o.status = 'WON' AND o.won_at IS NOT NULL))::float8 AS cycle_days,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${stageAge} >= ${criticalAt})::int AS critical,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${stageAge} >= ${delayedAt}
          AND ${stageAge} < ${criticalAt})::int AS delayed,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${createdAge} <= 7)::int AS a1,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${createdAge} > 7 AND ${createdAge} <= 14)::int AS a2,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${createdAge} > 14 AND ${createdAge} <= 30)::int AS a3,
        COUNT(*) FILTER (WHERE o.status = 'OPEN' AND ${createdAge} > 30)::int AS a4,
        COALESCE(SUM(o.estimated_value) FILTER (WHERE o.status = 'OPEN' AND o.forecast_category = 'Best Case'), 0)::float8 AS f_best,
        COALESCE(SUM(o.estimated_value) FILTER (WHERE o.status = 'OPEN' AND o.forecast_category = 'Commit'), 0)::float8 AS f_commit,
        COALESCE(SUM(o.estimated_value) FILTER (WHERE o.status = 'OPEN' AND o.forecast_category = 'Pipeline'), 0)::float8 AS f_pipeline
      FROM crm.opportunities o
      JOIN crm.pipeline_stages s ON s.id = o.stage_id
      WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL
    `;
    const r = rows[0];
    const open = r?.open_count ?? 0;
    const critical = r?.critical ?? 0;
    const delayed = r?.delayed ?? 0;
    return {
      openCount: open,
      openValue: r?.open_value ?? 0,
      weightedValue: r?.weighted_value ?? 0,
      wonCount: r?.won_count ?? 0,
      lostCount: r?.lost_count ?? 0,
      revenue: r?.revenue ?? 0,
      cycleDays: r?.cycle_days ?? null,
      healthy: Math.max(0, open - critical - delayed),
      delayed,
      critical,
      aging: [r?.a1 ?? 0, r?.a2 ?? 0, r?.a3 ?? 0, r?.a4 ?? 0],
      forecast: {
        bestCase: r?.f_best ?? 0,
        commit: r?.f_commit ?? 0,
        pipeline: r?.f_pipeline ?? 0,
      },
    };
  }

  /** Open deals per stage (count + estimated value). */
  @TeamScoped()
  async openByStage(
    scope: TeamScope,
  ): Promise<{ stageId: number; count: number; value: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { stage_id: number; count: number; value: number }[]
    >`
      SELECT o.stage_id, COUNT(*)::int AS count,
             COALESCE(SUM(o.estimated_value), 0)::float8 AS value
      FROM crm.opportunities o
      WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL AND o.status = 'OPEN'
      GROUP BY o.stage_id`;
    return rows.map((r) => ({
      stageId: r.stage_id,
      count: r.count,
      value: r.value,
    }));
  }

  /** Pipeline created (all deals, estimated value) and Closed Won value per
   * IST month since `since`. */
  @TeamScoped()
  async revenueByMonth(
    scope: TeamScope,
    since: Date,
  ): Promise<{
    created: Map<string, number>;
    won: Map<string, number>;
  }> {
    const [created, won] = await Promise.all([
      this.prisma.$queryRaw<{ mk: string; v: number }[]>`
        SELECT to_char(${ist("o.created_at")}, 'YYYY-MM') AS mk,
               COALESCE(SUM(o.estimated_value), 0)::float8 AS v
        FROM crm.opportunities o
        WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL
          AND o.created_at >= ${ts(since)}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ mk: string; v: number }[]>`
        SELECT to_char(${ist("o.won_at")}, 'YYYY-MM') AS mk,
               COALESCE(SUM(COALESCE(o.closing_amount, o.estimated_value)), 0)::float8 AS v
        FROM crm.opportunities o
        WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL
          AND o.status = 'WON' AND o.won_at IS NOT NULL AND o.won_at >= ${ts(since)}
        GROUP BY 1`,
    ]);
    return {
      created: new Map(created.map((r) => [r.mk, r.v])),
      won: new Map(won.map((r) => [r.mk, r.v])),
    };
  }

  /** Won/open/lost count and Closed Won value per (owner, status). */
  @TeamScoped()
  async repStatusGroups(scope: TeamScope): Promise<RepStatusGroup[]> {
    const rows = await this.prisma.$queryRaw<
      { owner_name: string; status: string; count: number; value: number }[]
    >`
      SELECT o.owner_name, o.status, COUNT(*)::int AS count,
             COALESCE(SUM(CASE WHEN o.status = 'WON'
               THEN COALESCE(o.closing_amount, o.estimated_value) ELSE 0 END), 0)::float8 AS value
      FROM crm.opportunities o
      WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL
      GROUP BY o.owner_name, o.status`;
    return rows.map((r) => ({
      ownerName: r.owner_name,
      status: r.status,
      count: r.count,
      value: r.value,
    }));
  }

  /** WON deals within a window — input for the shared quota-attainment math. */
  @TeamScoped()
  async wonDealsBetween(scope: TeamScope, from: Date, to: Date) {
    return this.prisma.opportunity.findMany({
      where: teamWhere(
        scope,
        {
          deletedAt: null,
          status: "WON",
          wonAt: { gte: from, lte: to },
        },
        SCOPE_FIELDS,
      ),
      select: {
        status: true,
        ownerName: true,
        wonAt: true,
        closingAmount: true,
        estimatedValue: true,
      },
      take: 5000,
    });
  }

  /** Average time spent in each stage (ms): each history entry lasts until
   * the deal's next entry; a deal's last entry only counts while it is OPEN
   * (until `now`) — legacy `stageDurationChart`. */
  @TeamScoped()
  async avgStageDurationMs(
    scope: TeamScope,
    now: Date,
  ): Promise<{ stageId: number; avgMs: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { stage_id: number; avg_ms: number }[]
    >`
      SELECT t.stage_id, AVG(t.ms)::float8 AS avg_ms
      FROM (
        SELECT h.to_stage_id AS stage_id,
          EXTRACT(EPOCH FROM (
            COALESCE(
              LEAD(h.changed_at) OVER (PARTITION BY h.opportunity_id ORDER BY h.changed_at, h.id),
              CASE WHEN o.status = 'OPEN' THEN ${ts(now)} END
            ) - h.changed_at)) * 1000 AS ms
        FROM crm.opportunity_stage_history h
        JOIN crm.opportunities o ON o.id = h.opportunity_id
        WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL
      ) t
      WHERE t.ms IS NOT NULL
      GROUP BY t.stage_id`;
    return rows.map((r) => ({ stageId: r.stage_id, avgMs: r.avg_ms }));
  }

  @TeamScoped()
  async lostReasons(
    scope: TeamScope,
  ): Promise<{ reason: string; count: number }[]> {
    return this.prisma.$queryRaw<{ reason: string; count: number }[]>`
      SELECT COALESCE(NULLIF(o.lost_reason, ''), 'Other') AS reason, COUNT(*)::int AS count
      FROM crm.opportunities o
      WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL AND o.status = 'LOST'
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC`;
  }

  /** Top-10 product line-item revenue of WON deals (snapshot product name). */
  @TeamScoped()
  async productRevenue(
    scope: TeamScope,
  ): Promise<{ product: string; value: number }[]> {
    return this.prisma.$queryRaw<{ product: string; value: number }[]>`
      SELECT op.product_name AS product, COALESCE(SUM(op.total), 0)::float8 AS value
      FROM crm.opportunity_products op
      JOIN crm.opportunities o ON o.id = op.opportunity_id
      WHERE ${scopeSql(scope, "o")} AND o.deleted_at IS NULL AND o.status = 'WON'
        AND op.deleted_at IS NULL
      GROUP BY op.product_name
      ORDER BY 2 DESC, 1 ASC
      LIMIT 10`;
  }

  // ------------------------------------------------------------------- leads

  @TeamScoped()
  async leadCounts(scope: TeamScope) {
    const where = teamWhere(scope, { deletedAt: null }, SCOPE_FIELDS);
    const [total, converted] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({
        where: teamWhere(
          scope,
          { deletedAt: null, linkedAccountId: { not: null } },
          SCOPE_FIELDS,
        ),
      }),
    ]);
    return { total, converted };
  }

  /** Lead Source: total + Converted (`linkedAccountId` set, not the editable
   * lead-status text) per source value. */
  @TeamScoped()
  async leadSourceGroups(scope: TeamScope) {
    const rows = await this.prisma.$queryRaw<
      { source: string; total: number; converted: number }[]
    >`
      SELECT l.lead_source AS source, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE l.linked_account_id IS NOT NULL)::int AS converted
      FROM crm.leads l
      WHERE ${scopeSql(scope, "l")} AND l.deleted_at IS NULL AND l.lead_source IS NOT NULL
      GROUP BY l.lead_source`;
    return rows;
  }

  /** First/last IST creation day and the number of distinct days. */
  @TeamScoped()
  async leadDayBounds(scope: TeamScope) {
    const rows = await this.prisma.$queryRaw<
      { first_day: string | null; last_day: string | null; days: number }[]
    >`
      SELECT to_char(MIN(${ist("l.created_at")}), 'YYYY-MM-DD') AS first_day,
             to_char(MAX(${ist("l.created_at")}), 'YYYY-MM-DD') AS last_day,
             COUNT(DISTINCT to_char(${ist("l.created_at")}, 'YYYY-MM-DD'))::int AS days
      FROM crm.leads l
      WHERE ${scopeSql(scope, "l")} AND l.deleted_at IS NULL`;
    const r = rows[0];
    return {
      firstDay: r?.first_day ?? null,
      lastDay: r?.last_day ?? null,
      days: r?.days ?? 0,
    };
  }

  @TeamScoped()
  async leadTrendBuckets(
    scope: TeamScope,
    granularity: "Daily" | "Weekly" | "Monthly",
  ) {
    const bucket =
      granularity === "Daily"
        ? Prisma.sql`to_char(${ist("l.created_at")}, 'YYYY-MM-DD')`
        : granularity === "Weekly"
          ? Prisma.sql`to_char(date_trunc('week', ${ist("l.created_at")}), 'YYYY-MM-DD')`
          : Prisma.sql`to_char(${ist("l.created_at")}, 'YYYY-MM')`;
    const rows = await this.prisma.$queryRaw<
      { k: string; total: number; converted: number }[]
    >`
      SELECT ${bucket} AS k, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE l.linked_account_id IS NOT NULL)::int AS converted
      FROM crm.leads l
      WHERE ${scopeSql(scope, "l")} AND l.deleted_at IS NULL
      GROUP BY 1`;
    return new Map(
      rows.map((r) => [r.k, { total: r.total, converted: r.converted }]),
    );
  }

  // -------------------------------------------------------- org-wide entities

  @OrgScoped()
  async accountStats(scope: OrgScope) {
    const base = { organizationId: scope.organizationId, deletedAt: null };
    const [total, byTag] = await Promise.all([
      this.prisma.account.count({ where: base }),
      this.prisma.account.groupBy({
        by: ["statusTag"],
        where: { ...base, statusTag: { not: null } },
        _count: { _all: true },
      }),
    ]);
    return {
      total,
      byTag: new Map(byTag.map((g) => [g.statusTag as string, g._count._all])),
    };
  }

  /** Account ids currently tagged Call Back / Send Info (the legacy "Call
   * Back-Send Info" queue) — bounded. */
  @OrgScoped()
  async callbackAccountIds(scope: OrgScope): Promise<number[]> {
    const rows = await this.prisma.account.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        statusTag: { in: ["Call Back", "Send Info"] },
      },
      select: { id: true },
      take: 5000,
    });
    return rows.map((r) => r.id);
  }

  @OrgScoped()
  async scheduledMeetingsCount(scope: OrgScope) {
    return this.prisma.crmMeeting.count({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: { notIn: OPEN_MEETING_EXCLUDED },
      },
    });
  }

  /** Meetings + follow-ups + tasks completed (Activities Completed tile). */
  @OrgScoped()
  async completedCounts(scope: OrgScope) {
    const org = { organizationId: scope.organizationId, deletedAt: null };
    const [meetings, followUps, tasks] = await Promise.all([
      this.prisma.crmMeeting.count({
        where: { ...org, status: "COMPLETED" },
      }),
      this.prisma.crmFollowUp.count({
        where: { ...org, status: "COMPLETED" },
      }),
      this.prisma.crmTask.count({ where: { ...org, status: "Completed" } }),
    ]);
    return { meetings, followUps, tasks };
  }

  /** Count + nearest-due 8 open items of one kind inside a due window.
   * `relatedAccountIds` narrows follow-ups/tasks to those attached to the
   * given accounts (callbacks). */
  @OrgScoped()
  async workItems(
    scope: OrgScope,
    kind: WorkKind,
    window: DueWindow,
    relatedAccountIds?: number[],
  ): Promise<{ count: number; rows: WorkRow[] }> {
    const org = { organizationId: scope.organizationId, deletedAt: null };
    const due = (field: string) =>
      window.gte || window.lt
        ? {
            [field]: {
              ...(window.gte ? { gte: window.gte } : {}),
              ...(window.lt ? { lt: window.lt } : {}),
            },
          }
        : {};
    const related =
      relatedAccountIds === undefined
        ? {}
        : { relatedType: "account", relatedId: { in: relatedAccountIds } };

    if (kind === "meeting") {
      const where = {
        ...org,
        status: { notIn: OPEN_MEETING_EXCLUDED },
        ...due("meetingDate"),
      };
      const [count, rows] = await Promise.all([
        this.prisma.crmMeeting.count({ where }),
        this.prisma.crmMeeting.findMany({
          where,
          orderBy: [{ meetingDate: "asc" }, { id: "asc" }],
          take: WORK_TAKE,
        }),
      ]);
      return {
        count,
        rows: rows.map((m) => ({
          kind,
          id: m.id,
          title: m.agenda?.trim() || `${m.mode} meeting`,
          dueAt: m.meetingDate,
          owner: null,
          relatedType: m.relatedType,
          relatedId: m.relatedId,
        })),
      };
    }
    if (kind === "followup") {
      const where = {
        ...org,
        status: { in: OPEN_FOLLOWUP },
        ...due("scheduledAt"),
        ...related,
      };
      const [count, rows] = await Promise.all([
        this.prisma.crmFollowUp.count({ where }),
        this.prisma.crmFollowUp.findMany({
          where,
          orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
          take: WORK_TAKE,
        }),
      ]);
      return {
        count,
        rows: rows.map((f) => ({
          kind,
          id: f.id,
          title: `${f.type} follow-up`,
          dueAt: f.scheduledAt,
          owner: f.assignedTo,
          relatedType: f.relatedType,
          relatedId: f.relatedId,
        })),
      };
    }
    const where = {
      ...org,
      status: "Open",
      ...due("dueDate"),
      ...related,
    };
    const [count, rows] = await Promise.all([
      this.prisma.crmTask.count({ where }),
      this.prisma.crmTask.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: WORK_TAKE,
      }),
    ]);
    return {
      count,
      rows: rows.map((t) => ({
        kind,
        id: t.id,
        title: t.title,
        dueAt: t.dueDate,
        owner: t.assignedTo,
        relatedType: t.relatedType,
        relatedId: t.relatedId,
      })),
    };
  }

  /** Resolve the owning Account (id + name) of polymorphic related rows. */
  @OrgScoped()
  async resolveAccounts(
    scope: OrgScope,
    related: { relatedType: string; relatedId: number }[],
  ): Promise<Map<string, { id: number; name: string }>> {
    const org = scope.organizationId;
    const ids = (t: string) => [
      ...new Set(
        related.filter((r) => r.relatedType === t).map((r) => r.relatedId),
      ),
    ];
    const [contacts, opps, leads] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId: org, id: { in: ids("contact") } },
        select: { id: true, accountId: true },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId: org, id: { in: ids("opportunity") } },
        select: { id: true, accountId: true },
      }),
      this.prisma.lead.findMany({
        where: { organizationId: org, id: { in: ids("lead") } },
        select: { id: true, linkedAccountId: true },
      }),
    ]);
    const viaContact = new Map(contacts.map((c) => [c.id, c.accountId]));
    const viaOpp = new Map(opps.map((o) => [o.id, o.accountId]));
    const viaLead = new Map(leads.map((l) => [l.id, l.linkedAccountId]));
    const accountIdOf = (r: {
      relatedType: string;
      relatedId: number;
    }): number | undefined | null => {
      switch (r.relatedType) {
        case "account":
          return r.relatedId;
        case "contact":
          return viaContact.get(r.relatedId);
        case "opportunity":
          return viaOpp.get(r.relatedId);
        case "lead":
          return viaLead.get(r.relatedId);
        default:
          return undefined;
      }
    };
    const accountIds = [
      ...new Set(
        related
          .map(accountIdOf)
          .filter((v): v is number => typeof v === "number"),
      ),
    ];
    const accounts = await this.prisma.account.findMany({
      where: { organizationId: org, id: { in: accountIds } },
      select: { id: true, name: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const out = new Map<string, { id: number; name: string }>();
    for (const r of related) {
      const aid = accountIdOf(r);
      const acc = typeof aid === "number" ? byId.get(aid) : undefined;
      if (acc) out.set(`${r.relatedType}:${r.relatedId}`, acc);
    }
    return out;
  }
}
