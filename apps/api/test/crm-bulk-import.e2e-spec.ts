import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface CommitBody {
  data: {
    summary: {
      totalRows: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
      valid: number;
      duplicates: number;
    };
    rows: {
      rowNumber: number;
      status: string;
      id?: number;
      errors: string[];
    }[];
    newCustomFields: string[];
  };
}

/** CRM Bulk Import / Export (legacy bulkImport/* + importExport/*): client
 * posts mapped JSON rows; the API re-validates, detects duplicates, applies
 * skip/update/create, auto-creates custom field defs and commits through the
 * owning modules' services. */
describe("crm bulk import / export (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenNoPermission: string;
  let tokenImportOnly: string;
  let tokenExportNoEntityRead: string;
  let tokenB: string;
  const server = () => app.getHttpServer();

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
      data: { name: `Org A ${suffix}`, slug: `crm-bi-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-bi-org-b-${suffix}` },
    });

    const perm = (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const importWrite = await perm("crm.import.write");
    const exportRead = await perm("crm.export.read");
    const ccRead = await perm("crm.coldcalling.read");
    const ccWrite = await perm("crm.coldcalling.write");
    const accRead = await perm("crm.account.read");
    const accWrite = await perm("crm.account.write");
    const oppRead = await perm("crm.opportunity.read.all");
    const oppWrite = await perm("crm.opportunity.write.all");
    const contactRead = await perm("crm.contact.read.all");

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
        data: { organizationId: orgId, email, passwordHash, fullName: "T" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    const all = [
      importWrite.id,
      exportRead.id,
      ccRead.id,
      ccWrite.id,
      accRead.id,
      accWrite.id,
      oppRead.id,
      oppWrite.id,
      contactRead.id,
    ];
    await makeUser(orgA.id, "all@crm-bi-a.test", all);
    await makeUser(orgA.id, "none@crm-bi-a.test", []);
    // import.write alone: lacks the target entity's write permission.
    await makeUser(orgA.id, "import-only@crm-bi-a.test", [importWrite.id]);
    // export.read alone: lacks the entity's read permission.
    await makeUser(orgA.id, "export-only@crm-bi-a.test", [exportRead.id]);
    await makeUser(orgB.id, "all@crm-bi-b.test", all);

    async function login(slug: string, email: string): Promise<string> {
      const res = await request(server())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    }
    tokenAll = await login(orgA.slug, "all@crm-bi-a.test");
    tokenNoPermission = await login(orgA.slug, "none@crm-bi-a.test");
    tokenImportOnly = await login(orgA.slug, "import-only@crm-bi-a.test");
    tokenExportNoEntityRead = await login(
      orgA.slug,
      "export-only@crm-bi-a.test",
    );
    tokenB = await login(orgB.slug, "all@crm-bi-b.test");
  });

  afterAll(async () => {
    const orgIds = { in: [orgA.id, orgB.id] };
    await prisma.crmColdCallingEntry.deleteMany({
      where: { organizationId: orgIds },
    });
    await prisma.crmCustomFieldDef.deleteMany({
      where: { organizationId: orgIds },
    });
    // Imported deals pin their account (append-only stage history, RESTRICT FK).
    await prisma.account
      .deleteMany({ where: { organizationId: orgIds } })
      .catch(() => undefined);
    await app.close();
  });

  const commit = (token: string, entity: string, body: object) =>
    request(server())
      .post(`/crm/import/${entity}/commit`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  describe("permission gating", () => {
    it("rejects unauthenticated requests with 401", async () => {
      await request(server())
        .post("/crm/import/accounts/commit")
        .send({})
        .expect(401);
      await request(server()).get("/crm/import/accounts/export").expect(401);
      await request(server()).get("/crm/custom-fields").expect(401);
    });

    it("requires crm.import.write / crm.export.read", async () => {
      const body = {
        strategy: "skip",
        rows: [{ rowNumber: 1, values: { name: "X" } }],
      };
      await commit(tokenNoPermission, "accounts", body).expect(403);
      await request(server())
        .get("/crm/import/accounts/fields")
        .set("Authorization", `Bearer ${tokenNoPermission}`)
        .expect(403);
      await request(server())
        .post("/crm/import/accounts/match-headers")
        .set("Authorization", `Bearer ${tokenNoPermission}`)
        .send({ headers: ["Name"] })
        .expect(403);
      await request(server())
        .get("/crm/import/accounts/export")
        .set("Authorization", `Bearer ${tokenNoPermission}`)
        .expect(403);
    });

    it("also requires the target entity's write permission", async () => {
      const res = await commit(tokenImportOnly, "accounts", {
        strategy: "skip",
        rows: [{ rowNumber: 1, values: { name: "Perm Gate Co" } }],
      }).expect(403);
      expect(JSON.stringify(res.body)).toContain("crm.account.write");
      expect(
        await prisma.account.count({
          where: { organizationId: orgA.id, name: "Perm Gate Co" },
        }),
      ).toBe(0);
    });

    it("also requires the entity's read permission to export", async () => {
      await request(server())
        .get("/crm/import/accounts/export")
        .set("Authorization", `Bearer ${tokenExportNoEntityRead}`)
        .expect(403);
    });

    it("returns 404 for an unknown entity", async () => {
      await commit(tokenAll, "no-such-entity", {
        strategy: "skip",
        rows: [{ rowNumber: 1, values: {} }],
      }).expect(404);
    });
  });

  describe("request validation", () => {
    it("caps rows per request", async () => {
      const rows = Array.from({ length: 201 }, (_, i) => ({
        rowNumber: i + 1,
        values: { name: `Cap ${i}` },
      }));
      await commit(tokenAll, "accounts", { strategy: "skip", rows }).expect(
        400,
      );
    });

    it("rejects an empty batch and an unknown strategy", async () => {
      await commit(tokenAll, "accounts", { strategy: "skip", rows: [] }).expect(
        400,
      );
      await commit(tokenAll, "accounts", {
        strategy: "merge",
        rows: [{ rowNumber: 1, values: {} }],
      }).expect(400);
    });
  });

  describe("header matching", () => {
    it("matches exact and alias headers only", async () => {
      const res = await request(server())
        .post("/crm/import/cold-calling/match-headers")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ headers: ["SINO", "Name of the Company", "Title", "Mystery"] })
        .expect(200);
      expect(
        (res.body as { data: { mapping: (string | null)[] } }).data.mapping,
      ).toEqual(["serialNo", "companyName", "designation", null]);
    });
  });

  describe("per-row validation report", () => {
    it("reports valid and invalid rows; a dry run writes nothing", async () => {
      const rows = [
        { rowNumber: 1, values: { name: "Valid Co One" } },
        { rowNumber: 2, values: {} },
        { rowNumber: 3, values: { name: "Bad Type Co", accountType: "Zzz" } },
        { rowNumber: 4, values: { name: "Bad Mail Co", email: "nope" } },
      ];
      const dry = (
        await commit(tokenAll, "accounts", {
          strategy: "skip",
          dryRun: true,
          rows,
        }).expect(200)
      ).body as CommitBody;
      expect(dry.data.rows.map((r) => r.status)).toEqual([
        "valid",
        "invalid",
        "invalid",
        "invalid",
      ]);
      expect(dry.data.rows[1]?.errors[0]).toContain("Missing required field");
      expect(dry.data.summary).toMatchObject({ valid: 1, failed: 3 });
      expect(
        await prisma.account.count({
          where: { organizationId: orgA.id, name: "Valid Co One" },
        }),
      ).toBe(0);

      const real = (
        await commit(tokenAll, "accounts", { strategy: "skip", rows }).expect(
          200,
        )
      ).body as CommitBody;
      expect(real.data.summary).toMatchObject({
        totalRows: 4,
        created: 1,
        failed: 3,
      });
      expect(
        await prisma.account.count({
          where: { organizationId: orgA.id, name: "Valid Co One" },
        }),
      ).toBe(1);
    });
  });

  describe("duplicate strategies (cold calling: company + prospect + date)", () => {
    const row = (extra: Record<string, string> = {}) => ({
      rowNumber: 1,
      values: {
        companyName: "Dup Strategy Co",
        prospectName: "Pat",
        callDate: "2026-03-05",
        ...extra,
      },
    });
    const count = () =>
      prisma.crmColdCallingEntry.count({
        where: {
          organizationId: orgA.id,
          companyName: "Dup Strategy Co",
          deletedAt: null,
        },
      });

    it("create / skip / update / create-anyway", async () => {
      const first = (
        await commit(tokenAll, "cold-calling", {
          strategy: "skip",
          rows: [row({ status: "Interested" })],
        }).expect(200)
      ).body as CommitBody;
      expect(first.data.summary.created).toBe(1);
      expect(await count()).toBe(1);

      const dry = (
        await commit(tokenAll, "cold-calling", {
          strategy: "skip",
          dryRun: true,
          rows: [row()],
        }).expect(200)
      ).body as CommitBody;
      expect(dry.data.rows[0]?.status).toBe("duplicate");
      expect(dry.data.summary.duplicates).toBe(1);

      const skipped = (
        await commit(tokenAll, "cold-calling", {
          strategy: "skip",
          rows: [row({ status: "Changed" })],
        }).expect(200)
      ).body as CommitBody;
      expect(skipped.data.summary).toMatchObject({ skipped: 1, created: 0 });
      expect(await count()).toBe(1);

      const updated = (
        await commit(tokenAll, "cold-calling", {
          strategy: "update",
          rows: [row({ status: "Updated Status" })],
        }).expect(200)
      ).body as CommitBody;
      expect(updated.data.summary).toMatchObject({ updated: 1, created: 0 });
      expect(await count()).toBe(1);
      const stored = await prisma.crmColdCallingEntry.findFirst({
        where: { organizationId: orgA.id, companyName: "Dup Strategy Co" },
      });
      expect(stored?.status).toBe("Updated Status");

      const created = (
        await commit(tokenAll, "cold-calling", {
          strategy: "create",
          rows: [row()],
        }).expect(200)
      ).body as CommitBody;
      expect(created.data.summary.created).toBe(1);
      expect(await count()).toBe(2);
    });
  });

  describe("custom fields", () => {
    const customRow = (value: string, header = "Region / Zone") => ({
      rowNumber: 1,
      values: { companyName: "Custom Field Co", prospectName: value },
      custom: { [header]: value },
    });

    it("auto-creates an idempotent definition and stores the value", async () => {
      const first = (
        await commit(tokenAll, "cold-calling", {
          strategy: "create",
          rows: [customRow("North")],
        }).expect(200)
      ).body as CommitBody;
      expect(first.data.newCustomFields).toEqual(["Region / Zone"]);
      const id = first.data.rows[0]?.id as number;
      const stored = await prisma.crmColdCallingEntry.findUnique({
        where: { id },
      });
      expect(stored?.customFields).toEqual({ regionZone: "North" });

      // Same header again (and a differently-spaced spelling of it): no new def.
      const again = (
        await commit(tokenAll, "cold-calling", {
          strategy: "create",
          rows: [
            customRow("South"),
            { ...customRow("East", "region  zone"), rowNumber: 2 },
          ],
        }).expect(200)
      ).body as CommitBody;
      expect(again.data.newCustomFields).toEqual([]);
      expect(
        await prisma.crmCustomFieldDef.count({
          where: { organizationId: orgA.id, module: "coldCalling" },
        }),
      ).toBe(1);

      const list = await request(server())
        .get("/crm/custom-fields?module=coldCalling")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const defs = (list.body as { data: { key: string; label: string }[] })
        .data;
      expect(defs).toHaveLength(1);
      expect(defs[0]).toMatchObject({ key: "regionZone" });
    });

    it("a dry run creates no definitions", async () => {
      await commit(tokenAll, "cold-calling", {
        strategy: "create",
        dryRun: true,
        rows: [customRow("West", "Brand New Column")],
      }).expect(200);
      expect(
        await prisma.crmCustomFieldDef.count({
          where: { organizationId: orgA.id, label: "Brand New Column" },
        }),
      ).toBe(0);
    });

    it("validates the module query", async () => {
      await request(server())
        .get("/crm/custom-fields?module=bogus")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(400);
    });
  });

  describe("export", () => {
    it("exports rows with custom columns", async () => {
      const res = await request(server())
        .get("/crm/import/cold-calling/export")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const data = (
        res.body as {
          data: {
            columns: { key: string; label: string }[];
            rows: Record<string, string | number>[];
            total: number;
          };
        }
      ).data;
      expect(data.total).toBeGreaterThan(0);
      expect(data.columns.map((c) => c.key)).toContain("custom:regionZone");
      expect(data.rows.some((r) => r["custom:regionZone"] === "North")).toBe(
        true,
      );
    });

    it("can leave custom columns out", async () => {
      const res = await request(server())
        .get("/crm/import/cold-calling/export?includeCustomFields=false")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect(
        JSON.stringify(
          (res.body as { data: { columns: unknown } }).data.columns,
        ),
      ).not.toContain("custom:");
    });
  });

  describe("tenant isolation", () => {
    it("org B sees none of org A's custom fields, rows or duplicates", async () => {
      const defs = await request(server())
        .get("/crm/custom-fields")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((defs.body as { data: unknown[] }).data).toEqual([]);

      const exp = await request(server())
        .get("/crm/import/cold-calling/export")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((exp.body as { data: { total: number } }).data.total).toBe(0);

      // Same keys as org A's existing row: not a duplicate for org B.
      const res = (
        await commit(tokenB, "cold-calling", {
          strategy: "skip",
          rows: [
            {
              rowNumber: 1,
              values: {
                companyName: "Dup Strategy Co",
                prospectName: "Pat",
                callDate: "2026-03-05",
              },
            },
          ],
        }).expect(200)
      ).body as CommitBody;
      expect(res.data.summary).toMatchObject({ created: 1, skipped: 0 });
      expect(
        await prisma.crmColdCallingEntry.count({
          where: { organizationId: orgB.id },
        }),
      ).toBe(1);
      // ...and org A's rows are untouched by it.
      expect(
        await prisma.crmColdCallingEntry.count({
          where: {
            organizationId: orgA.id,
            companyName: "Dup Strategy Co",
            deletedAt: null,
          },
        }),
      ).toBe(2);
    });
  });

  describe("accounts HQ field", () => {
    it("imports HQ, round-trips it through export", async () => {
      const tag = randomUUID().slice(0, 6);
      const res = (
        await commit(tokenAll, "accounts", {
          strategy: "skip",
          rows: [
            { rowNumber: 1, values: { name: `HQ Co ${tag}`, hq: "Chennai" } },
          ],
        }).expect(200)
      ).body as CommitBody;
      expect(res.data.summary).toMatchObject({ created: 1, failed: 0 });
      const row = await prisma.account.findFirst({
        where: { organizationId: orgA.id, name: `HQ Co ${tag}` },
      });
      expect(row?.hq).toBe("Chennai");
      const exp = await request(server())
        .get("/crm/import/accounts/export?search=" + tag)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const out = (
        exp.body as { data: { rows: Record<string, string | number>[] } }
      ).data;
      expect(out.rows[0]).toMatchObject({ hq: "Chennai" });
    });
  });

  describe("opportunities (Pipeline import / export)", () => {
    it("imports deals into the first stage, resolves the account, detects duplicates and exports them", async () => {
      const tag = randomUUID().slice(0, 6);
      await commit(tokenAll, "accounts", {
        strategy: "skip",
        rows: [{ rowNumber: 1, values: { name: `Deal Co ${tag}` } }],
      }).expect(200);
      const row = (n: number, over: Record<string, string> = {}) => ({
        rowNumber: n,
        values: {
          title: `Big deal ${tag}`,
          accountName: `Deal Co ${tag}`,
          ownerName: "Rep",
          estimatedValue: "₹1,50,000",
          forecastCategory: "Commit",
          ...over,
        },
      });

      // Dry run + validation errors.
      const dry = (
        await commit(tokenAll, "opportunities", {
          strategy: "skip",
          dryRun: true,
          rows: [
            row(1),
            row(2, { accountName: "Nope Inc" }),
            row(3, { forecastCategory: "Maybe" }),
          ],
        }).expect(200)
      ).body as CommitBody;
      expect(dry.data.rows.map((r) => r.status)).toEqual([
        "valid",
        "invalid",
        "invalid",
      ]);

      const first = (
        await commit(tokenAll, "opportunities", {
          strategy: "skip",
          rows: [row(1)],
        }).expect(200)
      ).body as CommitBody;
      expect(first.data.summary).toMatchObject({ created: 1 });
      const stored = await prisma.opportunity.findFirstOrThrow({
        where: { organizationId: orgA.id, title: `Big deal ${tag}` },
      });
      expect(stored.status).toBe("OPEN");
      expect(stored.forecastCategory).toBe("Commit");
      expect(Number(stored.estimatedValue)).toBe(150000);

      const again = (
        await commit(tokenAll, "opportunities", {
          strategy: "skip",
          rows: [row(1)],
        }).expect(200)
      ).body as CommitBody;
      expect(again.data.summary).toMatchObject({ skipped: 1, created: 0 });

      const exp = await request(server())
        .get("/crm/import/opportunities/export?search=" + tag)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const exported = (
        exp.body as {
          data: { rows: Record<string, string | number>[]; total: number };
        }
      ).data;
      expect(exported.total).toBe(1);
      expect(exported.rows[0]).toMatchObject({
        title: `Big deal ${tag}`,
        accountName: `Deal Co ${tag}`,
        forecastCategory: "Commit",
      });

      // Other tenant sees nothing.
      const other = await request(server())
        .get("/crm/import/opportunities/export?search=" + tag)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((other.body as { data: { total: number } }).data.total).toBe(0);
      // Import needs the deal write permission.
      await commit(tokenImportOnly, "opportunities", {
        strategy: "skip",
        rows: [row(1)],
      }).expect(403);
    });
  });
});
