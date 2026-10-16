import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Sales — dashboard, customers and the dashboard checklist. Proves: the
 * permission split between the Sales Manager / Sales Executive roles,
 * validation (unknown fields, formats, tax-rate bounds), server-issued
 * customer codes (sequential, unique under concurrency), the bank account
 * stored encrypted and only revealed — audited — with its own permission,
 * GSTIN uniqueness (API and index), organization isolation (404 by id), and
 * the dashboard's shape and live figures.
 */

interface Body<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
interface Address {
  id: number;
  addressType: string;
  label: string;
  city: string;
  stateCode: string;
  stateName: string | null;
  isDefault: boolean;
}
interface Customer {
  id: number;
  customerCode: string;
  companyName: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  pan: string | null;
  cgstRate: string | null;
  sgstRate: string | null;
  igstRate: string | null;
  bankAccountNumberMasked: string | null;
  status: string;
  addresses: Address[];
  defaultAddress: Address | null;
}
interface ActionItem {
  id: number;
  title: string;
  dueDate: string | null;
  isDone: boolean;
}
interface ErrorBody {
  error: string;
  message: string | string[];
}

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.customer.write",
  "sales.customer.delete",
  "sales.customer_bank.reveal",
  "sales.action_item.read",
  "sales.action_item.write",
  "sales.master.read",
  "sales.master.write",
];
const EXECUTIVE = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.customer.write",
  "sales.action_item.read",
  "sales.action_item.write",
  "sales.master.read",
];

describe("Sales — dashboard & customers (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const suffix = randomUUID().slice(0, 6).toLowerCase();

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Sales A ${suffix}`, slug: `sales-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Sales B ${suffix}`, slug: `sales-b-${suffix}` },
    });

    const perms = new Map<string, number>();
    for (const code of MANAGER) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perms.set(code, p.id);
    }

    async function mkUser(
      org: { id: number; slug: string },
      key: string,
      codes: string[],
    ) {
      const role = await prisma.role.create({
        data: { organizationId: org.id, name: `role-${key}-${suffix}` },
      });
      if (codes.length) {
        await prisma.rolePermission.createMany({
          data: codes.map((c) => ({
            roleId: role.id,
            permissionId: perms.get(c) as number,
          })),
        });
      }
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          email: `${key}@${org.slug}.test`,
          passwordHash,
          fullName: `User ${key}`,
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      const login = await http()
        .post("/auth/login")
        .send({
          organizationSlug: org.slug,
          email: user.email,
          password: "Password123!",
        })
        .expect(201);
      tokens[key] = (
        login.body as Body<{ accessToken: string }>
      ).data.accessToken;
      userIds[key] = user.id;
    }
    await mkUser(orgA, "manager", MANAGER);
    await mkUser(orgA, "exec", EXECUTIVE);
    await mkUser(orgA, "reader", ["sales.customer.read"]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "managerB", MANAGER);
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    const where = { organizationId: { in: orgIds } };
    await prisma.salesActionItem.deleteMany({ where });
    await prisma.salesCodeFormat.deleteMany({ where });
    await prisma.salesCustomerAddress.deleteMany({ where });
    await prisma.salesCustomer.deleteMany({ where });
    await prisma.documentSequence.deleteMany({ where });
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.role.deleteMany({ where });
    await Promise.all(
      Object.values(userIds).flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    // Users/orgs that produced audit rows are intentionally left (audit_logs is append-only).
    await app.close();
  });

  let counter = 0;
  const payload = (over: Record<string, unknown> = {}) => {
    counter += 1;
    return {
      companyName: `Company ${suffix} ${counter}`,
      contactPerson: "John Doe",
      email: `c${counter}@company.test`,
      mobileNumber: "9876543210",
      ...over,
    };
  };
  async function createCustomer(
    who: string,
    over: Record<string, unknown> = {},
  ): Promise<Customer> {
    const res = await http()
      .post("/sales/customers")
      .set(auth(who))
      .send(payload(over))
      .expect(201);
    return (res.body as Body<Customer>).data;
  }

  // ---------------------------------------------------------------------------
  describe("RBAC", () => {
    it("401 without a token; 403 without the permission", async () => {
      await http().get("/sales/customers").expect(401);
      await http().get("/sales/dashboard").expect(401);
      for (const path of [
        "/sales/customers",
        "/sales/dashboard",
        "/sales/action-items",
      ]) {
        await http().get(path).set(auth("nobody")).expect(403);
      }
    });

    it("a read-only user can list and view but not create, see the dashboard, or preview codes", async () => {
      const c = await createCustomer("manager");
      await http().get("/sales/customers").set(auth("reader")).expect(200);
      await http()
        .get(`/sales/customers/${c.id}`)
        .set(auth("reader"))
        .expect(200);
      await http()
        .post("/sales/customers")
        .set(auth("reader"))
        .send(payload())
        .expect(403);
      await http()
        .get("/sales/customers/next-code")
        .set(auth("reader"))
        .expect(403);
      await http().get("/sales/dashboard").set(auth("reader")).expect(403);
    });

    it("Sales Executive edits customers but cannot delete them or reveal bank accounts", async () => {
      const c = await createCustomer("exec", {
        bankName: "HDFC Bank",
        bankAccountNumber: "50100234567890",
        bankIfsc: "HDFC0001234",
      });
      await http()
        .patch(`/sales/customers/${c.id}`)
        .set(auth("exec"))
        .send({ contactPerson: "Jane" })
        .expect(200);
      await http()
        .get(`/sales/customers/${c.id}/bank-account`)
        .set(auth("exec"))
        .expect(403);
      await http()
        .delete(`/sales/customers/${c.id}`)
        .set(auth("exec"))
        .expect(403);
      await http()
        .delete(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .expect(204);
    });
  });

  // ---------------------------------------------------------------------------
  describe("validation", () => {
    it.each([
      ["an unknown field", { isVip: true }],
      ["a missing required field", { email: undefined }],
      ["a bad GSTIN", { gstin: "33AAAAA0000A1" }],
      ["a bad mobile number", { mobileNumber: "98-765" }],
      ["a tax rate over 100", { igstRate: 118 }],
      ["a tax rate with 3 decimals", { cgstRate: 2.125 }],
      ["a bad IFSC", { bankIfsc: "HDFC1234567" }],
      ["digits in the contact person", { contactPerson: "Jane 2" }],
      ["a company name without letters", { companyName: "12345" }],
      ["a bank account of 8 digits", { bankAccountNumber: "12345678" }],
      ["digits in the bank name", { bankName: "Bank 1" }],
      [
        "digits in the city",
        {
          addresses: [
            {
              addressType: "BILLING",
              label: "HO",
              street: "1 Main Road",
              city: "Chennai 2",
              stateCode: "33",
              pincode: "600001",
            },
          ],
        },
      ],
      [
        "a pincode starting with 0",
        {
          addresses: [
            {
              addressType: "BILLING",
              label: "HO",
              street: "1 Main Road",
              city: "Chennai",
              stateCode: "33",
              pincode: "060001",
            },
          ],
        },
      ],
      [
        "a bad pincode",
        {
          addresses: [
            {
              addressType: "BILLING",
              label: "HO",
              street: "1",
              city: "X",
              stateCode: "33",
              pincode: "12",
            },
          ],
        },
      ],
    ])("400 for %s", async (_label, over) => {
      await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload(over))
        .expect(400);
    });

    it.each([
      [
        "an Indian mobile not starting with 6-9",
        { mobileNumber: "1234567890" },
        "INVALID_MOBILE",
      ],
      ["CGST without SGST", { cgstRate: 9 }, "GST_RATES_MISMATCH"],
      [
        "CGST and SGST that differ",
        { cgstRate: 9, sgstRate: 6 },
        "GST_RATES_MISMATCH",
      ],
      [
        "an account number without IFSC",
        { bankName: "HDFC Bank", bankAccountNumber: "50100234567890" },
        "BANK_DETAILS_INCOMPLETE",
      ],
    ])("422 for %s", async (_label, over, error) => {
      const res = await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload(over))
        .expect(422);
      expect((res.body as ErrorBody).error).toBe(error);
    });

    it("a foreign mobile keeps 6-15 digits", async () => {
      await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload({ mobileCountryCode: "+971", mobileNumber: "501234567" }))
        .expect(201);
    });

    it("422 for a PAN that is not the GSTIN's", async () => {
      const res = await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload({ gstin: "33ZZZZZ1111Z1Z5", pan: "ABCDE1234F" }))
        .expect(422);
      expect((res.body as ErrorBody).error).toBe("PAN_GSTIN_MISMATCH");
    });
  });

  // ---------------------------------------------------------------------------
  describe("customers", () => {
    it("issues sequential codes and previews the next one", async () => {
      const preview = await http()
        .get("/sales/customers/next-code")
        .set(auth("managerB"))
        .expect(200);
      expect(
        (preview.body as Body<{ customerCode: string }>).data.customerCode,
      ).toBe("CUS-IN-001");
      const first = await createCustomer("managerB");
      const second = await createCustomer("managerB");
      expect([first.customerCode, second.customerCode]).toEqual([
        "CUS-IN-001",
        "CUS-IN-002",
      ]);
    });

    it("codes stay unique under concurrent creation", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          http().post("/sales/customers").set(auth("manager")).send(payload()),
        ),
      );
      const codes = results.map((r) => {
        expect(r.status).toBe(201);
        return (r.body as Body<Customer>).data.customerCode;
      });
      expect(new Set(codes).size).toBe(8);
    });

    it("auto-detects state and PAN from the GSTIN, keeps manual tax rates", async () => {
      const c = await createCustomer("manager", {
        gstin: "27aaaaa0000a1z5",
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 18,
      });
      expect(c).toMatchObject({
        gstin: "27AAAAA0000A1Z5",
        stateCode: "27",
        stateName: "Maharashtra",
        pan: "AAAAA0000A",
        cgstRate: "9",
        sgstRate: "9",
        igstRate: "18",
      });
      const plain = await createCustomer("manager");
      expect(plain).toMatchObject({
        cgstRate: null,
        sgstRate: null,
        igstRate: null,
      });
    });

    it("409 for a duplicate GSTIN in the same organization; allowed in another", async () => {
      await createCustomer("manager", { gstin: "29BBBBB2222B1Z5" });
      const res = await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload({ gstin: "29BBBBB2222B1Z5" }))
        .expect(409);
      expect((res.body as ErrorBody).error).toBe("CUSTOMER_GSTIN_EXISTS");
      await createCustomer("managerB", { gstin: "29BBBBB2222B1Z5" });
    });

    it("the partial unique index blocks a duplicate GSTIN past the API", async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO sales.customers
            (organization_id, customer_code, company_name, contact_person,
             email, mobile_number, gstin, updated_at)
          VALUES (${orgA.id}, 'RAW-1', 'raw', 'raw', 'r@r.test', '1234567',
                  '29BBBBB2222B1Z5', now())`,
      ).rejects.toThrow();
    });

    it("stores the bank account encrypted; responses carry only the mask; reveal is audited", async () => {
      const c = await createCustomer("manager", {
        bankName: "HDFC Bank",
        bankAccountNumber: "50100234567890",
        bankIfsc: "hdfc0001234",
      });
      expect(c.bankAccountNumberMasked).toBe("**********7890");
      expect(JSON.stringify(c)).not.toContain("50100234567890");
      expect(c).not.toHaveProperty("bankAccountNumberEncrypted");

      const raw = await prisma.salesCustomer.findUniqueOrThrow({
        where: { id: c.id },
      });
      expect(raw.bankAccountNumberEncrypted).toBeTruthy();
      expect(raw.bankAccountNumberEncrypted).not.toContain("50100234567890");
      expect(raw.bankIfsc).toBe("HDFC0001234");

      const list = await http()
        .get(`/sales/customers?search=${encodeURIComponent(c.companyName)}`)
        .set(auth("manager"))
        .expect(200);
      expect(JSON.stringify(list.body)).not.toContain("50100234567890");

      const reveal = await http()
        .get(`/sales/customers/${c.id}/bank-account`)
        .set(auth("manager"))
        .expect(200);
      expect(
        (reveal.body as Body<{ bankAccountNumber: string }>).data
          .bankAccountNumber,
      ).toBe("50100234567890");
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: orgA.id,
            entityType: "sales_customer",
            entityId: c.id,
            action: "reveal_bank_account",
            actorUserId: userIds["manager"] as number,
          },
        }),
      ).toBe(1);
    });

    it("addresses: first of each type becomes default; the directory shows the default billing one; update replaces the set", async () => {
      const c = await createCustomer("manager", {
        addresses: [
          {
            addressType: "SHIPPING",
            label: "Plant",
            street: "Plot 7",
            city: "Hosur",
            stateCode: "33",
            pincode: "635109",
          },
          {
            addressType: "BILLING",
            label: "Head Office",
            street: "12 Mount Road",
            city: "Chennai",
            stateCode: "33",
            pincode: "600002",
          },
        ],
      });
      expect(c.addresses.every((a) => a.isDefault)).toBe(true);
      expect(c.defaultAddress).toMatchObject({
        label: "Head Office",
        city: "Chennai",
        stateName: "Tamil Nadu",
      });

      const res = await http()
        .patch(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .send({
          addresses: [
            {
              addressType: "BILLING",
              label: "New HO",
              street: "1 Anna Salai",
              city: "Coimbatore",
              stateCode: "33",
              pincode: "641001",
            },
          ],
        })
        .expect(200);
      const updated = (res.body as Body<Customer>).data;
      expect(updated.addresses.map((a) => a.label)).toEqual(["New HO"]);
      expect(updated.customerCode).toBe(c.customerCode);

      const byCity = await http()
        .get("/sales/customers?search=coimbatore")
        .set(auth("manager"))
        .expect(200);
      expect((byCity.body as Body<Customer[]>).data.map((x) => x.id)).toContain(
        c.id,
      );
    });

    it("the database allows only one live default address per type", async () => {
      const c = await createCustomer("manager", {
        addresses: [
          {
            addressType: "BILLING",
            label: "HO",
            street: "1",
            city: "Chennai",
            stateCode: "33",
            pincode: "600001",
          },
        ],
      });
      await expect(
        prisma.salesCustomerAddress.create({
          data: {
            organizationId: orgA.id,
            customerId: c.id,
            addressType: "BILLING",
            label: "Second",
            street: "2",
            city: "Chennai",
            stateCode: "33",
            pincode: "600001",
            isDefault: true,
          },
        }),
      ).rejects.toThrow();
    });

    it("null clears an optional field", async () => {
      const c = await createCustomer("manager", {
        cin: "L12345MH2020PLC123456",
      });
      const res = await http()
        .patch(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .send({ cin: null })
        .expect(200);
      expect((res.body as Body<{ cin: string | null }>).data.cin).toBeNull();
    });

    it("deleted customers disappear and are 404", async () => {
      const c = await createCustomer("manager");
      await http()
        .delete(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .expect(204);
      await http()
        .get(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("organization isolation", () => {
    it("another organization's customer is 404 for every route", async () => {
      const c = await createCustomer("manager", {
        bankName: "HDFC Bank",
        bankAccountNumber: "123456789",
        bankIfsc: "HDFC0001234",
      });
      await http()
        .get(`/sales/customers/${c.id}`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .patch(`/sales/customers/${c.id}`)
        .set(auth("managerB"))
        .send({ contactPerson: "x" })
        .expect(404);
      await http()
        .get(`/sales/customers/${c.id}/bank-account`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .delete(`/sales/customers/${c.id}`)
        .set(auth("managerB"))
        .expect(404);
      const list = await http()
        .get("/sales/customers?limit=100")
        .set(auth("managerB"))
        .expect(200);
      expect(
        (list.body as Body<Customer[]>).data.some((x) => x.id === c.id),
      ).toBe(false);
    });

    it("another organization's checklist item is 404", async () => {
      const res = await http()
        .post("/sales/action-items")
        .set(auth("manager"))
        .send({ title: "Mine" })
        .expect(201);
      const item = (res.body as Body<ActionItem>).data;
      await http()
        .post(`/sales/action-items/${item.id}/complete`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .delete(`/sales/action-items/${item.id}`)
        .set(auth("managerB"))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("checklist", () => {
    it("adds, completes, reopens and deletes; lists open items by default", async () => {
      const add = await http()
        .post("/sales/action-items")
        .set(auth("exec"))
        .send({ title: "Call Global Enterprises", dueDate: "2026-10-20" })
        .expect(201);
      const item = (add.body as Body<ActionItem>).data;
      expect(item).toMatchObject({ dueDate: "2026-10-20", isDone: false });

      const done = await http()
        .post(`/sales/action-items/${item.id}/complete`)
        .set(auth("exec"))
        .expect(200);
      expect((done.body as Body<ActionItem>).data.isDone).toBe(true);

      const open = await http()
        .get("/sales/action-items")
        .set(auth("exec"))
        .expect(200);
      expect(
        (open.body as Body<ActionItem[]>).data.some((i) => i.id === item.id),
      ).toBe(false);

      await http()
        .post(`/sales/action-items/${item.id}/reopen`)
        .set(auth("exec"))
        .expect(200);
      await http()
        .delete(`/sales/action-items/${item.id}`)
        .set(auth("exec"))
        .expect(204);
    });

    it("rejects an empty title and a bad date", async () => {
      await http()
        .post("/sales/action-items")
        .set(auth("exec"))
        .send({ title: "" })
        .expect(400);
      await http()
        .post("/sales/action-items")
        .set(auth("exec"))
        .send({ title: "x", dueDate: "2026-02-30" })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("dashboard", () => {
    it("returns the full shape with live customer and checklist figures", async () => {
      await createCustomer("manager", { status: "INACTIVE" });
      await http()
        .post("/sales/action-items")
        .set(auth("manager"))
        .send({ title: "Overdue follow-up", dueDate: "2020-01-01" })
        .expect(201);

      const res = await http()
        .get("/sales/dashboard")
        .set(auth("exec"))
        .expect(200);
      const d = (
        res.body as Body<{
          availability: Record<string, boolean>;
          kpis: Record<string, unknown>;
          monthlyRevenueVsCollections: unknown[];
          receivables: { aging: unknown[] };
          needsAttention: Array<{ kind: string }>;
          checklist: { open: number; overdue: number };
        }>
      ).data;

      const liveActive = await prisma.salesCustomer.count({
        where: { organizationId: orgA.id, deletedAt: null, status: "ACTIVE" },
      });
      const liveAll = await prisma.salesCustomer.count({
        where: { organizationId: orgA.id, deletedAt: null },
      });
      expect(d.kpis).toMatchObject({
        activeCustomers: liveActive,
        totalCustomers: liveAll,
        monthlyRevenue: "0.00",
        totalQuotations: 0,
      });
      expect(d.availability).toMatchObject({
        customers: true,
        action_items: true,
        quotations: true,
        invoices: true,
        payments: true,
        credit_notes: false,
      });
      expect(d.monthlyRevenueVsCollections).toHaveLength(12);
      expect(d.receivables.aging).toHaveLength(4);
      expect(d.checklist.overdue).toBeGreaterThanOrEqual(1);
      expect(d.needsAttention.map((a) => a.kind)).toContain(
        "overdue_follow_ups",
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit", () => {
    it("writes create/update/delete rows with the acting user and no secrets", async () => {
      const c = await createCustomer("manager", {
        bankName: "HDFC Bank",
        bankAccountNumber: "998877665544",
        bankIfsc: "HDFC0001234",
      });
      await http()
        .patch(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .send({ contactPerson: "Changed" })
        .expect(200);
      await http()
        .delete(`/sales/customers/${c.id}`)
        .set(auth("manager"))
        .expect(204);
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: "sales_customer",
          entityId: c.id,
        },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => r.action)).toEqual(["create", "update", "delete"]);
      expect(rows.every((r) => r.actorUserId === userIds["manager"])).toBe(
        true,
      );
      expect(
        JSON.stringify(rows.map((r) => [r.before, r.after])),
      ).not.toContain("998877665544");
    });
  });

  // ---------------------------------------------------------------------------
  // Runs last: it changes organization A's customer-code prefix.
  describe("master list & customer codes", () => {
    interface Format {
      codeType: string;
      prefix: string;
      padding: number;
      isDefault: boolean;
      example: string;
    }

    it("RBAC: executives read the master list, only managers edit it", async () => {
      await http()
        .get("/sales/master/code-formats")
        .set(auth("reader"))
        .expect(403);
      const res = await http()
        .get("/sales/master/code-formats")
        .set(auth("exec"))
        .expect(200);
      expect((res.body as Body<Format[]>).data[0]).toEqual(
        expect.objectContaining({
          codeType: "customer",
          prefix: "CUS",
          padding: 3,
          isDefault: true,
          example: "CUS-IN-001",
        }),
      );
      await http()
        .patch("/sales/master/code-formats/customer")
        .set(auth("exec"))
        .send({ prefix: "CL" })
        .expect(403);
    });

    it("the country comes from the mobile country code, with one counter per country", async () => {
      const preview = await http()
        .get("/sales/customers/next-code?mobileCountryCode=%2B971")
        .set(auth("managerB"))
        .expect(200);
      expect(
        (preview.body as Body<{ customerCode: string }>).data.customerCode,
      ).toBe("CUS-AE-001");
      const ae = await createCustomer("managerB", {
        mobileCountryCode: "+971",
      });
      expect(ae.customerCode).toBe("CUS-AE-001");
      const inNext = await createCustomer("managerB");
      expect(inNext.customerCode).toMatch(/^CUS-IN-\d{3}$/);
      expect(inNext.customerCode).not.toBe("CUS-IN-001");
    });

    it("an unsupported mobile country code is rejected (400)", async () => {
      await http()
        .post("/sales/customers")
        .set(auth("manager"))
        .send(payload({ mobileCountryCode: "+999" }))
        .expect(400);
    });

    it("validates the format and 404s an unknown code type", async () => {
      for (const body of [
        { prefix: "C-1" },
        { prefix: "" },
        { padding: 0 },
        { padding: 9 },
      ]) {
        await http()
          .patch("/sales/master/code-formats/customer")
          .set(auth("manager"))
          .send(body)
          .expect(400);
      }
      await http()
        .patch("/sales/master/code-formats/vendor")
        .set(auth("manager"))
        .send({ prefix: "VEN" })
        .expect(404);
    });

    it("a new prefix/width applies to new codes only, in this organization only, and is audited", async () => {
      const before = await createCustomer("manager");
      const res = await http()
        .patch("/sales/master/code-formats/customer")
        .set(auth("manager"))
        .send({ prefix: "cl", padding: 4 })
        .expect(200);
      expect((res.body as Body<Format>).data).toMatchObject({
        prefix: "CL",
        padding: 4,
        isDefault: false,
        example: "CL-IN-0001",
      });

      const after = await createCustomer("manager");
      expect(after.customerCode).toMatch(/^CL-IN-\d{4,}$/);
      const unchanged = await http()
        .get(`/sales/customers/${before.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((unchanged.body as Body<Customer>).data.customerCode).toBe(
        before.customerCode,
      );

      const otherOrg = await createCustomer("managerB");
      expect(otherOrg.customerCode).toMatch(/^CUS-IN-/);

      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: orgA.id,
            entityType: "sales_code_format",
            actorUserId: userIds["manager"] as number,
          },
        }),
      ).toBe(1);
    });
  });
});
