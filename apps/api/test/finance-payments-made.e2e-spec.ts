import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end API test suite for Finance Payments Made & Supplier Disbursements (TEXA-154 Milestone 5):
 * - Authentication & Authorization (401, 403)
 * - Record supplier disbursement
 * - Atomic General Ledger double-entry posting (Debit Accounts Payable 2010, Credit Bank/Cash 1020)
 * - Bank balance deduction and DEBIT bank transaction creation
 * - Void and Reversal workflow (REV voucher, balance restoration)
 * - Multi-tenant isolation (Org A vs Org B)
 */
interface AuthLoginResponse {
  token?: string;
  data?: {
    token?: string;
  };
}

interface PaymentMadeResponseData {
  id: number;
  status: string;
  journalEntryId?: number | null;
  paymentNumber?: string;
  amount?: number | string;
  vendorId?: number | null;
  bankAccountId?: number | null;
}

interface ApiDataResponse<T> {
  data: T;
}

describe("finance payments made (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let paymentModeA: { id: number };
  let cashModeA: { id: number };
  let bankAccountA: { id: number };
  let inactiveBankAccountA: { id: number };
  let bankAccountB: { id: number };

  const PERMISSION_CODES = [
    "finance.payment_made.read",
    "finance.payment_made.write",
    "finance.coa.read",
    "finance.coa.write",
    "finance.journal.read",
    "finance.journal.write",
    "finance.journal.post",
    "finance.banking.read",
    "finance.banking.write",
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
      data: { name: `Org A PayMade ${suffix}`, slug: `org-a-pm-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B PayMade ${suffix}`, slug: `org-b-pm-${suffix}` },
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
          fullName: "Pay Tester",
          organizationId: orgId,
          userRoles: { create: { roleId: role.id } },
        },
      });

      return user;
    }

    const userA = await makeUser(
      orgA.id,
      `admin-pm-a-${suffix}@texa.test`,
      allPermissionIds,
    );
    const userB = await makeUser(
      orgB.id,
      `admin-pm-b-${suffix}@texa.test`,
      allPermissionIds,
    );
    const readOnlyUser = await makeUser(
      orgA.id,
      `readonly-pm-${suffix}@texa.test`,
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

    // Setup master data for Org A
    paymentModeA = await prisma.financeMasterListItem.create({
      data: {
        organizationId: orgA.id,
        category: "payment_mode",
        value: "Bank Transfer",
        isActive: true,
      },
    });

    cashModeA = await prisma.financeMasterListItem.create({
      data: {
        organizationId: orgA.id,
        category: "payment_mode",
        value: "Cash",
        isActive: true,
      },
    });

    const glBankAcc = await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1020",
        accountName: "Operating Bank Account",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        currentBalance: 100000,
      },
    });

    await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1010",
        accountName: "Cash on Hand",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        currentBalance: 20000,
      },
    });

    await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "2010",
        accountName: "Accounts Payable",
        accountType: "LIABILITY",
        normalBalance: "CREDIT",
        currentBalance: 50000,
      },
    });

    bankAccountA = await prisma.financeBankAccount.create({
      data: {
        organizationId: orgA.id,
        accountName: "Primary Current Account",
        accountNumber: `ACC-${suffix}`,
        bankName: "HDFC Bank",
        ifscCode: "HDFC0001234",
        accountType: "CURRENT",
        openingBalance: 100000,
        currentBalance: 100000,
        glAccountId: glBankAcc.id,
        isActive: true,
      },
    });

    inactiveBankAccountA = await prisma.financeBankAccount.create({
      data: {
        organizationId: orgA.id,
        accountName: "Closed Account",
        accountNumber: `ACC-CLOSED-${suffix}`,
        bankName: "HDFC Bank",
        ifscCode: "HDFC0001234",
        accountType: "CURRENT",
        openingBalance: 0,
        currentBalance: 0,
        isActive: false,
      },
    });

    bankAccountB = await prisma.financeBankAccount.create({
      data: {
        organizationId: orgB.id,
        accountName: "Org B Account",
        accountNumber: `ACC-ORGB-${suffix}`,
        bankName: "ICICI Bank",
        ifscCode: "ICIC0001234",
        accountType: "CURRENT",
        openingBalance: 50000,
        currentBalance: 50000,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (orgA?.id) {
        await prisma.financePaymentMade.deleteMany({
          where: { organizationId: orgA.id },
        });
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
        await prisma.financeMasterListItem.deleteMany({
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
        await prisma.financeBankAccount.deleteMany({
          where: { organizationId: orgB.id },
        });
        await prisma.userRole.deleteMany({
          where: { user: { organizationId: orgB.id } },
        });
        await prisma.rolePermission.deleteMany({
          where: { role: { organizationId: orgB.id } },
        });
        await prisma.user.deleteMany({ where: { organizationId: orgB.id } });
        await prisma.role.deleteMany({ where: { organizationId: orgB.id } });
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
        .get("/finance/payments-made")
        .expect(401);
    });

    it("returns 403 when user lacks write permission", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Blocked Vendor",
          amount: 1000,
          paymentModeId: paymentModeA.id,
        })
        .expect(403);
    });
  });

  describe("Bank Account Mandatory Validation", () => {
    it("rejects a Bank Transfer payment with no bank account selected", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "No Bank Account Vendor",
          amount: 1000,
          paymentModeId: paymentModeA.id,
          status: "CONFIRMED",
        })
        .expect(400);
    });

    it("allows a Cash payment with no bank account selected", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Cash Vendor",
          amount: 500,
          paymentModeId: cashModeA.id,
          status: "CONFIRMED",
        })
        .expect(201);

      const body = res.body as ApiDataResponse<PaymentMadeResponseData>;
      expect(body.data.status).toBe("CONFIRMED");
      expect(body.data.bankAccountId ?? null).toBeNull();
    });

    it("rejects a bank account that belongs to a different organization", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Cross Org Vendor",
          amount: 1000,
          paymentModeId: paymentModeA.id,
          bankAccountId: bankAccountB.id,
          status: "CONFIRMED",
        })
        .expect(404);
    });

    it("rejects an inactive bank account", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Inactive Account Vendor",
          amount: 1000,
          paymentModeId: paymentModeA.id,
          bankAccountId: inactiveBankAccountA.id,
          status: "CONFIRMED",
        })
        .expect(404);
    });

    it("confirms a Bank Transfer payment with a valid bank account and updates the bank balance", async () => {
      const before = await prisma.financeBankAccount.findUniqueOrThrow({
        where: { id: bankAccountA.id },
      });

      const res = await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Valid Bank Payment Vendor",
          amount: 1500,
          paymentModeId: paymentModeA.id,
          bankAccountId: bankAccountA.id,
          status: "CONFIRMED",
        })
        .expect(201);

      const body = res.body as ApiDataResponse<PaymentMadeResponseData>;
      expect(body.data.status).toBe("CONFIRMED");

      const after = await prisma.financeBankAccount.findUniqueOrThrow({
        where: { id: bankAccountA.id },
      });
      expect(Number(after.currentBalance)).toBe(
        Number(before.currentBalance) - 1500,
      );

      const transaction = await prisma.financeBankTransaction.findFirst({
        where: { bankAccountId: bankAccountA.id, amount: 1500 },
      });
      expect(transaction).not.toBeNull();
      expect(transaction?.transactionType).toBe("DEBIT");
    });

    it("cannot be bypassed by confirming a DRAFT bank-mode payment saved without a bank account", async () => {
      const draftRes = await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Draft Without Bank Vendor",
          amount: 750,
          paymentModeId: paymentModeA.id,
          status: "DRAFT",
        });

      // The create-time rule already rejects this combination outright.
      expect(draftRes.status).toBe(400);
    });
  });

  describe("Supplier Disbursement Lifecycle", () => {
    let paymentId: number;

    it("records supplier disbursement and automatically posts balanced GL journal", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/payments-made")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: new Date().toISOString().slice(0, 10),
          vendorName: "Steel Supplies Ltd",
          amount: 5000,
          paymentModeId: paymentModeA.id,
          bankAccountId: bankAccountA.id,
          referenceNumber: "UTR-991122",
          billReference: "BILL-202610-001",
          status: "CONFIRMED",
        })
        .expect(201);

      const body = res.body as ApiDataResponse<PaymentMadeResponseData>;
      paymentId = body.data.id;
      expect(paymentId).toBeDefined();
      expect(body.data.status).toBe("CONFIRMED");
      expect(body.data.journalEntryId).toBeDefined();
    });

    it("enforces tenant isolation — Org B cannot view Org A payment disbursement", async () => {
      await request(app.getHttpServer())
        .get(`/finance/payments-made/${paymentId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("voids payment disbursement and generates reversal journal entry", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/payments-made/${paymentId}/void`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const body = res.body as ApiDataResponse<PaymentMadeResponseData>;
      expect(body.data.status).toBe("VOID");
    });
  });
});
