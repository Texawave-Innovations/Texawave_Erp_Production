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
 * Attendance reports (e2e): missing punches and overtime. Dates are fixed in
 * the past (June 2026) so the outcome does not depend on the clock.
 *
 * Employees with an OPEN session have no shift, so the live auto-checkout
 * scheduler can never close them while this suite runs (it needs a target).
 */
interface Body<T> {
  data: T;
}
interface MissingRow {
  employee: { id: number };
  attendanceDate: string;
  type: string;
}
interface OvertimeRow {
  employee: { id: number };
  daysWithOvertime: number;
  overtimeMinutes: number;
  days: { attendanceDate: string; overtimeMinutes: number }[];
}
interface DailyRow {
  employee: { id: number };
  status: string;
  shortfallMinutes: number;
  workedMinutes: number;
}

const PERMS = [
  "hr.attendance_report.read.own",
  "hr.attendance_report.read.team",
  "hr.attendance_report.read.all",
];
const d = (day: string) => new Date(`${day}T00:00:00Z`);
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

describe("HR attendance reports (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  const emp: Record<string, number> = {};
  const team: Record<string, number> = {};
  let empCounter = 0;
  let hrUserId = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const list = <T>(r: request.Response) => (r.body as Body<T[]>).data;

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `rep-${key}-${suffix}` },
    });
    await prisma.rolePermission.createMany({
      data: codes.map((c) => ({ roleId: role.id, permissionId: perm.get(c)! })),
    });
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
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    return user;
  }

  async function mkEmp(orgId: number, teamId: number, userId?: number) {
    const n = ++empCounter;
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
          employeeCode: `EMP-${200000 + n}`,
          fullName: `Rep Emp ${n}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2025-01-01T00:00:00Z"),
          ...(userId ? { userId } : {}),
        },
      })
    ).id;
  }

  const record = (
    orgId: number,
    employeeId: number,
    day: string,
    status: string | null = null,
  ) =>
    prisma.attendanceRecord.create({
      data: {
        organizationId: orgId,
        employeeId,
        attendanceDate: d(day),
        status,
      },
    });
  const session = (recordId: number, inAt: Date, outAt: Date | null) =>
    prisma.attendanceSession.create({
      data: {
        attendanceRecordId: recordId,
        checkInAt: inAt,
        checkOutAt: outAt,
        source: "HR",
      },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    orgA = await prisma.organization.create({
      data: { name: `Rep A ${suffix}`, slug: `rep-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Rep B ${suffix}`, slug: `rep-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team.A = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "A", code: `TA${suffix}` },
      })
    ).id;
    team.B = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "B", code: `TB${suffix}` },
      })
    ).id;
    team.C = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "C", code: `TC${suffix}` },
      })
    ).id;
    const teamOther = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "X", code: `TX${suffix}` },
      })
    ).id;

    // 8-hour shift for team A.
    const shift = await prisma.shift.create({
      data: {
        organizationId: orgA.id,
        code: `S8${suffix}`,
        name: "Eight hours",
        startTime: "10:00",
        endTime: "18:30",
        isOvernight: false,
        workingMinutes: 480,
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        organizationId: orgA.id,
        shiftId: shift.id,
        teamId: team.A,
        effectiveFrom: d("2026-01-01"),
      },
    });

    // Calendar: org holiday 4 June; org weekly off Sunday; team A weekly off Friday and Sunday.
    await prisma.holiday.create({
      data: {
        organizationId: orgA.id,
        holidayDate: d("2026-06-04"),
        name: "Holiday",
      },
    });
    await prisma.weeklyOffRule.create({
      data: {
        organizationId: orgA.id,
        name: "Org Sunday",
        daysOfWeek: [7],
        effectiveFrom: d("2026-01-01"),
      },
    });
    await prisma.weeklyOffRule.create({
      data: {
        organizationId: orgA.id,
        name: "Team A",
        daysOfWeek: [5, 7],
        teamId: team.A,
        effectiveFrom: d("2026-01-01"),
      },
    });

    const leaveType = await prisma.leaveType.create({
      data: { organizationId: orgA.id, code: `CL${suffix}`, name: "Casual" },
    });

    const hr = await mkUser(orgA, "hrAll", ["hr.attendance_report.read.all"]);
    hrUserId = hr.id;
    await mkUser(
      orgA,
      "teamLead",
      ["hr.attendance_report.read.team"],
      [team.A],
    );
    const selfUser = await mkUser(orgA, "selfO1", [
      "hr.attendance_report.read.own",
    ]);
    await mkUser(orgB, "otherOrg", ["hr.attendance_report.read.all"]);

    emp.m1 = await mkEmp(orgA.id, team.C); // no shift, no weekly off of its own
    emp.m2 = await mkEmp(orgA.id, team.B);
    emp.o1 = await mkEmp(orgA.id, team.A, selfUser.id);
    emp.o2 = await mkEmp(orgA.id, team.A);
    await mkEmp(orgB.id, teamOther);

    const leave = (employeeId: number, day: string) =>
      prisma.leaveRequest.create({
        data: {
          organizationId: orgA.id,
          employeeId,
          leaveTypeId: leaveType.id,
          startDate: d(day),
          endDate: d(day),
          reason: "approved in test",
          status: "APPROVED",
          requestedBy: hrUserId,
          decidedBy: hrUserId,
          decidedAt: new Date(),
        },
      });
    await leave(emp.m1!, "2026-06-08");
    await leave(emp.o1!, "2026-06-08");

    // m1: missing checkout (06-01), stored PRESENT with no punches (06-02),
    // and days that must NOT be flagged: holiday, org Sunday, leave, ABSENT.
    const m1a = await record(orgA.id, emp.m1!, "2026-06-01");
    await session(m1a.id, ist("2026-06-01", "10:00"), null);
    await record(orgA.id, emp.m1!, "2026-06-02", "PRESENT");
    await record(orgA.id, emp.m1!, "2026-06-04", "PRESENT");
    await record(orgA.id, emp.m1!, "2026-06-07", "PRESENT");
    await record(orgA.id, emp.m1!, "2026-06-08", "PRESENT");
    await record(orgA.id, emp.m1!, "2026-06-09", "ABSENT");
    const m1c = await record(orgA.id, emp.m1!, "2026-06-03");
    await session(
      m1c.id,
      ist("2026-06-03", "10:00"),
      ist("2026-06-03", "18:00"),
    );

    // m2 (team B): stored PRESENT with no punches — a missing check-in on the other team.
    await record(orgA.id, emp.m2!, "2026-06-02", "PRESENT");

    // o1 (team A, shift 8 h): normal overtime, and days that produce none.
    for (const [day, inH, outH, status] of [
      ["2026-06-03", "10:00", "18:00", null],
      ["2026-06-04", "09:00", "20:00", null], // holiday
      ["2026-06-05", "09:00", "20:00", null], // team A Friday (weekly off)
      ["2026-06-07", "09:00", "20:00", null], // Sunday (weekly off)
      ["2026-06-08", "09:00", "20:00", null], // approved leave
      ["2026-06-09", "09:00", "20:00", "HALF_DAY"],
      ["2026-06-10", "09:00", "18:30", null], // normal: 570 min against 480 → 90 overtime
    ] as const) {
      const r = await record(orgA.id, emp.o1!, day, status);
      await session(r.id, ist(day, inH), ist(day, outH));
    }

    // o2: a day with no overtime.
    const o2 = await record(orgA.id, emp.o2!, "2026-06-10");
    await session(
      o2.id,
      ist("2026-06-10", "10:00"),
      ist("2026-06-10", "18:00"),
    );
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  describe("authorization", () => {
    it("rejects an unauthenticated call", async () => {
      await request(app.getHttpServer())
        .get(
          "/hr/attendance/reports/missing-punches?from=2026-06-01&to=2026-06-02",
        )
        .expect(401);
      await request(app.getHttpServer())
        .get("/hr/attendance/reports/overtime?from=2026-06-01&to=2026-06-02")
        .expect(401);
    });

    it("refuses both reports to a user without the report permission", async () => {
      await mkUser(orgA, "noReport", []);
      await get(
        "noReport",
        "/hr/attendance/reports/missing-punches?from=2026-06-01&to=2026-06-02",
      ).expect(403);
      await get(
        "noReport",
        "/hr/attendance/reports/overtime?from=2026-06-01&to=2026-06-02",
      ).expect(403);
    });

    it("rejects an inverted or oversized range", async () => {
      await get(
        "hrAll",
        "/hr/attendance/reports/overtime?from=2026-06-10&to=2026-06-01",
      ).expect(422);
      await get(
        "hrAll",
        "/hr/attendance/reports/missing-punches?from=2026-01-01&to=2026-12-31",
      ).expect(422);
    });
  });

  describe("missing punches", () => {
    const range = "from=2026-06-01&to=2026-06-10";

    it("reports a missing checkout and a missing check-in, with their types", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      const rows = list<MissingRow>(r);
      const m1 = rows.filter((x) => x.employee.id === emp.m1);
      expect(m1).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            attendanceDate: "2026-06-01",
            type: "MISSING_CHECKOUT",
          }),
          expect.objectContaining({
            attendanceDate: "2026-06-02",
            type: "MISSING_CHECK_IN",
          }),
        ]),
      );
    });

    it("excludes holiday, weekly-off, leave and explicit ABSENT days", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      const m1Dates = list<MissingRow>(r)
        .filter((x) => x.employee.id === emp.m1)
        .map((x) => x.attendanceDate);
      expect(m1Dates).not.toContain("2026-06-04");
      expect(m1Dates).not.toContain("2026-06-07");
      expect(m1Dates).not.toContain("2026-06-08");
      expect(m1Dates).not.toContain("2026-06-09");
    });

    it("does not report complete attendance or employees with no punches", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      const rows = list<MissingRow>(r);
      expect(rows.some((x) => x.employee.id === emp.o2)).toBe(false);
      expect(
        rows.some(
          (x) => x.employee.id === emp.o1 && x.attendanceDate === "2026-06-10",
        ),
      ).toBe(false);
    });

    it("filters by type", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}&type=MISSING_CHECKOUT`,
      ).expect(200);
      const rows = list<MissingRow>(r);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((x) => x.type === "MISSING_CHECKOUT")).toBe(true);
    });

    it("filters by team, and by employee, within scope", async () => {
      const byTeam = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}&teamId=${team.B}`,
      ).expect(200);
      expect(
        list<MissingRow>(byTeam).every((x) => x.employee.id === emp.m2),
      ).toBe(true);
      const byEmp = await get(
        "hrAll",
        `/hr/attendance/reports/missing-punches?${range}&employeeId=${emp.m1}`,
      ).expect(200);
      expect(
        list<MissingRow>(byEmp).every((x) => x.employee.id === emp.m1),
      ).toBe(true);
    });

    it("team scope sees only its own team", async () => {
      const r = await get(
        "teamLead",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      const ids = new Set(list<MissingRow>(r).map((x) => x.employee.id));
      expect(ids.has(emp.m1!)).toBe(false);
      expect(ids.has(emp.m2!)).toBe(false);
    });

    it("own scope sees only the caller's own rows", async () => {
      const r = await get(
        "selfO1",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      expect(list<MissingRow>(r).every((x) => x.employee.id === emp.o1)).toBe(
        true,
      );
    });

    it("cross-organization denial: another organization's user sees none of these employees", async () => {
      const r = await get(
        "otherOrg",
        `/hr/attendance/reports/missing-punches?${range}`,
      ).expect(200);
      const ids = new Set(list<MissingRow>(r).map((x) => x.employee.id));
      expect(ids.has(emp.m1!)).toBe(false);
      expect(ids.has(emp.o1!)).toBe(false);
    });
  });

  describe("overtime", () => {
    const range = "from=2026-06-01&to=2026-06-10";

    it("reports normal overtime with its minutes", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      const o1 = list<OvertimeRow>(r).find((x) => x.employee.id === emp.o1)!;
      expect(o1.overtimeMinutes).toBe(90);
      expect(o1.daysWithOvertime).toBe(1);
      expect(o1.days).toEqual([
        expect.objectContaining({
          attendanceDate: "2026-06-10",
          overtimeMinutes: 90,
        }),
      ]);
    });

    it("produces zero overtime on holiday, weekly-off, leave and half-day days", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      const dates = list<OvertimeRow>(r)
        .find((x) => x.employee.id === emp.o1)!
        .days.map((x) => x.attendanceDate);
      for (const day of [
        "2026-06-04",
        "2026-06-05",
        "2026-06-07",
        "2026-06-08",
        "2026-06-09",
      ]) {
        expect(dates).not.toContain(day);
      }
    });

    it("reports zero overtime for a day worked exactly to target", async () => {
      const r = await get(
        "hrAll",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      const o2 = list<OvertimeRow>(r).find((x) => x.employee.id === emp.o2)!;
      expect(o2.overtimeMinutes).toBe(0);
      expect(o2.days).toEqual([]);
    });

    it("the half-day shortfall equals the other half of the target (legacy pendingHrs)", async () => {
      const r = await get(
        "hrAll",
        "/hr/attendance/reports/daily?date=2026-06-09",
      ).expect(200);
      const row = list<DailyRow>(r).find((x) => x.employee.id === emp.o1)!;
      expect(row).toMatchObject({
        status: "HALF_DAY",
        workedMinutes: 240,
        shortfallMinutes: 240,
      });
    });

    it("team scope sees only its own team", async () => {
      const r = await get(
        "teamLead",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      const ids = list<OvertimeRow>(r).map((x) => x.employee.id);
      expect(ids).toContain(emp.o1);
      expect(ids).not.toContain(emp.m1);
    });

    it("own scope returns only the caller", async () => {
      const r = await get(
        "selfO1",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      expect(list<OvertimeRow>(r).every((x) => x.employee.id === emp.o1)).toBe(
        true,
      );
    });

    it("cross-organization denial", async () => {
      const r = await get(
        "otherOrg",
        `/hr/attendance/reports/overtime?${range}`,
      ).expect(200);
      expect(list<OvertimeRow>(r).some((x) => x.employee.id === emp.o1)).toBe(
        false,
      );
    });
  });
});
