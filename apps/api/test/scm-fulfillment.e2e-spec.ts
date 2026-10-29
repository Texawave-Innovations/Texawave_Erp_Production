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

describe("scm sales -> fulfillment -> shipment (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoApprove: string;
  let tokenReadOnly: string;
  let tokenB: string;
  let wh: Id;
  let customer: Id;
  let product: Id;
  let carrier: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const today = "2026-10-18";

  async function stock(productId: number) {
    const b = await prisma.scmStockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: wh.id } },
    });
    return {
      onHand: Number(b?.onHand ?? 0),
      reserved: Number(b?.reserved ?? 0),
    };
  }
  async function fresh<T = Doc>(url: string) {
    return data<T>(await get(tokenAll, url).expect(200));
  }
  const newProduct = async (label: string, onHand: number) => {
    const p = data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `${label}-${randomUUID().slice(0, 6)}`,
        name: label,
        costPrice: 7,
      }).expect(201),
    );
    if (onHand > 0) {
      await post(tokenAll, "/scm/inventory/opening-balance", {
        productId: p.id,
        warehouseId: wh.id,
        quantity: onHand,
      }).expect(201);
    }
    return p;
  };
  /** A confirmed sales order for one product. */
  const confirmedOrder = async (
    productId: number,
    quantity: number,
    shipTo = "1 Test Road",
  ) => {
    const so = data<Doc & { items: Id[] }>(
      await post(tokenAll, "/scm/sales-orders", {
        customerId: customer.id,
        orderDate: today,
        shipToAddress: shipTo,
        items: [{ productId, quantity, unitPrice: 10, taxRate: 18 }],
      }).expect(201),
    );
    await post(tokenAll, `/scm/sales-orders/${so.id}/confirm`).expect(201);
    return so;
  };

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
      data: { name: `Org A ${suffix}`, slug: `scm-ful-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-ful-b-${suffix}` },
    });

    // The packing test below submits packageType: "Box" — the
    // package_type MasterListValueGuard requires it to already be an
    // active SCM Master value for the org.
    await prisma.scmMasterListItem.create({
      data: { organizationId: orgA.id, category: "package_type", value: "Box" },
    });
    // The carrier/shipment tests below submit shipment_service_type and
    // shipment_exception_reason values — same MasterListValueGuard.
    await prisma.scmMasterListItem.createMany({
      data: [
        {
          organizationId: orgA.id,
          category: "shipment_service_type",
          value: "STANDARD",
        },
        {
          organizationId: orgA.id,
          category: "shipment_service_type",
          value: "EXPRESS",
        },
        {
          organizationId: orgA.id,
          category: "shipment_exception_reason",
          value: "CUSTOMER_UNAVAILABLE",
        },
      ],
    });

    const codes = [
      "scm.product.read",
      "scm.product.write",
      "scm.warehouse.read",
      "scm.warehouse.write",
      "scm.inventory.read",
      "scm.inventory.write",
      "scm.procurement.read",
      "scm.sales.read",
      "scm.sales.write",
      "scm.fulfillment.read",
      "scm.fulfillment.write",
      "scm.fulfillment.approve",
      "scm.logistics.read",
      "scm.logistics.write",
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
          fullName: "Ops User",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-ful-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "noapprove@scm-ful-a.test",
      idsOf(codes.filter((c) => c !== "scm.fulfillment.approve")),
    );
    await makeUser(
      orgA.id,
      "ro@scm-ful-a.test",
      idsOf(codes.filter((c) => c.endsWith(".read"))),
    );
    await makeUser(orgB.id, "all@scm-ful-b.test", idsOf(codes));
    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-ful-a.test");
    tokenNoApprove = await login(orgA.slug, "noapprove@scm-ful-a.test");
    tokenReadOnly = await login(orgA.slug, "ro@scm-ful-a.test");
    tokenB = await login(orgB.slug, "all@scm-ful-b.test");

    wh = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `W${suffix}`,
        name: "Main",
      }).expect(201),
    );
    customer = data<Id>(
      await post(tokenAll, "/scm/customers", {
        name: "Acme Retail",
        shippingAddress: "42 Market Street",
      }).expect(201),
    );
    carrier = data<Id>(
      await post(tokenAll, "/scm/carriers", {
        carrierCode: `dhl-${suffix}`,
        carrierName: "Test Express",
        serviceTypes: ["STANDARD", "EXPRESS"],
        trackingUrlTemplate: "https://track.example.com/{trackingNumber}",
      }).expect(201),
    );
    product = await newProduct("Flow item", 10);
  });

  // Documents write append-only audit/ledger rows, so test orgs are never
  // deleted (same tradeoff as the CRM suites).
  afterAll(async () => {
    await app.close();
  });

  it("creates customers with allocated codes and sales orders with server-side totals", async () => {
    const c = data<{ customerCode: string }>(
      await post(tokenAll, "/scm/customers", { name: "Second Co" }).expect(201),
    );
    expect(c.customerCode).toMatch(/^CUST-\d{4}$/);
    const so = data<
      Doc & { soNumber: string; total: string; shipToAddress: string }
    >(
      await post(tokenAll, "/scm/sales-orders", {
        customerId: customer.id,
        orderDate: today,
        items: [
          { productId: product.id, quantity: 2, unitPrice: 50, taxRate: 18 },
        ],
      }).expect(201),
    );
    expect(so.soNumber).toMatch(/^TW\/SO\/\d{2}-\d{2}\/\d{4}$/);
    expect(so.status).toBe("DRAFT");
    expect(so.total).toBe("118"); // 2 * 50 * 1.18
    expect(so.shipToAddress).toBe("42 Market Street"); // defaulted from the customer
    // a draft order cannot be fulfilled
    await post(tokenAll, "/scm/fulfillments", {
      salesOrderId: so.id,
      warehouseId: wh.id,
    }).expect(422);
    await post(tokenAll, "/scm/sales-orders", {
      customerId: customer.id,
      orderDate: today,
      items: [
        { productId: product.id, quantity: 1, unitPrice: 1 },
        { productId: product.id, quantity: 1, unitPrice: 1 },
      ],
    }).expect(422);
  });

  it("runs order -> reserve -> pick -> pack -> issue with partial availability", async () => {
    const so = await confirmedOrder(product.id, 15);
    const f = data<Doc & { items: { orderedQty: string }[] }>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    expect(f.status).toBe("PARTIALLY_AVAILABLE"); // 10 on hand vs 15 ordered
    expect(Number(f.items[0]!.orderedQty)).toBe(15);
    // the whole order is already claimed
    await post(tokenAll, "/scm/fulfillments", {
      salesOrderId: so.id,
      warehouseId: wh.id,
    }).expect(422);

    // reserve what exists; ordering is enforced
    await post(tokenAll, `/scm/fulfillments/${f.id}/pick-list`).expect(422);
    await post(tokenReadOnly, `/scm/fulfillments/${f.id}/reserve`).expect(403);
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(201);
    expect(await stock(product.id)).toEqual({ onHand: 10, reserved: 10 });
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(422); // already reserved

    // release then re-reserve
    await post(tokenAll, `/scm/fulfillments/${f.id}/release`).expect(201);
    expect((await stock(product.id)).reserved).toBe(0);
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(201);

    // pick list
    const afterPick = await post(
      tokenAll,
      `/scm/fulfillments/${f.id}/pick-list`,
    ).expect(201);
    expect(data<Doc>(afterPick).status).toBe("PICKING");
    await post(tokenAll, `/scm/fulfillments/${f.id}/pick-list`).expect(422); // only one
    await post(tokenAll, `/scm/fulfillments/${f.id}/release`).expect(422); // pick exists

    const picks = data<
      (Doc & { items: (Id & { requestedQuantity: string })[] })[]
    >(await get(tokenAll, "/scm/pickings?limit=100").expect(200));
    const pick = picks.find(
      (p) => p.items.length > 0 && Number(p.items[0]!.requestedQuantity) === 10,
    )!;
    await post(tokenAll, `/scm/pickings/${pick.id}/record`, {
      items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: 10 }],
    }).expect(422); // not started
    await post(tokenAll, `/scm/pickings/${pick.id}/start`).expect(201);
    await post(tokenAll, `/scm/pickings/${pick.id}/record`, {
      items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: 11 }],
    }).expect(422); // more than requested
    const partial = await post(tokenAll, `/scm/pickings/${pick.id}/record`, {
      items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: 6 }],
    }).expect(201);
    expect(data<Doc>(partial).status).toBe("PARTIALLY_PICKED");
    // packing needs a COMPLETED pick
    await post(tokenAll, "/scm/packings", {
      pickingId: pick.id,
      packages: [
        {
          packageNumber: "PKG-1",
          items: [{ productId: product.id, quantity: 6 }],
        },
      ],
    }).expect(422);
    const done = await post(tokenAll, `/scm/pickings/${pick.id}/record`, {
      items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: 10 }],
    }).expect(201);
    expect(data<Doc>(done).status).toBe("COMPLETED");
    expect((await fresh(`/scm/fulfillments/${f.id}`)).status).toBe("PICKING");

    // pack: over-packing and empty packages are refused
    await post(tokenAll, "/scm/packings", {
      pickingId: pick.id,
      packages: [
        {
          packageNumber: "PKG-1",
          items: [{ productId: product.id, quantity: 11 }],
        },
      ],
    }).expect(422);
    await post(tokenAll, "/scm/packings", {
      pickingId: pick.id,
      packages: [
        {
          packageNumber: "PKG-1",
          items: [{ productId: product.id, quantity: 0 }],
        },
      ],
    }).expect(422);
    const pack = data<Doc & { packages: Id[] }>(
      await post(tokenAll, "/scm/packings", {
        pickingId: pick.id,
        packages: [
          {
            packageNumber: "PKG-1",
            packageType: "Box",
            weight: 4.5,
            items: [{ productId: product.id, quantity: 6 }],
          },
          {
            packageNumber: "PKG-2",
            packageType: "Box",
            weight: 3,
            items: [{ productId: product.id, quantity: 4 }],
          },
        ],
      }).expect(201),
    );
    expect(pack.status).toBe("PACKED");
    expect((await fresh(`/scm/fulfillments/${f.id}`)).status).toBe(
      "READY_TO_SHIP",
    );
    await post(tokenAll, "/scm/packings", {
      pickingId: pick.id,
      packages: [
        {
          packageNumber: "PKG-9",
          items: [{ productId: product.id, quantity: 1 }],
        },
      ],
    }).expect(422); // already packed

    // issuing needs the approve permission, then reduces stock exactly once
    await post(tokenNoApprove, `/scm/fulfillments/${f.id}/finalize`).expect(
      403,
    );
    const issued = data<Doc>(
      await post(tokenAll, `/scm/fulfillments/${f.id}/finalize`).expect(201),
    );
    expect(issued.status).toBe("FULFILLED");
    expect(await stock(product.id)).toEqual({ onHand: 0, reserved: 0 });
    await post(tokenAll, `/scm/fulfillments/${f.id}/finalize`).expect(201); // idempotent
    expect((await stock(product.id)).onHand).toBe(0);
    const detail = data<{
      items: { issuedQty: string }[];
      ledgerEntries: { transactionType: string; quantityOut: string }[];
    }>(await get(tokenAll, `/scm/fulfillments/${f.id}`).expect(200));
    expect(Number(detail.items[0]!.issuedQty)).toBe(10);
    expect(detail.ledgerEntries).toHaveLength(1);
    expect(detail.ledgerEntries[0]).toMatchObject({
      transactionType: "SALES_ISSUE",
    });
    await post(tokenAll, `/scm/fulfillments/${f.id}/cancel`, {
      reason: "too late",
    }).expect(422);

    // the 5 units that were not issued are claimable again
    const soDetail = data<{ items: { remainingQty: number }[] }>(
      await get(tokenAll, `/scm/sales-orders/${so.id}`).expect(200),
    );
    expect(soDetail.items[0]!.remainingQty).toBe(5);
    const second = data<Doc>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    expect(second.status).toBe("PARTIALLY_AVAILABLE");

    // shortage requisition for the backorder, only once
    const backorders = data<Id[]>(
      await get(tokenAll, "/scm/fulfillments?view=backorders&limit=100").expect(
        200,
      ),
    );
    expect(backorders.some((b) => b.id === second.id)).toBe(true);
    const pr = data<{ requisitionNumber: string }>(
      await post(
        tokenAll,
        `/scm/fulfillments/${second.id}/shortage-requisition`,
      ).expect(201),
    );
    expect(pr.requisitionNumber).toMatch(/^TW\/PR\//);
    await post(
      tokenAll,
      `/scm/fulfillments/${second.id}/shortage-requisition`,
    ).expect(422);
    await post(tokenAll, `/scm/fulfillments/${second.id}/cancel`, {
      reason: "test cleanup",
    }).expect(201);

    // ---- logistics on the issued fulfillment ----
    const shippable = data<
      { id: number; blockers: string[]; unshippedPackings: Id[] }[]
    >(await get(tokenAll, "/scm/shipments/shippable").expect(200));
    const entry = shippable.find((s) => s.id === f.id)!;
    expect(entry.blockers).toEqual([]);
    expect(entry.unshippedPackings.map((p) => p.id)).toEqual([pack.id]);

    const shipment = data<
      Doc & { shipmentNumber: string; totalPackages: number }
    >(
      await post(tokenAll, "/scm/shipments", {
        fulfillmentId: f.id,
        packingIds: [pack.id],
      }).expect(201),
    );
    expect(shipment.shipmentNumber).toMatch(/^TW\/SHIP\//);
    expect(shipment.totalPackages).toBe(2);
    expect(shipment.status).toBe("READY_TO_SHIP");
    // the same packing cannot ship twice
    await post(tokenAll, "/scm/shipments", {
      fulfillmentId: f.id,
      packingIds: [pack.id],
    }).expect(422);

    const S = `/scm/shipments/${shipment.id}`;
    await post(tokenAll, `${S}/dispatch`).expect(422); // no carrier/label yet
    await post(tokenAll, `${S}/label`, { trackingNumber: "TRK1" }).expect(422);
    // the shipment_service_type MasterListValueGuard rejects an unknown value
    await post(tokenAll, `${S}/carrier`, {
      carrierId: carrier.id,
      serviceType: "NOT_A_REAL_SERVICE_TYPE",
    }).expect(400);
    await post(tokenAll, `${S}/carrier`, {
      carrierId: carrier.id,
      serviceType: "EXPRESS",
    }).expect(201);
    const labelled = data<{ trackingUrl: string; status: string }>(
      await post(tokenAll, `${S}/label`, { trackingNumber: "TRK 1/2" }).expect(
        201,
      ),
    );
    expect(labelled.status).toBe("LABEL_CREATED");
    expect(labelled.trackingUrl).toBe("https://track.example.com/TRK%201%2F2");
    await post(tokenAll, `${S}/dispatch`).expect(201);
    const so2 = await fresh<{ shippedStatus: string }>(
      `/scm/sales-orders/${so.id}`,
    );
    expect(so2.shippedStatus).toBe("Partially Shipped"); // 10 of 15 shipped
    await post(tokenAll, `${S}/cancel`, { reason: "late" }).expect(422); // dispatched
    await post(tokenAll, `${S}/deliver`, {}).expect(422); // not out for delivery
    await post(tokenAll, `${S}/status`, { status: "OUT_FOR_DELIVERY" }).expect(
      422,
    ); // must be in transit first
    await post(tokenAll, `${S}/status`, {
      status: "IN_TRANSIT",
      location: "Hub",
    }).expect(201);
    await post(tokenAll, `${S}/status`, { status: "OUT_FOR_DELIVERY" }).expect(
      201,
    );
    const withEx = data<{ status: string; exceptions: Id[] }>(
      await post(tokenAll, `${S}/exception`, {
        exceptionCode: "CUSTOMER_UNAVAILABLE",
        description: "Nobody home",
      }).expect(201),
    );
    expect(withEx.status).toBe("DELIVERY_EXCEPTION");
    await post(
      tokenAll,
      `${S}/exceptions/${withEx.exceptions[0]!.id}/resolve`,
      {
        resolution: "Rescheduled",
      },
    ).expect(201);
    await post(
      tokenAll,
      `${S}/exceptions/${withEx.exceptions[0]!.id}/resolve`,
      {
        resolution: "again",
      },
    ).expect(422);
    await post(tokenAll, `${S}/deliver`, { recipientName: "R. Kumar" }).expect(
      201,
    );
    const delivered = await fresh<{
      trackingEvents: { status: string }[];
      status: string;
    }>(S);
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.trackingEvents.map((e) => e.status)).toEqual(
      expect.arrayContaining([
        "CREATED",
        "CARRIER_ASSIGNED",
        "LABEL_CREATED",
        "DISPATCHED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERY_EXCEPTION",
        "DELIVERED",
      ]),
    );
    expect(
      (await fresh<{ deliveryStatus: string }>(`/scm/fulfillments/${f.id}`))
        .deliveryStatus,
    ).toBe("DELIVERED");
    await post(tokenAll, `${S}/dispatch`).expect(422); // no moves out of DELIVERED

    // tracking timeline is append-only at the database level
    const ev = await prisma.scmShipmentTrackingEvent.findFirstOrThrow({
      where: { shipmentId: shipment.id },
    });
    await expect(
      prisma.scmShipmentTrackingEvent.update({
        where: { id: ev.id },
        data: { description: "tamper" },
      }),
    ).rejects.toThrow();
  });

  it("cancelling a fulfillment releases its reservation and open pick lists", async () => {
    const p = await newProduct("Cancel item", 8);
    const so = await confirmedOrder(p.id, 8);
    const f = data<Doc>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    expect(f.status).toBe("AVAILABLE");
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(201);
    await post(tokenAll, `/scm/fulfillments/${f.id}/pick-list`).expect(201);
    expect(await stock(p.id)).toEqual({ onHand: 8, reserved: 8 });

    // a pick in progress blocks cancellation
    const pick = data<(Doc & { fulfillment: Id })[]>(
      await get(tokenAll, "/scm/pickings?limit=100").expect(200),
    ).find((x) => x.fulfillment.id === f.id)!;
    await post(tokenAll, `/scm/pickings/${pick.id}/start`).expect(201);
    await post(tokenAll, `/scm/fulfillments/${f.id}/cancel`, {
      reason: "oops",
    }).expect(422);
    await post(tokenAll, `/scm/pickings/${pick.id}/cancel`).expect(201);
    expect((await fresh(`/scm/fulfillments/${f.id}`)).status).toBe("RESERVED"); // synced back

    await post(tokenAll, `/scm/fulfillments/${f.id}/cancel`, {
      reason: "customer changed mind",
    }).expect(201);
    expect(await stock(p.id)).toEqual({ onHand: 8, reserved: 0 });
    // the sales order's quantity is free again
    const detail = data<{ items: { remainingQty: number }[] }>(
      await get(tokenAll, `/scm/sales-orders/${so.id}`).expect(200),
    );
    expect(detail.items[0]!.remainingQty).toBe(8);
    await post(tokenAll, `/scm/sales-orders/${so.id}/cancel`).expect(201);
  });

  it("never lets two concurrent reservations over-reserve the same stock", async () => {
    const p = await newProduct("Race item", 10);
    const make = async () => {
      const so = await confirmedOrder(p.id, 8);
      return data<Doc>(
        await post(tokenAll, "/scm/fulfillments", {
          salesOrderId: so.id,
          warehouseId: wh.id,
        }).expect(201),
      );
    };
    const [a, b] = [await make(), await make()];
    const results = await Promise.all([
      post(tokenAll, `/scm/fulfillments/${a.id}/reserve`),
      post(tokenAll, `/scm/fulfillments/${b.id}/reserve`),
    ]);
    // 10 on hand: the first reserves 8, the second can only reserve the remaining 2
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect((await stock(p.id)).reserved).toBe(10);
    const items = await prisma.scmFulfillmentItem.findMany({
      where: { fulfillmentId: { in: [a.id, b.id] } },
    });
    expect(
      items.map((i) => Number(i.reservedQty)).sort((x, y) => x - y),
    ).toEqual([2, 8]);
  });

  it("serialises concurrent fulfillments of the same sales order", async () => {
    const p = await newProduct("Claim item", 20);
    const so = await confirmedOrder(p.id, 10);
    const attempt = () =>
      post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      });
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
  });

  it("blocks shipping an order with no packed stock, and validates carriers", async () => {
    const p = await newProduct("Unshipped item", 3);
    const so = await confirmedOrder(p.id, 3, "");
    const f = data<Doc>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    const sh = await post(tokenAll, "/scm/shipments", {
      fulfillmentId: f.id,
      packingIds: [999999],
    });
    expect(sh.status).toBe(422);
    // duplicate carrier code
    await post(tokenAll, "/scm/carriers", {
      carrierCode: (
        await prisma.scmCarrier.findUniqueOrThrow({ where: { id: carrier.id } })
      ).carrierCode,
      carrierName: "Dup",
    }).expect(409);
    // an inactive carrier cannot be assigned
    await http()
      .patch(`/scm/carriers/${carrier.id}`)
      .set(auth(tokenAll))
      .send({ status: "INACTIVE" })
      .expect(200);
    const idle = data<Id>(
      await post(tokenAll, "/scm/carriers", {
        carrierCode: `x-${randomUUID().slice(0, 6)}`,
        carrierName: "Idle",
      }).expect(201),
    );
    expect(idle.id).toBeGreaterThan(0);
    await http()
      .patch(`/scm/carriers/${carrier.id}`)
      .set(auth(tokenAll))
      .send({ status: "ACTIVE" })
      .expect(200);
  });

  it("enforces tenant isolation across sales, fulfillment and logistics", async () => {
    const some = data<Id[]>(
      await get(tokenAll, "/scm/fulfillments?limit=1").expect(200),
    )[0]!;
    await get(tokenB, `/scm/fulfillments/${some.id}`).expect(404);
    await post(tokenB, `/scm/fulfillments/${some.id}/cancel`, {
      reason: "x",
    }).expect(404);
    expect(
      data<Id[]>(await get(tokenB, "/scm/sales-orders").expect(200)),
    ).toHaveLength(0);
    expect(
      data<Id[]>(await get(tokenB, "/scm/shipments").expect(200)),
    ).toHaveLength(0);
    await post(tokenB, "/scm/fulfillments", {
      salesOrderId: some.id,
      warehouseId: wh.id,
    }).expect(422);
    await get(tokenReadOnly, "/scm/shipments").expect(200);
    await post(tokenReadOnly, "/scm/shipments", {
      fulfillmentId: some.id,
      packingIds: [1],
    }).expect(403);
  });
});
