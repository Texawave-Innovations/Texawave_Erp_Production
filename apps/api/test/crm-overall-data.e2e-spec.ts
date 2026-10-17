import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** CRM Overall Data daily tracker (legacy OverallData.tsx +
 * useOverallDataLive.ts). Seeds records on known dates in Feb 2026 and
 * proves per-day counts, IST day bucketing, drill-down parity with the grid,
 * the audit-derived status rows, auth and tenant isolation. */
describe("crm overall data (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenRead: string;
  let tokenNone: string;
  let tokenB: string;

  type Grid = {
    rows: { key: string; label: string }[];
    days: string[];
    daily: Record<string, Record<string, number>>;
    monthTotals: Record<string, number>;
  };

  const get = (token: string, url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set("Authorization", `Bearer ${token}`);

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
      data: { name: `Org A ${suffix}`, slug: `crm-od-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-od-b-${suffix}` },
    });

    const perm = await prisma.permission.upsert({
      where: { code: "crm.overalldata.read" },
      update: {},
      create: {
        code: "crm.overalldata.read",
        description: "crm.overalldata.read",
      },
    });

    async function makeUser(orgId: number, email: string, grant: boolean) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      if (grant) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Tracker Rep",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }
    const userA = await makeUser(orgA.id, "read@crm-od-a.test", true);
    await makeUser(orgA.id, "none@crm-od-a.test", false);
    await makeUser(orgB.id, "read@crm-od-b.test", true);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenRead = await login(orgA.slug, "read@crm-od-a.test");
    tokenNone = await login(orgA.slug, "none@crm-od-a.test");
    tokenB = await login(orgB.slug, "read@crm-od-b.test");

    // ---- seed (all Feb 2026; IST = UTC+5:30) ----
    const account = await prisma.account.create({
      data: {
        organizationId: orgA.id,
        name: "Tracker Account",
        statusTag: "Call Back",
        statusDate: new Date("2026-03-05"),
      },
    });
    const o = orgA.id;
    const d10 = new Date("2026-02-10T06:00:00Z"); // 10 Feb IST
    const d10b = new Date("2026-02-10T09:00:00Z"); // 10 Feb IST
    const lateUtc = new Date("2026-02-10T20:00:00Z"); // 11 Feb 01:30 IST
    const jan31Utc = new Date("2026-01-31T20:00:00Z"); // 1 Feb 01:30 IST

    // Accounts mined: 2 on 10 Feb, 1 on 1 Feb (IST) from a Jan-31 UTC stamp
    await prisma.crmMiningRow.createMany({
      data: [
        { organizationId: o, companyName: "Mine 1", createdAt: d10 },
        { organizationId: o, companyName: "Mine 2", createdAt: d10b },
        { organizationId: o, companyName: "Mine 3", createdAt: jan31Utc },
        // soft-deleted never counts
        {
          organizationId: o,
          companyName: "Mine gone",
          createdAt: d10,
          deletedAt: new Date(),
        },
      ],
    });
    // Cold calling -> callsMade
    await prisma.crmColdCallingEntry.create({
      data: {
        organizationId: o,
        companyName: "Cold Co",
        createdAt: d10,
        createdBy: userA.id,
      },
    });
    // Activities: Email x1, Call x2 (one at late-UTC => 11 Feb), Note ignored
    await prisma.crmActivity.createMany({
      data: [
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          type: "Email",
          subject: "Intro",
          occurredAt: d10,
        },
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          type: "Call",
          subject: "Call 1",
          occurredAt: d10,
        },
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          type: "Call",
          subject: "Call late",
          occurredAt: lateUtc,
        },
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          type: "Note",
          subject: "ignored",
          occurredAt: d10,
        },
      ],
    });
    // Meetings: scheduled 10 Feb x3; one completed 12 Feb; one cancelled 13 Feb
    await prisma.crmMeeting.createMany({
      data: [
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          meetingDate: new Date("2026-02-20"),
          createdAt: d10,
        },
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          meetingDate: new Date("2026-02-21"),
          createdAt: d10,
          status: "COMPLETED",
          completedAt: new Date("2026-02-12T06:00:00Z"),
        },
        {
          organizationId: o,
          relatedType: "account",
          relatedId: account.id,
          meetingDate: new Date("2026-02-22"),
          createdAt: d10,
          status: "CANCELLED",
          cancelledAt: new Date("2026-02-13T06:00:00Z"),
        },
      ],
    });
    // Account status-tag audit entries -> disposition rows
    const audit = (statusTag: string, at: Date) => ({
      organizationId: o,
      actorUserId: userA.id,
      entityType: "crm_account",
      entityId: BigInt(account.id),
      action: "status_tag_changed",
      after: { statusTag },
      at,
    });
    await prisma.auditLog.createMany({
      data: [
        audit("Not Interested", d10),
        audit("Keep in Touch", d10),
        audit("Call Back", d10),
        audit("Send Info", d10b),
        audit("Interested", d10), // not a tracked disposition
      ],
    });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.crmMiningRow.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmColdCallingEntry.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmActivity.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmMeeting.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await app.close();
  });

  it("rejects unauthenticated and unauthorized requests", async () => {
    await request(app.getHttpServer())
      .get("/crm/overall-data?year=2026&month=2")
      .expect(401);
    await get(tokenNone, "/crm/overall-data?year=2026&month=2").expect(403);
    await get(
      tokenNone,
      "/crm/overall-data/records?year=2026&month=2&row=callsMade&day=2026-02-10",
    ).expect(403);
  });

  it("validates year/month/row/day", async () => {
    await get(tokenRead, "/crm/overall-data?year=2026&month=13").expect(400);
    await get(tokenRead, "/crm/overall-data").expect(400);
    await get(
      tokenRead,
      "/crm/overall-data/records?year=2026&month=2&row=bogus&day=2026-02-10",
    ).expect(400);
    await get(
      tokenRead,
      "/crm/overall-data/records?year=2026&month=2&row=callsMade&day=2026-03-10",
    ).expect(422);
  });

  it("returns the 9 fixed rows, every day of the month, and exact per-day counts", async () => {
    const res = await get(
      tokenRead,
      "/crm/overall-data?year=2026&month=2",
    ).expect(200);
    const g = (res.body as { data: Grid }).data;
    expect(g.rows.map((r) => r.label)).toEqual([
      "Accounts Mined",
      "E-mails sent for the day",
      "Meeting Scheduled",
      "Meeting Completed",
      "Meeting Cancelled",
      "Send Info / Call Backs",
      "Follow-up (Keep in Touch)",
      "Not Interested",
      "Calls made for the Day",
    ]);
    expect(g.days).toHaveLength(28);

    expect(g.daily.accountsMined).toEqual({ "2026-02-01": 1, "2026-02-10": 2 });
    expect(g.daily.emailsSent).toEqual({ "2026-02-10": 1 });
    // cold call (10th) + Call activity (10th) ; late-UTC call lands on 11th
    expect(g.daily.callsMade).toEqual({ "2026-02-10": 2, "2026-02-11": 1 });
    expect(g.daily.meetingsScheduled).toEqual({ "2026-02-10": 3 });
    expect(g.daily.meetingsCompleted).toEqual({ "2026-02-12": 1 });
    expect(g.daily.meetingsCancelled).toEqual({ "2026-02-13": 1 });
    expect(g.daily.sendInfoCallBacks).toEqual({ "2026-02-10": 2 });
    expect(g.daily.followUp).toEqual({ "2026-02-10": 1 });
    expect(g.daily.notInterested).toEqual({ "2026-02-10": 1 });
    expect(g.monthTotals.accountsMined).toBe(3);
    expect(g.monthTotals.callsMade).toBe(3);
  });

  it("drill-down returns exactly the records behind a cell", async () => {
    const res = await get(
      tokenRead,
      "/crm/overall-data/records?year=2026&month=2&row=callsMade&day=2026-02-10",
    ).expect(200);
    const rows = (
      res.body as {
        data: {
          recordType: string;
          source?: string;
          owner: string;
          accountName?: string;
        }[];
      }
    ).data;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recordType).sort()).toEqual([
      "activity",
      "cold_calling_entry",
    ]);
    expect(rows.find((r) => r.recordType === "activity")?.accountName).toBe(
      "Tracker Account",
    );

    const empty = await get(
      tokenRead,
      "/crm/overall-data/records?year=2026&month=2&row=callsMade&day=2026-02-02",
    ).expect(200);
    expect((empty.body as { data: unknown[] }).data).toHaveLength(0);

    const audit = await get(
      tokenRead,
      "/crm/overall-data/records?year=2026&month=2&row=sendInfoCallBacks&day=2026-02-10",
    ).expect(200);
    const a = (
      audit.body as {
        data: { recordType: string; owner: string; dueDate?: string }[];
      }
    ).data;
    expect(a).toHaveLength(2);
    // Due = the account's current call-back date, only on the change that is still its current status.
    expect(a.map((r) => r.dueDate).sort()).toEqual(["2026-03-05", undefined]);
    expect(a.every((r) => r.recordType === "audit")).toBe(true);
    expect(a[0]!.owner).toBe("Tracker Rep");
  });

  it("is tenant-isolated and empty for other months", async () => {
    const b = await get(tokenB, "/crm/overall-data?year=2026&month=2").expect(
      200,
    );
    const g = (b.body as { data: Grid }).data;
    expect(Object.values(g.monthTotals).every((n) => n === 0)).toBe(true);

    const mar = await get(
      tokenRead,
      "/crm/overall-data?year=2026&month=3",
    ).expect(200);
    expect(
      Object.values((mar.body as { data: Grid }).data.monthTotals).every(
        (n) => n === 0,
      ),
    ).toBe(true);
  });
});
