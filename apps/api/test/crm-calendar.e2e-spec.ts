import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface EventsBody {
  data: {
    includedTypes: string[];
    events: {
      id: string;
      itemType: string;
      recordId: number;
      date: string;
      title: string;
      subtitle: string;
      accountId: number | null;
      status: string | null;
    }[];
  };
}

/** Read-only CRM calendar (legacy intelligence/CrmCalendar.tsx): aggregation
 * over meetings, follow-ups, tasks and call activities, status exclusion,
 * date-range filtering, per-entity permission filtering, the event detail
 * endpoint and tenant isolation. */
describe("crm calendar (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenMeetingsOnly: string;
  let tokenNoPermission: string;
  let tokenNoCalendarPerm: string;
  let tokenB: string;
  let account: { id: number };
  let meetingOpen: { id: number };
  let followUp: { id: number };
  let task: { id: number };
  let call: { id: number };
  let accountOrgB: { id: number };
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `crm-cal-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-cal-b-${suffix}` },
    });

    const ids = new Map<string, number>();
    async function perm(code: string) {
      const cached = ids.get(code);
      if (cached) return cached;
      const row = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      ids.set(code, row.id);
      return row.id;
    }
    async function makeUser(orgId: number, email: string, codes: string[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      const permissionIds = await Promise.all(codes.map(perm));
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      const user = await prisma.user.create({
        data: { organizationId: orgId, email, passwordHash, fullName: "Test" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    const readAll = [
      "crm.calendar.read",
      "crm.account.read",
      "crm.meeting.read",
      "crm.followup.read",
      "crm.task.read",
      "crm.activity.read",
    ];
    await makeUser(orgA.id, "all@crm-cal-a.test", readAll);
    await makeUser(orgA.id, "meet@crm-cal-a.test", [
      "crm.calendar.read",
      "crm.meeting.read",
    ]);
    await makeUser(orgA.id, "none@crm-cal-a.test", []);
    await makeUser(orgA.id, "nocal@crm-cal-a.test", ["crm.meeting.read"]);
    await makeUser(orgB.id, "all@crm-cal-b.test", readAll);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenAll = await login(orgA.slug, "all@crm-cal-a.test");
    tokenMeetingsOnly = await login(orgA.slug, "meet@crm-cal-a.test");
    tokenNoPermission = await login(orgA.slug, "none@crm-cal-a.test");
    tokenNoCalendarPerm = await login(orgA.slug, "nocal@crm-cal-a.test");
    tokenB = await login(orgB.slug, "all@crm-cal-b.test");

    account = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Calendar Account ${suffix}` },
    });
    const rel = {
      organizationId: orgA.id,
      relatedType: "account",
      relatedId: account.id,
    };
    meetingOpen = await prisma.crmMeeting.create({
      data: {
        ...rel,
        mode: "Demo",
        meetingDate: new Date("2031-03-10"),
        startTime: "10:00",
        status: "CONFIRMED",
      },
    });
    await prisma.crmMeeting.create({
      data: {
        ...rel,
        meetingDate: new Date("2031-03-11"),
        status: "CANCELLED",
      },
    });
    await prisma.crmMeeting.create({
      data: {
        ...rel,
        meetingDate: new Date("2031-03-12"),
        status: "COMPLETED",
      },
    });
    // Outside the March window.
    await prisma.crmMeeting.create({
      data: { ...rel, meetingDate: new Date("2031-05-01") },
    });
    followUp = await prisma.crmFollowUp.create({
      data: {
        ...rel,
        type: "Email",
        scheduledAt: new Date("2031-03-10T15:30:00Z"),
        assignedTo: "Sam",
      },
    });
    await prisma.crmFollowUp.create({
      data: {
        ...rel,
        type: "Call",
        scheduledAt: new Date("2031-03-10T09:00:00Z"),
        assignedTo: "Sam",
        status: "COMPLETED",
      },
    });
    task = await prisma.crmTask.create({
      data: {
        ...rel,
        title: "Send proposal",
        dueDate: new Date("2031-03-31"),
        assignedTo: "Sam",
      },
    });
    await prisma.crmTask.create({
      data: {
        ...rel,
        title: "Done task",
        dueDate: new Date("2031-03-15"),
        assignedTo: "Sam",
        status: "Completed",
      },
    });
    call = await prisma.crmActivity.create({
      data: {
        ...rel,
        type: "Call",
        subject: "Intro call",
        occurredAt: new Date("2031-03-20T08:00:00Z"),
      },
    });
    await prisma.crmActivity.create({
      data: {
        ...rel,
        type: "Email",
        subject: "Not a call",
        occurredAt: new Date("2031-03-20T09:00:00Z"),
      },
    });

    accountOrgB = await prisma.account.create({
      data: { organizationId: orgB.id, name: `Beta Account ${suffix}` },
    });
    await prisma.crmTask.create({
      data: {
        organizationId: orgB.id,
        relatedType: "account",
        relatedId: accountOrgB.id,
        title: "Org B task",
        dueDate: new Date("2031-03-10"),
        assignedTo: "Bea",
      },
    });
  });

  afterAll(async () => {
    const where = { organizationId: { in: [orgA.id, orgB.id] } };
    await prisma.crmMeeting.deleteMany({ where });
    await prisma.crmFollowUp.deleteMany({ where });
    await prisma.crmTask.deleteMany({ where });
    await prisma.crmActivity.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await app.close();
  });

  function events(token: string, query: Record<string, string>) {
    return request(app.getHttpServer())
      .get("/crm/calendar/events")
      .query(query)
      .set("Authorization", `Bearer ${token}`);
  }
  function detail(token: string, type: string, id: number) {
    return request(app.getHttpServer())
      .get(`/crm/calendar/events/${type}/${id}`)
      .set("Authorization", `Bearer ${token}`);
  }

  it("rejects unauthenticated and unauthorized requests", async () => {
    await request(app.getHttpServer()).get("/crm/calendar/events").expect(401);
    await events(tokenNoPermission, {}).expect(403);
    await events(tokenNoCalendarPerm, {}).expect(403);
    await detail(tokenNoPermission, "meeting", meetingOpen.id).expect(403);
  });

  it("aggregates open meetings, follow-ups, tasks and calls in range", async () => {
    const res = await events(tokenAll, {
      from: "2031-03-01",
      to: "2031-03-31",
    }).expect(200);
    const body = res.body as EventsBody;
    expect(body.data.includedTypes.sort()).toEqual(
      ["call", "followup", "meeting", "task"].sort(),
    );
    expect(body.data.events.map((e) => e.id).sort()).toEqual(
      [
        `meeting_${meetingOpen.id}`,
        `followup_${followUp.id}`,
        `task_${task.id}`,
        `call_${call.id}`,
      ].sort(),
    );
    const meeting = body.data.events.find((e) => e.itemType === "meeting");
    expect(meeting?.title).toBe("Demo");
    expect(meeting?.subtitle).toBe(`Calendar Account ${suffix}`);
    expect(meeting?.accountId).toBe(account.id);
    // Sorted by date ascending.
    const dates = body.data.events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("filters by date range (inclusive of the whole `to` day)", async () => {
    const single = await events(tokenAll, {
      from: "2031-03-10",
      to: "2031-03-10",
    }).expect(200);
    expect(
      (single.body as EventsBody).data.events.map((e) => e.itemType).sort(),
    ).toEqual(["followup", "meeting"]);

    const may = await events(tokenAll, {
      from: "2031-05-01",
      to: "2031-05-31",
    }).expect(200);
    expect((may.body as EventsBody).data.events).toHaveLength(1);

    // Open lower bound (agenda strip): everything up to `to`.
    const upTo = await events(tokenAll, { to: "2031-03-09" }).expect(200);
    expect((upTo.body as EventsBody).data.events).toHaveLength(0);

    await events(tokenAll, { from: "2031-03-31", to: "2031-03-01" }).expect(
      422,
    );
    await events(tokenAll, { from: "not-a-date" }).expect(400);
  });

  it("only aggregates entity types the caller may read", async () => {
    const res = await events(tokenMeetingsOnly, {
      from: "2031-03-01",
      to: "2031-03-31",
    }).expect(200);
    const body = res.body as EventsBody;
    expect(body.data.includedTypes).toEqual(["meeting"]);
    expect(body.data.events.map((e) => e.itemType)).toEqual(["meeting"]);
    // No account read permission: the account name is not disclosed.
    expect(body.data.events[0]?.subtitle).toBe("Unknown Account");
  });

  it("returns single-event detail with the related account", async () => {
    const res = await detail(tokenAll, "task", task.id).expect(200);
    const body = res.body as {
      data: {
        itemType: string;
        title: string;
        status: string;
        account: { id: number; name: string } | null;
        record: { assignedTo: string };
      };
    };
    expect(body.data.itemType).toBe("task");
    expect(body.data.title).toBe("Send proposal");
    expect(body.data.status).toBe("Open");
    expect(body.data.account).toEqual({
      id: account.id,
      name: `Calendar Account ${suffix}`,
    });
    expect(body.data.record.assignedTo).toBe("Sam");

    await detail(tokenAll, "call", call.id).expect(200);
    await detail(tokenAll, "followup", followUp.id).expect(200);
    await detail(tokenAll, "bogus", 1).expect(404);
  });

  it("enforces per-entity read permission on detail", async () => {
    await detail(tokenMeetingsOnly, "meeting", meetingOpen.id).expect(200);
    await detail(tokenMeetingsOnly, "task", task.id).expect(403);
  });

  it("is tenant isolated (list and detail)", async () => {
    const res = await events(tokenB, {
      from: "2031-03-01",
      to: "2031-03-31",
    }).expect(200);
    const body = res.body as EventsBody;
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0]?.title).toBe("Task — Org B task");
    await detail(tokenB, "task", task.id).expect(404);
    await detail(tokenAll, "task", task.id).expect(200);
  });
});
