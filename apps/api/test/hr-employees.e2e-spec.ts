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
 * HR employees, end to end: scope and permissions, transaction-safe code
 * generation, validation, optimistic locking, the status lifecycle (including
 * disabling a leaver's login and revoking their sessions), employee↔user
 * mapping, self-service, database invariants, and the audit trail.
 */
interface Body<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
interface Emp {
  id: number;
  employeeCode: string;
  fullName: string;
  status: string;
  version: number;
  userId: number | null;
  hasLogin: boolean;
  dateOfExit: string | null;
  exitReason: string | null;
  isActive: boolean;
  department: { id: number } | null;
  workLocation?: { id: number } | null;
  phone?: string | null;
  workEmail?: string | null;
}

const PERMS = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
  "hr.employee.write.own",
  "hr.employee.write.team",
  "hr.employee.write.all",
  "hr.employee_status.write",
  "hr.employee_status.correct",
  "hr.employee_account.write",
  "employee_self_service.profile.read",
  "audit.log.read",
];

describe("HR employees (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const refresh: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let passwordHash: string;

  let team1: number;
  let team2: number;
  let dept1: number;
  let teamB: number;
  let desig: number;
  let desigOff: number;
  let desigB: number;
  let empType: number;
  let workLoc: number;
  let e1: Emp; // team 1
  let e2: Emp; // team 1
  let e3: Emp; // team 2
  let eB1: Emp; // org B

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);

  /** `it.each` rows are built before `beforeAll` runs, so rows that need ids
   * created in `beforeAll` are passed as thunks and resolved here. */
  const resolve = (
    v: Record<string, unknown> | (() => Record<string, unknown>),
  ) => (typeof v === "function" ? v() : v);

  let counter = 0;
  const payload = (over: Record<string, unknown> = {}) => {
    counter += 1;
    return {
      fullName: `Person ${counter} ${suffix}`,
      teamId: team1,
      designationId: desig,
      employmentTypeId: empType,
      dateOfJoining: "2026-01-05",
      ...over,
    };
  };
  const createEmp = async (who: string, over: Record<string, unknown> = {}) =>
    (
      (await post(who, "/hr/employees", payload(over)).expect(201))
        .body as Body<Emp>
    ).data;

  async function login(slug: string, email: string) {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ organizationSlug: slug, email, password: "Password123!" });
    return res;
  }

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    opts: { teamIds?: number[]; inactive?: boolean; noLogin?: boolean } = {},
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
        passwordHash,
        fullName: `User ${key}`,
        isActive: !opts.inactive,
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
    userIds[key] = user.id;
    if (!opts.noLogin && !opts.inactive) {
      const res = await login(org.slug, user.email);
      expect(res.status).toBe(201);
      const data = (
        res.body as Body<{ accessToken: string; refreshToken: string }>
      ).data;
      tokens[key] = data.accessToken;
      refresh[key] = data.refreshToken;
    }
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
    passwordHash = await bcrypt.hash("Password123!", 10);

    orgA = await prisma.organization.create({
      data: { name: `Emp A ${suffix}`, slug: `emp-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Emp B ${suffix}`, slug: `emp-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }

    const dept = await prisma.department.create({
      data: { organizationId: orgA.id, name: `Dept ${suffix}` },
    });
    dept1 = dept.id;
    team1 = (
      await prisma.team.create({
        data: {
          organizationId: orgA.id,
          name: "T1",
          code: `T1${suffix}`,
          departmentId: dept.id,
        },
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
    desig = (
      await prisma.designation.create({
        data: {
          organizationId: orgA.id,
          code: `ENG_${suffix}`,
          name: `Engineer ${suffix}`,
        },
      })
    ).id;
    desigOff = (
      await prisma.designation.create({
        data: {
          organizationId: orgA.id,
          code: `OLD_${suffix}`,
          name: `Retired ${suffix}`,
          isActive: false,
        },
      })
    ).id;
    desigB = (
      await prisma.designation.create({
        data: {
          organizationId: orgB.id,
          code: `ENG_${suffix}`,
          name: `Engineer ${suffix}`,
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgA.id,
          code: `PERM_${suffix}`,
          name: `Permanent ${suffix}`,
        },
      })
    ).id;
    const empTypeB = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgB.id,
          code: `PERM_${suffix}`,
          name: `Permanent ${suffix}`,
        },
      })
    ).id;
    workLoc = (
      await prisma.workLocation.create({
        data: {
          organizationId: orgA.id,
          code: `HQ_${suffix}`,
          name: `HQ ${suffix}`,
        },
      })
    ).id;

    await mkUser(orgA, "hrAll", [
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee_status.write",
      "hr.employee_account.write",
      "audit.log.read",
    ]);
    await mkUser(orgA, "corrector", [
      "hr.employee.read.all",
      "hr.employee_status.correct",
    ]);
    await mkUser(orgA, "leadT1", ["hr.employee.read.team"], {
      teamIds: [team1],
    });
    await mkUser(
      orgA,
      "writerT1",
      ["hr.employee.read.team", "hr.employee.write.team"],
      { teamIds: [team1] },
    );
    await mkUser(orgA, "ownWriter", [
      "hr.employee.read.own",
      "hr.employee.write.own",
    ]);
    await mkUser(orgA, "member", [
      "hr.employee.read.own",
      "employee_self_service.profile.read",
    ]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgA, "linkable1", ["employee_self_service.profile.read"]);
    await mkUser(orgA, "linkable2", []);
    await mkUser(orgA, "leaver", ["employee_self_service.profile.read"]);
    await mkUser(orgA, "dormant", [], { inactive: true });
    await mkUser(orgB, "hrB", [
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee_status.write",
      "hr.employee_account.write",
    ]);
    await mkUser(orgB, "otherOrgUser", [], { noLogin: true });

    e1 = await createEmp("hrAll", {
      teamId: team1,
      workLocationId: workLoc,
      fullName: `Alice ${suffix}`,
      workEmail: `alice.${suffix.toLowerCase()}@example.com`,
      phone: "+91 98765 43210",
    });
    e2 = await createEmp("hrAll", { teamId: team1, fullName: `Bob ${suffix}` });
    e3 = await createEmp("hrAll", {
      teamId: team2,
      fullName: `Carol ${suffix}`,
    });
    eB1 = (
      (
        await post("hrB", "/hr/employees", {
          fullName: `Dave ${suffix}`,
          teamId: teamB,
          designationId: desigB,
          employmentTypeId: empTypeB,
          dateOfJoining: "2026-02-02",
        }).expect(201)
      ).body as Body<Emp>
    ).data;
  });

  afterAll(async () => {
    // Employees, audit and status history are permanent by design, so this
    // suite's organizations are left behind (unique slugs) on the disposable DB.
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
    it("401 without a token on every route", async () => {
      await request(app.getHttpServer()).get("/hr/employees").expect(401);
      await request(app.getHttpServer())
        .post("/hr/employees")
        .send(payload())
        .expect(401);
      await request(app.getHttpServer())
        .get(`/hr/employees/${e1.id}`)
        .expect(401);
      await request(app.getHttpServer())
        .post(`/hr/employees/${e1.id}/status`)
        .send({})
        .expect(401);
      await request(app.getHttpServer())
        .get("/self-service/profile")
        .expect(401);
    });

    it("403 for a user with no HR permission", async () => {
      await get("nobody", "/hr/employees").expect(403);
      await get("nobody", `/hr/employees/${e1.id}`).expect(403);
      await post("nobody", "/hr/employees", payload()).expect(403);
      await post("nobody", `/hr/employees/${e1.id}/status`, {}).expect(403);
      await post("nobody", `/hr/employees/${e1.id}/link-user`, {
        userId: 1,
      }).expect(403);
    });

    it("team leads are read-only by default: they can list but not create, edit or change status", async () => {
      await get("leadT1", "/hr/employees").expect(200);
      await post("leadT1", "/hr/employees", payload()).expect(403);
      await patch("leadT1", `/hr/employees/${e1.id}`, {
        version: e1.version,
        fullName: "x",
      }).expect(403);
      await post("leadT1", `/hr/employees/${e1.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-01",
        reason: "no",
      }).expect(403);
      await post("leadT1", `/hr/employees/${e1.id}/status-correction`, {
        status: "ACTIVE",
        effectiveDate: "2026-06-01",
        reason: "no",
      }).expect(403);
    });

    it("an .own writer cannot create or edit", async () => {
      await post("ownWriter", "/hr/employees", payload()).expect(403);
      await patch("ownWriter", `/hr/employees/${e1.id}`, {
        version: e1.version,
        fullName: "x",
      }).expect(403);
    });

    it("status change, correction and user linking each need their own permission", async () => {
      await post("hrAll", `/hr/employees/${e1.id}/status-correction`, {
        status: "ACTIVE",
        effectiveDate: "2026-06-01",
        reason: "abc",
      }).expect(403);
      await post("corrector", `/hr/employees/${e1.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-01",
        reason: "abc",
      }).expect(403);
      await post("corrector", `/hr/employees/${e1.id}/link-user`, {
        userId: userIds.linkable1,
      }).expect(403);
    });

    it("has no DELETE route", async () => {
      await request(app.getHttpServer())
        .delete(`/hr/employees/${e1.id}`)
        .set(auth("hrAll"))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("employee creation", () => {
    it("issues EMP-000001 first in an organization, then the next number, and each organization counts separately", () => {
      expect(e1.employeeCode).toBe("EMP-000001");
      expect(e2.employeeCode).toBe("EMP-000002");
      expect(e3.employeeCode).toBe("EMP-000003");
      expect(eB1.employeeCode).toBe("EMP-000001");
    });

    it("returns the full record, defaults the department from the team, and starts ACTIVE at version 1", () => {
      expect(e1).toMatchObject({
        status: "ACTIVE",
        isActive: true,
        version: 1,
        userId: null,
        hasLogin: false,
        dateOfExit: null,
        exitReason: null,
      });
      expect(e1.department?.id).toBe(dept1); // team1's department
      expect(e1.workLocation?.id).toBe(workLoc);
      expect(e3.department).toBeNull(); // team2 has none
    });

    it("never returns or stores credentials", async () => {
      expect(JSON.stringify(e1)).not.toMatch(/password|hash|token/i);
      const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
         WHERE table_name = 'employees' AND column_name ~* 'pass|secret|token|hash|credential'`;
      expect(cols).toEqual([]);
    });

    it("records the initial status entry and an audit row attributed to the creator", async () => {
      const history = (
        (
          await get("hrAll", `/hr/employees/${e1.id}/status-history`).expect(
            200,
          )
        ).body as Body<
          Array<{ fromStatus: string | null; toStatus: string; reason: string }>
        >
      ).data;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        fromStatus: null,
        toStatus: "ACTIVE",
      });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee",
          entityId: BigInt(e1.id),
          action: "create",
        },
      });
      expect(audit).toMatchObject({
        organizationId: orgA.id,
        actorUserId: userIds.hrAll,
      });
      expect(audit.after).toMatchObject({
        employeeCode: "EMP-000001",
        status: "ACTIVE",
      });
      expect(JSON.stringify(audit.after)).not.toContain("98765"); // phone masked
    });

    it("is safe under concurrency: 15 simultaneous creations get 15 distinct, contiguous codes", async () => {
      const results = await Promise.all(
        Array.from({ length: 15 }, () =>
          post("hrAll", "/hr/employees", payload()),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(15).fill(201));
      const codes = results.map((r) => (r.body as Body<Emp>).data.employeeCode);
      expect(new Set(codes).size).toBe(15);
      const nums = codes.map((c) => Number(c.slice(4))).sort((a, b) => a - b);
      expect(nums[14]! - nums[0]!).toBe(14); // no gaps, no duplicates
      const rows = await prisma.employee.count({
        where: { organizationId: orgA.id, employeeCode: { in: codes } },
      });
      expect(rows).toBe(15);
    });

    it("a failed creation does not consume a number (no gap)", async () => {
      const email = `dup.${suffix.toLowerCase()}@example.com`;
      const first = await createEmp("hrAll", { workEmail: email });
      // Fails on the unique work e-mail AFTER a code has been issued in the transaction.
      await post(
        "hrAll",
        "/hr/employees",
        payload({ workEmail: email.toUpperCase() }),
      ).expect(409);
      const next = await createEmp("hrAll");
      expect(Number(next.employeeCode.slice(4))).toBe(
        Number(first.employeeCode.slice(4)) + 1,
      );
    });

    it("the database also enforces uniqueness of (organization, code)", async () => {
      await expect(
        prisma.employee.create({
          data: {
            organizationId: orgA.id,
            employeeCode: e1.employeeCode,
            fullName: "Clone",
            teamId: team1,
            designationId: desig,
            employmentTypeId: empType,
            dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/Unique constraint/);
    });

    it("links an existing user at creation and audits the link", async () => {
      const e = await createEmp("hrAll", { userId: userIds.linkable2 });
      expect(e).toMatchObject({ userId: userIds.linkable2, hasLogin: true });
      const audit = await prisma.auditLog.findMany({
        where: { entityType: "employee", entityId: BigInt(e.id) },
      });
      expect(audit.map((a) => a.action).sort()).toEqual([
        "create",
        "link_user",
      ]);
      await post("hrAll", `/hr/employees/${e.id}/unlink-user`, {}).expect(200); // free it for later tests
    });

    it("a .team writer can create only in their own team", async () => {
      await post(
        "writerT1",
        "/hr/employees",
        payload({ teamId: team1 }),
      ).expect(201);
      await post(
        "writerT1",
        "/hr/employees",
        payload({ teamId: team2 }),
      ).expect(403);
    });

    it.each([
      ["a missing name", { fullName: undefined }],
      ["a blank name", { fullName: "   " }],
      ["a 201-character name", { fullName: "n".repeat(201) }],
      ["a bad e-mail", { workEmail: "not-an-email" }],
      ["a bad phone", { phone: "abc" }],
      ["a missing team", { teamId: undefined }],
      ["a string team id", { teamId: "one" }],
      ["a missing designation", { designationId: undefined }],
      ["a missing employment type", { employmentTypeId: undefined }],
      ["a missing joining date", { dateOfJoining: undefined }],
      ["an impossible date", { dateOfJoining: "2026-02-30" }],
      ["a non-ISO date", { dateOfJoining: "05/01/2026" }],
      ["a client-supplied employeeCode", { employeeCode: "EMP-999999" }],
      ["a client-supplied status", { status: "TERMINATED" }],
      ["a client-supplied organizationId", () => ({ organizationId: orgB.id })],
      ["a client-supplied password", { password: "hunter2" }],
      ["a client-supplied version", { version: 9 }],
    ])("400 for %s", async (_label, over) => {
      await post("hrAll", "/hr/employees", payload(resolve(over))).expect(400);
    });

    it.each([
      ["a team that does not exist", { teamId: 999999999 }, "INVALID_TEAM"],
      [
        "another organization's team",
        () => ({ teamId: teamB }),
        "INVALID_TEAM",
      ],
      [
        "another organization's designation",
        () => ({ designationId: desigB }),
        "INVALID_DESIGNATION",
      ],
      [
        "an inactive designation",
        () => ({ designationId: desigOff }),
        "INVALID_DESIGNATION",
      ],
      [
        "a missing employment type row",
        { employmentTypeId: 999999999 },
        "INVALID_EMPLOYMENT_TYPE",
      ],
      [
        "a missing work location",
        { workLocationId: 999999999 },
        "INVALID_WORK_LOCATION",
      ],
      [
        "a missing department",
        { departmentId: 999999999 },
        "INVALID_DEPARTMENT",
      ],
      [
        "a manager who does not exist",
        { reportsToId: 999999999 },
        "INVALID_MANAGER",
      ],
      [
        "another organization's manager",
        () => ({ reportsToId: eB1.id }),
        "INVALID_MANAGER",
      ],
      ["a user who does not exist", { userId: 999999999 }, "INVALID_USER"],
      ["another organization's user", { userId: "OTHER_ORG" }, "INVALID_USER"],
      ["an inactive user", { userId: "DORMANT" }, "INVALID_USER"],
    ])("422 %s", async (_label, over, code) => {
      const body = { ...resolve(over) } as Record<string, unknown>;
      if (body.userId === "OTHER_ORG") body.userId = userIds.otherOrgUser;
      if (body.userId === "DORMANT") body.userId = userIds.dormant;
      const res = await post("hrAll", "/hr/employees", payload(body)).expect(
        422,
      );
      expect((res.body as { error: string }).error).toBe(code);
    });

    it("a manager must be ACTIVE", async () => {
      const gone = await createEmp("hrAll");
      await post("hrAll", `/hr/employees/${gone.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-01",
        reason: "sabbatical",
      }).expect(200);
      await post(
        "hrAll",
        "/hr/employees",
        payload({ reportsToId: gone.id }),
      ).expect(422);
    });

    it("409 when the user is already linked to another employee", async () => {
      const a = await createEmp("hrAll", { userId: userIds.linkable2 });
      await post(
        "hrAll",
        "/hr/employees",
        payload({ userId: userIds.linkable2 }),
      ).expect(409);
      await post("hrAll", `/hr/employees/${a.id}/unlink-user`, {}).expect(200);
    });

    it("a concurrent race to link one user from two creations gives one 201 and one 409, never a 500", async () => {
      const results = await Promise.all([
        post("hrAll", "/hr/employees", payload({ userId: userIds.linkable2 })),
        post("hrAll", "/hr/employees", payload({ userId: userIds.linkable2 })),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const winner = results.find((r) => r.status === 201);
      await post(
        "hrAll",
        `/hr/employees/${(winner?.body as Body<Emp>).data.id}/unlink-user`,
        {},
      ).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe("reading: scope, filters, isolation", () => {
    it(".all sees every employee of its organization and none of another", async () => {
      const list = (
        (await get("hrAll", "/hr/employees?limit=100").expect(200))
          .body as Body<Emp[]>
      ).data;
      const ids = list.map((e) => e.id);
      expect(ids).toEqual(expect.arrayContaining([e1.id, e2.id, e3.id]));
      expect(ids).not.toContain(eB1.id);
    });

    it(".team sees only its own team — list and by id (404 for the other team's employee)", async () => {
      const list = (
        (await get("leadT1", "/hr/employees?limit=100").expect(200))
          .body as Body<Emp[]>
      ).data;
      const ids = list.map((e) => e.id);
      expect(ids).toEqual(expect.arrayContaining([e1.id, e2.id]));
      expect(ids).not.toContain(e3.id);
      await get("leadT1", `/hr/employees/${e1.id}`).expect(200);
      await get("leadT1", `/hr/employees/${e3.id}`).expect(404);
      await get("leadT1", `/hr/employees/${e3.id}/status-history`).expect(404);
    });

    it("a team filter outside the caller's scope returns nothing, not the caller's own team", async () => {
      const list = (
        (await get("leadT1", `/hr/employees?teamId=${team2}`).expect(200))
          .body as Body<Emp[]>
      ).data;
      expect(list).toEqual([]);
    });

    it(".own sees only the employee linked to its login", async () => {
      await get("member", "/hr/employees")
        .expect(200)
        .expect((r) => {
          expect((r.body as Body<Emp[]>).data).toEqual([]); // not linked yet
        });
    });

    it("another organization can neither list, read nor see the history of these employees", async () => {
      const list = (
        (await get("hrB", "/hr/employees?limit=100").expect(200)).body as Body<
          Emp[]
        >
      ).data;
      expect(list.map((e) => e.id)).toEqual([eB1.id]);
      await get("hrB", `/hr/employees/${e1.id}`).expect(404);
      await get("hrB", `/hr/employees/${e1.id}/status-history`).expect(404);
      await patch("hrB", `/hr/employees/${e1.id}`, {
        version: 1,
        fullName: "Hijack",
      }).expect(404);
      await post("hrB", `/hr/employees/${e1.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-01",
        reason: "hijack",
      }).expect(404);
      await post("hrB", `/hr/employees/${e1.id}/link-user`, {
        userId: userIds.hrB,
      }).expect(404);
      const still = (
        (await get("hrAll", `/hr/employees/${e1.id}`).expect(200))
          .body as Body<Emp>
      ).data;
      expect(still.fullName).toBe(`Alice ${suffix}`);
    });

    it("the list omits phone and e-mail; the detail includes them", async () => {
      const item = (
        (await get("hrAll", `/hr/employees?search=Alice ${suffix}`).expect(200))
          .body as Body<Emp[]>
      ).data[0] as Emp;
      expect(item).not.toHaveProperty("phone");
      expect(item).not.toHaveProperty("workEmail");
      const detail = (
        (await get("hrAll", `/hr/employees/${e1.id}`).expect(200))
          .body as Body<Emp>
      ).data;
      expect(detail.phone).toBe("+91 98765 43210");
      expect(detail.workEmail).toContain("alice.");
    });

    it("searches by code, name and e-mail (case-insensitive)", async () => {
      const byName = (
        (
          await get(
            "hrAll",
            `/hr/employees?search=${encodeURIComponent(`bob ${suffix.toLowerCase()}`)}`,
          ).expect(200)
        ).body as Body<Emp[]>
      ).data;
      expect(byName.map((e) => e.id)).toEqual([e2.id]);
      const byCode = (
        (await get("hrAll", "/hr/employees?search=emp-000003").expect(200))
          .body as Body<Emp[]>
      ).data;
      expect(byCode.map((e) => e.id)).toEqual([e3.id]);
      const byMail = (
        (await get("hrAll", `/hr/employees?search=ALICE.${suffix}`).expect(200))
          .body as Body<Emp[]>
      ).data;
      expect(byMail.map((e) => e.id)).toEqual([e1.id]);
    });

    it("filters by team, status, hasUser and joining range", async () => {
      const t2 = (
        (
          await get("hrAll", `/hr/employees?teamId=${team2}&limit=100`).expect(
            200,
          )
        ).body as Body<Emp[]>
      ).data;
      expect(t2.map((e) => e.id)).toEqual([e3.id]);
      const inactive = (
        (
          await get("hrAll", "/hr/employees?status=INACTIVE&limit=100").expect(
            200,
          )
        ).body as Body<Emp[]>
      ).data;
      expect(inactive.every((e) => e.status === "INACTIVE")).toBe(true);
      const noLogin = (
        (
          await get("hrAll", "/hr/employees?hasUser=false&limit=100").expect(
            200,
          )
        ).body as Body<Emp[]>
      ).data;
      expect(noLogin.every((e) => !e.hasLogin)).toBe(true);
      const none = (
        (await get("hrAll", "/hr/employees?joinedFrom=2030-01-01").expect(200))
          .body as Body<Emp[]>
      ).data;
      expect(none).toEqual([]);
      const some = (
        (
          await get(
            "hrAll",
            "/hr/employees?joinedFrom=2026-01-05&joinedTo=2026-01-05&limit=100",
          ).expect(200)
        ).body as Body<Emp[]>
      ).data;
      expect(some.length).toBeGreaterThan(0);
    });

    it("paginates and sorts", async () => {
      const page = (
        await get(
          "hrAll",
          "/hr/employees?limit=3&page=1&sortBy=employeeCode&order=asc",
        ).expect(200)
      ).body as Body<Emp[]>;
      expect(page.data).toHaveLength(3);
      expect(page.meta).toMatchObject({ page: 1, limit: 3 });
      expect(page.meta!.total).toBeGreaterThan(3);
      const codes = page.data.map((e) => e.employeeCode);
      expect(codes).toEqual([...codes].sort());
      const desc = (
        (
          await get(
            "hrAll",
            "/hr/employees?limit=3&sortBy=employeeCode&order=desc",
          ).expect(200)
        ).body as Body<Emp[]>
      ).data.map((e) => e.employeeCode);
      expect(desc).toEqual([...desc].sort().reverse());
    });

    it.each([
      ["an unknown status", "status=FIRED"],
      ["a non-numeric team", "teamId=abc"],
      ["a bad date", "joinedFrom=2026-13-01"],
      ["an unknown sort field", "sortBy=passwordHash"],
      ["limit above 100", "limit=101"],
    ])("400 for %s", async (_l, qs) => {
      await get("hrAll", `/hr/employees?${qs}`).expect(400);
    });

    it("400 for a non-numeric id, 404 for an unknown id", async () => {
      await get("hrAll", "/hr/employees/abc").expect(400);
      await get("hrAll", "/hr/employees/999999999").expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("updating", () => {
    let e: Emp;
    beforeAll(async () => {
      e = await createEmp("hrAll", {
        workEmail: `upd.${suffix.toLowerCase()}@example.com`,
        phone: "+91 90000 11111",
      });
    });

    it("requires the version", async () => {
      await patch("hrAll", `/hr/employees/${e.id}`, { fullName: "x" }).expect(
        400,
      );
    });

    it("updates, bumps the version, and audits masked before/after", async () => {
      const res = await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        fullName: `Renamed ${suffix}`,
        phone: "+91 90000 22222",
      }).expect(200);
      const updated = (res.body as Body<Emp>).data;
      expect(updated).toMatchObject({
        fullName: `Renamed ${suffix}`,
        version: e.version + 1,
      });
      e = updated;
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee",
          entityId: BigInt(e.id),
          action: "update",
        },
      });
      expect(audit.before).toMatchObject({
        fullName: expect.stringContaining("Person") as unknown,
      });
      expect(audit.after).toMatchObject({ fullName: `Renamed ${suffix}` });
      expect(JSON.stringify([audit.before, audit.after])).not.toContain(
        "90000",
      );
      expect(audit.actorUserId).toBe(userIds.hrAll);
    });

    it("a stale version is a 409 VERSION_CONFLICT and changes nothing", async () => {
      const res = await patch("hrAll", `/hr/employees/${e.id}`, {
        version: 1,
        fullName: "Stale write",
      }).expect(409);
      expect((res.body as { error: string }).error).toBe("VERSION_CONFLICT");
      const cur = (
        (await get("hrAll", `/hr/employees/${e.id}`).expect(200))
          .body as Body<Emp>
      ).data;
      expect(cur.fullName).toBe(`Renamed ${suffix}`);
    });

    it("two simultaneous updates with the same version: exactly one wins", async () => {
      const results = await Promise.all([
        patch("hrAll", `/hr/employees/${e.id}`, {
          version: e.version,
          fullName: `Race A ${suffix}`,
        }),
        patch("hrAll", `/hr/employees/${e.id}`, {
          version: e.version,
          fullName: `Race B ${suffix}`,
        }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      e = (
        (await get("hrAll", `/hr/employees/${e.id}`).expect(200))
          .body as Body<Emp>
      ).data;
      expect(e.version).toBeGreaterThan(1);
    });

    it("a no-op update changes nothing: same version, no audit row", async () => {
      const before = await prisma.auditLog.count({
        where: { entityType: "employee", entityId: BigInt(e.id) },
      });
      const res = await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        fullName: e.fullName,
      }).expect(200);
      expect((res.body as Body<Emp>).data.version).toBe(e.version);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "employee", entityId: BigInt(e.id) },
        }),
      ).toBe(before);
    });

    it("clears optional fields with null or an empty string, but not required ones", async () => {
      const cleared = (
        (
          await patch("hrAll", `/hr/employees/${e.id}`, {
            version: e.version,
            phone: "",
            workEmail: null,
          }).expect(200)
        ).body as Body<Emp>
      ).data;
      expect(cleared.phone).toBeNull();
      expect(cleared.workEmail).toBeNull();
      e = cleared;
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        fullName: null,
      }).expect(400);
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        teamId: null,
      }).expect(400);
    });

    it.each([
      ["employeeCode", { employeeCode: "EMP-000777" }],
      ["status", { status: "TERMINATED" }],
      ["userId", { userId: 1 }],
      ["dateOfExit", { dateOfExit: "2026-01-01" }],
      ["organizationId", { organizationId: 1 }],
    ])("cannot change %s through PATCH (400)", async (_f, body) => {
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        ...body,
      }).expect(400);
    });

    it("validates references on change (422) and leaves the row untouched", async () => {
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        designationId: desigOff,
      }).expect(422);
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        teamId: teamB,
      }).expect(422);
      const cur = (
        (await get("hrAll", `/hr/employees/${e.id}`).expect(200))
          .body as Body<Emp>
      ).data;
      expect(cur.version).toBe(e.version);
    });

    it("an unrelated edit is not blocked by a designation that was deactivated after assignment", async () => {
      const old = await createEmp("hrAll");
      await prisma.designation.update({
        where: { id: desig },
        data: { isActive: false },
      });
      try {
        await patch("hrAll", `/hr/employees/${old.id}`, {
          version: old.version,
          fullName: `Still editable ${suffix}`,
        }).expect(200);
      } finally {
        await prisma.designation.update({
          where: { id: desig },
          data: { isActive: true },
        });
      }
    });

    it("prevents reporting-line cycles (self, direct and indirect)", async () => {
      const a = await createEmp("hrAll");
      const b = await createEmp("hrAll", { reportsToId: a.id });
      const c = await createEmp("hrAll", { reportsToId: b.id });
      await patch("hrAll", `/hr/employees/${a.id}`, {
        version: a.version,
        reportsToId: a.id,
      }).expect(422);
      const direct = await patch("hrAll", `/hr/employees/${a.id}`, {
        version: a.version,
        reportsToId: b.id,
      }).expect(422);
      expect((direct.body as { error: string }).error).toBe(
        "REPORTING_LINE_CYCLE",
      );
      await patch("hrAll", `/hr/employees/${a.id}`, {
        version: a.version,
        reportsToId: c.id,
      }).expect(422);
      // A valid re-parenting still works.
      await patch("hrAll", `/hr/employees/${c.id}`, {
        version: c.version,
        reportsToId: a.id,
      }).expect(200);
    });

    it("a .team writer may change profile fields in their own team but not restricted ones, nor another team's employee", async () => {
      const mine = await createEmp("hrAll", { teamId: team1 });
      const res = await patch("writerT1", `/hr/employees/${mine.id}`, {
        version: mine.version,
        phone: "+91 80000 33333",
      }).expect(200);
      expect((res.body as Body<Emp>).data.phone).toBe("+91 80000 33333");
      await patch("writerT1", `/hr/employees/${mine.id}`, {
        version: mine.version + 1,
        designationId: desig,
      }).expect(403);
      await patch("writerT1", `/hr/employees/${mine.id}`, {
        version: mine.version + 1,
        teamId: team2,
      }).expect(403);
      await patch("writerT1", `/hr/employees/${e3.id}`, {
        version: e3.version,
        phone: "+91 80000 44444",
      }).expect(404);
    });

    it("an .all writer can move an employee to another team", async () => {
      const mover = await createEmp("hrAll", { teamId: team1 });
      const moved = (
        (
          await patch("hrAll", `/hr/employees/${mover.id}`, {
            version: mover.version,
            teamId: team2,
          }).expect(200)
        ).body as Body<Emp>
      ).data;
      await get("leadT1", `/hr/employees/${moved.id}`).expect(404); // left team 1's scope immediately
    });
  });

  // ---------------------------------------------------------------------------
  describe("status lifecycle", () => {
    const change = (
      who: string,
      id: number,
      status: string,
      effectiveDate = "2026-06-30",
      reason = "because",
    ) =>
      post(who, `/hr/employees/${id}/status`, {
        status,
        effectiveDate,
        reason,
      });
    const correct = (
      id: number,
      status: string,
      effectiveDate = "2026-06-30",
      reason = "recorded in error",
    ) =>
      post("corrector", `/hr/employees/${id}/status-correction`, {
        status,
        effectiveDate,
        reason,
      });
    const errorOf = (r: request.Response) =>
      (r.body as { error: string }).error;

    it("ACTIVE ⇄ INACTIVE, recording history, audit and keeping is_active in step", async () => {
      const e = await createEmp("hrAll");
      const off = (
        (
          await change(
            "hrAll",
            e.id,
            "INACTIVE",
            "2026-03-01",
            "career break",
          ).expect(200)
        ).body as Body<Emp>
      ).data;
      expect(off).toMatchObject({
        status: "INACTIVE",
        isActive: false,
        dateOfExit: null,
        exitReason: null,
      });
      const on = (
        (
          await change(
            "hrAll",
            e.id,
            "ACTIVE",
            "2026-04-01",
            "returned",
          ).expect(200)
        ).body as Body<Emp>
      ).data;
      expect(on).toMatchObject({ status: "ACTIVE", isActive: true });

      const history = (
        (await get("hrAll", `/hr/employees/${e.id}/status-history`).expect(200))
          .body as Body<
          Array<{
            fromStatus: string | null;
            toStatus: string;
            reason: string;
            changeType: string;
            effectiveDate: string;
            changedBy: { id: number };
          }>
        >
      ).data;
      expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
        ["INACTIVE", "ACTIVE"],
        ["ACTIVE", "INACTIVE"],
        [null, "ACTIVE"],
      ]);
      expect(history[0]).toMatchObject({
        reason: "returned",
        effectiveDate: "2026-04-01",
        changeType: "transition",
        changedBy: { id: userIds.hrAll },
      });

      const audits = await prisma.auditLog.findMany({
        where: {
          entityType: "employee",
          entityId: BigInt(e.id),
          action: "status_change",
        },
        orderBy: { id: "asc" },
      });
      expect(audits).toHaveLength(2);
      expect(audits[0]).toMatchObject({
        reason: "career break",
        actorUserId: userIds.hrAll,
      });
      expect(audits[0]?.before).toMatchObject({ status: "ACTIVE" });
      expect(audits[0]?.after).toMatchObject({ status: "INACTIVE" });
    });

    it.each(["RESIGNED", "TERMINATED"])(
      "%s is an exit: sets the last day and reason, and is terminal",
      async (exit) => {
        const e = await createEmp("hrAll");
        const left = (
          (
            await change(
              "hrAll",
              e.id,
              exit,
              "2026-08-15",
              "left the company",
            ).expect(200)
          ).body as Body<Emp>
        ).data;
        expect(left).toMatchObject({
          status: exit,
          isActive: false,
          dateOfExit: "2026-08-15",
          exitReason: "left the company",
        });
        for (const to of ["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]) {
          const res = await change("hrAll", e.id, to).expect(422);
          expect(errorOf(res)).toBe("INVALID_STATE_TRANSITION");
        }
      },
    );

    it("INACTIVE can go on to RESIGNED or TERMINATED", async () => {
      const a = await createEmp("hrAll");
      await change("hrAll", a.id, "INACTIVE").expect(200);
      await change("hrAll", a.id, "RESIGNED").expect(200);
      const b = await createEmp("hrAll");
      await change("hrAll", b.id, "INACTIVE").expect(200);
      await change("hrAll", b.id, "TERMINATED").expect(200);
    });

    it("rejects a no-op move, an unknown status, a bad or missing date, and a missing/short reason", async () => {
      const e = await createEmp("hrAll");
      expect(errorOf(await change("hrAll", e.id, "ACTIVE").expect(422))).toBe(
        "INVALID_STATE_TRANSITION",
      );
      await change("hrAll", e.id, "FIRED").expect(400);
      await post("hrAll", `/hr/employees/${e.id}/status`, {
        status: "INACTIVE",
        reason: "abc",
      }).expect(400);
      await post("hrAll", `/hr/employees/${e.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-02-30",
        reason: "abc",
      }).expect(400);
      await post("hrAll", `/hr/employees/${e.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-30",
      }).expect(400);
      await change("hrAll", e.id, "INACTIVE", "2026-06-30", "ab").expect(400);
      await post("hrAll", `/hr/employees/${e.id}/status`, {
        status: "INACTIVE",
        effectiveDate: "2026-06-30",
        reason: "abc",
        employeeCode: "x",
      }).expect(400);
    });

    it("the effective date cannot precede the date of joining", async () => {
      const e = await createEmp("hrAll", { dateOfJoining: "2026-05-01" });
      const res = await change("hrAll", e.id, "RESIGNED", "2026-04-30").expect(
        422,
      );
      expect(errorOf(res)).toBe("EFFECTIVE_DATE_BEFORE_JOINING");
      await change("hrAll", e.id, "RESIGNED", "2026-05-01").expect(200); // same day is allowed
    });

    it("two simultaneous exits: exactly one succeeds, the other is refused as an invalid transition", async () => {
      const e = await createEmp("hrAll");
      const results = await Promise.all([
        change("hrAll", e.id, "RESIGNED"),
        change("hrAll", e.id, "TERMINATED"),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      const history = await prisma.employeeStatusHistory.count({
        where: { employeeId: e.id, changeType: "transition" },
      });
      expect(history).toBe(2); // creation + exactly one exit
    });

    describe("correction workflow", () => {
      it("reinstates a wrongly recorded exit, clears the exit fields, and is recorded as a correction", async () => {
        const e = await createEmp("hrAll");
        await change(
          "hrAll",
          e.id,
          "RESIGNED",
          "2026-07-01",
          "entered by mistake",
        ).expect(200);
        const back = (
          (
            await correct(
              e.id,
              "ACTIVE",
              "2026-07-02",
              "HR clerk entered the wrong person",
            ).expect(200)
          ).body as Body<Emp>
        ).data;
        expect(back).toMatchObject({
          status: "ACTIVE",
          isActive: true,
          dateOfExit: null,
          exitReason: null,
        });
        const h = await prisma.employeeStatusHistory.findFirstOrThrow({
          where: { employeeId: e.id },
          orderBy: { id: "desc" },
        });
        expect(h).toMatchObject({
          changeType: "correction",
          fromStatus: "RESIGNED",
          toStatus: "ACTIVE",
          reason: "HR clerk entered the wrong person",
        });
        const audit = await prisma.auditLog.findFirstOrThrow({
          where: {
            entityType: "employee",
            entityId: BigInt(e.id),
            action: "status_correction",
          },
        });
        expect(audit).toMatchObject({
          actorUserId: userIds.corrector,
          reason: "HR clerk entered the wrong person",
        });
      });

      it("reclassifies RESIGNED ⇄ TERMINATED", async () => {
        const e = await createEmp("hrAll");
        await change(
          "hrAll",
          e.id,
          "RESIGNED",
          "2026-07-01",
          "resigned",
        ).expect(200);
        const t = (
          (
            await correct(
              e.id,
              "TERMINATED",
              "2026-07-01",
              "was actually dismissed",
            ).expect(200)
          ).body as Body<Emp>
        ).data;
        expect(t).toMatchObject({
          status: "TERMINATED",
          exitReason: "was actually dismissed",
        });
        await correct(
          e.id,
          "RESIGNED",
          "2026-07-01",
          "reclassified again",
        ).expect(200);
      });

      it("refuses corrections that are not corrections", async () => {
        const e = await createEmp("hrAll");
        expect(errorOf(await correct(e.id, "INACTIVE").expect(422))).toBe(
          "INVALID_STATE_TRANSITION",
        ); // ACTIVE is not terminal
        await change("hrAll", e.id, "TERMINATED").expect(200);
        expect(errorOf(await correct(e.id, "INACTIVE").expect(422))).toBe(
          "INVALID_STATE_TRANSITION",
        ); // cannot land on INACTIVE
        expect(errorOf(await correct(e.id, "TERMINATED").expect(422))).toBe(
          "INVALID_STATE_TRANSITION",
        ); // no-op
        await post("corrector", `/hr/employees/${e.id}/status-correction`, {
          status: "ACTIVE",
          effectiveDate: "2026-07-01",
        }).expect(400); // reason mandatory
      });
    });

    describe("linked login", () => {
      let emp: Emp;
      it("leaving disables the login at once, revokes existing sessions, and audits both", async () => {
        emp = await createEmp("hrAll", { userId: userIds.leaver });
        expect(
          (await login(orgA.slug, "leaver@" + orgA.slug + ".test")).status,
        ).toBe(201);
        const beforeRefresh = refresh.leaver as string;

        await change(
          "hrAll",
          emp.id,
          "TERMINATED",
          "2026-09-01",
          "gross misconduct",
        ).expect(200);

        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: userIds.leaver as number },
            })
          ).isActive,
        ).toBe(false);
        expect(
          (await login(orgA.slug, "leaver@" + orgA.slug + ".test")).status,
        ).toBe(401);
        await request(app.getHttpServer())
          .post("/auth/refresh")
          .send({ refreshToken: beforeRefresh })
          .expect(401);

        const userAudit = await prisma.auditLog.findFirstOrThrow({
          where: {
            entityType: "user",
            entityId: BigInt(userIds.leaver as number),
            action: "deactivate",
          },
        });
        expect(userAudit).toMatchObject({
          actorUserId: userIds.hrAll,
          organizationId: orgA.id,
        });
        expect(userAudit.reason).toContain(emp.employeeCode);
      });

      it("a reinstating correction re-enables the login", async () => {
        await correct(
          emp.id,
          "ACTIVE",
          "2026-09-02",
          "dismissal overturned",
        ).expect(200);
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: userIds.leaver as number },
            })
          ).isActive,
        ).toBe(true);
        expect(
          (await login(orgA.slug, "leaver@" + orgA.slug + ".test")).status,
        ).toBe(201);
      });

      it("INACTIVE alone does not disable the login", async () => {
        await change(
          "hrAll",
          emp.id,
          "INACTIVE",
          "2026-09-10",
          "leave of absence",
        ).expect(200);
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: userIds.leaver as number },
            })
          ).isActive,
        ).toBe(true);
        await post("hrAll", `/hr/employees/${emp.id}/unlink-user`, {}).expect(
          200,
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("employee ↔ user mapping and self-service", () => {
    let emp: Emp;
    beforeAll(async () => {
      emp = await createEmp("hrAll", { fullName: `Mapped ${suffix}` });
    });

    it("an unlinked login is not an employee: self-service is 403 NOT_AN_EMPLOYEE", async () => {
      const res = await get("linkable1", "/self-service/profile").expect(403);
      expect((res.body as { error: string }).error).toBe("NOT_AN_EMPLOYEE");
    });

    it("without the permission the route is 403 even for a linked user", async () => {
      await get("nobody", "/self-service/profile").expect(403);
    });

    it("links a login and the user then sees exactly their own record", async () => {
      const res = await post("hrAll", `/hr/employees/${emp.id}/link-user`, {
        userId: userIds.linkable1,
        reason: "onboarding",
      }).expect(200);
      expect((res.body as Body<Emp>).data).toMatchObject({
        userId: userIds.linkable1,
        hasLogin: true,
      });
      const mine = (
        (await get("linkable1", "/self-service/profile").expect(200))
          .body as Body<Emp>
      ).data;
      expect(mine.id).toBe(emp.id);
      expect(mine.fullName).toBe(`Mapped ${suffix}`);
      expect(JSON.stringify(mine)).not.toMatch(/password|hash/i);
    });

    it("self-service takes no employee id — a forged one in the query or body is ignored", async () => {
      const viaQuery = (
        (
          await get(
            "linkable1",
            `/self-service/profile?employeeId=${e1.id}&id=${e1.id}`,
          ).expect(200)
        ).body as Body<Emp>
      ).data;
      expect(viaQuery.id).toBe(emp.id);
      await request(app.getHttpServer())
        .get(`/self-service/profile/${e1.id}`)
        .set(auth("linkable1"))
        .expect(404);
    });

    it("an .own reader sees only their own record in the HR endpoints", async () => {
      await post("hrAll", `/hr/employees/${e2.id}/link-user`, {
        userId: userIds.member,
      }).expect(200);
      const list = (
        (await get("member", "/hr/employees").expect(200)).body as Body<Emp[]>
      ).data;
      expect(list.map((x) => x.id)).toEqual([e2.id]);
      await get("member", `/hr/employees/${e2.id}`).expect(200);
      await get("member", `/hr/employees/${e1.id}`).expect(404);
      await post("hrAll", `/hr/employees/${e2.id}/unlink-user`, {}).expect(200);
    });

    it("link is idempotent for the same user and audited once", async () => {
      await post("hrAll", `/hr/employees/${emp.id}/link-user`, {
        userId: userIds.linkable1,
      }).expect(200);
      const n = await prisma.auditLog.count({
        where: {
          entityType: "employee",
          entityId: BigInt(emp.id),
          action: "link_user",
        },
      });
      expect(n).toBe(1);
    });

    it("refuses: a different user on a linked employee, one user on two employees, other-org or inactive users, non-existent users", async () => {
      await post("hrAll", `/hr/employees/${emp.id}/link-user`, {
        userId: userIds.linkable2,
      }).expect(409);
      const other = await createEmp("hrAll");
      await post("hrAll", `/hr/employees/${other.id}/link-user`, {
        userId: userIds.linkable1,
      }).expect(409);
      expect(
        (
          await post("hrAll", `/hr/employees/${other.id}/link-user`, {
            userId: userIds.otherOrgUser,
          }).expect(422)
        ).body,
      ).toMatchObject({ error: "INVALID_USER" });
      await post("hrAll", `/hr/employees/${other.id}/link-user`, {
        userId: userIds.dormant,
      }).expect(422);
      await post("hrAll", `/hr/employees/${other.id}/link-user`, {
        userId: 999999999,
      }).expect(422);
      await post("hrAll", `/hr/employees/${other.id}/link-user`, {
        userId: "abc",
      }).expect(400);
    });

    it("refuses to link a login to an employee who has left", async () => {
      const gone = await createEmp("hrAll");
      await post("hrAll", `/hr/employees/${gone.id}/status`, {
        status: "RESIGNED",
        effectiveDate: "2026-06-01",
        reason: "moved on",
      }).expect(200);
      const res = await post("hrAll", `/hr/employees/${gone.id}/link-user`, {
        userId: userIds.linkable2,
      }).expect(422);
      expect((res.body as { error: string }).error).toBe("EMPLOYEE_HAS_LEFT");
    });

    it("unlinking detaches the login, is idempotent, is audited, and ends self-service access", async () => {
      await post("hrAll", `/hr/employees/${emp.id}/unlink-user`, {
        reason: "role change",
      }).expect(200);
      await post("hrAll", `/hr/employees/${emp.id}/unlink-user`, {}).expect(
        200,
      );
      const n = await prisma.auditLog.count({
        where: {
          entityType: "employee",
          entityId: BigInt(emp.id),
          action: "unlink_user",
        },
      });
      expect(n).toBe(1);
      await get("linkable1", "/self-service/profile").expect(403);
      // The account itself is untouched and can be linked again.
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { id: userIds.linkable1 as number },
          })
        ).isActive,
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants (independent of the API)", () => {
    let e: Emp;
    beforeAll(async () => {
      e = await createEmp("hrAll");
    });
    const upd = (data: object) =>
      prisma.employee.update({ where: { id: e.id }, data });

    it("the employee code and organization can never change", async () => {
      await expect(upd({ employeeCode: "EMP-999999" })).rejects.toThrow(
        /employee_code is immutable/,
      );
      await expect(upd({ organizationId: orgB.id })).rejects.toThrow(
        /organization_id is immutable/,
      );
    });

    it("only the four approved statuses exist", async () => {
      await expect(
        upd({ status: "ON_LEAVE", isActive: false }),
      ).rejects.toThrow(/employees_status_check/);
    });

    it("is_active always mirrors status = ACTIVE", async () => {
      await expect(upd({ isActive: false })).rejects.toThrow(
        /employees_is_active_matches_status_check/,
      );
    });

    it("a leaver must have an exit date and reason — and nobody else may", async () => {
      await expect(
        upd({ status: "RESIGNED", isActive: false }),
      ).rejects.toThrow(/employees_exit_consistency_check/);
      await expect(
        upd({ dateOfExit: new Date("2026-06-01T00:00:00Z"), exitReason: "x" }),
      ).rejects.toThrow(/employees_exit_consistency_check/);
    });

    it("the exit date cannot precede joining", async () => {
      await expect(
        upd({
          status: "RESIGNED",
          isActive: false,
          dateOfExit: new Date("2020-01-01T00:00:00Z"),
          exitReason: "x",
        }),
      ).rejects.toThrow(/employees_exit_after_joining_check/);
    });

    it("an employee cannot be their own manager; reporting cycles are rejected", async () => {
      // Two independent guards; the BEFORE trigger fires first, the CHECK is the backstop.
      await expect(upd({ reportsToId: e.id })).rejects.toThrow(
        /reporting line cycle|employees_not_own_manager_check/,
      );
      const boss = await createEmp("hrAll");
      const sub = await createEmp("hrAll", { reportsToId: boss.id });
      await expect(
        prisma.employee.update({
          where: { id: boss.id },
          data: { reportsToId: sub.id },
        }),
      ).rejects.toThrow(/reporting line cycle/);
    });

    it("code format, blank names and version are checked", async () => {
      const base = {
        organizationId: orgA.id,
        teamId: team1,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: new Date("2026-01-01T00:00:00Z"),
      };
      await expect(
        prisma.employee.create({
          data: { ...base, employeeCode: "BAD-1", fullName: "x" },
        }),
      ).rejects.toThrow(/employees_code_format_check/);
      await expect(
        prisma.employee.create({
          data: { ...base, employeeCode: "EMP-777777", fullName: "   " },
        }),
      ).rejects.toThrow(/employees_text_check/);
      await expect(
        prisma.employee.create({
          data: {
            ...base,
            employeeCode: "EMP-777778",
            fullName: "ok",
            version: 0,
          },
        }),
      ).rejects.toThrow(/employees_version_check/);
    });

    it("work e-mail is unique per organization regardless of case, but may repeat across organizations", async () => {
      const mail = `shared.${suffix.toLowerCase()}@example.com`;
      await patch("hrAll", `/hr/employees/${e.id}`, {
        version: e.version,
        workEmail: mail,
      }).expect(200);
      await post("hrB", "/hr/employees", {
        fullName: "Other org same mail",
        teamId: teamB,
        designationId: desigB,
        employmentTypeId: (
          await prisma.employmentType.findFirstOrThrow({
            where: { organizationId: orgB.id },
          })
        ).id,
        dateOfJoining: "2026-01-01",
        workEmail: mail.toUpperCase(),
      }).expect(201);
    });

    it("status history is append-only", async () => {
      const h = await prisma.employeeStatusHistory.findFirstOrThrow({
        where: { employeeId: e.id },
      });
      await expect(
        prisma.employeeStatusHistory.update({
          where: { id: h.id },
          data: { reason: "rewritten" },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.employeeStatusHistory.delete({ where: { id: h.id } }),
      ).rejects.toThrow(/append-only/);
    });

    it("a correction without a reason is impossible even at the database", async () => {
      await expect(
        prisma.employeeStatusHistory.create({
          data: {
            organizationId: orgA.id,
            employeeId: e.id,
            toStatus: "ACTIVE",
            changeType: "correction",
            effectiveDate: new Date("2026-01-01T00:00:00Z"),
            changedBy: userIds.hrAll as number,
          },
        }),
      ).rejects.toThrow(/correction_reason_check/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit trail visibility", () => {
    it("employee changes are visible through the audit API to audit.log.read holders, with the acting user", async () => {
      const res = await get(
        "hrAll",
        `/audit/logs?entityType=employee&entityId=${e1.id}`,
      ).expect(200);
      const rows = (
        res.body as Body<
          Array<{ action: string; actorUserId: number; actorName: string }>
        >
      ).data;
      expect(rows.map((r) => r.action)).toContain("create");
      expect(rows[0]).toMatchObject({
        actorUserId: userIds.hrAll,
        actorName: "User hrAll",
      });
    });

    it("HR readers without audit.log.read cannot browse it, and other organizations see nothing", async () => {
      await get(
        "corrector",
        `/audit/logs?entityType=employee&entityId=${e1.id}`,
      ).expect(403);
      await get("leadT1", "/audit/logs").expect(403);
    });

    it("no audit row anywhere contains a secret-looking value from this suite", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: { in: ["employee", "user"] },
        },
      });
      const text = JSON.stringify(rows.map((r) => [r.before, r.after]));
      expect(text).not.toMatch(/\$2[aby]\$/); // bcrypt hashes
      expect(text).not.toContain("Password123!");
      expect(text).not.toContain("98765");
    });
  });
});
