import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end proof for apps/api/src/modules/settings/roles/ — role→
 * permission assignment via the API, replacing what used to be
 * seed.ts-only (Docs/ARCHITECTURE.md §11, 2026-09-22 changelog entry).
 * Structured like reference-tags.e2e-spec.ts: two organizations, so tenant
 * isolation is proven directly, plus a dedicated case proving that
 * revoking a permission actually takes effect on the very next request
 * (pins down the isActive-filter fix in
 * platform/roles-permissions/permissions.repository.ts, not just the
 * schema change alone).
 */
describe("settings roles (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let readPermission: { id: number; code: string };
  let writePermission: { id: number; code: string };

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

    readPermission = await prisma.permission.upsert({
      where: { code: "settings.role.read" },
      update: {},
      create: { code: "settings.role.read", description: "View roles" },
    });
    writePermission = await prisma.permission.upsert({
      where: { code: "settings.role.write" },
      update: {},
      create: { code: "settings.role.write", description: "Manage roles" },
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
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.role.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/settings/roles").expect(401);
  });

  it("rejects a request with a permission the user doesn't have", async () => {
    await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ name: "Should be forbidden" })
      .expect(403);
  });

  it("lists the permission catalog", async () => {
    const response = await request(app.getHttpServer())
      .get("/settings/permissions")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const codes = (response.body as { data: Array<{ code: string }> }).data.map(
      (p) => p.code,
    );
    expect(codes).toContain("settings.role.read");
    expect(codes).toContain("settings.role.write");
  });

  it("creates a role, lists it, assigns permissions, and reads them back", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Reports Viewer" })
      .expect(201);
    const created = (
      createResponse.body as { data: { id: number; name: string } }
    ).data;
    expect(created.name).toBe("Reports Viewer");

    const listResponse = await request(app.getHttpServer())
      .get("/settings/roles?page=1&limit=10")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const list = listResponse.body as { data: Array<{ id: number }> };
    expect(list.data.some((r) => r.id === created.id)).toBe(true);

    await request(app.getHttpServer())
      .put(`/settings/roles/${created.id}/permissions`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ permissionIds: [readPermission.id] })
      .expect(200);

    const detailResponse = await request(app.getHttpServer())
      .get(`/settings/roles/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const detail = (
      detailResponse.body as {
        data: { permissions: Array<{ code: string }> };
      }
    ).data;
    expect(detail.permissions.map((p) => p.code)).toEqual([
      "settings.role.read",
    ]);
  });

  it("revoking a permission denies access on the very next request, not after the cache TTL", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Temp Grant Role" })
      .expect(201);
    const roleId = (createResponse.body as { data: { id: number } }).data.id;

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `temp-${randomUUID().slice(0, 8)}@org-a.test`,
        passwordHash,
        fullName: "Temp User",
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });

    await request(app.getHttpServer())
      .put(`/settings/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ permissionIds: [writePermission.id] })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: orgA.slug,
        email: user.email,
        password: "Password123!",
      })
      .expect(201);
    const tempToken = (loginResponse.body as { data: { accessToken: string } })
      .data.accessToken;

    // Holds settings.role.write — can create a role.
    await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tempToken}`)
      .send({ name: "Created by temp user" })
      .expect(201);

    // Revoke the grant (not a delete — the RolePermission row survives with
    // isActive: false).
    await request(app.getHttpServer())
      .put(`/settings/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ permissionIds: [] })
      .expect(200);

    // Same token, no re-login, no wait — the very next request is denied.
    await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tempToken}`)
      .send({ name: "Should now be forbidden" })
      .expect(403);
  });

  it("never lets one organization see, edit, or assign permissions to another organization's role", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A only" })
      .expect(201);
    const roleId = (createResponse.body as { data: { id: number } }).data.id;

    const listAsB = await request(app.getHttpServer())
      .get("/settings/roles?limit=100")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const idsForB = (listAsB.body as { data: Array<{ id: number }> }).data.map(
      (r) => r.id,
    );
    expect(idsForB).not.toContain(roleId);

    await request(app.getHttpServer())
      .get(`/settings/roles/${roleId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/settings/roles/${roleId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .put(`/settings/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ permissionIds: [readPermission.id] })
      .expect(404);
  });

  it("rejects an unknown field (whitelist validation)", async () => {
    await request(app.getHttpServer())
      .post("/settings/roles")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Fine", notADeclaredField: true })
      .expect(400);
  });
});
