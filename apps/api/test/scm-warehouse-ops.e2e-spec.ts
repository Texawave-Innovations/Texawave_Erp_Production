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
interface Doc extends Id {
  status: string;
}

describe("scm warehouse put-away and internal movements (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenReadOnly: string;
  let tokenB: string;
  let wh: Id;
  let locA: Id & { capacity: string | null };
  let locB: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const today = "2026-10-18";

  async function locationQty(locationId: number, productId: number) {
    const row = await prisma.scmLocationStock.findUnique({
      where: {
        productId_warehouseId_locationId: {
          productId,
          warehouseId: wh.id,
          locationId,
        },
      },
    });
    return Number(row?.quantity ?? 0);
  }

  const newProduct = async (label: string) =>
    data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `${label}-${randomUUID().slice(0, 6)}`,
        name: label,
      }).expect(201),
    );

  const newLocation = async (code: string, capacity?: number) =>
    data<Id & { capacity: string | null }>(
      await post(tokenAll, "/scm/warehouse-locations", {
        warehouseId: wh.id,
        locationType: "ZONE",
        code,
        ...(capacity !== undefined ? { capacity } : {}),
      }).expect(201),
    );

  /** A sent PO fully received into stock (a COMPLETED GRN with no location). */
  async function receivedGrn(productId: number, qty: number) {
    const supplier = data<Id>(
      await post(tokenAll, "/scm/suppliers", {
        companyName: `Sup ${randomUUID().slice(0, 6)}`,
        contactPerson: "A",
      }).expect(201),
    );
    const po = data<Id>(
      await post(tokenAll, "/scm/procurement/purchase-orders", {
        supplierId: supplier.id,
        poDate: today,
        warehouseId: wh.id,
        items: [{ productId, quantity: qty, unitPrice: 5 }],
      }).expect(201),
    );
    const base = `/scm/procurement/purchase-orders/${po.id}`;
    await post(tokenAll, `${base}/submit`).expect(201);
    await post(tokenAll, `${base}/approve`).expect(201);
    await post(tokenAll, `${base}/send`).expect(201);
    const full = data<{ items: Id[] }>(await get(tokenAll, base).expect(200));
    return data<{ id: number; items: Id[] }>(
      await post(tokenAll, "/scm/procurement/goods-receipts", {
        purchaseOrderId: po.id,
        receiptDate: today,
        lines: [
          { purchaseOrderItemId: full.items[0]!.id, receivingQuantity: qty },
        ],
      }).expect(201),
    );
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
      data: { name: `Org A ${suffix}`, slug: `scm-wh-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-wh-b-${suffix}` },
    });
    const codes = [
      "scm.supplier.read",
      "scm.supplier.write",
      "scm.product.read",
      "scm.product.write",
      "scm.warehouse.read",
      "scm.warehouse.write",
      "scm.procurement.read",
      "scm.procurement.write",
      "scm.procurement.approve",
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
        data: { organizationId: orgId, email, passwordHash, fullName: "WH Op" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-wh-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "ro@scm-wh-a.test",
      idsOf(codes.filter((c) => c.endsWith(".read"))),
    );
    await makeUser(orgB.id, "all@scm-wh-b.test", idsOf(codes));
    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-wh-a.test");
    tokenReadOnly = await login(orgA.slug, "ro@scm-wh-a.test");
    tokenB = await login(orgB.slug, "all@scm-wh-b.test");

    wh = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `W${suffix}`,
        name: "Main",
      }).expect(201),
    );
    locA = await newLocation(`A${suffix}`, 10);
    locB = await newLocation(`B${suffix}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it("puts away a completed GRN into a bin, respecting capacity", async () => {
    const p = await newProduct("PA item");
    const grn = await receivedGrn(p.id, 8);

    const sources = data<Id[]>(
      await get(tokenAll, "/scm/warehouse/putaway/sources").expect(200),
    );
    expect(sources.some((s) => s.id === grn.id)).toBe(true);

    const putaway = data<Doc & { putawayNumber: string; items: Id[] }>(
      await post(tokenReadOnly, "/scm/warehouse/putaway", {
        warehouseId: wh.id,
        grnId: grn.id,
      }).expect(403),
    );
    const created = data<Doc & { putawayNumber: string; items: Id[] }>(
      await post(tokenAll, "/scm/warehouse/putaway", {
        warehouseId: wh.id,
        grnId: grn.id,
      }).expect(201),
    );
    expect(created.putawayNumber).toMatch(/^TW\/PUTAWAY\//);
    expect(created.status).toBe("PENDING");
    void putaway;

    // a second put-away against the same GRN is refused
    await post(tokenAll, "/scm/warehouse/putaway", {
      warehouseId: wh.id,
      grnId: grn.id,
    }).expect(422);

    const url = `/scm/warehouse/putaway/${created.id}`;
    await post(tokenAll, `${url}/items/${created.items[0]!.id}`, {
      quantity: 1,
      destinationLocationId: locA.id,
    }).expect(422); // not started
    await post(tokenAll, `${url}/start`).expect(201);

    // over capacity (locA capacity is 10)
    await post(tokenAll, `${url}/items/${created.items[0]!.id}`, {
      quantity: 11,
      destinationLocationId: locA.id,
    }).expect(422);
    // more than the line's quantity (8)
    await post(tokenAll, `${url}/items/${created.items[0]!.id}`, {
      quantity: 9,
      destinationLocationId: locA.id,
    }).expect(422);

    const partial = data<Doc>(
      await post(tokenAll, `${url}/items/${created.items[0]!.id}`, {
        quantity: 5,
        destinationLocationId: locA.id,
      }).expect(201),
    );
    expect(partial.status).toBe("IN_PROGRESS");
    expect(await locationQty(locA.id, p.id)).toBe(5);

    const done = data<Doc>(
      await post(tokenAll, `${url}/items/${created.items[0]!.id}`, {
        quantity: 3,
        destinationLocationId: locA.id,
      }).expect(201),
    );
    expect(done.status).toBe("COMPLETED");
    expect(await locationQty(locA.id, p.id)).toBe(8);
    await post(tokenAll, `${url}/cancel`, {}).expect(422); // terminal
  });

  it("moves stock between bins and validates locations", async () => {
    const p = await newProduct("MV item");
    const grn = await receivedGrn(p.id, 6);
    const pa = data<Doc & { items: Id[] }>(
      await post(tokenAll, "/scm/warehouse/putaway", {
        warehouseId: wh.id,
        grnId: grn.id,
      }).expect(201),
    );
    await post(tokenAll, `/scm/warehouse/putaway/${pa.id}/start`).expect(201);
    await post(
      tokenAll,
      `/scm/warehouse/putaway/${pa.id}/items/${pa.items[0]!.id}`,
      {
        quantity: 6,
        destinationLocationId: locB.id,
      },
    ).expect(201);
    expect(await locationQty(locB.id, p.id)).toBe(6);

    await post(tokenAll, "/scm/warehouse/movements", {
      warehouseId: wh.id,
      items: [
        {
          productId: p.id,
          quantity: 4,
          sourceLocationId: locB.id,
          destinationLocationId: locB.id,
        },
      ],
    }).expect(422); // same location
    const move = data<Doc & { movementNumber: string; items: Id[] }>(
      await post(tokenAll, "/scm/warehouse/movements", {
        warehouseId: wh.id,
        items: [
          {
            productId: p.id,
            quantity: 4,
            sourceLocationId: locB.id,
            destinationLocationId: locA.id,
          },
        ],
      }).expect(201),
    );
    expect(move.movementNumber).toMatch(/^TW\/WHMOV\//);
    expect(move.status).toBe("DRAFT");

    const base = `/scm/warehouse/movements/${move.id}`;
    await post(tokenAll, `${base}/complete`).expect(422); // must be approved first
    await post(tokenAll, `${base}/submit`).expect(201);
    await post(tokenAll, `${base}/approve`).expect(201);
    await post(tokenAll, `${base}/complete`).expect(201);
    expect(await locationQty(locB.id, p.id)).toBe(2);
    expect(await locationQty(locA.id, p.id)).toBeGreaterThanOrEqual(4);
    await post(tokenAll, `${base}/complete`).expect(422); // already completed
  });

  it("never lets a movement take more than a bin holds", async () => {
    const p = await newProduct("Short item");
    const grn = await receivedGrn(p.id, 3);
    const pa = data<Doc & { items: Id[] }>(
      await post(tokenAll, "/scm/warehouse/putaway", {
        warehouseId: wh.id,
        grnId: grn.id,
      }).expect(201),
    );
    await post(tokenAll, `/scm/warehouse/putaway/${pa.id}/start`).expect(201);
    await post(
      tokenAll,
      `/scm/warehouse/putaway/${pa.id}/items/${pa.items[0]!.id}`,
      {
        quantity: 3,
        destinationLocationId: locB.id,
      },
    ).expect(201);

    const move = data<Doc & { id: number }>(
      await post(tokenAll, "/scm/warehouse/movements", {
        warehouseId: wh.id,
        items: [
          {
            productId: p.id,
            quantity: 10,
            sourceLocationId: locB.id,
            destinationLocationId: locA.id,
          },
        ],
      }).expect(201),
    );
    await post(tokenAll, `/scm/warehouse/movements/${move.id}/complete`).expect(
      422,
    );
  });

  it("supports an ad-hoc put-away with no source GRN", async () => {
    const p = await newProduct("Adhoc item");
    const created = data<Doc>(
      await post(tokenAll, "/scm/warehouse/putaway", {
        warehouseId: wh.id,
      }).expect(201),
    );
    const withLine = data<Doc & { items: (Id & { quantity: string })[] }>(
      await post(tokenAll, `/scm/warehouse/putaway/${created.id}/lines`, {
        productId: p.id,
        quantity: 2,
      }).expect(201),
    );
    expect(withLine.items).toHaveLength(1);
    await post(tokenAll, `/scm/warehouse/putaway/${created.id}/start`).expect(
      201,
    );
    await post(
      tokenAll,
      `/scm/warehouse/putaway/${created.id}/items/${withLine.items[0]!.id}`,
      {
        quantity: 2,
        destinationLocationId: locB.id,
      },
    ).expect(201);
  });

  it("the dashboard and location-stock views report real totals", async () => {
    const dash = data<{ activeWarehouses: number; occupiedLocations: number }>(
      await get(tokenAll, "/scm/warehouse/dashboard").expect(200),
    );
    expect(dash.activeWarehouses).toBeGreaterThan(0);
    expect(dash.occupiedLocations).toBeGreaterThan(0);
    const stock = data<{ quantity: string; location: Id }[]>(
      await get(tokenAll, "/scm/warehouse/location-stock?limit=100").expect(
        200,
      ),
    );
    expect(stock.every((s) => Number(s.quantity) > 0)).toBe(true);
    const activity = data<{ entityType: string }[]>(
      await get(tokenAll, "/scm/warehouse/activity?limit=50").expect(200),
    );
    expect(activity.some((a) => a.entityType === "scm_putaway")).toBe(true);
  });

  it("enforces tenant isolation across warehouse operations", async () => {
    const some = data<Id[]>(
      await get(tokenAll, "/scm/warehouse/putaway?limit=1").expect(200),
    )[0]!;
    await get(tokenB, `/scm/warehouse/putaway/${some.id}`).expect(404);
    expect(
      data<Id[]>(await get(tokenB, "/scm/warehouse/movements").expect(200)),
    ).toHaveLength(0);
    await post(tokenB, `/scm/warehouse/putaway/${some.id}/start`).expect(404);
  });
});
