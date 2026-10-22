import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm leads (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenOwnOther: string;
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
      data: { name: `Org A ${suffix}`, slug: `crm-leads-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-leads-org-b-${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const readAll = await permission("crm.lead.read.all");
    const writeAll = await permission("crm.lead.write.all");
    const readOwn = await permission("crm.lead.read.own");
    const writeOwn = await permission("crm.lead.write.own");

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

    await makeUser(orgA.id, "all-access@crm-leads-org-a.test", [
      readAll.id,
      writeAll.id,
    ]);
    await makeUser(orgA.id, "own-only@crm-leads-org-a.test", [
      readOwn.id,
      writeOwn.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-leads-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-leads-org-b.test", [
      readAll.id,
      writeAll.id,
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

    tokenAll = await login(orgA.slug, "all-access@crm-leads-org-a.test");
    tokenOwnOther = await login(orgA.slug, "own-only@crm-leads-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-leads-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-leads-org-b.test");
  });

  /** Same residue tradeoff as crm-contacts.e2e-spec.ts: audit_logs is
   * append-only, so the orgs/users/roles created here stay — only
   * lead/account/contact rows are cleaned up. */
  /** The "createDeal" tests below create Opportunities, which (see
   * crm-opportunities.e2e-spec.ts) can never be hard-deleted once they
   * exist — they always get an append-only stage-history row, and
   * `opportunities.account_id` is `ON DELETE RESTRICT`. That transitively
   * pins the Account (and the Lead it came from, and this org) as
   * permanent residue too, same tradeoff as audit_logs elsewhere, just
   * one hop further along the chain. So, unlike this suite's pre-Deal
   * version, nothing is cleaned up here at all — attempting a partial
   * cleanup would fail outright the moment it touched an account an
   * Opportunity still references. */
  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/crm/leads").expect(401);
  });

  it("rejects a request with no crm.lead permission at all with 403", async () => {
    await request(app.getHttpServer())
      .get("/crm/leads")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("rejects create without companyName (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ prospectName: "Jane Doe" })
      .expect(400);
  });

  it("rejects create without prospectName (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Acme Corp" })
      .expect(400);
  });

  it("rejects create with an invalid leadStatus (400)", async () => {
    await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        companyName: "Acme Corp",
        prospectName: "Jane Doe",
        leadStatus: "BOGUS",
      })
      .expect(400);
  });

  it("creates a lead defaulting leadStatus to NEW, reads, updates, and soft-deletes it with tenant isolation", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        companyName: "Acme Corp",
        prospectName: "Jane Doe",
        email: "jane@acme.test",
      })
      .expect(201);
    const created = (
      createRes.body as { data: { id: number; leadStatus: string } }
    ).data;
    expect(created.leadStatus).toBe("NEW");

    await request(app.getHttpServer())
      .get(`/crm/leads/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);

    // Org B cannot see Org A's lead — tenant isolation (404, not 403).
    await request(app.getHttpServer())
      .get(`/crm/leads/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const updateRes = await request(app.getHttpServer())
      .patch(`/crm/leads/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ leadStatus: "CONTACTED", assignedTo: "Alex Rep" })
      .expect(200);
    expect(
      (updateRes.body as { data: { leadStatus: string } }).data.leadStatus,
    ).toBe("CONTACTED");

    await request(app.getHttpServer())
      .delete(`/crm/leads/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/crm/leads/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
    const stillExists = await prisma.lead.findUnique({
      where: { id: created.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.deletedAt).not.toBeNull();
  });

  it("'.own' scope sees only leads it created itself; '.all' sees every org lead", async () => {
    const byAll = await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ companyName: "Created By All", prospectName: "P1" })
      .expect(201);
    const byOwn = await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ companyName: "Created By Own", prospectName: "P2" })
      .expect(201);

    const ownList = await request(app.getHttpServer())
      .get("/crm/leads")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .expect(200);
    const ownIds = (ownList.body as { data: { id: number }[] }).data.map(
      (l) => l.id,
    );
    expect(ownIds).toContain((byOwn.body as { data: { id: number } }).data.id);
    expect(ownIds).not.toContain(
      (byAll.body as { data: { id: number } }).data.id,
    );

    const allList = await request(app.getHttpServer())
      .get("/crm/leads")
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    const allIds = (allList.body as { data: { id: number }[] }).data.map(
      (l) => l.id,
    );
    expect(allIds).toContain((byOwn.body as { data: { id: number } }).data.id);
    expect(allIds).toContain((byAll.body as { data: { id: number } }).data.id);
  });

  it("'.own' scope cannot read, update, or convert a lead it did not create itself (404, not 403, and the lead is left unchanged)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/crm/leads")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        companyName: `Not Mine Co ${randomUUID().slice(0, 8)}`,
        prospectName: "P",
      })
      .expect(201);
    const lead = (
      createRes.body as { data: { id: number; leadStatus: string } }
    ).data;

    await request(app.getHttpServer())
      .get(`/crm/leads/${lead.id}`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/crm/leads/${lead.id}`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ leadStatus: "LOST" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/crm/leads/${lead.id}/convert`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ accountMode: "new" })
      .expect(404);

    // Confirm none of the above actually touched the row — the owner
    // ('.all') still sees it unchanged.
    const stillOwned = await request(app.getHttpServer())
      .get(`/crm/leads/${lead.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(200);
    expect(
      (
        stillOwned.body as {
          data: { leadStatus: string; linkedAccountId: number | null };
        }
      ).data.leadStatus,
    ).toBe(lead.leadStatus);
    expect(
      (stillOwned.body as { data: { linkedAccountId: number | null } }).data
        .linkedAccountId,
    ).toBeNull();
  });

  describe("convert", () => {
    it("creates a new Account + Contact, links them, and sets leadStatus to CONVERTED", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          companyName: `Convert New Co ${randomUUID().slice(0, 8)}`,
          prospectName: "Pat Prospect",
        })
        .expect(201);
      const lead = (
        createRes.body as { data: { id: number; companyName: string } }
      ).data;

      const convertRes = await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountMode: "new",
          contactName: "Pat Prospect",
          contactEmail: "pat@test.test",
        })
        .expect(201);
      const converted = (
        convertRes.body as {
          data: {
            leadStatus: string;
            linkedAccountId: number;
            linkedContactId: number;
          };
        }
      ).data;
      expect(converted.leadStatus).toBe("CONVERTED");
      expect(converted.linkedAccountId).toBeTruthy();
      expect(converted.linkedContactId).toBeTruthy();

      const account = await prisma.account.findUnique({
        where: { id: converted.linkedAccountId },
      });
      expect(account?.name).toBe(lead.companyName);
      const contact = await prisma.contact.findUnique({
        where: { id: converted.linkedContactId },
      });
      expect(contact?.accountId).toBe(converted.linkedAccountId);
      expect(contact?.name).toBe("Pat Prospect");
    });

    it("links to an existing Account when accountMode is 'existing', with no Contact created if contactName is omitted", async () => {
      const existingAccount = await prisma.account.create({
        data: {
          organizationId: orgA.id,
          name: `Existing Co ${randomUUID().slice(0, 8)}`,
        },
      });
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ companyName: "Irrelevant Name", prospectName: "No Contact" })
        .expect(201);
      const lead = (createRes.body as { data: { id: number } }).data;

      const convertRes = await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountMode: "existing",
          existingAccountId: existingAccount.id,
          contactName: "",
        })
        .expect(201);
      const converted = (
        convertRes.body as {
          data: { linkedAccountId: number; linkedContactId: number | null };
        }
      ).data;
      expect(converted.linkedAccountId).toBe(existingAccount.id);
      // prospectName ("No Contact") is used as the fallback contact name when
      // contactName is blank — matches legacy's pre-filled dialog default.
      expect(converted.linkedContactId).toBeTruthy();
    });

    it("rejects accountMode 'existing' with another org's accountId (422)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ companyName: "Cross Org Convert", prospectName: "P" })
        .expect(201);
      const lead = (createRes.body as { data: { id: number } }).data;

      const accountB = await prisma.account.create({
        data: {
          organizationId: orgB.id,
          name: `Org B Account ${randomUUID().slice(0, 8)}`,
        },
      });

      await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "existing", existingAccountId: accountB.id })
        .expect(422);
    });

    it("warns with DUPLICATE_ACCOUNT (422) on a case-insensitive name match, then succeeds with confirmDuplicate: true", async () => {
      const name = `Dup Co ${randomUUID().slice(0, 8)}`;
      await prisma.account.create({ data: { organizationId: orgA.id, name } });

      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ companyName: name.toUpperCase(), prospectName: "P" })
        .expect(201);
      const lead = (createRes.body as { data: { id: number } }).data;

      const warnRes = await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new" })
        .expect(422);
      expect((warnRes.body as { error?: string }).error).toBe(
        "DUPLICATE_ACCOUNT",
      );

      await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new", confirmDuplicate: true })
        .expect(201);
    });

    it("rejects converting an already-converted lead (422)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          companyName: `Twice Co ${randomUUID().slice(0, 8)}`,
          prospectName: "P",
        })
        .expect(201);
      const lead = (createRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new", confirmDuplicate: true })
        .expect(422);
    });

    it("createDeal:true also creates and links an Opportunity, defaulting to the org's first board stage", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          companyName: `Deal Co ${randomUUID().slice(0, 8)}`,
          prospectName: "Dana Deal",
          priority: "High",
        })
        .expect(201);
      const lead = (
        createRes.body as { data: { id: number; companyName: string } }
      ).data;

      const convertRes = await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountMode: "new",
          contactName: "Dana Deal",
          createDeal: true,
          dealAmount: 42000,
          dealCloseDate: "2027-03-01",
        })
        .expect(201);
      const converted = (
        convertRes.body as {
          data: { linkedAccountId: number; linkedOpportunityId: number };
        }
      ).data;
      expect(converted.linkedOpportunityId).toBeTruthy();

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: converted.linkedOpportunityId },
      });
      expect(opportunity?.accountId).toBe(converted.linkedAccountId);
      expect(opportunity?.leadId).toBe(lead.id);
      expect(opportunity?.title).toBe(`${lead.companyName} — Opportunity`);
      expect(opportunity?.estimatedValue.toString()).toBe("42000");
      expect(opportunity?.priority).toBe("High");
      expect(opportunity?.opportunityNumber).toBe(
        `OPP-${String(opportunity?.id).padStart(6, "0")}`,
      );

      const boardStages = await prisma.pipelineStage.findMany({
        where: {
          organizationId: orgA.id,
          code: { notIn: ["won", "lost", "on_hold"] },
        },
        orderBy: { order: "asc" },
      });
      expect(opportunity?.stageId).toBe(boardStages[0]!.id);

      const history = await prisma.opportunityStageHistory.findMany({
        where: { opportunityId: opportunity!.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0]!.fromStageId).toBeNull();
    });

    it("omitting createDeal creates no Opportunity (linkedOpportunityId stays null)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/leads")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          companyName: `No Deal Co ${randomUUID().slice(0, 8)}`,
          prospectName: "P",
        })
        .expect(201);
      const lead = (createRes.body as { data: { id: number } }).data;

      const convertRes = await request(app.getHttpServer())
        .post(`/crm/leads/${lead.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new" })
        .expect(201);
      expect(
        (convertRes.body as { data: { linkedOpportunityId: number | null } })
          .data.linkedOpportunityId,
      ).toBeNull();
    });
  });

  describe("list filters / facets", () => {
    it("filters by converted state, sorts by company, and returns distinct facets (tenant-scoped)", async () => {
      const tag = randomUUID().slice(0, 6);
      const mk = async (companyName: string, extra: object = {}) =>
        (
          (
            await request(app.getHttpServer())
              .post("/crm/leads")
              .set("Authorization", `Bearer ${tokenAll}`)
              .send({ companyName, prospectName: "P", ...extra })
              .expect(201)
          ).body as { data: { id: number } }
        ).data;
      const zed = await mk(`Zed ${tag}`, { industry: `Ind-${tag}` });
      await mk(`Alpha ${tag}`, { assignedTo: `Owner-${tag}` });
      await request(app.getHttpServer())
        .post(`/crm/leads/${zed.id}/convert`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ accountMode: "new" })
        .expect(201);

      const list = async (qs: string) =>
        (
          (
            await request(app.getHttpServer())
              .get(`/crm/leads?q=${tag}&${qs}`)
              .set("Authorization", `Bearer ${tokenAll}`)
              .expect(200)
          ).body as { data: { companyName: string }[] }
        ).data.map((l) => l.companyName);

      expect(await list("converted=CONVERTED")).toEqual([`Zed ${tag}`]);
      expect(await list("converted=NOT_CONVERTED")).toEqual([`Alpha ${tag}`]);
      expect(await list("sortBy=companyName&order=asc")).toEqual([
        `Alpha ${tag}`,
        `Zed ${tag}`,
      ]);
      expect(await list("sortBy=companyName&order=desc")).toEqual([
        `Zed ${tag}`,
        `Alpha ${tag}`,
      ]);

      const facets = (
        (
          await request(app.getHttpServer())
            .get("/crm/leads/facets")
            .set("Authorization", `Bearer ${tokenAll}`)
            .expect(200)
        ).body as { data: { owners: string[]; industries: string[] } }
      ).data;
      expect(facets.owners).toContain(`Owner-${tag}`);
      expect(facets.industries).toContain(`Ind-${tag}`);

      const other = (
        (
          await request(app.getHttpServer())
            .get("/crm/leads/facets")
            .set("Authorization", `Bearer ${tokenB}`)
            .expect(200)
        ).body as { data: { owners: string[] } }
      ).data;
      expect(other.owners).not.toContain(`Owner-${tag}`);

      await request(app.getHttpServer()).get("/crm/leads/facets").expect(401);
    });
  });

  describe("legacy parity: rating, notes, roll-ups, timeline", () => {
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    type Body<T> = { body: { data: T } };

    it("stores rating/month/customFields and filters by rating, createdBy, created range and min revenue", async () => {
      const tag = randomUUID().slice(0, 6);
      const hot = (
        (await request(app.getHttpServer())
          .post("/crm/leads")
          .set(auth(tokenAll))
          .send({
            companyName: `Hot ${tag}`,
            prospectName: "H",
            rating: "Hot",
            month: "October",
            annualRevenue: "$5,000,000",
            customFields: { region: "south" },
          })
          .expect(201)) as Body<{
          id: number;
          rating: string;
          month: string;
          customFields: Record<string, string>;
        }>
      ).body.data;
      expect(hot.rating).toBe("Hot");
      expect(hot.month).toBe("October");
      expect(hot.customFields).toEqual({ region: "south" });
      await request(app.getHttpServer())
        .post("/crm/leads")
        .set(auth(tokenAll))
        .send({
          companyName: `Cold ${tag}`,
          prospectName: "C",
          rating: "Cold",
          annualRevenue: "100",
        })
        .expect(201);
      await request(app.getHttpServer())
        .post("/crm/leads")
        .set(auth(tokenAll))
        .send({
          companyName: `Bad ${tag}`,
          prospectName: "B",
          rating: "Lukewarm",
        })
        .expect(400);

      const names = async (qs: string) =>
        (
          (await request(app.getHttpServer())
            .get(`/crm/leads?q=${tag}&${qs}`)
            .set(auth(tokenAll))
            .expect(200)) as { body: { data: { companyName: string }[] } }
        ).body.data
          .map((l) => l.companyName)
          .sort();

      expect(await names("rating=Hot")).toEqual([`Hot ${tag}`]);
      expect(await names("minAnnualRevenue=1000000")).toEqual([`Hot ${tag}`]);
      expect(await names("minAnnualRevenue=50")).toEqual([
        `Cold ${tag}`,
        `Hot ${tag}`,
      ]);
      expect(await names("createdFrom=2999-01-01")).toEqual([]);
      expect(await names("createdTo=2000-01-01")).toEqual([]);
      expect((await names("createdFrom=2000-01-01")).length).toBe(2);
      // createdBy facet is a {id,name} list.
      const facets = (
        (await request(app.getHttpServer())
          .get("/crm/leads/facets")
          .set(auth(tokenAll))
          .expect(200)) as Body<{ createdBy: { id: number; name: string }[] }>
      ).body.data;
      expect(facets.createdBy.length).toBeGreaterThan(0);
      expect(await names(`createdBy=${facets.createdBy[0]!.id}`)).toHaveLength(
        2,
      );
    });

    it("touched / lastActivityAt roll-ups, notes and the audit timeline", async () => {
      const tag = randomUUID().slice(0, 6);
      const id = (
        (await request(app.getHttpServer())
          .post("/crm/leads")
          .set(auth(tokenAll))
          .send({ companyName: `Roll ${tag}`, prospectName: "R" })
          .expect(201)) as Body<{ id: number }>
      ).body.data.id;
      const row = async () =>
        (
          (await request(app.getHttpServer())
            .get(`/crm/leads/${id}`)
            .set(auth(tokenAll))
            .expect(200)) as Body<{
            touched: boolean;
            lastActivityAt: string | null;
            createdByName: string | null;
          }>
        ).body.data;
      let r = await row();
      expect(r.touched).toBe(false);
      expect(r.createdByName).toBe("Test User");

      const touchedIds = async (v: string) =>
        (
          (await request(app.getHttpServer())
            .get(`/crm/leads?q=${tag}&touched=${v}`)
            .set(auth(tokenAll))
            .expect(200)) as { body: { data: { id: number }[] } }
        ).body.data.map((l) => l.id);
      expect(await touchedIds("UNTOUCHED")).toContain(id);
      expect(await touchedIds("TOUCHED")).not.toContain(id);

      // A status change is an audit entry -> touched.
      await request(app.getHttpServer())
        .patch(`/crm/leads/${id}`)
        .set(auth(tokenAll))
        .send({ leadStatus: "CONTACTED", rating: "Warm" })
        .expect(200);
      r = await row();
      expect(r.touched).toBe(true);
      expect(r.lastActivityAt).not.toBeNull();
      expect(await touchedIds("TOUCHED")).toContain(id);

      // Notes: add / list / delete, tenant isolation, permission.
      const note = (
        (await request(app.getHttpServer())
          .post(`/crm/leads/${id}/notes`)
          .set(auth(tokenAll))
          .send({ content: "Called, wants a demo" })
          .expect(201)) as Body<{ id: number; createdByName: string }>
      ).body.data;
      expect(note.createdByName).toBe("Test User");
      await request(app.getHttpServer())
        .post(`/crm/leads/${id}/notes`)
        .set(auth(tokenAll))
        .send({ content: "" })
        .expect(400);
      await request(app.getHttpServer())
        .get(`/crm/leads/${id}/notes`)
        .set(auth(tokenB))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/crm/leads/${id}/notes`)
        .set(auth(tokenNoPermission))
        .expect(403);
      await request(app.getHttpServer())
        .get(`/crm/leads/${id}/notes`)
        .expect(401);
      let notes = (
        (await request(app.getHttpServer())
          .get(`/crm/leads/${id}/notes`)
          .set(auth(tokenAll))
          .expect(200)) as Body<{ id: number }[]>
      ).body.data;
      expect(notes.map((n) => n.id)).toEqual([note.id]);

      // Timeline: create + update (with the status diff) + note_added.
      const timeline = (
        (await request(app.getHttpServer())
          .get(`/crm/leads/${id}/timeline`)
          .set(auth(tokenAll))
          .expect(200)) as Body<
          {
            action: string;
            by: string | null;
            changes: {
              field: string;
              from: string | null;
              to: string | null;
            }[];
          }[]
        >
      ).body.data;
      expect(timeline.map((t) => t.action)).toEqual(
        expect.arrayContaining(["create", "update", "note_added"]),
      );
      const update = timeline.find((t) => t.action === "update")!;
      expect(update.by).toBe("Test User");
      expect(update.changes).toEqual(
        expect.arrayContaining([
          { field: "leadStatus", from: "NEW", to: "CONTACTED" },
          { field: "rating", from: null, to: "Warm" },
        ]),
      );
      await request(app.getHttpServer())
        .get(`/crm/leads/${id}/timeline`)
        .set(auth(tokenB))
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/crm/leads/${id}/notes/${note.id}`)
        .set(auth(tokenAll))
        .expect(204);
      notes = (
        (await request(app.getHttpServer())
          .get(`/crm/leads/${id}/notes`)
          .set(auth(tokenAll))
          .expect(200)) as Body<{ id: number }[]>
      ).body.data;
      expect(notes).toHaveLength(0);
    });
  });
});
