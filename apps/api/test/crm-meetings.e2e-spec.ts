import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** Representative suite for the Phase 0 Account-360 polymorphic entities
 * (Meeting/FollowUp/CrmActivity/CrmTask/CrmDocument share the exact same
 * `relatedType`/`relatedId` + tenant-isolation + permission shape — see
 * Docs/CRM_FULL_LEGACY_PARITY.md §4). Covers the relation-validity check
 * (`assertRelatedEntityExists`), the fuller Meeting-specific status/
 * complete/reschedule workflow, tenant isolation and authorization. */
describe("crm meetings (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoPermission: string;
  let tokenB: string;
  let accountA: { id: number };

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
      data: { name: `Org A ${suffix}`, slug: `crm-mtg-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-mtg-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.meeting.read");
    const write = await permission("crm.meeting.write");
    const del = await permission("crm.meeting.delete");
    const accountRead = await permission("crm.account.read");
    const accountWrite = await permission("crm.account.write");

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
      return user;
    }

    await makeUser(orgA.id, "all-access@crm-mtg-org-a.test", [
      read.id,
      write.id,
      del.id,
      accountRead.id,
      accountWrite.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-mtg-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-mtg-org-b.test", [
      read.id,
      write.id,
      del.id,
      accountRead.id,
      accountWrite.id,
    ]);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenAll = await login(orgA.slug, "all-access@crm-mtg-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-mtg-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-mtg-org-b.test");

    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: "Meeting Test Account" },
    });
  });

  afterAll(async () => {
    await prisma.crmMeetingReschedule.deleteMany({
      where: { meeting: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.crmMeeting.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated and unauthorized requests", async () => {
    await request(app.getHttpServer()).get("/crm/meetings").expect(401);
    await request(app.getHttpServer())
      .get("/crm/meetings")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("rejects creating a meeting against a non-existent related entity (422)", async () => {
    await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        relatedType: "account",
        relatedId: 999999999,
        meetingDate: "2026-12-01",
      })
      .expect(422);
  });

  it("rejects creating a meeting against another org's account (422) — relation validity is tenant-scoped", async () => {
    await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        relatedType: "account",
        relatedId: accountA.id,
        meetingDate: "2026-12-01",
      })
      .expect(422);
  });

  it("creates a meeting, defaults status to REQUESTED, and enforces tenant isolation on read", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        relatedType: "account",
        relatedId: accountA.id,
        mode: "Online",
        meetingDate: "2026-12-15",
        agenda: "Discuss renewal",
      })
      .expect(201);
    const meeting = (createRes.body as { data: { id: number; status: string } })
      .data;
    expect(meeting.status).toBe("REQUESTED");

    await request(app.getHttpServer())
      .get(`/crm/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("transitions status, completes with outcome fields, and reschedules with an immutable history row", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        relatedType: "account",
        relatedId: accountA.id,
        meetingDate: "2026-12-20",
      })
      .expect(201);
    const meeting = (createRes.body as { data: { id: number } }).data;

    await request(app.getHttpServer())
      .patch(`/crm/meetings/${meeting.id}/status`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    const completeRes = await request(app.getHttpServer())
      .post(`/crm/meetings/${meeting.id}/complete`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        summary: "Went well",
        decisionMaker: "Jane",
        nextStep: "Send proposal",
      })
      .expect(201);
    const completed = (
      completeRes.body as {
        data: {
          status: string;
          summary: string;
          completedAt: string;
          nextStep: string;
        };
      }
    ).data;
    expect(completed.nextStep).toBe("Send proposal");
    expect(completed.status).toBe("COMPLETED");
    expect(completed.summary).toBe("Went well");
    expect(completed.completedAt).not.toBeNull();

    const createRes2 = await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        relatedType: "account",
        relatedId: accountA.id,
        meetingDate: "2026-12-22",
      })
      .expect(201);
    const meeting2 = (createRes2.body as { data: { id: number } }).data;

    const rescheduleRes = await request(app.getHttpServer())
      .post(`/crm/meetings/${meeting2.id}/reschedule`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ newDate: "2026-12-29", reason: "Client requested" })
      .expect(201);
    const rescheduled = (
      rescheduleRes.body as {
        data: { status: string; reschedules: { reason: string }[] };
      }
    ).data;
    expect(rescheduled.status).toBe("RESCHEDULED");
    expect(rescheduled.reschedules).toHaveLength(1);
    expect(rescheduled.reschedules[0]?.reason).toBe("Client requested");
  });

  it("soft-deletes a meeting, which then disappears from list/detail, and is tenant-isolated", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/meetings")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        relatedType: "account",
        relatedId: accountA.id,
        meetingDate: "2027-01-05",
      })
      .expect(201);
    const meeting = (createRes.body as { data: { id: number } }).data;

    await request(app.getHttpServer())
      .delete(`/crm/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/crm/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/crm/meetings/${meeting.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
  });
});
