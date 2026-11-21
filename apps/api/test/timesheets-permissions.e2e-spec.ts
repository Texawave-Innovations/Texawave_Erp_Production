import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface Permission {
  fromTime: string;
  toTime: string;
  minutes: number;
}
interface DayBody {
  data: {
    attendance: {
      status: string;
      workedMinutes: number;
      targetMinutes: number | null;
      baseTargetMinutes: number | null;
      permissions: Permission[];
      permissionMinutes: number;
    } | null;
  };
}
interface MonthDay {
  date: string;
  weekday: number;
  attendanceStatus: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  targetMinutes: number | null;
  baseTargetMinutes: number | null;
  permissions: Permission[];
  permissionMinutes: number;
  loggedMinutes: number;
  reviewStatus: string | null;
}
interface MonthBody {
  data: {
    month: string;
    employee?: { id: number; name: string };
    summary: {
      presentDays: number;
      loggedMinutes: number;
      permissionMinutes: number;
    };
    days: MonthDay[];
  };
}

/**
 * Approved work permissions on the timesheet (e2e): an APPROVED short-time
 * permission is taken off the day's target and shown on the employee's day and
 * month and in a reviewer's views; a PENDING or REJECTED one changes nothing.
 * Reviewers only reach the employees their `hr.timesheet.read` scope covers.
 * Everything lives in its own organization with one 8-hour team shift, so no
 * other holiday, weekly-off or shift disturbs the figures. 2026-11-03 is a
 * Tuesday.
 */
describe("Timesheet work permissions (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgId: number;
  let employeeId: number;
  let employeeUserId: number;
  let employeeToken: string;
  let hrToken: string;
  let suffix: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = (url: string, token: string) =>
    request(app.getHttpServer()).get(url).set(bearer(token));

  const permission = (
    date: string,
    status: "APPROVED" | "PENDING" | "REJECTED",
    fromTime = "10:00",
    toTime = "12:00",
    durationMins = 120,
  ) =>
    prisma.workPermission.create({
      data: {
        organizationId: orgId,
        employeeId,
        date: parseDateOnly(date),
        fromTime,
        toTime,
        durationMins,
        reason: "Bank work",
        status,
        requestedBy: employeeUserId,
      },
    });

  async function mkUser(
    key: string,
    permissionCodes: string[],
  ): Promise<{ id: number; email: string }> {
    const role = await prisma.role.create({
      data: { organizationId: orgId, name: `role-${key}-${suffix}` },
    });
    for (const code of permissionCodes) {
      const perm = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }
    const email = `${key}@tsp-${suffix}.test`;
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return { id: user.id, email };
  }

  async function login(slug: string, email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ organizationSlug: slug, email, password: "Password123!" })
      .expect(201);
    return (res.body as { data: { accessToken: string } }).data.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    suffix = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Org TSP ${suffix}`, slug: `ts-perm-${suffix}` },
    });
    orgId = org.id;

    const employeeUser = await mkUser("emp", [
      "employee_self_service.timesheet.read",
    ]);
    employeeUserId = employeeUser.id;
    const hrUser = await mkUser("hr", [
      "hr.timesheet.read.all",
      "hr.timesheet.export.all",
    ]);

    const designation = await prisma.designation.create({
      data: { organizationId: orgId, code: "ENG", name: "Engineer" },
    });
    const empType = await prisma.employmentType.create({
      data: { organizationId: orgId, code: "PERM", name: "Permanent" },
    });
    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        code: `T-${suffix}`,
        name: `Team ${suffix}`,
      },
    });
    const employee = await prisma.employee.create({
      data: {
        organization: { connect: { id: orgId } },
        user: { connect: { id: employeeUser.id } },
        team: { connect: { id: team.id } },
        employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
        fullName: "Perm Employee",
        workEmail: employeeUser.email,
        designation: { connect: { id: designation.id } },
        employmentType: { connect: { id: empType.id } },
        dateOfJoining: new Date("2026-01-01T00:00:00Z"),
      },
    });
    employeeId = employee.id;

    const shift = await prisma.shift.create({
      data: {
        organizationId: orgId,
        code: `S8${suffix.toUpperCase()}`,
        name: "Eight hours",
        startTime: "10:00",
        endTime: "18:30",
        isOvernight: false,
        workingMinutes: 480,
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        organizationId: orgId,
        shiftId: shift.id,
        teamId: team.id,
        effectiveFrom: parseDateOnly("2026-01-01"),
      },
    });

    // 2026-11-03: a normal Tuesday, punched 10:00-18:00 IST.
    await prisma.attendanceRecord.create({
      data: {
        organizationId: orgId,
        employeeId,
        attendanceDate: parseDateOnly("2026-11-03"),
        sessions: {
          create: [
            {
              checkInAt: new Date("2026-11-03T04:30:00.000Z"),
              checkOutAt: new Date("2026-11-03T12:30:00.000Z"),
              source: "SELF",
            },
          ],
        },
      },
    });

    // The three states of a permission request on three different days.
    await permission("2026-11-03", "APPROVED");
    await permission("2026-11-04", "PENDING");
    await permission("2026-11-05", "REJECTED");

    // 60 minutes of recorded (draft) work on the approved day.
    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        projectCode: `TSP/${suffix}/1`,
        name: "Permission project",
        startDate: new Date("2026-12-01"),
      },
    });
    const task = await prisma.projectTask.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        taskCode: `TSP/${suffix}/T1`,
        title: "Permission task",
        assignedToId: employeeId,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    const row = await prisma.timesheet.create({
      data: {
        organizationId: orgId,
        employeeId,
        workDate: parseDateOnly("2026-11-03"),
        category: "TASK",
        taskId: task.id,
        projectId: project.id,
        title: task.title,
      },
    });
    const startedAt = new Date("2026-11-03T04:30:00.000Z");
    await prisma.projectTimeEntry.create({
      data: {
        organizationId: orgId,
        taskId: task.id,
        employeeId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + 60 * 60_000),
        durationMinutes: 60,
        entryDate: parseDateOnly("2026-11-03"),
        timesheetId: row.id,
      },
    });

    employeeToken = await login(org.slug, employeeUser.email);
    hrToken = await login(org.slug, hrUser.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it("an approved permission takes its minutes off the day's target", async () => {
    const { attendance } = (
      (await get("/timesheets/my/2026-11-03", employeeToken).expect(200))
        .body as DayBody
    ).data;
    expect(attendance).toMatchObject({
      baseTargetMinutes: 480,
      targetMinutes: 360,
      permissionMinutes: 120,
      permissions: [{ fromTime: "10:00", toTime: "12:00", minutes: 120 }],
    });
  });

  it("a pending or a rejected permission changes nothing", async () => {
    for (const date of ["2026-11-04", "2026-11-05"]) {
      const { attendance } = (
        (await get(`/timesheets/my/${date}`, employeeToken).expect(200))
          .body as DayBody
      ).data;
      expect(attendance).toMatchObject({
        baseTargetMinutes: 480,
        targetMinutes: 480,
        permissionMinutes: 0,
        permissions: [],
      });
    }
  });

  it("the employee's month shows each day's status, punches, target, permission and logged time", async () => {
    const { data } = (
      await get("/timesheets/my-month?month=2026-11", employeeToken).expect(200)
    ).body as MonthBody;
    expect(data.month).toBe("2026-11");
    expect(data.days).toHaveLength(30);
    expect(data.summary).toMatchObject({
      presentDays: 1,
      loggedMinutes: 60,
      permissionMinutes: 120,
    });

    const approved = data.days.find((d) => d.date === "2026-11-03")!;
    expect(approved).toMatchObject({
      weekday: 2, // a Tuesday
      attendanceStatus: "PRESENT",
      checkInAt: "2026-11-03T04:30:00.000Z",
      checkOutAt: "2026-11-03T12:30:00.000Z",
      baseTargetMinutes: 480,
      targetMinutes: 360,
      permissionMinutes: 120,
      loggedMinutes: 60,
      reviewStatus: "DRAFT",
    });
    expect(
      data.days.find((d) => d.date === "2026-11-04")!.permissionMinutes,
    ).toBe(0);
  });

  it("refuses a month that is not YYYY-MM", async () => {
    await get("/timesheets/my-month?month=2026-13", employeeToken).expect(400);
    await get("/timesheets/my-month", employeeToken).expect(400);
  });

  it("a reviewer in reach opens one employee's month, with the same figures", async () => {
    const { data } = (
      await get(
        `/timesheets/employees/${employeeId}/month?month=2026-11`,
        hrToken,
      ).expect(200)
    ).body as MonthBody;
    expect(data.employee).toMatchObject({
      id: employeeId,
      name: "Perm Employee",
    });
    expect(data.summary.permissionMinutes).toBe(120);
    expect(data.days.find((d) => d.date === "2026-11-03")).toMatchObject({
      targetMinutes: 360,
      permissionMinutes: 120,
    });
  });

  it("the employee month for a reviewer is not open to the employee, nor to an unknown person", async () => {
    // The employee has no hr.timesheet.read, so the reviewer route is closed.
    await get(
      `/timesheets/employees/${employeeId}/month?month=2026-11`,
      employeeToken,
    ).expect(403);
    // A reviewer asking for someone who does not exist (or is out of reach).
    await get(
      "/timesheets/employees/999999999/month?month=2026-11",
      hrToken,
    ).expect(404);
  });

  it("a reviewer sees the permission on the employee's day, and drafts only when asked", async () => {
    // An unsubmitted day is not in the review queue ...
    await get(`/timesheets/review/${employeeId}/2026-11-03`, hrToken).expect(
      404,
    );
    // ... but the employee drill-down can read it, read-only.
    const res = await get(
      `/timesheets/review/${employeeId}/2026-11-03?drafts=true`,
      hrToken,
    ).expect(200);
    const detail = (
      res.body as {
        data: {
          status: string;
          canDecide: boolean;
          attendance: DayBody["data"]["attendance"];
        };
      }
    ).data;
    expect(detail.status).toBe("DRAFT");
    expect(detail.canDecide).toBe(false);
    expect(detail.attendance).toMatchObject({
      targetMinutes: 360,
      permissionMinutes: 120,
    });
  });

  it("the report carries the target after permissions, the permission hours and the attendance hours", async () => {
    const res = await get(
      "/timesheets/reports/employees?from=2026-11-01&to=2026-11-30",
      hrToken,
    ).expect(200);
    const lines = (
      res.body as {
        data: {
          lines: {
            employee: { id: number };
            totalMinutes: number;
            targetMinutes: number;
            permissionMinutes: number;
            attendanceMinutes: number;
          }[];
        };
      }
    ).data.lines;
    const line = lines.find((l) => l.employee.id === employeeId)!;
    expect(line.totalMinutes).toBe(60);
    expect(line.permissionMinutes).toBe(120);
    // 30 days with the 8-hour shift and no weekly off, less the 2 excused hours.
    expect(line.targetMinutes).toBe(30 * 480 - 120);
    // Punched 10:00-18:00 (480 min) against a 360-minute target: capped.
    expect(line.attendanceMinutes).toBe(360);
  });

  it("the report CSV has the three attendance columns", async () => {
    const res = await get(
      "/timesheets/reports/employees.csv?from=2026-11-01&to=2026-11-30",
      hrToken,
    ).expect(200);
    const [header, first] = (res.text ?? "").split(/\r?\n/);
    expect(header).toContain("Target Hours (after permissions)");
    expect(header).toContain("Permission Hours");
    expect(header).toContain("Attendance Hours");
    // target 14280 min = 238 h, permission 2 h, attendance 6 h
    expect(first).toMatch(/,238,2,6$/);
  });
});
