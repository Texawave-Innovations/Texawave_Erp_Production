import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { currentMonthKey } from "../src/modules/crm/quotas/quota-attainment.js";

/** CRM Target / Quotas (legacy Quotas.tsx + domain/quotasService.ts):
 * three permission tiers, duplicate guard, tenant isolation and live
 * attainment computed from WON opportunities (owner match case/whitespace
 * insensitive). */
describe("crm quotas (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenRead: string;
  let tokenWrite: string;
  let tokenNone: string;
  let tokenB: string;

  const periodKey = currentMonthKey();

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
      data: { name: `Org A ${suffix}`, slug: `crm-quota-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-quota-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }
    const read = await permission("crm.quota.read");
    const write = await permission("crm.quota.write");
    const del = await permission("crm.quota.delete");

    async function makeUser(
      orgId: number,
      email: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
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
    }
    await makeUser(orgA.id, "all@crm-quota-a.test", [
      read.id,
      write.id,
      del.id,
    ]);
    await makeUser(orgA.id, "read@crm-quota-a.test", [read.id]);
    await makeUser(orgA.id, "write@crm-quota-a.test", [read.id, write.id]);
    await makeUser(orgA.id, "none@crm-quota-a.test", []);
    await makeUser(orgB.id, "all@crm-quota-b.test", [
      read.id,
      write.id,
      del.id,
    ]);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenAll = await login(orgA.slug, "all@crm-quota-a.test");
    tokenRead = await login(orgA.slug, "read@crm-quota-a.test");
    tokenWrite = await login(orgA.slug, "write@crm-quota-a.test");
    tokenNone = await login(orgA.slug, "none@crm-quota-a.test");
    tokenB = await login(orgB.slug, "all@crm-quota-b.test");

    // Seed WON opportunities for "Asha Rao" (owner stored with odd
    // casing/whitespace) plus noise that must NOT count.
    const account = await prisma.account.create({
      data: { organizationId: orgA.id, name: "Quota Account" },
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        organizationId: orgA.id,
        code: "won",
        label: "Won",
        order: 1,
        isWon: true,
      },
    });
    const base = {
      organizationId: orgA.id,
      accountId: account.id,
      stageId: stage.id,
    };
    const now = new Date();
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 15);
    await prisma.opportunity.createMany({
      data: [
        {
          ...base,
          opportunityNumber: "OPP-Q1",
          title: "Won closing amount",
          ownerName: "  asha RAO ",
          status: "WON",
          wonAt: now,
          closingAmount: 600,
          estimatedValue: 100,
        },
        {
          ...base,
          opportunityNumber: "OPP-Q2",
          title: "Won estimated only",
          ownerName: "Asha Rao",
          status: "WON",
          wonAt: now,
          estimatedValue: 150,
        },
        {
          ...base,
          opportunityNumber: "OPP-Q3",
          title: "Wrong period",
          ownerName: "Asha Rao",
          status: "WON",
          wonAt: lastYear,
          closingAmount: 9999,
        },
        {
          ...base,
          opportunityNumber: "OPP-Q4",
          title: "Other rep",
          ownerName: "Someone Else",
          status: "WON",
          wonAt: now,
          closingAmount: 5000,
        },
        {
          ...base,
          opportunityNumber: "OPP-Q5",
          title: "Still open",
          ownerName: "Asha Rao",
          status: "OPEN",
          closingAmount: 7000,
        },
      ],
    });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.crmQuota.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.opportunity.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.pipelineStage.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await app.close();
  });

  const body = (over: Record<string, unknown> = {}) => ({
    repName: "Asha Rao",
    period: "monthly",
    periodKey,
    targetAmount: 1000,
    metric: "closedWonValue",
    currency: "INR",
    ...over,
  });

  type QuotaRes = {
    id: number;
    targetAmount: number;
    live: {
      achieved: number;
      remaining: number;
      attainmentPct: number;
      status: string;
      target: number;
    };
  };

  it("rejects unauthenticated, unauthorized and under-privileged callers", async () => {
    await request(app.getHttpServer()).get("/crm/quotas").expect(401);
    await request(app.getHttpServer())
      .get("/crm/quotas")
      .set("Authorization", `Bearer ${tokenNone}`)
      .expect(403);
    // read-only tier cannot manage
    await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenRead}`)
      .send(body())
      .expect(403);
    await request(app.getHttpServer())
      .post("/crm/quotas/live-summary")
      .set("Authorization", `Bearer ${tokenRead}`)
      .send(body())
      .expect(403);
  });

  it("creates a quota and computes live attainment from WON opportunities", async () => {
    const res = await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenWrite}`)
      .send(body())
      .expect(201);
    const quota = (res.body as { data: QuotaRes }).data;
    expect(quota.targetAmount).toBe(1000);
    // 600 (closingAmount) + 150 (estimated fallback); noise excluded
    expect(quota.live.achieved).toBe(750);
    expect(quota.live.remaining).toBe(250);
    expect(quota.live.attainmentPct).toBe(75);

    const one = await request(app.getHttpServer())
      .get(`/crm/quotas/${quota.id}`)
      .set("Authorization", `Bearer ${tokenRead}`)
      .expect(200);
    expect((one.body as { data: QuotaRes }).data.live.achieved).toBe(750);
  });

  it("counts deals for the dealsWon metric", async () => {
    const res = await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(
        body({
          repName: "ASHA RAO",
          period: "quarterly",
          periodKey: `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
          metric: "dealsWon",
          targetAmount: 4,
        }),
      )
      .expect(201);
    const live = (res.body as { data: QuotaRes }).data.live;
    expect(live.achieved).toBe(2);
    expect(live.attainmentPct).toBe(50);
  });

  it("blocks a duplicate rep + period + periodKey (case/whitespace-insensitive) but allows editing itself", async () => {
    const dup = await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "  asha rao  " }))
      .expect(409);
    expect(JSON.stringify(dup.body)).toContain("already exists");

    const other = await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Bob Rep", targetAmount: 500 }))
      .expect(201);
    const id = (other.body as { data: QuotaRes }).data.id;

    // renaming onto an existing key is a duplicate
    await request(app.getHttpServer())
      .patch(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ repName: "Asha Rao" })
      .expect(409);
    // editing itself is fine
    const upd = await request(app.getHttpServer())
      .patch(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenWrite}`)
      .send({ targetAmount: 800 })
      .expect(200);
    expect((upd.body as { data: QuotaRes }).data.targetAmount).toBe(800);
  });

  it("validates period keys and amounts", async () => {
    await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Zed", periodKey: "2026-13" }))
      .expect(422);
    await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Zed", period: "quarterly" }))
      .expect(422);
    await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Zed", targetAmount: 0 }))
      .expect(400);
  });

  it("serves a live summary for an unsaved draft", async () => {
    const res = await request(app.getHttpServer())
      .post("/crm/quotas/live-summary")
      .set("Authorization", `Bearer ${tokenWrite}`)
      .send({
        repName: "asha rao",
        period: "monthly",
        periodKey,
        targetAmount: 750,
      })
      .expect(200);
    const live = (res.body as { data: QuotaRes["live"] }).data;
    expect(live.achieved).toBe(750);
    expect(live.status).toBe("Achieved");
  });

  it("filters the list by rep and isolates tenants", async () => {
    const list = await request(app.getHttpServer())
      .get("/crm/quotas?repName=%20ASHA%20rao")
      .set("Authorization", `Bearer ${tokenRead}`)
      .expect(200);
    const rows = (list.body as { data: { repName: string }[] }).data;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.repName.toLowerCase() === "asha rao")).toBe(
      true,
    );

    const b = await request(app.getHttpServer())
      .get("/crm/quotas")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect((b.body as { data: unknown[] }).data).toHaveLength(0);

    const created = await request(app.getHttpServer())
      .get("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const id = (created.body as { data: { id: number }[] }).data[0]!.id;
    await request(app.getHttpServer())
      .get(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ notes: "x" })
      .expect(404);
  });

  it("delete is admin-tier only and soft-deletes", async () => {
    const res = await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Temp Rep" }))
      .expect(201);
    const id = (res.body as { data: QuotaRes }).data.id;

    await request(app.getHttpServer())
      .delete(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenWrite}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/crm/quotas/${id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
    // soft-deleted key is free again
    await request(app.getHttpServer())
      .post("/crm/quotas")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send(body({ repName: "Temp Rep" }))
      .expect(201);
  });
});
