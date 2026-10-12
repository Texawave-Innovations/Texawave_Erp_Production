import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm accounts (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoPermission: string;
  let tokenB: string;

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
      data: { name: `Org A ${suffix}`, slug: `crm-acct-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-acct-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.account.read");
    const write = await permission("crm.account.write");

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

    await makeUser(orgA.id, "all-access@crm-acct-org-a.test", [
      read.id,
      write.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-acct-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-acct-org-b.test", [
      read.id,
      write.id,
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

    tokenAll = await login(orgA.slug, "all-access@crm-acct-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-acct-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-acct-org-b.test");
  });

  /** `audit_logs` is append-only at the DB level (a CHECK/trigger rejects
   * DELETE — Docs/ARCHITECTURE.md) and every write in this suite produces
   * one referencing `actorUserId`/`organizationId`, so the users, roles and
   * organizations created here are permanent residue BY DESIGN (same
   * tradeoff documented in test/support/e2e-guard.ts) — only the account
   * rows (not FK-referenced by audit_logs) are cleaned up. */
  afterAll(async () => {
    await prisma.account.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/crm/accounts").expect(401);
  });

  it("rejects a request with no crm.account permission at all with 403", async () => {
    await request(app.getHttpServer())
      .get("/crm/accounts")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("rejects create without a name (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/accounts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({})
      .expect(400);
  });

  it("rejects create with no crm.account.write permission with 403", async () => {
    await request(app.getHttpServer())
      .post("/crm/accounts")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .send({ name: "Should Not Be Created" })
      .expect(403);
  });

  it("creates and reads an account (list and by-id), with tenant isolation", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/accounts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Acme Test Co" })
      .expect(201);
    const created = (createRes.body as { data: { id: number; name: string } })
      .data;
    expect(created.name).toBe("Acme Test Co");

    await request(app.getHttpServer())
      .get(`/crm/accounts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get("/crm/accounts")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const listIds = (listRes.body as { data: { id: number }[] }).data.map(
      (a) => a.id,
    );
    expect(listIds).toContain(created.id);

    // Org B cannot see Org A's account — tenant isolation (404, not 403).
    await request(app.getHttpServer())
      .get(`/crm/accounts/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // Org B's list must not contain Org A's account either.
    const listResB = await request(app.getHttpServer())
      .get("/crm/accounts")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const listIdsB = (listResB.body as { data: { id: number }[] }).data.map(
      (a) => a.id,
    );
    expect(listIdsB).not.toContain(created.id);
  });

  it("updates an account's name", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/accounts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Before Update Co" })
      .expect(201);
    const created = (createRes.body as { data: { id: number } }).data;

    const updateRes = await request(app.getHttpServer())
      .patch(`/crm/accounts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "After Update Co" })
      .expect(200);
    expect((updateRes.body as { data: { name: string } }).data.name).toBe(
      "After Update Co",
    );

    // Org B cannot update Org A's account — tenant isolation (404).
    await request(app.getHttpServer())
      .patch(`/crm/accounts/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" })
      .expect(404);
  });
});
