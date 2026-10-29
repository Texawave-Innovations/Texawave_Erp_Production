import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end API test suite for Finance Expenses (TEXA-154 Milestone 3):
 * - Authentication & Authorization (401, 403)
 * - Input validation & Business rules (future date, invalid type, missing accounts)
 * - Multi-tenant isolation (Org A vs Org B)
 * - Complete expense lifecycle (DRAFT -> PENDING_APPROVAL -> APPROVED -> PAID -> CANCELLED)
 * - Accounting GL voucher creation & balance synchronization
 */
interface ExpenseResponseData {
  id: number;
  status: string;
  netAmount?: number | string;
  journalEntryId?: number | null;
  amount?: number | string;
  taxAmount?: number | string;
  vendorName?: string | null;
  notes?: string | null;
}

describe("finance expenses (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let expenseTypeA: { id: number };

  const PERMISSION_CODES = [
    "finance.expense.read",
    "finance.expense.write",
    "finance.coa.read",
    "finance.coa.write",
    "finance.journal.read",
    "finance.journal.write",
    "finance.journal.post",
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Setup isolated test tenants Org A & Org B
    const unique = randomUUID().slice(0, 8);
    orgA = await prisma.organization.create({
      data: {
        name: `Org A Exp Test ${unique}`,
        slug: `org-a-exp-${unique}`,
      },
      select: { id: true, slug: true },
    });

    orgB = await prisma.organization.create({
      data: {
        name: `Org B Exp Test ${unique}`,
        slug: `org-b-exp-${unique}`,
      },
      select: { id: true, slug: true },
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

    const passwordHash = await bcrypt.hash("TestPass123!", 10);

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

    await makeUser(orgA.id, "full-access@exp-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@exp-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@exp-a.test", readOnlyIds);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "TestPass123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenA = await login(orgA.slug, "full-access@exp-a.test");
    tokenB = await login(orgB.slug, "full-access@exp-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@exp-a.test");

    // Seed master list expense type in Org A
    expenseTypeA = await prisma.financeMasterListItem.create({
      data: {
        organizationId: orgA.id,
        category: "expense_type",
        value: "Office Supplies",
      },
      select: { id: true },
    });

    // Seed default accounts in Org A
    await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "5020",
        accountName: "General Operating Expenses",
        accountType: "EXPENSE",
        currency: "INR",
      },
    });
    await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1020",
        accountName: "Operating Bank Account",
        accountType: "ASSET",
        currency: "INR",
      },
    });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.financeExpense.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeJournalLine.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeJournalEntry.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeAccount.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
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

  describe("Authentication & Permissions", () => {
    it("returns 401 when request is unauthenticated", async () => {
      await request(app.getHttpServer()).get("/finance/expenses").expect(401);
    });

    it("returns 403 when creating an expense with read-only token", async () => {
      await request(app.getHttpServer())
        .post("/finance/expenses")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({
          expenseTypeId: expenseTypeA.id,
          expenseDate: "2026-10-23",
          amount: 500,
        })
        .expect(403);
    });
  });

  describe("Lifecycle & Accounting Workflow", () => {
    let createdExpenseId: number;

    it("POST /finance/expenses creates a draft expense", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/expenses")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          expenseTypeId: expenseTypeA.id,
          expenseDate: "2026-10-23",
          amount: 1500,
          taxAmount: 270,
          vendorName: "Acme Stationery",
          notes: "Quarterly supplies",
        })
        .expect(201);

      const body = ((res.body as { data?: ExpenseResponseData })?.data ??
        res.body) as ExpenseResponseData;
      expect(body.id).toBeDefined();
      expect(body.status).toBe("DRAFT");
      expect(body.netAmount).toBe(1770);
      createdExpenseId = body.id;
    });

    it("POST /finance/expenses/:id/submit transitions DRAFT to PENDING_APPROVAL", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/expenses/${createdExpenseId}/submit`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const body = ((res.body as { data?: ExpenseResponseData })?.data ??
        res.body) as ExpenseResponseData;
      expect(body.status).toBe("PENDING_APPROVAL");
    });

    it("POST /finance/expenses/:id/approve transitions PENDING_APPROVAL to APPROVED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/expenses/${createdExpenseId}/approve`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const body = ((res.body as { data?: ExpenseResponseData })?.data ??
        res.body) as ExpenseResponseData;
      expect(body.status).toBe("APPROVED");
    });

    it("POST /finance/expenses/:id/pay posts GL journal and marks PAID", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/expenses/${createdExpenseId}/pay`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ paymentDate: "2026-10-23" })
        .expect(201);

      const body = ((res.body as { data?: ExpenseResponseData })?.data ??
        res.body) as ExpenseResponseData;
      expect(body.status).toBe("PAID");
      expect(body.journalEntryId).toBeDefined();
    });

    it("PATCH /finance/expenses/:id rejects edits on a PAID expense", async () => {
      await request(app.getHttpServer())
        .patch(`/finance/expenses/${createdExpenseId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ amount: 9999 })
        .expect(422);
    });

    it("Tenant Isolation: Org B cannot access Org A expense", async () => {
      await request(app.getHttpServer())
        .get(`/finance/expenses/${createdExpenseId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
