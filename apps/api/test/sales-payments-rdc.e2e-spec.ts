import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { SalesPdfRenderer } from "../src/modules/sales/documents/sales-pdf.renderer.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Sales — Payments Received and Returnable Delivery Challans.
 * Proves: RBAC (read vs record/edit/delete, executives cannot delete),
 * numbering from the master list's running numbers (100 → next 0101, never
 * reused after a delete), payment modes from the master list (or typed;
 * old codes become labels), the balance rule on record and edit, due-date
 * alerts and the overdue filter, receipt and RDC PDFs (company details from
 * the shared master list), the RDC return / reopen cycle, and organization
 * isolation.
 */

interface Body<T> {
  data: T;
  meta?: { total: number };
}
interface ErrorBody {
  error: string;
}
interface Payment {
  id: number;
  paymentNumber: string;
  amount: string;
  mode: string;
  modeItemId: number | null;
  reference: string | null;
  dueDate: string | null;
  overdueDays: number | null;
  invoice: { id: number; invoiceNumber: string; balance: string };
  customer: { id: number; companyName: string };
}
interface Rdc {
  id: number;
  rdcNumber: string;
  status: string;
  returnedDate: string | null;
  notes: string | null;
  sealItemId: number | null;
  sealName: string | null;
  preparedBy: string | null;
  overdueDays: number | null;
  lines: Array<{ description: string; quantity: string }>;
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const MANAGER = [
  "sales.customer.read",
  "sales.customer.write",
  "sales.master.read",
  "sales.master.write",
  "sales.running_number.write",
  "sales.invoice.read",
  "sales.invoice.write",
  "sales.invoice_payment.write",
  "sales.payment.read",
  "sales.returnable_dc.read",
  "sales.returnable_dc.write",
  "sales.returnable_dc.delete",
  "sales.returnable_dc.send",
];
const EXECUTIVE = MANAGER.filter(
  (p) =>
    ![
      "sales.master.write",
      "sales.running_number.write",
      "sales.invoice_payment.write",
      "sales.returnable_dc.delete",
    ].includes(p),
);

describe("Sales — payments received and returnable DCs (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const suffix = randomUUID().slice(0, 6).toLowerCase();
  const rendered: string[] = [];
  let customerId: number;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SalesPdfRenderer)
      .useValue({
        render: (html: string) => {
          rendered.push(html);
          return Promise.resolve(Buffer.from("%PDF-TEST"));
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Pay A ${suffix}`, slug: `pay-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Pay B ${suffix}`, slug: `pay-b-${suffix}` },
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
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "managerB", MANAGER);

    for (const who of ["manager", "managerB"]) {
      await http()
        .put("/sales/master/company-profile")
        .set(auth(who))
        .send({
          legalName: "Texawave Innovations Private Limited",
          address: "No 93/206 Canal Bank Road, Adyar, Chennai - 600 020",
          gstin: "33AAMCT4293K1ZU",
        })
        .expect(200);
    }
    customerId = (
      (
        await http()
          .post("/sales/customers")
          .set(auth("manager"))
          .send({
            companyName: `Dev Tool ${suffix}`,
            contactPerson: "Jane",
            email: `jane@${suffix}.test`,
            mobileNumber: "9876543210",
            gstin: "33ABCDE1234F1Z5",
          })
          .expect(201)
      ).body as Body<{ id: number }>
    ).data.id;
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    const where = { organizationId: { in: orgIds } };
    await prisma.salesReturnableDcLine.deleteMany({ where });
    await prisma.salesReturnableDc.deleteMany({ where });
    await prisma.salesInvoicePayment.deleteMany({ where });
    await prisma.salesInvoiceLine.deleteMany({ where });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesDocumentMasterItem.deleteMany({ where });
    await prisma.salesCompanyProfile.deleteMany({ where });
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
    // Uploaded test images stay under UPLOAD_DIR/sales/<org>/ (disposable).
    // Users/orgs that produced audit rows are intentionally left (audit_logs is append-only).
    await app.close();
  });

  async function taxInvoice(): Promise<{ id: number; invoiceNumber: string }> {
    const res = await http()
      .post("/sales/invoices")
      .set(auth("manager"))
      .send({
        invoiceType: "TAX",
        customerId,
        invoiceDate: "2026-08-28",
        lines: [{ description: "Panel", quantity: 1, unitPrice: 600 }],
        cgstRate: 9,
        sgstRate: 9,
      })
      .expect(201);
    return (res.body as Body<{ id: number; invoiceNumber: string }>).data;
  }

  // ---------------------------------------------------------------------------
  describe("payments received", () => {
    let invoice: { id: number; invoiceNumber: string };
    let bankTransfer: number;
    let first: Payment;

    it("payment modes live in the master list", async () => {
      const add = (body: Record<string, unknown>, who = "manager") =>
        http().post("/sales/master/document-fields").set(auth(who)).send(body);
      const res = await add({
        field: "PAYMENT_MODE",
        label: "Bank Transfer",
        isDefault: true,
      }).expect(201);
      bankTransfer = (res.body as Body<{ id: number }>).data.id;
      const long = await add({
        field: "PAYMENT_MODE",
        label: "x".repeat(51),
      }).expect(422);
      expect((long.body as ErrorBody).error).toBe("LABEL_TOO_LONG");
    });

    it("the running number is editable: 100 → the next payment is 0101", async () => {
      await http()
        .patch("/sales/master/running-numbers/payment_received")
        .set(auth("exec"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(403);
      const res = await http()
        .patch("/sales/master/running-numbers/payment_received")
        .set(auth("manager"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(200);
      expect((res.body as Body<{ nextCode: string }>).data.nextCode).toBe(
        "TW/PR/26-27/0101",
      );
      const next = await http()
        .get("/sales/payments/next-number?date=2026-08-28")
        .set(auth("manager"))
        .expect(200);
      expect((next.body as Body<{ number: string }>).data.number).toBe(
        "TW/PR/26-27/0101",
      );
    });

    it("records a payment against an invoice with a master-list mode", async () => {
      invoice = await taxInvoice();
      const res = await http()
        .post("/sales/payments")
        .set(auth("manager"))
        .send({
          invoiceId: invoice.id,
          amount: 200,
          paymentDate: "2026-08-28",
          modeItemId: bankTransfer,
          reference: "UTR123456789",
        })
        .expect(201);
      first = (res.body as Body<Payment>).data;
      expect(first).toMatchObject({
        paymentNumber: "TW/PR/26-27/0101",
        mode: "Bank Transfer",
        modeItemId: bankTransfer,
        invoice: { id: invoice.id, balance: "508" },
        customer: { id: customerId },
      });
    });

    it("the invoice route still records payments, numbered the same way", async () => {
      const res = await http()
        .post(`/sales/invoices/${invoice.id}/payments`)
        .set(auth("manager"))
        .send({ amount: 8, paymentDate: "2026-08-29", mode: "BANK_TRANSFER" })
        .expect(201);
      const inv = (
        res.body as Body<{
          balance: string;
          payments: Array<{ paymentNumber: string; mode: string }>;
        }>
      ).data;
      expect(inv.balance).toBe("500");
      expect(inv.payments.map((p) => [p.paymentNumber, p.mode])).toEqual([
        ["TW/PR/26-27/0101", "Bank Transfer"],
        ["TW/PR/26-27/0102", "Bank Transfer"],
      ]);
    });

    it("refuses more than the balance, a missing mode and a wrong option", async () => {
      const post = (body: Record<string, unknown>) =>
        http()
          .post("/sales/payments")
          .set(auth("manager"))
          .send({
            invoiceId: invoice.id,
            amount: 1,
            paymentDate: "2026-08-30",
            ...body,
          });
      const over = await post({ amount: 500.01, mode: "UPI" }).expect(422);
      expect((over.body as ErrorBody).error).toBe("PAYMENT_EXCEEDS_BALANCE");
      const none = await post({}).expect(422);
      expect((none.body as ErrorBody).error).toBe("PAYMENT_MODE_REQUIRED");
      const seal = await http()
        .post("/sales/master/document-fields")
        .set(auth("manager"))
        .send({
          field: "PREPARED_BY",
          label: "Rafic",
        })
        .expect(201);
      const wrong = await post({
        modeItemId: (seal.body as Body<{ id: number }>).data.id,
      }).expect(422);
      expect((wrong.body as ErrorBody).error).toBe("INVALID_MASTER_ITEM");
      await post({ invoiceId: 999_999_999, mode: "UPI" }).expect(404);
      await post({ mode: "UPI", amount: 0 }).expect(400);
    });

    it("RBAC: executives see payments but cannot record, edit or delete", async () => {
      await http().get("/sales/payments").set(auth("nobody")).expect(403);
      const list = await http()
        .get("/sales/payments")
        .set(auth("exec"))
        .expect(200);
      expect((list.body as Body<Payment[]>).meta?.total).toBe(2);
      await http()
        .post("/sales/payments")
        .set(auth("exec"))
        .send({
          invoiceId: invoice.id,
          amount: 1,
          paymentDate: "2026-08-30",
          mode: "UPI",
        })
        .expect(403);
      await http()
        .patch(`/sales/payments/${first.id}`)
        .set(auth("exec"))
        .send({ reference: "x" })
        .expect(403);
      await http()
        .delete(`/sales/payments/${first.id}`)
        .set(auth("exec"))
        .expect(403);
    });

    it("edits a payment within the balance; the invoice follows", async () => {
      const over = await http()
        .patch(`/sales/payments/${first.id}`)
        .set(auth("manager"))
        .send({ amount: 700.01 })
        .expect(422);
      expect((over.body as ErrorBody).error).toBe("PAYMENT_EXCEEDS_BALANCE");
      const res = await http()
        .patch(`/sales/payments/${first.id}`)
        .set(auth("manager"))
        .send({ amount: 300, mode: "UPI", dueDate: "2020-01-15" })
        .expect(200);
      expect((res.body as Body<Payment>).data).toMatchObject({
        paymentNumber: "TW/PR/26-27/0101",
        amount: "300",
        mode: "UPI",
        modeItemId: null,
        reference: "UTR123456789",
        invoice: { balance: "400" },
      });
    });

    it("due-date alerts and the overdue filter", async () => {
      const overdue = await http()
        .get("/sales/payments?overdueOnly=true")
        .set(auth("exec"))
        .expect(200);
      const rows = (overdue.body as Body<Payment[]>).data;
      expect(rows.map((r) => r.id)).toEqual([first.id]);
      expect(rows[0]?.overdueDays).toBeGreaterThan(0);
      const alerts = await http()
        .get("/sales/payments/alerts")
        .set(auth("exec"))
        .expect(200);
      expect(alerts.body).toEqual({
        data: {
          overduePayments: 1,
          overdueInvoices: 1,
          overdueBalance: "400",
        },
      });
      const due = await http()
        .get("/sales/payments?dueMonth=2020-01")
        .set(auth("exec"))
        .expect(200);
      expect((due.body as Body<Payment[]>).meta?.total).toBe(1);
      const paidIn = await http()
        .get("/sales/payments?paymentMonth=2026-08")
        .set(auth("exec"))
        .expect(200);
      expect((paidIn.body as Body<Payment[]>).meta?.total).toBe(2);
      const search = await http()
        .get(
          `/sales/payments?search=${encodeURIComponent(invoice.invoiceNumber)}`,
        )
        .set(auth("exec"))
        .expect(200);
      expect((search.body as Body<Payment[]>).meta?.total).toBe(2);
      await http()
        .get("/sales/payments?paymentMonth=2026-13")
        .set(auth("exec"))
        .expect(400);
    });

    it("a fully paid invoice is no longer overdue", async () => {
      const paid = await http()
        .post("/sales/payments")
        .set(auth("manager"))
        .send({
          invoiceId: invoice.id,
          amount: 400,
          paymentDate: "2026-09-01",
          mode: "Cash",
        })
        .expect(201);
      expect((paid.body as Body<Payment>).data).toMatchObject({
        paymentNumber: "TW/PR/26-27/0103",
        invoice: { balance: "0" },
      });
      const alerts = await http()
        .get("/sales/payments/alerts")
        .set(auth("exec"))
        .expect(200);
      expect(
        (alerts.body as Body<{ overduePayments: number }>).data.overduePayments,
      ).toBe(0);
    });

    it("prints a receipt with the shared company details", async () => {
      await http()
        .get(`/sales/payments/${first.id}/receipt`)
        .set(auth("exec"))
        .expect(200)
        .expect("Content-Type", /application\/pdf/);
      const html = rendered.at(-1) ?? "";
      expect(html).toContain("PAYMENT RECEIPT");
      expect(html).toContain("TW/PR/26-27/0101");
      expect(html).toContain(invoice.invoiceNumber);
      expect(html).toContain("TEXAWAVE INNOVATIONS PRIVATE LIMITED");
      expect(html).toContain("Canal Bank Road");
    });

    it("deleting restores the balance; numbers are never reused", async () => {
      await http()
        .delete(`/sales/payments/${first.id}`)
        .set(auth("manager"))
        .expect(204);
      await http()
        .get(`/sales/payments/${first.id}`)
        .set(auth("manager"))
        .expect(404);
      const inv = await http()
        .get(`/sales/invoices/${invoice.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((inv.body as Body<{ balance: string }>).data.balance).toBe("300");
      const low = await http()
        .patch("/sales/master/running-numbers/payment_received")
        .set(auth("manager"))
        .send({ lastNumber: 101, fiscalYear: "26-27" })
        .expect(422);
      expect((low.body as ErrorBody).error).toBe("RUNNING_NUMBER_IN_USE");
    });

    it("another organization cannot see or pay into them", async () => {
      await http()
        .get(`/sales/payments/${first.id}`)
        .set(auth("managerB"))
        .expect(404);
      const list = await http()
        .get("/sales/payments")
        .set(auth("managerB"))
        .expect(200);
      expect((list.body as Body<Payment[]>).data).toHaveLength(0);
      await http()
        .post("/sales/payments")
        .set(auth("managerB"))
        .send({
          invoiceId: invoice.id,
          amount: 1,
          paymentDate: "2026-09-01",
          mode: "UPI",
        })
        .expect(404);
      await http()
        .post("/sales/payments")
        .set(auth("managerB"))
        .send({
          invoiceId: invoice.id,
          amount: 1,
          paymentDate: "2026-09-01",
          modeItemId: bankTransfer,
        })
        .expect(422);
    });
  });

  // ---------------------------------------------------------------------------
  describe("returnable delivery challans", () => {
    let seal: number;
    let rdc: Rdc;
    const body = (over: Record<string, unknown> = {}) => ({
      customerId,
      issueDate: "2026-10-15",
      purpose: "Demonstration / Testing",
      expectedReturnDate: "2026-10-29",
      takenBy: "Ravi",
      lines: [{ description: "Demo control panel", quantity: 2 }],
      ...over,
    });

    it("master list: seals are shared with the other documents", async () => {
      const res = await http()
        .post("/sales/master/document-fields")
        .set(auth("manager"))
        .send({
          field: "COMPANY_SEAL",
          label: "Texawave Official Corporate Seal",
        })
        .expect(201);
      seal = (res.body as Body<{ id: number }>).data.id;
      await http()
        .put(`/sales/master/document-fields/${seal}/image`)
        .set(auth("manager"))
        .attach("file", PNG, { filename: "seal.png", contentType: "image/png" })
        .expect(200);
      await http()
        .post("/sales/master/document-fields")
        .set(auth("manager"))
        .send({ field: "HSN_CODE", value: "8471" })
        .expect(201);
      // Shared: the seal is offered on quotations too; an RDC has no HSN.
      const fieldsOf = async (documentType: string) =>
        (
          (
            await http()
              .get(`/sales/master/document-fields?documentType=${documentType}`)
              .set(auth("exec"))
              .expect(200)
          ).body as Body<Array<{ id: number; field: string }>>
        ).data;
      expect((await fieldsOf("QUOTATION")).map((o) => o.id)).toContain(seal);
      expect(
        (await fieldsOf("RETURNABLE_DC")).map((o) => o.field),
      ).not.toContain("HSN_CODE");
    });

    it("numbers from the editable running number (100 → 0101)", async () => {
      await http()
        .patch("/sales/master/running-numbers/returnable_dc")
        .set(auth("manager"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(200);
      const res = await http()
        .post("/sales/returnable-dcs")
        .set(auth("exec"))
        .send(body({ sealItemId: seal, preparedBy: "Rafic" }))
        .expect(201);
      rdc = (res.body as Body<Rdc>).data;
      expect(rdc).toMatchObject({
        rdcNumber: "TW/RDC/26-27/0101",
        status: "ISSUED",
        returnedDate: null,
        sealItemId: seal,
        sealName: "Texawave Official Corporate Seal",
        preparedBy: "Rafic",
        lines: [{ description: "Demo control panel", quantity: "2" }],
      });
      expect(rdc.notes).toContain(
        "remain the property of Texawave Innovations Private Limited",
      );
    });

    it("validates dates, lines and the customer", async () => {
      const early = await http()
        .post("/sales/returnable-dcs")
        .set(auth("manager"))
        .send(body({ expectedReturnDate: "2026-10-14" }))
        .expect(422);
      expect((early.body as ErrorBody).error).toBe(
        "RETURN_DATE_BEFORE_ISSUE_DATE",
      );
      await http()
        .post("/sales/returnable-dcs")
        .set(auth("manager"))
        .send(body({ lines: [] }))
        .expect(400);
      await http()
        .post("/sales/returnable-dcs")
        .set(auth("manager"))
        .send(body({ purpose: "" }))
        .expect(400);
      await http()
        .post("/sales/returnable-dcs")
        .set(auth("managerB"))
        .send(body())
        .expect(404);
    });

    it("lists with search, status and month filters; flags overdue returns", async () => {
      const old = await http()
        .post("/sales/returnable-dcs")
        .set(auth("manager"))
        .send(
          body({
            issueDate: "2020-01-01",
            expectedReturnDate: "2020-01-10",
            purpose: "Repair",
          }),
        )
        .expect(201);
      const late = (old.body as Body<Rdc>).data;
      expect(late.rdcNumber).toBe("TW/RDC/19-20/0001");
      expect(late.overdueDays).toBeGreaterThan(0);
      const q = async (query: string) =>
        (
          (
            await http()
              .get(`/sales/returnable-dcs?${query}`)
              .set(auth("exec"))
              .expect(200)
          ).body as Body<Rdc[]>
        ).data.map((r) => r.id);
      expect(await q("search=demonstration")).toEqual([rdc.id]);
      expect(await q("month=2020-01")).toEqual([late.id]);
      expect(await q("date=2026-10-15")).toEqual([rdc.id]);
      expect((await q("status=ISSUED")).sort()).toEqual(
        [rdc.id, late.id].sort(),
      );
      await http().get("/sales/returnable-dcs").set(auth("nobody")).expect(403);
    });

    it("prints with the company logo/name/address, seal image and returnable terms", async () => {
      await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("manager"))
        .attach("file", PNG, { filename: "logo.png", contentType: "image/png" })
        .expect(200);
      await http()
        .get(`/sales/returnable-dcs/${rdc.id}/pdf`)
        .set(auth("exec"))
        .expect(200);
      const html = rendered.at(-1) ?? "";
      expect(html).toContain("RETURNABLE DELIVERY CHALLAN");
      expect(html).toContain("TW/RDC/26-27/0101");
      expect(html).toContain("Description of Goods");
      expect(html).not.toContain("HSN Code");
      expect(html).toContain("Returnable Terms");
      expect(html).toContain('<img class="logo" src="data:image/png;base64,');
      expect(html).toContain('<img class="seal" src="data:image/png;base64,');
      expect(html).toContain("Canal Bank Road");
    });

    it("previews an unsaved RDC and edits to a saved one, storing nothing", async () => {
      const next = await http()
        .get("/sales/returnable-dcs/next-number?date=2026-10-15")
        .set(auth("exec"))
        .expect(200);
      const res = await http()
        .post("/sales/returnable-dcs/preview")
        .set(auth("exec"))
        .send(body({ purpose: "Site trial", sealItemId: seal }))
        .expect(200);
      const preview = (res.body as Body<{ number: string; html: string }>).data;
      expect(preview.number).toBe(
        (next.body as Body<{ number: string }>).data.number,
      );
      expect(preview.html).toContain("RETURNABLE DELIVERY CHALLAN");
      expect(preview.html).toContain("Site trial");
      expect(preview.html).toContain('<img class="seal" src="data:image/png;');
      const again = await http()
        .get("/sales/returnable-dcs/next-number?date=2026-10-15")
        .set(auth("exec"))
        .expect(200);
      expect(again.body).toEqual(next.body);
      const early = await http()
        .post("/sales/returnable-dcs/preview")
        .set(auth("exec"))
        .send(body({ expectedReturnDate: "2026-10-01" }))
        .expect(422);
      expect((early.body as ErrorBody).error).toBe(
        "RETURN_DATE_BEFORE_ISSUE_DATE",
      );
      const edit = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/preview`)
        .set(auth("exec"))
        .send({ takenBy: "Kumar (site)" })
        .expect(200);
      const edited = (edit.body as Body<{ number: string; html: string }>).data;
      expect(edited.number).toBe(rdc.rdcNumber);
      expect(edited.html).toContain("Kumar (site)");
      await http()
        .post(`/sales/returnable-dcs/${rdc.id}/preview`)
        .set(auth("managerB"))
        .send({})
        .expect(404);
      await http()
        .post("/sales/returnable-dcs/preview")
        .set(auth("nobody"))
        .send(body())
        .expect(403);
    });

    it("sends by email and WhatsApp (send permission)", async () => {
      const mail = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/email`)
        .set(auth("exec"))
        .send({})
        .expect(200);
      expect((mail.body as Body<{ to: string[] }>).data.to).toEqual([
        `jane@${suffix}.test`,
      ]);
      const wa = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/whatsapp`)
        .set(auth("exec"))
        .expect(200);
      expect((wa.body as Body<{ url: string }>).data.url).toContain(
        "https://wa.me/",
      );
    });

    it("return and reopen: a returned RDC cannot be edited", async () => {
      await http()
        .patch(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("exec"))
        .send({
          takenBy: "Kumar",
          lines: [{ description: "Panel", quantity: 1 }],
        })
        .expect(200);
      const before = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/return`)
        .set(auth("exec"))
        .send({ returnedDate: "2026-10-14" })
        .expect(422);
      expect((before.body as ErrorBody).error).toBe(
        "RETURN_DATE_BEFORE_ISSUE_DATE",
      );
      const ret = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/return`)
        .set(auth("exec"))
        .send({ returnedDate: "2026-10-28" })
        .expect(200);
      expect((ret.body as Body<Rdc>).data).toMatchObject({
        status: "RETURNED",
        returnedDate: "2026-10-28T00:00:00.000Z",
        overdueDays: null,
      });
      const locked = await http()
        .patch(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("exec"))
        .send({ takenBy: "Someone" })
        .expect(409);
      expect((locked.body as ErrorBody).error).toBe("RDC_RETURNED");
      await http()
        .post(`/sales/returnable-dcs/${rdc.id}/return`)
        .set(auth("exec"))
        .send({})
        .expect(409);
      const reopened = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/reopen`)
        .set(auth("exec"))
        .expect(200);
      expect((reopened.body as Body<Rdc>).data).toMatchObject({
        status: "ISSUED",
        returnedDate: null,
      });
      const again = await http()
        .post(`/sales/returnable-dcs/${rdc.id}/reopen`)
        .set(auth("exec"))
        .expect(409);
      expect((again.body as ErrorBody).error).toBe("RDC_NOT_RETURNED");
    });

    it("only holders of sales.returnable_dc.delete delete; others' RDCs stay hidden", async () => {
      await http()
        .get(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .delete(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("exec"))
        .expect(403);
      await http()
        .delete(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .delete(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("manager"))
        .expect(204);
      await http()
        .get(`/sales/returnable-dcs/${rdc.id}`)
        .set(auth("manager"))
        .expect(404);
      const low = await http()
        .patch("/sales/master/running-numbers/returnable_dc")
        .set(auth("manager"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(422);
      expect((low.body as ErrorBody).error).toBe("RUNNING_NUMBER_IN_USE");
    });
  });
});
