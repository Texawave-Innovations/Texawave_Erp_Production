import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface SupplierBody {
  id: number;
  supplierCode: string;
  companyName: string;
  status: string;
  gstin: string | null;
  rating: number | null;
  creditLimit: string;
  currency: string;
}

describe("scm suppliers (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenWrite: string;
  let tokenReadOnly: string;
  let tokenNoPermission: string;
  let tokenB: string;

  const base = "/scm/suppliers";
  const valid = {
    companyName: "ABC Suppliers Pvt Ltd",
    contactPerson: "Ravi Kumar",
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
      data: { name: `Org A ${suffix}`, slug: `scm-supplier-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `scm-supplier-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }
    const read = await permission("scm.supplier.read");
    const write = await permission("scm.supplier.write");

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
      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
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
    }

    await makeUser(orgA.id, "write@scm-supplier-org-a.test", [
      read.id,
      write.id,
    ]);
    await makeUser(orgA.id, "read@scm-supplier-org-a.test", [read.id]);
    await makeUser(orgA.id, "none@scm-supplier-org-a.test", []);
    await makeUser(orgB.id, "write@scm-supplier-org-b.test", [
      read.id,
      write.id,
    ]);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenWrite = await login(orgA.slug, "write@scm-supplier-org-a.test");
    tokenReadOnly = await login(orgA.slug, "read@scm-supplier-org-a.test");
    tokenNoPermission = await login(orgA.slug, "none@scm-supplier-org-a.test");
    tokenB = await login(orgB.slug, "write@scm-supplier-org-b.test");
  });

  // Supplier creation writes append-only audit_logs rows, so the test
  // organizations cannot be deleted afterwards (same tradeoff as the CRM
  // suites). Nothing is cleaned up.
  afterAll(async () => {
    await app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const create = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(base).set(auth(token)).send(body);

  it("rejects unauthenticated and no-permission requests", async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer())
      .get(base)
      .set(auth(tokenNoPermission))
      .expect(403);
    await create(tokenNoPermission, valid).expect(403);
  });

  it("read-only users can list but not create, update or preview codes", async () => {
    await request(app.getHttpServer())
      .get(base)
      .set(auth(tokenReadOnly))
      .expect(200);
    await create(tokenReadOnly, valid).expect(403);
    await request(app.getHttpServer())
      .get(`${base}/next-code`)
      .set(auth(tokenReadOnly))
      .expect(403);
  });

  it("creates with defaults and a server-allocated VEND-NNNN code", async () => {
    const res = await create(tokenWrite, valid).expect(201);
    const supplier = (res.body as { data: SupplierBody }).data;
    expect(supplier.supplierCode).toMatch(/^VEND-\d{4}$/);
    expect(supplier.status).toBe("Active");
    expect(supplier.currency).toBe("INR");
    expect(supplier.creditLimit).toBe("0");

    const second = await create(tokenWrite, {
      ...valid,
      companyName: "Second Co",
    }).expect(201);
    const secondCode = (second.body as { data: SupplierBody }).data
      .supplierCode;
    expect(secondCode).not.toBe(supplier.supplierCode);
    expect(Number(secondCode.slice(5))).toBeGreaterThan(
      Number(supplier.supplierCode.slice(5)),
    );
  });

  it("next-code previews the code the next create would take", async () => {
    const preview = await request(app.getHttpServer())
      .get(`${base}/next-code`)
      .set(auth(tokenWrite))
      .expect(200);
    const previewCode = (preview.body as { data: { supplierCode: string } })
      .data.supplierCode;
    const res = await create(tokenWrite, valid).expect(201);
    expect((res.body as { data: SupplierBody }).data.supplierCode).toBe(
      previewCode,
    );
  });

  it("validates required fields and formats (400)", async () => {
    await create(tokenWrite, { contactPerson: "X" }).expect(400);
    await create(tokenWrite, { companyName: "X" }).expect(400);
    await create(tokenWrite, { ...valid, gstin: "NOT-A-GSTIN" }).expect(400);
    await create(tokenWrite, { ...valid, pan: "abc" }).expect(400);
    await create(tokenWrite, { ...valid, currency: "RUPEE" }).expect(400);
    await create(tokenWrite, { ...valid, rating: 6 }).expect(400);
    await create(tokenWrite, { ...valid, rating: 0 }).expect(400);
    await create(tokenWrite, { ...valid, creditLimit: -1 }).expect(400);
    await create(tokenWrite, { ...valid, email: "not-an-email" }).expect(400);
    await create(tokenWrite, { ...valid, status: "Unknown" }).expect(400);
    await create(tokenWrite, { ...valid, surprise: true }).expect(400);
  });

  it("accepts empty optional strings and normalises GSTIN/PAN/currency case", async () => {
    const res = await create(tokenWrite, {
      ...valid,
      companyName: "Case Co",
      gstin: "33aaaaa0000a1z5",
      pan: "abcde1234f",
      currency: "usd",
      email: "",
      phone: "",
      pincode: "",
    }).expect(201);
    const body = (res.body as { data: SupplierBody & { pan: string } }).data;
    expect(body.gstin).toBe("33AAAAA0000A1Z5");
    expect(body.pan).toBe("ABCDE1234F");
    expect(body.currency).toBe("USD");
  });

  it("rejects a duplicate supplier code and a duplicate GSTIN (409)", async () => {
    await create(tokenWrite, {
      ...valid,
      companyName: "Dup Code A",
      supplierCode: "dup-001",
    }).expect(201);
    await create(tokenWrite, {
      ...valid,
      companyName: "Dup Code B",
      supplierCode: "DUP-001",
    }).expect(409);

    await create(tokenWrite, {
      ...valid,
      companyName: "Dup Gst A",
      gstin: "27BBBBB1111B1Z6",
    }).expect(201);
    await create(tokenWrite, {
      ...valid,
      companyName: "Dup Gst B",
      gstin: "27BBBBB1111B1Z6",
    }).expect(409);
  });

  it("allows the same code in two organizations", async () => {
    await create(tokenWrite, {
      ...valid,
      companyName: "Cross Org A",
      supplierCode: "CROSS-001",
    }).expect(201);
    await create(tokenB, {
      ...valid,
      companyName: "Cross Org B",
      supplierCode: "CROSS-001",
    }).expect(201);
  });

  it("reads, updates, clears a rating, and records activity", async () => {
    const created = await create(tokenWrite, {
      ...valid,
      companyName: "Lifecycle Co",
      rating: 4,
    }).expect(201);
    const { id } = (created.body as { data: SupplierBody }).data;

    const patched = await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth(tokenWrite))
      .send({ companyName: "Lifecycle Renamed", rating: null })
      .expect(200);
    const updated = (patched.body as { data: SupplierBody }).data;
    expect(updated.companyName).toBe("Lifecycle Renamed");
    expect(updated.rating).toBeNull();

    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth(tokenWrite))
      .send({ status: "Inactive" })
      .expect(200);

    const activity = await request(app.getHttpServer())
      .get(`${base}/${id}/activity`)
      .set(auth(tokenReadOnly))
      .expect(200);
    const actions = (
      activity.body as { data: { action: string; byName: string | null }[] }
    ).data.map((a) => a.action);
    expect(actions).toEqual(["status_change", "update", "create"]);
  });

  it("filters by search text, status and type, and lists distinct types", async () => {
    await create(tokenWrite, {
      ...valid,
      companyName: "Filterable Widgets",
      type: "Distributor",
      status: "Pending Approval",
      supplierCode: "FILT-001",
    }).expect(201);

    const bySearch = await request(app.getHttpServer())
      .get(`${base}?q=filt-001`)
      .set(auth(tokenWrite))
      .expect(200);
    expect(
      (bySearch.body as { data: SupplierBody[] }).data.map(
        (s) => s.companyName,
      ),
    ).toEqual(["Filterable Widgets"]);

    const byStatus = await request(app.getHttpServer())
      .get(`${base}?status=Pending%20Approval&type=Distributor`)
      .set(auth(tokenWrite))
      .expect(200);
    expect((byStatus.body as { data: SupplierBody[] }).data).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`${base}?status=Nope`)
      .set(auth(tokenWrite))
      .expect(400);

    const types = await request(app.getHttpServer())
      .get(`${base}/types`)
      .set(auth(tokenWrite))
      .expect(200);
    expect((types.body as { data: string[] }).data).toContain("Distributor");
  });

  it("isolates tenants: another organization gets 404 and sees none of the rows", async () => {
    const created = await create(tokenWrite, {
      ...valid,
      companyName: "Org A Only",
    }).expect(201);
    const { id } = (created.body as { data: SupplierBody }).data;

    await request(app.getHttpServer())
      .get(`${base}/${id}`)
      .set(auth(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth(tokenB))
      .send({ companyName: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .get(`${base}/${id}/activity`)
      .set(auth(tokenB))
      .expect(404);

    const listB = await request(app.getHttpServer())
      .get(base)
      .set(auth(tokenB))
      .expect(200);
    expect(
      (listB.body as { data: SupplierBody[] }).data.some((s) => s.id === id),
    ).toBe(false);
  });

  it("enforces the (organization, code) unique index at the database level", async () => {
    const created = await create(tokenWrite, {
      ...valid,
      companyName: "Index Co",
      supplierCode: "IDX-001",
    }).expect(201);
    const { id } = (created.body as { data: SupplierBody }).data;
    await expect(
      prisma.supplier.create({
        data: {
          organizationId: orgA.id,
          supplierCode: "IDX-001",
          companyName: "Raw Insert",
          contactPerson: "X",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(id).toBeGreaterThan(0);
  });
});
