import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { istDateOf } from "../src/modules/hr/attendance/services/attendance-calculation.service.js";
import { AttendanceAutoCheckoutService } from "../src/modules/hr/attendance/services/attendance-auto-checkout.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Forgotten check-out → end-of-day auto-close → HR regularization (e2e),
 * Docs/ATTENDANCE_ARCHITECTURE.md §7.4 / §7.7.
 *
 * The close time the system writes is TECHNICAL: until HR regularizes the
 * session with the real check-out, it credits no worked time and no
 * overtime anywhere (HR view, self view, reports, month close), and the month
 * cannot be submitted. After regularization the ordinary calculation, OT
 * formula included, applies to the verified times.
 *
 * Fixed dates are in July 2026 (a complete month). The auto check-out job is
 * driven with a controlled clock; the live scheduler may also tick during the
 * suite, which is harmless — it applies the same rule, and every assertion is
 * on resulting state.
 */
interface Body<T> {
  data: T;
}
interface DayView {
  recordId: number;
  status: string;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  pendingRegularization: boolean;
  sessions: {
    checkInAt: string;
    checkOutAt: string | null;
    autoClosed: boolean;
  }[];
}
interface FinalizeReport {
  submitted: { employeeId: number; id: number }[];
  skipped: { employeeId: number; code: string }[];
}
interface LockRow {
  summary: { workedMinutes: number; overtimeMinutes: number } | null;
}

const PERMS = [
  "hr.attendance.read.all",
  "hr.attendance.write.all",
  "hr.attendance_correction.read.all",
  "hr.attendance_correction.approve.all",
  "hr.attendance_lock.read.all",
  "hr.attendance_lock.finalize.all",
  "hr.attendance_report.read.all",
  "employee_self_service.attendance.punch",
  "employee_self_service.attendance.read",
  "employee_self_service.attendance_correction.create",
];
const d = (day: string) => new Date(`${day}T00:00:00Z`);
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);
/** `n` days before a `YYYY-MM-DD` date. */
const minusDays = (day: string, n: number) => {
  const x = new Date(`${day}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() - n);
  return x.toISOString().slice(0, 10);
};

describe("Attendance auto-checkout and HR regularization (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let job: AttendanceAutoCheckoutService;
  let org: { id: number; slug: string };
  let team = 0;
  const tokens: Record<string, string> = {};
  const users: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let empCounter = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());
  const get = (who: string, path: string) => http().get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    http().post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    http().patch(path).set(auth(who)).send(body);
  const data = <T>(res: { body: unknown }) => (res.body as Body<T>).data;
  const day = async (recordId: number) =>
    data<DayView>(await get("hr", `/hr/attendance/${recordId}`).expect(200));

  async function mkUser(key: string, codes: string[]) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `reg-${key}-${suffix}` },
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
    const login = await http().post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    users[key] = user.id;
  }

  async function mkEmp(userId?: number) {
    const n = ++empCounter;
    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "GEN" } },
      update: {},
      create: { organizationId: org.id, code: "GEN", name: "General" },
    });
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "PERM" } },
      update: {},
      create: { organizationId: org.id, code: "PERM", name: "Permanent" },
    });
    return (
      await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: `EMP-${400000 + n}`,
          fullName: `Reg Emp ${n}`,
          teamId: team,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2025-01-01T00:00:00Z"),
          ...(userId ? { userId } : {}),
        },
      })
    ).id;
  }

  /** A day with the given punches; `null` check-out = still open. */
  async function punches(
    employeeId: number,
    date: string,
    sessions: [string, string | null][],
  ) {
    const r = await prisma.attendanceRecord.create({
      data: { organizationId: org.id, employeeId, attendanceDate: d(date) },
    });
    for (const [inH, outH] of sessions) {
      await prisma.attendanceSession.create({
        data: {
          attendanceRecordId: r.id,
          checkInAt: ist(date, inH),
          checkOutAt: outH ? ist(date, outH) : null,
          source: "SELF",
        },
      });
    }
    return r.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    job = app.get(AttendanceAutoCheckoutService);

    org = await prisma.organization.create({
      data: { name: `REG ${suffix}`, slug: `reg-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "Day", code: `RG${suffix}` },
      })
    ).id;
    // An 8-hour target, so overtime is easy to read off.
    const shift = await prisma.shift.create({
      data: {
        organizationId: org.id,
        code: `RG8${suffix}`,
        name: "Eight",
        startTime: "09:00",
        endTime: "18:00",
        isOvernight: false,
        workingMinutes: 480,
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        organizationId: org.id,
        shiftId: shift.id,
        teamId: team,
        effectiveFrom: d("2026-01-01"),
      },
    });

    await mkUser("hr", [
      "hr.attendance.read.all",
      "hr.attendance.write.all",
      "hr.attendance_correction.read.all",
      "hr.attendance_correction.approve.all",
      "hr.attendance_lock.read.all",
      "hr.attendance_lock.finalize.all",
      "hr.attendance_report.read.all",
    ]);
    await mkUser("emp", [
      "employee_self_service.attendance.punch",
      "employee_self_service.attendance.read",
      "employee_self_service.attendance_correction.create",
    ]);
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  // ---------------------------------------------------------------------------
  describe("forgotten check-out, then MISSED_CHECK_OUT regularization", () => {
    const DAY = "2026-07-06";
    let empId = 0;
    let recordId = 0;

    beforeAll(async () => {
      empId = await mkEmp(users.emp);
      recordId = await punches(empId, DAY, [["09:00", null]]);
      await job.runForAllOrganizations(ist("2026-07-08", "10:00"));
    });

    it("closes the session at 23:59 IST of its day and flags it unverified", async () => {
      const s = await prisma.attendanceSession.findFirstOrThrow({
        where: { attendanceRecordId: recordId },
      });
      expect(s.checkOutAt?.toISOString()).toBe(ist(DAY, "23:59").toISOString());
      expect(s.autoClosed).toBe(true);
    });

    it("HR view: pending, 0 worked, 0 overtime — never 15 h from the midnight close", async () => {
      expect(await day(recordId)).toMatchObject({
        status: "NOT_MARKED",
        workedMinutes: 0,
        overtimeMinutes: 0,
        shortfallMinutes: 480,
        pendingRegularization: true,
        sessions: [expect.objectContaining({ autoClosed: true })],
      });
    });

    it("self view shows the same pending day", async () => {
      const rows = data<DayView[]>(
        await get("emp", `/hr/attendance/mine?from=${DAY}&to=${DAY}`).expect(
          200,
        ),
      );
      expect(rows[0]).toMatchObject({
        workedMinutes: 0,
        overtimeMinutes: 0,
        pendingRegularization: true,
      });
    });

    it("reports: listed as a missing checkout, and no overtime from the unverified span", async () => {
      const range = `from=${DAY}&to=${DAY}&employeeId=${empId}`;
      const missing = data<{ type: string }[]>(
        await get(
          "hr",
          `/hr/attendance/reports/missing-punches?${range}`,
        ).expect(200),
      );
      expect(missing.map((m) => m.type)).toEqual(["MISSING_CHECKOUT"]);
      const ot = data<{ overtimeMinutes: number }[]>(
        await get("hr", `/hr/attendance/reports/overtime?${range}`).expect(200),
      );
      expect(ot[0]?.overtimeMinutes).toBe(0);
    });

    it("a status-only HR edit does not regularize it", async () => {
      await patch("hr", `/hr/attendance/${recordId}`, { status: null }).expect(
        200,
      );
      expect(await day(recordId)).toMatchObject({
        workedMinutes: 0,
        pendingRegularization: true,
      });
    });

    it("an HR edit that re-sends the technical close time unchanged does not regularize it", async () => {
      // What the edit form would send for an untouched row: whole minutes.
      await patch("hr", `/hr/attendance/${recordId}`, {
        sessions: [
          {
            checkInAt: ist(DAY, "09:00").toISOString(),
            checkOutAt: ist(DAY, "23:59").toISOString(),
          },
        ],
      }).expect(200);
      expect(await day(recordId)).toMatchObject({
        workedMinutes: 0,
        overtimeMinutes: 0,
        pendingRegularization: true,
      });
    });

    it("the month cannot be submitted while the session is pending", async () => {
      const report = data<FinalizeReport>(
        await post("hr", "/hr/attendance/month-locks/finalize", {
          month: "2026-07",
          employeeIds: [empId],
        }).expect(200),
      );
      expect(report.submitted).toEqual([]);
      expect(report.skipped).toEqual([
        expect.objectContaining({
          employeeId: empId,
          code: "PENDING_REGULARIZATION_IN_MONTH",
        }),
      ]);
    });

    it("the employee's MISSED_CHECK_OUT, once approved, sets the verified time and the OT formula applies", async () => {
      const created = await post("emp", "/hr/attendance/corrections", {
        attendanceDate: DAY,
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: ist(DAY, "18:00").toISOString(),
        reason: "forgot to check out; left at 6 PM",
      }).expect(201);
      const id = data<{ id: number }>(created).id;
      await post("hr", `/hr/attendance/corrections/${id}/approve`).expect(200);

      const s = await prisma.attendanceSession.findFirstOrThrow({
        where: { attendanceRecordId: recordId },
      });
      expect(s.checkOutAt?.toISOString()).toBe(ist(DAY, "18:00").toISOString());
      expect(s.autoClosed).toBe(false);
      // 09:00–18:00 = 9 h against an 8 h target.
      expect(await day(recordId)).toMatchObject({
        status: "PRESENT",
        workedMinutes: 480,
        overtimeMinutes: 60,
        pendingRegularization: false,
      });
    });

    it("the month then submits, freezing only verified hours and overtime (what payroll reads)", async () => {
      const report = data<FinalizeReport>(
        await post("hr", "/hr/attendance/month-locks/finalize", {
          month: "2026-07",
          employeeIds: [empId],
        }).expect(200),
      );
      expect(report.submitted.map((s) => s.employeeId)).toEqual([empId]);
      const lock = data<LockRow>(
        await get(
          "hr",
          `/hr/attendance/month-locks/${report.submitted[0]!.id}`,
        ).expect(200),
      );
      expect(lock.summary).toMatchObject({
        workedMinutes: 480,
        overtimeMinutes: 60,
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("multiple sessions: a verified one and a forgotten one", () => {
    const DAY = "2026-07-07";
    let recordId = 0;

    beforeAll(async () => {
      const empId = await mkEmp();
      recordId = await punches(empId, DAY, [
        ["09:00", "13:00"],
        ["14:00", null],
      ]);
      await job.runForAllOrganizations(ist("2026-07-08", "10:00"));
    });

    it("keeps the verified session, counts nothing from the pending one, and makes no overtime", async () => {
      const v = await day(recordId);
      expect(v).toMatchObject({
        status: "PRESENT",
        workedMinutes: 240,
        overtimeMinutes: 0,
        pendingRegularization: true,
      });
      expect(v.sessions.map((s) => s.autoClosed)).toEqual([false, true]);
    });

    it("HR enters the real 19:00 check-out: both sessions count and the OT formula applies", async () => {
      await patch("hr", `/hr/attendance/${recordId}`, {
        sessions: [
          {
            checkInAt: ist(DAY, "09:00").toISOString(),
            checkOutAt: ist(DAY, "13:00").toISOString(),
          },
          {
            checkInAt: ist(DAY, "14:00").toISOString(),
            checkOutAt: ist(DAY, "19:00").toISOString(),
          },
        ],
      }).expect(200);
      // 4 h + 5 h = 9 h against an 8 h target.
      expect(await day(recordId)).toMatchObject({
        status: "PRESENT",
        workedMinutes: 480,
        overtimeMinutes: 60,
        pendingRegularization: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("real punches", () => {
    it("a check-in today closes yesterday's forgotten session at yesterday's 23:59 (flagged), and a manual check-out is never overwritten", async () => {
      const empUserId = users.emp;
      if (empUserId === undefined) throw new Error("emp user not seeded");
      const empId = await prisma.employee.findFirstOrThrow({
        where: { organizationId: org.id, userId: empUserId },
        select: { id: true },
      });
      const today = istDateOf(new Date());
      const yesterday = minusDays(today, 1);
      const stale = await punches(empId.id, yesterday, [["09:00", null]]);

      await post("emp", "/hr/attendance/check-in").expect(201);
      const closed = await prisma.attendanceSession.findFirstOrThrow({
        where: { attendanceRecordId: stale },
      });
      expect(closed.checkOutAt?.toISOString()).toBe(
        ist(yesterday, "23:59").toISOString(),
      );
      expect(closed.autoClosed).toBe(true);

      await post("emp", "/hr/attendance/check-out").expect(200);
      const todays = await prisma.attendanceSession.findFirstOrThrow({
        where: {
          record: { employeeId: empId.id, attendanceDate: d(today) },
        },
      });
      expect(todays.checkOutAt).not.toBeNull();
      // A later run of the job (any time) leaves the manual check-out alone.
      await job.runForAllOrganizations(new Date(Date.now() + 2 * 86_400_000));
      const after = await prisma.attendanceSession.findUniqueOrThrow({
        where: { id: todays.id },
      });
      expect(after.checkOutAt).toEqual(todays.checkOutAt);
      expect(after.autoClosed).toBe(false);
    });
  });
});
