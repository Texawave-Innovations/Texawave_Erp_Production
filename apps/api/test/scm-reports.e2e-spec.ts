import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface Id {
  id: number;
}

describe("scm reports (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNone: string;
  let tokenB: string;
  let wh: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const today = "2026-10-18";

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
      data: { name: `Org A ${suffix}`, slug: `scm-rep-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-rep-b-${suffix}` },
    });
    const codes = [
      "scm.supplier.read",
      "scm.supplier.write",
      "scm.product.read",
      "scm.product.write",
      "scm.warehouse.read",
      "scm.warehouse.write",
      "scm.inventory.read",
      "scm.inventory.write",
      "scm.procurement.read",
      "scm.procurement.write",
      "scm.procurement.approve",
      "scm.reports.read",
    ];
    const perms = Object.fromEntries(
      await Promise.all(
        codes.map(async (code) => [
          code,
          await prisma.permission.upsert({
            where: { code },
            update: {},
            create: { code, description: code },
          }),
        ]),
      ),
    ) as Record<string, { id: number }>;
    const idsOf = (list: string[]) => list.map((c) => perms[c]!.id);
    async function makeUser(orgId: number, email: string, ids: number[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Analyst",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-rep-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "none@scm-rep-a.test",
      idsOf(codes.filter((c) => c !== "scm.reports.read")),
    );
    await makeUser(orgB.id, "all@scm-rep-b.test", idsOf(codes));
    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-rep-a.test");
    tokenNone = await login(orgA.slug, "none@scm-rep-a.test");
    tokenB = await login(orgB.slug, "all@scm-rep-b.test");

    wh = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `W${suffix}`,
        name: "Main",
      }).expect(201),
    );
    const supplier = data<Id>(
      await post(tokenAll, "/scm/suppliers", {
        companyName: `Sup ${suffix}`,
        contactPerson: "A",
      }).expect(201),
    );
    const product = data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `RP-${suffix}`,
        name: "Report item",
      }).expect(201),
    );
    await post(tokenAll, "/scm/inventory/opening-balance", {
      productId: product.id,
      warehouseId: wh.id,
      quantity: 20,
    }).expect(201);
    const po = data<Id>(
      await post(tokenAll, "/scm/procurement/purchase-orders", {
        supplierId: supplier.id,
        poDate: today,
        warehouseId: wh.id,
        items: [{ productId: product.id, quantity: 10, unitPrice: 15 }],
      }).expect(201),
    );
    const base = `/scm/procurement/purchase-orders/${po.id}`;
    await post(tokenAll, `${base}/submit`).expect(201);
    await post(tokenAll, `${base}/approve`).expect(201);
    await post(tokenAll, `${base}/send`).expect(201);
    const full = data<{ items: Id[] }>(await get(tokenAll, base).expect(200));
    await post(tokenAll, "/scm/procurement/goods-receipts", {
      purchaseOrderId: po.id,
      receiptDate: today,
      lines: [
        { purchaseOrderItemId: full.items[0]!.id, receivingQuantity: 10 },
      ],
    }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the executive overview with real counters", async () => {
    await get(tokenNone, "/scm/reports").expect(403);
    await get(tokenB, "/scm/reports").expect(200); // tenant-scoped, not forbidden
    const overview = data<{ activeSuppliers: number; openPOs: number }>(
      await get(tokenAll, "/scm/reports").expect(200),
    );
    expect(overview.activeSuppliers).toBeGreaterThan(0);
  });

  it("returns a procurement report row for the purchase order just received", async () => {
    const rows = data<
      { poNumber: string; receivedQty: number; goodsReceipts: number }[]
    >(await get(tokenAll, "/scm/reports/procurement").expect(200));
    expect(rows.length).toBeGreaterThan(0);
    const row = rows.find((r) => r.receivedQty === 10)!;
    expect(row.goodsReceipts).toBe(1);
  });

  it("returns an inventory report row reflecting the opening balance", async () => {
    const rows = data<{ onHand: number; status: string }[]>(
      await get(tokenAll, `/scm/reports/inventory?warehouseId=${wh.id}`).expect(
        200,
      ),
    );
    expect(rows.some((r) => r.onHand === 30)).toBe(true);
  });

  it("returns a warehouse report row for the created warehouse", async () => {
    const rows = data<{ warehouse: string; activeLocations: number }[]>(
      await get(tokenAll, "/scm/reports/warehouse").expect(200),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("returns empty fulfillment/logistics/returns/quality reports for a fresh org and never leaks across tenants", async () => {
    for (const path of ["fulfillment", "logistics", "returns", "quality"]) {
      const rowsB = data<unknown[]>(
        await get(tokenB, `/scm/reports/${path}`).expect(200),
      );
      expect(rowsB).toHaveLength(0);
    }
  });

  it("returns a suppliers report row with aggregated spend", async () => {
    const rows = data<
      { supplier: string; purchaseOrders: number; totalSpend: number }[]
    >(await get(tokenAll, "/scm/reports/suppliers").expect(200));
    const row = rows.find((r) => r.purchaseOrders > 0)!;
    expect(row.totalSpend).toBeGreaterThan(0);
  });
});
