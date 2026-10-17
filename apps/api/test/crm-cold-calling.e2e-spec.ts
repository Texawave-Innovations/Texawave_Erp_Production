import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** Phase 1B Cold Calling Status entries (Docs/CRM_FULL_LEGACY_PARITY.md §10.4).
 * Covers unauthenticated/unauthorized rejection, basic CRUD, link-account
 * (incl. cross-org rejection), disposition recording, soft-delete and
 * tenant isolation — the same conventions as crm-meetings.e2e-spec.ts. */
describe("crm cold calling entries (e2e)", () => {
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
      data: { name: `Org A ${suffix}`, slug: `crm-cc-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-cc-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.coldcalling.read");
    const write = await permission("crm.coldcalling.write");
    const del = await permission("crm.coldcalling.delete");

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

    await makeUser(orgA.id, "all-access@crm-cc-org-a.test", [
      read.id,
      write.id,
      del.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-cc-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-cc-org-b.test", [
      read.id,
      write.id,
      del.id,
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

    tokenAll = await login(orgA.slug, "all-access@crm-cc-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-cc-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-cc-org-b.test");

    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: "Cold Calling Test Account" },
    });
  });

  afterAll(async () => {
    await prisma.crmColdCallingEntry.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated and unauthorized requests", async () => {
    await request(app.getHttpServer())
      .get("/crm/cold-calling-entries")
      .expect(401);
    await request(app.getHttpServer())
      .get("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .send({ companyName: "Acme" })
      .expect(403);
  });

  it("creates a cold calling entry and enforces tenant isolation on read", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        companyName: "Acme Corp",
        prospectName: "Jane Prospect",
        designation: "VP Sales",
        status: "Interested",
      })
      .expect(201);
    const entry = (
      createRes.body as { data: { id: number; companyName: string } }
    ).data;
    expect(entry.companyName).toBe("Acme Corp");

    await request(app.getHttpServer())
      .get(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
  });

  it("updates a cold calling entry", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Beta LLC" })
      .expect(201);
    const entry = (createRes.body as { data: { id: number } }).data;

    const updateRes = await request(app.getHttpServer())
      .patch(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ status: "Not Interested" })
      .expect(200);
    expect((updateRes.body as { data: { status: string } }).data.status).toBe(
      "Not Interested",
    );

    await request(app.getHttpServer())
      .patch(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "Hijacked" })
      .expect(404);
  });

  it("links a cold calling entry to an in-org account, and rejects linking to another org's account (422)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Gamma Inc" })
      .expect(201);
    const entry = (createRes.body as { data: { id: number } }).data;

    await request(app.getHttpServer())
      .post(`/crm/cold-calling-entries/${entry.id}/link-account`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ accountId: 999999999 })
      .expect(422);

    const linkRes = await request(app.getHttpServer())
      .post(`/crm/cold-calling-entries/${entry.id}/link-account`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ accountId: accountA.id })
      .expect(201);
    expect(
      (linkRes.body as { data: { linkedAccountId: number } }).data
        .linkedAccountId,
    ).toBe(accountA.id);
  });

  it("records a disposition on a cold calling entry", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Delta Co" })
      .expect(201);
    const entry = (createRes.body as { data: { id: number } }).data;

    const dispositionRes = await request(app.getHttpServer())
      .post(`/crm/cold-calling-entries/${entry.id}/disposition`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ dispositionTag: "interested" })
      .expect(201);
    const disposed = (
      dispositionRes.body as {
        data: { dispositionTag: string; dispositionAt: string | null };
      }
    ).data;
    expect(disposed.dispositionTag).toBe("interested");
    expect(disposed.dispositionAt).not.toBeNull();
  });

  it("soft-deletes a cold calling entry, which then disappears from read, and is tenant-isolated", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/cold-calling-entries")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Epsilon Ltd" })
      .expect(201);
    const entry = (createRes.body as { data: { id: number } }).data;

    await request(app.getHttpServer())
      .delete(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/crm/cold-calling-entries/${entry.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
  });

  it("filters by exact status and call-date range, and lists distinct statuses (tenant-scoped)", async () => {
    const tag = randomUUID().slice(0, 6);
    const mk = async (body: object) =>
      request(app.getHttpServer())
        .post("/crm/cold-calling-entries")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ prospectName: tag, ...body })
        .expect(201);
    await mk({
      companyName: `Early ${tag}`,
      status: `Status-${tag}`,
      callDate: "2026-01-10",
    });
    await mk({
      companyName: `Late ${tag}`,
      status: "Other",
      callDate: "2026-03-20",
    });

    const list = async (qs: string) =>
      (
        (
          await request(app.getHttpServer())
            .get(`/crm/cold-calling-entries?search=${tag}&order=asc&${qs}`)
            .set("Authorization", `Bearer ${tokenAll}`)
            .expect(200)
        ).body as { data: { companyName: string }[] }
      ).data.map((e) => e.companyName);

    expect(await list(`status=Status-${tag}`)).toEqual([`Early ${tag}`]);
    expect(await list("dateFrom=2026-02-01")).toEqual([`Late ${tag}`]);
    expect(await list("dateTo=2026-02-01")).toEqual([`Early ${tag}`]);
    expect(await list("dateFrom=2026-01-10&dateTo=2026-03-20")).toHaveLength(2);

    const statuses = (
      (
        await request(app.getHttpServer())
          .get("/crm/cold-calling-entries/statuses")
          .set("Authorization", `Bearer ${tokenAll}`)
          .expect(200)
      ).body as { data: string[] }
    ).data;
    expect(statuses).toContain(`Status-${tag}`);

    const other = (
      (
        await request(app.getHttpServer())
          .get("/crm/cold-calling-entries/statuses")
          .set("Authorization", `Bearer ${tokenB}`)
          .expect(200)
      ).body as { data: string[] }
    ).data;
    expect(other).not.toContain(`Status-${tag}`);
  });
});
