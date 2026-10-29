import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end API test suite for Chart of Accounts (TEXA-154):
 * - Authentication & Authorization (401, 403)
 * - Validation & Business Rule Exceptions (400, 409, 422)
 * - Multi-tenant isolation (Org A vs Org B)
 * - Hierarchy tree generation
 * - Deletion constraints
 */
describe("finance accounts (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;

  const PERMISSION_CODES = ["finance.coa.read", "finance.coa.write"];

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
      data: { name: `Org A COA ${suffix}`, slug: `org-a-coa-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B COA ${suffix}`, slug: `org-b-coa-${suffix}` },
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

    await makeUser(orgA.id, "full-access@coa-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@coa-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@coa-a.test", readOnlyIds);

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

    tokenA = await login(orgA.slug, "full-access@coa-a.test");
    tokenB = await login(orgB.slug, "full-access@coa-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@coa-a.test");
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.financeAccount.deleteMany({
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

  it("rejects unauthenticated requests", async () => {
    await request(app.getHttpServer()).get("/finance/accounts").expect(401);
  });

  it("rejects write operations without write permission", async () => {
    await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({
        accountCode: "1000",
        accountName: "Current Assets",
        accountType: "ASSET",
      })
      .expect(403);
  });

  it("rejects invalid accountType with 400 Bad Request", async () => {
    await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "1000",
        accountName: "Invalid Asset",
        accountType: "INVALID_TYPE",
      })
      .expect(400);
  });

  it("creates a root account and a child account in Org A", async () => {
    // 1. Create root asset
    const rootRes = await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "1000",
        accountName: "Current Assets",
        accountType: "ASSET",
      })
      .expect(201);

    const rootAccount = (
      rootRes.body as { data: { id: number; accountCode: string } }
    ).data;
    expect(rootAccount.accountCode).toBe("1000");

    // 2. Reject duplicate accountCode in Org A (409)
    await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "1000",
        accountName: "Duplicate Assets",
        accountType: "ASSET",
      })
      .expect(409);

    // 3. Create child account under root
    const childRes = await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "1010",
        accountName: "Cash on Hand",
        accountType: "ASSET",
        parentAccountId: rootAccount.id,
      })
      .expect(201);

    const childAccount = (
      childRes.body as { data: { id: number; parentAccountId: number } }
    ).data;
    expect(childAccount.parentAccountId).toBe(rootAccount.id);

    // 4. Reject child with mismatched accountType (422)
    await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "2010",
        accountName: "Mismatch Payable",
        accountType: "LIABILITY",
        parentAccountId: rootAccount.id,
      })
      .expect(422);

    // 5. Verify hierarchy in tree endpoint
    const treeRes = await request(app.getHttpServer())
      .get("/finance/accounts/tree")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const tree = (
      treeRes.body as {
        data: Array<{ id: number; children: Array<{ id: number }> }>;
      }
    ).data;
    const foundRoot = tree.find((n) => n.id === rootAccount.id);
    expect(foundRoot).toBeDefined();
    expect(foundRoot?.children.some((c) => c.id === childAccount.id)).toBe(
      true,
    );

    // 6. Test cycle prevention (422)
    await request(app.getHttpServer())
      .patch(`/finance/accounts/${rootAccount.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ parentAccountId: childAccount.id })
      .expect(422);

    // 7. Test self-parenting prevention (422)
    await request(app.getHttpServer())
      .patch(`/finance/accounts/${rootAccount.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ parentAccountId: rootAccount.id })
      .expect(422);

    // 8. Prevent deleting root account while child exists (422)
    await request(app.getHttpServer())
      .delete(`/finance/accounts/${rootAccount.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(422);

    // 9. Delete child account successfully (204)
    await request(app.getHttpServer())
      .delete(`/finance/accounts/${childAccount.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    // 10. Delete root account now that children are gone (204)
    await request(app.getHttpServer())
      .delete(`/finance/accounts/${rootAccount.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);
  });

  it("enforces strict multi-tenant isolation between Org A and Org B", async () => {
    // 1. Create account in Org A
    const resA = await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        accountCode: "9000",
        accountName: "Org A Isolated Account",
        accountType: "EQUITY",
      })
      .expect(201);

    const accountA = (resA.body as { data: { id: number } }).data;

    // 2. Org B cannot read Org A's account (404)
    await request(app.getHttpServer())
      .get(`/finance/accounts/${accountA.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // 3. Org B cannot update Org A's account (404)
    await request(app.getHttpServer())
      .patch(`/finance/accounts/${accountA.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ accountName: "Hacked Name" })
      .expect(404);

    // 4. Org B cannot delete Org A's account (404)
    await request(app.getHttpServer())
      .delete(`/finance/accounts/${accountA.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // 5. Org B CAN create an account with the SAME code "9000" (isolated namespace)
    const resB = await request(app.getHttpServer())
      .post("/finance/accounts")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        accountCode: "9000",
        accountName: "Org B Coexisting Account",
        accountType: "EQUITY",
      })
      .expect(201);

    const accountB = (resB.body as { data: { id: number } }).data;
    expect(accountB.id).not.toBe(accountA.id);

    // Clean up
    await request(app.getHttpServer())
      .delete(`/finance/accounts/${accountA.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/finance/accounts/${accountB.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(204);
  });
});
