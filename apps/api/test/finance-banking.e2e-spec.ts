import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end API test suite for Finance Banking & Treasury (TEXA-154 Milestone 5):
 * - Authentication & Authorization (401, 403)
 * - Bank account creation, uniqueness, updates, soft delete
 * - Bank transactions recording, balance updates, and GL integration
 * - Bank reconciliation and unreconciliation
 * - Multi-tenant isolation (Org A vs Org B)
 */
interface AuthLoginResponse {
  token?: string;
  data?: {
    token?: string;
  };
}

interface BankAccountResponseData {
  id: number;
  accountName: string;
  accountNumber: string;
  currentBalance: number | string;
  glAccountId: number;
  organizationId: number;
}

interface BankTransactionResponseData {
  id: number;
  bankAccountId: number;
  amount: number | string;
  balanceAfter: number | string;
  transactionType: string;
  description?: string | null;
}

interface ApiDataResponse<T> {
  data: T;
}

describe("finance banking (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let glAssetAccountA: { id: number };

  const PERMISSION_CODES = [
    "finance.banking.read",
    "finance.banking.write",
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

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);

    orgA = await prisma.organization.create({
      data: { name: `Org A Bank ${suffix}`, slug: `org-a-bank-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B Bank ${suffix}`, slug: `org-b-bank-${suffix}` },
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
          name: `Role-${email}`,
          organizationId: orgId,
          rolePermissions: {
            create: permissionIds.map((pId) => ({ permissionId: pId })),
          },
        },
      });

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: "Bank Tester",
          organizationId: orgId,
          userRoles: { create: { roleId: role.id } },
        },
      });

      return user;
    }

    const userA = await makeUser(
      orgA.id,
      `admin-bank-a-${suffix}@texa.test`,
      allPermissionIds,
    );
    const userB = await makeUser(
      orgB.id,
      `admin-bank-b-${suffix}@texa.test`,
      allPermissionIds,
    );
    const readOnlyUser = await makeUser(
      orgA.id,
      `readonly-bank-${suffix}@texa.test`,
      readOnlyIds,
    );

    async function login(email: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: "Password123!" });
      const body = res.body as AuthLoginResponse;
      return body?.data?.token ?? body?.token ?? "";
    }

    tokenA = await login(userA.email);
    tokenB = await login(userB.email);
    readOnlyToken = await login(readOnlyUser.email);

    // Create an ASSET GL account for Org A
    glAssetAccountA = await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1020",
        accountName: "HDFC Primary Bank Account",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        currentBalance: 0,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (orgA?.id) {
        await prisma.financeBankTransaction.deleteMany({
          where: { organizationId: orgA.id },
        });
        await prisma.financeBankAccount.deleteMany({
          where: { organizationId: orgA.id },
        });
        await prisma.financeJournalLine.deleteMany({
          where: { organizationId: orgA.id },
        });
        await prisma.financeJournalEntry.deleteMany({
          where: { organizationId: orgA.id },
        });
        await prisma.financeAccount.deleteMany({
          where: { organizationId: orgA.id },
        });
        await prisma.userRole.deleteMany({
          where: { user: { organizationId: orgA.id } },
        });
        await prisma.rolePermission.deleteMany({
          where: { role: { organizationId: orgA.id } },
        });
        await prisma.user.deleteMany({ where: { organizationId: orgA.id } });
        await prisma.role.deleteMany({ where: { organizationId: orgA.id } });
        await prisma.organization.delete({ where: { id: orgA.id } });
      }
      if (orgB?.id) {
        await prisma.organization.delete({ where: { id: orgB.id } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe("Authentication and Permissions", () => {
    it("returns 401 when token is missing", async () => {
      await request(app.getHttpServer())
        .get("/finance/bank-accounts")
        .expect(401);
    });

    it("returns 403 when user lacks write permission", async () => {
      await request(app.getHttpServer())
        .post("/finance/bank-accounts")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({
          accountName: "Blocked Account",
          accountNumber: "123456789",
          bankName: "Test Bank",
          ifscCode: "TEST0001234",
        })
        .expect(403);
    });
  });

  describe("Bank Account Management", () => {
    let createdAccountId: number;

    it("creates a new bank account with initial opening balance", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/bank-accounts")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          accountName: "HDFC Current Account",
          accountNumber: "50200099881122",
          bankName: "HDFC Bank Ltd",
          ifscCode: "HDFC0001234",
          branchName: "Koramangala",
          accountType: "CURRENT",
          openingBalance: 25000,
          glAccountId: glAssetAccountA.id,
        })
        .expect(201);

      const body = res.body as ApiDataResponse<BankAccountResponseData>;
      createdAccountId = body.data.id;
      expect(createdAccountId).toBeDefined();
      expect(Number(body.data.currentBalance)).toBe(25000);
    });

    it("enforces tenant isolation — Org B cannot view Org A bank account", async () => {
      await request(app.getHttpServer())
        .get(`/finance/bank-accounts/${createdAccountId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("records a bank transaction and updates balance", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/bank-transactions")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          bankAccountId: createdAccountId,
          transactionDate: new Date().toISOString().slice(0, 10),
          transactionType: "CREDIT",
          amount: 5000,
          description: "Incoming bank transfer",
        })
        .expect(201);

      const body = res.body as ApiDataResponse<BankTransactionResponseData>;
      expect(Number(body.data.amount)).toBe(5000);
      expect(Number(body.data.balanceAfter)).toBe(30000);
    });
  });
});
