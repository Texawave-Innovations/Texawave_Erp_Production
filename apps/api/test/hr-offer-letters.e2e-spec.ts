import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Recruitment → Offer Letter (legacy `OfferLetter.tsx`). Org-wide by explicit
 * permission. Covers generation with legacy prefills, the full snapshot, the
 * GENERATED-only status (no status endpoint, Sent/Accepted unreachable), no
 * employee or revision-letter reference, edits, listing, validation, audit
 * (no candidate name or amounts; R4), isolation, persistence and DB constraints.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

interface Offer {
  id: number;
  candidateName: string;
  role: string;
  location: string;
  reportingManager: string;
  offerDate: string;
  joiningDate: string;
  offerValidityDate: string;
  components: { basic: string; da: string; hra: string; ca: string };
  grossMonthly: string;
  grossAnnual: string;
  status: string;
}

const PERMS = [
  "hr.offer_letter.read",
  "hr.offer_letter.write",
  "hr.revision_letter.read.team",
  "hr.revision_letter.write.team",
];

const VALID = {
  candidateName: "Arun Kumar R",
  role: "Senior Software Engineer",
  joiningDate: "2026-11-01",
  basic: 35000,
  da: 15000,
  hra: 30000,
  ca: 20000,
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysUtc(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

describe("HR offer letters (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);

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
          permissionId: perm.get(c) as number,
        })),
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${key}@${org.slug}.test`,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    userIds[key] = user.id;
    return user;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    orgA = await prisma.organization.create({
      data: { name: `Of A ${suffix}`, slug: `of-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Of B ${suffix}`, slug: `of-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }

    await mkUser(orgA, "hrA", [
      "hr.offer_letter.read",
      "hr.offer_letter.write",
    ]);
    await mkUser(orgA, "readerA", ["hr.offer_letter.read"]);
    await mkUser(orgA, "leadA", [
      "hr.revision_letter.read.team",
      "hr.revision_letter.write.team",
    ]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "hr.offer_letter.read",
      "hr.offer_letter.write",
    ]);
  });

  afterAll(async () => {
    await Promise.all(
      Object.values(userIds).flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe("authentication and permissions", () => {
    it("401 without a token", async () => {
      await request(app.getHttpServer()).get("/hr/offer-letters").expect(401);
      await request(app.getHttpServer())
        .post("/hr/offer-letters")
        .send(VALID)
        .expect(401);
    });

    it("403 without the offer permissions, including for a team lead holding only revision-letter permissions", async () => {
      await get("nobody", "/hr/offer-letters").expect(403);
      await post("nobody", "/hr/offer-letters", VALID).expect(403);
      await get("leadA", "/hr/offer-letters").expect(403);
      await post("leadA", "/hr/offer-letters", VALID).expect(403);
    });

    it("403 for a read-only holder trying to generate or edit", async () => {
      await get("readerA", "/hr/offer-letters").expect(200);
      await post("readerA", "/hr/offer-letters", VALID).expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("generating an offer", () => {
    let created: Offer;

    it("201 generates an offer with every legacy prefill and status GENERATED", async () => {
      const r = await post("hrA", "/hr/offer-letters", VALID).expect(201);
      created = (r.body as Body<Offer>).data;
      expect(created).toMatchObject({
        candidateName: "Arun Kumar R",
        role: "Senior Software Engineer",
        location: "Chennai",
        reportingManager: "Mr. Nithyanandan Ramaraj",
        offerDate: todayUtc(),
        joiningDate: "2026-11-01",
        offerValidityDate: plusDaysUtc(7),
        status: "GENERATED",
      });
      expect(created.components).toEqual({
        basic: "35000.00",
        da: "15000.00",
        hra: "30000.00",
        ca: "20000.00",
      });
      expect(created.grossMonthly).toBe("100000.00");
      expect(created.grossAnnual).toBe("1200000.00");
    });

    it("carries the full snapshot: work schedule, signatory and company details", async () => {
      const r = await get("hrA", `/hr/offer-letters/${created.id}`).expect(200);
      const data = (r.body as Body<Record<string, unknown>>).data;
      expect(data).toMatchObject({
        workSchedule: {
          monFri: "10:00 AM – 7:00 PM",
          sat: "10:00 AM – 7:00 PM",
          sun: "Week Off",
        },
        signatoryName: "Amanullah Khan",
        signatoryDesignation: "Co-Founder",
        companyEmail: "contact@texawave.com",
        companyWebsite: "www.texawave.com",
      });
    });

    it("has no employee or revision-letter reference (legacy never saves one)", async () => {
      const r = await get("hrA", `/hr/offer-letters/${created.id}`).expect(200);
      const keys = Object.keys((r.body as Body<Record<string, unknown>>).data);
      expect(keys.some((k) => /employee|revision/i.test(k))).toBe(false);
    });

    it("persists the row in the hr schema for the caller's organization", async () => {
      const row = await prisma.offerLetter.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.organizationId).toBe(orgA.id);
      expect(row.status).toBe("GENERATED");
      expect(row.createdBy).toBe(userIds.hrA);
      expect(row.ca.toFixed(2)).toBe("20000.00");
    });

    it("writes a create audit row with the actor, and no candidate name or salary amount (R4)", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "offer_letter",
          entityId: BigInt(created.id),
          action: "create",
        },
      });
      expect(audit.organizationId).toBe(orgA.id);
      expect(audit.actorUserId).toBe(userIds.hrA);
      expect(audit.after).toMatchObject({
        status: "GENERATED",
        role: "Senior Software Engineer",
      });
      const text = JSON.stringify(audit.after);
      expect(text).not.toContain("Arun");
      expect(text).not.toMatch(/35000|15000|30000|20000/);
    });

    it("honours values the request supplies in place of the prefills", async () => {
      const r = await post("hrA", "/hr/offer-letters", {
        ...VALID,
        location: "Bengaluru",
        offerDate: "2026-10-01",
        offerValidityDate: "2026-10-20",
        companyEmail: "hr@texawave.com",
      }).expect(201);
      expect((r.body as Body<Offer>).data).toMatchObject({
        location: "Bengaluru",
        offerDate: "2026-10-01",
        offerValidityDate: "2026-10-20",
        companyEmail: "hr@texawave.com",
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("validation", () => {
    it.each([
      ["missing candidate", { ...VALID, candidateName: undefined }],
      ["missing role", { ...VALID, role: undefined }],
      ["missing joining date", { ...VALID, joiningDate: undefined }],
      ["impossible joining date", { ...VALID, joiningDate: "2026-02-31" }],
      ["negative basic", { ...VALID, basic: -1 }],
      ["three decimal places", { ...VALID, ca: 1.234 }],
      ["malformed company email", { ...VALID, companyEmail: "not-an-email" }],
      ["client-supplied status", { ...VALID, status: "SENT" }],
      ["client-supplied acceptance", { ...VALID, status: "ACCEPTED" }],
      ["an employee link (not a legacy field)", { ...VALID, employeeId: 1 }],
      [
        "a revision-letter link (not a legacy field)",
        { ...VALID, revisionLetterId: 1 },
      ],
    ])("400 for %s", async (_label, body) => {
      await post("hrA", "/hr/offer-letters", body).expect(400);
    });

    it("a rejected generation writes nothing", async () => {
      const before = await prisma.offerLetter.count({
        where: { organizationId: orgA.id },
      });
      await post("hrA", "/hr/offer-letters", { ...VALID, ca: -5 }).expect(400);
      const after = await prisma.offerLetter.count({
        where: { organizationId: orgA.id },
      });
      expect(after).toBe(before);
    });
  });

  // ---------------------------------------------------------------------------
  describe("editing (legacy overwrites in place) and status", () => {
    let offer: Offer;

    beforeAll(async () => {
      offer = (
        (await post("hrA", "/hr/offer-letters", VALID).expect(
          201,
        )) as unknown as { body: Body<Offer> }
      ).body.data;
    });

    it("200 overwrites the given terms and recalculates gross", async () => {
      const r = await patch("hrA", `/hr/offer-letters/${offer.id}`, {
        role: "Principal Engineer",
        ca: 25000,
      }).expect(200);
      const data = (r.body as Body<Offer>).data;
      expect(data.role).toBe("Principal Engineer");
      expect(data.components.ca).toBe("25000.00");
      expect(data.grossMonthly).toBe("105000.00");
      expect(data.grossAnnual).toBe("1260000.00");
      expect(data.status).toBe("GENERATED");
    });

    it("cannot change the status: the status field is refused and there is no status route", async () => {
      await patch("hrA", `/hr/offer-letters/${offer.id}`, {
        status: "SENT",
      }).expect(400);
      await patch("hrA", `/hr/offer-letters/${offer.id}`, {
        status: "ACCEPTED",
      }).expect(400);
      await request(app.getHttpServer())
        .patch(`/hr/offer-letters/${offer.id}/status`)
        .set(auth("hrA"))
        .send({ status: "SENT" })
        .expect(404);
      const row = await prisma.offerLetter.findUniqueOrThrow({
        where: { id: offer.id },
      });
      expect(row.status).toBe("GENERATED");
    });

    it("writes an update audit row listing the changed field names only (R4)", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "offer_letter",
          entityId: BigInt(offer.id),
          action: "update",
        },
        orderBy: { id: "desc" },
      });
      expect(audit.actorUserId).toBe(userIds.hrA);
      expect(audit.after).toMatchObject({
        changedFields: ["ca", "role"],
        role: "Principal Engineer",
      });
      const text = JSON.stringify([audit.before, audit.after]);
      expect(text).not.toMatch(/20000|25000/);
    });

    it("404 and no change for an offer in another organization", async () => {
      await patch("hrB", `/hr/offer-letters/${offer.id}`, { ca: 1 }).expect(
        404,
      );
      await get("hrB", `/hr/offer-letters/${offer.id}`).expect(404);
      const row = await prisma.offerLetter.findUniqueOrThrow({
        where: { id: offer.id },
      });
      expect(row.ca.toFixed(2)).toBe("25000.00");
    });
  });

  // ---------------------------------------------------------------------------
  describe("listing and isolation", () => {
    let a: Offer;

    beforeAll(async () => {
      a = (
        (await post("hrA", "/hr/offer-letters", {
          ...VALID,
          candidateName: "Meena Iyer",
        }).expect(201)) as unknown as { body: Body<Offer> }
      ).body.data;
    });

    it("lists with pagination metadata and searches candidate or role, case-insensitively", async () => {
      const page = await get("hrA", "/hr/offer-letters?page=1&limit=2").expect(
        200,
      );
      expect((page.body as Body<Offer[]>).meta).toMatchObject({
        page: 1,
        limit: 2,
      });
      const byName = await get(
        "hrA",
        "/hr/offer-letters?search=MEENA&limit=100",
      ).expect(200);
      expect((byName.body as Body<Offer[]>).data.map((o) => o.id)).toContain(
        a.id,
      );
      const byRole = await get(
        "hrA",
        "/hr/offer-letters?search=senior%20soft&limit=100",
      ).expect(200);
      expect((byRole.body as Body<Offer[]>).data.map((o) => o.id)).toContain(
        a.id,
      );
    });

    it("reads one by id; 404 for an unknown id", async () => {
      await get("hrA", `/hr/offer-letters/${a.id}`).expect(200);
      await get("hrA", "/hr/offer-letters/2000000000").expect(404);
    });

    it("another organization sees none of these offers in its list", async () => {
      const list = await get("hrB", "/hr/offer-letters?limit=100").expect(200);
      expect((list.body as Body<Offer[]>).data.map((o) => o.id)).not.toContain(
        a.id,
      );
    });

    it("exposes no delete route", async () => {
      const del = await request(app.getHttpServer())
        .delete(`/hr/offer-letters/${a.id}`)
        .set(auth("hrA"));
      expect([404, 405]).toContain(del.status);
      expect(
        await prisma.offerLetter.findUnique({ where: { id: a.id } }),
      ).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants", () => {
    const row = {
      organizationId: 0,
      candidateName: "x",
      role: "x",
      location: "x",
      reportingManager: "x",
      offerDate: new Date("2026-10-05T00:00:00Z"),
      joiningDate: new Date("2026-11-01T00:00:00Z"),
      offerValidityDate: new Date("2026-10-12T00:00:00Z"),
      basic: 1,
      da: 1,
      hra: 1,
      ca: 1,
      workScheduleMonFri: "x",
      workScheduleSat: "x",
      workScheduleSun: "x",
      signatoryName: "x",
      signatoryDesignation: "x",
      companyEmail: "a@b.co",
      companyPhone: "x",
      companyWebsite: "x",
      companyAddress: "x",
    };

    it("rejects a status other than GENERATED (Sent and Accepted are dead in legacy)", async () => {
      await expect(
        prisma.offerLetter.create({
          data: { ...row, organizationId: orgA.id, status: "SENT" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.offerLetter.create({
          data: { ...row, organizationId: orgA.id, status: "ACCEPTED" },
        }),
      ).rejects.toThrow();
    });

    it("rejects a negative salary component", async () => {
      await expect(
        prisma.offerLetter.create({
          data: { ...row, organizationId: orgA.id, ca: -1 },
        }),
      ).rejects.toThrow();
    });
  });
});
