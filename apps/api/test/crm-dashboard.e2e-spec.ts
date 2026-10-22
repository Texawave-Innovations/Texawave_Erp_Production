import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { currentMonthKey } from "../src/modules/crm/quotas/quota-attainment.js";
import {
  addDaysToKey,
  istDayKeyOf,
  istDayStart,
} from "../src/modules/crm/dashboard/dashboard.metrics.js";
import type { CrmDashboard } from "../src/modules/crm/dashboard/dashboard.types.js";

/** CRM Dashboard (legacy intelligence/CrmDashboard.tsx): seeded data ->
 * exact numbers, per-entity permission filtering (a section is built only
 * from entities the caller may read, rows narrowed by own/team/all scope),
 * and tenant isolation. */
describe("crm dashboard (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenFull: string;
  let tokenOwn: string;
  let tokenBare: string;
  let tokenNoPerm: string;
  let tokenB: string;

  const today = istDayKeyOf(new Date());
  const day = (offset: number) => addDaysToKey(today, offset);
  /** Date-only columns (meeting / task). */
  const dateOnly = (offset: number) => new Date(`${day(offset)}T00:00:00Z`);
  /** Follow-up instant: 10:00 IST of the day. */
  const at10 = (offset: number) =>
    new Date(istDayStart(day(offset)).getTime() + 10 * 3600 * 1000);
  const DAY_MS = 86400000;

  async function get(token?: string) {
    const req = request(app.getHttpServer()).get("/crm/dashboard");
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req;
  }
  async function dash(token: string): Promise<CrmDashboard> {
    const res = await get(token);
    expect(res.status).toBe(200);
    return (res.body as { data: CrmDashboard }).data;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);
    orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `crm-dash-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-dash-b-${suffix}` },
    });

    const perms = new Map<string, number>();
    async function permission(code: string) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perms.set(code, p.id);
      return p.id;
    }
    const FULL = [
      "crm.dashboard.read",
      "crm.opportunity.read.all",
      "crm.lead.read.all",
      "crm.account.read",
      "crm.meeting.read",
      "crm.followup.read",
      "crm.task.read",
      "crm.quota.read",
      "crm.overalldata.read",
    ];
    const OWN = [
      "crm.dashboard.read",
      "crm.opportunity.read.own",
      "crm.lead.read.own",
    ];
    for (const c of [...FULL, ...OWN]) await permission(c);

    async function makeUser(orgId: number, email: string, codes: string[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perms.get(c) as number,
        })),
      });
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Test User",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }
    const full = await makeUser(orgA.id, "full@crm-dash-a.test", FULL);
    const own = await makeUser(orgA.id, "own@crm-dash-a.test", OWN);
    await makeUser(orgA.id, "bare@crm-dash-a.test", ["crm.dashboard.read"]);
    await permission("crm.contact.read");
    await makeUser(orgA.id, "noperm@crm-dash-a.test", ["crm.contact.read"]);
    await makeUser(orgB.id, "full@crm-dash-b.test", FULL);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenFull = await login(orgA.slug, "full@crm-dash-a.test");
    tokenOwn = await login(orgA.slug, "own@crm-dash-a.test");
    tokenBare = await login(orgA.slug, "bare@crm-dash-a.test");
    tokenNoPerm = await login(orgA.slug, "noperm@crm-dash-a.test");
    tokenB = await login(orgB.slug, "full@crm-dash-b.test");

    // ---- accounts (status tags) ------------------------------------------
    const mk = (name: string, statusTag?: string) =>
      prisma.account.create({
        data: {
          organizationId: orgA.id,
          name,
          ...(statusTag ? { statusTag } : {}),
        },
      });
    const a1 = await mk("Acme Interested", "Interested");
    await mk("Beta Interested", "Interested");
    await mk("Gamma Not Interested", "Not Interested");
    await mk("Delta Keep", "Keep in Touch");
    const a5 = await mk("Epsilon Callback", "Call Back");
    await mk("Zeta Untagged");

    // ---- pipeline ---------------------------------------------------------
    const stage = (
      code: string,
      order: number,
      extra: Record<string, unknown>,
    ) =>
      prisma.pipelineStage.create({
        data: {
          organizationId: orgA.id,
          code,
          label: code,
          order,
          ...extra,
        },
      });
    const sQual = await stage("Qualify", 1, { probability: 20, slaDays: 7 });
    const sProp = await stage("Proposal", 2, { probability: 50 });
    const sWon = await stage("Won", 3, { isWon: true });
    const sLost = await stage("Lost", 4, { isLost: true });

    const opp = (n: number, stageId: number, data: Record<string, unknown>) =>
      prisma.opportunity.create({
        data: {
          organizationId: orgA.id,
          accountId: a1.id,
          opportunityNumber: `OPP-DASH-${n}`,
          title: `Deal ${n}`,
          stageId,
          createdBy: full.id,
          ...data,
        } as never,
      });
    const now = new Date();
    await opp(1, sQual.id, {
      ownerName: "Asha Rao",
      estimatedValue: 1000,
      forecastCategory: "Commit",
    });
    await opp(2, sProp.id, {
      ownerName: "Asha Rao",
      estimatedValue: 3000,
      forecastCategory: "Best Case",
      probability: 10,
      stageEnteredAt: new Date(now.getTime() - 20 * DAY_MS),
      createdAt: new Date(now.getTime() - 20 * DAY_MS),
    });
    const won = await opp(3, sWon.id, {
      ownerName: "Asha Rao",
      status: "WON",
      estimatedValue: 500,
      closingAmount: 800,
      wonAt: now,
    });
    await opp(4, sLost.id, {
      ownerName: "Bob",
      status: "LOST",
      estimatedValue: 700,
      lostReason: "Price",
    });
    await opp(5, sQual.id, {
      ownerName: "Bob",
      estimatedValue: 200,
      forecastCategory: "Pipeline",
      createdBy: own.id,
    });
    const open1 = await prisma.opportunity.findFirstOrThrow({
      where: { organizationId: orgA.id, opportunityNumber: "OPP-DASH-1" },
    });
    const product = await prisma.product.create({
      data: { organizationId: orgA.id, name: "Widget", code: "W-1" },
    });
    const line = (oppId: number, total: number) => ({
      organizationId: orgA.id,
      opportunityId: oppId,
      productId: product.id,
      productName: "Widget",
      quantity: 1,
      unitPrice: total,
      total,
    });
    await prisma.opportunityProduct.createMany({
      data: [line(won.id, 800), line(open1.id, 999)],
    });
    await prisma.crmQuota.create({
      data: {
        organizationId: orgA.id,
        repName: "asha rao",
        period: "monthly",
        periodKey: currentMonthKey(),
        targetAmount: 2000,
        metric: "closedWonValue",
      },
    });

    // ---- leads -------------------------------------------------------------
    const lead = (n: number, data: Record<string, unknown>) =>
      prisma.lead.create({
        data: {
          organizationId: orgA.id,
          companyName: `Lead Co ${n}`,
          prospectName: `Prospect ${n}`,
          createdBy: full.id,
          ...data,
        } as never,
      });
    await lead(1, { leadSource: "Web", linkedAccountId: a1.id });
    await lead(2, { leadSource: " Web " });
    await lead(3, { leadSource: "Referral" });
    await lead(4, {});
    await lead(5, { leadSource: "Web", createdBy: own.id });

    // ---- work items ----------------------------------------------------------
    const rel = { organizationId: orgA.id, relatedType: "account" };
    const meeting = (offset: number, status: string, relatedId = a1.id) => ({
      ...rel,
      relatedId,
      meetingDate: dateOnly(offset),
      status,
      agenda: `Meeting ${offset} ${status}`,
    });
    await prisma.crmMeeting.createMany({
      data: [
        meeting(0, "REQUESTED"),
        meeting(0, "CANCELLED"),
        meeting(1, "REQUESTED"),
        meeting(-1, "REQUESTED"),
        meeting(-1, "COMPLETED"),
      ],
    });
    const followUp = (offset: number, status: string, relatedId: number) => ({
      ...rel,
      relatedId,
      type: "Call",
      scheduledAt: at10(offset),
      assignedTo: "Asha Rao",
      status,
    });
    await prisma.crmFollowUp.createMany({
      data: [
        followUp(0, "PENDING", a5.id),
        followUp(0, "PENDING", a1.id),
        followUp(3, "PENDING", a1.id),
        followUp(-1, "PENDING", a1.id),
        followUp(-1, "COMPLETED", a1.id),
      ],
    });
    const task = (offset: number, status: string) => ({
      ...rel,
      relatedId: a1.id,
      title: `Task ${offset} ${status}`,
      dueDate: dateOnly(offset),
      assignedTo: "Asha Rao",
      status,
    });
    await prisma.crmTask.createMany({
      data: [task(0, "Open"), task(-2, "Open"), task(-2, "Completed")],
    });
  });

  afterAll(async () => {
    const ids = [orgA.id, orgB.id];
    const where = { organizationId: { in: ids } };
    await prisma.crmTask.deleteMany({ where });
    await prisma.crmFollowUp.deleteMany({ where });
    await prisma.crmMeeting.deleteMany({ where });
    await prisma.opportunityProduct.deleteMany({ where });
    await prisma.crmQuota.deleteMany({ where });
    await prisma.lead.deleteMany({ where });
    await prisma.opportunityStageHistory.deleteMany({
      where: { opportunity: where },
    });
    await prisma.opportunity.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.pipelineStage.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await app.close();
  });

  describe("auth", () => {
    it("401 without a token", async () => {
      expect((await get()).status).toBe(401);
    });
    it("403 without crm.dashboard.read", async () => {
      expect((await get(tokenNoPerm)).status).toBe(403);
    });
  });

  describe("seeded numbers (full access)", () => {
    let d: CrmDashboard;
    beforeAll(async () => {
      d = await dash(tokenFull);
    });

    it("reports every section as accessible", () => {
      expect(d.access).toEqual({
        opportunities: true,
        leads: true,
        accounts: true,
        meetings: true,
        followUps: true,
        tasks: true,
        quotas: true,
        overallData: true,
      });
    });

    it("KPI tiles: leads + account status tags + scheduled meetings", () => {
      expect(d.overview).toEqual({
        totalLeads: 5,
        convertedLeads: 1,
        interestedLeads: 2,
        notInterestedCount: 1,
        pendingFollowUpsCount: 1,
        // REQUESTED today, tomorrow, yesterday (cancelled/completed excluded)
        scheduledMeetingsCount: 3,
      });
      expect(d.accountsCount).toBe(6);
    });

    it("pipeline overview numbers", () => {
      const p = d.pipeline;
      expect(p).not.toBeNull();
      expect(p).toMatchObject({
        openCount: 3,
        openValue: 4200,
        // 1000*20% + 3000*10% (deal probability wins) + 200*20%
        weightedValue: 540,
        wonCount: 1,
        lostCount: 1,
        totalRevenue: 800,
        winRate: 50,
        avgDealSize: 800,
        dealsAtRisk: 1,
        forecastBuckets: { bestCase: 3000, commit: 1000, pipeline: 200 },
        stuckCount: 1,
        dealHealth: { healthy: 2, delayed: 0, critical: 1 },
        lostReasons: [{ reason: "Price", count: 1 }],
      });
      expect(
        p?.stageValue.map(({ label, count, value }) => ({
          label,
          count,
          value,
        })),
      ).toEqual([
        { label: "Qualify", count: 2, value: 1200 },
        { label: "Proposal", count: 1, value: 3000 },
      ]);
      expect(p?.dealAging.map((a) => a.count)).toEqual([2, 0, 1, 0]);
    });

    it("revenue trend: 6 months, totals and attainment vs monthly quota", () => {
      const t = d.revenueTrend;
      expect(t?.months).toHaveLength(6);
      expect(t?.totals).toEqual({
        pipelineCreated: 5400,
        wonRevenue: 800,
        target: 2000,
        attainmentPct: 40,
      });
    });

    it("team performance reuses the quota math (case-insensitive rep match)", () => {
      expect(d.team?.map((r) => r.repName)).toEqual(["Asha Rao", "Bob"]);
      expect(d.team?.[0]).toMatchObject({
        won: 1,
        wonValue: 800,
        open: 2,
        lost: 0,
        winRate: 100,
        target: 2000,
        attainmentPct: 40,
        quotaLive: { period: "monthly", attainmentPct: 40 },
      });
      expect(d.team?.[1]).toMatchObject({
        won: 0,
        open: 1,
        lost: 1,
        winRate: 0,
        target: null,
        attainmentPct: null,
        quotaLive: null,
      });
    });

    it("lead sources (trimmed + merged) and trend (needs 2+ days)", () => {
      expect(d.leadSources).toEqual([
        { source: "Web", total: 3, converted: 1 },
        { source: "Referral", total: 1, converted: 0 },
      ]);
      expect(d.leadsTrend).toEqual({ granularity: null, points: [] });
    });

    it("product revenue counts line items of WON deals only", () => {
      expect(d.productRevenue).toEqual([{ product: "Widget", value: 800 }]);
    });

    it("today's work / upcoming / attention buckets", () => {
      const w = d.work;
      expect(w.todaysMeetings.count).toBe(1);
      expect(w.todaysFollowups.count).toBe(3); // 2 follow-ups + 1 task
      expect(w.todaysCallbacks.count).toBe(1); // follow-up on the Call Back account
      expect(w.tomorrowMeetings.count).toBe(1);
      expect(w.upcomingFollowups.count).toBe(1);
      expect(w.overdue.count).toBe(3); // meeting, follow-up, task
      expect(w.missedFollowups.count).toBe(2); // follow-up + task
      expect(w.needsAttention.count).toBe(7); // today meetings + follow-ups + overdue
      expect(w.pending.count).toBe(9);
      const cb = w.todaysCallbacks.items[0];
      expect(cb).toMatchObject({
        kind: "Follow-up",
        accountName: "Epsilon Callback",
      });
      expect(cb?.href).toMatch(/^\/crm\/accounts\/\d+$/);
    });

    it("health: completed activities + 14-day trend", () => {
      expect(d.health.activitiesCompleted).toBe(3);
      expect(d.health.todayDateKey).toBe(today);
      expect(d.health.today).not.toBeNull();
      expect(d.health.dailyTrend).toHaveLength(14);
    });
  });

  describe("per-entity permission filtering", () => {
    it("own-scope opportunity/lead reader sees only rows they created and no other entity", async () => {
      const d = await dash(tokenOwn);
      expect(d.access).toMatchObject({
        opportunities: true,
        leads: true,
        accounts: false,
        meetings: false,
        followUps: false,
        tasks: false,
        quotas: false,
        overallData: false,
      });
      expect(d.pipeline).toMatchObject({
        openCount: 1,
        openValue: 200,
        wonCount: 0,
        lostCount: 0,
        totalRevenue: 0,
      });
      expect(d.team?.map((r) => r.repName)).toEqual(["Bob"]);
      expect(d.team?.[0]?.target).toBeNull(); // quotas unreadable
      expect(d.revenueTrend?.totals.pipelineCreated).toBe(200);
      expect(d.overview.totalLeads).toBe(1);
      expect(d.overview.convertedLeads).toBe(0);
      expect(d.leadSources).toEqual([
        { source: "Web", total: 1, converted: 0 },
      ]);
      // entities the caller cannot read are hidden, not zero
      expect(d.overview.interestedLeads).toBeNull();
      expect(d.overview.scheduledMeetingsCount).toBeNull();
      expect(d.accountsCount).toBeNull();
      expect(d.health.today).toBeNull();
      expect(d.health.dailyTrend).toBeNull();
      expect(d.health.activitiesCompleted).toBeNull();
      for (const bucket of Object.values(d.work)) {
        expect(bucket).toEqual({ count: 0, items: [] });
      }
    });

    it("dashboard-only user gets every section hidden", async () => {
      const d = await dash(tokenBare);
      expect(Object.values(d.access).every((v) => v === false)).toBe(true);
      expect(d.pipeline).toBeNull();
      expect(d.revenueTrend).toBeNull();
      expect(d.team).toBeNull();
      expect(d.leadSources).toBeNull();
      expect(d.leadsTrend).toBeNull();
      expect(d.productRevenue).toBeNull();
      expect(d.accountsCount).toBeNull();
      expect(Object.values(d.overview).every((v) => v === null)).toBe(true);
    });
  });

  describe("tenant isolation", () => {
    it("an org with no data sees none of org A's numbers", async () => {
      const d = await dash(tokenB);
      expect(d.pipeline).toMatchObject({
        openCount: 0,
        wonCount: 0,
        lostCount: 0,
        totalRevenue: 0,
      });
      expect(d.team).toEqual([]);
      expect(d.leadSources).toEqual([]);
      expect(d.productRevenue).toEqual([]);
      expect(d.overview.totalLeads).toBe(0);
      expect(d.overview.interestedLeads).toBe(0);
      expect(d.accountsCount).toBe(0);
      expect(d.revenueTrend?.totals.pipelineCreated).toBe(0);
      for (const bucket of Object.values(d.work)) {
        expect(bucket).toEqual({ count: 0, items: [] });
      }
    });
  });
});
