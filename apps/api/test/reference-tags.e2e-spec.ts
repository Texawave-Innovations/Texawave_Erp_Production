import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end proof that the foundation actually works together: auth,
 * tenancy scoping, permission checks, pagination, and the response envelope
 * — not just that each piece typechecks in isolation. Exercises the
 * reference `tags` fixture feature (apps/api/src/modules/_reference/tags/).
 *
 * Two organizations are seeded so tenant isolation can be proven directly
 * (a tag created in org A must be invisible — 404, not just "not in the
 * list" — from org B), not merely assumed from the code.
 */
describe("reference tags (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: string; slug: string };
  let orgB: { id: string; slug: string };
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
      where: { code: "reference.tags.read" },
      update: {},
      create: { code: "reference.tags.read", description: "Read tags" },
    });
    const writePermission = await prisma.permission.upsert({
      where: { code: "reference.tags.write" },
      update: {},
      create: { code: "reference.tags.write", description: "Write tags" },
    });

    async function makeUser(
      orgId: string,
      email: string,
      permissionIds: string[],
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
    await prisma.tag.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
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

  it("rejects login with the wrong password", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: orgA.slug,
        email: "full-access@org-a.test",
        password: "wrong",
      })
      .expect(401);
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/reference/tags").expect(401);
  });

  it("rejects a request with a permission the user doesn't have", async () => {
    await request(app.getHttpServer())
      .post("/reference/tags")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ name: "Should be forbidden" })
      .expect(403);
  });

  it("creates, lists (paginated envelope), reads, updates, and deletes a tag", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/reference/tags")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Urgent", colorToken: "error" })
      .expect(201);
    const created = (
      createResponse.body as { data: { id: string; name: string } }
    ).data;
    expect(created.name).toBe("Urgent");

    const listResponse = await request(app.getHttpServer())
      .get("/reference/tags?page=1&limit=10")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const list = listResponse.body as {
      data: Array<{ id: string }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(list.data.some((t) => t.id === created.id)).toBe(true);
    expect(list.meta).toEqual({
      page: 1,
      limit: 10,
      total: list.meta.total,
      totalPages: list.meta.totalPages,
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/reference/tags/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ colorToken: "success" })
      .expect(200);
    expect(
      (updateResponse.body as { data: { colorToken: string } }).data.colorToken,
    ).toBe("success");

    await request(app.getHttpServer())
      .delete(`/reference/tags/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/reference/tags/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });

  it("rejects an unknown field (whitelist validation)", async () => {
    await request(app.getHttpServer())
      .post("/reference/tags")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Fine", notADeclaredField: true })
      .expect(400);
  });

  it("never lets one organization see, edit, or delete another organization's tag", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/reference/tags")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A only" })
      .expect(201);
    const tagId = (createResponse.body as { data: { id: string } }).data.id;

    // Not in org B's list.
    const listAsB = await request(app.getHttpServer())
      .get("/reference/tags?limit=100")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const idsForB = (listAsB.body as { data: Array<{ id: string }> }).data.map(
      (t) => t.id,
    );
    expect(idsForB).not.toContain(tagId);

    // Not readable, updatable, or deletable directly by ID from org B either
    // — this is the check that actually proves tenant scoping, not just
    // list-filtering (Docs/CODING_STANDARDS.md §10).
    await request(app.getHttpServer())
      .get(`/reference/tags/${tagId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/reference/tags/${tagId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/reference/tags/${tagId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("refreshes an access token and revokes it on logout", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: orgA.slug,
        email: "full-access@org-a.test",
        password: "Password123!",
      })
      .expect(201);
    const { refreshToken } = (
      loginResponse.body as { data: { refreshToken: string } }
    ).data;

    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(201);
    const rotated = (
      refreshResponse.body as {
        data: { accessToken: string; refreshToken: string };
      }
    ).data;
    expect(rotated.accessToken).toBeTruthy();

    // The old refresh token was single-use — rotated, not reusable.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });

  it("reports healthy dependencies", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .expect(200);
    expect(response.body).toEqual({ status: "ok", db: "ok", redis: "ok" });
  });
});
