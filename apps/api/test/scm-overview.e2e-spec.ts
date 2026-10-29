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

describe("scm overview, master data, barcode, advanced and assistant (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNone: string;
  let tokenB: string;
  let wh: Id;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (t: string, url: string, body: object = {}) =>
    http().post(url).set(auth(t)).send(body);
  const get = (t: string, url: string) => http().get(url).set(auth(t));
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;

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
      data: { name: `Org A ${suffix}`, slug: `scm-ov-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-ov-b-${suffix}` },
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
      "scm.overview.read",
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
        data: { organizationId: orgId, email, passwordHash, fullName: "Ops" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "all@scm-ov-a.test", idsOf(codes));
    await makeUser(
      orgA.id,
      "none@scm-ov-a.test",
      idsOf(codes.filter((c) => c !== "scm.overview.read")),
    );
    await makeUser(orgB.id, "all@scm-ov-b.test", idsOf(codes));
    const login = async (slug: string, email: string) =>
      data<{ accessToken: string }>(
        await http()
          .post("/auth/login")
          .send({ organizationSlug: slug, email, password: "Password123!" })
          .expect(201),
      ).accessToken;
    tokenAll = await login(orgA.slug, "all@scm-ov-a.test");
    tokenNone = await login(orgA.slug, "none@scm-ov-a.test");
    tokenB = await login(orgB.slug, "all@scm-ov-b.test");

    wh = data<Id>(
      await post(tokenAll, "/scm/warehouses", {
        code: `W${suffix}`,
        name: "Main",
      }).expect(201),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns supply-chain stage counts and requires the overview permission", async () => {
    await get(tokenNone, "/scm/overview").expect(403);
    const overview = data<{ stages: { stage: string; count: number }[] }>(
      await get(tokenAll, "/scm/overview").expect(200),
    );
    const suppliers = overview.stages.find((s) => s.stage === "Suppliers")!;
    expect(suppliers.count).toBe(0);
  });

  it("finds a supplier and a product by free-text search, scoped to the tenant", async () => {
    const supplier = data<Id & { companyName: string }>(
      await post(tokenAll, "/scm/suppliers", {
        companyName: "Acme Bolts Ltd",
        contactPerson: "A",
      }).expect(201),
    );
    const product = data<Id & { productCode: string }>(
      await post(tokenAll, "/scm/products", {
        productCode: "SRCH-001",
        name: "Searchable Widget",
      }).expect(201),
    );
    const hits = data<{ type: string; label: string }[]>(
      await get(tokenAll, "/scm/master-data/search?q=Acme").expect(200),
    );
    expect(
      hits.some(
        (h) => h.type === "Supplier" && h.label === supplier.companyName,
      ),
    ).toBe(true);
    const hits2 = data<{ type: string; sublabel: string | null }[]>(
      await get(tokenAll, "/scm/master-data/search?q=Searchable").expect(200),
    );
    expect(
      hits2.some(
        (h) => h.type === "Product" && h.sublabel === product.productCode,
      ),
    ).toBe(true);
    const hitsB = data<unknown[]>(
      await get(tokenB, "/scm/master-data/search?q=Acme").expect(200),
    );
    expect(hitsB).toHaveLength(0);
  });

  it("resolves a scanned product code and 404s on an unknown one", async () => {
    const product = data<Id & { productCode: string }>(
      await post(tokenAll, "/scm/products", {
        productCode: "SCAN-001",
        name: "Scan Widget",
      }).expect(201),
    );
    const hit = data<{ type: string; id: number }>(
      await post(tokenAll, "/scm/barcode/resolve", { code: "SCAN-001" }).expect(
        201,
      ),
    );
    expect(hit).toMatchObject({ type: "Product", id: product.id });
    await post(tokenAll, "/scm/barcode/resolve", {
      code: "NO-SUCH-CODE",
    }).expect(404);
  });

  it("flags a low-stock product on the control tower and recommends a reorder quantity", async () => {
    const product = data<Id>(
      await post(tokenAll, "/scm/products", {
        productCode: `LOW-${randomUUID().slice(0, 6)}`,
        name: "Low Stock Widget",
        reorderLevel: 10,
        maximumStock: 50,
      }).expect(201),
    );
    await post(tokenAll, "/scm/inventory/opening-balance", {
      productId: product.id,
      warehouseId: wh.id,
      quantity: 5,
    }).expect(201);

    const exceptions = data<{ type: string }[]>(
      await get(tokenAll, "/scm/advanced/control-tower").expect(200),
    );
    expect(exceptions.some((e) => e.type === "LOW_STOCK")).toBe(true);

    const reorder = data<
      { productId: number; available: number; recommendedQty: number }[]
    >(await get(tokenAll, "/scm/advanced/replenishment").expect(200));
    const row = reorder.find((r) => r.productId === product.id)!;
    expect(row.available).toBe(5);
    expect(row.recommendedQty).toBe(45);
  });

  it("answers common assistant questions from live data", async () => {
    const low = data<{ answer: string }>(
      await post(tokenAll, "/scm/assistant/ask", {
        question: "what is low on stock?",
      }).expect(201),
    );
    expect(low.answer).toMatch(/replenishment|reorder level/i);
    const unknown = data<{ answer: string }>(
      await post(tokenAll, "/scm/assistant/ask", {
        question: "what's the weather",
      }).expect(201),
    );
    expect(unknown.answer).toMatch(/I can help with/);
  });
});
