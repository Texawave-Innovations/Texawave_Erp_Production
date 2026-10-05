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
 * Attendance (e2e). Self check-in/out and own history, HR scope (own · team ·
 * all), manual edit, the correction workflow (submit, approve, reject, the
 * transitions it refuses, self-approval), reports, cross-organization denial
 * and the audit trail.
 *
 * Dates are fixed in the PAST (2026) for everything except the punch tests,
 * which use the real clock and assert only shape, so a run never depends on
 * what day or minute it is.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

interface DayView {
  recordId: number | null;
  employeeId: number;
  attendanceDate: string;
  status: string;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  sessions: { checkInAt: string; checkOutAt: string | null; source: string }[];
}

interface Correction {
  id: number;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  correctionType: string;
}

const PERMS = [
  "employee_self_service.attendance.punch",
  "employee_self_service.attendance.read",
  "employee_self_service.attendance_correction.create",
  "hr.attendance.read.own",
  "hr.attendance.read.team",
  "hr.attendance.read.all",
  "hr.attendance.write.team",
  "hr.attendance.write.all",
  "hr.attendance_correction.read.own",
  "hr.attendance_correction.read.all",
  "hr.attendance_correction.approve.team",
  "hr.attendance_correction.approve.all",
  "hr.attendance_report.read.team",
  "hr.attendance_report.read.all",
];

describe("HR attendance (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let team1: number;
  let team2: number;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  const emp: Record<string, number> = {};
  let empCounter = 0;

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

  /** An employee, optionally linked to a login (self-service tests need that). */
  async function mkEmp(
    orgId: number,
    teamId: number,
    over: { userId?: number } = {},
  ) {
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
          // Matches employees_code_format_check: EMP- followed by 6+ digits.
          employeeCode: `EMP-${100000 + n}`,
          fullName: `Att Emp ${n}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2025-01-01T00:00:00Z"),
          ...(over.userId ? { userId: over.userId } : {}),
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
      data: { name: `Att A ${suffix}`, slug: `att-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Att B ${suffix}`, slug: `att-b-${suffix.toLowerCase()}` },
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
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  describe("authentication and permission", () => {
    it("rejects an unauthenticated call", async () => {
      await request(app.getHttpServer()).get("/hr/attendance").expect(401);
    });

    it("refuses the HR list to a user with no attendance permission", async () => {
      await mkUser(orgA, "nobody", []);
      const r = await get(
        "nobody",
        "/hr/attendance?from=2026-08-01&to=2026-08-02",
      ).expect(403);
      expect(errorOf(r)).toBeDefined();
    });
  });

  describe("self-service punches", () => {
    let selfUserId: number;
    beforeAll(async () => {
      const user = await mkUser(orgA, "self1", [
        "employee_self_service.attendance.punch",
        "employee_self_service.attendance.read",
      ]);
      selfUserId = user.id;
      emp.self1 = await mkEmp(orgA.id, team1, { userId: selfUserId });
    });

    it("refuses check-out when not checked in", async () => {
      const r = await post("self1", "/hr/attendance/check-out").expect(409);
      expect(errorOf(r)).toBe("NOT_CHECKED_IN");
    });

    it("checks in with the server clock and refuses a second check-in", async () => {
      const r = await post("self1", "/hr/attendance/check-in").expect(201);
      const data = (
        r.body as Body<{ attendanceDate: string; checkInAt: string }>
      ).data;
      expect(data.attendanceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(data.checkInAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      const again = await post("self1", "/hr/attendance/check-in").expect(409);
      expect(errorOf(again)).toBe("ALREADY_CHECKED_IN");
    });

    it("checks out and then refuses a second checkout", async () => {
      await post("self1", "/hr/attendance/check-out").expect(200);
      const again = await post("self1", "/hr/attendance/check-out").expect(409);
      expect(errorOf(again)).toBe("NOT_CHECKED_IN");
    });

    it("shows own attendance in the range, and rejects an inverted or oversized range", async () => {
      // Records are keyed by the IST business date, not UTC.
      const today = new Date(Date.now() + 5.5 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      const r = await get(
        "self1",
        `/hr/attendance/mine?from=${today}&to=${today}`,
      ).expect(200);
      const rows = (r.body as Body<DayView[]>).data;
      expect(rows.length).toBe(1);
      expect(rows[0]!.employeeId).toBe(emp.self1!);
      expect(rows[0]!.status).toBe("PRESENT");

      await get(
        "self1",
        "/hr/attendance/mine?from=2026-08-10&to=2026-08-01",
      ).expect(422);
      await get(
        "self1",
        "/hr/attendance/mine?from=2026-01-01&to=2026-12-31",
      ).expect(422);
    });

    it("never accepts a client-supplied employee or time for a punch", async () => {
      await post("self1", "/hr/attendance/check-in", {
        employeeId: 999999,
        checkInAt: "2020-01-01T00:00:00Z",
      }).expect(201);
      await post("self1", "/hr/attendance/check-out").expect(200);
    });
  });

  describe("HR scope, manual edit and audit", () => {
    let recordId: number;
    beforeAll(async () => {
      await mkUser(orgA, "hrAll", [
        "hr.attendance.read.all",
        "hr.attendance.write.all",
        "hr.attendance_report.read.all",
      ]);
      await mkUser(orgA, "teamLead", ["hr.attendance.read.team"], {
        teamIds: [team1],
      });
      emp.inTeam = await mkEmp(orgA.id, team1);
      emp.outTeam = await mkEmp(orgA.id, team2);

      const created = await prisma.attendanceRecord.create({
        data: {
          organizationId: orgA.id,
          employeeId: emp.inTeam!,
          attendanceDate: new Date("2026-07-06T00:00:00Z"),
          sessions: {
            create: [
              {
                checkInAt: new Date("2026-07-06T04:30:00Z"),
                checkOutAt: new Date("2026-07-06T12:30:00Z"),
                source: "HR",
              },
            ],
          },
        },
      });
      recordId = created.id;
      await prisma.attendanceRecord.create({
        data: {
          organizationId: orgA.id,
          employeeId: emp.outTeam!,
          attendanceDate: new Date("2026-07-06T00:00:00Z"),
        },
      });
    });

    it("HR .all sees records across teams with derived hours", async () => {
      const r = await get(
        "hrAll",
        "/hr/attendance?from=2026-07-06&to=2026-07-06",
      ).expect(200);
      const rows = (r.body as Body<DayView[]>).data;
      const mine = rows.find((x) => x.recordId === recordId);
      expect(mine).toMatchObject({
        workedMinutes: 480,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });

    it("team scope sees only its own team", async () => {
      const r = await get(
        "teamLead",
        "/hr/attendance?from=2026-07-06&to=2026-07-06",
      ).expect(200);
      const ids = (r.body as Body<DayView[]>).data.map((x) => x.employeeId);
      expect(ids).toContain(emp.inTeam!);
      expect(ids).not.toContain(emp.outTeam!);
    });

    it("team scope gets 404, not 403, for a record outside its team", async () => {
      const outside = await prisma.attendanceRecord.findFirstOrThrow({
        where: { employeeId: emp.outTeam!, organizationId: orgA.id },
      });
      await get("teamLead", `/hr/attendance/${outside.id}`).expect(404);
    });

    it("a team reader cannot manually edit (no write permission)", async () => {
      await patch("teamLead", `/hr/attendance/${recordId}`, {
        status: "ABSENT",
      }).expect(403);
    });

    it("manual edit to ABSENT zeroes the hours and writes a before/after audit row", async () => {
      const r = await patch("hrAll", `/hr/attendance/${recordId}`, {
        status: "ABSENT",
      }).expect(200);
      expect((r.body as Body<DayView>).data).toMatchObject({
        status: "ABSENT",
        workedMinutes: 0,
      });

      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "attendance_record",
          entityId: BigInt(recordId),
          action: "manual_edit",
        },
        orderBy: { id: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit!.before).toMatchObject({ status: null });
      expect(audit!.after).toMatchObject({ status: "ABSENT" });
    });

    it("manual edit replaces punches, keeps the replaced punches in the audit, and rejects overlaps", async () => {
      const overlapping = await patch("hrAll", `/hr/attendance/${recordId}`, {
        sessions: [
          {
            checkInAt: "2026-07-06T04:00:00Z",
            checkOutAt: "2026-07-06T06:00:00Z",
          },
          {
            checkInAt: "2026-07-06T05:00:00Z",
            checkOutAt: "2026-07-06T07:00:00Z",
          },
        ],
      }).expect(422);
      expect(errorOf(overlapping)).toBe("SESSIONS_INCONSISTENT");

      const punchOutside = await patch("hrAll", `/hr/attendance/${recordId}`, {
        sessions: [
          {
            checkInAt: "2026-07-07T04:00:00Z",
            checkOutAt: "2026-07-07T06:00:00Z",
          },
        ],
      }).expect(422);
      expect(errorOf(punchOutside)).toBe("PUNCH_OUTSIDE_DATE");

      const cleared = await patch("hrAll", `/hr/attendance/${recordId}`, {
        sessions: [],
      }).expect(200);
      expect((cleared.body as Body<DayView>).data.sessions).toEqual([]);

      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "attendance_record",
          entityId: BigInt(recordId),
          action: "manual_edit",
        },
        orderBy: { id: "desc" },
      });
      expect(JSON.stringify(audit!.before)).toContain(
        "2026-07-06T04:30:00.000Z",
      );
    });

    it("cross-organization access fails", async () => {
      const userB = await mkUser(orgB, "otherOrg", [
        "hr.attendance.read.all",
        "hr.attendance.write.all",
      ]);
      expect(userB.organizationId).toBe(orgB.id);
      await get("otherOrg", `/hr/attendance/${recordId}`).expect(404);
      await patch("otherOrg", `/hr/attendance/${recordId}`, {
        status: "PRESENT",
      }).expect(404);
    });

    it("the daily report gives every employee in scope a derived row, including unmarked days", async () => {
      const r = await get(
        "hrAll",
        "/hr/attendance/reports/daily?date=2026-07-06",
      ).expect(200);
      const rows = (r.body as Body<(DayView & { employee: { id: number } })[]>)
        .data;
      const ids = rows.map((x) => x.employee.id);
      expect(ids).toContain(emp.inTeam!);
      expect(ids).toContain(emp.outTeam!);
    });

    it("the monthly report counts only days up to today, and is scope-limited", async () => {
      const r = await get(
        "hrAll",
        "/hr/attendance/reports/monthly?month=2026-07",
      ).expect(200);
      const rows = (
        r.body as Body<{ employee: { id: number }; daysCounted: number }[]>
      ).data;
      const mine = rows.find((x) => x.employee.id === emp.inTeam!);
      expect(mine?.daysCounted).toBe(31);
    });
  });

  describe("correction workflow", () => {
    beforeAll(async () => {
      await mkUser(orgA, "hrDecider", [
        "hr.attendance_correction.read.all",
        "hr.attendance_correction.approve.all",
        "hr.attendance.read.all",
        "hr.attendance.write.all",
      ]);
      const requester = await mkUser(orgA, "requester", [
        "employee_self_service.attendance_correction.create",
        "hr.attendance_correction.read.own",
      ]);
      emp.requester = await mkEmp(orgA.id, team1, { userId: requester.id });
    });

    const submit = (who: string, body: object) =>
      post(who, "/hr/attendance/corrections", body);

    it("refuses a correction for a future date", async () => {
      const r = await submit("requester", {
        attendanceDate: "2999-01-01",
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: "2999-01-01T04:30:00.000Z",
        reason: "forgot to punch",
      }).expect(422);
      expect(errorOf(r)).toBe("FUTURE_DATE");
    });

    it("refuses a correction whose field does not match its type", async () => {
      const r = await submit("requester", {
        attendanceDate: "2026-06-01",
        correctionType: "LATE_ARRIVAL",
        requestedCheckOutAt: "2026-06-01T12:00:00.000Z",
        reason: "wrong field",
      }).expect(422);
      expect(errorOf(r)).toBe("CORRECTION_FIELD_NOT_ALLOWED");
    });

    it("submits a missed check-in, then approval applies it to the day's punches", async () => {
      const created = await submit("requester", {
        attendanceDate: "2026-06-01",
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: "2026-06-01T04:30:00.000Z",
        requestedCheckOutAt: "2026-06-01T13:30:00.000Z",
        reason: "forgot to check in",
      }).expect(201);
      const id = (created.body as Body<Correction>).data.id;
      expect((created.body as Body<Correction>).data.status).toBe("SUBMITTED");

      const approved = await post(
        "hrDecider",
        `/hr/attendance/corrections/${id}/approve`,
        {},
      ).expect(200);
      expect((approved.body as Body<Correction>).data.status).toBe("APPROVED");

      const sessions = await prisma.attendanceSession.findMany({
        where: {
          record: {
            employeeId: emp.requester!,
            attendanceDate: new Date("2026-06-01T00:00:00Z"),
          },
        },
        select: { source: true },
      });
      expect(sessions.map((s) => s.source)).toEqual(["CORRECTION"]);
    });

    it("refuses a second decision on the same correction", async () => {
      const list = await get(
        "hrDecider",
        "/hr/attendance/corrections?status=APPROVED",
      ).expect(200);
      const id = (list.body as Body<Correction[]>).data[0]!.id;
      const r = await post(
        "hrDecider",
        `/hr/attendance/corrections/${id}/reject`,
        { note: "too late" },
      ).expect(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
      const again = await post(
        "hrDecider",
        `/hr/attendance/corrections/${id}/approve`,
        {},
      ).expect(422);
      expect(errorOf(again)).toBe("INVALID_STATE_TRANSITION");
    });

    it("rejection records the reason and leaves the day untouched", async () => {
      const created = await submit("requester", {
        attendanceDate: "2026-06-02",
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: "2026-06-02T13:00:00.000Z",
        reason: "forgot to check out",
      }).expect(201);
      const id = (created.body as Body<Correction>).data.id;

      const rejected = await post(
        "hrDecider",
        `/hr/attendance/corrections/${id}/reject`,
        {
          note: "no open session that day",
        },
      ).expect(200);
      expect((rejected.body as Body<Correction>).data).toMatchObject({
        status: "REJECTED",
      });

      const day = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: emp.requester!,
          attendanceDate: new Date("2026-06-02T00:00:00Z"),
        },
      });
      expect(day).toBeNull();
    });

    it("refuses to apply a correction that would fabricate a checkout", async () => {
      const created = await submit("requester", {
        attendanceDate: "2026-06-03",
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: "2026-06-03T13:00:00.000Z",
        reason: "forgot to check out",
      }).expect(201);
      const id = (created.body as Body<Correction>).data.id;
      const r = await post(
        "hrDecider",
        `/hr/attendance/corrections/${id}/approve`,
        {},
      ).expect(422);
      expect(errorOf(r)).toBe("CORRECTION_NOT_APPLICABLE");
    });

    it("an employee cannot decide their own correction", async () => {
      const selfApprover = await mkUser(orgA, "selfApprover", [
        "hr.attendance_correction.approve.all",
        "hr.attendance_correction.read.all",
        "employee_self_service.attendance_correction.create",
      ]);
      await prisma.employee.update({
        where: { id: emp.requester! },
        data: { userId: selfApprover.id },
      });
      const created = await submit("selfApprover", {
        attendanceDate: "2026-06-04",
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: "2026-06-04T04:30:00.000Z",
        reason: "forgot to check in",
      }).expect(201);
      const id = (created.body as Body<Correction>).data.id;
      const r = await post(
        "selfApprover",
        `/hr/attendance/corrections/${id}/approve`,
        {},
      ).expect(403);
      expect(errorOf(r)).toBe("SELF_APPROVAL_FORBIDDEN");
    });

    it("a reject needs a reason", async () => {
      const list = await get(
        "hrDecider",
        "/hr/attendance/corrections?status=SUBMITTED",
      ).expect(200);
      const pending = (list.body as Body<Correction[]>).data[0];
      if (!pending)
        throw new Error("expected a pending correction from the earlier tests");
      await post(
        "hrDecider",
        `/hr/attendance/corrections/${pending.id}/reject`,
        {},
      ).expect(400);
    });

    it("an approval writes an audit row", async () => {
      const list = await get(
        "hrDecider",
        "/hr/attendance/corrections?status=APPROVED",
      ).expect(200);
      const id = (list.body as Body<Correction[]>).data[0]!.id;
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "attendance_correction",
          entityId: BigInt(id),
          action: "approve",
        },
      });
      expect(audit).not.toBeNull();
    });
  });
});
