import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm quotations (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let accountA: { id: number };
  let accountA2: { id: number };
  let accountB: { id: number };
  let contactA: { id: number };
  let tokenAll: string;
  let tokenWriteOnly: string;
  let tokenNoPermission: string;
  let tokenB: string;

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
      data: { name: `Org A ${suffix}`, slug: `crm-quote-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-quote-org-b-${suffix}` },
    });
    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Acme A ${suffix}` },
    });
    accountA2 = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Acme A2 ${suffix}` },
    });
    accountB = await prisma.account.create({
      data: { organizationId: orgB.id, name: `Acme B ${suffix}` },
    });
    contactA = await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: accountA.id,
        name: "Contact A",
      },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.quotation.read");
    const write = await permission("crm.quotation.write");
    const del = await permission("crm.quotation.delete");
    const productRead = await permission("crm.product.read");
    const productWrite = await permission("crm.product.write");
    const oppRead = await permission("crm.opportunity.read.all");
    const oppWrite = await permission("crm.opportunity.write.all");
    const stageRead = await permission("crm.pipeline_stage.read");

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

    await makeUser(orgA.id, "all-access@crm-quote-org-a.test", [
      read.id,
      write.id,
      del.id,
      productRead.id,
      productWrite.id,
      oppRead.id,
      oppWrite.id,
      stageRead.id,
    ]);
    // Deliberately NO `del` here — proves .write cannot bypass the
    // separate admin-only delete permission (approved decision D1).
    await makeUser(orgA.id, "write-only@crm-quote-org-a.test", [
      read.id,
      write.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-quote-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-quote-org-b.test", [
      read.id,
      write.id,
      del.id,
      productRead.id,
      productWrite.id,
    ]);

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

    tokenAll = await login(orgA.slug, "all-access@crm-quote-org-a.test");
    tokenWriteOnly = await login(orgA.slug, "write-only@crm-quote-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-quote-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-quote-org-b.test");
  });

  /** Nothing is hard-deleted here. `QuotationLineItem.quotationId` is
   * `ON DELETE CASCADE` but Quotations themselves are only ever
   * soft-deleted via the real API in these tests, and this suite also
   * creates Opportunities/Products to exercise cross-entity relationship
   * validation — once a Product carries any line-item reference it
   * inherits the same permanent-residue consequence already documented
   * in crm-opportunities.e2e-spec.ts / crm-products.e2e-spec.ts. */
  afterAll(async () => {
    await app.close();
  });

  async function createProduct(
    token: string,
    overrides: Partial<{ unitPrice: number; isActive: boolean }> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Quote Product ${randomUUID().slice(0, 6)}`,
        code: `SKU-Q-${randomUUID().slice(0, 6)}`,
        unitPrice: overrides.unitPrice ?? 100,
        isActive: overrides.isActive ?? true,
      })
      .expect(201);
    return (
      res.body as {
        data: { id: number; code: string; name: string; unitPrice: string };
      }
    ).data;
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      accountId: accountA.id,
      subject: "Standard Quote",
      validUntil: "2027-06-01",
      items: [{ description: "Consulting hours", quantity: 2, unitPrice: 500 }],
      ...overrides,
    };
  }

  it("rejects unauthenticated and no-permission requests", async () => {
    await request(app.getHttpServer()).get("/crm/quotations").expect(401);
    await request(app.getHttpServer())
      .get("/crm/quotations")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/crm/quotations")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .send(validPayload())
      .expect(403);
  });

  describe("validation", () => {
    it("rejects missing accountId/subject/validUntil (400)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ accountId: undefined }))
        .expect(400);
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ subject: undefined }))
        .expect(400);
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ validUntil: undefined }))
        .expect(400);
    });

    it("rejects zero line items and a zero/negative quantity (400)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ items: [] }))
        .expect(400);
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [{ description: "Bad", quantity: 0, unitPrice: 10 }],
          }),
        )
        .expect(400);
    });

    it("rejects an invalid status value (400)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ status: "NotARealStatus" }))
        .expect(400);
    });
  });

  describe("relationships (approved decision D5)", () => {
    it("rejects a cross-org accountId (422)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ accountId: accountB.id }))
        .expect(422);
    });

    it("rejects a contact that does not belong to the selected account (422)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ accountId: accountA2.id, contactId: contactA.id }))
        .expect(422);
    });

    it("accepts a contact that does belong to the selected account", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ contactId: contactA.id }))
        .expect(201);
    });

    it("rejects an opportunity belonging to a different account (422)", async () => {
      const stagesRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const stageId = (
        stagesRes.body as { data: { id: number; code: string }[] }
      ).data.find((s) => !["won", "lost", "on_hold"].includes(s.code))!.id;
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA2.id,
          title: "Other Account Deal",
          ownerName: "Rep",
          stageId,
          estimatedValue: 100,
        })
        .expect(201);
      const opportunity = (oppRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            accountId: accountA.id,
            opportunityId: opportunity.id,
          }),
        )
        .expect(422);
    });

    it("rejects an opportunity that is not OPEN (422)", async () => {
      const stagesRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const stageId = (
        stagesRes.body as { data: { id: number; code: string }[] }
      ).data.find((s) => !["won", "lost", "on_hold"].includes(s.code))!.id;
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Closing Deal",
          ownerName: "Rep",
          stageId,
          estimatedValue: 100,
        })
        .expect(201);
      const opportunity = (oppRes.body as { data: { id: number } }).data;
      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opportunity.id}/lost`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "No Budget" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ opportunityId: opportunity.id }))
        .expect(422);
    });

    it("accepts a free-text line with no productId", async () => {
      const res = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload())
        .expect(201);
      const items = (
        res.body as {
          data: {
            lineItems: { productId: number | null; description: string }[];
          };
        }
      ).data.lineItems;
      expect(items[0]!.productId).toBeNull();
      expect(items[0]!.description).toBe("Consulting hours");
    });

    it("rejects a productId that does not exist in this organization (422)", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: 999_999_999,
                description: "Bad product",
                quantity: 1,
                unitPrice: 10,
              },
            ],
          }),
        )
        .expect(422);
    });

    it("rejects an inactive product (422)", async () => {
      const inactive = await createProduct(tokenAll, { isActive: false });
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: inactive.id,
                description: "Inactive",
                quantity: 1,
                unitPrice: 10,
              },
            ],
          }),
        )
        .expect(422);
    });
  });

  describe("numbering (approved decision D3)", () => {
    it("generates a server-side QUO-<id, zero-padded to 6> number, unique per organization", async () => {
      const res = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload())
        .expect(201);
      const created = (
        res.body as { data: { id: number; quotationNumber: string } }
      ).data;
      expect(created.quotationNumber).toBe(
        `QUO-${String(created.id).padStart(6, "0")}`,
      );
    });

    it("creates 5 quotations concurrently with no duplicate numbers (DB-level uniqueness proof)", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post("/crm/quotations")
            .set("Authorization", `Bearer ${tokenAll}`)
            .send(validPayload())
            .expect(201),
        ),
      );
      const numbers = results.map(
        (r) =>
          (r.body as { data: { quotationNumber: string } }).data
            .quotationNumber,
      );
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it("rejects a direct duplicate quotationNumber at the DB level", async () => {
      const created = await prisma.quotation.create({
        data: {
          organizationId: orgA.id,
          accountId: accountA.id,
          quotationNumber: `QUO-DUPTEST-${randomUUID().slice(0, 6)}`,
          subject: "Raw row",
          subtotal: 0,
          totalDiscount: 0,
          totalTax: 0,
          adjustment: 0,
          grandTotal: 0,
        },
      });
      await expect(
        prisma.quotation.create({
          data: {
            organizationId: orgA.id,
            accountId: accountA.id,
            quotationNumber: created.quotationNumber,
            subject: "Duplicate row",
            subtotal: 0,
            totalDiscount: 0,
            totalTax: 0,
            adjustment: 0,
            grandTotal: 0,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("server-computed totals (approved decision D4) and rounding consistency", () => {
    it("rejects a client-submitted total outright — the DTO has no such field, and the global whitelist ValidationPipe refuses the unknown property rather than silently dropping it", async () => {
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ grandTotal: 1 }))
        .expect(400);
    });

    it("recomputes every total server-side from the validated line items", async () => {
      const res = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                description: "Item",
                quantity: 3,
                unitPrice: 450.5,
                discountPercent: 10,
                taxPercent: 18,
              },
            ],
            adjustment: 25,
          }),
        )
        .expect(201);
      const quote = (
        res.body as {
          data: {
            subtotal: string;
            totalDiscount: string;
            totalTax: string;
            grandTotal: string;
            lineItems: {
              amount: string;
              discountAmount: string;
              taxAmount: string;
            }[];
          };
        }
      ).data;
      // gross = 3*450.5 = 1351.5; discount 10% = 135.15; taxable = 1216.35;
      // tax 18% of 1216.35 = 218.943 -> 218.94; total = 1435.29
      expect(quote.lineItems[0]!.amount).toBe("1435.29");
      expect(quote.lineItems[0]!.discountAmount).toBe("135.15");
      expect(quote.lineItems[0]!.taxAmount).toBe("218.94");
      expect(quote.subtotal).toBe("1351.5");
      expect(quote.totalDiscount).toBe("135.15");
      expect(quote.totalTax).toBe("218.94");
      // grandTotal = 1351.5 - 135.15 + 218.94 + 25 = 1460.29
      expect(quote.grandTotal).toBe("1460.29");
    });

    it("computes identical per-line totals as Deal Products for the same inputs (shared computeLineBreakdown)", async () => {
      const stagesRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const stageId = (
        stagesRes.body as { data: { id: number; code: string }[] }
      ).data.find((s) => !["won", "lost", "on_hold"].includes(s.code))!.id;
      const product = await createProduct(tokenAll, { unitPrice: 200 });

      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Compare Deal",
          ownerName: "Rep",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opportunity = (oppRes.body as { data: { id: number } }).data;
      const dealLineRes = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opportunity.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          items: [{ productId: product.id, quantity: 4, discountPercent: 15 }],
        })
        .expect(201);
      const dealTotal = (dealLineRes.body as { data: { total: string }[] })
        .data[0]!.total;

      const quoteRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: product.id,
                description: product.name,
                quantity: 4,
                unitPrice: 200,
                discountPercent: 15,
              },
            ],
          }),
        )
        .expect(201);
      const quoteLineTotal = (
        quoteRes.body as { data: { lineItems: { amount: string }[] } }
      ).data.lineItems[0]!.amount;

      expect(quoteLineTotal).toBe(dealTotal);
    });

    it("preserves a manual unitPrice override distinct from the product's listPrice", async () => {
      const product = await createProduct(tokenAll, { unitPrice: 300 });
      const res = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: product.id,
                description: "Negotiated price",
                quantity: 1,
                unitPrice: 250,
              },
            ],
          }),
        )
        .expect(201);
      const line = (
        res.body as {
          data: { lineItems: { listPrice: string; unitPrice: string }[] };
        }
      ).data.lineItems[0]!;
      expect(line.listPrice).toBe("300");
      expect(line.unitPrice).toBe("250");
    });
  });

  describe("CRUD, status, and replace-all atomicity (approved decision D2)", () => {
    it("creates, reads, and tenant-isolates a quotation", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ subject: "Isolation Test" }))
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .get(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("status is freely settable to any of the 5 values with no transition guard", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ status: "Accepted" }))
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;
      expect((createRes.body as { data: { status: string } }).data.status).toBe(
        "Accepted",
      );

      // Accepted -> Draft directly; legacy has no guard against this.
      const replaceRes = await request(app.getHttpServer())
        .put(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ status: "Draft" }))
        .expect(200);
      expect(
        (replaceRes.body as { data: { status: string } }).data.status,
      ).toBe("Draft");
    });

    it("replace-all swaps the entire line-item set atomically, recomputing totals", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              { description: "Line 1", quantity: 1, unitPrice: 100 },
              { description: "Line 2", quantity: 1, unitPrice: 100 },
            ],
          }),
        )
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      const replaceRes = await request(app.getHttpServer())
        .put(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [{ description: "Only Line", quantity: 1, unitPrice: 999 }],
          }),
        )
        .expect(200);
      const replaced = (
        replaceRes.body as {
          data: { lineItems: { description: string }[]; subtotal: string };
        }
      ).data;
      expect(replaced.lineItems).toHaveLength(1);
      expect(replaced.lineItems[0]!.description).toBe("Only Line");
      expect(replaced.subtotal).toBe("999");

      const dbItems = await prisma.quotationLineItem.findMany({
        where: { quotationId: quote.id },
      });
      expect(dbItems).toHaveLength(1);
    });

    it("rejects a replace-all whose new items fail validation, leaving the original items untouched", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [{ description: "Keep Me", quantity: 1, unitPrice: 50 }],
          }),
        )
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .put(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: 999_999_999,
                description: "Bad",
                quantity: 1,
                unitPrice: 1,
              },
            ],
          }),
        )
        .expect(422);

      const stillThere = await prisma.quotationLineItem.findMany({
        where: { quotationId: quote.id },
      });
      expect(stillThere).toHaveLength(1);
      expect(stillThere[0]!.description).toBe("Keep Me");
    });

    it("Org B cannot replace or delete Org A's quotation (404), row left unchanged", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ subject: "Protected" }))
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .put(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send(validPayload({ subject: "Hijacked" }))
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);

      const unchanged = await prisma.quotation.findUnique({
        where: { id: quote.id },
      });
      expect(unchanged?.subject).toBe("Protected");
    });
  });

  describe("delete — separate permission from write (approved decision D1)", () => {
    it("rejects delete for a write-only token (403) even though it can create/update", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenWriteOnly}`)
        .send(validPayload({ subject: "Write-only created this" }))
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .put(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenWriteOnly}`)
        .send(validPayload({ subject: "Write-only updated this" }))
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenWriteOnly}`)
        .expect(403);

      // The full-access (delete-permitted) token can.
      await request(app.getHttpServer())
        .delete(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);
    });

    it("soft-delete excludes the quotation from reads without touching its Account/Contact/Opportunity", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(validPayload({ contactId: contactA.id }))
        .expect(201);
      const quote = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .delete(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(404);

      const dbRow = await prisma.quotation.findUnique({
        where: { id: quote.id },
      });
      expect(dbRow?.deletedAt).not.toBeNull();
      const account = await prisma.account.findUnique({
        where: { id: accountA.id },
      });
      const contact = await prisma.contact.findUnique({
        where: { id: contactA.id },
      });
      expect(account?.deletedAt).toBeNull();
      expect(contact?.deletedAt).toBeNull();
    });
  });

  describe("Product deletion blocked by quotation references (closes Products Risk R3)", () => {
    it("refuses to delete a product referenced by a live quotation line item (422)", async () => {
      const product = await createProduct(tokenAll);
      const res = await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            items: [
              {
                productId: product.id,
                description: product.name,
                quantity: 1,
                unitPrice: 100,
              },
            ],
          }),
        )
        .expect(201);
      const quote = (res.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .delete(`/crm/products/${product.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(422);

      // Once the referencing quotation is itself soft-deleted, the
      // product is free again — matches legacy's "a deleted quote frees
      // up its products" behavior (its items leave the live tree too).
      await request(app.getHttpServer())
        .delete(`/crm/quotations/${quote.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);
      await request(app.getHttpServer())
        .delete(`/crm/products/${product.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);
    });
  });

  describe("list: search, status filter, pagination", () => {
    it("search matches quotationNumber/subject/account name; status filter narrows results", async () => {
      const suffix = randomUUID().slice(0, 6);
      await request(app.getHttpServer())
        .post("/crm/quotations")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send(
          validPayload({
            subject: `Findable Subject ${suffix}`,
            status: "Sent",
          }),
        )
        .expect(201);

      const bySubject = await request(app.getHttpServer())
        .get("/crm/quotations")
        .query({ q: `Findable Subject ${suffix}` })
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect(
        (bySubject.body as { data: { subject: string }[] }).data.some((q) =>
          q.subject.includes(suffix),
        ),
      ).toBe(true);

      const byStatus = await request(app.getHttpServer())
        .get("/crm/quotations")
        .query({ status: "Sent", q: suffix })
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect(
        (byStatus.body as { data: unknown[] }).data.length,
      ).toBeGreaterThan(0);

      const wrongStatus = await request(app.getHttpServer())
        .get("/crm/quotations")
        .query({ status: "Rejected", q: suffix })
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((wrongStatus.body as { data: unknown[] }).data).toHaveLength(0);
    });
  });
});
