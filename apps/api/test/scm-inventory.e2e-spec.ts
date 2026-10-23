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
interface Overview {
  productId: number;
  warehouseId: number;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  stockStatus: string;
}

describe("scm products, warehouses and inventory (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenReadOnly: string;
  let tokenNoApprove: string;
  let tokenB: string;
  let product: Id;
  let whA: Id;
  let whB: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;

  async function overviewRow(productId: number, warehouseId: number) {
    const res = await get(
      tokenAll,
      `/scm/inventory/overview?warehouseId=${warehouseId}&limit=100`,
    ).expect(200);
    return data<Overview[]>(res).find((r) => r.productId === productId);
  }

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
      data: { name: `Org A ${suffix}`, slug: `scm-inv-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-inv-b-${suffix}` },
    });

    const perm = (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const codes = [
      "scm.product.read",
      "scm.product.write",
      "scm.warehouse.read",
      "scm.warehouse.write",
      "scm.inventory.read",
      "scm.inventory.write",
      "scm.inventory.approve",
    ];
    const p = Object.fromEntries(
      await Promise.all(codes.map(async (c) => [c, await perm(c)])),
    ) as Record<string, { id: number }>;

    async function makeUser(orgId: number, email: string, ids: number[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      if (ids.length) {
        await prisma.rolePermission.createMany({
          data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        });
      }
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
    }
    const all = codes.map((c) => p[c]!.id);
    await makeUser(orgA.id, "all@scm-inv-a.test", all);
    await makeUser(orgA.id, "ro@scm-inv-a.test", [
      p["scm.product.read"]!.id,
      p["scm.warehouse.read"]!.id,
      p["scm.inventory.read"]!.id,
    ]);
    await makeUser(
      orgA.id,
      "noapprove@scm-inv-a.test",
      all.filter((id) => id !== p["scm.inventory.approve"]!.id),
    );
    await makeUser(orgB.id, "all@scm-inv-b.test", all);

    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-inv-a.test");
    tokenReadOnly = await login(orgA.slug, "ro@scm-inv-a.test");
    tokenNoApprove = await login(orgA.slug, "noapprove@scm-inv-a.test");
    tokenB = await login(orgB.slug, "all@scm-inv-b.test");

    product = data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `sku-${suffix}`,
        name: "Widget",
        costPrice: 10,
        reorderLevel: 5,
      }).expect(201),
    );
    whA = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `wa-${suffix}`,
        name: "Warehouse A",
      }).expect(201),
    );
    whB = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `wb-${suffix}`,
        name: "Warehouse B",
      }).expect(201),
    );
  });

  // Stock postings write append-only audit/ledger rows, so test orgs cannot be
  // deleted afterwards. Nothing is cleaned up (same tradeoff as the CRM suites).
  afterAll(async () => {
    await app.close();
  });

  it("enforces permissions: read-only can list but not write or approve", async () => {
    await get(tokenReadOnly, "/scm/products").expect(200);
    await post(tokenReadOnly, "/scm/products", {
      productCode: "X",
      name: "X",
    }).expect(403);
    await post(tokenReadOnly, "/scm/inventory/opening-balance", {
      productId: product.id,
      warehouseId: whA.id,
      quantity: 1,
    }).expect(403);
    await http().get("/scm/inventory/overview").expect(401);
  });

  it("rejects duplicate product and warehouse codes (409) and validates input (400)", async () => {
    const sku = `dup-${randomUUID().slice(0, 6)}`;
    await post(tokenAll, "/scm/products", {
      productCode: sku,
      name: "A",
    }).expect(201);
    await post(tokenAll, "/scm/products", {
      productCode: sku.toUpperCase(),
      name: "B",
    }).expect(409);
    await post(tokenAll, "/scm/products", { name: "no code" }).expect(400);
    await post(tokenAll, "/scm/products", {
      productCode: "NEG",
      name: "Neg",
      costPrice: -1,
    }).expect(400);
    await post(tokenAll, "/scm/warehouses", { code: "", name: "x" }).expect(
      400,
    );
  });

  it("builds the location hierarchy with derived codes and parent-type rules", async () => {
    const zone = data<{ id: number; locationCode: string }>(
      await post(tokenAll, "/scm/warehouse-locations", {
        warehouseId: whA.id,
        locationType: "ZONE",
        code: "z01",
      }).expect(201),
    );
    const rackRes = await post(tokenAll, "/scm/warehouse-locations", {
      warehouseId: whA.id,
      locationType: "RACK",
      parentLocationId: zone.id,
      code: "r01",
    }).expect(201);
    expect(data<{ locationCode: string }>(rackRes).locationCode).toMatch(
      /-Z01-R01$/,
    );
    // a BIN may not sit directly in a zone
    await post(tokenAll, "/scm/warehouse-locations", {
      warehouseId: whA.id,
      locationType: "BIN",
      parentLocationId: zone.id,
      code: "b01",
    }).expect(422);
    // a RACK's parent is optional — it may sit directly in the warehouse
    await post(tokenAll, "/scm/warehouse-locations", {
      warehouseId: whA.id,
      locationType: "RACK",
      code: "r02",
    }).expect(201);
    // ...but a RACK may only nest inside a ZONE, never e.g. another RACK
    await post(tokenAll, "/scm/warehouse-locations", {
      warehouseId: whA.id,
      locationType: "RACK",
      parentLocationId: zone.id,
      code: "r03",
    }).expect(201);
    // duplicate code in the same warehouse
    await post(tokenAll, "/scm/warehouse-locations", {
      warehouseId: whA.id,
      locationType: "ZONE",
      code: "Z01",
    }).expect(409);
  });

  it("posts an opening balance and shows it in overview, KPIs and the ledger", async () => {
    await post(tokenAll, "/scm/inventory/opening-balance", {
      productId: product.id,
      warehouseId: whA.id,
      quantity: 10,
      unitCost: 10,
    }).expect(201);
    const row = await overviewRow(product.id, whA.id);
    expect(row).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
    expect(row?.stockStatus).toBe("Healthy");

    const kpis = data<{ totalValue: number }>(
      await get(
        tokenAll,
        `/scm/inventory/overview/kpis?warehouseId=${whA.id}`,
      ).expect(200),
    );
    expect(kpis.totalValue).toBeGreaterThanOrEqual(100);

    const ledger = data<{ transactionType: string }[]>(
      await get(
        tokenAll,
        `/scm/inventory/ledger?productId=${product.id}&warehouseId=${whA.id}`,
      ).expect(200),
    );
    expect(ledger[0]?.transactionType).toBe("OPENING_BALANCE");
  });

  it("keeps the ledger append-only at the database level", async () => {
    const entry = await prisma.scmStockLedgerEntry.findFirstOrThrow({
      where: { productId: product.id },
    });
    await expect(
      prisma.scmStockLedgerEntry.update({
        where: { id: entry.id },
        data: { notes: "tamper" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.scmStockLedgerEntry.delete({ where: { id: entry.id } }),
    ).rejects.toThrow();
  });

  it("rejects over-reservation and releases a reservation", async () => {
    await post(tokenAll, "/scm/inventory/reservations", {
      productId: product.id,
      warehouseId: whA.id,
      quantity: 11,
    }).expect(422);
    const res = data<Id>(
      await post(tokenAll, "/scm/inventory/reservations", {
        productId: product.id,
        warehouseId: whA.id,
        quantity: 4,
      }).expect(201),
    );
    expect(await overviewRow(product.id, whA.id)).toMatchObject({
      reserved: 4,
      available: 6,
      onHand: 10,
    });
    await post(tokenAll, `/scm/inventory/reservations/${res.id}/release`, {
      status: "RELEASED",
    }).expect(201);
    expect(await overviewRow(product.id, whA.id)).toMatchObject({
      reserved: 0,
      available: 10,
    });
    // already released
    await post(tokenAll, `/scm/inventory/reservations/${res.id}/release`, {
      status: "CANCELLED",
    }).expect(422);
  });

  it("runs a transfer through approve, dispatch and receive, moving stock only at dispatch/receive", async () => {
    const t = data<Id & { transferNumber: string; status: string }>(
      await post(tokenAll, "/scm/inventory/transfers", {
        productId: product.id,
        sourceWarehouseId: whA.id,
        destinationWarehouseId: whB.id,
        quantity: 3,
      }).expect(201),
    );
    expect(t.transferNumber).toMatch(/^TW\/STK-TRF\/\d{2}-\d{2}\/\d{4}$/);
    expect(t.status).toBe("REQUESTED");

    // dispatch before approval is an invalid transition
    await post(tokenAll, `/scm/inventory/transfers/${t.id}/dispatch`).expect(
      422,
    );
    // a user without scm.inventory.approve cannot approve
    await post(
      tokenNoApprove,
      `/scm/inventory/transfers/${t.id}/approve`,
    ).expect(403);

    await post(tokenAll, `/scm/inventory/transfers/${t.id}/approve`).expect(
      201,
    );
    expect((await overviewRow(product.id, whA.id))?.onHand).toBe(10);

    await post(tokenAll, `/scm/inventory/transfers/${t.id}/dispatch`).expect(
      201,
    );
    expect((await overviewRow(product.id, whA.id))?.onHand).toBe(7);
    expect((await overviewRow(product.id, whB.id))?.onHand).toBe(0);

    await post(tokenAll, `/scm/inventory/transfers/${t.id}/receive`).expect(
      201,
    );
    expect((await overviewRow(product.id, whB.id))?.onHand).toBe(3);

    // cannot cancel a received transfer
    await post(tokenAll, `/scm/inventory/transfers/${t.id}/cancel`).expect(422);
  });

  it("applies an adjustment only on approval and blocks stock from going negative", async () => {
    const adj = data<Id>(
      await post(tokenAll, "/scm/inventory/adjustments", {
        productId: product.id,
        warehouseId: whA.id,
        direction: "OUT",
        reason: "Damage",
        quantity: 2,
      }).expect(201),
    );
    expect((await overviewRow(product.id, whA.id))?.onHand).toBe(7);
    await post(tokenAll, `/scm/inventory/adjustments/${adj.id}/approve`).expect(
      201,
    );
    expect((await overviewRow(product.id, whA.id))?.onHand).toBe(5);

    const big = data<Id>(
      await post(tokenAll, "/scm/inventory/adjustments", {
        productId: product.id,
        warehouseId: whA.id,
        direction: "OUT",
        reason: "Loss",
        quantity: 999,
      }).expect(201),
    );
    await post(tokenAll, `/scm/inventory/adjustments/${big.id}/approve`).expect(
      422,
    );
    // the failed approval rolled back completely: still PENDING, stock unchanged
    const after = await prisma.scmStockAdjustment.findUniqueOrThrow({
      where: { id: big.id },
    });
    expect(after.status).toBe("PENDING");
    expect((await overviewRow(product.id, whA.id))?.onHand).toBe(5);
    await post(tokenAll, `/scm/inventory/adjustments/${big.id}/reject`).expect(
      201,
    );
  });

  it("never lets two concurrent dispatches oversell the same stock", async () => {
    const p2 = data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `race-${randomUUID().slice(0, 6)}`,
        name: "Race",
      }).expect(201),
    );
    await post(tokenAll, "/scm/inventory/opening-balance", {
      productId: p2.id,
      warehouseId: whA.id,
      quantity: 10,
    }).expect(201);
    const mk = async () => {
      const t = data<Id>(
        await post(tokenAll, "/scm/inventory/transfers", {
          productId: p2.id,
          sourceWarehouseId: whA.id,
          destinationWarehouseId: whB.id,
          quantity: 8,
        }).expect(201),
      );
      await post(tokenAll, `/scm/inventory/transfers/${t.id}/approve`).expect(
        201,
      );
      return t.id;
    };
    // Each transfer individually passes the create-time hint (8 <= 10).
    const [a, b] = [await mk(), await mk()];
    const results = await Promise.all([
      post(tokenAll, `/scm/inventory/transfers/${a}/dispatch`),
      post(tokenAll, `/scm/inventory/transfers/${b}/dispatch`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect((await overviewRow(p2.id, whA.id))?.onHand).toBe(2);
  });

  it("registers batches at zero quantity and bulk-creates unique serials", async () => {
    const batch = await post(tokenAll, "/scm/inventory/batches", {
      batchNumber: "lot-1",
      productId: product.id,
      warehouseId: whA.id,
      manufacturingDate: "2026-04-01",
      expiryDate: "2026-03-01",
    });
    expect(batch.status).toBe(422); // expiry before manufacturing
    const ok = await post(tokenAll, "/scm/inventory/batches", {
      batchNumber: "lot-1",
      productId: product.id,
      warehouseId: whA.id,
      expiryDate: "2027-03-01",
    }).expect(201);
    expect(data<{ quantity: string; status: string }>(ok)).toMatchObject({
      quantity: "0",
      status: "ACTIVE",
    });
    await post(tokenAll, "/scm/inventory/batches", {
      batchNumber: "LOT-1",
      productId: product.id,
      warehouseId: whA.id,
    }).expect(409);

    await post(tokenAll, "/scm/inventory/serials", {
      productId: product.id,
      warehouseId: whA.id,
      serialNumbers: ["S-1", "S-2"],
    }).expect(201);
    await post(tokenAll, "/scm/inventory/serials", {
      productId: product.id,
      warehouseId: whA.id,
      serialNumbers: ["S-2", "S-3"],
    }).expect(409);
    await post(tokenAll, "/scm/inventory/serials", {
      productId: product.id,
      warehouseId: whA.id,
      serialNumbers: ["S-9", "S-9"],
    }).expect(422);
  });

  it("isolates tenants across products, warehouses and inventory", async () => {
    await get(tokenB, `/scm/products/${product.id}`).expect(404);
    await get(tokenB, `/scm/warehouses/${whA.id}`).expect(404);
    await get(tokenB, `/scm/inventory/overview/${product.id}`).expect(404);
    await post(tokenB, "/scm/inventory/opening-balance", {
      productId: product.id,
      warehouseId: whA.id,
      quantity: 5,
    }).expect(422);
    const listB = data<{ id: number }[]>(
      await get(tokenB, "/scm/products").expect(200),
    );
    expect(listB.some((x) => x.id === product.id)).toBe(false);
  });

  it("refuses to delete a product that has stock history", async () => {
    await http()
      .delete(`/scm/products/${product.id}`)
      .set(auth(tokenAll))
      .expect(422);
  });
});
