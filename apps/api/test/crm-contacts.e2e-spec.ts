import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm contacts (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let accountA: { id: number };
  let accountB: { id: number };
  let tokenAll: string;
  let tokenOwnOther: string;
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
      data: { name: `Org A ${suffix}`, slug: `crm-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-org-b-${suffix}` },
    });

    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Acme A ${suffix}` },
    });
    accountB = await prisma.account.create({
      data: { organizationId: orgB.id, name: `Acme B ${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const readAll = await permission("crm.contact.read.all");
    const writeAll = await permission("crm.contact.write.all");
    const readOwn = await permission("crm.contact.read.own");
    const writeOwn = await permission("crm.contact.write.own");

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

    await makeUser(orgA.id, "all-access@crm-org-a.test", [
      readAll.id,
      writeAll.id,
    ]);
    await makeUser(orgA.id, "own-only@crm-org-a.test", [
      readOwn.id,
      writeOwn.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-org-b.test", [
      readAll.id,
      writeAll.id,
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

    tokenAll = await login(orgA.slug, "all-access@crm-org-a.test");
    tokenOwnOther = await login(orgA.slug, "own-only@crm-org-a.test");
    tokenNoPermission = await login(orgA.slug, "no-permission@crm-org-a.test");
    tokenB = await login(orgB.slug, "all-access@crm-org-b.test");
  });

  /** `audit_logs` is append-only at the DB level (a CHECK/trigger rejects
   * DELETE — Docs/ARCHITECTURE.md) and every write in this suite produces
   * one referencing `actorUserId`/`organizationId`, so the users, roles and
   * organizations created here are permanent residue BY DESIGN (same
   * tradeoff documented in test/support/e2e-guard.ts) — only the
   * contact/account rows (not FK-referenced by audit_logs) are cleaned up. */
  afterAll(async () => {
    await prisma.contact.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/crm/contacts").expect(401);
  });

  it("rejects a request with no crm.contact permission at all with 403", async () => {
    await request(app.getHttpServer())
      .get("/crm/contacts")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("rejects create without a name (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ accountId: accountA.id })
      .expect(400);
  });

  it("rejects create without accountId (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Jane Doe" })
      .expect(400);
  });

  it("rejects create with an accountId that does not exist (422)", async () => {
    await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Jane Doe", accountId: 999_999_999 })
      .expect(422);
  });

  it("rejects create with another organization's accountId (422 — not found in this org)", async () => {
    await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Cross Org", accountId: accountB.id })
      .expect(422);
  });

  it("creates, reads, updates, and soft-deletes a contact with tenant isolation", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        name: "Jane Doe",
        accountId: accountA.id,
        email: "jane@acme.test",
      })
      .expect(201);
    const created = (createRes.body as { data: { id: number; name: string } })
      .data;
    expect(created.name).toBe("Jane Doe");

    await request(app.getHttpServer())
      .get(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);

    // Org B cannot see Org A's contact — tenant isolation (404, not 403).
    await request(app.getHttpServer())
      .get(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const updateRes = await request(app.getHttpServer())
      .patch(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ designation: "CTO" })
      .expect(200);
    expect(
      (updateRes.body as { data: { designation: string } }).data.designation,
    ).toBe("CTO");

    await request(app.getHttpServer())
      .delete(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);

    // Soft-deleted: excluded from reads, but the row still exists.
    await request(app.getHttpServer())
      .get(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
    const stillExists = await prisma.contact.findUnique({
      where: { id: created.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.deletedAt).not.toBeNull();
  });

  it("lists linked deal / quote counts for the delete warning", async () => {
    const contact = await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        name: `Linked ${randomUUID().slice(0, 6)}`,
      },
    });
    const stage = await prisma.pipelineStage
      .findFirstOrThrow({
        where: { organizationId: orgA.id },
      })
      .catch(async () =>
        prisma.pipelineStage.create({
          data: {
            organizationId: orgA.id,
            code: `s${randomUUID().slice(0, 6)}`,
            label: "Linked stage",
            order: 1,
          },
        }),
      );
    const deal = await prisma.opportunity.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        contactId: contact.id,
        opportunityNumber: "OPP-LNK",
        title: "Linked deal",
        ownerName: "Rep",
        stageId: stage.id,
      },
    });
    const res = await request(app.getHttpServer())
      .get(`/crm/contacts?q=${encodeURIComponent(contact.name)}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const row = (
      res.body as {
        data: {
          id: number;
          linkedOpportunityCount: number;
          linkedQuotationCount: number;
        }[];
      }
    ).data.find((c) => c.id === contact.id);
    expect(row?.linkedOpportunityCount).toBe(1);
    expect(row?.linkedQuotationCount).toBe(0);
    // Created directly (no stage history), so it can be hard-deleted and
    // not pin the account for the suite cleanup.
    await prisma.opportunity.delete({ where: { id: deal.id } });
  });

  it("Org B cannot update Org A's contact — tenant isolation (404), and the contact is left unchanged", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        name: "Cross Org Patch Target",
        accountId: accountA.id,
        designation: "Original",
      })
      .expect(201);
    const created = (createRes.body as { data: { id: number } }).data;

    const before = await prisma.contact.findUnique({
      where: { id: created.id },
    });

    await request(app.getHttpServer())
      .patch(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ designation: "Hijacked" })
      .expect(404);

    const after = await prisma.contact.findUnique({
      where: { id: created.id },
    });
    expect(after?.designation).toBe(before?.designation);
    expect(after?.name).toBe(before?.name);
    expect(after?.updatedBy).toBe(before?.updatedBy);
    expect(after?.deletedAt).toBeNull();
  });

  it("Org B cannot delete Org A's contact — tenant isolation (404), and the contact is left intact", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Cross Org Delete Target", accountId: accountA.id })
      .expect(201);
    const created = (createRes.body as { data: { id: number } }).data;

    const before = await prisma.contact.findUnique({
      where: { id: created.id },
    });

    await request(app.getHttpServer())
      .delete(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const after = await prisma.contact.findUnique({
      where: { id: created.id },
    });
    expect(after?.deletedAt).toBeNull();
    expect(after?.isActive).toBe(before?.isActive);
    expect(after?.updatedBy).toBe(before?.updatedBy);

    // Org A (the owning org) can still read it — proves it was never touched.
    await request(app.getHttpServer())
      .get(`/crm/contacts/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
  });

  it("'.own' scope sees only contacts it created itself; '.all' sees every org contact", async () => {
    const byAll = await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Created By All", accountId: accountA.id })
      .expect(201);
    const byOwn = await request(app.getHttpServer())
      .post("/crm/contacts")
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ name: "Created By Own", accountId: accountA.id })
      .expect(201);

    const ownList = await request(app.getHttpServer())
      .get("/crm/contacts")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .expect(200);
    const ownIds = (ownList.body as { data: { id: number }[] }).data.map(
      (c) => c.id,
    );
    expect(ownIds).toContain((byOwn.body as { data: { id: number } }).data.id);
    expect(ownIds).not.toContain(
      (byAll.body as { data: { id: number } }).data.id,
    );

    const allList = await request(app.getHttpServer())
      .get("/crm/contacts")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const allIds = (allList.body as { data: { id: number }[] }).data.map(
      (c) => c.id,
    );
    expect(allIds).toContain((byOwn.body as { data: { id: number } }).data.id);
    expect(allIds).toContain((byAll.body as { data: { id: number } }).data.id);
  });
});
