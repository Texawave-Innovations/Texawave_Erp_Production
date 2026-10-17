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
 * Sales documents — quotations, proforma/tax invoices, payments, delivery
 * challans and the company profile. Proves: the permission split (manager /
 * executive / reader), the company profile being required, per-financial-
 * year numbering (sequential, unique under concurrency), server-side
 * pricing with CGST+SGST in-state and IGST across states, the conversion
 * chain quotation → proforma → tax invoice → DC (with locking and payments
 * moving along), payment limits, delete guards, PDF/email/WhatsApp (audited),
 * organization isolation and the dashboard going live.
 */

interface Body<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
interface Doc {
  id: number;
  quotationNumber?: string;
  invoiceNumber?: string;
  dcNumber?: string;
  invoiceType?: string;
  status: string;
  taxMode: string;
  placeOfSupply: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  itemsSubtotal: string;
  taxableAmount: string;
  roundOff: string;
  totalAmount: string;
  amountReceived?: string;
  balance?: string;
  amountInWords: string;
  customerSnapshot: { companyName: string; stateCode: string | null };
  lines: Array<{ description: string; quantity: string; amount?: string }>;
  payments?: Array<{ id: number; amount: string }>;
  sourceQuotationId?: number | null;
  sourceInvoiceId?: number | null;
  itemsCount?: number;
}
interface ErrorBody {
  error: string;
  message: string | string[];
}

const MANAGER = [
  "sales.customer.read",
  "sales.customer.write",
  "sales.customer.delete",
  "sales.master.read",
  "sales.master.write",
  "sales.dashboard.read",
  "sales.quotation.read",
  "sales.quotation.write",
  "sales.quotation.delete",
  "sales.quotation.send",
  "sales.invoice.read",
  "sales.invoice.write",
  "sales.invoice.delete",
  "sales.invoice.send",
  "sales.invoice_payment.write",
  "sales.delivery_challan.read",
  "sales.delivery_challan.write",
  "sales.delivery_challan.delete",
  "sales.delivery_challan.send",
];
const EXECUTIVE = MANAGER.filter(
  (p) =>
    !p.endsWith(".delete") &&
    p !== "sales.invoice_payment.write" &&
    p !== "sales.master.write",
);

describe("Sales — quotations, invoices & delivery challans (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const suffix = randomUUID().slice(0, 6).toLowerCase();
  const rendered: string[] = [];

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
          return Promise.resolve(Buffer.from(`%PDF-TEST${html.length}`));
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Docs A ${suffix}`, slug: `docs-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Docs B ${suffix}`, slug: `docs-b-${suffix}` },
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
    await mkUser(orgA, "reader", [
      "sales.quotation.read",
      "sales.invoice.read",
      "sales.delivery_challan.read",
    ]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "managerB", MANAGER);
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    const where = { organizationId: { in: orgIds } };
    await prisma.salesDeliveryChallanLine.deleteMany({ where });
    await prisma.salesDeliveryChallan.deleteMany({ where });
    await prisma.salesInvoicePayment.deleteMany({ where });
    await prisma.salesInvoiceLine.deleteMany({ where });
    // Converted tax invoices point at their proforma — children first.
    await prisma.salesInvoice.deleteMany({
      where: { ...where, sourceInvoiceId: { not: null } },
    });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesQuotationLine.deleteMany({ where });
    await prisma.salesQuotation.deleteMany({ where });
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
    // Users/orgs that produced audit rows are intentionally left (audit_logs is append-only).
    await app.close();
  });

  const PROFILE = {
    legalName: "Texawave Innovations Private Limited",
    tagline: "Advanced ERP & Engineering Solutions",
    address: "No 93/206 Canal Bank Road, Adyar, Chennai - 600 020",
    gstin: "33AAMCT4293K1ZU",
  };

  let counter = 0;
  async function createCustomer(
    who: string,
    over: Record<string, unknown> = {},
  ) {
    counter += 1;
    const res = await http()
      .post("/sales/customers")
      .set(auth(who))
      .send({
        companyName: `Client ${suffix} ${counter}`,
        contactPerson: "Jane Buyer",
        email: `buyer${counter}@client.test`,
        mobileNumber: "9876543210",
        ...over,
      })
      .expect(201);
    return (res.body as Body<{ id: number; customerCode: string }>).data;
  }

  const line = (over: Record<string, unknown> = {}) => ({
    description: "Control panel",
    hsnCode: "8471",
    quantity: 1,
    unitPrice: 600,
    ...over,
  });

  async function createQuotation(
    who: string,
    customerId: number,
    over: Record<string, unknown> = {},
  ): Promise<Doc> {
    const res = await http()
      .post("/sales/quotations")
      .set(auth(who))
      .send({
        customerId,
        quotationDate: "2026-10-15",
        validity: "30 Days",
        lines: [line()],
        cgstRate: 9,
        sgstRate: 9,
        ...over,
      })
      .expect(201);
    return (res.body as Body<Doc>).data;
  }

  let tnCustomer: number; // Tamil Nadu — same state as the company (33)
  let kaCustomer: number; // Karnataka (29) — inter-state

  // ---------------------------------------------------------------------------
  describe("company profile (master list)", () => {
    it("documents need it first", async () => {
      tnCustomer = (
        await createCustomer("manager", { gstin: "33ABCDE1234F1Z5" })
      ).id;
      const res = await http()
        .post("/sales/quotations")
        .set(auth("manager"))
        .send({
          customerId: tnCustomer,
          quotationDate: "2026-10-15",
          lines: [line()],
          cgstRate: 9,
          sgstRate: 9,
        })
        .expect(422);
      expect((res.body as ErrorBody).error).toBe("COMPANY_PROFILE_REQUIRED");
    });

    it("only a master writer sets it; the state comes from the GSTIN", async () => {
      await http()
        .put("/sales/master/company-profile")
        .set(auth("exec"))
        .send(PROFILE)
        .expect(403);
      const res = await http()
        .put("/sales/master/company-profile")
        .set(auth("manager"))
        .send(PROFILE)
        .expect(200);
      expect(
        (res.body as Body<{ stateCode: string; pan: string }>).data,
      ).toMatchObject({ stateCode: "33", pan: "AAMCT4293K" });
      await http()
        .put("/sales/master/company-profile")
        .set(auth("manager"))
        .send({ ...PROFILE, stateCode: "29" })
        .expect(422);
      kaCustomer = (
        await createCustomer("manager", { gstin: "29ABCDE1234F1Z5" })
      ).id;
    });

    it("lists the document number formats", async () => {
      const res = await http()
        .get("/sales/master/code-formats")
        .set(auth("manager"))
        .expect(200);
      const types = (res.body as Body<Array<{ codeType: string }>>).data.map(
        (f) => f.codeType,
      );
      expect(types).toEqual([
        "customer",
        "quotation",
        "proforma_invoice",
        "tax_invoice",
        "delivery_challan",
        "payment_received",
        "returnable_dc",
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("RBAC", () => {
    it("401 without a token, 403 without permission", async () => {
      await http().get("/sales/quotations").expect(401);
      for (const path of [
        "/sales/quotations",
        "/sales/invoices",
        "/sales/delivery-challans",
      ]) {
        await http().get(path).set(auth("nobody")).expect(403);
      }
    });

    it("a reader lists, views and exports but cannot create, send or preview numbers", async () => {
      const q = await createQuotation("manager", tnCustomer);
      await http().get("/sales/quotations").set(auth("reader")).expect(200);
      await http()
        .get(`/sales/quotations/${q.id}/pdf`)
        .set(auth("reader"))
        .expect(200);
      await http()
        .post("/sales/quotations")
        .set(auth("reader"))
        .send({})
        .expect(403);
      await http()
        .post(`/sales/quotations/${q.id}/email`)
        .set(auth("reader"))
        .send({})
        .expect(403);
      await http()
        .get("/sales/quotations/next-number")
        .set(auth("reader"))
        .expect(403);
    });

    it("an executive creates and sends but cannot delete or record payments", async () => {
      const q = await createQuotation("exec", tnCustomer);
      await http()
        .post(`/sales/quotations/${q.id}/whatsapp`)
        .set(auth("exec"))
        .expect(200);
      await http()
        .delete(`/sales/quotations/${q.id}`)
        .set(auth("exec"))
        .expect(403);
      const inv = await http()
        .post(`/sales/quotations/${q.id}/convert`)
        .set(auth("exec"))
        .send({ invoiceType: "TAX" })
        .expect(201);
      await http()
        .post(`/sales/invoices/${(inv.body as Body<Doc>).data.id}/payments`)
        .set(auth("exec"))
        .send({ amount: 1, paymentDate: "2026-10-15", mode: "CASH" })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("numbering", () => {
    it("issues PREFIX/FY/NNNN per type and financial year; the preview matches", async () => {
      const preview = await http()
        .get("/sales/quotations/next-number?date=2027-05-01")
        .set(auth("manager"))
        .expect(200);
      const expected = (preview.body as Body<{ number: string }>).data.number;
      expect(expected).toBe("TW/QUO/27-28/0001");
      const q = await createQuotation("manager", tnCustomer, {
        quotationDate: "2027-05-01",
      });
      expect(q.quotationNumber).toBe(expected);
      const q2 = await createQuotation("manager", tnCustomer, {
        quotationDate: "2027-05-02",
      });
      expect(q2.quotationNumber).toBe("TW/QUO/27-28/0002");
      // March 2027 is still financial year 26-27 — its own counter.
      const q3 = await createQuotation("manager", tnCustomer, {
        quotationDate: "2027-03-31",
      });
      expect(q3.quotationNumber).toMatch(/^TW\/QUO\/26-27\/\d{4}$/);
    });

    it("never hands out the same number to concurrent creates", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          createQuotation("manager", tnCustomer, {
            quotationDate: "2028-06-01",
          }),
        ),
      );
      const numbers = results.map((r) => r.quotationNumber).sort();
      expect(new Set(numbers).size).toBe(6);
      expect(numbers[0]).toBe("TW/QUO/28-29/0001");
      expect(numbers[5]).toBe("TW/QUO/28-29/0006");
    });

    it("uses an edited master-list prefix for numbers issued afterwards", async () => {
      await http()
        .patch("/sales/master/code-formats/delivery_challan")
        .set(auth("manager"))
        .send({ prefix: "TW/DCX", padding: 3 })
        .expect(200);
      const res = await http()
        .post("/sales/delivery-challans")
        .set(auth("manager"))
        .send({
          customerId: tnCustomer,
          dcDate: "2029-04-10",
          lines: [{ description: "Panel", quantity: 2 }],
        })
        .expect(201);
      expect((res.body as Body<Doc>).data.dcNumber).toBe("TW/DCX/29-30/001");
      await http()
        .patch("/sales/master/code-formats/delivery_challan")
        .set(auth("manager"))
        .send({ prefix: "TW/DC", padding: 4 })
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe("pricing", () => {
    it("in-state: CGST + SGST, totals by the server, rounded to the rupee", async () => {
      const q = await createQuotation("manager", tnCustomer, {
        lines: [
          line({ quantity: 1.5, unitPrice: 333.33 }),
          line({ quantity: 2, unitPrice: 100 }),
        ],
        transportCharge: 49.5,
        transportDescription: "Freight & Transportation Charges",
        transportHsn: "9965",
      });
      expect(q).toMatchObject({
        taxMode: "INTRA",
        placeOfSupply: "33",
        itemsSubtotal: "700",
        taxableAmount: "749.5",
        cgstAmount: "67.46",
        sgstAmount: "67.46",
        igstAmount: "0",
        roundOff: "-0.42",
        totalAmount: "884",
        amountInWords: "Rupees Eight Hundred Eighty Four Only",
      });
    });

    it("across states: IGST (from CGST+SGST when only those are entered)", async () => {
      const q = await createQuotation("manager", kaCustomer);
      expect(q).toMatchObject({
        taxMode: "INTER",
        placeOfSupply: "29",
        cgstRate: "0",
        sgstRate: "0",
        igstRate: "18",
        igstAmount: "108",
        totalAmount: "708",
      });
    });

    it("no rate anywhere → 422 (no default GST)", async () => {
      const res = await http()
        .post("/sales/quotations")
        .set(auth("manager"))
        .send({
          customerId: tnCustomer,
          quotationDate: "2026-10-15",
          lines: [line()],
        })
        .expect(422);
      expect((res.body as ErrorBody).error).toBe("GST_RATE_REQUIRED");
    });

    it("rejects client-sent totals and bad input", async () => {
      await http()
        .post("/sales/quotations")
        .set(auth("manager"))
        .send({
          customerId: tnCustomer,
          quotationDate: "2026-10-15",
          lines: [line()],
          cgstRate: 9,
          sgstRate: 9,
          totalAmount: 1,
        })
        .expect(400);
      for (const bad of [
        { lines: [] },
        { lines: [line({ quantity: 0 })] },
        { lines: [line({ unitPrice: -1 })] },
        { lines: [line({ hsnCode: "84" })] },
        { cgstRate: 101 },
        { quotationDate: "2026-02-30" },
        { placeOfSupply: "3" },
      ]) {
        await http()
          .post("/sales/quotations")
          .set(auth("manager"))
          .send({
            customerId: tnCustomer,
            quotationDate: "2026-10-15",
            lines: [line()],
            cgstRate: 9,
            sgstRate: 9,
            ...bad,
          })
          .expect(400);
      }
    });

    it("an update re-prices: new lines and a new place of supply switch to IGST", async () => {
      const q = await createQuotation("manager", tnCustomer);
      const res = await http()
        .patch(`/sales/quotations/${q.id}`)
        .set(auth("manager"))
        .send({ placeOfSupply: "29", lines: [line({ unitPrice: 1000 })] })
        .expect(200);
      expect((res.body as Body<Doc>).data).toMatchObject({
        quotationNumber: q.quotationNumber,
        taxMode: "INTER",
        igstRate: "18",
        totalAmount: "1180",
      });
      expect((res.body as Body<Doc>).data.lines).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe("conversion chain and payments", () => {
    let quotation: Doc;
    let proforma: Doc;
    let tax: Doc;

    it("quotation → proforma locks the quotation", async () => {
      quotation = await createQuotation("manager", tnCustomer);
      const res = await http()
        .post(`/sales/quotations/${quotation.id}/convert`)
        .set(auth("manager"))
        .send({ invoiceDate: "2026-10-15" })
        .expect(201);
      proforma = (res.body as Body<Doc>).data;
      expect(proforma).toMatchObject({
        invoiceType: "PROFORMA",
        status: "UNPAID",
        totalAmount: "708",
        sourceQuotationId: quotation.id,
      });
      expect(proforma.invoiceNumber).toMatch(/^TW\/PI\/26-27\/\d{4}$/);

      const q = await http()
        .get(`/sales/quotations/${quotation.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((q.body as Body<Doc>).data.status).toBe("CONVERTED");
      await http()
        .patch(`/sales/quotations/${quotation.id}`)
        .set(auth("manager"))
        .send({ validity: "10 Days" })
        .expect(409);
      await http()
        .delete(`/sales/quotations/${quotation.id}`)
        .set(auth("manager"))
        .expect(409);
      await http()
        .post(`/sales/quotations/${quotation.id}/convert`)
        .set(auth("manager"))
        .send({})
        .expect(409);
    });

    it("records an advance on the proforma; never more than the balance", async () => {
      const over = await http()
        .post(`/sales/invoices/${proforma.id}/payments`)
        .set(auth("manager"))
        .send({ amount: 708.01, paymentDate: "2026-10-16", mode: "UPI" })
        .expect(422);
      expect((over.body as ErrorBody).error).toBe("PAYMENT_EXCEEDS_BALANCE");
      const res = await http()
        .post(`/sales/invoices/${proforma.id}/payments`)
        .set(auth("manager"))
        .send({
          amount: 300,
          paymentDate: "2026-10-16",
          mode: "BANK_TRANSFER",
          reference: "UTR123",
        })
        .expect(201);
      expect((res.body as Body<Doc>).data).toMatchObject({
        status: "PARTIALLY_PAID",
        amountReceived: "300",
        balance: "408",
      });
    });

    it("proforma → tax invoice moves the payments and locks the proforma", async () => {
      const res = await http()
        .post(`/sales/invoices/${proforma.id}/convert-to-tax`)
        .set(auth("manager"))
        .send({ invoiceDate: "2026-10-20" })
        .expect(201);
      tax = (res.body as Body<Doc>).data;
      expect(tax).toMatchObject({
        invoiceType: "TAX",
        sourceInvoiceId: proforma.id,
        amountReceived: "300",
        status: "PARTIALLY_PAID",
      });
      expect(tax.invoiceNumber).toMatch(/^TW\/IN\/26-27\/\d{4}$/);
      expect(tax.payments).toHaveLength(1);

      const pi = await http()
        .get(`/sales/invoices/${proforma.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((pi.body as Body<Doc>).data).toMatchObject({
        status: "CONVERTED",
        amountReceived: "0",
      });
      await http()
        .post(`/sales/invoices/${proforma.id}/convert-to-tax`)
        .set(auth("manager"))
        .send({})
        .expect(409);
      await http()
        .post(`/sales/invoices/${proforma.id}/payments`)
        .set(auth("manager"))
        .send({ amount: 1, paymentDate: "2026-10-16", mode: "CASH" })
        .expect(409);
      await http()
        .post(`/sales/invoices/${tax.id}/convert-to-tax`)
        .set(auth("manager"))
        .send({})
        .expect(422);
    });

    it("the rest of the payment settles it; the total cannot drop below received", async () => {
      const res = await http()
        .post(`/sales/invoices/${tax.id}/payments`)
        .set(auth("manager"))
        .send({ amount: 408, paymentDate: "2026-10-21", mode: "CASH" })
        .expect(201);
      expect((res.body as Body<Doc>).data).toMatchObject({
        status: "PAID",
        balance: "0",
      });
      const low = await http()
        .patch(`/sales/invoices/${tax.id}`)
        .set(auth("manager"))
        .send({ lines: [line({ unitPrice: 10 })] })
        .expect(422);
      expect((low.body as ErrorBody).error).toBe("TOTAL_BELOW_RECEIVED");
    });

    it("tax invoice → delivery challan copies the items without prices", async () => {
      await http()
        .post(`/sales/invoices/${proforma.id}/delivery-challan`)
        .set(auth("manager"))
        .send({})
        .expect(422);
      const res = await http()
        .post(`/sales/invoices/${tax.id}/delivery-challan`)
        .set(auth("manager"))
        .send({ dcDate: "2026-10-22" })
        .expect(201);
      const dc = (res.body as Body<Doc>).data;
      expect(dc).toMatchObject({
        sourceInvoiceId: tax.id,
        status: "DRAFT",
        itemsCount: 1,
      });
      expect(dc.dcNumber).toMatch(/^TW\/DC\/26-27\/\d{4}$/);
      expect(dc.lines[0]).not.toHaveProperty("unitPrice");
      const patched = await http()
        .patch(`/sales/delivery-challans/${dc.id}`)
        .set(auth("manager"))
        .send({ status: "DISPATCHED" })
        .expect(200);
      expect((patched.body as Body<Doc>).data.status).toBe("DISPATCHED");
    });

    it("delete guards: payments and DCs block deleting an invoice; customers with documents stay", async () => {
      const paid = await http()
        .delete(`/sales/invoices/${tax.id}`)
        .set(auth("manager"))
        .expect(409);
      expect((paid.body as ErrorBody).error).toBe("INVOICE_HAS_PAYMENTS");
      const cust = await http()
        .delete(`/sales/customers/${tnCustomer}`)
        .set(auth("manager"))
        .expect(409);
      expect((cust.body as ErrorBody).error).toBe("CUSTOMER_HAS_DOCUMENTS");
    });

    it("deleting a converted invoice reopens its quotation", async () => {
      const q = await createQuotation("manager", tnCustomer);
      const inv = await http()
        .post(`/sales/quotations/${q.id}/convert`)
        .set(auth("manager"))
        .send({})
        .expect(201);
      await http()
        .delete(`/sales/invoices/${(inv.body as Body<Doc>).data.id}`)
        .set(auth("manager"))
        .expect(204);
      const after = await http()
        .get(`/sales/quotations/${q.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((after.body as Body<Doc>).data.status).toBe("OPEN");
    });

    it("payments can be deleted, restoring the balance", async () => {
      const inv = await http()
        .post("/sales/invoices")
        .set(auth("manager"))
        .send({
          invoiceType: "TAX",
          customerId: kaCustomer,
          invoiceDate: "2026-10-15",
          dueDate: "2026-11-14",
          lines: [line()],
          igstRate: 18,
        })
        .expect(201);
      const id = (inv.body as Body<Doc>).data.id;
      const paid = await http()
        .post(`/sales/invoices/${id}/payments`)
        .set(auth("manager"))
        .send({ amount: 100, paymentDate: "2026-10-16", mode: "CHEQUE" })
        .expect(201);
      const paymentId = (paid.body as Body<Doc>).data.payments?.[0]?.id;
      const res = await http()
        .delete(`/sales/invoices/${id}/payments/${paymentId}`)
        .set(auth("manager"))
        .expect(200);
      expect((res.body as Body<Doc>).data).toMatchObject({
        status: "UNPAID",
        amountReceived: "0",
        balance: "708",
      });
      await http()
        .post("/sales/invoices")
        .set(auth("manager"))
        .send({
          invoiceType: "TAX",
          customerId: kaCustomer,
          invoiceDate: "2026-10-15",
          dueDate: "2026-10-01",
          lines: [line()],
          igstRate: 18,
        })
        .expect(422);
    });
  });

  // ---------------------------------------------------------------------------
  describe("quotation live preview", () => {
    interface Preview {
      number: string;
      html: string;
      totals: { taxMode: string; totalAmount: string; cgstAmount: string };
    }
    const body = (customerId: number, over: Record<string, unknown> = {}) => ({
      customerId,
      quotationDate: "2026-10-15",
      validity: "30 Days",
      lines: [line()],
      cgstRate: 9,
      sgstRate: 9,
      ...over,
    });

    it("prices like create, renders the PDF's HTML, and stores nothing", async () => {
      const before = await http()
        .get("/sales/quotations")
        .set(auth("manager"))
        .expect(200);
      const total = (before.body as { meta: { total: number } }).meta.total;
      const next = await http()
        .get("/sales/quotations/next-number?date=2026-10-15")
        .set(auth("manager"))
        .expect(200);

      const res = await http()
        .post("/sales/quotations/preview")
        .set(auth("exec"))
        .send(body(tnCustomer))
        .expect(200);
      const preview = (res.body as Body<Preview>).data;
      expect(preview.number).toBe(
        (next.body as Body<{ number: string }>).data.number,
      );
      expect(preview.html).toContain("QUOTATION");
      expect(preview.html).toContain(preview.number);
      expect(preview.html).toContain("Control panel");

      const after = await http()
        .get("/sales/quotations")
        .set(auth("manager"))
        .expect(200);
      expect((after.body as { meta: { total: number } }).meta.total).toBe(
        total,
      );

      const saved = await createQuotation("manager", tnCustomer);
      expect(preview.totals).toMatchObject({
        taxMode: saved.taxMode,
        totalAmount: saved.totalAmount,
        cgstAmount: saved.cgstAmount,
      });
    });

    it("previews edits to a saved quotation under its own number", async () => {
      const q = await createQuotation("manager", tnCustomer);
      const res = await http()
        .post(`/sales/quotations/${q.id}/preview`)
        .set(auth("manager"))
        .send({ lines: [line({ quantity: 2 })] })
        .expect(200);
      const preview = (res.body as Body<Preview>).data;
      expect(preview.number).toBe(q.quotationNumber);
      expect(Number(preview.totals.totalAmount)).toBe(
        Number(q.totalAmount) * 2,
      );
      const stored = await http()
        .get(`/sales/quotations/${q.id}`)
        .set(auth("manager"))
        .expect(200);
      expect((stored.body as Body<Doc>).data.totalAmount).toBe(q.totalAmount);
    });

    it("validates like create and is gated by sales.quotation.write", async () => {
      await http()
        .post("/sales/quotations/preview")
        .set(auth("manager"))
        .send(body(tnCustomer, { lines: [] }))
        .expect(400);
      await http()
        .post("/sales/quotations/preview")
        .set(auth("reader"))
        .send(body(tnCustomer))
        .expect(403);
      // Another organization cannot preview org A's customer: 404, or 422
      // first when that organization has no company details yet (both are
      // looked up together).
      const other = await http()
        .post("/sales/quotations/preview")
        .set(auth("managerB"))
        .send(body(tnCustomer));
      expect([404, 422]).toContain(other.status);
      expect(JSON.stringify(other.body)).not.toContain("<html");
      const q = await createQuotation("manager", tnCustomer);
      await http()
        .post(`/sales/quotations/${q.id}/preview`)
        .set(auth("managerB"))
        .send({})
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("invoice and delivery challan live previews", () => {
    interface Preview {
      number: string;
      html: string;
      totals?: { totalAmount: string; lineAmounts: string[] };
    }
    const invoiceBody = (over: Record<string, unknown> = {}) => ({
      invoiceType: "TAX",
      customerId: tnCustomer,
      invoiceDate: "2026-10-15",
      lines: [line()],
      cgstRate: 9,
      sgstRate: 9,
      ...over,
    });

    it("previews a tax invoice like create, under the next number, storing nothing", async () => {
      const next = await http()
        .get("/sales/invoices/next-number?invoiceType=TAX&date=2026-10-15")
        .set(auth("manager"))
        .expect(200);
      const res = await http()
        .post("/sales/invoices/preview")
        .set(auth("exec"))
        .send(invoiceBody())
        .expect(200);
      const preview = (res.body as Body<Preview>).data;
      expect(preview.number).toBe(
        (next.body as Body<{ number: string }>).data.number,
      );
      expect(preview.html).toContain("TAX INVOICE");
      expect(preview.totals?.lineAmounts).toEqual(["600"]);
      const again = await http()
        .get("/sales/invoices/next-number?invoiceType=TAX&date=2026-10-15")
        .set(auth("manager"))
        .expect(200);
      expect(again.body).toEqual(next.body);
      const saved = await http()
        .post("/sales/invoices")
        .set(auth("manager"))
        .send(invoiceBody())
        .expect(201);
      expect(preview.totals?.totalAmount).toBe(
        (saved.body as Body<Doc>).data.totalAmount,
      );
    });

    it("previews a proforma and invoice edits; checks the due date", async () => {
      const pi = await http()
        .post("/sales/invoices/preview")
        .set(auth("manager"))
        .send(invoiceBody({ invoiceType: "PROFORMA" }))
        .expect(200);
      expect((pi.body as Body<Preview>).data.html).toContain(
        "PROFORMA INVOICE",
      );
      const bad = await http()
        .post("/sales/invoices/preview")
        .set(auth("manager"))
        .send(invoiceBody({ dueDate: "2026-10-01" }))
        .expect(422);
      expect((bad.body as ErrorBody).error).toBe(
        "DUE_DATE_BEFORE_INVOICE_DATE",
      );
      const saved = await http()
        .post("/sales/invoices")
        .set(auth("manager"))
        .send(invoiceBody())
        .expect(201);
      const inv = (saved.body as Body<Doc>).data;
      const edit = await http()
        .post(`/sales/invoices/${inv.id}/preview`)
        .set(auth("manager"))
        .send({ lines: [line({ quantity: 3 })] })
        .expect(200);
      expect((edit.body as Body<Preview>).data.number).toBe(inv.invoiceNumber);
      await http()
        .post("/sales/invoices/preview")
        .set(auth("reader"))
        .send(invoiceBody())
        .expect(403);
    });

    it("previews a delivery challan (no prices) and its edits", async () => {
      const dcBody = {
        customerId: tnCustomer,
        dcDate: "2026-10-15",
        lines: [{ description: "Control panel", hsnCode: "8471", quantity: 2 }],
      };
      const res = await http()
        .post("/sales/delivery-challans/preview")
        .set(auth("exec"))
        .send(dcBody)
        .expect(200);
      const preview = (res.body as Body<Preview>).data;
      expect(preview.number).toMatch(/^TW\/DC\/26-27\/\d{4}$/);
      expect(preview.html).toContain("DELIVERY CHALLAN");
      expect(preview.html).toContain("Control panel");
      expect(preview.totals).toBeUndefined();
      const saved = await http()
        .post("/sales/delivery-challans")
        .set(auth("manager"))
        .send(dcBody)
        .expect(201);
      const dc = (saved.body as Body<Doc>).data;
      const edit = await http()
        .post(`/sales/delivery-challans/${dc.id}/preview`)
        .set(auth("manager"))
        .send({ notes: "Handle with care" })
        .expect(200);
      expect((edit.body as Body<Preview>).data.html).toContain(
        "Handle with care",
      );
      await http()
        .post(`/sales/delivery-challans/${dc.id}/preview`)
        .set(auth("managerB"))
        .send({})
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("PDF, email and WhatsApp", () => {
    it("exports a PDF from the server-side template", async () => {
      const q = await createQuotation("manager", tnCustomer, {
        terms: "1. Valid 30 days\n2. Subject to Chennai jurisdiction",
      });
      const res = await http()
        .get(`/sales/quotations/${q.id}/pdf`)
        .set(auth("manager"))
        .expect(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain(
        encodeURIComponent(
          `${(q.quotationNumber ?? "").replace(/\//g, "-")}.pdf`,
        ),
      );
      const html = rendered.at(-1) ?? "";
      expect(html).toContain("TEXAWAVE INNOVATIONS PRIVATE LIMITED");
      expect(html).toContain(q.quotationNumber);
      expect(html).toContain("Subject to Chennai jurisdiction");
    });

    it("emails the PDF (not configured under tests) and audits it", async () => {
      const q = await createQuotation("manager", tnCustomer);
      const res = await http()
        .post(`/sales/quotations/${q.id}/email`)
        .set(auth("manager"))
        .send({ cc: ["boss@client.test"] })
        .expect(200);
      expect(
        (res.body as Body<{ status: string; to: string[] }>).data,
      ).toMatchObject({ status: "NOT_CONFIGURED" });
      await http()
        .post(`/sales/quotations/${q.id}/email`)
        .set(auth("manager"))
        .send({ to: ["not-an-email"] })
        .expect(400);
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "sales_quotation",
          entityId: q.id,
          action: "send_email",
        },
      });
      expect(audit).not.toBeNull();
    });

    it("builds a wa.me link to the customer's mobile", async () => {
      const q = await createQuotation("manager", tnCustomer);
      const res = await http()
        .post(`/sales/quotations/${q.id}/whatsapp`)
        .set(auth("manager"))
        .expect(200);
      const data = (res.body as Body<{ url: string; phone: string }>).data;
      expect(data.phone).toBe("919876543210");
      expect(data.url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
      expect(decodeURIComponent(data.url)).toContain(q.quotationNumber);
    });
  });

  // ---------------------------------------------------------------------------
  describe("lists, isolation and the dashboard", () => {
    it("filters by type, customer, dates and search", async () => {
      const res = await http()
        .get(
          `/sales/invoices?invoiceType=TAX&customerId=${kaCustomer}&from=2026-10-01&to=2026-10-31`,
        )
        .set(auth("manager"))
        .expect(200);
      const body = res.body as Body<Doc[]>;
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((d) => d.invoiceType === "TAX")).toBe(true);
      const search = await http()
        .get(`/sales/quotations?search=Client ${suffix}`)
        .set(auth("manager"))
        .expect(200);
      expect((search.body as Body<Doc[]>).meta?.total).toBeGreaterThan(0);
    });

    it("another organization sees nothing (404 by id, empty lists)", async () => {
      const q = await createQuotation("manager", tnCustomer);
      await http()
        .get(`/sales/quotations/${q.id}`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .post(`/sales/quotations/${q.id}/convert`)
        .set(auth("managerB"))
        .send({})
        .expect(404);
      const list = await http()
        .get("/sales/invoices")
        .set(auth("managerB"))
        .expect(200);
      expect((list.body as Body<Doc[]>).meta?.total).toBe(0);
    });

    it("the dashboard reports live quotation, invoice and payment figures", async () => {
      const res = await http()
        .get("/sales/dashboard")
        .set(auth("manager"))
        .expect(200);
      const d = (
        res.body as Body<{
          availability: Record<string, boolean>;
          kpis: {
            totalQuotations: number;
            invoicesIssued: number;
            paymentsCollected: string;
          };
          quotationConversion: { won: number };
        }>
      ).data;
      expect(d.availability).toMatchObject({
        quotations: true,
        invoices: true,
        payments: true,
      });
      expect(d.kpis.totalQuotations).toBeGreaterThan(5);
      expect(d.kpis.invoicesIssued).toBeGreaterThanOrEqual(2);
      expect(Number(d.kpis.paymentsCollected)).toBeGreaterThanOrEqual(708);
      expect(d.quotationConversion.won).toBeGreaterThanOrEqual(1);
    });
  });
});
