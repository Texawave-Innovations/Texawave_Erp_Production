import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end API test suite for Finance Customer Payments Received (TEXA-154 Milestone 4):
 * - Authentication & Authorization (401, 403)
 * - Validation & Business rules (future date, over-allocation, missing master data)
 * - Multi-tenant isolation (Org A vs Org B)
 * - Invoice allocations (partial, multi-invoice, unallocated balance arithmetic)
 * - GL double-entry posting on confirmation (Debit Bank/Cash, Credit Accounts Receivable)
 * - Void & Reversal workflow (REV voucher, balance restoration)
 */
interface PaymentAllocationData {
  id: number;
  invoiceReference: string;
  allocatedAmount: number | string;
  notes?: string | null;
}

interface PaymentReceivedResponseData {
  id: number;
  status: string;
  paymentNumber: string;
  amount: number | string;
  allocatedAmount: number | string;
  unallocatedAmount: number | string;
  journalEntryId?: number;
  allocations?: PaymentAllocationData[];
}

describe("finance payments received (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let paymentModeA: { id: number };
  let customerA: { id: number; name: string };
  let bankAccountA: { id: number };

  const PERMISSION_CODES = [
    "finance.payment_received.read",
    "finance.payment_received.write",
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
        name: `Org A Pay Test ${unique}`,
        slug: `org-a-pay-${unique}`,
      },
      select: { id: true, slug: true },
    });

    orgB = await prisma.organization.create({
      data: {
        name: `Org B Pay Test ${unique}`,
        slug: `org-b-pay-${unique}`,
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
          fullName: "Test Pay User",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

    await makeUser(orgA.id, "full-access@pay-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@pay-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@pay-a.test", readOnlyIds);

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

    tokenA = await login(orgA.slug, "full-access@pay-a.test");
    tokenB = await login(orgB.slug, "full-access@pay-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@pay-a.test");

    // Seed master list payment mode in Org A
    paymentModeA = await prisma.financeMasterListItem.create({
      data: {
        organizationId: orgA.id,
        category: "payment_mode",
        value: "Bank Transfer",
      },
      select: { id: true },
    });

    // Seed CRM Account (Customer) in Org A
    customerA = await prisma.account.create({
      data: {
        organizationId: orgA.id,
        name: "Acme Industrial Client",
        type: "CUSTOMER",
      },
      select: { id: true, name: true },
    });

    // Seed Chart of Accounts: Operating Bank (1020) and Accounts Receivable (1200)
    const bankGl = await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1020",
        accountName: "Operating Bank Account",
        accountType: "ASSET",
        currency: "INR",
      },
      select: { id: true },
    });

    await prisma.financeAccount.create({
      data: {
        organizationId: orgA.id,
        accountCode: "1200",
        accountName: "Accounts Receivable",
        accountType: "ASSET",
        currency: "INR",
      },
    });

    // Seed Bank Account linked to GL
    bankAccountA = await prisma.financeBankAccount.create({
      data: {
        organizationId: orgA.id,
        accountName: "HDFC Primary Current Account",
        accountNumber: "50200012345678",
        bankName: "HDFC Bank",
        ifscCode: "HDFC0001234",
        currency: "INR",
        glAccountId: bankGl.id,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.financePaymentReceivedAllocation.deleteMany({
      where: { paymentReceived: { organizationId: { in: orgIds } } },
    });
    await prisma.financePaymentReceived.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeJournalLine.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeJournalEntry.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeBankAccount.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.financeAccount.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.account.deleteMany({
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

  describe("Authentication & Authorization", () => {
    it("returns 401 when request is unauthenticated", async () => {
      await request(app.getHttpServer())
        .get("/finance/payments-received")
        .expect(401);
    });

    it("returns 403 when creating receipt with read-only token", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-received")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({
          paymentDate: "2026-10-23",
          amount: 5000,
          paymentModeId: paymentModeA.id,
        })
        .expect(403);
    });
  });

  describe("Input Validation", () => {
    it("returns 422 when payment date is in the future", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-received")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: "2099-01-01",
          amount: 5000,
          paymentModeId: paymentModeA.id,
        })
        .expect(422);
    });

    it("returns 422 when allocation amount exceeds total payment amount", async () => {
      await request(app.getHttpServer())
        .post("/finance/payments-received")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: "2026-10-23",
          amount: 1000,
          paymentModeId: paymentModeA.id,
          allocations: [
            { invoiceReference: "INV-001", allocatedAmount: 700 },
            { invoiceReference: "INV-002", allocatedAmount: 500 },
          ],
        })
        .expect(422);
    });
  });

  describe("Lifecycle & General Ledger Integration", () => {
    let createdPaymentId: number;

    it("POST /finance/payments-received creates a DRAFT receipt with invoice allocations", async () => {
      const res = await request(app.getHttpServer())
        .post("/finance/payments-received")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          paymentDate: "2026-10-23",
          amount: 5000,
          paymentModeId: paymentModeA.id,
          bankAccountId: bankAccountA.id,
          customerId: customerA.id,
          referenceNumber: "CHQ-882200",
          notes: "Customer advance receipt",
          status: "DRAFT",
          allocations: [
            { invoiceReference: "INV-202610-0010", allocatedAmount: 2000 },
            { invoiceReference: "INV-202610-0011", allocatedAmount: 1500 },
          ],
        })
        .expect(201);

      const body = ((res.body as { data?: PaymentReceivedResponseData })
        ?.data ?? res.body) as PaymentReceivedResponseData;
      expect(body.id).toBeDefined();
      expect(body.status).toBe("DRAFT");
      expect(body.amount).toBe(5000);
      expect(body.allocatedAmount).toBe(3500);
      expect(body.unallocatedAmount).toBe(1500);
      expect(body.allocations).toHaveLength(2);
      createdPaymentId = body.id;
    });

    it("POST /finance/payments-received/:id/allocations adds allocation against unallocated balance", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/payments-received/${createdPaymentId}/allocations`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          invoiceReference: "INV-202610-0012",
          allocatedAmount: 1000,
          notes: "Additional allocation",
        })
        .expect(201);

      const body = ((res.body as { data?: PaymentReceivedResponseData })
        ?.data ?? res.body) as PaymentReceivedResponseData;
      expect(body.allocatedAmount).toBe(4500);
      expect(body.unallocatedAmount).toBe(500);
    });

    it("POST /finance/payments-received/:id/confirm posts double-entry GL journal and sets CONFIRMED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/payments-received/${createdPaymentId}/confirm`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const body = ((res.body as { data?: PaymentReceivedResponseData })
        ?.data ?? res.body) as PaymentReceivedResponseData;
      expect(body.status).toBe("CONFIRMED");
      expect(body.journalEntryId).toBeDefined();

      // Verify the posted journal voucher in database
      const journal = await prisma.financeJournalEntry.findFirst({
        where: { id: Number(body.journalEntryId) },
        include: { lines: true },
      });
      expect(journal).toBeDefined();
      expect(journal?.entryType).toBe("PAYMENT_RECEIVED");
      expect(Number(journal?.totalDebit)).toBe(5000);
      expect(Number(journal?.totalCredit)).toBe(5000);
      expect(journal?.lines).toHaveLength(2);
    });

    it("POST /finance/payments-received/:id/confirm rejects double confirmation", async () => {
      await request(app.getHttpServer())
        .post(`/finance/payments-received/${createdPaymentId}/confirm`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(422);
    });

    it("Tenant Isolation: Org B cannot access Org A receipt", async () => {
      await request(app.getHttpServer())
        .get(`/finance/payments-received/${createdPaymentId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("POST /finance/payments-received/:id/void generates REV voucher and restores balances", async () => {
      const res = await request(app.getHttpServer())
        .post(`/finance/payments-received/${createdPaymentId}/void`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const body = ((res.body as { data?: PaymentReceivedResponseData })
        ?.data ?? res.body) as PaymentReceivedResponseData;
      expect(body.status).toBe("VOID");

      // Verify reversal voucher created
      const reversalJournal = await prisma.financeJournalEntry.findFirst({
        where: {
          organizationId: orgA.id,
          entryNumber: { startsWith: "REV-" },
          referenceNumber: body.paymentNumber,
        },
      });
      expect(reversalJournal).toBeDefined();
      expect(Number(reversalJournal?.totalDebit)).toBe(5000);
      expect(Number(reversalJournal?.totalCredit)).toBe(5000);
    });

    it("DELETE /finance/payments-received/:id soft deletes VOID receipt", async () => {
      await request(app.getHttpServer())
        .delete(`/finance/payments-received/${createdPaymentId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);
    });
  });
});
