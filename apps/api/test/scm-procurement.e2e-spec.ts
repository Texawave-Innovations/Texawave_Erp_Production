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
  total?: string;
}

describe("scm procurement pipeline (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoApprove: string;
  let tokenReadOnly: string;
  let tokenB: string;
  let wh: Id;
  let sup1: Id;
  let sup2: Id;
  let plain: Id;
  let batched: Id;
  let serialed: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const statusOf = async (url: string) =>
    data<Doc>(await get(tokenAll, url).expect(200)).status;
  const P = "/scm/procurement";
  const today = "2026-10-18";

  async function onHand(productId: number) {
    const b = await prisma.scmStockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: wh.id } },
    });
    return {
      onHand: Number(b?.onHand ?? 0),
      incoming: Number(b?.incoming ?? 0),
    };
  }

  /** Draft -> approved -> sent PO for the given lines, raised directly. */
  async function sentPo(
    lines: { productId: number; quantity: number; unitPrice: number }[],
  ) {
    const po = data<Doc>(
      await post(tokenAll, `${P}/purchase-orders`, {
        supplierId: sup1.id,
        poDate: today,
        warehouseId: wh.id,
        items: lines,
      }).expect(201),
    );
    await post(tokenAll, `${P}/purchase-orders/${po.id}/submit`).expect(201);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/approve`).expect(201);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/send`).expect(201);
    return po;
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
      data: { name: `Org A ${suffix}`, slug: `scm-proc-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-proc-b-${suffix}` },
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
          fullName: "Buyer One",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-proc-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "noapprove@scm-proc-a.test",
      idsOf(codes.filter((c) => c !== "scm.procurement.approve")),
    );
    await makeUser(
      orgA.id,
      "ro@scm-proc-a.test",
      idsOf(codes.filter((c) => c.endsWith(".read"))),
    );
    await makeUser(orgB.id, "all@scm-proc-b.test", idsOf(codes));

    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-proc-a.test");
    tokenNoApprove = await login(orgA.slug, "noapprove@scm-proc-a.test");
    tokenReadOnly = await login(orgA.slug, "ro@scm-proc-a.test");
    tokenB = await login(orgB.slug, "all@scm-proc-b.test");

    const mk = async (url: string, body: object) =>
      data<Id>(await post(tokenAll, url, body).expect(201));
    wh = await mk("/scm/warehouses", { code: `W${suffix}`, name: "Main WH" });
    sup1 = await mk("/scm/suppliers", {
      companyName: "Supplier One",
      contactPerson: "A",
    });
    sup2 = await mk("/scm/suppliers", {
      companyName: "Supplier Two",
      contactPerson: "B",
    });
    plain = await mk("/scm/products", {
      productCode: `PL-${suffix}`,
      name: "Plain item",
    });
    batched = await mk("/scm/products", {
      productCode: `BT-${suffix}`,
      name: "Batched item",
      batchTracked: true,
    });
    serialed = await mk("/scm/products", {
      productCode: `SR-${suffix}`,
      name: "Serial item",
      serialTracked: true,
    });
  });

  // Documents write append-only audit/ledger rows, so test orgs are never
  // deleted (same tradeoff as the CRM suites).
  afterAll(async () => {
    await app.close();
  });

  it("walks PR -> RFQ -> quotations -> comparison -> PO with server-computed totals", async () => {
    const pr = data<Doc & { requisitionNumber: string; total: string }>(
      await post(tokenAll, `${P}/requisitions`, {
        requestDate: today,
        warehouseId: wh.id,
        tax: 5,
        items: [{ productId: plain.id, quantity: 10, estimatedUnitCost: 12.5 }],
      }).expect(201),
    );
    expect(pr.requisitionNumber).toMatch(/^TW\/PR\/\d{2}-\d{2}\/\d{4}$/);
    expect(pr.status).toBe("DRAFT");
    expect(pr.total).toBe("130"); // 10 * 12.5 + 5 tax

    // approving needs scm.procurement.approve and a submitted requisition
    await post(tokenAll, `${P}/requisitions/${pr.id}/approve`).expect(422);
    await post(tokenAll, `${P}/requisitions/${pr.id}/submit`).expect(201);
    await post(tokenNoApprove, `${P}/requisitions/${pr.id}/approve`).expect(
      403,
    );
    await post(tokenAll, `${P}/requisitions/${pr.id}/reject`, {
      reason: "  ",
    }).expect(400);
    await post(tokenAll, `${P}/requisitions/${pr.id}/approve`).expect(201);

    // RFQ from the approved requisition converts it exactly once
    const rfq = data<Doc & { rfqNumber: string }>(
      await post(tokenAll, `${P}/rfqs`, {
        requisitionId: pr.id,
        supplierIds: [sup1.id, sup2.id],
        issueDate: today,
        warehouseId: wh.id,
        items: [{ productId: plain.id, quantity: 10 }],
      }).expect(201),
    );
    expect(rfq.status).toBe("DRAFT");
    const converted = await prisma.scmPurchaseRequisition.findUniqueOrThrow({
      where: { id: pr.id },
    });
    expect(converted.status).toBe("CONVERTED");
    await post(tokenAll, `${P}/rfqs`, {
      requisitionId: pr.id,
      supplierIds: [sup1.id],
      issueDate: today,
      warehouseId: wh.id,
      items: [{ productId: plain.id, quantity: 10 }],
    }).expect(422);

    // quotations are refused until the RFQ is issued
    const quote = (supplierId: number, unitPrice: number) =>
      post(tokenAll, `${P}/quotations`, {
        rfqId: rfq.id,
        supplierId,
        quotationDate: today,
        freight: 20,
        items: [{ productId: plain.id, quantity: 10, unitPrice, taxRate: 18 }],
      });
    await quote(sup1.id, 10).expect(422);
    await post(tokenAll, `${P}/rfqs/${rfq.id}/issue`).expect(201);

    const q1 = data<Doc & { total: string; subtotal: string; tax: string }>(
      await quote(sup1.id, 10).expect(201),
    );
    expect(q1.subtotal).toBe("100");
    expect(q1.tax).toBe("18");
    expect(q1.total).toBe("138"); // 100 + 18 + 20 freight
    expect(await statusOf(`${P}/rfqs/${rfq.id}`)).toBe("PARTIALLY_RESPONDED");
    const q2 = data<Doc>(await quote(sup2.id, 8).expect(201));
    expect(await statusOf(`${P}/rfqs/${rfq.id}`)).toBe("RESPONDED");

    // a supplier that was not invited cannot quote
    const outsider = data<Id>(
      await post(tokenAll, "/scm/suppliers", {
        companyName: "Outsider",
        contactPerson: "C",
      }).expect(201),
    );
    await post(tokenAll, `${P}/quotations`, {
      rfqId: rfq.id,
      supplierId: outsider.id,
      quotationDate: today,
      items: [{ productId: plain.id, quantity: 10, unitPrice: 1 }],
    }).expect(422);

    // comparison lists cheapest first; selecting rejects the rest atomically
    const compared = data<Doc[]>(
      await get(tokenAll, `${P}/comparison/${rfq.id}`).expect(200),
    );
    expect(compared.map((c) => c.id)).toEqual([q2.id, q1.id]);
    await post(tokenNoApprove, `${P}/comparison`, {
      rfqId: rfq.id,
      selectedQuotationId: q2.id,
    }).expect(403);
    await post(tokenAll, `${P}/comparison`, {
      rfqId: rfq.id,
      selectedQuotationId: q2.id,
      remarks: "Lowest price",
    }).expect(201);
    expect(await statusOf(`${P}/quotations/${q2.id}`)).toBe("SELECTED");
    expect(await statusOf(`${P}/quotations/${q1.id}`)).toBe("REJECTED");
    await post(tokenAll, `${P}/comparison`, {
      rfqId: rfq.id,
      selectedQuotationId: q1.id,
    }).expect(422);

    // PO from the selected quotation: supplier/lines are taken from it
    const po = data<Doc & { poNumber: string; vendorNameSnapshot: string }>(
      await post(tokenAll, `${P}/purchase-orders`, {
        quotationId: q2.id,
        poDate: today,
        warehouseId: wh.id,
        items: [{ productId: plain.id, quantity: 999, unitPrice: 1 }], // ignored
      }).expect(201),
    );
    expect(po.poNumber).toMatch(/^TW\/PO\/\d{2}-\d{2}\/\d{4}$/);
    expect(po.vendorNameSnapshot).toBe("Supplier Two");
    await post(tokenAll, `${P}/purchase-orders`, {
      quotationId: q2.id,
      poDate: today,
      warehouseId: wh.id,
    }).expect(409);
    // an unselected (rejected) quotation cannot back a PO
    await post(tokenAll, `${P}/purchase-orders`, {
      quotationId: q1.id,
      poDate: today,
      warehouseId: wh.id,
    }).expect(422);
  });

  it("raises incoming on PO approval and releases it on cancel", async () => {
    const before = await onHand(plain.id);
    const po = data<Doc>(
      await post(tokenAll, `${P}/purchase-orders`, {
        supplierId: sup1.id,
        poDate: today,
        warehouseId: wh.id,
        items: [{ productId: plain.id, quantity: 7, unitPrice: 5 }],
      }).expect(201),
    );
    await post(tokenAll, `${P}/purchase-orders/${po.id}/approve`).expect(422); // not submitted
    await post(tokenAll, `${P}/purchase-orders/${po.id}/submit`).expect(201);
    await post(tokenNoApprove, `${P}/purchase-orders/${po.id}/approve`).expect(
      403,
    );
    await post(tokenAll, `${P}/purchase-orders/${po.id}/approve`).expect(201);
    expect((await onHand(plain.id)).incoming).toBe(before.incoming + 7);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/cancel`).expect(201);
    expect((await onHand(plain.id)).incoming).toBe(before.incoming);
  });

  it("refuses goods receipt until the PO is sent, and validates every line", async () => {
    const po = data<Doc & { items: Id[] }>(
      await post(tokenAll, `${P}/purchase-orders`, {
        supplierId: sup1.id,
        poDate: today,
        warehouseId: wh.id,
        items: [
          { productId: plain.id, quantity: 10, unitPrice: 5 },
          { productId: batched.id, quantity: 4, unitPrice: 9 },
          { productId: serialed.id, quantity: 2, unitPrice: 100 },
        ],
      }).expect(201),
    );
    const [plainLine, batchLine, serialLine] = po.items;
    const grn = (lines: object[]) =>
      post(tokenAll, `${P}/goods-receipts`, {
        purchaseOrderId: po.id,
        receiptDate: today,
        lines,
      });

    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 1 },
    ]).expect(422); // draft PO
    await post(tokenAll, `${P}/purchase-orders/${po.id}/submit`).expect(201);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/approve`).expect(201);
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 1 },
    ]).expect(422); // approved, not sent
    await post(tokenAll, `${P}/purchase-orders/${po.id}/send`).expect(201);

    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 11 },
    ]).expect(422); // over-receipt
    await grn([
      {
        purchaseOrderItemId: plainLine!.id,
        receivingQuantity: 2,
        rejectedQuantity: 3,
      },
    ]).expect(422); // rejected > receiving
    await grn([
      { purchaseOrderItemId: batchLine!.id, receivingQuantity: 2 },
    ]).expect(422); // batch required
    await grn([
      {
        purchaseOrderItemId: serialLine!.id,
        receivingQuantity: 2,
        serialNumbers: ["S1"],
      },
    ]).expect(422); // serial count
    await grn([
      {
        purchaseOrderItemId: serialLine!.id,
        receivingQuantity: 2,
        serialNumbers: ["S1", "S1"],
      },
    ]).expect(422); // duplicate serial
    await grn([
      { purchaseOrderItemId: plainLine!.id + 99999, receivingQuantity: 1 },
    ]).expect(422);

    // a valid line plus an invalid one rolls the whole receipt back
    const stockBefore = await onHand(plain.id);
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 3 },
      { purchaseOrderItemId: batchLine!.id, receivingQuantity: 1 }, // no batch number
    ]).expect(422);
    expect(await onHand(plain.id)).toEqual(stockBefore);
    expect(
      await prisma.scmGoodsReceipt.count({ where: { purchaseOrderId: po.id } }),
    ).toBe(0);

    const incomingBefore = (await onHand(plain.id)).incoming;
    expect(incomingBefore).toBeGreaterThanOrEqual(10);

    // first, partial receipt with a rejection, a batch and serials
    const first = data<Id & { grnNumber: string }>(
      await grn([
        {
          purchaseOrderItemId: plainLine!.id,
          receivingQuantity: 6,
          rejectedQuantity: 1,
          unitCost: 5,
        },
        {
          purchaseOrderItemId: batchLine!.id,
          receivingQuantity: 4,
          batchNumber: "lot-9",
          expiryDate: "2027-01-01",
        },
        {
          purchaseOrderItemId: serialLine!.id,
          receivingQuantity: 2,
          serialNumbers: ["SN-A", "SN-B"],
        },
      ]).expect(201),
    );
    expect(first.grnNumber).toMatch(/^TW\/GRN\/\d{2}-\d{2}\/\d{4}$/);

    const plainStock = await onHand(plain.id);
    expect(plainStock.onHand).toBe(5); // 6 received − 1 rejected
    expect(plainStock.incoming).toBe(incomingBefore - 5);
    expect((await onHand(batched.id)).onHand).toBe(4);
    expect((await onHand(serialed.id)).onHand).toBe(2);

    const batch = await prisma.scmStockBatch.findFirstOrThrow({
      where: { productId: batched.id, batchNumber: "LOT-9" },
    });
    expect(Number(batch.quantity)).toBe(4);
    const serials = await prisma.scmSerialNumber.findMany({
      where: { productId: serialed.id },
      orderBy: { serialNumber: "asc" },
    });
    expect(serials.map((s) => [s.serialNumber, s.status])).toEqual([
      ["SN-A", "AVAILABLE"],
      ["SN-B", "AVAILABLE"],
    ]);
    expect(await statusOf(`${P}/purchase-orders/${po.id}`)).toBe(
      "PARTIALLY_RECEIVED",
    );

    // GRN detail shows the ledger entries it posted
    const detail = data<{ ledgerEntries: { transactionType: string }[] }>(
      await get(tokenAll, `${P}/goods-receipts/${first.id}`).expect(200),
    );
    expect(detail.ledgerEntries).toHaveLength(3);
    expect(
      detail.ledgerEntries.every(
        (e) => e.transactionType === "PURCHASE_RECEIPT",
      ),
    ).toBe(true);

    // serials already used cannot be received again
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 1 },
      { purchaseOrderItemId: serialLine!.id, receivingQuantity: 0 },
    ]).expect(201); // 1 more plain unit is fine (5 remaining)
    expect(await statusOf(`${P}/purchase-orders/${po.id}`)).toBe(
      "PARTIALLY_RECEIVED",
    );

    // 6 received - 1 rejected, +1, +3 = 9 accepted of 10: the rejected unit
    // keeps the PO line open (legacy counts accepted quantity only)
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 3 },
    ]).expect(201);
    expect(await statusOf(`${P}/purchase-orders/${po.id}`)).toBe(
      "PARTIALLY_RECEIVED",
    );
    expect((await onHand(plain.id)).incoming).toBe(incomingBefore - 9);

    // the replacement unit completes the PO
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 1 },
    ]).expect(201);
    expect(await statusOf(`${P}/purchase-orders/${po.id}`)).toBe("RECEIVED");
    expect((await onHand(plain.id)).incoming).toBe(incomingBefore - 10);
    // nothing further can be received, and the PO can now be closed
    await grn([
      { purchaseOrderItemId: plainLine!.id, receivingQuantity: 1 },
    ]).expect(422);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/close`).expect(201);
  });

  it("never lets two concurrent receipts over-receive the same PO line", async () => {
    const po = data<Doc & { items: Id[] }>(
      await post(tokenAll, `${P}/purchase-orders`, {
        supplierId: sup1.id,
        poDate: today,
        warehouseId: wh.id,
        items: [{ productId: plain.id, quantity: 10, unitPrice: 1 }],
      }).expect(201),
    );
    await post(tokenAll, `${P}/purchase-orders/${po.id}/submit`).expect(201);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/approve`).expect(201);
    await post(tokenAll, `${P}/purchase-orders/${po.id}/send`).expect(201);
    const line = po.items[0]!;
    const attempt = () =>
      post(tokenAll, `${P}/goods-receipts`, {
        purchaseOrderId: po.id,
        receiptDate: today,
        lines: [{ purchaseOrderItemId: line.id, receivingQuantity: 8 }],
      });
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    const item = await prisma.scmPurchaseOrderItem.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(Number(item.receivedQuantity)).toBe(8);
  });

  it("enforces read-only access and tenant isolation", async () => {
    await get(tokenReadOnly, `${P}/purchase-orders`).expect(200);
    await post(tokenReadOnly, `${P}/requisitions`, {
      requestDate: today,
      warehouseId: wh.id,
      items: [{ productId: plain.id, quantity: 1 }],
    }).expect(403);
    const dash = data<{ purchaseOrders: Record<string, number> }>(
      await get(tokenAll, `${P}/dashboard`).expect(200),
    );
    expect(Object.keys(dash.purchaseOrders).length).toBeGreaterThan(0);

    const any = data<Id[]>(
      await get(tokenAll, `${P}/purchase-orders`).expect(200),
    )[0]!;
    await get(tokenB, `${P}/purchase-orders/${any.id}`).expect(404);
    const bList = data<Id[]>(
      await get(tokenB, `${P}/purchase-orders`).expect(200),
    );
    expect(bList).toHaveLength(0);
    await post(tokenB, `${P}/purchase-orders/${any.id}/approve`).expect(404);
  });

  it("blocks deactivating a warehouse that has open purchase orders", async () => {
    await sentPo([{ productId: plain.id, quantity: 1, unitPrice: 1 }]);
    await http()
      .patch(`/scm/warehouses/${wh.id}`)
      .set(auth(tokenAll))
      .send({ status: "Inactive" })
      .expect(422);
  });

  it("summarises a supplier's procurement history for the detail tabs", async () => {
    const summary = data<{
      kpis: {
        purchaseOrders: number;
        receipts: number;
        rejectedQuantity: number;
      };
      productsSupplied: { name: string }[];
      receipts: unknown[];
    }>(
      await get(tokenAll, `/scm/suppliers/${sup1.id}/procurement`).expect(200),
    );
    expect(summary.kpis.purchaseOrders).toBeGreaterThanOrEqual(3);
    expect(summary.kpis.receipts).toBeGreaterThanOrEqual(3);
    expect(summary.kpis.rejectedQuantity).toBeGreaterThanOrEqual(1);
    expect(summary.productsSupplied.map((p) => p.name)).toContain("Plain item");
    await get(tokenB, `/scm/suppliers/${sup1.id}/procurement`).expect(404);
  });
});
