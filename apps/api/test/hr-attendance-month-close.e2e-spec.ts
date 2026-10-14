import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { AttendanceAlertsService } from "../src/modules/hr/attendance/services/attendance-alerts.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Attendance backend gaps (Docs/HR_API.md → Attendance): the monthly close
 * (submit → approve / return → reopen, and the lock it puts on punches,
 * statuses, corrections and imports), CSV export, punch import, the in-app
 * notification inbox, and the missing check-in / check-out alerts — each
 * with its permission, team-scope, self and maker-checker matrix.
 *
 * Dates are fixed in the past (June/July 2026), so the outcome does not
 * depend on the clock. The shift used for alerts ends on 2026-06-30, so the
 * live schedulers never act on these employees while the suite runs.
 */
interface Body<T> {
  data: T;
}
interface LockRow {
  id: number | null;
  status: string;
  employee: { id: number };
  summary: {
    countsByStatus: Record<string, number>;
    workedMinutes: number;
  } | null;
}
interface FinalizeReport {
  submitted: { employeeId: number; id: number }[];
  skipped: { employeeId: number; code: string }[];
}
interface ImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  imported: number;
  duplicates: number;
  errors: { row: number; field?: string; message: string }[];
}
interface Notice {
  id: number;
  type: string;
  readAt: string | null;
}

const PERMS = [
  "hr.attendance.write.all",
  "hr.attendance.export.own",
  "hr.attendance.export.team",
  "hr.attendance.export.all",
  "hr.attendance.import.own",
  "hr.attendance.import.team",
  "hr.attendance.import.all",
  "hr.attendance_lock.read.own",
  "hr.attendance_lock.read.team",
  "hr.attendance_lock.read.all",
  "hr.attendance_lock.finalize.own",
  "hr.attendance_lock.finalize.team",
  "hr.attendance_lock.finalize.all",
  "hr.attendance_lock.approve.own",
  "hr.attendance_lock.approve.team",
  "hr.attendance_lock.approve.all",
  "employee_self_service.attendance_correction.create",
];
const d = (day: string) => new Date(`${day}T00:00:00Z`);
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

describe("HR attendance month close, import/export and alerts (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const users: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  const emp: Record<string, { id: number; code: string }> = {};
  const team: Record<string, number> = {};
  let empCounter = 0;
  let a1June = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());
  const get = (who: string, path: string) => http().get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    http().post(path).set(auth(who)).send(body);
  const data = <T>(res: { body: unknown }) => (res.body as Body<T>).data;
  const errorOf = (res: { body: unknown }) =>
    (res.body as { error?: string }).error;
  const upload = (who: string, csv: string, query = "") =>
    http()
      .post(`/hr/attendance/import${query}`)
      .set(auth(who))
      .attach("file", Buffer.from(csv, "utf8"), "punches.csv");
  const csv = (...rows: string[]) =>
    ["Employee Code,Date,Check In,Check Out", ...rows].join("\r\n");

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `amc-${key}-${suffix}` },
    });
    if (codes.length) {
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perm.get(c)!,
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
    return user.id;
  }

  async function mkEmp(
    key: string,
    orgId: number,
    teamId: number,
    opts: { userId?: number; reportsToId?: number } = {},
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
    const code = `EMP-${300000 + n}`;
    const row = await prisma.employee.create({
      data: {
        organizationId: orgId,
        employeeCode: code,
        fullName: `Close Emp ${key}`,
        teamId,
        designationId: designation.id,
        employmentTypeId: type.id,
        dateOfJoining: new Date("2025-01-01T00:00:00Z"),
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.reportsToId ? { reportsToId: opts.reportsToId } : {}),
      },
    });
    emp[key] = { id: row.id, code };
    return row.id;
  }

  const record = async (
    employeeId: number,
    day: string,
    inAt?: string,
    outAt?: string | null,
  ) => {
    const r = await prisma.attendanceRecord.create({
      data: { organizationId: orgA.id, employeeId, attendanceDate: d(day) },
    });
    if (inAt) {
      await prisma.attendanceSession.create({
        data: {
          attendanceRecordId: r.id,
          checkInAt: ist(day, inAt),
          checkOutAt: outAt ? ist(day, outAt) : null,
          source: "HR",
        },
      });
    }
    return r.id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    orgA = await prisma.organization.create({
      data: { name: `AMC A ${suffix}`, slug: `amc-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `AMC B ${suffix}`, slug: `amc-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    for (const t of ["A", "B", "C", "D"]) {
      team[t] = (
        await prisma.team.create({
          data: { organizationId: orgA.id, name: t, code: `AM${t}${suffix}` },
        })
      ).id;
    }
    const otherTeam = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "X", code: `AMX${suffix}` },
      })
    ).id;

    await mkUser(orgA, "hr", [
      "hr.attendance.write.all",
      "hr.attendance.export.all",
      "hr.attendance.import.all",
      "hr.attendance_lock.read.all",
      "hr.attendance_lock.finalize.all",
    ]);
    await mkUser(orgA, "approver", [
      "hr.attendance_lock.read.all",
      "hr.attendance_lock.approve.all",
      "hr.attendance_lock.finalize.all",
      "hr.attendance.import.all",
    ]);
    await mkUser(
      orgA,
      "lead",
      [
        "hr.attendance.export.team",
        "hr.attendance.import.team",
        "hr.attendance_lock.read.team",
        "hr.attendance_lock.finalize.team",
      ],
      [team.A!],
    );
    await mkUser(orgA, "ownOnly", [
      "hr.attendance.import.own",
      "hr.attendance_lock.read.own",
      "hr.attendance_lock.finalize.own",
      "hr.attendance_lock.approve.own",
    ]);
    await mkUser(orgA, "none", []);
    await mkUser(orgA, "empC1", [
      "employee_self_service.attendance_correction.create",
    ]);
    await mkUser(orgA, "mgr", []);
    await mkUser(orgB, "other", [
      "hr.attendance.export.all",
      "hr.attendance_lock.read.all",
      "hr.attendance_lock.approve.all",
    ]);

    await mkEmp("a1", orgA.id, team.A!);
    await mkEmp("a2", orgA.id, team.A!);
    await mkEmp("b1", orgA.id, team.B!);
    // The approver's own employee record, to prove nobody decides their own month.
    await mkEmp("approverSelf", orgA.id, team.B!, { userId: users.approver! });
    const mgrEmp = await mkEmp("mgr", orgA.id, team.D!, { userId: users.mgr! });
    await mkEmp("c1", orgA.id, team.C!, {
      userId: users.empC1!,
      reportsToId: mgrEmp,
    });
    await mkEmp("c2", orgA.id, team.C!, { reportsToId: mgrEmp });
    await mkEmp("x1", orgB.id, otherTeam);

    // Team C works 10:00–18:30 during June only (alerts).
    const shift = await prisma.shift.create({
      data: {
        organizationId: orgA.id,
        code: `AM${suffix}`,
        name: "Day",
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
        teamId: team.C!,
        effectiveFrom: d("2026-06-01"),
        effectiveTo: d("2026-06-30"),
      },
    });

    a1June = await record(emp.a1!.id, "2026-06-10", "10:00", "18:00");
    await record(emp.b1!.id, "2026-06-10", "10:00", "18:00");
    // a2 left a session open in June: the month cannot be submitted for them.
    await record(emp.a2!.id, "2026-06-11", "10:00", null);
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  // ---------------------------------------------------------------------------
  describe("month close: permissions and scope", () => {
    it("rejects an unauthenticated call and a user without the permission", async () => {
      expect(
        (await http().get("/hr/attendance/month-locks?month=2026-06")).status,
      ).toBe(401);
      expect(
        (await get("none", "/hr/attendance/month-locks?month=2026-06")).status,
      ).toBe(403);
      expect(
        (
          await post("none", "/hr/attendance/month-locks/finalize", {
            month: "2026-06",
          })
        ).status,
      ).toBe(403);
    });

    it("lists every employee employed that month as OPEN before submission", async () => {
      const res = await get(
        "hr",
        "/hr/attendance/month-locks?month=2026-06&limit=100",
      );
      expect(res.status).toBe(200);
      const rows = data<LockRow[]>(res);
      expect(rows.map((r) => r.employee.id)).toEqual(
        expect.arrayContaining([emp.a1!.id, emp.b1!.id, emp.c1!.id]),
      );
      expect(rows.every((r) => r.status === "OPEN" && r.id === null)).toBe(
        true,
      );
      expect(rows.map((r) => r.employee.id)).not.toContain(emp.x1!.id);
    });

    it("team scope lists only its own team", async () => {
      const rows = data<LockRow[]>(
        await get("lead", "/hr/attendance/month-locks?month=2026-06&limit=100"),
      );
      expect(rows.map((r) => r.employee.id).sort()).toEqual(
        [emp.a1!.id, emp.a2!.id].sort(),
      );
    });

    it(".own grants no finalize", async () => {
      const res = await post("ownOnly", "/hr/attendance/month-locks/finalize", {
        month: "2026-06",
      });
      expect(res.status).toBe(403);
    });

    it("refuses a month that has not ended", async () => {
      const month = new Date(Date.now() + 5.5 * 3600_000)
        .toISOString()
        .slice(0, 7);
      const res = await post("hr", "/hr/attendance/month-locks/finalize", {
        month,
      });
      expect(res.status).toBe(422);
      expect(errorOf(res)).toBe("MONTH_NOT_COMPLETE");
    });

    it("validates the month format", async () => {
      expect(
        (await get("hr", "/hr/attendance/month-locks?month=2026-6")).status,
      ).toBe(400);
      expect(
        (
          await post("hr", "/hr/attendance/month-locks/finalize", {
            month: "June",
          })
        ).status,
      ).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("month close: submit, lock, approve, return, reopen", () => {
    let a1Lock = 0;
    let b1Lock = 0;

    it("team lead submits only its team; an employee outside it is NOT_FOUND", async () => {
      const res = await post("lead", "/hr/attendance/month-locks/finalize", {
        month: "2026-06",
        employeeIds: [emp.a1!.id, emp.a2!.id, emp.b1!.id],
      });
      expect(res.status).toBe(200);
      const report = data<FinalizeReport>(res);
      expect(report.submitted.map((s) => s.employeeId)).toEqual([emp.a1!.id]);
      expect(report.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            employeeId: emp.b1!.id,
            code: "NOT_FOUND",
          }),
          expect.objectContaining({
            employeeId: emp.a2!.id,
            code: "OPEN_SESSION_IN_MONTH",
          }),
        ]),
      );
      a1Lock = report.submitted[0]!.id;
    });

    it("freezes a summary of the month at submission", async () => {
      const res = await get("hr", `/hr/attendance/month-locks/${a1Lock}`);
      expect(res.status).toBe(200);
      const row = data<LockRow>(res);
      expect(row.status).toBe("SUBMITTED");
      expect(row.summary?.countsByStatus.PRESENT).toBe(1);
      expect(row.summary?.workedMinutes).toBe(480);
    });

    it("HR submits the rest; already-submitted and the approver's own record are skipped", async () => {
      const res = await post(
        "approver",
        "/hr/attendance/month-locks/finalize",
        {
          month: "2026-06",
          employeeIds: [emp.a1!.id, emp.b1!.id, emp.approverSelf!.id],
        },
      );
      const report = data<FinalizeReport>(res);
      expect(report.submitted.map((s) => s.employeeId)).toEqual([emp.b1!.id]);
      expect(report.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            employeeId: emp.a1!.id,
            code: "ALREADY_SUBMITTED",
          }),
          expect.objectContaining({
            employeeId: emp.approverSelf!.id,
            code: "SELF_APPROVAL_FORBIDDEN",
          }),
        ]),
      );
      b1Lock = report.submitted[0]!.id;
    });

    it("a submitted month refuses a manual edit (ATTENDANCE_MONTH_LOCKED)", async () => {
      const res = await http()
        .patch(`/hr/attendance/${a1June}`)
        .set(auth("hr"))
        .send({ status: "ABSENT" });
      expect(res.status).toBe(409);
      expect(errorOf(res)).toBe("ATTENDANCE_MONTH_LOCKED");
    });

    it("filters by status", async () => {
      const rows = data<LockRow[]>(
        await get(
          "hr",
          "/hr/attendance/month-locks?month=2026-06&status=SUBMITTED&limit=100",
        ),
      );
      expect(rows.map((r) => r.employee.id).sort()).toEqual(
        [emp.a1!.id, emp.b1!.id].sort(),
      );
    });

    it("the submitter cannot approve their own submission (maker-checker)", async () => {
      const res = await post(
        "approver",
        `/hr/attendance/month-locks/${b1Lock}/approve`,
      );
      expect(res.status).toBe(403);
      expect(errorOf(res)).toBe("SUBMITTER_CANNOT_DECIDE");
    });

    it("a user without approve, .own approve, and another organization are refused", async () => {
      expect(
        (await post("hr", `/hr/attendance/month-locks/${a1Lock}/approve`))
          .status,
      ).toBe(403);
      expect(
        (await post("ownOnly", `/hr/attendance/month-locks/${a1Lock}/approve`))
          .status,
      ).toBe(403);
      expect(
        (await post("other", `/hr/attendance/month-locks/${a1Lock}/approve`))
          .status,
      ).toBe(404);
      expect(
        (await get("other", `/hr/attendance/month-locks/${a1Lock}`)).status,
      ).toBe(404);
    });

    it("returning needs a note; the approver approves a1 and returns nothing else", async () => {
      expect(
        (
          await post(
            "approver",
            `/hr/attendance/month-locks/${a1Lock}/return`,
            {},
          )
        ).status,
      ).toBe(400);
      const res = await post(
        "approver",
        `/hr/attendance/month-locks/${a1Lock}/approve`,
        { note: "ok" },
      );
      expect(res.status).toBe(200);
      expect(data<LockRow>(res).status).toBe("APPROVED");
    });

    it("an approved month cannot be approved or returned again", async () => {
      const again = await post(
        "approver",
        `/hr/attendance/month-locks/${a1Lock}/approve`,
      );
      expect(again.status).toBe(422);
      expect(errorOf(again)).toBe("INVALID_STATE_TRANSITION");
      const ret = await post(
        "approver",
        `/hr/attendance/month-locks/${a1Lock}/return`,
        { note: "late" },
      );
      expect(ret.status).toBe(422);
    });

    it("an approved month refuses imports", async () => {
      const res = await upload(
        "hr",
        csv(`${emp.a1!.code},2026-06-12,10:00,18:00`),
      );
      expect(res.status).toBe(200);
      const report = data<ImportReport>(res);
      expect(report.imported).toBe(0);
      expect(report.errors[0]?.message).toMatch(/cannot change/);
    });

    it("reopen needs a reason, then the day is editable again", async () => {
      expect(
        (
          await post(
            "approver",
            `/hr/attendance/month-locks/${a1Lock}/reopen`,
            { note: "x" },
          )
        ).status,
      ).toBe(400);
      const res = await post(
        "approver",
        `/hr/attendance/month-locks/${a1Lock}/reopen`,
        { note: "Wrong half day on the 10th" },
      );
      expect(res.status).toBe(200);
      expect(data<LockRow>(res).status).toBe("REOPENED");
      const edit = await http()
        .patch(`/hr/attendance/${a1June}`)
        .set(auth("hr"))
        .send({ status: "HALF_DAY" });
      expect(edit.status).toBe(200);
    });

    it("a reopened month is submitted again with a fresh summary", async () => {
      const res = await post("hr", "/hr/attendance/month-locks/finalize", {
        month: "2026-06",
        employeeIds: [emp.a1!.id],
      });
      expect(data<FinalizeReport>(res).submitted).toEqual([
        { employeeId: emp.a1!.id, id: a1Lock },
      ]);
      const row = data<LockRow>(
        await get("hr", `/hr/attendance/month-locks/${a1Lock}`),
      );
      expect(row.status).toBe("SUBMITTED");
      expect(row.summary?.countsByStatus.HALF_DAY).toBe(1);
    });

    it("bulk approve decides each id and reports the rest", async () => {
      const res = await post("approver", "/hr/attendance/month-locks/approve", {
        ids: [a1Lock, b1Lock, 999_999],
      });
      expect(res.status).toBe(200);
      const report = data<{
        approved: number[];
        skipped: { id: number; code: string }[];
      }>(res);
      expect(report.approved).toEqual([a1Lock]);
      expect(report.skipped.map((s) => [s.id, s.code])).toEqual([
        [b1Lock, "SUBMITTER_CANNOT_DECIDE"],
        [999_999, "RESOURCE_NOT_FOUND"],
      ]);
    });

    it("the database refuses an unknown status and a non-first-day month", async () => {
      await expect(
        prisma.$executeRaw`UPDATE "hr"."attendance_month_locks" SET "status" = 'LOCKED' WHERE "id" = ${a1Lock}`,
      ).rejects.toThrow();
      await expect(
        prisma.$executeRaw`UPDATE "hr"."attendance_month_locks" SET "month" = '2026-06-02' WHERE "id" = ${a1Lock}`,
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe("CSV export", () => {
    it("returns every employee and day in scope, with derived status", async () => {
      const res = await get(
        "hr",
        "/hr/attendance/export?from=2026-07-01&to=2026-07-03",
      );
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      const text = res.text;
      expect(text).toContain("Employee Code,Full Name,Date,Day,Status");
      expect(text).toContain(`${emp.a1!.code},Close Emp a1,2026-07-01,Wed`);
      expect(text).toContain(emp.b1!.code);
      expect(text).not.toContain(emp.x1!.code);
    });

    it("team scope exports only its team; no permission is 403", async () => {
      const text = (
        await get("lead", "/hr/attendance/export?from=2026-07-01&to=2026-07-01")
      ).text;
      expect(text).toContain(emp.a1!.code);
      expect(text).not.toContain(emp.b1!.code);
      expect(
        (
          await get(
            "none",
            "/hr/attendance/export?from=2026-07-01&to=2026-07-01",
          )
        ).status,
      ).toBe(403);
    });

    it("rejects an inverted or oversized range", async () => {
      expect(
        (await get("hr", "/hr/attendance/export?from=2026-07-05&to=2026-07-01"))
          .status,
      ).toBe(422);
      expect(
        (await get("hr", "/hr/attendance/export?from=2026-01-01&to=2026-07-01"))
          .status,
      ).toBe(422);
    });
  });

  // ---------------------------------------------------------------------------
  describe("punch import", () => {
    const july = (code: string, day: string, inAt: string, outAt: string) =>
      `${code},${day},${inAt},${outAt}`;

    it(".own grants no import; no permission is 403", async () => {
      expect(
        (
          await upload(
            "ownOnly",
            csv(july(emp.a1!.code, "2026-07-01", "10:00", "18:00")),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await upload(
            "none",
            csv(july(emp.a1!.code, "2026-07-01", "10:00", "18:00")),
          )
        ).status,
      ).toBe(403);
    });

    it("rejects a file with unknown or missing columns", async () => {
      const res = await upload("hr", "Code,When\r\nE1,2026-07-01");
      expect(res.status).toBe(400);
    });

    it("a dry run checks everything and saves nothing", async () => {
      const res = await upload(
        "hr",
        csv(july(emp.a1!.code, "2026-07-01", "10:00", "18:00")),
        "?dryRun=true",
      );
      const report = data<ImportReport>(res);
      expect(report).toMatchObject({
        dryRun: true,
        totalRows: 1,
        validRows: 1,
        imported: 0,
        errors: [],
      });
      const count = await prisma.attendanceSession.count({
        where: { source: "IMPORT", record: { employeeId: emp.a1!.id } },
      });
      expect(count).toBe(0);
    });

    it("any bad row means nothing is saved, and every problem is listed", async () => {
      const res = await upload(
        "hr",
        csv(
          july(emp.a1!.code, "2026-07-01", "10:00", "18:00"),
          july("NOPE-1", "2026-07-01", "10:00", "18:00"),
          july(emp.x1!.code, "2026-07-01", "10:00", "18:00"),
          july(emp.a1!.code, "2026-07-02", "18:00", "10:00"),
        ),
      );
      const report = data<ImportReport>(res);
      expect(report.imported).toBe(0);
      expect(report.errors.map((e) => e.row)).toEqual([3, 4, 5]);
      expect(
        await prisma.attendanceSession.count({
          where: { source: "IMPORT", record: { employeeId: emp.a1!.id } },
        }),
      ).toBe(0);
    });

    it("imports valid rows as IMPORT sessions, and re-importing is harmless", async () => {
      const file = csv(
        july(emp.a1!.code, "2026-07-01", "10:00", "13:00"),
        july(emp.a1!.code, "2026-07-01", "14:00", "18:30"),
        `${emp.b1!.code},02-07-2026,9:30 AM,6:00 PM`,
      );
      const first = data<ImportReport>(await upload("hr", file));
      expect(first).toMatchObject({ imported: 3, duplicates: 0, errors: [] });
      const again = data<ImportReport>(await upload("hr", file));
      expect(again).toMatchObject({ imported: 0, duplicates: 3, errors: [] });
      const sessions = await prisma.attendanceSession.findMany({
        where: { source: "IMPORT", record: { employeeId: emp.b1!.id } },
      });
      expect(sessions.map((s) => s.checkInAt.toISOString())).toEqual([
        "2026-07-02T04:00:00.000Z",
      ]);
    });

    it("refuses a pair overlapping a stored session", async () => {
      const report = data<ImportReport>(
        await upload(
          "hr",
          csv(july(emp.a1!.code, "2026-07-01", "12:00", "15:00")),
        ),
      );
      expect(report.imported).toBe(0);
      expect(report.errors[0]?.message).toMatch(/Overlaps a session/);
    });

    it("team scope imports only its own team", async () => {
      const report = data<ImportReport>(
        await upload(
          "lead",
          csv(
            july(emp.a1!.code, "2026-07-03", "10:00", "18:00"),
            july(emp.b1!.code, "2026-07-03", "10:00", "18:00"),
          ),
        ),
      );
      expect(report.imported).toBe(0);
      expect(report.errors).toEqual([
        expect.objectContaining({
          row: 3,
          message: `No employee ${emp.b1!.code} in your scope`,
        }),
      ]);
    });

    it("nobody imports their own punches", async () => {
      const report = data<ImportReport>(
        await upload(
          "approver",
          csv(july(emp.approverSelf!.code, "2026-07-03", "10:00", "18:00")),
        ),
      ).errors;
      expect(report?.[0]?.message).toMatch(/yourself/);
    });

    it("the database refuses an unknown session source", async () => {
      await expect(
        prisma.$executeRaw`UPDATE "hr"."attendance_sessions" SET "source" = 'BIOMETRIC' WHERE "attendance_record_id" = ${a1June}`,
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe("notifications and missing-punch alerts", () => {
    let alerts: AttendanceAlertsService;
    beforeAll(() => {
      alerts = app.get(AttendanceAlertsService);
    });

    it("the inbox needs a login", async () => {
      expect((await http().get("/notifications")).status).toBe(401);
    });

    it("a missing check-in notifies the employee and the reporting manager, once", async () => {
      const asOf = ist("2026-06-03", "10:45");
      const first = await alerts.runForOrganization(orgA.id, asOf);
      // c1 (has a login and a manager) and c2 (manager only) are both due.
      expect(first).toEqual({ alerts: 2, notified: 3 });
      const again = await alerts.runForOrganization(orgA.id, asOf);
      expect(again).toEqual({ alerts: 2, notified: 0 });

      const mine = data<Notice[]>(await get("empC1", "/notifications"));
      expect(mine.map((n) => n.type)).toEqual(["attendance.missing_check_in"]);
      const managers = data<Notice[]>(await get("mgr", "/notifications"));
      expect(managers).toHaveLength(2);
    });

    it("is not raised before the due time or once the employee has punched", async () => {
      expect(
        await alerts.runForOrganization(orgA.id, ist("2026-06-04", "10:15")),
      ).toEqual({ alerts: 0, notified: 0 });
      await record(emp.c1!.id, "2026-06-04", "10:20", "18:30");
      const r = await alerts.runForOrganization(
        orgA.id,
        ist("2026-06-04", "11:00"),
      );
      expect(r.alerts).toBe(1); // c2 only
    });

    it("a session still open after shift end + 2 h raises a missing check-out", async () => {
      await record(emp.c2!.id, "2026-06-05", "13:00", null);
      const r = await alerts.runForOrganization(
        orgA.id,
        ist("2026-06-05", "20:45"),
      );
      expect(r.alerts).toBe(1);
      const managers = data<Notice[]>(
        await get("mgr", "/notifications?limit=50"),
      );
      expect(managers.map((n) => n.type)).toContain(
        "attendance.missing_check_out",
      );
      await prisma.attendanceSession.updateMany({
        where: { checkOutAt: null, record: { employeeId: emp.c2!.id } },
        data: { checkOutAt: ist("2026-06-05", "21:00") },
      });
    });

    it("unread count, mark read (own only) and mark all read", async () => {
      const unread = data<{ unread: number }>(
        await get("mgr", "/notifications/unread-count"),
      );
      expect(unread.unread).toBeGreaterThanOrEqual(3);
      const [first] = data<Notice[]>(await get("mgr", "/notifications"));
      expect(
        (await post("empC1", `/notifications/${first!.id}/read`)).status,
      ).toBe(404);
      const read = await post("mgr", `/notifications/${first!.id}/read`);
      expect(read.status).toBe(200);
      expect(data<Notice>(read).readAt).not.toBeNull();
      const all = data<{ marked: number }>(
        await post("mgr", "/notifications/read-all"),
      );
      expect(all.marked).toBe(unread.unread - 1);
      expect(
        data<{ unread: number }>(
          await get("mgr", "/notifications/unread-count"),
        ).unread,
      ).toBe(0);
      const onlyUnread = data<Notice[]>(
        await get("mgr", "/notifications?unreadOnly=true"),
      );
      expect(onlyUnread).toEqual([]);
    });

    it("no client can create a notification", async () => {
      expect((await post("mgr", "/notifications", { title: "x" })).status).toBe(
        404,
      );
    });
  });
});
