import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** Accounts Mining Sheet rows (legacy AccountsMiningSheet.tsx): CRUD,
 * search, custom-fields passthrough, admin-only delete, and the idempotent
 * "Promote to Lead" action. Same conventions as crm-cold-calling. */
describe("crm mining rows (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoDelete: string;
  let tokenNoPermission: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());

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
      data: { name: `Org A ${suffix}`, slug: `crm-mr-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-mr-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.miningrow.read");
    const write = await permission("crm.miningrow.write");
    const del = await permission("crm.miningrow.delete");
    const leadRead = await permission("crm.lead.read.all");
    const leadWrite = await permission("crm.lead.write.all");

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
          fullName: "Mining Tester",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

    await makeUser(orgA.id, "all-access@crm-mr-org-a.test", [
      read.id,
      write.id,
      del.id,
      leadRead.id,
      leadWrite.id,
    ]);
    await makeUser(orgA.id, "no-delete@crm-mr-org-a.test", [
      read.id,
      write.id,
      leadRead.id,
      leadWrite.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-mr-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-mr-org-b.test", [
      read.id,
      write.id,
      del.id,
      leadRead.id,
      leadWrite.id,
    ]);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await http()
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenAll = await login(orgA.slug, "all-access@crm-mr-org-a.test");
    tokenNoDelete = await login(orgA.slug, "no-delete@crm-mr-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-mr-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-mr-org-b.test");
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.crmMiningRow.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await app.close();
  });

  async function createRow(token: string, body: Record<string, unknown>) {
    const res = await http()
      .post("/crm/mining-rows")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(201);
    return (res.body as { data: { id: number } & Record<string, unknown> })
      .data;
  }

  it("rejects unauthenticated and unauthorized requests", async () => {
    await http().get("/crm/mining-rows").expect(401);
    await http()
      .get("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
    await http()
      .post("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .send({ companyName: "Acme" })
      .expect(403);
    await http()
      .post("/crm/mining-rows/1/promote-to-lead")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("creates a row with custom fields, validates input and lists with search", async () => {
    const row = await createRow(tokenAll, {
      companyName: "Zephyr Mining Co",
      keyDecisionMakers: "Zed Zephyr",
      priority: "High",
      customFields: { region: "APAC" },
    });
    expect(row.companyName).toBe("Zephyr Mining Co");
    expect(row.customFields).toEqual({ region: "APAC" });
    expect(row.promotedToLeadId).toBeNull();

    await http()
      .post("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "" })
      .expect(400);
    await http()
      .post("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "X", priority: "Urgent" })
      .expect(400);
    await http()
      .post("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "X", customFields: { a: 1 } })
      .expect(400);

    const list = await http()
      .get("/crm/mining-rows?search=zephyr")
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const body = list.body as {
      data: { id: number }[];
      meta: { total: number };
    };
    expect(body.data.map((r) => r.id)).toContain(row.id);
    expect(body.meta.total).toBe(1);
  });

  it("updates a row and keeps tenant isolation on read/update", async () => {
    const row = await createRow(tokenAll, { companyName: "Beta Mining" });

    const upd = await http()
      .patch(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ followUpStatus: "Called", priority: "Low" })
      .expect(200);
    const data = (
      upd.body as { data: { followUpStatus: string; priority: string } }
    ).data;
    expect(data.followUpStatus).toBe("Called");
    expect(data.priority).toBe("Low");

    await http()
      .get(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await http()
      .patch(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ notes: "hijack" })
      .expect(404);
    await http()
      .post(`/crm/mining-rows/${row.id}/promote-to-lead`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const listB = await http()
      .get("/crm/mining-rows")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect((listB.body as { meta: { total: number } }).meta.total).toBe(0);
  });

  it("promotes to a real Lead once, maps legacy fields, and refuses a second promotion", async () => {
    const row = await createRow(tokenAll, {
      companyName: "Gamma Promote Ltd",
      domain: "gamma.example",
      keyDecisionMakers: "Gina Gamma",
      title: "CTO",
      contactNumber: "+1 555 0100",
      email: "gina@gamma.example",
      notes: "Interested in ERP",
      industry: "Software",
      city: "Austin",
    });

    const res = await http()
      .post(`/crm/mining-rows/${row.id}/promote-to-lead`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(201);
    const promoted = (res.body as { data: { promotedToLeadId: number } }).data;
    expect(promoted.promotedToLeadId).toEqual(expect.any(Number));

    const lead = await prisma.lead.findFirstOrThrow({
      where: { id: promoted.promotedToLeadId },
    });
    expect(lead.organizationId).toBe(orgA.id);
    expect(lead.companyName).toBe("Gamma Promote Ltd");
    expect(lead.prospectName).toBe("Gina Gamma");
    expect(lead.leadSource).toBe("Accounts Mining");
    expect(lead.leadStatus).toBe("NEW");
    expect(lead.priority).toBe("Medium");
    expect(lead.areaOfInterest).toBe("Interested in ERP");
    expect(lead.assignedTo).toBe("Mining Tester");
    expect(lead.city).toBe("Austin");

    const second = await http()
      .post(`/crm/mining-rows/${row.id}/promote-to-lead`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(422);
    expect((second.body as { error?: string }).error).toBe(
      "MINING_ROW_ALREADY_PROMOTED",
    );

    const leadCount = await prisma.lead.count({
      where: { organizationId: orgA.id, companyName: "Gamma Promote Ltd" },
    });
    expect(leadCount).toBe(1);
  });

  it("never creates two leads for concurrent promotions", async () => {
    const row = await createRow(tokenAll, {
      companyName: "Race Condition Inc",
    });
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        http()
          .post(`/crm/mining-rows/${row.id}/promote-to-lead`)
          .set("Authorization", `Bearer ${tokenAll}`),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const live = await prisma.lead.count({
      where: {
        organizationId: orgA.id,
        companyName: "Race Condition Inc",
        deletedAt: null,
      },
    });
    expect(live).toBe(1);
  });

  it("restricts delete to crm.miningrow.delete and soft-deletes", async () => {
    const row = await createRow(tokenAll, { companyName: "Delete Me" });

    await http()
      .delete(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenNoDelete}`)
      .expect(403);
    await http()
      .delete(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await http()
      .delete(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);
    await http()
      .get(`/crm/mining-rows/${row.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
  });
});
