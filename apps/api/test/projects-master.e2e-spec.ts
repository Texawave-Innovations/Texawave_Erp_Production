import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end proof for Projects Master Lists: auth, org scoping, permission
 * checks, and tenant isolation across all three tabs — the project type
 * registry, the project code format, and the task running-number format.
 * Modeled on apps/api/test/finance-settings.e2e-spec.ts.
 *
 * Two organizations are seeded so tenant isolation is proven directly (a
 * project created in org A must be invisible — 404, not just "not in the
 * list" — from org B), not merely assumed from the code.
 */
describe("projects master (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;

  const PERMISSION_CODES = [
    "projects_master.project.read",
    "projects_master.project.write",
    "projects_master.project_code_master.read",
    "projects_master.project_code_master.write",
    "projects_master.task_running_number_master.read",
    "projects_master.task_running_number_master.write",
  ];

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
      data: { name: `Org A ${suffix}`, slug: `org-a-proj-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-proj-${suffix}` },
    });

    const permissions = await Promise.all(
      PERMISSION_CODES.map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        }),
      ),
    );
    const allPermissionIds = permissions.map((p) => p.id);
    const readOnlyIds = permissions
      .filter((p) => p.code.endsWith(".read"))
      .map((p) => p.id);

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

    await makeUser(orgA.id, "full-access@projects-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@projects-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@projects-a.test", readOnlyIds);

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

    tokenA = await login(orgA.slug, "full-access@projects-a.test");
    tokenB = await login(orgB.slug, "full-access@projects-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@projects-a.test");
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.project.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.projectCodeMaster.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.taskRunningNumberMaster.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer())
      .get("/projects-master/projects")
      .expect(401);
  });

  it("rejects a write from a reader without the write permission", async () => {
    await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ code: "ME", name: "Should be forbidden" })
      .expect(403);
  });

  it("creates with the given code, lists, updates, and deletes a project", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ code: "ME", name: "Mechanical Engineering" })
      .expect(201);
    const created = (
      createResponse.body as {
        data: { id: number; code: string; name: string };
      }
    ).data;
    expect(created.name).toBe("Mechanical Engineering");
    expect(created.code).toBe("ME");

    const listResponse = await request(app.getHttpServer())
      .get("/projects-master/projects?limit=100")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const ids = (listResponse.body as { data: Array<{ id: number }> }).data.map(
      (p) => p.id,
    );
    expect(ids).toContain(created.id);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/projects-master/projects/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ description: "Hardware CAD & Thermal" })
      .expect(200);
    expect(
      (updateResponse.body as { data: { description: string } }).data
        .description,
    ).toBe("Hardware CAD & Thermal");

    await request(app.getHttpServer())
      .delete(`/projects-master/projects/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/projects-master/projects/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });

  it("rejects a duplicate project code within the same organization", async () => {
    await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ code: "SW", name: "Software" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ code: "SW", name: "Software (dup)" })
      .expect(409);
  });

  it("rejects an unknown field (whitelist validation)", async () => {
    await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        code: "EC",
        name: "Electrical",
        notADeclaredField: true,
      })
      .expect(400);
  });

  it("never lets one organization see, edit, or delete another organization's project", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/projects-master/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ code: "ISO", name: "Org A Only" })
      .expect(201);
    const projectId = (createResponse.body as { data: { id: number } }).data.id;

    const listAsB = await request(app.getHttpServer())
      .get("/projects-master/projects?limit=100")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const idsForB = (listAsB.body as { data: Array<{ id: number }> }).data.map(
      (p) => p.id,
    );
    expect(idsForB).not.toContain(projectId);

    await request(app.getHttpServer())
      .get(`/projects-master/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/projects-master/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/projects-master/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("returns default values for the project code format before any save", async () => {
    const response = await request(app.getHttpServer())
      .get("/projects-master/code-master")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(
      (response.body as { data: { companyPrefix: string } }).data,
    ).toMatchObject({ companyPrefix: "TXW", moduleIdentifier: "PRJ" });
  });

  it("upserts and persists the project code format within the caller's org", async () => {
    await request(app.getHttpServer())
      .put("/projects-master/code-master")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        companyPrefix: "TXW",
        moduleIdentifier: "PRJ",
        defaultProjectCode: "ME",
        financialYear: "26-27",
        sequenceDigits: 3,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/projects-master/code-master")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (response.body as { data: { financialYear: string } }).data,
    ).toMatchObject({ financialYear: "26-27", sequenceDigits: 3 });

    const responseForB = await request(app.getHttpServer())
      .get("/projects-master/code-master")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(
      (responseForB.body as { data: { financialYear: string } }).data
        .financialYear,
    ).not.toBe("26-27");
  });

  it("upserts and persists the task running-number format", async () => {
    await request(app.getHttpServer())
      .put("/projects-master/task-running-number-master")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ taskPrefix: "T", separator: "-", sequenceDigits: 2 })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/projects-master/task-running-number-master")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (response.body as { data: { taskPrefix: string } }).data,
    ).toMatchObject({ taskPrefix: "T", separator: "-", sequenceDigits: 2 });
  });

  it("rejects config writes from a reader without the write permission", async () => {
    await request(app.getHttpServer())
      .put("/projects-master/code-master")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ companyPrefix: "X" })
      .expect(403);
    await request(app.getHttpServer())
      .put("/projects-master/task-running-number-master")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ taskPrefix: "X" })
      .expect(403);
  });
});
