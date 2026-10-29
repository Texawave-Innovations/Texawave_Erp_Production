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
 * Sales document master list — running numbers, company details (logo) and
 * document fields (validity, terms, HSN, bank, seal, signature, prepared-by).
 * Proves: RBAC (read vs write vs the running-number permission), setting a
 * last number (100 → next document 0101) and refusing one that would
 * duplicate an issued number, image uploads checked by content, only the
 * fields each document has, one default per field, documents choosing a
 * seal/signature option (label copied, image printed with the logo), and
 * organization isolation.
 */

interface Body<T> {
  data: T;
}
interface ErrorBody {
  error: string;
}
interface Option {
  id: number;
  field: string;
  label: string;
  value: string | null;
  isDefault: boolean;
  hasImage: boolean;
}
interface RunningNumber {
  codeType: string;
  fiscalYear: string;
  lastNumber: number;
  lastCode: string | null;
  nextCode: string;
}

// A real 1×1 PNG.
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
  "sales.quotation.read",
  "sales.quotation.write",
  "sales.invoice.read",
  "sales.invoice.write",
  "sales.delivery_challan.read",
  "sales.delivery_challan.write",
];
const EXECUTIVE = MANAGER.filter(
  (p) => p !== "sales.master.write" && p !== "sales.running_number.write",
);

describe("Sales — document master list (e2e)", () => {
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
      data: { name: `Master A ${suffix}`, slug: `master-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Master B ${suffix}`, slug: `master-b-${suffix}` },
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

    await http()
      .put("/sales/master/company-profile")
      .set(auth("manager"))
      .send({
        legalName: "Texawave Innovations Private Limited",
        address: "No 93/206 Canal Bank Road, Adyar, Chennai - 600 020",
        gstin: "33AAMCT4293K1ZU",
      })
      .expect(200);
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    const where = { organizationId: { in: orgIds } };
    await prisma.salesDeliveryChallanLine.deleteMany({ where });
    await prisma.salesDeliveryChallan.deleteMany({ where });
    await prisma.salesInvoiceLine.deleteMany({ where });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesQuotationLine.deleteMany({ where });
    await prisma.salesQuotation.deleteMany({ where });
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

  let customerId: number;
  function quotation(over: Record<string, unknown> = {}) {
    return http()
      .post("/sales/quotations")
      .set(auth("manager"))
      .send({
        customerId,
        quotationDate: "2026-10-15",
        lines: [{ description: "Panel", quantity: 1, unitPrice: 600 }],
        cgstRate: 9,
        sgstRate: 9,
        ...over,
      });
  }

  // ---------------------------------------------------------------------------
  describe("running numbers", () => {
    it("lists every document type for the financial year", async () => {
      const res = await http()
        .get("/sales/master/running-numbers?date=2026-10-15")
        .set(auth("exec"))
        .expect(200);
      const rows = (res.body as Body<RunningNumber[]>).data;
      expect(rows.map((r) => [r.codeType, r.nextCode])).toEqual([
        ["quotation", "TW/QUO/26-27/0001"],
        ["proforma_invoice", "TW/PI/26-27/0001"],
        ["tax_invoice", "TW/IN/26-27/0001"],
        ["delivery_challan", "TW/DC/26-27/0001"],
        ["payment_received", "TW/PR/26-27/0001"],
        ["returnable_dc", "TW/RDC/26-27/0001"],
      ]);
      expect(rows.every((r) => r.lastCode === null)).toBe(true);
    });

    it("only holders of sales.running_number.write change them", async () => {
      await http()
        .patch("/sales/master/running-numbers/quotation")
        .set(auth("exec"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(403);
      await http()
        .get("/sales/master/running-numbers")
        .set(auth("nobody"))
        .expect(403);
    });

    it("setting 100 makes the next quotation …/0101", async () => {
      customerId = (
        (
          await http()
            .post("/sales/customers")
            .set(auth("manager"))
            .send({
              companyName: `Client ${suffix}`,
              contactPerson: "Jane",
              email: `jane@${suffix}.test`,
              mobileNumber: "9876543210",
              gstin: "33ABCDE1234F1Z5",
            })
            .expect(201)
        ).body as Body<{ id: number }>
      ).data.id;

      const res = await http()
        .patch("/sales/master/running-numbers/quotation")
        .set(auth("manager"))
        .send({ lastNumber: 100, fiscalYear: "26-27" })
        .expect(200);
      expect((res.body as Body<RunningNumber>).data).toMatchObject({
        lastNumber: 100,
        lastCode: "TW/QUO/26-27/0100",
        nextCode: "TW/QUO/26-27/0101",
      });
      const preview = await http()
        .get("/sales/quotations/next-number?date=2026-10-15")
        .set(auth("manager"))
        .expect(200);
      expect((preview.body as Body<{ number: string }>).data.number).toBe(
        "TW/QUO/26-27/0101",
      );
      const q = await quotation().expect(201);
      expect(
        (q.body as Body<{ quotationNumber: string }>).data.quotationNumber,
      ).toBe("TW/QUO/26-27/0101");
    });

    it("never below a number already issued; other years untouched", async () => {
      const low = await http()
        .patch("/sales/master/running-numbers/quotation")
        .set(auth("manager"))
        .send({ lastNumber: 50, fiscalYear: "26-27" })
        .expect(422);
      expect((low.body as ErrorBody).error).toBe("RUNNING_NUMBER_IN_USE");
      // Raising it (or keeping the issued maximum) is fine.
      await http()
        .patch("/sales/master/running-numbers/quotation")
        .set(auth("manager"))
        .send({ lastNumber: 101, fiscalYear: "26-27" })
        .expect(200);
      const next = await http()
        .get("/sales/master/running-numbers?date=2027-05-01")
        .set(auth("manager"))
        .expect(200);
      expect((next.body as Body<RunningNumber[]>).data[0]?.nextCode).toBe(
        "TW/QUO/27-28/0001",
      );
    });

    it("validates the input", async () => {
      for (const [path, body, status] of [
        ["quotation", { lastNumber: -1 }, 400],
        ["quotation", { lastNumber: 1.5 }, 400],
        ["quotation", { lastNumber: 5, fiscalYear: "2026" }, 400],
        ["quotation", { lastNumber: 5, fiscalYear: "26-28" }, 422],
        ["customer", { lastNumber: 5 }, 404],
      ] as const) {
        await http()
          .patch(`/sales/master/running-numbers/${path}`)
          .set(auth("manager"))
          .send(body)
          .expect(status);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe("company details", () => {
    it("uploads, serves and removes the logo (PNG/JPG only, master writers only)", async () => {
      await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("exec"))
        .attach("file", PNG, "logo.png")
        .expect(403);
      await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("manager"))
        .attach("file", Buffer.from("not an image"), "logo.png")
        .expect(400);
      const up = await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("manager"))
        .attach("file", PNG, "logo.png")
        .expect(200);
      expect((up.body as Body<{ hasLogo: boolean }>).data.hasLogo).toBe(true);
      const logo = await http()
        .get("/sales/master/company-profile/logo")
        .set(auth("exec"))
        .expect(200);
      expect(logo.headers["content-type"]).toContain("image/png");
      // Replacing keeps exactly one logo.
      await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("manager"))
        .attach("file", PNG, "logo2.png")
        .expect(200);
    });

    it("needs a profile before a logo", async () => {
      const res = await http()
        .put("/sales/master/company-profile/logo")
        .set(auth("managerB"))
        .attach("file", PNG, "logo.png")
        .expect(422);
      expect((res.body as ErrorBody).error).toBe("COMPANY_PROFILE_REQUIRED");
      await http()
        .get("/sales/master/company-profile/logo")
        .set(auth("managerB"))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("document fields", () => {
    let seal: Option;
    let signature: Option;

    it("describes each field and the documents that offer it", async () => {
      const res = await http()
        .get("/sales/master/document-fields/layout")
        .set(auth("exec"))
        .expect(200);
      const layout = (
        res.body as Body<
          Array<{ field: string; hasImage: boolean; documentTypes: string[] }>
        >
      ).data;
      const of = (field: string) => layout.find((l) => l.field === field);
      expect(layout.map((l) => l.field)).toHaveLength(9);
      expect(of("PAYMENT_MODE")?.documentTypes).toEqual(["PAYMENT_RECEIVED"]);
      expect(of("COMPANY_SEAL")).toEqual({
        field: "COMPANY_SEAL",
        hasImage: true,
        documentTypes: [
          "QUOTATION",
          "PROFORMA_INVOICE",
          "TAX_INVOICE",
          "DELIVERY_CHALLAN",
          "RETURNABLE_DC",
        ],
      });
    });

    it("adds options per field, shared by every document that has it", async () => {
      const add = (body: Record<string, unknown>, who = "manager") =>
        http().post("/sales/master/document-fields").set(auth(who)).send(body);
      await add({ field: "VALIDITY", label: "30 Days" }, "exec").expect(403);
      await add({
        field: "VALIDITY",
        label: "30 Days",
        isDefault: true,
      }).expect(201);
      await add({
        field: "DELIVERY_TERMS",
        label: "2-3 Weeks",
      }).expect(201);
      await add({
        field: "PAYMENT_TERMS",
        label: "30 Days",
      }).expect(201);
      const hsn = await add({
        field: "HSN_CODE",
        value: "8471",
        label: "Computers",
      }).expect(201);
      expect((hsn.body as Body<Option>).data).toMatchObject({
        value: "8471",
        label: "Computers",
      });
      const bank = await add({
        field: "BANK_ACCOUNT",
        bankDetails: {
          bankName: "HDFC Bank",
          accountNumber: "235767577457",
          branch: "Main Branch",
          ifsc: "HDFC0001256",
        },
      }).expect(201);
      expect((bank.body as Body<Option>).data.label).toBe(
        "HDFC Bank - 235767577457 (Main Branch)",
      );
      await add({
        field: "PREPARED_BY",
        label: "Rafic",
      }).expect(201);

      // One bank account serves every document with a bank field; a
      // payment receipt has none.
      const ids = async (documentType: string) =>
        (
          (
            await http()
              .get(`/sales/master/document-fields?documentType=${documentType}`)
              .set(auth("exec"))
              .expect(200)
          ).body as Body<Option[]>
        ).data.map((o) => o.id);
      const bankId = (bank.body as Body<Option>).data.id;
      expect(await ids("QUOTATION")).toContain(bankId);
      expect(await ids("TAX_INVOICE")).toContain(bankId);
      expect(await ids("DELIVERY_CHALLAN")).toContain(bankId);
      expect(await ids("PAYMENT_RECEIVED")).not.toContain(bankId);
      await add({
        field: "VALIDITY",
        label: "x",
        value: "1",
      }).expect(422);
      await add({
        field: "HSN_CODE",
        value: "12",
      }).expect(422);
      await add({
        field: "NOPE",
        label: "x",
      }).expect(400);

      seal = (
        (
          await add({
            field: "COMPANY_SEAL",
            label: "Texawave Official Corporate Seal",
          }).expect(201)
        ).body as Body<Option>
      ).data;
      signature = (
        (
          await add({
            field: "AUTHORIZED_SIGNATURE",
            label: "Managing Director Signature",
          }).expect(201)
        ).body as Body<Option>
      ).data;
    });

    it("keeps one default per field", async () => {
      const second = await http()
        .post("/sales/master/document-fields")
        .set(auth("manager"))
        .send({
          field: "VALIDITY",
          label: "15 Days",
          isDefault: true,
        })
        .expect(201);
      const list = await http()
        .get(
          "/sales/master/document-fields?documentType=QUOTATION&field=VALIDITY",
        )
        .set(auth("exec"))
        .expect(200);
      const rows = (list.body as Body<Option[]>).data;
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => r.isDefault).map((r) => r.id)).toEqual([
        (second.body as Body<Option>).data.id,
      ]);
    });

    it("edits and deletes options; the field never changes", async () => {
      const created = await http()
        .post("/sales/master/document-fields")
        .set(auth("manager"))
        .send({
          field: "PAYMENT_TERMS",
          label: "45 Days",
        })
        .expect(201);
      const id = (created.body as Body<Option>).data.id;
      const edited = await http()
        .patch(`/sales/master/document-fields/${id}`)
        .set(auth("manager"))
        .send({ label: "60 Days", sortOrder: 2 })
        .expect(200);
      expect((edited.body as Body<Option>).data.label).toBe("60 Days");
      await http()
        .patch(`/sales/master/document-fields/${id}`)
        .set(auth("manager"))
        .send({ field: "VALIDITY" })
        .expect(400);
      await http()
        .delete(`/sales/master/document-fields/${id}`)
        .set(auth("manager"))
        .expect(204);
      await http()
        .get(`/sales/master/document-fields/${id}`)
        .set(auth("manager"))
        .expect(404);
    });

    it("seals and signatures take an image; other fields do not", async () => {
      const up = await http()
        .put(`/sales/master/document-fields/${seal.id}/image`)
        .set(auth("manager"))
        .attach("file", PNG, "seal.png")
        .expect(200);
      expect((up.body as Body<Option>).data.hasImage).toBe(true);
      await http()
        .put(`/sales/master/document-fields/${signature.id}/image`)
        .set(auth("manager"))
        .attach("file", PNG, "sign.png")
        .expect(200);
      const img = await http()
        .get(`/sales/master/document-fields/${seal.id}/image`)
        .set(auth("exec"))
        .expect(200);
      expect(img.headers["content-type"]).toContain("image/png");

      const validity = await http()
        .get("/sales/master/document-fields?field=VALIDITY")
        .set(auth("manager"))
        .expect(200);
      const validityId = (validity.body as Body<Option[]>).data[0]?.id;
      const res = await http()
        .put(`/sales/master/document-fields/${validityId}/image`)
        .set(auth("manager"))
        .attach("file", PNG, "x.png")
        .expect(422);
      expect((res.body as ErrorBody).error).toBe("IMAGE_NOT_ALLOWED");
    });

    it("a document that chooses a seal/signature copies the label and prints the images and logo", async () => {
      const q = await quotation({
        sealItemId: seal.id,
        signatureItemId: signature.id,
        sealName: "ignored when an option is chosen",
      }).expect(201);
      const doc = (
        q.body as Body<{
          id: number;
          sealName: string;
          signatureName: string;
          sealItemId: number;
        }>
      ).data;
      expect(doc).toMatchObject({
        sealItemId: seal.id,
        sealName: "Texawave Official Corporate Seal",
        signatureName: "Managing Director Signature",
      });
      await http()
        .get(`/sales/quotations/${doc.id}/pdf`)
        .set(auth("manager"))
        .expect(200);
      const html = rendered.at(-1) ?? "";
      expect(html).toContain('<img class="logo" src="data:image/png;base64,');
      expect(html).toContain('<img class="seal" src="data:image/png;base64,');
      expect(html).toContain(
        '<img class="signature" src="data:image/png;base64,',
      );

      // The choice survives conversion, and deleting the option later keeps
      // the issued document printing it.
      const inv = await http()
        .post(`/sales/quotations/${doc.id}/convert`)
        .set(auth("manager"))
        .send({})
        .expect(201);
      expect((inv.body as Body<{ sealItemId: number }>).data.sealItemId).toBe(
        seal.id,
      );
      await http()
        .delete(`/sales/master/document-fields/${seal.id}`)
        .set(auth("manager"))
        .expect(204);
      await http()
        .get(`/sales/quotations/${doc.id}/pdf`)
        .set(auth("manager"))
        .expect(200);
      expect(rendered.at(-1)).toContain('<img class="seal"');
    });

    it("refuses a wrong or deleted option as a seal", async () => {
      const validity = await http()
        .get("/sales/master/document-fields?field=VALIDITY")
        .set(auth("manager"))
        .expect(200);
      const notASeal = (validity.body as Body<Option[]>).data[0]?.id;
      const wrong = await quotation({ sealItemId: notASeal }).expect(422);
      expect((wrong.body as ErrorBody).error).toBe("INVALID_MASTER_ITEM");
      await quotation({ sealItemId: seal.id }).expect(422);
    });

    it("another organization cannot see or use the options", async () => {
      await http()
        .get(`/sales/master/document-fields/${signature.id}`)
        .set(auth("managerB"))
        .expect(404);
      await http()
        .get(`/sales/master/document-fields/${signature.id}/image`)
        .set(auth("managerB"))
        .expect(404);
      const list = await http()
        .get("/sales/master/document-fields")
        .set(auth("managerB"))
        .expect(200);
      expect((list.body as Body<Option[]>).data).toHaveLength(0);
    });
  });
});
