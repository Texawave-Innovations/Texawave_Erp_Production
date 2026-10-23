import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end proof for the Finance Master foundation: auth, org scoping,
 * permission checks, and tenant isolation for the generic master-list-item
 * resource behind the Expense Types / Payment Modes cards. Modeled on
 * apps/api/test/sales-settings.e2e-spec.ts's "master list items" block,
 * which this module's repository/service/controller mirror 1:1.
 *
 * Two organizations are seeded so tenant isolation is proven directly (a
 * row created in org A must be invisible — 404, not just "not in the
 * list" — from org B), not merely assumed from the code.
 */
describe("finance settings (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;

  const PERMISSION_CODES = [
    "finance_settings.master_list_item.read",
    "finance_settings.master_list_item.write",
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
      data: { name: `Org A ${suffix}`, slug: `org-a-fin-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-fin-${suffix}` },
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

    await makeUser(orgA.id, "full-access@finance-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@finance-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@finance-a.test", readOnlyIds);

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

    tokenA = await login(orgA.slug, "full-access@finance-a.test");
    tokenB = await login(orgB.slug, "full-access@finance-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@finance-a.test");
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.financeMasterListItem.deleteMany({
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
      .get("/finance-settings/master-list-items?category=expense_type")
      .expect(401);
  });

  it("rejects a write from a reader without the write permission", async () => {
    await request(app.getHttpServer())
      .post("/finance-settings/master-list-items")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ category: "expense_type", value: "Should be forbidden" })
      .expect(403);
  });

  it("creates, lists by category, updates, and deletes an expense type", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/finance-settings/master-list-items")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ category: "expense_type", value: "Travel" })
      .expect(201);
    const created = (createResponse.body as { data: { id: number } }).data;

    const listResponse = await request(app.getHttpServer())
      .get(
        "/finance-settings/master-list-items?category=expense_type&limit=100",
      )
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (listResponse.body as { data: Array<{ id: number }> }).data.some(
        (i) => i.id === created.id,
      ),
    ).toBe(true);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/finance-settings/master-list-items/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ value: "Office Supplies" })
      .expect(200);
    expect(
      (updateResponse.body as { data: { value: string } }).data.value,
    ).toBe("Office Supplies");

    await request(app.getHttpServer())
      .delete(`/finance-settings/master-list-items/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);
  });

  it("requires category on list and rejects category on update (immutable)", async () => {
    await request(app.getHttpServer())
      .get("/finance-settings/master-list-items")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(400);

    const createResponse = await request(app.getHttpServer())
      .post("/finance-settings/master-list-items")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ category: "payment_mode", value: "Cash" })
      .expect(201);
    const id = (createResponse.body as { data: { id: number } }).data.id;

    await request(app.getHttpServer())
      .patch(`/finance-settings/master-list-items/${id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ category: "expense_type" })
      .expect(400);
  });

  it("never lets one organization see, edit, or delete another's master list item", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/finance-settings/master-list-items")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ category: "payment_mode", value: "Org A Only" })
      .expect(201);
    const id = (createResponse.body as { data: { id: number } }).data.id;

    const listAsB = await request(app.getHttpServer())
      .get(
        "/finance-settings/master-list-items?category=payment_mode&limit=100",
      )
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const idsForB = (listAsB.body as { data: Array<{ id: number }> }).data.map(
      (i) => i.id,
    );
    expect(idsForB).not.toContain(id);

    await request(app.getHttpServer())
      .get(`/finance-settings/master-list-items/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/finance-settings/master-list-items/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ value: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/finance-settings/master-list-items/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });
});
