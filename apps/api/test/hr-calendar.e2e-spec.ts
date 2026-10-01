import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { ClsService } from "nestjs-cls";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { CalendarQueryService } from "../src/modules/hr/calendar/calendar.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * HR calendar: holidays and weekly-off rules. Nothing is assumed (no default
 * weekly off, Sunday is not special), scope is organization / location / team,
 * history is preserved (end or void, never edit or delete), and the day lookup
 * returns every applicable rule without inventing a cross-scope precedence.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  description: string | null;
  workLocation: { id: number } | null;
  isActive: boolean;
}
interface Rule {
  id: number;
  name: string;
  daysOfWeek: number[];
  scope: "organization" | "location" | "team";
  workLocation: { id: number } | null;
  team: { id: number } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}
interface Day {
  date: string;
  weekday: number;
  employee: { id: number };
  holidays: Array<{ id: number; scope: string }>;
  weeklyOffRules: Array<{
    id: number;
    scope: string;
    daysOfWeek: number[];
    coversWeekday: boolean;
  }>;
}

const PERMS = [
  "hr.holiday.read",
  "hr.holiday.write",
  "hr.weekly_off.read",
  "hr.weekly_off.write",
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
];

describe("HR calendar (e2e)", () => {
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
  let loc1: number;
  let loc2: number;
  let locOff: number; // inactive location
  let locB: number;
  let empLoc1: number; // team 1, location 1
  let empLoc2: number; // team 2, location 2
  let empNone: number; // team 1, no location — linked to user "employee"
  let empB: number;

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
  const list = <T>(r: request.Response) => (r.body as Body<T[]>).data;

  const mkHoliday = async (body: object, who = "hrAll") =>
    ((await post(who, "/hr/holidays", body).expect(201)).body as Body<Holiday>)
      .data;
  const mkRule = async (body: object, who = "hrAll") =>
    (
      (await post(who, "/hr/weekly-off-rules", body).expect(201))
        .body as Body<Rule>
    ).data;

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
      data: { name: `Cal A ${suffix}`, slug: `cal-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Cal B ${suffix}`, slug: `cal-b-${suffix.toLowerCase()}` },
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
    const teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `TB${suffix}` },
      })
    ).id;
    loc1 = (
      await prisma.workLocation.create({
        data: {
          organizationId: orgA.id,
          code: `L1_${suffix}`,
          name: `Loc1 ${suffix}`,
        },
      })
    ).id;
    loc2 = (
      await prisma.workLocation.create({
        data: {
          organizationId: orgA.id,
          code: `L2_${suffix}`,
          name: `Loc2 ${suffix}`,
        },
      })
    ).id;
    locOff = (
      await prisma.workLocation.create({
        data: {
          organizationId: orgA.id,
          code: `L3_${suffix}`,
          name: `Loc3 ${suffix}`,
          isActive: false,
        },
      })
    ).id;
    locB = (
      await prisma.workLocation.create({
        data: {
          organizationId: orgB.id,
          code: `LB_${suffix}`,
          name: `LocB ${suffix}`,
        },
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
            employeeCode: `EMP-8${String(n).padStart(5, "0")}`,
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
    empLoc1 = await mkEmp(orgA.id, team1, 1, { workLocationId: loc1 });
    empLoc2 = await mkEmp(orgA.id, team2, 2, { workLocationId: loc2 });
    empB = await mkEmp(orgB.id, teamB, 1, { workLocationId: locB });

    await mkUser(orgA, "hrAll", [
      "hr.holiday.read",
      "hr.holiday.write",
      "hr.weekly_off.read",
      "hr.weekly_off.write",
      "hr.employee.read.all",
    ]);
    await mkUser(orgA, "reader", ["hr.holiday.read", "hr.weekly_off.read"]);
    await mkUser(
      orgA,
      "leadT1",
      ["hr.holiday.read", "hr.employee.read.team"],
      [team1],
    );
    const employee = await mkUser(orgA, "employee", [
      "hr.holiday.read",
      "hr.employee.read.own",
    ]);
    empNone = await mkEmp(orgA.id, team1, 3, { userId: employee.id });
    await mkUser(orgA, "onlyEmployeeRead", ["hr.employee.read.all"]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "hr.holiday.read",
      "hr.holiday.write",
      "hr.weekly_off.read",
      "hr.weekly_off.write",
      "hr.employee.read.all",
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
  describe("nothing is assumed", () => {
    it("a new organization has no holidays and no weekly-off rule — Sunday is not special", async () => {
      expect(list(await get("hrB", "/hr/holidays").expect(200))).toEqual([]);
      expect(
        list(await get("hrB", "/hr/weekly-off-rules").expect(200)),
      ).toEqual([]);
      const day = (
        (
          await get(
            "hrB",
            `/hr/calendar/day?employeeId=${empB}&date=2026-10-04`,
          ).expect(200)
        ).body as Body<Day>
      ).data; // a Sunday
      expect(day).toMatchObject({
        weekday: 7,
        holidays: [],
        weeklyOffRules: [],
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("holidays", () => {
    it("401 unauthenticated; 403 without permission; readers cannot write; no DELETE", async () => {
      await request(app.getHttpServer()).get("/hr/holidays").expect(401);
      await get("nobody", "/hr/holidays").expect(403);
      await get("employee", "/hr/holidays").expect(200); // every employee may read the calendar
      await post("employee", "/hr/holidays", {
        holidayDate: "2026-12-25",
        name: "Nope",
      }).expect(403);
      await request(app.getHttpServer())
        .delete("/hr/holidays/1")
        .set(auth("hrAll"))
        .expect(404);
    });

    it("creates an organization-wide holiday and audits it", async () => {
      const h = await mkHoliday({
        holidayDate: "2026-10-02",
        name: "Gandhi Jayanti",
        description: " national ",
      });
      expect(h).toMatchObject({
        holidayDate: "2026-10-02",
        name: "Gandhi Jayanti",
        description: "national",
        workLocation: null,
        isActive: true,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "holiday",
          entityId: BigInt(h.id),
          action: "create",
        },
      });
      expect(audit).toMatchObject({
        actorUserId: userIds.hrAll,
        organizationId: orgA.id,
      });
      expect(audit.after).toMatchObject({
        holidayDate: "2026-10-02",
        workLocationId: null,
      });
    });

    it("creates a location holiday; the same date may be both organization-wide and location-specific, and for different locations", async () => {
      await mkHoliday({
        holidayDate: "2026-11-01",
        name: "Local festival",
        workLocationId: loc1,
      });
      await mkHoliday({
        holidayDate: "2026-11-01",
        name: "Other local festival",
        workLocationId: loc2,
      });
      await mkHoliday({ holidayDate: "2026-11-01", name: "Org-wide same day" });
    });

    it("409 for a second active holiday on the same date and scope; one 201 under a concurrent race", async () => {
      await mkHoliday({ holidayDate: "2026-12-25", name: "Christmas" });
      expect(
        errorOf(
          await post("hrAll", "/hr/holidays", {
            holidayDate: "2026-12-25",
            name: "Again",
          }).expect(409),
        ),
      ).toBe("HOLIDAY_DATE_TAKEN");
      await mkHoliday({
        holidayDate: "2026-12-25",
        name: "Christmas at loc",
        workLocationId: loc1,
      });
      expect(
        errorOf(
          await post("hrAll", "/hr/holidays", {
            holidayDate: "2026-12-25",
            name: "Dup loc",
            workLocationId: loc1,
          }).expect(409),
        ),
      ).toBe("HOLIDAY_DATE_TAKEN");
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          post("hrAll", "/hr/holidays", {
            holidayDate: "2027-01-26",
            name: `Republic Day ${i}`,
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([
        201, 409, 409, 409, 409, 409,
      ]);
    });

    it.each([
      ["a missing date", { name: "x" }],
      ["a missing name", { holidayDate: "2028-01-01" }],
      ["an impossible date", { holidayDate: "2028-02-30", name: "x" }],
      ["a non-ISO date", { holidayDate: "01/01/2028", name: "x" }],
      ["a blank name", { holidayDate: "2028-01-01", name: "  " }],
      [
        "a 151-character name",
        { holidayDate: "2028-01-01", name: "n".repeat(151) },
      ],
      [
        "a 501-character description",
        { holidayDate: "2028-01-01", name: "x", description: "d".repeat(501) },
      ],
      [
        "a non-numeric location",
        { holidayDate: "2028-01-01", name: "x", workLocationId: "a" },
      ],
      [
        "an unknown field",
        { holidayDate: "2028-01-01", name: "x", isActive: false },
      ],
      [
        "a client-supplied organizationId",
        { holidayDate: "2028-01-01", name: "x", organizationId: 9 },
      ],
    ])("400 for %s", async (_l, body) => {
      await post("hrAll", "/hr/holidays", body).expect(400);
    });

    it("422 for a missing, inactive or other-organization location", async () => {
      for (const id of [999999999, () => locOff, () => locB]) {
        const workLocationId = typeof id === "function" ? id() : id;
        expect(
          errorOf(
            await post("hrAll", "/hr/holidays", {
              holidayDate: "2028-03-03",
              name: "x",
              workLocationId,
            }).expect(422),
          ),
        ).toBe("INVALID_WORK_LOCATION");
      }
    });

    it("renames/describes but the date and the location scope are immutable", async () => {
      const h = await mkHoliday({ holidayDate: "2028-04-04", name: "Before" });
      const upd = (
        (
          await patch("hrAll", `/hr/holidays/${h.id}`, {
            name: "After",
            description: "why",
          }).expect(200)
        ).body as Body<Holiday>
      ).data;
      expect(upd).toMatchObject({
        name: "After",
        description: "why",
        holidayDate: "2028-04-04",
      });
      await patch("hrAll", `/hr/holidays/${h.id}`, {
        holidayDate: "2028-04-05",
      }).expect(400);
      await patch("hrAll", `/hr/holidays/${h.id}`, {
        workLocationId: loc1,
      }).expect(400);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "holiday",
          entityId: BigInt(h.id),
          action: "update",
        },
      });
      expect(audit.before).toMatchObject({ name: "Before" });
      expect(audit.after).toMatchObject({ name: "After" });
      // No-op: same values, no extra audit row.
      await patch("hrAll", `/hr/holidays/${h.id}`, { name: "After" }).expect(
        200,
      );
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "holiday",
            entityId: BigInt(h.id),
            action: "update",
          },
        }),
      ).toBe(1);
    });

    it("a wrong entry is deactivated (kept for history) and re-entered; reactivating the old one then conflicts", async () => {
      const wrong = await mkHoliday({
        holidayDate: "2028-05-05",
        name: "Wrong name",
      });
      const off = (
        (await post("hrAll", `/hr/holidays/${wrong.id}/deactivate`).expect(200))
          .body as Body<Holiday>
      ).data;
      expect(off.isActive).toBe(false);
      await post("hrAll", `/hr/holidays/${wrong.id}/deactivate`).expect(200); // idempotent
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "holiday",
            entityId: BigInt(wrong.id),
            action: "deactivate",
          },
        }),
      ).toBe(1);
      await get("hrAll", `/hr/holidays/${wrong.id}`).expect(200); // still readable
      const replacement = await mkHoliday({
        holidayDate: "2028-05-05",
        name: "Right name",
      });
      expect(
        errorOf(
          await post("hrAll", `/hr/holidays/${wrong.id}/activate`).expect(409),
        ),
      ).toBe("HOLIDAY_DATE_TAKEN");
      await post("hrAll", `/hr/holidays/${replacement.id}/deactivate`).expect(
        200,
      );
      await post("hrAll", `/hr/holidays/${wrong.id}/activate`).expect(200);
    });

    it("lists by year, range, location, organization-wide and active state, sorted by date, with pagination", async () => {
      const y2026 = list<Holiday>(
        await get("hrAll", "/hr/holidays?year=2026&limit=100").expect(200),
      );
      expect(y2026.every((h) => h.holidayDate.startsWith("2026"))).toBe(true);
      const dates = y2026.map((h) => h.holidayDate);
      expect(dates).toEqual([...dates].sort());
      const range = list<Holiday>(
        await get(
          "hrAll",
          "/hr/holidays?from=2026-10-01&to=2026-10-31&limit=100",
        ).expect(200),
      );
      expect(range.map((h) => h.name)).toEqual(["Gandhi Jayanti"]);
      const atLoc1 = list<Holiday>(
        await get(
          "hrAll",
          `/hr/holidays?workLocationId=${loc1}&limit=100`,
        ).expect(200),
      );
      expect(atLoc1.length).toBeGreaterThan(0);
      expect(atLoc1.every((h) => h.workLocation?.id === loc1)).toBe(true);
      const orgWide = list<Holiday>(
        await get(
          "hrAll",
          "/hr/holidays?organizationWide=true&limit=100",
        ).expect(200),
      );
      expect(orgWide.every((h) => h.workLocation === null)).toBe(true);
      const inactive = list<Holiday>(
        await get("hrAll", "/hr/holidays?isActive=false&limit=100").expect(200),
      );
      expect(inactive.every((h) => !h.isActive)).toBe(true);
      const page = (
        await get("hrAll", "/hr/holidays?limit=2&page=2").expect(200)
      ).body as Body<Holiday[]>;
      expect(page.data).toHaveLength(2);
      expect(page.meta).toMatchObject({ page: 2, limit: 2 });
      const desc = list<Holiday>(
        await get(
          "hrAll",
          "/hr/holidays?year=2026&order=desc&limit=100",
        ).expect(200),
      ).map((h) => h.holidayDate);
      expect(desc).toEqual([...desc].sort().reverse());
    });

    it.each([
      ["year together with a range", "year=2026&from=2026-01-01"],
      ["from after to", "from=2026-12-01&to=2026-01-01"],
      [
        "organizationWide with a location",
        `organizationWide=true&workLocationId=1`,
      ],
      ["a bad year", "year=1800"],
      ["a bad flag", "isActive=maybe"],
      ["a bad date", "from=2026-13-01"],
    ])("400 for %s", async (_l, qs) => {
      await get("hrAll", `/hr/holidays?${qs}`).expect(400);
    });

    it("another organization cannot see, change or deactivate these holidays and may reuse the date", async () => {
      const h = await mkHoliday({
        holidayDate: "2029-01-01",
        name: "New Year",
      });
      expect(
        list<Holiday>(
          await get("hrB", "/hr/holidays?limit=100").expect(200),
        ).map((x) => x.id),
      ).not.toContain(h.id);
      await get("hrB", `/hr/holidays/${h.id}`).expect(404);
      await patch("hrB", `/hr/holidays/${h.id}`, { name: "Hijack" }).expect(
        404,
      );
      await post("hrB", `/hr/holidays/${h.id}/deactivate`).expect(404);
      await post("hrB", "/hr/holidays", {
        holidayDate: "2029-01-01",
        name: "New Year B",
      }).expect(201);
      expect(
        errorOf(
          await post("hrB", "/hr/holidays", {
            holidayDate: "2029-06-01",
            name: "x",
            workLocationId: loc1,
          }).expect(422),
        ),
      ).toBe("INVALID_WORK_LOCATION");
    });

    it("404 for unknown and 400 for non-numeric ids", async () => {
      await get("hrAll", "/hr/holidays/999999999").expect(404);
      await get("hrAll", "/hr/holidays/abc").expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("weekly-off rules", () => {
    it("401 unauthenticated; 403 without permission; readers cannot write; no DELETE", async () => {
      await request(app.getHttpServer())
        .get("/hr/weekly-off-rules")
        .expect(401);
      await get("nobody", "/hr/weekly-off-rules").expect(403);
      await get("reader", "/hr/weekly-off-rules").expect(200);
      await post("reader", "/hr/weekly-off-rules", {
        name: "x",
        daysOfWeek: [7],
        effectiveFrom: "2030-01-01",
      }).expect(403);
      await request(app.getHttpServer())
        .delete("/hr/weekly-off-rules/1")
        .set(auth("hrAll"))
        .expect(404);
    });

    it("creates an organization-wide rule, normalizes days (sorted, unique) and audits it", async () => {
      const r = await mkRule({
        name: "Weekend",
        daysOfWeek: [7, 6, 6],
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      });
      expect(r).toMatchObject({
        scope: "organization",
        daysOfWeek: [6, 7],
        workLocation: null,
        team: null,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "weekly_off_rule",
          entityId: BigInt(r.id),
          action: "create",
        },
      });
      expect(audit).toMatchObject({ actorUserId: userIds.hrAll });
      expect(audit.after).toMatchObject({
        daysOfWeek: [6, 7],
        workLocationId: null,
        teamId: null,
      });
    });

    it("Sunday is not special: a Friday-only rule is stored as given", async () => {
      const r = await mkRule({
        name: "Friday off",
        daysOfWeek: [5],
        teamId: team2,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      });
      expect(r).toMatchObject({
        scope: "team",
        daysOfWeek: [5],
        team: { id: team2 },
      });
    });

    it.each([
      ["no days", { daysOfWeek: [] }],
      ["day 0", { daysOfWeek: [0] }],
      ["day 8", { daysOfWeek: [8] }],
      ["a negative day", { daysOfWeek: [-1] }],
      ["a string day", { daysOfWeek: ["Sunday"] }],
      ["a non-array", { daysOfWeek: 7 }],
      ["a fractional day", { daysOfWeek: [1.5] }],
      ["a missing name", { name: undefined }],
      ["a missing start date", { effectiveFrom: undefined }],
      ["an impossible date", { effectiveFrom: "2030-02-30" }],
      ["an unknown field", { isActive: false }],
    ])("400 for %s", async (_l, over) => {
      await post("hrAll", "/hr/weekly-off-rules", {
        name: "x",
        daysOfWeek: [7],
        effectiveFrom: "2031-01-01",
        ...over,
      }).expect(400);
    });

    it.each([
      [
        "both a location and a team",
        () => ({ workLocationId: loc1, teamId: team1 }),
        "WEEKLY_OFF_SCOPE_INVALID",
      ],
      [
        "effectiveTo before effectiveFrom",
        () => ({ effectiveFrom: "2031-05-10", effectiveTo: "2031-05-09" }),
        "WEEKLY_OFF_DATES_INVALID",
      ],
      [
        "a missing location",
        () => ({ workLocationId: 999999999 }),
        "INVALID_WORK_LOCATION",
      ],
      [
        "an inactive location",
        () => ({ workLocationId: locOff }),
        "INVALID_WORK_LOCATION",
      ],
      [
        "another organization's location",
        () => ({ workLocationId: locB }),
        "INVALID_WORK_LOCATION",
      ],
      ["a missing team", () => ({ teamId: 999999999 }), "INVALID_TEAM"],
    ])("422 for %s", async (_l, over, code) => {
      expect(
        errorOf(
          await post("hrAll", "/hr/weekly-off-rules", {
            name: "x",
            daysOfWeek: [7],
            effectiveFrom: "2031-01-01",
            ...over(),
          }).expect(422),
        ),
      ).toBe(code);
    });

    it("rejects an overlapping rule of the SAME scope (409, naming the clash), but allows other scopes and adjacent dates", async () => {
      const res = await post("hrAll", "/hr/weekly-off-rules", {
        name: "Clash",
        daysOfWeek: [1],
        effectiveFrom: "2026-06-01",
        effectiveTo: "2027-01-31",
      }).expect(409);
      expect(errorOf(res)).toBe("WEEKLY_OFF_OVERLAP");
      expect((res.body as { message: string }).message).toMatch(
        /2026-01-01 to 2026-12-31/,
      );
      await mkRule({
        name: "Team 1 Mondays",
        daysOfWeek: [1],
        teamId: team1,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      }); // other scope: fine
      await mkRule({
        name: "Loc 1 Sundays",
        daysOfWeek: [7],
        workLocationId: loc1,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
      });
      await mkRule({
        name: "Next year weekend",
        daysOfWeek: [6, 7],
        effectiveFrom: "2027-01-01",
        effectiveTo: "2027-12-31",
      }); // the day after 2026-12-31
    });

    it("of 8 simultaneous overlapping rules of one scope exactly one wins, none is a 500", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          post("hrAll", "/hr/weekly-off-rules", {
            name: "Race",
            daysOfWeek: [3],
            workLocationId: loc2,
            effectiveFrom: "2040-01-01",
            effectiveTo: "2040-12-31",
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([
        201, 409, 409, 409, 409, 409, 409, 409,
      ]);
    });

    it("ending shortens a rule (never extends), is idempotent, and history stays answerable", async () => {
      const old = await mkRule({
        name: "Old pattern",
        daysOfWeek: [6],
        workLocationId: loc2,
        effectiveFrom: "2041-01-01",
        effectiveTo: "2041-12-31",
      });
      const ended = (
        (
          await post("hrAll", `/hr/weekly-off-rules/${old.id}/end`, {
            effectiveTo: "2041-06-30",
            reason: "new pattern",
          }).expect(200)
        ).body as Body<Rule>
      ).data;
      expect(ended.effectiveTo).toBe("2041-06-30");
      const replacement = await mkRule({
        name: "New pattern",
        daysOfWeek: [5, 6],
        workLocationId: loc2,
        effectiveFrom: "2041-07-01",
        effectiveTo: "2041-12-31",
      });
      expect(
        errorOf(
          await post("hrAll", `/hr/weekly-off-rules/${old.id}/end`, {
            effectiveTo: "2041-09-01",
          }).expect(422),
        ),
      ).toBe("WEEKLY_OFF_CANNOT_EXTEND");
      expect(
        errorOf(
          await post("hrAll", `/hr/weekly-off-rules/${old.id}/end`, {
            effectiveTo: "2040-12-31",
          }).expect(422),
        ),
      ).toBe("WEEKLY_OFF_DATES_INVALID");
      const before = await prisma.auditLog.count({
        where: {
          entityType: "weekly_off_rule",
          entityId: BigInt(old.id),
          action: "end",
        },
      });
      await post("hrAll", `/hr/weekly-off-rules/${old.id}/end`, {
        effectiveTo: "2041-06-30",
      }).expect(200);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "weekly_off_rule",
            entityId: BigInt(old.id),
            action: "end",
          },
        }),
      ).toBe(before);
      // What was off on a past date is still answerable — from the rule that applied THEN.
      const inMay = list<Rule>(
        await get(
          "hrAll",
          `/hr/weekly-off-rules?workLocationId=${loc2}&activeOn=2041-05-15`,
        ).expect(200),
      );
      expect(inMay.map((r) => [r.id, r.daysOfWeek])).toEqual([[old.id, [6]]]);
      const inAug = list<Rule>(
        await get(
          "hrAll",
          `/hr/weekly-off-rules?workLocationId=${loc2}&activeOn=2041-08-15`,
        ).expect(200),
      );
      expect(inAug.map((r) => [r.id, r.daysOfWeek])).toEqual([
        [replacement.id, [5, 6]],
      ]);
    });

    it("voiding keeps the row, needs a reason, frees the dates, and a voided rule cannot be ended", async () => {
      const r = await mkRule({
        name: "Mistake",
        daysOfWeek: [2],
        workLocationId: loc2,
        effectiveFrom: "2042-01-01",
        effectiveTo: "2042-12-31",
      });
      await post("hrAll", `/hr/weekly-off-rules/${r.id}/void`, {}).expect(400);
      await post("hrAll", `/hr/weekly-off-rules/${r.id}/void`, {
        reason: "no",
      }).expect(400);
      const v = (
        (
          await post("hrAll", `/hr/weekly-off-rules/${r.id}/void`, {
            reason: "entered by mistake",
          }).expect(200)
        ).body as Body<Rule>
      ).data;
      expect(v.isActive).toBe(false);
      await post("hrAll", `/hr/weekly-off-rules/${r.id}/void`, {
        reason: "entered by mistake",
      }).expect(200);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "weekly_off_rule",
            entityId: BigInt(r.id),
            action: "void",
          },
        }),
      ).toBe(1);
      expect(
        list<Rule>(
          await get(
            "hrAll",
            `/hr/weekly-off-rules?workLocationId=${loc2}&activeOn=2042-05-01`,
          ).expect(200),
        ),
      ).toEqual([]);
      expect(
        list<Rule>(
          await get(
            "hrAll",
            `/hr/weekly-off-rules?workLocationId=${loc2}&activeOn=2042-05-01&includeVoided=true`,
          ).expect(200),
        ).map((x) => x.id),
      ).toEqual([r.id]);
      await mkRule({
        name: "Correct",
        daysOfWeek: [3],
        workLocationId: loc2,
        effectiveFrom: "2042-01-01",
        effectiveTo: "2042-12-31",
      });
      expect(
        errorOf(
          await post("hrAll", `/hr/weekly-off-rules/${r.id}/end`, {
            effectiveTo: "2042-06-01",
          }).expect(422),
        ),
      ).toBe("WEEKLY_OFF_VOIDED");
    });

    it("only the label changes in place — days and dates are rejected on PATCH", async () => {
      const r = await mkRule({
        name: "Label",
        daysOfWeek: [4],
        workLocationId: loc2,
        effectiveFrom: "2043-01-01",
        effectiveTo: "2043-12-31",
      });
      const upd = (
        (
          await patch("hrAll", `/hr/weekly-off-rules/${r.id}`, {
            name: "Renamed",
            description: "why",
          }).expect(200)
        ).body as Body<Rule>
      ).data;
      expect(upd.name).toBe("Renamed");
      await patch("hrAll", `/hr/weekly-off-rules/${r.id}`, {
        daysOfWeek: [1],
      }).expect(400);
      await patch("hrAll", `/hr/weekly-off-rules/${r.id}`, {
        effectiveFrom: "2043-02-01",
      }).expect(400);
    });

    it("lists by scope, location, team and date, with pagination", async () => {
      expect(
        list<Rule>(
          await get(
            "hrAll",
            "/hr/weekly-off-rules?scope=organization&limit=100",
          ).expect(200),
        ).every((r) => r.scope === "organization"),
      ).toBe(true);
      expect(
        list<Rule>(
          await get(
            "hrAll",
            "/hr/weekly-off-rules?scope=team&limit=100",
          ).expect(200),
        ).every((r) => r.scope === "team"),
      ).toBe(true);
      expect(
        list<Rule>(
          await get(
            "hrAll",
            "/hr/weekly-off-rules?scope=location&limit=100",
          ).expect(200),
        ).every((r) => r.scope === "location"),
      ).toBe(true);
      expect(
        list<Rule>(
          await get("hrAll", `/hr/weekly-off-rules?teamId=${team2}`).expect(
            200,
          ),
        ).every((r) => r.team?.id === team2),
      ).toBe(true);
      const page = (
        await get("hrAll", "/hr/weekly-off-rules?limit=2&page=1").expect(200)
      ).body as Body<Rule[]>;
      expect(page.data).toHaveLength(2);
      expect(page.meta?.total).toBeGreaterThan(2);
    });

    it.each([
      ["a bad scope", "scope=galaxy"],
      ["a bad date", "activeOn=2026-13-40"],
      ["a bad flag", "includeVoided=maybe"],
      ["limit above 100", "limit=101"],
    ])("400 for %s", async (_l, qs) => {
      await get("hrAll", `/hr/weekly-off-rules?${qs}`).expect(400);
    });

    it("another organization cannot see, end or void these rules", async () => {
      const r = await mkRule({
        name: "Isolated",
        daysOfWeek: [1],
        effectiveFrom: "2050-01-01",
        effectiveTo: "2050-12-31",
      });
      await get("hrB", `/hr/weekly-off-rules/${r.id}`).expect(404);
      await post("hrB", `/hr/weekly-off-rules/${r.id}/end`, {
        effectiveTo: "2050-06-01",
      }).expect(404);
      await post("hrB", `/hr/weekly-off-rules/${r.id}/void`, {
        reason: "hijack it",
      }).expect(404);
      expect(
        list<Rule>(
          await get("hrB", "/hr/weekly-off-rules?limit=100").expect(200),
        ).map((x) => x.id),
      ).not.toContain(r.id);
      expect(
        (await prisma.weeklyOffRule.findUniqueOrThrow({ where: { id: r.id } }))
          .isActive,
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe("the day lookup: which holidays and weekly-off rules apply to an employee", () => {
    // 2060-02-06 is a Friday (ISO 5) and 2060-02-08 a Sunday (ISO 7) — verified with Date.getUTCDay(), not assumed.
    let orgHoliday: Holiday;
    let loc1Holiday: Holiday;
    let orgRule: Rule;
    let teamRule: Rule;
    let locRule: Rule;
    const day = async (who: string, employeeId: number, date: string) =>
      (
        (
          await get(
            who,
            `/hr/calendar/day?employeeId=${employeeId}&date=${date}`,
          ).expect(200)
        ).body as Body<Day>
      ).data;

    beforeAll(async () => {
      orgHoliday = await mkHoliday({
        holidayDate: "2060-02-06",
        name: "Org holiday",
      });
      loc1Holiday = await mkHoliday({
        holidayDate: "2060-02-06",
        name: "Loc1 holiday",
        workLocationId: loc1,
      });
      await mkHoliday({
        holidayDate: "2060-02-06",
        name: "Loc2 holiday",
        workLocationId: loc2,
      });
      orgRule = await mkRule({
        name: "Org weekend",
        daysOfWeek: [6, 7],
        effectiveFrom: "2060-01-01",
        effectiveTo: "2060-12-31",
      });
      teamRule = await mkRule({
        name: "Team 1 Friday",
        daysOfWeek: [5],
        teamId: team1,
        effectiveFrom: "2060-01-01",
        effectiveTo: "2060-12-31",
      });
      locRule = await mkRule({
        name: "Loc1 Thursday",
        daysOfWeek: [4],
        workLocationId: loc1,
        effectiveFrom: "2060-01-01",
        effectiveTo: "2060-12-31",
      });
      // Not applicable to anyone here: team 2's rule, and a rule that is voided.
      await mkRule({
        name: "Team 2 Monday",
        daysOfWeek: [1],
        teamId: team2,
        effectiveFrom: "2060-01-01",
        effectiveTo: "2060-12-31",
      });
      const voided = await mkRule({
        name: "Voided",
        daysOfWeek: [5],
        workLocationId: loc1,
        effectiveFrom: "2061-01-01",
        effectiveTo: "2061-12-31",
      });
      await post("hrAll", `/hr/weekly-off-rules/${voided.id}/void`, {
        reason: "entered by mistake",
      }).expect(200);
    });

    it("returns the holidays of the employee's location and organization — not another location's", async () => {
      const d = await day("hrAll", empLoc1, "2060-02-06");
      expect(d).toMatchObject({
        date: "2060-02-06",
        weekday: 5,
        employee: { id: empLoc1 },
      });
      expect(d.holidays.map((h) => h.id).sort()).toEqual(
        [orgHoliday.id, loc1Holiday.id].sort(),
      );
      expect(d.holidays.map((h) => h.scope).sort()).toEqual([
        "location",
        "organization",
      ]);
    });

    it("an employee with no location gets organization-wide holidays only", async () => {
      const d = await day("hrAll", empNone, "2060-02-06");
      expect(d.holidays.map((h) => h.id)).toEqual([orgHoliday.id]);
    });

    it("returns every applicable weekly-off rule (org, location, team) with whether it covers the weekday — and no verdict", async () => {
      const d = await day("hrAll", empLoc1, "2060-02-06"); // Friday
      const byId = new Map(d.weeklyOffRules.map((r) => [r.id, r]));
      expect([...byId.keys()].sort()).toEqual(
        [orgRule.id, teamRule.id, locRule.id].sort(),
      );
      expect(byId.get(orgRule.id)).toMatchObject({
        scope: "organization",
        coversWeekday: false,
      }); // Sat/Sun only
      expect(byId.get(teamRule.id)).toMatchObject({
        scope: "team",
        coversWeekday: true,
      }); // Friday
      expect(byId.get(locRule.id)).toMatchObject({
        scope: "location",
        coversWeekday: false,
      }); // Thursday
      // The API states facts, not a decision the business has not made.
      expect(d).not.toHaveProperty("isWeeklyOff");
      expect(d).not.toHaveProperty("isHoliday");
      expect(d).not.toHaveProperty("isWorkingDay");
    });

    it("rules of another team or location do not appear", async () => {
      // empLoc2 is in team 2 at location 2: it gets the organization rule and
      // team 2's Monday rule — never team 1's Friday or location 1's Thursday.
      const d2 = await day("hrAll", empLoc2, "2060-02-06");
      expect(d2.weeklyOffRules.map((r) => r.scope).sort()).toEqual([
        "organization",
        "team",
      ]);
      const ids = d2.weeklyOffRules.map((r) => r.id);
      expect(ids).toContain(orgRule.id);
      expect(ids).not.toContain(teamRule.id);
      expect(ids).not.toContain(locRule.id);
      // ...and location 2's holiday, not location 1's.
      expect(d2.holidays.map((h) => h.scope).sort()).toEqual([
        "location",
        "organization",
      ]);
      expect(d2.holidays.map((h) => h.id)).not.toContain(loc1Holiday.id);
    });

    it("a Sunday is off only if a rule says so: the org weekend rule covers it, nothing else does", async () => {
      const d = await day("hrAll", empNone, "2060-02-08"); // Sunday
      expect(d.weekday).toBe(7);
      expect(
        d.weeklyOffRules.filter((r) => r.coversWeekday).map((r) => r.id),
      ).toEqual([orgRule.id]);
    });

    it("dates are inclusive at both ends of a rule and it disappears outside them", async () => {
      expect(
        (await day("hrAll", empNone, "2060-01-01")).weeklyOffRules.length,
      ).toBeGreaterThan(0);
      expect(
        (await day("hrAll", empNone, "2060-12-31")).weeklyOffRules.length,
      ).toBeGreaterThan(0);
      expect(
        (await day("hrAll", empNone, "2059-12-31")).weeklyOffRules,
      ).toEqual([]);
      expect(
        (await day("hrAll", empNone, "2061-01-01")).weeklyOffRules,
      ).toEqual([]); // the voided rule is ignored
    });

    it("a deactivated holiday no longer applies", async () => {
      const gone = await mkHoliday({
        holidayDate: "2060-03-03",
        name: "Soon gone",
      });
      expect(
        (await day("hrAll", empNone, "2060-03-03")).holidays.map((h) => h.id),
      ).toEqual([gone.id]);
      await post("hrAll", `/hr/holidays/${gone.id}/deactivate`).expect(200);
      expect((await day("hrAll", empNone, "2060-03-03")).holidays).toEqual([]);
    });

    it("respects employee scope: a team lead sees own-team employees; .own sees only itself; others get 404", async () => {
      await day("leadT1", empLoc1, "2060-02-06");
      await get(
        "leadT1",
        `/hr/calendar/day?employeeId=${empLoc2}&date=2060-02-06`,
      ).expect(404);
      await day("employee", empNone, "2060-02-06");
      await get(
        "employee",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`,
      ).expect(404);
      await get(
        "hrB",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`,
      ).expect(404);
    });

    it("needs BOTH the calendar permission and employee read scope", async () => {
      await get(
        "onlyEmployeeRead",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`,
      ).expect(403);
      await get(
        "reader",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`,
      ).expect(403);
      await get(
        "nobody",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`,
      ).expect(403);
      await request(app.getHttpServer())
        .get(`/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-06`)
        .expect(401);
    });

    it("400 for missing or invalid parameters", async () => {
      await get("hrAll", "/hr/calendar/day").expect(400);
      await get("hrAll", `/hr/calendar/day?employeeId=${empLoc1}`).expect(400);
      await get(
        "hrAll",
        `/hr/calendar/day?employeeId=${empLoc1}&date=2060-02-30`,
      ).expect(400);
      await get(
        "hrAll",
        "/hr/calendar/day?employeeId=abc&date=2060-02-06",
      ).expect(400);
    });

    it("the exported CalendarQueryService gives the same answer to trusted server-side callers", async () => {
      const cls = app.get(ClsService);
      const svc = app.get(CalendarQueryService);
      const result = await cls.run(async () => {
        cls.set("organizationId", orgA.id);
        cls.set("userId", userIds.hrAll);
        return svc.dayFor(empLoc1, parseDateOnly("2060-02-06"));
      });
      expect(result?.weeklyOffRules.map((r) => r.id).sort()).toEqual(
        [orgRule.id, teamRule.id, locRule.id].sort(),
      );
      const other = await cls.run(async () => {
        cls.set("organizationId", orgB.id);
        cls.set("userId", userIds.hrB);
        return svc.dayFor(empLoc1, parseDateOnly("2060-02-06"));
      });
      expect(other).toBeNull(); // another organization's employee
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants (independent of the API)", () => {
    const base = () => ({
      organizationId: orgA.id,
      name: "db",
      effectiveFrom: new Date("2070-01-01T00:00:00Z"),
    });

    it("one active holiday per date and scope, enforced by partial unique indexes", async () => {
      const d = new Date("2070-05-05T00:00:00Z");
      await prisma.holiday.create({
        data: { organizationId: orgA.id, holidayDate: d, name: "a" },
      });
      await expect(
        prisma.holiday.create({
          data: { organizationId: orgA.id, holidayDate: d, name: "b" },
        }),
      ).rejects.toThrow(/Unique constraint|holidays_org_date/);
      await prisma.holiday.create({
        data: {
          organizationId: orgA.id,
          holidayDate: d,
          name: "loc",
          workLocationId: loc1,
        },
      });
      await expect(
        prisma.holiday.create({
          data: {
            organizationId: orgA.id,
            holidayDate: d,
            name: "loc2",
            workLocationId: loc1,
          },
        }),
      ).rejects.toThrow(/Unique constraint|holidays_org_date/);
      await prisma.holiday.create({
        data: {
          organizationId: orgA.id,
          holidayDate: d,
          name: "inactive",
          isActive: false,
        },
      }); // ignored
    });

    it("weekly-off days must be ISO weekdays, non-empty; scope is one of org/location/team", async () => {
      await expect(
        prisma.weeklyOffRule.create({ data: { ...base(), daysOfWeek: [] } }),
      ).rejects.toThrow(/weekly_off_rules_days_check/);
      await expect(
        prisma.weeklyOffRule.create({ data: { ...base(), daysOfWeek: [0] } }),
      ).rejects.toThrow(/weekly_off_rules_days_check/);
      await expect(
        prisma.weeklyOffRule.create({ data: { ...base(), daysOfWeek: [8] } }),
      ).rejects.toThrow(/weekly_off_rules_days_check/);
      await expect(
        prisma.weeklyOffRule.create({
          data: {
            ...base(),
            daysOfWeek: [7],
            workLocationId: loc1,
            teamId: team1,
          },
        }),
      ).rejects.toThrow(/weekly_off_rules_one_scope_check/);
      await expect(
        prisma.weeklyOffRule.create({
          data: {
            ...base(),
            daysOfWeek: [7],
            effectiveTo: new Date("2069-12-31T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/weekly_off_rules_dates_check/);
    });

    it("overlap is rejected per scope (including the NULL 'whole organization' scope) but not for voided rows", async () => {
      await prisma.weeklyOffRule.create({
        data: {
          ...base(),
          daysOfWeek: [7],
          effectiveTo: new Date("2070-01-31T00:00:00Z"),
        },
      });
      await expect(
        prisma.weeklyOffRule.create({
          data: {
            ...base(),
            daysOfWeek: [6],
            effectiveFrom: new Date("2070-01-31T00:00:00Z"),
          },
        }),
      ).rejects.toThrow(/weekly_off_rules_scope_no_overlap/);
      await prisma.weeklyOffRule.create({
        data: {
          ...base(),
          daysOfWeek: [6],
          effectiveFrom: new Date("2070-02-01T00:00:00Z"),
        },
      }); // adjacent
      await prisma.weeklyOffRule.create({
        data: { ...base(), daysOfWeek: [6], isActive: false },
      }); // voided: ignored
      await prisma.weeklyOffRule.create({
        data: { ...base(), daysOfWeek: [6], teamId: team1 },
      }); // another scope
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit", () => {
    it("calendar changes are attributable and secret-free", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: { in: ["holiday", "weekly_off_rule"] },
        },
      });
      const actions = new Set(rows.map((r) => `${r.entityType}:${r.action}`));
      for (const e of [
        "holiday:create",
        "holiday:update",
        "holiday:deactivate",
        "holiday:activate",
        "weekly_off_rule:create",
        "weekly_off_rule:update",
        "weekly_off_rule:end",
        "weekly_off_rule:void",
      ]) {
        expect(actions).toContain(e);
      }
      expect(
        rows.every(
          (r) => r.actorUserId !== null && r.organizationId === orgA.id,
        ),
      ).toBe(true);
    });
  });
});
