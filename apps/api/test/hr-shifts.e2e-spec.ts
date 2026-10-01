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
 * HR shifts and shift assignments: shift-time rules (incl. overnight),
 * overlap prevention enforced by the database under concurrency, effective
 * dating and history, own/team/all scope, organization isolation, and the
 * employee-over-team resolution used by Attendance later.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number };
}
interface ShiftRow {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  workingMinutes: number;
  isActive: boolean;
}
interface Assignment {
  id: number;
  shift: { id: number; code: string };
  employee: { id: number } | null;
  team: { id: number } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  source?: "employee" | "team";
}

const PERMS = [
  "master.shift.read",
  "master.shift.write",
  "hr.shift_assignment.read.own",
  "hr.shift_assignment.read.team",
  "hr.shift_assignment.read.all",
  "hr.shift_assignment.write.own",
  "hr.shift_assignment.write.team",
  "hr.shift_assignment.write.all",
  "audit.log.read",
];

describe("HR shifts (e2e)", () => {
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
  let emp1: number; // team 1
  let emp1b: number; // team 1
  let empOpen: number; // team 1, used only by the open-ended test
  let emp2: number; // team 2
  let empMember: number; // team 1, linked to user "member"
  let empLeft: number; // resigned
  let empB: number; // org B
  let day: number; // general 09-18 shift
  let night: number; // overnight shift
  let shiftB: number;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;

  let shiftCounter = 0;
  const shiftBody = (over: Record<string, unknown> = {}) => {
    shiftCounter += 1;
    return {
      code: `S${shiftCounter}_${suffix}`,
      name: `Shift ${shiftCounter} ${suffix}`,
      startTime: "09:00",
      endTime: "18:00",
      workingMinutes: 480,
      ...over,
    };
  };
  const mkShift = async (over: Record<string, unknown> = {}) =>
    (
      (await post("hrAll", "/master-data/shifts", shiftBody(over)).expect(201))
        .body as Body<ShiftRow>
    ).data;

  const assign = (who: string, body: object) =>
    post(who, "/hr/shift-assignments", body);
  const mkAssign = async (body: object, who = "hrAll") =>
    ((await assign(who, body).expect(201)).body as Body<Assignment>).data;

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
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
    for (const teamId of teamIds) {
      await prisma.userTeamAccess.create({
        data: { organizationId: org.id, userId: user.id, teamId },
      });
    }
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
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
      data: { name: `Shift A ${suffix}`, slug: `sh-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Shift B ${suffix}`, slug: `sh-b-${suffix.toLowerCase()}` },
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

    const mkEmp = async (
      orgId: number,
      teamId: number,
      n: number,
      over: Record<string, unknown> = {},
    ) => {
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
            employeeCode: `EMP-9${String(n).padStart(5, "0")}`,
            fullName: `Emp ${n}`,
            teamId,
            designationId: designation.id,
            employmentTypeId: type.id,
            dateOfJoining: new Date("2026-01-01T00:00:00Z"),
            ...over,
          },
        })
      ).id;
    };
    emp1 = await mkEmp(orgA.id, team1, 1);
    emp1b = await mkEmp(orgA.id, team1, 2);
    emp2 = await mkEmp(orgA.id, team2, 3);
    empOpen = await mkEmp(orgA.id, team1, 6);
    empLeft = await mkEmp(orgA.id, team1, 4, {
      status: "RESIGNED",
      isActive: false,
      dateOfExit: new Date("2026-03-01T00:00:00Z"),
      exitReason: "left",
    });
    empB = await mkEmp(orgB.id, teamB, 1);

    await mkUser(orgA, "hrAll", [
      "master.shift.read",
      "master.shift.write",
      "hr.shift_assignment.read.all",
      "hr.shift_assignment.write.all",
      "audit.log.read",
    ]);
    await mkUser(orgA, "shiftReader", ["master.shift.read"]);
    await mkUser(orgA, "leadT1", ["hr.shift_assignment.read.team"], [team1]);
    await mkUser(
      orgA,
      "writerT1",
      ["hr.shift_assignment.read.team", "hr.shift_assignment.write.team"],
      [team1],
    );
    await mkUser(orgA, "ownWriter", [
      "hr.shift_assignment.read.own",
      "hr.shift_assignment.write.own",
    ]);
    const member = await mkUser(orgA, "member", [
      "hr.shift_assignment.read.own",
    ]);
    empMember = await mkEmp(orgA.id, team1, 5, { userId: member.id });
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "master.shift.read",
      "master.shift.write",
      "hr.shift_assignment.read.all",
      "hr.shift_assignment.write.all",
    ]);

    day = (await mkShift({ code: `DAY_${suffix}`, name: `Day ${suffix}` })).id;
    night = (
      await mkShift({
        code: `NIGHT_${suffix}`,
        name: `Night ${suffix}`,
        startTime: "22:00",
        endTime: "06:00",
        workingMinutes: 450,
      })
    ).id;
    shiftB = (
      (
        await post(
          "hrB",
          "/master-data/shifts",
          shiftBody({ code: `DAYB_${suffix}`, name: `Day B ${suffix}` }),
        ).expect(201)
      ).body as Body<ShiftRow>
    ).data.id;
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
  describe("shift master", () => {
    it("401 unauthenticated, 403 without permission, read-only users cannot write", async () => {
      await request(app.getHttpServer()).get("/master-data/shifts").expect(401);
      await get("nobody", "/master-data/shifts").expect(403);
      await get("shiftReader", "/master-data/shifts").expect(200);
      await post("shiftReader", "/master-data/shifts", shiftBody()).expect(403);
      await request(app.getHttpServer())
        .delete(`/master-data/shifts/${day}`)
        .set(auth("hrAll"))
        .expect(404);
    });

    it("stores a day shift and derives overnight=false", async () => {
      const s = await mkShift({
        startTime: "06:00",
        endTime: "14:00",
        workingMinutes: 480,
      });
      expect(s).toMatchObject({
        isOvernight: false,
        startTime: "06:00",
        endTime: "14:00",
        workingMinutes: 480,
        isActive: true,
      });
    });

    it("stores an overnight shift and derives overnight=true", async () => {
      const s = await mkShift({
        startTime: "23:30",
        endTime: "07:30",
        workingMinutes: 420,
      });
      expect(s.isOvernight).toBe(true);
    });

    it("audits the creation with the derived fields", async () => {
      const s = await mkShift();
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "shift",
          entityId: BigInt(s.id),
          action: "create",
        },
      });
      expect(audit).toMatchObject({
        actorUserId: userIds.hrAll,
        organizationId: orgA.id,
      });
      expect(audit.after).toMatchObject({
        startTime: "09:00",
        isOvernight: false,
        workingMinutes: 480,
      });
    });

    it.each([
      [
        "equal start and end",
        { startTime: "09:00", endTime: "09:00" },
        "SHIFT_TIME_INVALID",
      ],
      [
        "a working duration longer than the window",
        { workingMinutes: 541 },
        "SHIFT_WORKING_MINUTES_INVALID",
      ],
      [
        "a working duration longer than an overnight window",
        { startTime: "22:00", endTime: "06:00", workingMinutes: 481 },
        "SHIFT_WORKING_MINUTES_INVALID",
      ],
    ])("422 for %s", async (_l, over, code) => {
      expect(
        errorOf(
          await post("hrAll", "/master-data/shifts", shiftBody(over)).expect(
            422,
          ),
        ),
      ).toBe(code);
    });

    it.each([
      ["a malformed start time", { startTime: "9:00" }],
      ["an out-of-range hour", { endTime: "24:00" }],
      ["out-of-range minutes", { endTime: "18:60" }],
      ["a missing start", { startTime: undefined }],
      ["a missing working duration", { workingMinutes: undefined }],
      ["zero working minutes", { workingMinutes: 0 }],
      ["working minutes above a day", { workingMinutes: 1441 }],
      ["a fractional duration", { workingMinutes: 7.5 }],
      ["a client-supplied isOvernight", { isOvernight: true }],
      ["a break length (unapproved policy)", { breakMinutes: 60 }],
      ["a grace period (unapproved policy)", { graceMinutes: 10 }],
      ["a lower-case code", { code: "day shift" }],
    ])("400 for %s", async (_l, over) => {
      await post("hrAll", "/master-data/shifts", shiftBody(over)).expect(400);
    });

    it("409 on a duplicate code or name (case-insensitive); one 201 under a concurrent race", async () => {
      const s = await mkShift();
      await post(
        "hrAll",
        "/master-data/shifts",
        shiftBody({ code: s.code }),
      ).expect(409);
      await post(
        "hrAll",
        "/master-data/shifts",
        shiftBody({ name: `  ${s.name.toLowerCase()} ` }),
      ).expect(409);
      const body = shiftBody();
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          post("hrAll", "/master-data/shifts", {
            ...body,
            name: `${body.name} ${i}`,
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([
        201, 409, 409, 409, 409, 409,
      ]);
    });

    it("re-derives overnight when times change, and validates the WHOLE resulting shift", async () => {
      const s = await mkShift();
      const moved = (
        (
          await patch("hrAll", `/master-data/shifts/${s.id}`, {
            startTime: "21:00",
            endTime: "05:00",
            workingMinutes: 420,
          }).expect(200)
        ).body as Body<ShiftRow>
      ).data;
      expect(moved).toMatchObject({
        isOvernight: true,
        startTime: "21:00",
        endTime: "05:00",
      });
      // Moving only the end time can make the stored duration impossible.
      expect(
        errorOf(
          await patch("hrAll", `/master-data/shifts/${s.id}`, {
            endTime: "22:00",
          }).expect(422),
        ),
      ).toBe("SHIFT_WORKING_MINUTES_INVALID");
      const still = (
        (await get("hrAll", `/master-data/shifts/${s.id}`).expect(200))
          .body as Body<ShiftRow>
      ).data;
      expect(still.endTime).toBe("05:00");
    });

    it("cannot be deactivated while assigned from today on; can be once ended or voided; an inactive shift cannot be assigned", async () => {
      const s = await mkShift();
      const a = await mkAssign({
        shiftId: s.id,
        employeeId: emp1b,
        effectiveFrom: "2026-10-01",
      }); // open-ended
      expect(
        errorOf(
          await post("hrAll", `/master-data/shifts/${s.id}/deactivate`).expect(
            409,
          ),
        ),
      ).toBe("RESOURCE_CONFLICT");
      await post("hrAll", `/hr/shift-assignments/${a.id}/void`, {
        reason: "entered by mistake",
      }).expect(200);
      await post("hrAll", `/master-data/shifts/${s.id}/deactivate`).expect(200);
      expect(
        errorOf(
          await assign("hrAll", {
            shiftId: s.id,
            employeeId: emp1b,
            effectiveFrom: "2026-10-01",
          }).expect(422),
        ),
      ).toBe("INVALID_SHIFT");
    });

    it("another organization cannot see or change these shifts, and may reuse the code", async () => {
      await get("hrB", `/master-data/shifts/${day}`).expect(404);
      await patch("hrB", `/master-data/shifts/${day}`, {
        name: "Hijack",
      }).expect(404);
      expect(
        errorOf(
          await assign("hrB", {
            shiftId: day,
            employeeId: empB,
            effectiveFrom: "2026-10-01",
          }).expect(422),
        ),
      ).toBe("INVALID_SHIFT");
    });

    it("the database enforces the same rules independently of the API", async () => {
      const base = { organizationId: orgA.id, name: "x", workingMinutes: 60 };
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "DBA_1",
            name: "db a",
            startTime: "9:00",
            endTime: "18:00",
            isOvernight: false,
          },
        }),
      ).rejects.toThrow(
        /shifts_time_format_check|shifts_overnight_consistency_check/,
      );
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "DBA_2",
            name: "db b",
            startTime: "09:00",
            endTime: "18:00",
            isOvernight: true,
          },
        }),
      ).rejects.toThrow(/shifts_overnight_consistency_check/);
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "DBA_3",
            name: "db c",
            startTime: "22:00",
            endTime: "06:00",
            isOvernight: false,
          },
        }),
      ).rejects.toThrow(/shifts_overnight_consistency_check/);
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "DBA_4",
            name: "db d",
            startTime: "09:00",
            endTime: "09:00",
            isOvernight: false,
          },
        }),
      ).rejects.toThrow(/shifts_overnight_consistency_check/);
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "DBA_5",
            name: "db e",
            startTime: "09:00",
            endTime: "10:00",
            isOvernight: false,
            workingMinutes: 61,
          },
        }),
      ).rejects.toThrow(/shifts_working_minutes_check/);
      await expect(
        prisma.shift.create({
          data: {
            ...base,
            code: "dba_6",
            name: "db f",
            startTime: "09:00",
            endTime: "18:00",
            isOvernight: false,
          },
        }),
      ).rejects.toThrow(/shifts_code_format_check/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("assignments: creation, validation and overlap", () => {
    it("assigns a shift to an employee, returning the shift details, and audits it", async () => {
      const a = await mkAssign({
        shiftId: day,
        employeeId: emp1,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-06-30",
        reason: "initial roster",
      });
      expect(a).toMatchObject({
        shift: { id: day },
        employee: { id: emp1 },
        team: null,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-06-30",
        isActive: true,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "shift_assignment",
          entityId: BigInt(a.id),
          action: "create",
        },
      });
      expect(audit).toMatchObject({
        actorUserId: userIds.hrAll,
        reason: "initial roster",
      });
      expect(audit.after).toMatchObject({
        employeeId: emp1,
        shiftId: day,
        effectiveFrom: "2026-01-05",
      });
    });

    it("rejects an overlapping assignment for the same employee with 409 naming the clash", async () => {
      const res = await assign("hrAll", {
        shiftId: night,
        employeeId: emp1,
        effectiveFrom: "2026-06-01",
        effectiveTo: "2026-07-31",
      }).expect(409);
      expect(errorOf(res)).toBe("SHIFT_ASSIGNMENT_OVERLAP");
      expect((res.body as { message: string }).message).toMatch(
        /2026-01-05 to 2026-06-30/,
      );
    });

    it("allows adjacent ranges (the day after) but not a shared boundary day", async () => {
      await assign("hrAll", {
        shiftId: night,
        employeeId: emp1,
        effectiveFrom: "2026-06-30",
        effectiveTo: "2026-08-31",
      }).expect(409); // shares 30 June
      await mkAssign({
        shiftId: night,
        employeeId: emp1,
        effectiveFrom: "2026-07-01",
        effectiveTo: "2026-08-31",
      });
    });

    it("an open-ended assignment blocks everything after its start, and is blocked by anything after it", async () => {
      await mkAssign({
        shiftId: day,
        employeeId: empOpen,
        effectiveFrom: "2026-09-01",
      }); // open-ended
      await assign("hrAll", {
        shiftId: night,
        employeeId: empOpen,
        effectiveFrom: "2030-01-01",
        effectiveTo: "2030-01-02",
      }).expect(409);
      await assign("hrAll", {
        shiftId: night,
        employeeId: empOpen,
        effectiveFrom: "2026-08-31",
        effectiveTo: "2026-09-01",
      }).expect(409);
      await mkAssign({
        shiftId: night,
        employeeId: empOpen,
        effectiveFrom: "2026-08-01",
        effectiveTo: "2026-08-31",
      }); // ends the day before: fine
    });

    it("different employees, and a team versus its members, may share dates", async () => {
      await mkAssign({
        shiftId: day,
        employeeId: emp2,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-01-31",
      });
      await mkAssign({
        shiftId: day,
        employeeId: emp1b,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-01-31",
      });
      await mkAssign({
        shiftId: day,
        teamId: team1,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-12-31",
      });
    });

    it("two teams' defaults do not clash, but one team cannot have two overlapping defaults", async () => {
      await mkAssign({
        shiftId: night,
        teamId: team2,
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-12-31",
      });
      expect(
        errorOf(
          await assign("hrAll", {
            shiftId: day,
            teamId: team2,
            effectiveFrom: "2026-12-01",
            effectiveTo: "2027-01-31",
          }).expect(409),
        ),
      ).toBe("SHIFT_ASSIGNMENT_OVERLAP");
    });

    it("is safe under concurrency: of 8 simultaneous overlapping assignments exactly one wins, none is a 500", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          assign("hrAll", {
            shiftId: day,
            employeeId: emp1,
            effectiveFrom: "2027-01-01",
            effectiveTo: "2027-01-31",
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([
        201, 409, 409, 409, 409, 409, 409, 409,
      ]);
      expect(
        await prisma.shiftAssignment.count({
          where: {
            employeeId: emp1,
            effectiveFrom: new Date("2027-01-01T00:00:00Z"),
          },
        }),
      ).toBe(1);
    });

    it.each([
      [
        "both employee and team",
        () => ({ employeeId: emp1, teamId: team1 }),
        "ASSIGNMENT_TARGET_INVALID",
      ],
      ["neither employee nor team", () => ({}), "ASSIGNMENT_TARGET_INVALID"],
      [
        "effectiveTo before effectiveFrom",
        () => ({
          employeeId: emp1b,
          effectiveFrom: "2028-05-10",
          effectiveTo: "2028-05-09",
        }),
        "ASSIGNMENT_DATES_INVALID",
      ],
      [
        "an unknown shift",
        () => ({ shiftId: 999999999, employeeId: emp1b }),
        "INVALID_SHIFT",
      ],
      [
        "another organization's shift",
        () => ({ shiftId: shiftB, employeeId: emp1b }),
        "INVALID_SHIFT",
      ],
      [
        "another organization's employee",
        () => ({ employeeId: empB }),
        "INVALID_EMPLOYEE",
      ],
      [
        "an unknown employee",
        () => ({ employeeId: 999999999 }),
        "INVALID_EMPLOYEE",
      ],
      [
        "another organization's team",
        () => ({ teamId: teamB }),
        "INVALID_TEAM",
      ],
      [
        "an employee who has left",
        () => ({ employeeId: empLeft }),
        "EMPLOYEE_HAS_LEFT",
      ],
      [
        "a start before the date of joining",
        () => ({ employeeId: emp1b, effectiveFrom: "2025-12-31" }),
        "ASSIGNMENT_BEFORE_JOINING",
      ],
    ])("422 for %s", async (_l, over, code) => {
      const body = { shiftId: day, effectiveFrom: "2028-01-01", ...over() };
      expect(errorOf(await assign("hrAll", body).expect(422))).toBe(code);
    });

    it.each([
      ["a missing shift", { employeeId: emp1b, effectiveFrom: "2028-01-01" }],
      ["a missing start date", { shiftId: 1, employeeId: emp1b }],
      [
        "an impossible date",
        { shiftId: 1, employeeId: emp1b, effectiveFrom: "2028-02-30" },
      ],
      [
        "a non-numeric employee",
        { shiftId: 1, employeeId: "x", effectiveFrom: "2028-01-01" },
      ],
      [
        "an unknown field",
        {
          shiftId: 1,
          employeeId: emp1b,
          effectiveFrom: "2028-01-01",
          isActive: false,
        },
      ],
      [
        "a client-supplied organizationId",
        {
          shiftId: 1,
          employeeId: emp1b,
          effectiveFrom: "2028-01-01",
          organizationId: 5,
        },
      ],
    ])("400 for %s", async (_l, body) => {
      await assign("hrAll", body).expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("assignments: effective dating and history", () => {
    it("ending shortens an assignment, keeps the row, frees the freed days, and can never extend", async () => {
      const a = await mkAssign({
        shiftId: day,
        employeeId: emp1b,
        effectiveFrom: "2029-01-01",
        effectiveTo: "2029-12-31",
      });
      const ended = (
        (
          await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
            effectiveTo: "2029-06-30",
            reason: "moved to nights",
          }).expect(200)
        ).body as Body<Assignment>
      ).data;
      expect(ended).toMatchObject({
        effectiveTo: "2029-06-30",
        isActive: true,
      });
      // The days after the new end are free again.
      await mkAssign({
        shiftId: night,
        employeeId: emp1b,
        effectiveFrom: "2029-07-01",
        effectiveTo: "2029-12-31",
      });
      // Extending would swallow that later assignment — refused, even a same-length move.
      expect(
        errorOf(
          await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
            effectiveTo: "2029-08-01",
          }).expect(422),
        ),
      ).toBe("ASSIGNMENT_CANNOT_EXTEND");
      expect(
        errorOf(
          await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
            effectiveTo: "2028-12-31",
          }).expect(422),
        ),
      ).toBe("ASSIGNMENT_DATES_INVALID");
      // Idempotent: same end date again changes nothing and writes no audit row.
      const before = await prisma.auditLog.count({
        where: {
          entityType: "shift_assignment",
          entityId: BigInt(a.id),
          action: "end",
        },
      });
      await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
        effectiveTo: "2029-06-30",
      }).expect(200);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "shift_assignment",
            entityId: BigInt(a.id),
            action: "end",
          },
        }),
      ).toBe(before);
      // The change of shift is fully visible as history.
      const history = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?employeeId=${emp1b}&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      const codes = history
        .filter((h) => h.effectiveFrom.startsWith("2029"))
        .map((h) => [h.shift.id, h.effectiveFrom, h.effectiveTo]);
      expect(codes).toEqual(
        expect.arrayContaining([
          [day, "2029-01-01", "2029-06-30"],
          [night, "2029-07-01", "2029-12-31"],
        ]),
      );
    });

    it("an open-ended assignment can be given an end date", async () => {
      const a = await mkAssign({
        shiftId: day,
        employeeId: emp2,
        effectiveFrom: "2031-01-01",
      });
      expect(a.effectiveTo).toBeNull();
      const ended = (
        (
          await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
            effectiveTo: "2031-03-31",
          }).expect(200)
        ).body as Body<Assignment>
      ).data;
      expect(ended.effectiveTo).toBe("2031-03-31");
    });

    it("voiding keeps the row for history, needs a reason, frees the dates and is idempotent", async () => {
      const a = await mkAssign({
        shiftId: day,
        employeeId: emp2,
        effectiveFrom: "2032-01-01",
        effectiveTo: "2032-01-31",
      });
      await post("hrAll", `/hr/shift-assignments/${a.id}/void`, {}).expect(400);
      await post("hrAll", `/hr/shift-assignments/${a.id}/void`, {
        reason: "ab",
      }).expect(400);
      const voided = (
        (
          await post("hrAll", `/hr/shift-assignments/${a.id}/void`, {
            reason: "wrong employee",
          }).expect(200)
        ).body as Body<Assignment>
      ).data;
      expect(voided.isActive).toBe(false);
      await post("hrAll", `/hr/shift-assignments/${a.id}/void`, {
        reason: "wrong employee",
      }).expect(200);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "shift_assignment",
            entityId: BigInt(a.id),
            action: "void",
          },
        }),
      ).toBe(1);
      // Hidden from the default list, present with includeVoided, and its dates are free.
      const def = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?employeeId=${emp2}&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(def.map((x) => x.id)).not.toContain(a.id);
      const all = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?employeeId=${emp2}&includeVoided=true&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(all.map((x) => x.id)).toContain(a.id);
      await mkAssign({
        shiftId: night,
        employeeId: emp2,
        effectiveFrom: "2032-01-01",
        effectiveTo: "2032-01-31",
      });
      // A voided assignment cannot be ended.
      expect(
        errorOf(
          await post("hrAll", `/hr/shift-assignments/${a.id}/end`, {
            effectiveTo: "2032-01-10",
          }).expect(422),
        ),
      ).toBe("ASSIGNMENT_VOIDED");
    });

    it("lists with filters (shift, team, activeOn), sorting and pagination", async () => {
      const byShift = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?shiftId=${night}&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(byShift.every((x) => x.shift.id === night)).toBe(true);
      const byTeam = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?teamId=${team1}&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(byTeam.length).toBeGreaterThan(0);
      expect(byTeam.every((x) => x.team?.id === team1)).toBe(true);
      const on = (
        (
          await get(
            "hrAll",
            `/hr/shift-assignments?employeeId=${emp1}&activeOn=2026-07-15&limit=100`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(on.map((x) => x.shift.id)).toEqual([night]);
      const page = (
        await get(
          "hrAll",
          "/hr/shift-assignments?limit=2&page=1&order=asc",
        ).expect(200)
      ).body as Body<Assignment[]>;
      expect(page.data).toHaveLength(2);
      expect(page.meta?.total).toBeGreaterThan(2);
      const dates = page.data.map((x) => x.effectiveFrom);
      expect(dates).toEqual([...dates].sort());
    });

    it.each([
      ["a bad date", "activeOn=2026-13-01"],
      ["a non-numeric employee", "employeeId=abc"],
      ["a bad flag", "includeVoided=maybe"],
      ["limit above 100", "limit=101"],
    ])("400 for %s", async (_l, qs) => {
      await get("hrAll", `/hr/shift-assignments?${qs}`).expect(400);
    });

    it("404 for an unknown or non-numeric id", async () => {
      await get("hrAll", "/hr/shift-assignments/999999999").expect(404);
      await get("hrAll", "/hr/shift-assignments/abc").expect(400);
      await post("hrAll", "/hr/shift-assignments/999999999/end", {
        effectiveTo: "2026-01-01",
      }).expect(404);
      await post("hrAll", "/hr/shift-assignments/999999999/void", {
        reason: "nope",
      }).expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("assignments: scope and isolation", () => {
    let a1: Assignment; // emp1's assignment (team 1)
    let a2: Assignment; // emp2's assignment (team 2)
    let aMember: Assignment;
    let aTeam2Default: Assignment;
    beforeAll(async () => {
      a1 = await mkAssign({
        shiftId: day,
        employeeId: emp1b,
        effectiveFrom: "2040-01-01",
        effectiveTo: "2040-01-31",
      });
      a2 = await mkAssign({
        shiftId: day,
        employeeId: emp2,
        effectiveFrom: "2040-01-01",
        effectiveTo: "2040-01-31",
      });
      aMember = await mkAssign({
        shiftId: night,
        employeeId: empMember,
        effectiveFrom: "2040-01-01",
        effectiveTo: "2040-01-31",
      });
      aTeam2Default = await mkAssign({
        shiftId: day,
        teamId: team2,
        effectiveFrom: "2040-02-01",
        effectiveTo: "2040-02-28",
      });
    });

    it("401 without a token; 403 with no permission", async () => {
      await request(app.getHttpServer())
        .get("/hr/shift-assignments")
        .expect(401);
      await get("nobody", "/hr/shift-assignments").expect(403);
      await post("nobody", "/hr/shift-assignments", {}).expect(403);
    });

    it(".all sees every assignment of the organization and none of another", async () => {
      const ids = (
        (
          await get(
            "hrAll",
            "/hr/shift-assignments?limit=100&activeOn=2040-01-15",
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data.map((x) => x.id);
      expect(ids).toEqual(expect.arrayContaining([a1.id, a2.id, aMember.id]));
      const asB = (
        (await get("hrB", "/hr/shift-assignments?limit=100").expect(200))
          .body as Body<Assignment[]>
      ).data;
      expect(asB.map((x) => x.id)).not.toContain(a1.id);
    });

    it(".team sees its own team's employees and team defaults, and nothing of team 2 (list, by id, filter)", async () => {
      const list = (
        (
          await get(
            "leadT1",
            "/hr/shift-assignments?limit=100&activeOn=2040-01-15",
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      const ids = list.map((x) => x.id);
      expect(ids).toEqual(expect.arrayContaining([a1.id, aMember.id]));
      expect(ids).not.toContain(a2.id);
      await get("leadT1", `/hr/shift-assignments/${a1.id}`).expect(200);
      await get("leadT1", `/hr/shift-assignments/${a2.id}`).expect(404);
      await get("leadT1", `/hr/shift-assignments/${aTeam2Default.id}`).expect(
        404,
      );
      const filtered = (
        (
          await get(
            "leadT1",
            `/hr/shift-assignments?employeeId=${emp2}`,
          ).expect(200)
        ).body as Body<Assignment[]>
      ).data;
      expect(filtered).toEqual([]);
    });

    it(".own sees only its own employee's assignments", async () => {
      const list = (
        (await get("member", "/hr/shift-assignments?limit=100").expect(200))
          .body as Body<Assignment[]>
      ).data;
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((x) => x.employee?.id === empMember)).toBe(true);
      await get("member", `/hr/shift-assignments/${aMember.id}`).expect(200);
      await get("member", `/hr/shift-assignments/${a1.id}`).expect(404);
    });

    it("read-only roles cannot create, end or void; .own write is reserved", async () => {
      const body = {
        shiftId: day,
        employeeId: emp1b,
        effectiveFrom: "2050-01-01",
      };
      await assign("leadT1", body).expect(403);
      await assign("ownWriter", body).expect(403);
      await post("leadT1", `/hr/shift-assignments/${a1.id}/end`, {
        effectiveTo: "2040-01-15",
      }).expect(403);
      await post("leadT1", `/hr/shift-assignments/${a1.id}/void`, {
        reason: "nope nope",
      }).expect(403);
      await post("ownWriter", `/hr/shift-assignments/${aMember.id}/void`, {
        reason: "nope nope",
      }).expect(403);
    });

    it("a .team writer manages only its team: own-team employee and default succeed; team 2 is refused", async () => {
      const mine = await mkAssign(
        {
          shiftId: day,
          employeeId: emp1,
          effectiveFrom: "2050-01-01",
          effectiveTo: "2050-01-31",
        },
        "writerT1",
      );
      expect(mine.employee?.id).toBe(emp1);
      await mkAssign(
        {
          shiftId: night,
          teamId: team1,
          effectiveFrom: "2050-02-01",
          effectiveTo: "2050-02-28",
        },
        "writerT1",
      );
      expect(
        errorOf(
          await assign("writerT1", {
            shiftId: day,
            employeeId: emp2,
            effectiveFrom: "2050-01-01",
          }).expect(422),
        ),
      ).toBe("INVALID_EMPLOYEE");
      expect(
        errorOf(
          await assign("writerT1", {
            shiftId: day,
            teamId: team2,
            effectiveFrom: "2050-06-01",
          }).expect(422),
        ),
      ).toBe("INVALID_TEAM");
      await post("writerT1", `/hr/shift-assignments/${a2.id}/end`, {
        effectiveTo: "2040-01-15",
      }).expect(404);
      await post("writerT1", `/hr/shift-assignments/${a2.id}/void`, {
        reason: "not yours",
      }).expect(404);
      await post("writerT1", `/hr/shift-assignments/${a1.id}/end`, {
        effectiveTo: "2040-01-20",
      }).expect(200);
    });

    it("another organization cannot read, end or void these assignments", async () => {
      await get("hrB", `/hr/shift-assignments/${a1.id}`).expect(404);
      await post("hrB", `/hr/shift-assignments/${a1.id}/end`, {
        effectiveTo: "2040-01-05",
      }).expect(404);
      await post("hrB", `/hr/shift-assignments/${a1.id}/void`, {
        reason: "hijack it",
      }).expect(404);
      expect(
        (
          await prisma.shiftAssignment.findUniqueOrThrow({
            where: { id: a1.id },
          })
        ).isActive,
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe("resolving the shift an employee works", () => {
    const resolve = (who: string, employeeId: number, date: string) =>
      get(
        who,
        `/hr/shift-assignments/resolve?employeeId=${employeeId}&date=${date}`,
      );
    const dataOf = (r: request.Response) =>
      (r.body as Body<Assignment | null>).data;

    let eR: number; // team 1 employee with personal + team defaults
    beforeAll(async () => {
      eR = (
        await prisma.employee.create({
          data: {
            organizationId: orgA.id,
            employeeCode: "EMP-980001",
            fullName: "Resolver",
            teamId: team1,
            designationId: (
              await prisma.designation.findFirstOrThrow({
                where: { organizationId: orgA.id },
              })
            ).id,
            employmentTypeId: (
              await prisma.employmentType.findFirstOrThrow({
                where: { organizationId: orgA.id },
              })
            ).id,
            dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          },
        })
      ).id;
      // Team 1 default: day shift through 2060. Personal: night shift for March 2060 only.
      await mkAssign({
        shiftId: day,
        teamId: team1,
        effectiveFrom: "2060-01-01",
        effectiveTo: "2060-12-31",
      });
      await mkAssign({
        shiftId: night,
        employeeId: eR,
        effectiveFrom: "2060-03-01",
        effectiveTo: "2060-03-31",
      });
    });

    it("the employee's own assignment wins over the team default", async () => {
      const r = dataOf(await resolve("hrAll", eR, "2060-03-15").expect(200));
      expect(r).toMatchObject({ source: "employee", shift: { id: night } });
    });

    it("falls back to the team default when the employee has none on that date", async () => {
      const r = dataOf(await resolve("hrAll", eR, "2060-04-01").expect(200));
      expect(r).toMatchObject({ source: "team", shift: { id: day } });
    });

    it("boundaries are inclusive on both ends", async () => {
      expect(
        dataOf(await resolve("hrAll", eR, "2060-03-01").expect(200)),
      ).toMatchObject({ source: "employee" });
      expect(
        dataOf(await resolve("hrAll", eR, "2060-03-31").expect(200)),
      ).toMatchObject({ source: "employee" });
      expect(
        dataOf(await resolve("hrAll", eR, "2060-02-29").expect(200)),
      ).toMatchObject({ source: "team" });
    });

    it("returns null when nothing covers the date, and ignores voided assignments", async () => {
      expect(
        dataOf(await resolve("hrAll", eR, "2061-01-01").expect(200)),
      ).toBeNull();
      const v = await mkAssign({
        shiftId: night,
        employeeId: eR,
        effectiveFrom: "2060-05-01",
        effectiveTo: "2060-05-31",
      });
      expect(
        dataOf(await resolve("hrAll", eR, "2060-05-10").expect(200)),
      ).toMatchObject({ source: "employee" });
      await post("hrAll", `/hr/shift-assignments/${v.id}/void`, {
        reason: "entered in error",
      }).expect(200);
      expect(
        dataOf(await resolve("hrAll", eR, "2060-05-10").expect(200)),
      ).toMatchObject({ source: "team" });
    });

    it("an overnight shift resolves like any other (it belongs to the day it starts)", async () => {
      const r = dataOf(await resolve("hrAll", eR, "2060-03-10").expect(200));
      expect(r).toMatchObject({ shift: { id: night } });
    });

    it("respects scope: a team lead resolves own-team employees only; other organizations get 404", async () => {
      await resolve("leadT1", eR, "2060-03-15").expect(200);
      await resolve("leadT1", emp2, "2060-03-15").expect(404);
      await resolve("hrB", eR, "2060-03-15").expect(404);
      await resolve("nobody", eR, "2060-03-15").expect(403);
    });

    it("400 for missing or invalid parameters", async () => {
      await get("hrAll", "/hr/shift-assignments/resolve").expect(400);
      await get(
        "hrAll",
        `/hr/shift-assignments/resolve?employeeId=${eR}`,
      ).expect(400);
      await get(
        "hrAll",
        `/hr/shift-assignments/resolve?employeeId=${eR}&date=2060-02-30`,
      ).expect(400);
      await get(
        "hrAll",
        "/hr/shift-assignments/resolve?employeeId=abc&date=2060-01-01",
      ).expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants (independent of the API)", () => {
    const base = () => ({
      organizationId: orgA.id,
      shiftId: day,
      effectiveFrom: new Date("2070-01-01T00:00:00Z"),
    });

    it("exactly one target", async () => {
      await expect(
        prisma.shiftAssignment.create({
          data: { ...base(), employeeId: emp1, teamId: team1 },
        }),
      ).rejects.toThrow(/shift_assignments_one_target_check/);
      await expect(
        prisma.shiftAssignment.create({ data: { ...base() } }),
      ).rejects.toThrow(/shift_assignments_one_target_check/);
    });

    it("the end date cannot precede the start", async () => {
      await expect(
        prisma.shiftAssignment.create({
          data: {
            ...base(),
            employeeId: emp2,
            effectiveTo: new Date("2069-12-31T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/shift_assignments_dates_check/);
    });

    it("overlap is rejected for employees and for teams, but not for voided rows", async () => {
      await prisma.shiftAssignment.create({
        data: {
          ...base(),
          employeeId: emp2,
          effectiveTo: new Date("2070-01-31T00:00:00Z"),
        },
      });
      await expect(
        prisma.shiftAssignment.create({
          data: {
            ...base(),
            employeeId: emp2,
            effectiveFrom: new Date("2070-01-31T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/shift_assignments_employee_no_overlap/);
      await prisma.shiftAssignment.create({
        data: {
          ...base(),
          teamId: team2,
          effectiveTo: new Date("2070-01-31T00:00:00Z"),
        },
      });
      await expect(
        prisma.shiftAssignment.create({
          data: {
            ...base(),
            teamId: team2,
            effectiveFrom: new Date("2070-01-15T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/shift_assignments_team_no_overlap/);
      // A voided row is ignored by the constraint.
      await prisma.shiftAssignment.create({
        data: { ...base(), employeeId: emp2, isActive: false },
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit", () => {
    it("assignment changes are attributable and secret-free", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: { in: ["shift", "shift_assignment"] },
        },
      });
      const actions = new Set(rows.map((r) => `${r.entityType}:${r.action}`));
      for (const expected of [
        "shift:create",
        "shift:update",
        "shift:deactivate",
        "shift_assignment:create",
        "shift_assignment:end",
        "shift_assignment:void",
      ]) {
        expect(actions).toContain(expected);
      }
      expect(
        rows.every(
          (r) => r.actorUserId !== null && r.organizationId === orgA.id,
        ),
      ).toBe(true);
      expect(JSON.stringify(rows.map((r) => [r.before, r.after]))).not.toMatch(
        /password|token|\$2[aby]\$/i,
      );
    });
  });
});
