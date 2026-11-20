import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("departments (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;

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
      data: { name: `Org A ${suffix}`, slug: `org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-${suffix}` },
    });

    const readPermission = await prisma.permission.upsert({
      where: { code: "departments.department.read" },
      update: {},
      create: {
        code: "departments.department.read",
        description: "Read departments",
      },
    });
    const writePermission = await prisma.permission.upsert({
      where: { code: "departments.department.write" },
      update: {},
      create: {
        code: "departments.department.write",
        description: "Write departments",
      },
    });

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

    await makeUser(orgA.id, "full-access@org-a.test", [
      readPermission.id,
      writePermission.id,
    ]);
    await makeUser(orgB.id, "full-access@org-b.test", [
      readPermission.id,
      writePermission.id,
    ]);
    await makeUser(orgA.id, "read-only@org-a.test", [readPermission.id]);

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

    tokenA = await login(orgA.slug, "full-access@org-a.test");
    tokenB = await login(orgB.slug, "full-access@org-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@org-a.test");
  });

  afterAll(async () => {
    // Users and organizations stay: department writes now produce audit rows
    // and audit_logs is append-only with an FK to the actor (test/README.md).
    await prisma.department.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/departments").expect(401);
  });

  it("rejects unpermitted write request with 403", async () => {
    await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ name: "Unpermitted Department" })
      .expect(403);
  });

  it("creates, reads, updates, and soft-deletes a department with tenant isolation", async () => {
    // 1. Create in Org A
    const createRes = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Engineering" })
      .expect(201);

    const created = (createRes.body as { data: { id: number; name: string } })
      .data;
    expect(created.name).toBe("Engineering");

    // 2. Read back in Org A
    const getRes = await request(app.getHttpServer())
      .get(`/departments/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect((getRes.body as { data: { id: number } }).data.id).toBe(created.id);

    // 3. Org B cannot see Org A's department (tenant isolation -> 404)
    await request(app.getHttpServer())
      .get(`/departments/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // 4. Duplicate name within same org is rejected (409)
    await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Engineering" })
      .expect(409);

    // 5. Update department
    const updateRes = await request(app.getHttpServer())
      .patch(`/departments/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "R&D Engineering" })
      .expect(200);
    expect((updateRes.body as { data: { name: string } }).data.name).toBe(
      "R&D Engineering",
    );

    // 6. Delete department (soft delete)
    await request(app.getHttpServer())
      .delete(`/departments/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    // 7. Reading deleted department returns 404
    await request(app.getHttpServer())
      .get(`/departments/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });

  describe("EMP-16: department changes are audited", () => {
    const rows = (departmentId: number) =>
      prisma.auditLog.findMany({
        where: {
          entityType: "department",
          entityId: BigInt(departmentId),
        },
        orderBy: { id: "asc" },
      });
    const asA = (method: "post" | "patch" | "delete", path: string) =>
      request(app.getHttpServer())
        [method](path)
        .set("Authorization", `Bearer ${tokenA}`);

    it("create, update and delete each write one audit row naming only name and isActive", async () => {
      const created = await asA("post", "/departments")
        .send({
          name: "Audited Dept",
          customFields: { note: "secret-custom-value" },
        })
        .expect(201);
      const id = (created.body as { data: { id: number } }).data.id;

      await asA("patch", `/departments/${id}`)
        .send({ name: "Audited Dept Renamed" })
        .expect(200);
      await asA("delete", `/departments/${id}`).expect(204);

      const list = await rows(id);
      expect(list.map((r) => r.action)).toEqual(["create", "update", "delete"]);
      expect(list[0]?.after).toEqual({ name: "Audited Dept", isActive: true });
      expect(list[1]?.before).toEqual({
        name: "Audited Dept",
        isActive: true,
      });
      expect(list[1]?.after).toEqual({
        name: "Audited Dept Renamed",
        isActive: true,
      });
      expect(list[2]?.before).toEqual({
        name: "Audited Dept Renamed",
        isActive: true,
      });
      for (const r of list) {
        expect(r.actorUserId).not.toBeNull();
        expect(r.organizationId).toBe(orgA.id);
        expect(JSON.stringify([r.before, r.after, r.reason])).not.toContain(
          "secret-custom-value",
        );
      }
    });

    it("a refused or failed change writes no audit row", async () => {
      const created = await asA("post", "/departments")
        .send({ name: "Refusal Dept" })
        .expect(201);
      const id = (created.body as { data: { id: number } }).data.id;
      const before = (await rows(id)).length;

      // Read-only user (403) and another organization (404) change nothing.
      await request(app.getHttpServer())
        .patch(`/departments/${id}`)
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ name: "Nope" })
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/departments/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ name: "Nope" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/departments/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
      // A duplicate name is refused by the service before any write.
      await asA("post", "/departments")
        .send({ name: "Refusal Dept" })
        .expect(409);

      expect((await rows(id)).length).toBe(before);
    });

    it("re-creating a removed department revives the row and audits it as a create", async () => {
      const first = await asA("post", "/departments")
        .send({ name: "Revived Dept" })
        .expect(201);
      const id = (first.body as { data: { id: number } }).data.id;
      await asA("delete", `/departments/${id}`).expect(204);
      const again = await asA("post", "/departments")
        .send({ name: "Revived Dept" })
        .expect(201);
      expect((again.body as { data: { id: number } }).data.id).toBe(id);
      expect((await rows(id)).map((r) => r.action)).toEqual([
        "create",
        "delete",
        "create",
      ]);
    });
  });
});
