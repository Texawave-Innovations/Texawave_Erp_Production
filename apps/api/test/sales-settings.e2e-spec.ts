import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * End-to-end proof for the Sales Settings foundation
 * (Docs/SALES_SETTINGS_FOUNDATION.md) across all 8 resources: auth, org
 * scoping, permission checks, the singleton/list/generic shapes, and
 * tenant isolation. Modeled on `reference-tags.e2e-spec.ts`.
 *
 * Two organizations are seeded so tenant isolation is proven directly (a
 * row created in org A must be invisible — 404, not just "not in the
 * list" — from org B), not merely assumed from the code.
 */
describe("sales settings (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;

  const PERMISSION_CODES = [
    "sales_settings.company_detail.read",
    "sales_settings.company_detail.write",
    "sales_settings.document_numbering.read",
    "sales_settings.document_numbering.write",
    "sales_settings.bank_account.read",
    "sales_settings.bank_account.write",
    "sales_settings.authorized_signatory.read",
    "sales_settings.authorized_signatory.write",
    "sales_settings.salesperson.read",
    "sales_settings.salesperson.write",
    "sales_settings.seal_signature.read",
    "sales_settings.seal_signature.write",
    "sales_settings.master_list_item.read",
    "sales_settings.master_list_item.write",
  ];

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
      data: { name: `Org A ${suffix}`, slug: `org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-${suffix}` },
    });

    const permissions = await Promise.all(
      PERMISSION_CODES.map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        }),
      ),
    );
    const allPermissionIds = permissions.map((p) => p.id);
    const readOnlyIds = permissions
      .filter((p) => p.code.endsWith(".read"))
      .map((p) => p.id);

    async function makeUser(
      orgId: number,
      email: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
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
      return user;
    }

    await makeUser(orgA.id, "full-access@sales-a.test", allPermissionIds);
    await makeUser(orgB.id, "full-access@sales-b.test", allPermissionIds);
    await makeUser(orgA.id, "read-only@sales-a.test", readOnlyIds);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenA = await login(orgA.slug, "full-access@sales-a.test");
    tokenB = await login(orgB.slug, "full-access@sales-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@sales-a.test");
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.salesMasterListItem.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.sealSignature.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.salesperson.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.authorizedSignatory.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.bankAccount.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.companyDetail.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    // Only the docType values this foundation added — never touch
    // `docType: 'employee'` rows used by HR.
    await prisma.documentSequence.deleteMany({
      where: {
        organizationId: { in: orgIds },
        docType: { not: "employee" },
      },
    });
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer())
      .get("/sales-settings/company-detail")
      .expect(401);
  });

  it("rejects a write from a reader without the write permission", async () => {
    await request(app.getHttpServer())
      .put("/sales-settings/company-detail")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ name: "Should be forbidden" })
      .expect(403);
  });

  describe("company detail (singleton)", () => {
    it("returns null before anything is saved, then upserts and reads it back", async () => {
      const before = await request(app.getHttpServer())
        .get("/sales-settings/company-detail")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect((before.body as { data: unknown }).data).toBeNull();

      const upserted = await request(app.getHttpServer())
        .put("/sales-settings/company-detail")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ name: "Texawave Innovations", gstin: "29ABCDE1234F1Z5" })
        .expect(200);
      expect((upserted.body as { data: { name: string } }).data.name).toBe(
        "Texawave Innovations",
      );

      const after = await request(app.getHttpServer())
        .get("/sales-settings/company-detail")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect((after.body as { data: { name: string } }).data.name).toBe(
        "Texawave Innovations",
      );
    });

    it("rejects an unknown field (whitelist validation)", async () => {
      await request(app.getHttpServer())
        .put("/sales-settings/company-detail")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ name: "Fine", notADeclaredField: true })
        .expect(400);
    });

    it("never leaks one organization's company details to another", async () => {
      const asB = await request(app.getHttpServer())
        .get("/sales-settings/company-detail")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((asB.body as { data: unknown }).data).toBeNull();
    });
  });

  describe("document numbering (no own table, keyed by docType)", () => {
    it("lists all 8 document types with synthesized defaults, then upserts one", async () => {
      const list = await request(app.getHttpServer())
        .get("/sales-settings/document-numbering")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const rows = (list.body as { data: Array<{ docType: string }> }).data;
      expect(rows).toHaveLength(8);
      expect(rows.find((r) => r.docType === "invoice")).toMatchObject({
        prefix: "",
        padding: 6,
        nextNumber: 1,
      });

      const upserted = await request(app.getHttpServer())
        .put("/sales-settings/document-numbering/invoice")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ prefix: "INV", padding: 4 })
        .expect(200);
      expect((upserted.body as { data: { prefix: string } }).data.prefix).toBe(
        "INV",
      );

      const after = await request(app.getHttpServer())
        .get("/sales-settings/document-numbering")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const afterRows = (
        after.body as { data: Array<{ docType: string; prefix: string }> }
      ).data;
      expect(afterRows.find((r) => r.docType === "invoice")).toMatchObject({
        prefix: "INV",
        padding: 4,
      });
    });

    it("rejects an unknown document type", async () => {
      await request(app.getHttpServer())
        .put("/sales-settings/document-numbering/not_a_real_type")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ prefix: "X" })
        .expect(400);
    });

    it("does not leak org A's saved invoice prefix into org B's list", async () => {
      const asB = await request(app.getHttpServer())
        .get("/sales-settings/document-numbering")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      const rows = (
        asB.body as { data: Array<{ docType: string; prefix: string }> }
      ).data;
      expect(rows.find((r) => r.docType === "invoice")).toMatchObject({
        prefix: "",
      });
    });
  });

  describe("bank accounts (standard paginated CRUD)", () => {
    it("creates, lists (paginated envelope), reads, updates, and deletes", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/bank-accounts")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          bankName: "HDFC Bank",
          accountHolderName: "Texawave Innovations",
          accountNumber: "000111222333",
          ifscCode: "HDFC0000001",
        })
        .expect(201);
      const created = (createResponse.body as { data: { id: number } }).data;

      const listResponse = await request(app.getHttpServer())
        .get("/sales-settings/bank-accounts?page=1&limit=10")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const list = listResponse.body as {
        data: Array<{ id: number }>;
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      expect(list.data.some((a) => a.id === created.id)).toBe(true);
      expect(list.meta.page).toBe(1);
      expect(list.meta.limit).toBe(10);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/sales-settings/bank-accounts/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ branchName: "Anna Nagar" })
        .expect(200);
      expect(
        (updateResponse.body as { data: { branchName: string } }).data
          .branchName,
      ).toBe("Anna Nagar");

      await request(app.getHttpServer())
        .delete(`/sales-settings/bank-accounts/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/sales-settings/bank-accounts/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(404);
    });

    it("rejects an unknown field (whitelist validation)", async () => {
      await request(app.getHttpServer())
        .post("/sales-settings/bank-accounts")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          bankName: "Fine",
          accountHolderName: "Fine",
          accountNumber: "1",
          ifscCode: "X",
          notADeclaredField: true,
        })
        .expect(400);
    });

    it("never lets one organization see, edit, or delete another's bank account", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/bank-accounts")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          bankName: "Org A Only",
          accountHolderName: "Org A",
          accountNumber: "999",
          ifscCode: "AAAA0000001",
        })
        .expect(201);
      const id = (createResponse.body as { data: { id: number } }).data.id;

      const listAsB = await request(app.getHttpServer())
        .get("/sales-settings/bank-accounts?limit=100")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      const idsForB = (
        listAsB.body as { data: Array<{ id: number }> }
      ).data.map((a) => a.id);
      expect(idsForB).not.toContain(id);

      await request(app.getHttpServer())
        .get(`/sales-settings/bank-accounts/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/sales-settings/bank-accounts/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ branchName: "Hijacked" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/sales-settings/bank-accounts/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe("authorized signatory (singleton)", () => {
    it("returns null before anything is saved, then upserts and reads it back", async () => {
      const before = await request(app.getHttpServer())
        .get("/sales-settings/authorized-signatory")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect((before.body as { data: unknown }).data).toBeNull();

      const upserted = await request(app.getHttpServer())
        .put("/sales-settings/authorized-signatory")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ name: "Jane Doe", designation: "Commercial Manager" })
        .expect(200);
      expect((upserted.body as { data: { name: string } }).data.name).toBe(
        "Jane Doe",
      );
    });

    it("never leaks one organization's signatory to another", async () => {
      const asB = await request(app.getHttpServer())
        .get("/sales-settings/authorized-signatory")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((asB.body as { data: unknown }).data).toBeNull();
    });
  });

  describe("salespersons (standard paginated CRUD)", () => {
    it("creates, lists, reads, updates, and deletes", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/salespersons")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ name: "Rahul Sharma", code: "RS01" })
        .expect(201);
      const created = (createResponse.body as { data: { id: number } }).data;

      const updateResponse = await request(app.getHttpServer())
        .patch(`/sales-settings/salespersons/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ commissionPercent: 5 })
        .expect(200);
      expect(
        (updateResponse.body as { data: { commissionPercent: number } }).data
          .commissionPercent,
      ).toBe(5);

      await request(app.getHttpServer())
        .delete(`/sales-settings/salespersons/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/sales-settings/salespersons/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(404);
    });

    it("never lets one organization see or modify another's salesperson", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/salespersons")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ name: "Org A Only" })
        .expect(201);
      const id = (createResponse.body as { data: { id: number } }).data.id;

      await request(app.getHttpServer())
        .get(`/sales-settings/salespersons/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/sales-settings/salespersons/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  const IMAGE_DATA_URI =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  describe("company seals (seal-signatures masterlist, kind = seal)", () => {
    it("creates, lists, updates, and deletes", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/company-seals")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ title: "Official Round Seal", imageDataUri: IMAGE_DATA_URI })
        .expect(201);
      const created = (createResponse.body as { data: { id: number } }).data;

      const updateResponse = await request(app.getHttpServer())
        .patch(`/sales-settings/company-seals/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ title: "Updated Seal" })
        .expect(200);
      expect(
        (updateResponse.body as { data: { title: string } }).data.title,
      ).toBe("Updated Seal");

      await request(app.getHttpServer())
        .delete(`/sales-settings/company-seals/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/sales-settings/company-seals/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(404);
    });

    it("never lets one organization see another's seal, and keeps seals out of the signatures list", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/company-seals")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ title: "Org A Seal", imageDataUri: IMAGE_DATA_URI })
        .expect(201);
      const id = (createResponse.body as { data: { id: number } }).data.id;

      await request(app.getHttpServer())
        .get(`/sales-settings/company-seals/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);

      const signatures = await request(app.getHttpServer())
        .get("/sales-settings/authorized-signatures?limit=100")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const titles = (
        signatures.body as { data: Array<{ title: string }> }
      ).data.map((s) => s.title);
      expect(titles).not.toContain("Org A Seal");
    });
  });

  describe("authorized signatures (seal-signatures masterlist, kind = signature)", () => {
    it("creates, lists, updates, and deletes", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/authorized-signatures")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Jane Doe Signature",
          signatoryName: "Jane Doe",
          designation: "Commercial Manager",
          imageDataUri: IMAGE_DATA_URI,
        })
        .expect(201);
      const created = (createResponse.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .delete(`/sales-settings/authorized-signatures/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/sales-settings/authorized-signatures/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe("master list items (generic, 8 categories)", () => {
    it("creates, lists by category, updates, and deletes a payment term", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "payment_term", value: "Immediately" })
        .expect(201);
      const created = (createResponse.body as { data: { id: number } }).data;

      const listResponse = await request(app.getHttpServer())
        .get(
          "/sales-settings/master-list-items?category=payment_term&limit=100",
        )
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect(
        (listResponse.body as { data: Array<{ id: number }> }).data.some(
          (i) => i.id === created.id,
        ),
      ).toBe(true);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/sales-settings/master-list-items/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ value: "Net 30" })
        .expect(200);
      expect(
        (updateResponse.body as { data: { value: string } }).data.value,
      ).toBe("Net 30");

      await request(app.getHttpServer())
        .delete(`/sales-settings/master-list-items/${created.id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);
    });

    it("stores numericValue for a gst_rate item and allows duplicate values", async () => {
      const first = await request(app.getHttpServer())
        .post("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "gst_rate", value: "9%", numericValue: 9 })
        .expect(201);
      expect(
        (first.body as { data: { numericValue: number } }).data.numericValue,
      ).toBe(9);

      // Duplicate value allowed — this is an unstructured value list, not a
      // unique code+name lookup (Docs/SALES_SETTINGS_FOUNDATION.md #2).
      await request(app.getHttpServer())
        .post("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "gst_rate", value: "9%", numericValue: 9 })
        .expect(201);
    });

    it("requires category on list and rejects category on update (immutable)", async () => {
      await request(app.getHttpServer())
        .get("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(400);

      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "unit", value: "Kg" })
        .expect(201);
      const id = (createResponse.body as { data: { id: number } }).data.id;

      await request(app.getHttpServer())
        .patch(`/sales-settings/master-list-items/${id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "item_group" })
        .expect(400);
    });

    it("never lets one organization see, edit, or delete another's master list item", async () => {
      const createResponse = await request(app.getHttpServer())
        .post("/sales-settings/master-list-items")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ category: "dispatch_mode", value: "Org A Only" })
        .expect(201);
      const id = (createResponse.body as { data: { id: number } }).data.id;

      const listAsB = await request(app.getHttpServer())
        .get(
          "/sales-settings/master-list-items?category=dispatch_mode&limit=100",
        )
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      const idsForB = (
        listAsB.body as { data: Array<{ id: number }> }
      ).data.map((i) => i.id);
      expect(idsForB).not.toContain(id);

      await request(app.getHttpServer())
        .get(`/sales-settings/master-list-items/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/sales-settings/master-list-items/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ value: "Hijacked" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/sales-settings/master-list-items/${id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
