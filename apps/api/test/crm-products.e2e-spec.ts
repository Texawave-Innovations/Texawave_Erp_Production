import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm products (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let accountA: { id: number };
  let tokenAll: string;
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
      data: { name: `Org A ${suffix}`, slug: `crm-product-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-product-org-b-${suffix}` },
    });
    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Acme A ${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const read = await permission("crm.product.read");
    const write = await permission("crm.product.write");
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

    await makeUser(orgA.id, "all-access@crm-product-org-a.test", [
      read.id,
      write.id,
      oppRead.id,
      oppWrite.id,
      stageRead.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-product-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-product-org-b.test", [
      read.id,
      write.id,
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

    tokenAll = await login(orgA.slug, "all-access@crm-product-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-product-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-product-org-b.test");
  });

  /** The last `describe` block below attaches a product to a real
   * Opportunity line item. Once that exists, the product (and, per
   * crm-opportunities.e2e-spec.ts, the opportunity/account chain above
   * it) can never be hard-deleted — `opportunity_products.product_id` is
   * `ON DELETE RESTRICT`, and a blanket `deleteMany` would abort
   * mid-transaction the moment it reached that one row. Same
   * "permanent residue by design" tradeoff already documented there;
   * nothing is cleaned up here either. */
  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated and no-permission requests", async () => {
    await request(app.getHttpServer()).get("/crm/products").expect(401);
    await request(app.getHttpServer())
      .get("/crm/products")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .send({ name: "X", code: "X", unitPrice: 1 })
      .expect(403);
  });

  it("rejects create missing name or code (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ code: "SKU-1", unitPrice: 10 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Widget", unitPrice: 10 })
      .expect(400);
  });

  it("rejects negative unitPrice on create and on update (D3), but allows zero", async () => {
    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Widget", code: "SKU-NEG", unitPrice: -1 })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Free Sample", code: "SKU-ZERO", unitPrice: 0 })
      .expect(201);
    const product = (
      created.body as { data: { id: number; unitPrice: string } }
    ).data;
    expect(product.unitPrice).toBe("0");

    await request(app.getHttpServer())
      .patch(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ unitPrice: -5 })
      .expect(400);
  });

  it("does not enforce taxPercent upper bound (D2 — no cap without further approval)", async () => {
    const res = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        name: "High Tax Item",
        code: "SKU-TAX",
        unitPrice: 100,
        taxPercent: 250,
      })
      .expect(201);
    expect((res.body as { data: { taxPercent: string } }).data.taxPercent).toBe(
      "250",
    );
  });

  it("creates, reads, updates, and soft-deletes a product with tenant isolation", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        name: "Industrial Woven Fabric Roll",
        code: "SKU-1001",
        category: "Textiles",
        vendor: "Acme Mills",
        unitPrice: 450.5,
        taxPercent: 18,
        description: "Roll of woven fabric",
      })
      .expect(201);
    const product = (
      createRes.body as {
        data: {
          id: number;
          name: string;
          unitPrice: string;
          isActive: boolean;
        };
      }
    ).data;
    expect(product.name).toBe("Industrial Woven Fabric Roll");
    expect(product.unitPrice).toBe("450.5");
    expect(product.isActive).toBe(true);

    await request(app.getHttpServer())
      .get(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);

    // Org B cannot see Org A's product — tenant isolation (404, not 403).
    await request(app.getHttpServer())
      .get(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // Archive via isActive toggle — does not soft-delete.
    const archiveRes = await request(app.getHttpServer())
      .patch(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ isActive: false })
      .expect(200);
    expect(
      (archiveRes.body as { data: { isActive: boolean } }).data.isActive,
    ).toBe(false);
    const stillThere = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stillThere?.deletedAt).toBeNull();

    // Soft-delete.
    await request(app.getHttpServer())
      .delete(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/crm/products/${product.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
    const deleted = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("allows duplicate codes within the same org and across orgs (approved decision D1 — no uniqueness)", async () => {
    const dupCode = `SKU-DUP-${randomUUID().slice(0, 6)}`;
    const first = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Variant A", code: dupCode, unitPrice: 10 })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ name: "Variant B", code: dupCode, unitPrice: 20 })
      .expect(201);
    expect((first.body as { data: { id: number } }).data.id).not.toBe(
      (second.body as { data: { id: number } }).data.id,
    );

    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Org B Variant", code: dupCode, unitPrice: 30 })
      .expect(201);
  });

  it("searches across name/code/category/vendor", async () => {
    const suffix = randomUUID().slice(0, 6);
    await request(app.getHttpServer())
      .post("/crm/products")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        name: `Searchable Widget ${suffix}`,
        code: `SKU-SEARCH-${suffix}`,
        unitPrice: 5,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/crm/products")
      .query({ q: `Searchable Widget ${suffix}` })
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const names = (res.body as { data: { name: string }[] }).data.map(
      (p) => p.name,
    );
    expect(names).toContain(`Searchable Widget ${suffix}`);
  });

  describe("delete blocked while referenced by a deal line item", () => {
    it("refuses to delete a product used in an OpportunityProduct (422); scope limitation: quotation line items are not and cannot yet be counted", async () => {
      const productRes = await request(app.getHttpServer())
        .post("/crm/products")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          name: "Referenced Product",
          code: `SKU-REF-${randomUUID().slice(0, 6)}`,
          unitPrice: 100,
        })
        .expect(201);
      const product = (productRes.body as { data: { id: number } }).data;

      const stagesRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const boardStage = (
        stagesRes.body as { data: { id: number; code: string }[] }
      ).data.find((s) => !["won", "lost", "on_hold"].includes(s.code))!;

      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Deal With Product",
          ownerName: "Rep A",
          stageId: boardStage.id,
          estimatedValue: 1000,
        })
        .expect(201);
      const opportunity = (oppRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opportunity.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ items: [{ productId: product.id, quantity: 2 }] })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/crm/products/${product.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(422);
    });
  });
});
