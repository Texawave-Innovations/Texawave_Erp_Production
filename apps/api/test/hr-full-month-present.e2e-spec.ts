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
 * Full Month Present (e2e). The scenario month is June 2026, a complete past
 * month, so its outcome does not depend on the clock. June 2026 has four
 * Sundays (7, 14, 21, 28) and an organization holiday on the 4th, so it has 25
 * working days for an employee who is PRESENT on every one of them.
 *
 * The current- and future-month tests compute the month from the clock, so
 * they hold on any date.
 */
interface Body<T> {
  data: T;
}
interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
interface FmpRow {
  employee: { id: number; employeeCode: string; fullName: string };
  month: string;
  monthComplete: boolean;
  employedWholeMonth: boolean;
  countsByStatus: Record<string, number>;
  presentDays: number;
  fullMonthPresent: boolean;
  days: { attendanceDate: string; status: string }[];
}
interface MonthlyRow {
  employee: { id: number };
  countsByStatus: Record<string, number>;
}

const MONTH = "2026-06";
const PERMS = [
  "hr.attendance_report.read.own",
  "hr.attendance_report.read.team",
  "hr.attendance_report.read.all",
];
const d = (day: string) => new Date(`${day}T00:00:00Z`);

/** The IST calendar month and day of an instant, as `YYYY-MM` and `YYYY-MM-DD`. */
function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Every calendar day of `month` (YYYY-MM), in order. */
function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("HR Full Month Present (e2e)", () => {
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
  const team = {} as Record<"P" | "T" | "Q", number>;
  let empCounter = 0;
  let hrUserId = 0;
  let designationId = 0;
  let employmentTypeId = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const fmp = (who: string, query: string) =>
    get(who, `/hr/attendance/reports/full-month-present?${query}`);
  const paged = <T>(r: request.Response) => r.body as Paged<T>;

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `fmp-${key}-${suffix}` },
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

  async function mkEmp(
    orgId: number,
    teamId: number,
    key: string,
    options: {
      userId?: number;
      dateOfJoining?: string;
      dateOfExit?: string;
      status?: string;
    } = {},
  ) {
    const n = ++empCounter;
    const id = (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-${300000 + n}`,
          fullName: `FMP ${key}`,
          teamId,
          designationId,
          employmentTypeId,
          dateOfJoining: d(options.dateOfJoining ?? "2025-01-01"),
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.dateOfExit
            ? {
                dateOfExit: d(options.dateOfExit),
                exitReason: "Resigned in test",
              }
            : {}),
          ...(options.status
            ? {
                status: options.status,
                isActive: options.status === "ACTIVE",
              }
            : {}),
        },
      })
    ).id;
    emp[key] = id;
    return id;
  }

  /** A stored record for one day. `status` null means no stored status. */
  const record = (
    employeeId: number,
    day: string,
    status: string | null = "PRESENT",
  ) =>
    prisma.attendanceRecord.create({
      data: {
        organizationId: orgA.id,
        employeeId,
        attendanceDate: d(day),
        status,
      },
    });

  /** PRESENT on every day of the month except the listed ones. */
  async function presentEveryDayExcept(
    employeeId: number,
    month: string,
    skip: string[] = [],
  ) {
    for (const day of daysOf(month)) {
      if (skip.includes(day)) continue;
      await record(employeeId, day);
    }
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
      data: { name: `FMP A ${suffix}`, slug: `fmp-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `FMP B ${suffix}`, slug: `fmp-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    designationId = (
      await prisma.designation.create({
        data: { organizationId: orgA.id, code: "GEN", name: "General" },
      })
    ).id;
    employmentTypeId = (
      await prisma.employmentType.create({
        data: { organizationId: orgA.id, code: "PERM", name: "Permanent" },
      })
    ).id;

    team.P = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "P", code: `TP${suffix}` },
      })
    ).id;
    team.T = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T", code: `TT${suffix}` },
      })
    ).id;
    team.Q = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "Q", code: `TQ${suffix}` },
      })
    ).id;
    const teamOther = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "X", code: `TX${suffix}` },
      })
    ).id;

    // Calendar: organization holiday on 4 June; organization weekly off on
    // Sunday. Team T has its own weekly off on Friday, which replaces the
    // organization rule for that team (most specific rule decides).
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
        name: "Team T Friday",
        daysOfWeek: [5],
        teamId: team.T,
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
      [team.P, team.T],
    );
    const selfUser = await mkUser(orgA, "selfO1", [
      "hr.attendance_report.read.own",
    ]);
    await mkUser(orgB, "otherOrg", ["hr.attendance_report.read.all"]);

    // Full month: every working day PRESENT. Records on Sundays and the
    // holiday are stored too, to prove that the calendar wins over a record.
    const full = await mkEmp(orgA.id, team.P, "f1", { userId: selfUser.id });
    await presentEveryDayExcept(full, MONTH);
    // An open checkout on a past day (3 June, 10:00 IST) keeps the derived
    // status PRESENT, so it does not disqualify.
    const openDay = await prisma.attendanceRecord.findFirstOrThrow({
      where: { employeeId: full, attendanceDate: d("2026-06-03") },
    });
    await prisma.attendanceSession.create({
      data: {
        attendanceRecordId: openDay.id,
        checkInAt: new Date("2026-06-03T04:30:00Z"),
        checkOutAt: null,
        source: "HR",
      },
    });

    // Team T (Friday off): PRESENT on every day. Fridays are WEEKLY_OFF, and
    // Sundays are working days for this team.
    const teamFriday = await mkEmp(orgA.id, team.T, "f2");
    await presentEveryDayExcept(teamFriday, MONTH);

    // Missing one working day: 15 June has no record.
    const missing = await mkEmp(orgA.id, team.P, "m1");
    await presentEveryDayExcept(missing, MONTH, ["2026-06-15"]);

    // Half day on 10 June.
    const halfDay = await mkEmp(orgA.id, team.P, "h1");
    await presentEveryDayExcept(halfDay, MONTH, ["2026-06-10"]);
    await record(halfDay, "2026-06-10", "HALF_DAY");

    // Approved leave on 10 June, no stored status.
    const onLeave = await mkEmp(orgA.id, team.P, "l1");
    await presentEveryDayExcept(onLeave, MONTH, ["2026-06-10"]);
    await prisma.leaveRequest.create({
      data: {
        organizationId: orgA.id,
        employeeId: onLeave,
        leaveTypeId: leaveType.id,
        startDate: d("2026-06-10"),
        endDate: d("2026-06-10"),
        reason: "approved in test",
        status: "APPROVED",
        requestedBy: hrUserId,
        decidedBy: hrUserId,
        decidedAt: new Date(),
      },
    });

    // Explicit absence on 10 June.
    const absent = await mkEmp(orgA.id, team.P, "a1");
    await presentEveryDayExcept(absent, MONTH, ["2026-06-10"]);
    await record(absent, "2026-06-10", "ABSENT");

    // Mid-month joiner (joined 16 June): PRESENT from joining onwards.
    const joiner = await mkEmp(orgA.id, team.P, "j1", {
      dateOfJoining: "2026-06-16",
    });
    await presentEveryDayExcept(joiner, MONTH, daysOf(MONTH).slice(0, 15));

    // Outside the team lead's scope (team Q), but full month.
    const outside = await mkEmp(orgA.id, team.Q, "q1");
    await presentEveryDayExcept(outside, MONTH);

    // Not ACTIVE: must never appear, even with full records.
    const resigned = await mkEmp(orgA.id, team.P, "r1", {
      status: "RESIGNED",
      dateOfExit: "2026-06-20",
    });
    await presentEveryDayExcept(resigned, MONTH);
    const inactive = await mkEmp(orgA.id, team.P, "i1", {
      status: "INACTIVE",
    });
    await presentEveryDayExcept(inactive, MONTH);

    // Organization B: one employee, to prove isolation in both directions.
    await mkEmp(orgB.id, teamOther, "xB");
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  describe("authorization and validation", () => {
    it("rejects an unauthenticated call", async () => {
      await request(app.getHttpServer())
        .get(`/hr/attendance/reports/full-month-present?month=${MONTH}`)
        .expect(401);
    });

    it("refuses a user without the report permission", async () => {
      await mkUser(orgA, "noReport", []);
      await fmp("noReport", `month=${MONTH}`).expect(403);
    });

    it.each([
      ["missing month", ""],
      ["single-digit month", "month=2026-6"],
      ["month 13", "month=2026-13"],
      ["month 00", "month=2026-00"],
      ["text month", "month=June-2026"],
      ["non-numeric employee", `month=${MONTH}&employeeId=abc`],
    ])("rejects an invalid query: %s", async (_label, query) => {
      await fmp("hrAll", query).expect(400);
    });
  });

  describe("organization and team scope", () => {
    it("HR with the all scope sees every ACTIVE employee in its organization employed in the month", async () => {
      const res = await fmp("hrAll", `month=${MONTH}&limit=100`).expect(200);
      const rows = paged<FmpRow>(res).data;
      const ids = rows.map((r) => r.employee.id).sort((a, b) => a - b);
      const expected = [
        emp.f1,
        emp.f2,
        emp.m1,
        emp.h1,
        emp.l1,
        emp.a1,
        emp.j1,
        emp.q1,
      ]
        .map((id) => id!)
        .sort((a, b) => a - b);
      expect(ids).toEqual(expected);
      expect(paged<FmpRow>(res).meta.total).toBe(8);
    });

    it("the team lead sees only their teams, and a team filter outside scope cannot widen it", async () => {
      const res = await fmp("teamLead", `month=${MONTH}&limit=100`).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows.map((r) => r.employee.id)).not.toContain(emp.q1);
      expect(paged<FmpRow>(res).meta.total).toBe(7);

      const narrowed = await fmp(
        "teamLead",
        `month=${MONTH}&teamId=${team.Q}`,
      ).expect(200);
      expect(paged<FmpRow>(narrowed).meta.total).toBe(0);
    });

    it("an own-scope user sees only their own employee", async () => {
      const res = await fmp("selfO1", `month=${MONTH}`).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows.map((r) => r.employee.id)).toEqual([emp.f1]);
    });

    it("a user from another organization sees only that organization's employees", async () => {
      const res = await fmp("otherOrg", `month=${MONTH}`).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows.map((r) => r.employee.id)).not.toContain(emp.f1);
      expect(paged<FmpRow>(res).meta.total).toBe(1);
      expect(rows[0]!.employee.fullName).toBe(`FMP xB`);
    });

    it("an employee id from another organization returns nothing", async () => {
      const res = await fmp(
        "otherOrg",
        `month=${MONTH}&employeeId=${emp.f1}`,
      ).expect(200);
      expect(paged<FmpRow>(res).meta.total).toBe(0);
    });
  });

  describe("qualification", () => {
    const row = async (key: string) => {
      const res = await fmp("hrAll", `month=${MONTH}&employeeId=${emp[key]}`);
      expect(res.status).toBe(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };

    it("a full-month employee qualifies, with holiday and weekly off counted and not as working days", async () => {
      const r = await row("f1");
      expect(r.monthComplete).toBe(true);
      expect(r.employedWholeMonth).toBe(true);
      expect(r.fullMonthPresent).toBe(true);
      expect(r.presentDays).toBe(25);
      expect(r.countsByStatus.HOLIDAY).toBe(1);
      expect(r.countsByStatus.WEEKLY_OFF).toBe(4);
      expect(r.days).toHaveLength(30);
      expect(r.days[0]).toEqual({
        attendanceDate: "2026-06-01",
        status: "PRESENT",
      });
      expect(r.days[3]).toEqual({
        attendanceDate: "2026-06-04",
        status: "HOLIDAY",
      });
      expect(r.days[6]).toEqual({
        attendanceDate: "2026-06-07",
        status: "WEEKLY_OFF",
      });
    });

    it("a team's own weekly off replaces the organization rule for that team", async () => {
      const r = await row("f2");
      expect(r.fullMonthPresent).toBe(true);
      expect(r.countsByStatus.WEEKLY_OFF).toBe(4);
      expect(
        r.days.find((x) => x.attendanceDate === "2026-06-05")?.status,
      ).toBe("WEEKLY_OFF");
      expect(
        r.days.find((x) => x.attendanceDate === "2026-06-07")?.status,
      ).toBe("PRESENT");
    });

    it("one missing working day (no record) disqualifies", async () => {
      const r = await row("m1");
      expect(r.fullMonthPresent).toBe(false);
      expect(r.countsByStatus.NOT_MARKED).toBe(1);
      expect(r.presentDays).toBe(24);
    });

    it("a half day disqualifies and is not counted as present", async () => {
      const r = await row("h1");
      expect(r.fullMonthPresent).toBe(false);
      expect(r.countsByStatus.HALF_DAY).toBe(1);
      expect(r.presentDays).toBe(24);
    });

    it("approved leave disqualifies", async () => {
      const r = await row("l1");
      expect(r.fullMonthPresent).toBe(false);
      expect(r.countsByStatus.ON_LEAVE).toBe(1);
    });

    it("an explicit absence disqualifies", async () => {
      const r = await row("a1");
      expect(r.fullMonthPresent).toBe(false);
      expect(r.countsByStatus.ABSENT).toBe(1);
    });

    it("a mid-month joiner is not employed the whole month and does not qualify", async () => {
      const r = await row("j1");
      expect(r.employedWholeMonth).toBe(false);
      expect(r.fullMonthPresent).toBe(false);
      expect(r.presentDays).toBe(13);
    });

    it("a missing check-out on a past day keeps the derived status PRESENT, so it does not disqualify", async () => {
      // Matches the shared calculation: an open session on a past day is still
      // PRESENT. The missing-punch report is the place that flags it.
      const r = await row("f1");
      expect(
        r.days.find((x) => x.attendanceDate === "2026-06-03")?.status,
      ).toBe("PRESENT");
      expect(r.countsByStatus.PRESENT).toBe(25);
      expect(r.fullMonthPresent).toBe(true);
    });

    it("a non-ACTIVE employee never appears, even with full records", async () => {
      const res = await fmp("hrAll", `month=${MONTH}&limit=100`).expect(200);
      const ids = paged<FmpRow>(res).data.map((r) => r.employee.id);
      expect(ids).not.toContain(emp.r1);
      expect(ids).not.toContain(emp.i1);
    });
  });

  describe("consistency with the Attendance calculation", () => {
    it("per-employee counts equal the monthly attendance report for the same month", async () => {
      const monthly = await get(
        "hrAll",
        `/hr/attendance/reports/monthly?month=${MONTH}&limit=100`,
      ).expect(200);
      const monthlyById = new Map(
        (paged<MonthlyRow>(monthly).data as MonthlyRow[]).map((r) => [
          r.employee.id,
          r.countsByStatus,
        ]),
      );
      const res = await fmp("hrAll", `month=${MONTH}&limit=100`).expect(200);
      for (const r of paged<FmpRow>(res).data) {
        expect(r.countsByStatus).toEqual(monthlyById.get(r.employee.id));
      }
    });
  });

  describe("month handling", () => {
    it("employees who joined after a month are not listed for it", async () => {
      // Every test employee joined in 2025, so none was employed in Feb 2024.
      const res = await fmp("hrAll", "month=2024-02&limit=100").expect(200);
      expect(paged<FmpRow>(res).meta.total).toBe(0);
    });

    it("a 29-day leap February returns exactly its 29 days", async () => {
      const early = await mkEmp(orgA.id, team.P, "leap", {
        dateOfJoining: "2023-01-01",
      });
      const res = await fmp(
        "hrAll",
        `month=2024-02&employeeId=${early}`,
      ).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows).toHaveLength(1);
      const days = rows[0]!.days.map((x) => x.attendanceDate);
      expect(days[0]).toBe("2024-02-01");
      expect(days[days.length - 1]).toBe("2024-02-29");
      expect(days).toHaveLength(29);
      expect(rows[0]!.fullMonthPresent).toBe(false);
    });

    it("the current month is never complete, so nobody qualifies", async () => {
      const current = istToday().slice(0, 7);
      const res = await fmp("hrAll", `month=${current}&limit=100`).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows.every((r) => r.monthComplete === false)).toBe(true);
      expect(rows.every((r) => r.fullMonthPresent === false)).toBe(true);
      const todayDay = Number(istToday().slice(8, 10));
      if (rows.length > 0) expect(rows[0]!.days).toHaveLength(todayDay);
    });

    it("a future month has no counted days and nobody qualifies", async () => {
      const future = shiftMonth(istToday().slice(0, 7), 1);
      const res = await fmp("hrAll", `month=${future}&limit=100`).expect(200);
      const rows = paged<FmpRow>(res).data;
      expect(rows.every((r) => r.monthComplete === false)).toBe(true);
      expect(rows.every((r) => r.fullMonthPresent === false)).toBe(true);
      expect(rows.every((r) => r.days.length === 0)).toBe(true);
    });
  });

  describe("ordering, paging and response shape", () => {
    it("orders rows deterministically by employee code, and pages without overlap", async () => {
      const all = paged<FmpRow>(
        await fmp("hrAll", `month=${MONTH}&limit=100`).expect(200),
      ).data.map((r) => r.employee.employeeCode);
      expect(all).toEqual([...all].sort());
      expect(all.length).toBeGreaterThanOrEqual(8);

      const limit = 3;
      const pages: string[] = [];
      let total = 0;
      for (let page = 1; ; page++) {
        const res = paged<FmpRow>(
          await fmp(
            "hrAll",
            `month=${MONTH}&limit=${limit}&page=${page}`,
          ).expect(200),
        );
        total = res.meta.total;
        pages.push(...res.data.map((r) => r.employee.employeeCode));
        if (page >= res.meta.totalPages) break;
      }
      expect(total).toBe(all.length);
      expect(pages).toEqual(all);
    });

    it("returns only the documented employee fields, with no contact, pay or identity data", async () => {
      const res = await fmp(
        "hrAll",
        `month=${MONTH}&employeeId=${emp.f1}`,
      ).expect(200);
      const row = paged<FmpRow>(res).data[0]!;
      expect(Object.keys(row).sort()).toEqual(
        [
          "countsByStatus",
          "days",
          "employedWholeMonth",
          "employee",
          "fullMonthPresent",
          "month",
          "monthComplete",
          "presentDays",
        ].sort(),
      );
      expect(Object.keys(row.employee).sort()).toEqual(
        ["employeeCode", "fullName", "id"].sort(),
      );
      const text = JSON.stringify(res.body).toLowerCase();
      for (const sensitive of [
        "email",
        "phone",
        "salary",
        "pan",
        "aadhaar",
        "bank",
        "@",
      ]) {
        expect(text).not.toContain(sensitive);
      }
    });

    it("the envelope carries data and meta", async () => {
      const res = await fmp("hrAll", `month=${MONTH}&limit=2`).expect(200);
      const b = res.body as Paged<FmpRow>;
      expect(Array.isArray(b.data)).toBe(true);
      expect(b.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: b.meta.total,
        totalPages: Math.ceil(b.meta.total / 2),
      });
      expect(b.meta.total).toBeGreaterThanOrEqual(8);
    });
  });
});
