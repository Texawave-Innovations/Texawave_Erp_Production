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
 * Recruitment → Promotion Letter. Same rules as revision letters (issue, list,
 * read, edit; defaults; per-FY numbering; own/team/all scope; cross-org
 * isolation; R4 audit) plus the two promotion-specific behaviours: the
 * designation comes from the designations master, and an employee's salary
 * history merges revisions (only with the revision read permission) and
 * promotions.
 */
interface Body<T> {
  data: T;
  meta?: { total: number };
}

interface Letter {
  id: number;
  documentNo: string;
  employee: { id: number };
  employeeName: string;
  designationId: number;
  designation: string;
  previousDesignation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: { basic: string; da: string; hra: string; ca: string };
  grossMonthly: string;
  grossAnnual: string;
  status: string;
}

interface History {
  employee: { id: number; currentDesignation: string };
  revisionsIncluded: boolean;
  entries: Array<{
    kind: "REVISION" | "PROMOTION";
    documentNo: string;
    designation: string;
    previousDesignation: string | null;
    effectiveDate: string;
    grossMonthly: string;
  }>;
}

const PERMS = [
  "hr.promotion_letter.read.own",
  "hr.promotion_letter.read.team",
  "hr.promotion_letter.read.all",
  "hr.promotion_letter.write.own",
  "hr.promotion_letter.write.team",
  "hr.promotion_letter.write.all",
  "hr.revision_letter.read.all",
];

const DOC_NO = /^TW\/HR\/PRO\/\d{2}-\d{2}\/\d{3,}$/;

describe("HR promotion letters (e2e)", () => {
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

  let team1: number;
  let team2: number;
  let teamB: number;
  const emp = { a1: 0, a2: 0, b1: 0 };
  const desig = { general: 0, lead: 0, inactive: 0, otherOrg: 0 };

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;

  const issue = (who: string, employeeId: number, over: object = {}) =>
    post(who, "/hr/promotion-letters", {
      employeeId,
      designationId: desig.lead,
      basic: 40000,
      da: 15000,
      hra: 30000,
      ca: 20000,
      ...over,
    });

  async function mkDesignation(
    orgId: number,
    code: string,
    name: string,
    isActive = true,
  ) {
    return (
      await prisma.designation.upsert({
        where: { organizationId_code: { organizationId: orgId, code } },
        update: {},
        create: { organizationId: orgId, code, name, isActive },
      })
    ).id;
  }

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    opts: { teamIds?: number[] } = {},
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
    for (const teamId of opts.teamIds ?? []) {
      await prisma.userTeamAccess.create({
        data: { organizationId: org.id, userId: user.id, teamId },
      });
    }
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
  }

  async function mkEmployee(orgId: number, teamId: number, n: number) {
    const designationId = await mkDesignation(orgId, "GEN", "General");
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: orgId, code: "PERM" } },
      update: {},
      create: { organizationId: orgId, code: "PERM", name: "Permanent" },
    });
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-7${String(n).padStart(5, "0")}`,
          fullName: `Promoted ${n}`,
          teamId,
          designationId,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      })
    ).id;
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
      data: { name: `Pr A ${suffix}`, slug: `pr-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Pr B ${suffix}`, slug: `pr-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team1 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T1", code: `T1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T2", code: `T2${suffix}` },
      })
    ).id;
    teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `TB${suffix}` },
      })
    ).id;

    emp.a1 = await mkEmployee(orgA.id, team1, 1);
    emp.a2 = await mkEmployee(orgA.id, team2, 2);
    emp.b1 = await mkEmployee(orgB.id, teamB, 3);

    desig.general = await mkDesignation(orgA.id, "GEN", "General");
    desig.lead = await mkDesignation(orgA.id, "TL", "Team Lead");
    desig.inactive = await mkDesignation(orgA.id, "OLD", "Retired", false);
    desig.otherOrg = await mkDesignation(orgB.id, "TLB", "Team Lead B");

    await mkUser(orgA, "hrAll", [
      "hr.promotion_letter.read.all",
      "hr.promotion_letter.write.all",
      "hr.revision_letter.read.all",
    ]);
    await mkUser(orgA, "promoOnly", [
      "hr.promotion_letter.read.all",
      "hr.promotion_letter.write.all",
    ]);
    await mkUser(
      orgA,
      "leadT1",
      ["hr.promotion_letter.read.team", "hr.promotion_letter.write.team"],
      { teamIds: [team1] },
    );
    await mkUser(orgA, "writerOwn", ["hr.promotion_letter.write.own"]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrAllB", [
      "hr.promotion_letter.read.all",
      "hr.promotion_letter.write.all",
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

  describe("authentication and permissions", () => {
    it("401 without a token", async () => {
      await request(app.getHttpServer())
        .get("/hr/promotion-letters")
        .expect(401);
    });

    it("403 without any promotion-letter permission", async () => {
      await get("nobody", "/hr/promotion-letters").expect(403);
      await issue("nobody", emp.a1).expect(403);
      await get(
        "nobody",
        `/hr/promotion-letters/salary-history/${emp.a1}`,
      ).expect(403);
    });

    it("403 for a write.own holder (write.own is reserved)", async () => {
      await issue("writerOwn", emp.a1).expect(403);
    });
  });

  describe("issuing", () => {
    it("snapshots employee, previous and new designation, numbers the document, derives gross", async () => {
      const res = await issue("hrAll", emp.a1).expect(201);
      const letter = (res.body as Body<Letter>).data;
      expect(letter.documentNo).toMatch(DOC_NO);
      expect(letter.employeeName).toBe("Promoted 1");
      expect(letter.previousDesignation).toBe("General");
      expect(letter.designationId).toBe(desig.lead);
      expect(letter.designation).toBe("Team Lead");
      expect(letter.location).toBe("Chennai");
      expect(letter.status).toBe("GENERATED");
      expect(letter.grossMonthly).toBe("105000.00");
      expect(letter.grossAnnual).toBe("1260000.00");

      // Issuing does not change the employee's stored designation.
      const employee = await prisma.employee.findUniqueOrThrow({
        where: { id: emp.a1 },
      });
      expect(employee.designationId).toBe(desig.general);
    });

    it("issues distinct numbers under concurrency", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => issue("hrAll", emp.a2)),
      );
      const numbers = results.map(
        (r) => (r.body as Body<Letter>).data.documentNo,
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(numbers).size).toBe(5);
    });

    it.each([
      ["an inactive designation", () => desig.inactive],
      ["another organization's designation", () => desig.otherOrg],
      ["an unknown designation", () => 2_000_000_000],
    ])("422 INVALID_DESIGNATION for %s", async (_label, id) => {
      const res = await issue("hrAll", emp.a1, { designationId: id() });
      expect(res.status).toBe(422);
      expect(errorOf(res)).toBe("INVALID_DESIGNATION");
    });

    it("400 without a designationId, or with free-text designation", async () => {
      await post("hrAll", "/hr/promotion-letters", {
        employeeId: emp.a1,
      }).expect(400);
      await issue("hrAll", emp.a1, { designation: "Boss" }).expect(400);
    });

    it("422 INVALID_EMPLOYEE outside the caller's team or organization", async () => {
      const otherTeam = await issue("leadT1", emp.a2);
      expect(otherTeam.status).toBe(422);
      expect(errorOf(otherTeam)).toBe("INVALID_EMPLOYEE");
      const otherOrg = await issue("hrAll", emp.b1);
      expect(errorOf(otherOrg)).toBe("INVALID_EMPLOYEE");
    });
  });

  describe("reading and editing", () => {
    it("team scope sees only its team's letters; other orgs see nothing", async () => {
      const team = await get(
        "leadT1",
        "/hr/promotion-letters?limit=100",
      ).expect(200);
      const rows = (team.body as Body<Letter[]>).data;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((l) => l.employee.id === emp.a1)).toBe(true);

      const b = await get("hrAllB", "/hr/promotion-letters").expect(200);
      expect((b.body as Body<Letter[]>).data).toHaveLength(0);
    });

    it("404 for a letter outside scope", async () => {
      const created = await issue("hrAll", emp.a2).expect(201);
      const id = (created.body as Body<Letter>).data.id;
      await get("leadT1", `/hr/promotion-letters/${id}`).expect(404);
      await patch("leadT1", `/hr/promotion-letters/${id}`, {
        location: "Pune",
      }).expect(404);
      await get("hrAllB", `/hr/promotion-letters/${id}`).expect(404);
    });

    it("changing designationId re-snapshots the name; previous designation and number never change", async () => {
      const created = (
        (await issue("hrAll", emp.a1).expect(201)).body as Body<Letter>
      ).data;
      const res = await patch("hrAll", `/hr/promotion-letters/${created.id}`, {
        designationId: desig.general,
        basic: 50000,
      }).expect(200);
      const after = (res.body as Body<Letter>).data;
      expect(after.designation).toBe("General");
      expect(after.previousDesignation).toBe(created.previousDesignation);
      expect(after.documentNo).toBe(created.documentNo);
      expect(after.components.basic).toBe("50000.00");

      await patch("hrAll", `/hr/promotion-letters/${created.id}`, {
        employeeId: emp.a2,
      }).expect(400);
      const bad = await patch("hrAll", `/hr/promotion-letters/${created.id}`, {
        designationId: desig.inactive,
      });
      expect(errorOf(bad)).toBe("INVALID_DESIGNATION");
    });

    it("audits without salary amounts (R4)", async () => {
      const created = (
        (await issue("hrAll", emp.a1).expect(201)).body as Body<Letter>
      ).data;
      await patch("hrAll", `/hr/promotion-letters/${created.id}`, {
        hra: 31000,
      }).expect(200);
      const rows = await prisma.auditLog.findMany({
        where: { entityType: "promotion_letter", entityId: BigInt(created.id) },
      });
      expect(rows.map((r) => r.action).sort()).toEqual(["create", "update"]);
      const text = JSON.stringify(rows.map((r) => [r.before, r.after]));
      expect(text).not.toMatch(/31000|30000|40000/);
      expect(text).toContain('"hra"');
    });
  });

  describe("salary history", () => {
    beforeAll(async () => {
      await prisma.revisionLetter.create({
        data: {
          organizationId: orgA.id,
          employeeId: emp.a1,
          documentNo: `TW/HR/REV/TEST/${suffix}`,
          employeeName: "Promoted 1",
          designation: "General",
          location: "Chennai",
          letterDate: new Date("2025-03-15T00:00:00Z"),
          effectiveDate: new Date("2025-04-01T00:00:00Z"),
          basic: "30000",
          da: "10000",
          hra: "20000",
          ca: "10000",
          signatoryName: "S",
          signatoryDesignation: "D",
        },
      });
    });

    it("merges revisions and promotions, newest effective date first", async () => {
      const res = await get(
        "hrAll",
        `/hr/promotion-letters/salary-history/${emp.a1}`,
      ).expect(200);
      const history = (res.body as Body<History>).data;
      expect(history.employee.currentDesignation).toBe("General");
      expect(history.revisionsIncluded).toBe(true);
      const kinds = history.entries.map((e) => e.kind);
      expect(kinds).toContain("REVISION");
      expect(kinds).toContain("PROMOTION");
      const dates = history.entries.map((e) => e.effectiveDate);
      expect([...dates].sort().reverse()).toEqual(dates);
      const revision = history.entries.find((e) => e.kind === "REVISION");
      expect(revision?.grossMonthly).toBe("70000.00");
      expect(revision?.previousDesignation).toBeNull();
    });

    it("leaves revisions out without the revision read permission", async () => {
      const res = await get(
        "promoOnly",
        `/hr/promotion-letters/salary-history/${emp.a1}`,
      ).expect(200);
      const history = (res.body as Body<History>).data;
      expect(history.revisionsIncluded).toBe(false);
      expect(history.entries.every((e) => e.kind === "PROMOTION")).toBe(true);
    });

    it("404 for an employee outside scope", async () => {
      await get(
        "leadT1",
        `/hr/promotion-letters/salary-history/${emp.a2}`,
      ).expect(404);
      await get(
        "hrAllB",
        `/hr/promotion-letters/salary-history/${emp.a1}`,
      ).expect(404);
    });
  });

  it("the database rejects negative components and unknown statuses", async () => {
    const base = {
      organizationId: orgA.id,
      employeeId: emp.a1,
      designationId: desig.lead,
      employeeName: "x",
      previousDesignation: "x",
      designation: "x",
      location: "x",
      letterDate: new Date("2026-01-01T00:00:00Z"),
      effectiveDate: new Date("2026-01-01T00:00:00Z"),
      basic: "0",
      da: "0",
      hra: "0",
      ca: "0",
      signatoryName: "x",
      signatoryDesignation: "x",
    };
    await expect(
      prisma.promotionLetter.create({
        data: { ...base, documentNo: `NEG-${suffix}`, basic: "-1" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.promotionLetter.create({
        data: { ...base, documentNo: `ST-${suffix}`, status: "SENT" },
      }),
    ).rejects.toThrow();
  });
});
