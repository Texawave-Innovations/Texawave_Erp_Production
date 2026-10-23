import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface SearchBody {
  data: {
    query: string;
    searchedKinds: string[];
    results: {
      id: string;
      kind: string;
      recordId: number;
      title: string;
      href: string | null;
    }[];
  };
}

/** Global CRM search (legacy intelligence/CrmSearch.tsx). Covers auth
 * rejection, per-entity read-permission filtering, own/team/all scope applied
 * by the owning service, tenant isolation and the legacy match fields. */
describe("crm global search (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAll: string;
  let tokenAccountsOnly: string;
  let tokenOwnContacts: string;
  let tokenNoPermission: string;
  let tokenNoSearchPerm: string;
  let tokenB: string;
  let ownUserId: number;
  const suffix = randomUUID().slice(0, 8);
  const needle = `zqx${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `crm-search-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-search-b-${suffix}` },
    });

    const ids = new Map<string, number>();
    async function perm(code: string) {
      const cached = ids.get(code);
      if (cached) return cached;
      const row = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      ids.set(code, row.id);
      return row.id;
    }
    async function makeUser(orgId: number, email: string, codes: string[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      const permissionIds = await Promise.all(codes.map(perm));
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      const user = await prisma.user.create({
        data: { organizationId: orgId, email, passwordHash, fullName: "Test" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

    const readAll = [
      "crm.search.read",
      "crm.account.read",
      "crm.contact.read.all",
      "crm.opportunity.read.all",
      "crm.meeting.read",
      "crm.followup.read",
      "crm.lead.read.all",
      "crm.coldcalling.read",
      "crm.miningrow.read",
    ];
    await makeUser(orgA.id, "all@crm-search-a.test", readAll);
    await makeUser(orgA.id, "accounts@crm-search-a.test", [
      "crm.search.read",
      "crm.account.read",
    ]);
    const own = await makeUser(orgA.id, "own@crm-search-a.test", [
      "crm.search.read",
      "crm.contact.read.own",
    ]);
    ownUserId = own.id;
    await makeUser(orgA.id, "none@crm-search-a.test", []);
    await makeUser(orgA.id, "nosearch@crm-search-a.test", ["crm.account.read"]);
    await makeUser(orgB.id, "all@crm-search-b.test", readAll);

    async function login(slug: string, email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }
    tokenAll = await login(orgA.slug, "all@crm-search-a.test");
    tokenAccountsOnly = await login(orgA.slug, "accounts@crm-search-a.test");
    tokenOwnContacts = await login(orgA.slug, "own@crm-search-a.test");
    tokenNoPermission = await login(orgA.slug, "none@crm-search-a.test");
    tokenNoSearchPerm = await login(orgA.slug, "nosearch@crm-search-a.test");
    tokenB = await login(orgB.slug, "all@crm-search-b.test");

    // ---- seed org A
    const account = await prisma.account.create({
      data: {
        organizationId: orgA.id,
        name: `Acme ${needle} Industries`,
        ownerName: "Olivia Owner",
      },
    });
    await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        name: `Cara ${needle}`,
        email: `cara@${needle}.test`,
        createdBy: ownUserId,
      },
    });
    await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        name: `Other ${needle}`,
        createdBy: null,
      },
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        organizationId: orgA.id,
        code: `s${suffix}`,
        label: "Stage",
        order: 1,
      },
    });
    await prisma.opportunity.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        title: `Deal ${needle}`,
        ownerName: "Olivia Owner",
        opportunityNumber: `OPP-${suffix}`,
        stageId: stage.id,
      },
    });
    await prisma.crmMeeting.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        mode: "Online",
        meetingDate: new Date("2030-01-15"),
        agenda: `Kickoff ${needle}`,
      },
    });
    // Matched only through the account's name (legacy behaviour).
    await prisma.crmFollowUp.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        type: "Call",
        scheduledAt: new Date("2030-01-16T10:00:00Z"),
        assignedTo: "Sam",
      },
    });
    await prisma.lead.create({
      data: {
        organizationId: orgA.id,
        companyName: `Lead Co ${needle}`,
        prospectName: "Pat Prospect",
        email: `pat@${needle}.test`,
      },
    });
    await prisma.crmColdCallingEntry.create({
      data: { organizationId: orgA.id, companyName: `Cold ${needle}` },
    });
    await prisma.crmMiningRow.create({
      data: { organizationId: orgA.id, companyName: `Mined ${needle}` },
    });
    // ---- same needle in org B (must never leak)
    await prisma.account.create({
      data: { organizationId: orgB.id, name: `Beta ${needle} Ltd` },
    });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.crmMeeting.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmFollowUp.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmColdCallingEntry.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.crmMiningRow.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.opportunity.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.pipelineStage.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.lead.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.contact.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await app.close();
  });

  function search(token: string, q: string) {
    return request(app.getHttpServer())
      .get("/crm/search")
      .query({ q })
      .set("Authorization", `Bearer ${token}`);
  }
  const kinds = (b: SearchBody) => b.data.results.map((r) => r.kind);

  it("rejects unauthenticated, unauthorized and non-search users", async () => {
    await request(app.getHttpServer()).get("/crm/search").expect(401);
    await search(tokenNoPermission, needle).expect(403);
    await search(tokenNoSearchPerm, needle).expect(403);
  });

  it("returns an empty result set for a blank query", async () => {
    const res = await search(tokenAll, "   ").expect(200);
    const body = res.body as SearchBody;
    expect(body.data.results).toEqual([]);
    expect(body.data.searchedKinds).toContain("Account");
  });

  it("finds every entity kind the caller may read, with page links", async () => {
    const res = await search(tokenAll, needle).expect(200);
    const body = res.body as SearchBody;
    expect(new Set(kinds(body))).toEqual(
      new Set([
        "Account",
        "Contact",
        "Opportunity",
        "Meeting",
        "Follow-up",
        "Lead",
        "Cold Calling",
        "Mining",
      ]),
    );
    const account = body.data.results.find((r) => r.kind === "Account");
    expect(account?.href).toBe(`/crm/accounts/${account?.recordId}`);
    const contact = body.data.results.find((r) => r.kind === "Contact");
    expect(contact?.href).toMatch(/^\/crm\/accounts\/\d+$/);
    const lead = body.data.results.find((r) => r.kind === "Lead");
    expect(lead?.href).toBe(`/crm/leads/${lead?.recordId}`);
    // The follow-up has no needle of its own: matched via the account name.
    expect(kinds(body)).toContain("Follow-up");
  });

  it("matches case-insensitively and by opportunity number", async () => {
    const res = await search(tokenAll, `opp-${suffix}`.toUpperCase()).expect(
      200,
    );
    expect(kinds(res.body as SearchBody)).toEqual(["Opportunity"]);
  });

  it("only searches entity types the caller may read", async () => {
    const res = await search(tokenAccountsOnly, needle).expect(200);
    const body = res.body as SearchBody;
    expect(body.data.searchedKinds).toEqual(["Account"]);
    // Meetings/follow-ups are not readable, so no leakage through account names.
    expect(new Set(kinds(body))).toEqual(new Set(["Account"]));
  });

  it("applies the owning service's own scope (contact.read.own)", async () => {
    const res = await search(tokenOwnContacts, needle).expect(200);
    const body = res.body as SearchBody;
    expect(body.data.searchedKinds).toEqual(["Contact"]);
    const contacts = body.data.results.filter((r) => r.kind === "Contact");
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.title).toBe(`Cara ${needle}`);
  });

  it("is tenant isolated", async () => {
    const res = await search(tokenB, needle).expect(200);
    const body = res.body as SearchBody;
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]?.title).toBe(`Beta ${needle} Ltd`);
  });
});
