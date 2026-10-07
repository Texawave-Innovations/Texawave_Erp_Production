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
 * Recruitment → Revision Letter (legacy `RevisionLetter.tsx`). Covers issue,
 * list, read and edit; the legacy defaults; document numbering under
 * concurrency; own/team/all scope; cross-organization isolation; validation;
 * audit rows; and database-level invariants. There is no delete and no
 * approval workflow: legacy has neither, and neither is asserted here.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

interface Letter {
  id: number;
  documentNo: string;
  employee: { id: number; employeeCode: string; fullName: string };
  employeeName: string;
  designation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: { basic: string; da: string; hra: string; ca: string };
  grossMonthly: string;
  grossAnnual: string;
  signatoryName: string;
  signatoryDesignation: string;
  status: string;
}

const PERMS = [
  "hr.revision_letter.read.own",
  "hr.revision_letter.read.team",
  "hr.revision_letter.read.all",
  "hr.revision_letter.write.own",
  "hr.revision_letter.write.team",
  "hr.revision_letter.write.all",
];

/** First day of next month (UTC), as the default effective date. */
function expectedDefaultEffective(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

const DOC_NO = /^TW\/HR\/REV\/\d{2}-\d{2}\/\d{3,}$/;

describe("HR revision letters (e2e)", () => {
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
    post(who, "/hr/revision-letters", {
      employeeId,
      designation: "Senior Software Engineer",
      basic: 35000,
      da: 15000,
      hra: 30000,
      ca: 20000,
      ...over,
    });

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
    return user;
  }

  async function mkEmployee(orgId: number, teamId: number, n: number) {
    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: orgId, code: "GEN" } },
      update: {},
      create: { organizationId: orgId, code: "GEN", name: "General" },
    });
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: orgId, code: "PERM" } },
      update: {},
      create: { organizationId: orgId, code: "PERM", name: "Permanent" },
    });
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-8${String(n).padStart(5, "0")}`,
          fullName: `Revised ${n}`,
          teamId,
          designationId: designation.id,
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
      data: { name: `Rv A ${suffix}`, slug: `rv-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Rv B ${suffix}`, slug: `rv-b-${suffix.toLowerCase()}` },
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

    await mkUser(orgA, "hrAll", [
      "hr.revision_letter.read.all",
      "hr.revision_letter.write.all",
    ]);
    await mkUser(
      orgA,
      "leadT1",
      ["hr.revision_letter.read.team", "hr.revision_letter.write.team"],
      { teamIds: [team1] },
    );
    await mkUser(orgA, "writerOwn", ["hr.revision_letter.write.own"]);
    await mkUser(orgA, "readerOwn", ["hr.revision_letter.read.own"]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrAllB", [
      "hr.revision_letter.read.all",
      "hr.revision_letter.write.all",
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
      await request(app.getHttpServer())
        .get("/hr/revision-letters")
        .expect(401);
      await request(app.getHttpServer())
        .post("/hr/revision-letters")
        .send({})
        .expect(401);
    });

    it("403 without any revision-letter permission", async () => {
      await get("nobody", "/hr/revision-letters").expect(403);
      await issue("nobody", emp.a1).expect(403);
    });

    it("403 for a read-only holder trying to issue or edit", async () => {
      await issue("readerOwn", emp.a1).expect(403);
    });

    it("403 for an own-level writer: writing is reserved, never granted to self", async () => {
      await issue("writerOwn", emp.a1).expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("issuing a letter", () => {
    let letter: Letter;

    it("201 issues a letter with legacy defaults and a server-issued document number", async () => {
      const r = await issue("hrAll", emp.a1).expect(201);
      letter = (r.body as Body<Letter>).data;

      expect(letter.documentNo).toMatch(DOC_NO);
      expect(letter.employee).toMatchObject({
        id: emp.a1,
        fullName: "Revised 1",
      });
      expect(letter.employeeName).toBe("Revised 1");
      expect(letter.designation).toBe("Senior Software Engineer");
      expect(letter.location).toBe("Chennai");
      expect(letter.effectiveDate).toBe(expectedDefaultEffective());
      expect(letter.signatoryName).toBe("Amanullah Khan");
      expect(letter.signatoryDesignation).toBe("Co-Founder");
      expect(letter.components).toEqual({
        basic: "35000.00",
        da: "15000.00",
        hra: "30000.00",
        ca: "20000.00",
      });
      expect(letter.grossMonthly).toBe("100000.00");
      expect(letter.grossAnnual).toBe("1200000.00");
      expect(letter.status).toBe("GENERATED");
    });

    it("persists the row, in the hr schema, for the caller's organization", async () => {
      const row = await prisma.revisionLetter.findUniqueOrThrow({
        where: { id: letter.id },
      });
      expect(row.organizationId).toBe(orgA.id);
      expect(row.employeeId).toBe(emp.a1);
      expect(row.documentNo).toBe(letter.documentNo);
      expect(row.basic.toFixed(2)).toBe("35000.00");
      expect(row.status).toBe("GENERATED");
    });

    it("writes an audit row for the create, with the actor and organization", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "revision_letter",
          entityId: BigInt(letter.id),
          action: "create",
        },
      });
      expect(audit.organizationId).toBe(orgA.id);
      expect(audit.actorUserId).toBe(userIds.hrAll);
      expect(audit.actorType).toBe("user");
      expect(audit.after).toMatchObject({
        employeeId: emp.a1,
        documentNo: letter.documentNo,
        status: "GENERATED",
      });
      // R4: salary amounts never reach the audit trail.
      expect(JSON.stringify(audit.after)).not.toMatch(
        /35000|15000|30000|20000/,
      );
    });

    it("honours values the request supplies in place of the defaults", async () => {
      const r = await issue("hrAll", emp.a1, {
        location: "Bengaluru",
        letterDate: "2026-09-30",
        effectiveDate: "2026-10-15",
        signatoryName: "Other Signatory",
        signatoryDesignation: "Director",
      }).expect(201);
      const data = (r.body as Body<Letter>).data;
      expect(data).toMatchObject({
        location: "Bengaluru",
        letterDate: "2026-09-30",
        effectiveDate: "2026-10-15",
        signatoryName: "Other Signatory",
        signatoryDesignation: "Director",
      });
    });

    it("issues sequential numbers under concurrent creation, with no duplicate or gap", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => issue("hrAll", emp.a1).expect(201)),
      );
      const numbers = results.map(
        (r) => (r.body as Body<Letter>).data.documentNo,
      );
      expect(new Set(numbers).size).toBe(numbers.length);

      const prefix = numbers[0]!.slice(0, numbers[0]!.lastIndexOf("/") + 1);
      const seqs = numbers
        .map((n) => Number(n.slice(prefix.length)))
        .sort((x, y) => x - y);
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]).toBe(seqs[i - 1]! + 1);
      }
    });

    it("422 INVALID_EMPLOYEE for an employee that does not exist", async () => {
      const r = await issue("hrAll", 2_000_000_000).expect(422);
      expect(errorOf(r)).toBe("INVALID_EMPLOYEE");
    });

    it("422 INVALID_EMPLOYEE for another organization's employee: indistinguishable from absent", async () => {
      const r = await issue("hrAll", emp.b1).expect(422);
      expect(errorOf(r)).toBe("INVALID_EMPLOYEE");
      const leaked = await prisma.revisionLetter.count({
        where: { organizationId: orgA.id, employeeId: emp.b1 },
      });
      expect(leaked).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("validation", () => {
    // Each case is a complete request body; nothing is overridden afterwards.
    const valid = () => ({
      employeeId: emp.a1,
      designation: "Engineer",
      basic: 1000,
    });
    it.each([
      ["missing designation", { ...valid(), designation: undefined }],
      ["missing employeeId", { ...valid(), employeeId: undefined }],
      ["employeeId not an integer", { ...valid(), employeeId: "x" }],
      ["employeeId zero", { ...valid(), employeeId: 0 }],
      ["negative basic", { ...valid(), basic: -1 }],
      ["three decimal places", { ...valid(), ca: 1.234 }],
      ["impossible date", { ...valid(), letterDate: "2026-13-01" }],
      [
        "unknown field: a client-supplied document number",
        { ...valid(), documentNo: "X" },
      ],
      [
        "unknown field: a client-supplied employee name",
        { ...valid(), employeeName: "Spoof" },
      ],
      [
        "unknown field: a client-supplied status",
        { ...valid(), status: "SENT" },
      ],
    ])("400 for %s", async (_label, body) => {
      await post("hrAll", "/hr/revision-letters", body).expect(400);
    });

    it("400 when the component value would overflow DECIMAL(12,2)", async () => {
      await issue("hrAll", emp.a1, { basic: 10_000_000_000 }).expect(400);
    });

    it("a rejected request writes nothing", async () => {
      const before = await prisma.revisionLetter.count({
        where: { organizationId: orgA.id },
      });
      await issue("hrAll", emp.a1, { ca: -5 }).expect(400);
      const after = await prisma.revisionLetter.count({
        where: { organizationId: orgA.id },
      });
      expect(after).toBe(before);
    });
  });

  // ---------------------------------------------------------------------------
  describe("reading and scope", () => {
    let a1Letter: Letter;
    let a2Letter: Letter;

    beforeAll(async () => {
      a1Letter = (
        (await issue("hrAll", emp.a1).expect(201)).body as Body<Letter>
      ).data;
      a2Letter = (
        (await issue("hrAll", emp.a2).expect(201)).body as Body<Letter>
      ).data;
    });

    it("all: sees letters for every team, reads one by id", async () => {
      const list = await get("hrAll", "/hr/revision-letters?limit=100").expect(
        200,
      );
      const ids = (list.body as Body<Letter[]>).data.map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining([a1Letter.id, a2Letter.id]));
      const one = await get(
        "hrAll",
        `/hr/revision-letters/${a2Letter.id}`,
      ).expect(200);
      expect((one.body as Body<Letter>).data.documentNo).toBe(
        a2Letter.documentNo,
      );
    });

    it("team: sees only its own team's letters; another team's is 404, not 403", async () => {
      const list = await get("leadT1", "/hr/revision-letters?limit=100").expect(
        200,
      );
      const ids = (list.body as Body<Letter[]>).data.map((l) => l.id);
      expect(ids).toContain(a1Letter.id);
      expect(ids).not.toContain(a2Letter.id);
      await get("leadT1", `/hr/revision-letters/${a2Letter.id}`).expect(404);
    });

    it("team: cannot issue or edit for an employee outside the team (422 / 404)", async () => {
      const r = await issue("leadT1", emp.a2).expect(422);
      expect(errorOf(r)).toBe("INVALID_EMPLOYEE");
      await patch("leadT1", `/hr/revision-letters/${a2Letter.id}`, {
        ca: 1,
      }).expect(404);
      const row = await prisma.revisionLetter.findUniqueOrThrow({
        where: { id: a2Letter.id },
      });
      expect(row.ca.toFixed(2)).toBe("20000.00");
    });

    it("team: can issue and edit for its own team's employee", async () => {
      await issue("leadT1", emp.a1).expect(201);
      await patch("leadT1", `/hr/revision-letters/${a1Letter.id}`, {
        ca: 21000,
      }).expect(200);
    });

    it("filters the list by employee", async () => {
      const r = await get(
        "hrAll",
        `/hr/revision-letters?employeeId=${emp.a2}&limit=100`,
      ).expect(200);
      const rows = (r.body as Body<Letter[]>).data;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((l) => l.employee.id === emp.a2)).toBe(true);
    });

    it("returns pagination metadata", async () => {
      const r = await get(
        "hrAll",
        "/hr/revision-letters?page=1&limit=2",
      ).expect(200);
      expect((r.body as Body<Letter[]>).meta).toMatchObject({
        page: 1,
        limit: 2,
      });
      expect((r.body as Body<Letter[]>).data.length).toBeLessThanOrEqual(2);
    });

    it("404 for an id that does not exist", async () => {
      await get("hrAll", "/hr/revision-letters/2000000000").expect(404);
    });

    it("exposes no delete route", async () => {
      const r = await request(app.getHttpServer())
        .delete(`/hr/revision-letters/${a1Letter.id}`)
        .set(auth("hrAll"));
      expect([404, 405]).toContain(r.status);
      const still = await prisma.revisionLetter.findUnique({
        where: { id: a1Letter.id },
      });
      expect(still).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe("editing", () => {
    let letter: Letter;

    beforeAll(async () => {
      letter = (
        (await issue("hrAll", emp.a1, { ca: 20000 }).expect(201))
          .body as Body<Letter>
      ).data;
    });

    it("200 edits the terms and recalculates gross; document number and employee stay fixed", async () => {
      const r = await patch("hrAll", `/hr/revision-letters/${letter.id}`, {
        designation: "Principal Engineer",
        ca: 25000,
      }).expect(200);
      const data = (r.body as Body<Letter>).data;
      expect(data.designation).toBe("Principal Engineer");
      expect(data.components.ca).toBe("25000.00");
      expect(data.grossMonthly).toBe("105000.00");
      expect(data.grossAnnual).toBe("1260000.00");
      expect(data.documentNo).toBe(letter.documentNo);
      expect(data.employee.id).toBe(emp.a1);
    });

    it("rejects changing the employee link (400)", async () => {
      await patch("hrAll", `/hr/revision-letters/${letter.id}`, {
        employeeId: emp.a2,
      }).expect(400);
    });

    it("rejects changing the document number (400)", async () => {
      await patch("hrAll", `/hr/revision-letters/${letter.id}`, {
        documentNo: "TW/HR/REV/99-00/999",
      }).expect(400);
    });

    it("writes an audit row with before and after snapshots", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "revision_letter",
          entityId: BigInt(letter.id),
          action: "update",
        },
        orderBy: { id: "desc" },
      });
      expect(audit.actorUserId).toBe(userIds.hrAll);
      expect(audit.before).toMatchObject({
        designation: "Senior Software Engineer",
      });
      expect(audit.after).toMatchObject({
        designation: "Principal Engineer",
        changedFields: ["ca", "designation"],
      });
      // R4: the amounts themselves are not recorded, only the field names.
      expect(JSON.stringify([audit.before, audit.after])).not.toMatch(
        /20000|25000/,
      );
    });

    it("persists the edit", async () => {
      const row = await prisma.revisionLetter.findUniqueOrThrow({
        where: { id: letter.id },
      });
      expect(row.ca.toFixed(2)).toBe("25000.00");
      expect(row.updatedBy).toBe(userIds.hrAll);
    });

    it("404 and no change for a letter outside the caller's organization", async () => {
      await patch("hrAllB", `/hr/revision-letters/${letter.id}`, {
        ca: 1,
      }).expect(404);
      await get("hrAllB", `/hr/revision-letters/${letter.id}`).expect(404);
      const row = await prisma.revisionLetter.findUniqueOrThrow({
        where: { id: letter.id },
      });
      expect(row.ca.toFixed(2)).toBe("25000.00");
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants", () => {
    const fields = {
      organizationId: 0,
      employeeId: 0,
      documentNo: "",
      employeeName: "x",
      designation: "x",
      location: "x",
      letterDate: new Date("2026-10-05T00:00:00Z"),
      effectiveDate: new Date("2026-11-01T00:00:00Z"),
      basic: 1,
      da: 1,
      hra: 1,
      ca: 1,
      signatoryName: "x",
      signatoryDesignation: "x",
    };

    it("rejects a status other than GENERATED", async () => {
      await expect(
        prisma.revisionLetter.create({
          data: {
            ...fields,
            organizationId: orgA.id,
            employeeId: emp.a1,
            documentNo: `TW/HR/REV/DB-STATUS/${suffix}`,
            status: "SENT",
          },
        }),
      ).rejects.toThrow();
    });

    it("rejects a negative salary component", async () => {
      await expect(
        prisma.revisionLetter.create({
          data: {
            ...fields,
            organizationId: orgA.id,
            employeeId: emp.a1,
            documentNo: `TW/HR/REV/DB-NEG/${suffix}`,
            ca: -1,
          },
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate document number within an organization", async () => {
      const existing = await prisma.revisionLetter.findFirstOrThrow({
        where: { organizationId: orgA.id },
      });
      await expect(
        prisma.revisionLetter.create({
          data: {
            ...fields,
            organizationId: orgA.id,
            employeeId: emp.a1,
            documentNo: existing.documentNo,
          },
        }),
      ).rejects.toThrow();
    });
  });
});
