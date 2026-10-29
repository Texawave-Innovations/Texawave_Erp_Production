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
interface ReturnDoc extends Doc {
  returnNumber: string;
  items: (Id & { productId: number })[];
}

describe("scm returns and quality (e2e)", () => {
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
  let supplier: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const put = (t: string, url: string, body: object = {}) =>
    http().put(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const today = "2026-10-18";

  async function bucket(productId: number) {
    const b = await prisma.scmStockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: wh.id } },
    });
    return {
      onHand: Number(b?.onHand ?? 0),
      reserved: Number(b?.reserved ?? 0),
      quarantine: Number(b?.quarantine ?? 0),
      damaged: Number(b?.damaged ?? 0),
    };
  }

  const newProduct = async (label: string, onHand = 0) => {
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

  /** A fully issued (FULFILLED) order of `qty` units of `productId`. */
  async function fulfilledOrder(productId: number, qty: number) {
    const so = data<Id & { soNumber: string }>(
      await post(tokenAll, "/scm/sales-orders", {
        customerId: customer.id,
        orderDate: today,
        shipToAddress: "1 Return Road",
        items: [{ productId, quantity: qty, unitPrice: 10 }],
      }).expect(201),
    );
    await post(tokenAll, `/scm/sales-orders/${so.id}/confirm`).expect(201);
    const f = data<Id & { fulfillmentNumber: string }>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(201);
    await post(tokenAll, `/scm/fulfillments/${f.id}/pick-list`).expect(201);
    const picks = data<(Id & { items: Id[]; fulfillment: Id })[]>(
      await get(tokenAll, "/scm/pickings?limit=100").expect(200),
    );
    const pick = picks.find((p) => p.fulfillment.id === f.id)!;
    await post(tokenAll, `/scm/pickings/${pick.id}/start`).expect(201);
    await post(tokenAll, `/scm/pickings/${pick.id}/record`, {
      items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: qty }],
    }).expect(201);
    await post(tokenAll, "/scm/packings", {
      pickingId: pick.id,
      packages: [
        { packageNumber: "P1", items: [{ productId, quantity: qty }] },
      ],
    }).expect(201);
    await post(tokenAll, `/scm/fulfillments/${f.id}/finalize`).expect(201);
    return f;
  }

  /** A sent PO fully received into stock (a COMPLETED GRN). */
  async function receivedGrn(productId: number, qty: number) {
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
    const grn = data<{ id: number; items: Id[] }>(
      await post(tokenAll, "/scm/procurement/goods-receipts", {
        purchaseOrderId: po.id,
        receiptDate: today,
        lines: [
          { purchaseOrderItemId: full.items[0]!.id, receivingQuantity: qty },
        ],
      }).expect(201),
    );
    return grn;
  }

  const R = "/scm/returns";
  const customerReturn = async (
    fulfillmentId: number,
    productId: number,
    qty: number,
  ) =>
    data<ReturnDoc>(
      await post(tokenAll, `${R}/customer`, {
        fulfillmentId,
        reasonCode: "DEFECTIVE",
        items: [{ productId, requestedQuantity: qty }],
      }).expect(201),
    );

  /** Drives a customer return from REQUESTED to INSPECTED/DISPOSITION_PENDING. */
  async function toDispositionPending(
    ret: ReturnDoc,
    accepted: number,
    rejected: number,
    condition = "NEW",
  ) {
    await post(tokenAll, `${R}/${ret.id}/submit`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/approve`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/in-transit`, {
      carrier: "Self",
      trackingNumber: "T1",
    }).expect(201);
    await post(tokenAll, `${R}/${ret.id}/receive`, {}).expect(201);
    await post(tokenAll, `${R}/${ret.id}/start-inspection`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/inspect`, {
      itemResults: [
        {
          itemId: ret.items[0]!.id,
          condition,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
        },
      ],
    }).expect(201);
    await post(tokenAll, `${R}/${ret.id}/to-disposition`).expect(201);
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
      data: { name: `Org A ${suffix}`, slug: `scm-rq-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-rq-b-${suffix}` },
    });
    // The return/defect tests below submit return_reason and
    // quality_defect_category values — the MasterListValueGuard requires
    // each to already be an active SCM Master value for the org.
    await prisma.scmMasterListItem.createMany({
      data: [
        {
          organizationId: orgA.id,
          category: "return_reason",
          value: "DEFECTIVE",
        },
        { organizationId: orgA.id, category: "return_reason", value: "OTHER" },
        {
          organizationId: orgA.id,
          category: "return_reason",
          value: "QUALITY_ISSUE",
        },
        {
          organizationId: orgA.id,
          category: "quality_defect_category",
          value: "PHYSICAL_DAMAGE",
        },
        {
          organizationId: orgA.id,
          category: "quality_defect_category",
          value: "OTHER",
        },
        {
          organizationId: orgA.id,
          category: "quality_defect_severity",
          value: "CRITICAL",
        },
        {
          organizationId: orgA.id,
          category: "quality_defect_severity",
          value: "LOW",
        },
        {
          organizationId: orgA.id,
          category: "quality_inspection_priority",
          value: "HIGH",
        },
      ],
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
      "scm.sales.read",
      "scm.sales.write",
      "scm.fulfillment.read",
      "scm.fulfillment.write",
      "scm.fulfillment.approve",
      "scm.returns.read",
      "scm.returns.write",
      "scm.returns.approve",
      "scm.quality.read",
      "scm.quality.write",
      "scm.quality.approve",
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
          fullName: "QA Lead",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-rq-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "noapprove@scm-rq-a.test",
      idsOf(
        codes.filter(
          (c) =>
            !c.endsWith(".approve") ||
            c.startsWith("scm.fulfillment") ||
            c.startsWith("scm.procurement"),
        ),
      ),
    );
    await makeUser(
      orgA.id,
      "ro@scm-rq-a.test",
      idsOf(codes.filter((c) => c.endsWith(".read"))),
    );
    await makeUser(orgB.id, "all@scm-rq-b.test", idsOf(codes));
    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-rq-a.test");
    tokenNoApprove = await login(orgA.slug, "noapprove@scm-rq-a.test");
    tokenReadOnly = await login(orgA.slug, "ro@scm-rq-a.test");
    tokenB = await login(orgB.slug, "all@scm-rq-b.test");

    wh = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `W${suffix}`,
        name: "Main",
      }).expect(201),
    );
    customer = data<Id>(
      await post(tokenAll, "/scm/customers", {
        name: "Return Customer",
      }).expect(201),
    );
    supplier = data<Id>(
      await post(tokenAll, "/scm/suppliers", {
        companyName: "Return Supplier",
        contactPerson: "S",
      }).expect(201),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("runs a customer return end to end with split dispositions and an over-return guard", async () => {
    const p = await newProduct("Ret item", 10);
    const f = await fulfilledOrder(p.id, 10);
    expect((await bucket(p.id)).onHand).toBe(0);

    // eligibility comes from the issued quantity, never the client
    await post(tokenAll, `${R}/customer`, {
      fulfillmentId: f.id,
      reasonCode: "DEFECTIVE",
      items: [{ productId: p.id, requestedQuantity: 11 }],
    }).expect(422);
    const ret = await customerReturn(f.id, p.id, 4);
    expect(ret.returnNumber).toMatch(/^TW\/CR\/\d{2}-\d{2}\/\d{4}$/);
    expect(ret.status).toBe("REQUESTED");
    await post(tokenAll, `${R}/customer`, {
      fulfillmentId: f.id,
      reasonCode: "DEFECTIVE",
      items: [{ productId: p.id, requestedQuantity: 7 }],
    }).expect(422); // only 6 eligible beside the open 4
    const sources = data<
      { fulfillmentId: number; lines: { eligibleQty: number }[] }[]
    >(await get(tokenAll, `${R}/customer-sources`).expect(200));
    expect(
      sources.find((s) => s.fulfillmentId === f.id)!.lines[0]!.eligibleQty,
    ).toBe(6);

    // lifecycle is forward-only and approval is its own permission
    await post(tokenAll, `${R}/${ret.id}/approve`).expect(422); // not submitted
    await post(tokenReadOnly, `${R}/${ret.id}/submit`).expect(403);
    await post(tokenAll, `${R}/${ret.id}/submit`).expect(201);
    await post(tokenNoApprove, `${R}/${ret.id}/approve`).expect(403);
    await post(tokenAll, `${R}/${ret.id}/approve`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/receive`, {}).expect(422); // not in transit
    await post(tokenAll, `${R}/${ret.id}/in-transit`, {
      carrier: "Self",
      trackingNumber: "T1",
    }).expect(201);
    await post(tokenAll, `${R}/${ret.id}/receive`, {
      receivedQuantities: [{ itemId: ret.items[0]!.id, quantity: 5 }],
    }).expect(422); // more than requested
    await post(tokenAll, `${R}/${ret.id}/receive`, {}).expect(201);
    await post(tokenAll, `${R}/${ret.id}/start-inspection`).expect(201);

    // accepted + rejected must equal what came back
    await post(tokenAll, `${R}/${ret.id}/inspect`, {
      itemResults: [
        {
          itemId: ret.items[0]!.id,
          condition: "NEW",
          acceptedQuantity: 3,
          rejectedQuantity: 2,
        },
      ],
    }).expect(422);
    await post(tokenAll, `${R}/${ret.id}/inspect`, {
      itemResults: [
        {
          itemId: ret.items[0]!.id,
          condition: "NEW",
          acceptedQuantity: 3,
          rejectedQuantity: 1,
        },
      ],
    }).expect(201);
    await post(tokenAll, `${R}/${ret.id}/to-disposition`).expect(201);

    const item = ret.items[0]!;
    const dispose = (t: string, body: object) =>
      post(t, `${R}/${ret.id}/disposition`, { itemId: item.id, ...body });
    await dispose(tokenNoApprove, {
      disposition: "RESTOCK",
      quantity: 3,
    }).expect(403);
    await dispose(tokenAll, { disposition: "RESTOCK", quantity: 4 }).expect(
      422,
    ); // only 3 accepted
    await post(tokenAll, `${R}/${ret.id}/complete`).expect(422); // nothing dispositioned yet
    await dispose(tokenAll, { disposition: "RESTOCK", quantity: 3 }).expect(
      201,
    );
    expect(await bucket(p.id)).toMatchObject({ onHand: 3, quarantine: 0 });
    await dispose(tokenAll, { disposition: "RESTOCK", quantity: 1 }).expect(
      422,
    );
    await dispose(tokenAll, { disposition: "QUARANTINE", quantity: 1 }).expect(
      201,
    );
    expect(await bucket(p.id)).toMatchObject({ onHand: 3, quarantine: 1 });
    await dispose(tokenAll, { disposition: "SCRAP", quantity: 1 }).expect(422); // all dispositioned

    // cancelling is blocked once inventory has posted
    await post(tokenAll, `${R}/${ret.id}/cancel`, { reason: "x" }).expect(422);
    await post(tokenAll, `${R}/${ret.id}/complete`).expect(201);
    const done = data<{
      status: string;
      ledgerEntries: { transactionType: string }[];
      dispositions: {
        disposition: string;
        quarantineRecordId: number | null;
      }[];
    }>(await get(tokenAll, `${R}/${ret.id}`).expect(200));
    expect(done.status).toBe("COMPLETED");
    expect(done.ledgerEntries.map((e) => e.transactionType)).toEqual([
      "SALES_RETURN",
      "SALES_RETURN",
      "QUARANTINE",
    ]);
    const q = done.dispositions.find((d) => d.disposition === "QUARANTINE")!;
    expect(q.quarantineRecordId).not.toBeNull();

    // dispositions are an append-only log at the database level
    const row = await prisma.scmReturnDisposition.findFirstOrThrow({
      where: { returnId: ret.id },
    });
    await expect(
      prisma.scmReturnDisposition.update({
        where: { id: row.id },
        data: { notes: "tamper" },
      }),
    ).rejects.toThrow();

    // the quarantine register can release it back to sellable stock
    const quarantine = data<(Id & { status: string; sourceNumber: string })[]>(
      await get(tokenAll, "/scm/quality/quarantine?limit=100").expect(200),
    ).find((r) => r.sourceNumber === ret.returnNumber)!;
    await post(
      tokenNoApprove,
      `/scm/quality/quarantine/${quarantine.id}/release`,
      {},
    ).expect(403);
    await post(
      tokenAll,
      `/scm/quality/quarantine/${quarantine.id}/review`,
    ).expect(201);
    await post(tokenAll, `/scm/quality/quarantine/${quarantine.id}/release`, {
      notes: "ok",
    }).expect(201);
    expect(await bucket(p.id)).toMatchObject({ onHand: 4, quarantine: 0 });
    await post(
      tokenAll,
      `/scm/quality/quarantine/${quarantine.id}/reject`,
      {},
    ).expect(422); // already released
    await post(
      tokenAll,
      `/scm/quality/quarantine/${quarantine.id}/release`,
      {},
    ).expect(422);
  });

  it("refuses to restock damaged stock and allows zero-posting rejections", async () => {
    const p = await newProduct("Damaged item", 4);
    const f = await fulfilledOrder(p.id, 4);
    const ret = await customerReturn(f.id, p.id, 4);
    await toDispositionPending(ret, 2, 2, "DAMAGED");
    const item = ret.items[0]!;
    const dispose = (body: object) =>
      post(tokenAll, `${R}/${ret.id}/disposition`, {
        itemId: item.id,
        ...body,
      });
    await dispose({ disposition: "RESTOCK", quantity: 1 }).expect(422); // damaged condition
    await dispose({ disposition: "DAMAGED", quantity: 2 }).expect(201);
    expect(await bucket(p.id)).toMatchObject({ onHand: 0, damaged: 2 });
    await dispose({ disposition: "REJECT", quantity: 3 }).expect(422); // only 2 rejected
    await dispose({ disposition: "REJECT", quantity: 2 }).expect(201);
    expect(await bucket(p.id)).toMatchObject({ onHand: 0, damaged: 2 }); // REJECT posts nothing
    await post(tokenAll, `${R}/${ret.id}/complete`).expect(201);
  });

  it("cancels or rejects an unprocessed return and frees its quantity", async () => {
    const p = await newProduct("Cancel ret", 6);
    const f = await fulfilledOrder(p.id, 6);
    const first = await customerReturn(f.id, p.id, 6);
    await post(tokenAll, `${R}/customer`, {
      fulfillmentId: f.id,
      reasonCode: "OTHER",
      items: [{ productId: p.id, requestedQuantity: 1 }],
    }).expect(422); // fully claimed
    await post(tokenAll, `${R}/${first.id}/submit`).expect(201);
    await post(tokenAll, `${R}/${first.id}/reject`, { reason: "" }).expect(400);
    await post(tokenAll, `${R}/${first.id}/reject`, {
      reason: "Out of policy",
    }).expect(201);
    const second = await customerReturn(f.id, p.id, 6); // claim released
    await post(tokenAll, `${R}/${second.id}/cancel`, {
      reason: "changed mind",
    }).expect(201);
    await post(tokenAll, `${R}/${second.id}/submit`).expect(422); // cancelled is terminal
    await customerReturn(f.id, p.id, 6);
  });

  it("never lets two concurrent returns over-claim one fulfillment", async () => {
    const p = await newProduct("Race ret", 10);
    const f = await fulfilledOrder(p.id, 10);
    const attempt = () =>
      post(tokenAll, `${R}/customer`, {
        fulfillmentId: f.id,
        reasonCode: "DEFECTIVE",
        items: [{ productId: p.id, requestedQuantity: 6 }],
      });
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
  });

  it("returns goods to a vendor, posting PURCHASE_RETURN at shipment", async () => {
    const p = await newProduct("Vendor ret");
    const grn = await receivedGrn(p.id, 10);
    expect((await bucket(p.id)).onHand).toBe(10);
    const line = grn.items[0]!;

    await post(tokenAll, `${R}/vendor`, {
      grnId: grn.id,
      reasonCode: "QUALITY_ISSUE",
      items: [{ grnItemId: line.id, requestedQuantity: 11 }],
    }).expect(422);
    const ret = data<ReturnDoc>(
      await post(tokenAll, `${R}/vendor`, {
        grnId: grn.id,
        reasonCode: "QUALITY_ISSUE",
        items: [{ grnItemId: line.id, requestedQuantity: 4 }],
      }).expect(201),
    );
    expect(ret.returnNumber).toMatch(/^TW\/VR\//);
    await post(tokenAll, `${R}/vendor`, {
      grnId: grn.id,
      reasonCode: "QUALITY_ISSUE",
      items: [{ grnItemId: line.id, requestedQuantity: 7 }],
    }).expect(422);

    await post(tokenAll, `${R}/${ret.id}/ready-to-ship`).expect(422); // not approved
    await post(tokenAll, `${R}/${ret.id}/submit`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/approve`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/ship`, {
      carrier: "X",
      trackingNumber: "T",
    }).expect(422); // not ready
    await post(tokenAll, `${R}/${ret.id}/ready-to-ship`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/ship`, {
      carrier: "",
      trackingNumber: "",
    }).expect(400);
    await post(tokenNoApprove, `${R}/${ret.id}/ship`, {
      carrier: "X",
      trackingNumber: "T",
    }).expect(403);
    await post(tokenAll, `${R}/${ret.id}/ship`, {
      carrier: "DTDC",
      trackingNumber: "TRK9",
    }).expect(201);
    expect((await bucket(p.id)).onHand).toBe(6);
    await post(tokenAll, `${R}/${ret.id}/cancel`, { reason: "late" }).expect(
      422,
    ); // stock left
    await post(tokenAll, `${R}/${ret.id}/complete`).expect(422); // vendor must confirm first
    await post(tokenAll, `${R}/${ret.id}/vendor-received`).expect(201);
    await post(tokenAll, `${R}/${ret.id}/complete`).expect(201);
    const detail = data<{
      status: string;
      ledgerEntries: { transactionType: string; quantityOut: string }[];
    }>(await get(tokenAll, `${R}/${ret.id}`).expect(200));
    expect(detail.status).toBe("COMPLETED");
    expect(detail.ledgerEntries).toHaveLength(1);
    expect(detail.ledgerEntries[0]).toMatchObject({
      transactionType: "PURCHASE_RETURN",
    });

    const dash = data<{ byStatus: Record<string, number> }>(
      await get(tokenAll, `${R}/dashboard`).expect(200),
    );
    expect(dash.byStatus.COMPLETED).toBeGreaterThan(0);
  });

  it("runs a QC inspection with templates, defects and quarantine posting", async () => {
    const Q = "/scm/quality";
    const p = await newProduct("QC item", 10);
    await post(tokenAll, `${Q}/defects`, {
      defectCode: "CRIT-1",
      name: "Cracked",
      category: "PHYSICAL_DAMAGE",
      severity: "CRITICAL",
    }).expect(201);
    await post(tokenAll, `${Q}/defects`, {
      defectCode: "crit-1",
      name: "Dup",
      category: "OTHER",
      severity: "LOW",
    }).expect(409);
    // the quality_defect_severity MasterListValueGuard rejects an unknown value
    await post(tokenAll, `${Q}/defects`, {
      defectCode: "BAD-SEV",
      name: "Bad severity",
      category: "OTHER",
      severity: "NOT_A_REAL_SEVERITY",
    }).expect(400);
    const tpl = data<{ id: number; checkpoints: { checkpointId: string }[] }>(
      await post(tokenAll, `${Q}/templates`, {
        templateCode: `INV-${randomUUID().slice(0, 5)}`,
        name: "Inventory check",
        inspectionType: "INVENTORY",
        checkpoints: [
          { name: "Label legible", required: true },
          { name: "Weight", required: false, unit: "kg" },
        ],
      }).expect(201),
    );

    await post(tokenAll, `${Q}/inspections`, {
      inspectionType: "INVENTORY",
      productId: p.id,
      warehouseId: wh.id,
      quantity: 11,
    }).expect(422); // only 10 available
    await post(tokenReadOnly, `${Q}/inspections`, {
      inspectionType: "INVENTORY",
      productId: p.id,
      warehouseId: wh.id,
      quantity: 4,
    }).expect(403);
    // the quality_inspection_priority MasterListValueGuard rejects an unknown value
    await post(tokenAll, `${Q}/inspections`, {
      inspectionType: "INVENTORY",
      productId: p.id,
      warehouseId: wh.id,
      quantity: 4,
      priority: "NOT_A_REAL_PRIORITY",
    }).expect(400);
    const insp = data<Doc & { inspectionNumber: string; items: Id[] }>(
      await post(tokenAll, `${Q}/inspections`, {
        inspectionType: "INVENTORY",
        productId: p.id,
        warehouseId: wh.id,
        quantity: 4,
        templateId: tpl.id,
        priority: "HIGH",
      }).expect(201),
    );
    expect(insp.inspectionNumber).toMatch(/^TW\/QC\//);
    expect(insp.status).toBe("PENDING_INSPECTION");
    const itemUrl = `${Q}/inspections/${insp.id}/items/${insp.items[0]!.id}`;
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 4,
      rejectedQuantity: 0,
    }).expect(422); // not started
    await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(422);
    await post(tokenAll, `${Q}/inspections/${insp.id}/start`, {}).expect(201);
    await post(tokenAll, `${Q}/inspections/${insp.id}/start`, {}).expect(422);

    // result / disposition rules
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 5,
      acceptedQuantity: 5,
      rejectedQuantity: 0,
    }).expect(422); // > source
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 2,
      rejectedQuantity: 1,
    }).expect(422); // sum mismatch
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 4,
      rejectedQuantity: 0,
      disposition: "QUARANTINE",
    }).expect(422); // PASS may only ACCEPT/RELEASE
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 1,
      rejectedQuantity: 3,
      defectCode: "NOPE",
      disposition: "QUARANTINE",
    }).expect(422); // unknown defect
    // fail 3 of 4 with a critical defect: a review note is mandatory
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 1,
      rejectedQuantity: 3,
      defectCode: "CRIT-1",
      disposition: "QUARANTINE",
    }).expect(200);
    await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(422); // required checkpoint missing
    const cp = data<{
      checkpoints: { checkpointId: string; required: boolean }[];
    }>(
      await get(tokenAll, `${Q}/templates/${tpl.id}`).expect(200),
    ).checkpoints.find((c) => c.required)!;
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 1,
      rejectedQuantity: 3,
      defectCode: "CRIT-1",
      disposition: "QUARANTINE",
      checkpointResults: [{ checkpointId: cp.checkpointId, result: "FAIL" }],
    }).expect(200);
    await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(422); // critical defect needs a note
    await put(tokenAll, itemUrl, {
      inspectedQuantity: 4,
      acceptedQuantity: 1,
      rejectedQuantity: 3,
      defectCode: "CRIT-1",
      disposition: "QUARANTINE",
      notes: "Cracked casing on 3 units",
      checkpointResults: [{ checkpointId: cp.checkpointId, result: "FAIL" }],
    }).expect(200);

    await post(tokenNoApprove, `${Q}/inspections/${insp.id}/complete`).expect(
      403,
    );
    const completed = data<Doc & { result: string }>(
      await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(201),
    );
    expect(completed.status).toBe("COMPLETED");
    expect(completed.result).toBe("PARTIALLY_PASSED");
    // the 3 rejected units left sellable stock and sit in quarantine
    expect(await bucket(p.id)).toMatchObject({ onHand: 7, quarantine: 3 });
    await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(422); // idempotent: no double post
    await post(tokenAll, `${Q}/inspections/${insp.id}/cancel`, {
      reason: "x",
    }).expect(422);
    expect((await bucket(p.id)).onHand).toBe(7);

    const detail = data<{
      items: {
        ledgerEntryId: number | null;
        quarantineRecordId: number | null;
      }[];
    }>(await get(tokenAll, `${Q}/inspections/${insp.id}`).expect(200));
    expect(detail.items[0]!.ledgerEntryId).not.toBeNull();
    const qid = detail.items[0]!.quarantineRecordId!;

    // write-off: quarantine bucket -> damaged, on-hand unchanged
    await post(tokenAll, `${Q}/quarantine/${qid}/reject`, {
      notes: "scrapped",
    }).expect(201);
    expect(await bucket(p.id)).toMatchObject({
      onHand: 7,
      quarantine: 0,
      damaged: 3,
    });
    await post(tokenAll, `${Q}/quarantine/${qid}/release`, {}).expect(422);

    // the audit trail is readable
    const activity = data<{ entityType: string }[]>(
      await get(tokenAll, `${Q}/activity?limit=50`).expect(200),
    );
    expect(
      activity.some((a) => a.entityType === "scm_quality_inspection"),
    ).toBe(true);
    const dash = data<{ byStatus: Record<string, number> }>(
      await get(tokenAll, `${Q}/dashboard`).expect(200),
    );
    expect(dash.byStatus.COMPLETED).toBeGreaterThan(0);
  });

  it("inspects an incoming GRN and bounds cumulative inspected quantity", async () => {
    const Q = "/scm/quality";
    const p = await newProduct("GRN QC");
    const grn = await receivedGrn(p.id, 6);
    const make = () =>
      post(tokenAll, `${Q}/inspections`, {
        inspectionType: "INCOMING",
        sourceId: grn.id,
      });
    const a = data<Doc & { items: Id[] }>(await make().expect(201));
    const b = data<Doc & { items: Id[] }>(await make().expect(201));
    for (const i of [a, b])
      await post(tokenAll, `${Q}/inspections/${i.id}/start`, {}).expect(201);
    const pass = (i: { id: number; items: Id[] }, qty: number) =>
      put(tokenAll, `${Q}/inspections/${i.id}/items/${i.items[0]!.id}`, {
        inspectedQuantity: qty,
        acceptedQuantity: qty,
        rejectedQuantity: 0,
        disposition: "ACCEPT",
      }).expect(200);
    await pass(a, 4);
    await pass(b, 4);
    await post(tokenAll, `${Q}/inspections/${a.id}/complete`).expect(422); // 4 + 4 > 6 accepted
    await pass(b, 2);
    expect(
      data<Doc>(
        await post(tokenAll, `${Q}/inspections/${a.id}/complete`).expect(201),
      ).status,
    ).toBe("COMPLETED");
    expect((await bucket(p.id)).onHand).toBe(6); // PASS posts nothing
    const sources = data<Id[]>(
      await get(
        tokenAll,
        `${Q}/inspections/sources?inspectionType=INCOMING`,
      ).expect(200),
    );
    expect(sources.some((s) => s.id === grn.id)).toBe(true);
  });

  it("holds a pre-dispatch failure out of a fulfillment's reservation", async () => {
    const Q = "/scm/quality";
    const p = await newProduct("Pre-dispatch", 5);
    const so = data<Id>(
      await post(tokenAll, "/scm/sales-orders", {
        customerId: customer.id,
        orderDate: today,
        items: [{ productId: p.id, quantity: 5, unitPrice: 10 }],
      }).expect(201),
    );
    await post(tokenAll, `/scm/sales-orders/${so.id}/confirm`).expect(201);
    const f = data<Id>(
      await post(tokenAll, "/scm/fulfillments", {
        salesOrderId: so.id,
        warehouseId: wh.id,
      }).expect(201),
    );
    await post(tokenAll, `/scm/fulfillments/${f.id}/reserve`).expect(201);
    expect(await bucket(p.id)).toMatchObject({ onHand: 5, reserved: 5 });
    const insp = data<Doc & { items: Id[] }>(
      await post(tokenAll, `${Q}/inspections`, {
        inspectionType: "PRE_DISPATCH",
        sourceId: f.id,
      }).expect(201),
    );
    await post(tokenAll, `${Q}/inspections/${insp.id}/start`, {}).expect(201);
    await put(
      tokenAll,
      `${Q}/inspections/${insp.id}/items/${insp.items[0]!.id}`,
      {
        inspectedQuantity: 5,
        acceptedQuantity: 3,
        rejectedQuantity: 2,
        disposition: "QUARANTINE",
      },
    ).expect(200);
    await post(tokenAll, `${Q}/inspections/${insp.id}/complete`).expect(201);
    // 2 units: reservation shrinks, then they move to quarantine
    expect(await bucket(p.id)).toMatchObject({
      onHand: 3,
      reserved: 3,
      quarantine: 2,
    });
    const line = await prisma.scmFulfillmentItem.findFirstOrThrow({
      where: { fulfillmentId: f.id },
    });
    expect(Number(line.reservedQty)).toBe(3);
  });

  it("enforces tenant isolation across returns and quality", async () => {
    const some = data<Id[]>(
      await get(tokenAll, `${R}?limit=1`).expect(200),
    )[0]!;
    await get(tokenB, `${R}/${some.id}`).expect(404);
    await post(tokenB, `${R}/${some.id}/submit`).expect(404);
    expect(data<Id[]>(await get(tokenB, `${R}`).expect(200))).toHaveLength(0);
    expect(
      data<Id[]>(await get(tokenB, "/scm/quality/inspections").expect(200)),
    ).toHaveLength(0);
    expect(
      data<Id[]>(await get(tokenB, "/scm/quality/quarantine").expect(200)),
    ).toHaveLength(0);
    const q = data<Id[]>(
      await get(tokenAll, "/scm/quality/quarantine?limit=1").expect(200),
    )[0]!;
    await post(tokenB, `/scm/quality/quarantine/${q.id}/release`, {}).expect(
      404,
    );
  });
});
