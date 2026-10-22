import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** CRM notifications (legacy bell + blocking action panel): server-side
 * generation from seeded due items, idempotency, ack/done/snooze transitions,
 * due-date-edit reset, Recycle Bin, tenant isolation and permission gating. */
describe("crm notifications (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAdmin: string;
  let tokenWriter: string;
  let tokenReadOnly: string;
  let tokenNone: string;
  let tokenB: string;
  let followUpId: number;
  let meetingId: number;

  const DAY = 86_400_000;
  const todayStart = new Date(Math.floor(Date.now() / DAY) * DAY);
  const daysFromToday = (n: number) => new Date(todayStart.getTime() + n * DAY);

  type Notification = {
    id: number;
    type: string;
    sourceType: string;
    sourceId: number;
    status: string;
    priority: string;
    title: string;
    isRead: boolean;
    snoozeUntil: string | null;
    dueDate: string;
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  async function list(token: string, tab = "active") {
    const res = await http()
      .get(`/crm/notifications?tab=${tab}`)
      .set(auth(token))
      .expect(200);
    return (
      res.body as {
        data: {
          items: Notification[];
          counts: Record<string, number>;
        };
      }
    ).data;
  }
  async function refresh(token: string) {
    const res = await http()
      .post("/crm/notifications/refresh")
      .set(auth(token))
      .expect(200);
    return (
      res.body as {
        data: { created: number; updated: number; candidates: number };
      }
    ).data;
  }
  const find = (items: Notification[], type: string, sourceId?: number) =>
    items.find(
      (n) =>
        n.type === type && (sourceId === undefined || n.sourceId === sourceId),
    );

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
      data: { name: `Org A ${suffix}`, slug: `crm-notif-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-notif-b-${suffix}` },
    });

    const perm = (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const read = await perm("crm.notification.read");
    const write = await perm("crm.notification.write");
    const del = await perm("crm.notification.delete");

    async function makeUser(orgId: number, email: string, ids: number[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
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
    await makeUser(orgA.id, "admin@crm-notif-a.test", [
      read.id,
      write.id,
      del.id,
    ]);
    await makeUser(orgA.id, "writer@crm-notif-a.test", [read.id, write.id]);
    await makeUser(orgA.id, "reader@crm-notif-a.test", [read.id]);
    await makeUser(orgA.id, "none@crm-notif-a.test", []);
    await makeUser(orgB.id, "admin@crm-notif-b.test", [
      read.id,
      write.id,
      del.id,
    ]);

    const login = async (slug: string, email: string) => {
      const res = await http()
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };
    tokenAdmin = await login(orgA.slug, "admin@crm-notif-a.test");
    tokenWriter = await login(orgA.slug, "writer@crm-notif-a.test");
    tokenReadOnly = await login(orgA.slug, "reader@crm-notif-a.test");
    tokenNone = await login(orgA.slug, "none@crm-notif-a.test");
    tokenB = await login(orgB.slug, "admin@crm-notif-b.test");

    // ---- Seed due items in org A ----
    const account = await prisma.account.create({
      data: { organizationId: orgA.id, name: "Notif Account" },
    });
    const meeting = await prisma.crmMeeting.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        mode: "Online",
        meetingDate: todayStart,
        startTime: "10:00",
        status: "REQUESTED",
      },
    });
    meetingId = meeting.id;
    const followUp = await prisma.crmFollowUp.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        type: "Call",
        scheduledAt: daysFromToday(-1),
        assignedTo: "Sam",
        status: "PENDING",
      },
    });
    followUpId = followUp.id;
    await prisma.crmTask.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        title: "Send brochure",
        dueDate: daysFromToday(1),
        assignedTo: "Sam",
      },
    });
    // A completed meeting must never notify.
    await prisma.crmMeeting.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        meetingDate: daysFromToday(-3),
        status: "COMPLETED",
      },
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        organizationId: orgA.id,
        code: "QUAL",
        label: "Qualification",
        order: 1,
      },
    });
    await prisma.opportunity.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        opportunityNumber: "OPP-000001",
        title: "Big Deal",
        ownerName: "Sam",
        stageId: stage.id,
        stageEnteredAt: daysFromToday(-10),
        expectedCloseDate: daysFromToday(2),
      },
    });
    await prisma.quotation.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        quotationNumber: "Q-NOTIF-1",
        subject: "Quote",
        status: "Sent",
        createdAt: daysFromToday(-5),
      },
    });
    await prisma.account.create({
      data: {
        organizationId: orgA.id,
        name: "Keep Touch Co",
        statusTag: "Keep in Touch",
        statusDate: daysFromToday(-1),
      },
    });
  });

  afterAll(async () => {
    const orgs = { in: [orgA.id, orgB.id] };
    await prisma.crmNotification.deleteMany({
      where: { organizationId: orgs },
    });
    await prisma.quotation.deleteMany({ where: { organizationId: orgs } });
    await prisma.opportunity.deleteMany({ where: { organizationId: orgs } });
    await prisma.pipelineStage.deleteMany({ where: { organizationId: orgs } });
    await prisma.crmTask.deleteMany({ where: { organizationId: orgs } });
    await prisma.crmFollowUp.deleteMany({ where: { organizationId: orgs } });
    await prisma.crmMeeting.deleteMany({ where: { organizationId: orgs } });
    await prisma.account.deleteMany({ where: { organizationId: orgs } });
    await app.close();
  });

  it("rejects unauthenticated and unauthorized requests", async () => {
    await http().get("/crm/notifications").expect(401);
    await http().post("/crm/notifications/refresh").expect(401);
    await http().get("/crm/notifications").set(auth(tokenNone)).expect(403);
    await http()
      .post("/crm/notifications/refresh")
      .set(auth(tokenNone))
      .expect(403);
  });

  it("generates notifications from due items with the legacy rules", async () => {
    const result = await refresh(tokenAdmin);
    expect(result.created).toBe(7);

    const { items, counts } = await list(tokenAdmin);
    expect(items).toHaveLength(7);
    expect(counts.active).toBe(7);

    const meeting = find(items, "meeting-today", meetingId)!;
    expect(meeting.title).toBe("Meeting Today — Notif Account");
    expect(meeting.priority).toBe("high");
    expect(meeting.status).toBe("Pending");

    const followUp = find(items, "followup-overdue", followUpId)!;
    expect(followUp.title).toBe("Follow-up Overdue — Notif Account");
    expect(followUp.status).toBe("Overdue");
    expect(followUp.priority).toBe("high");

    expect(find(items, "task-due")?.status).toBe("Pending");
    const stuck = find(items, "opportunity-stuck")!;
    expect(stuck.title).toBe("Opportunity Stuck (Delayed) — Big Deal");
    expect(stuck.priority).toBe("medium");
    expect(find(items, "expected-close-near")?.priority).toBe("medium");
    expect(find(items, "quotation-pending")?.title).toBe(
      "Quotation Pending Response — Q-NOTIF-1",
    );
    const keep = find(items, "keepintouch-overdue")!;
    expect(keep.title).toBe("Keep in Touch Overdue — Keep Touch Co");
    // The completed meeting never produces a notification.
    expect(items.filter((n) => n.sourceType === "meeting")).toHaveLength(1);
  });

  it("is idempotent: refreshing again creates and changes nothing", async () => {
    const before = await list(tokenAdmin);
    const result = await refresh(tokenAdmin);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    const after = await list(tokenAdmin);
    expect(after.items.map((n) => n.id).sort()).toEqual(
      before.items.map((n) => n.id).sort(),
    );
  });

  it("gates actions on crm.notification.write and keeps read-only read-only", async () => {
    const { items } = await list(tokenReadOnly);
    expect(items.length).toBeGreaterThan(0);
    await refresh(tokenReadOnly);
    const id = find(items, "task-due")!.id;
    await http()
      .post(`/crm/notifications/${id}/acknowledge`)
      .set(auth(tokenReadOnly))
      .expect(403);
    await http()
      .post(`/crm/notifications/${id}/read`)
      .set(auth(tokenReadOnly))
      .expect(403);
  });

  it("acknowledge -> done, and a Done row is never resurrected by refresh", async () => {
    const { items } = await list(tokenWriter);
    const id = find(items, "task-due")!.id;

    const ack = await http()
      .post(`/crm/notifications/${id}/acknowledge`)
      .set(auth(tokenWriter))
      .expect(200);
    expect((ack.body as { data: Notification }).data.status).toBe(
      "Acknowledged",
    );

    await http()
      .post(`/crm/notifications/${id}/read`)
      .set(auth(tokenWriter))
      .expect(200);

    await http()
      .post(`/crm/notifications/${id}/done`)
      .set(auth(tokenWriter))
      .expect(200);
    const result = await refresh(tokenWriter);
    expect(result.created).toBe(0);

    const completed = await list(tokenWriter, "completed");
    expect(completed.items.map((n) => n.id)).toContain(id);
    const active = await list(tokenWriter);
    expect(active.items.map((n) => n.id)).not.toContain(id);
  });

  it("snoozes into the future, rejects a past time, and re-activates when it expires", async () => {
    const { items } = await list(tokenWriter);
    const id = find(items, "quotation-pending")!.id;

    await http()
      .post(`/crm/notifications/${id}/snooze`)
      .set(auth(tokenWriter))
      .send({ until: new Date(Date.now() - 60_000).toISOString() })
      .expect(422);

    const snoozed = await http()
      .post(`/crm/notifications/${id}/snooze`)
      .set(auth(tokenWriter))
      .send({ until: new Date(Date.now() + 3 * 3_600_000).toISOString() })
      .expect(200);
    expect((snoozed.body as { data: Notification }).data.status).toBe(
      "Snoozed",
    );

    // Still snoozed after a refresh while the snooze has not expired.
    await refresh(tokenWriter);
    let row = (await list(tokenWriter)).items.find((n) => n.id === id)!;
    expect(row.status).toBe("Snoozed");

    // Expire the snooze: refresh puts it back to Pending (diffDays 0 for this type).
    await prisma.crmNotification.update({
      where: { id },
      data: { snoozeUntil: new Date(Date.now() - 1000) },
    });
    await refresh(tokenWriter);
    row = (await list(tokenWriter)).items.find((n) => n.id === id)!;
    expect(row.status).toBe("Pending");
    expect(row.snoozeUntil).toBeNull();
  });

  it("treats a due-date edit as a fresh instance (resets a Done row in place)", async () => {
    const { items } = await list(tokenWriter);
    const id = find(items, "followup-overdue", followUpId)!.id;
    await http()
      .post(`/crm/notifications/${id}/done`)
      .set(auth(tokenWriter))
      .expect(200);

    await prisma.crmFollowUp.update({
      where: { id: followUpId },
      data: { scheduledAt: daysFromToday(-2) },
    });
    const result = await refresh(tokenWriter);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    const row = (await list(tokenWriter)).items.find((n) => n.id === id)!;
    expect(row.status).toBe("Overdue");
    expect(row.isRead).toBe(false);
    expect(row.dueDate.slice(0, 10)).toBe(
      daysFromToday(-2).toISOString().slice(0, 10),
    );
  });

  it("Recycle Bin: only admins delete a Completed notification; restore and permanent delete", async () => {
    const { items } = await list(tokenAdmin);
    const doneId = find(items, "followup-overdue", followUpId)!.id;
    const activeId = find(items, "meeting-today")!.id;
    await http()
      .post(`/crm/notifications/${doneId}/done`)
      .set(auth(tokenAdmin))
      .expect(200);

    // Non-admin cannot delete; a non-completed notification cannot be deleted.
    await http()
      .delete(`/crm/notifications/${doneId}`)
      .set(auth(tokenWriter))
      .expect(403);
    await http()
      .delete(`/crm/notifications/${activeId}`)
      .set(auth(tokenAdmin))
      .expect(422);

    await http()
      .delete(`/crm/notifications/${doneId}`)
      .set(auth(tokenAdmin))
      .expect(204);
    const bin = await list(tokenAdmin, "deleted");
    expect(bin.items.map((n) => n.id)).toEqual([doneId]);
    expect(
      (await list(tokenAdmin, "completed")).items.map((n) => n.id),
    ).not.toContain(doneId);

    // A recycled row is not recreated or reset by the generator.
    const result = await refresh(tokenAdmin);
    expect(result.created).toBe(0);
    expect((await list(tokenAdmin, "deleted")).items).toHaveLength(1);

    // Permanent delete: non-admin 403; only after soft-delete; irreversible.
    await http()
      .delete(`/crm/notifications/${doneId}/permanent`)
      .set(auth(tokenWriter))
      .expect(403);
    await http()
      .delete(`/crm/notifications/${activeId}/permanent`)
      .set(auth(tokenAdmin))
      .expect(404);

    await http()
      .post(`/crm/notifications/${doneId}/restore`)
      .set(auth(tokenWriter))
      .expect(200);
    expect(
      (await list(tokenAdmin, "completed")).items.map((n) => n.id),
    ).toContain(doneId);

    await http()
      .delete(`/crm/notifications/${doneId}`)
      .set(auth(tokenAdmin))
      .expect(204);
    await http()
      .delete(`/crm/notifications/${doneId}/permanent`)
      .set(auth(tokenAdmin))
      .expect(204);
    expect(
      await prisma.crmNotification.findUnique({ where: { id: doneId } }),
    ).toBeNull();
  });

  it("isolates tenants", async () => {
    const orgBFeed = await list(tokenB);
    expect(orgBFeed.items).toHaveLength(0);
    const result = await refresh(tokenB);
    expect(result.created).toBe(0);

    const { items } = await list(tokenAdmin);
    const id = items[0]!.id;
    await http()
      .post(`/crm/notifications/${id}/acknowledge`)
      .set(auth(tokenB))
      .expect(404);
    await http()
      .post(`/crm/notifications/${id}/done`)
      .set(auth(tokenB))
      .expect(404);
    await http()
      .delete(`/crm/notifications/${id}`)
      .set(auth(tokenB))
      .expect(422);
  });
});
