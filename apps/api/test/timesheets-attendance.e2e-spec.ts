import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { businessToday } from "../src/common/dates/business-date.js";
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface DayBody {
  data: {
    date: string;
    attendanceStatus: string | null;
    attendance: {
      status: string;
      workedMinutes: number;
      targetMinutes: number | null;
      checkInAt: string | null;
      checkOutAt: string | null;
    } | null;
    flags: { code: string; severity: string; message: string }[];
    totals: { totalMinutes: number };
    rows: { id: number }[];
  };
}
interface HistoryBody {
  data: {
    days: {
      date: string;
      carried: boolean;
      label: string;
      attendanceStatus: string | null;
    }[];
  };
}

// HR attendance on the timesheet day: every date has HR's effective status
// (calendar-derived where HR has no row), and recorded work is compared with
// it. Everything lives in its own organization, so there are no other
// holidays, weekly-off rules or shifts to disturb the expectations. The dates
// are fixed past days: 2026-11-02 is a Monday.
describe("Timesheet attendance integration (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgId: number;
  let employeeId: number;
  let projectId: number;
  let token: string;
  let suffix: string;
  let seq = 0;

  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set("Authorization", `Bearer ${token}`);
  const day = async (date: string) =>
    ((await get(`/timesheets/my/${date}`).expect(200)).body as DayBody).data;
  const codes = (d: DayBody["data"]) => d.flags.map((f) => f.code);

  /** A closed work session of `minutes` on a task, recorded for `date` (IST). */
  async function work(
    date: string,
    minutes: number,
    over: { reviewState?: string } = {},
  ) {
    seq += 1;
    const task = await prisma.projectTask.create({
      data: {
        organizationId: orgId,
        projectId,
        taskCode: `TSA/${suffix}/T${seq}`,
        title: `Attendance task ${seq}`,
        assignedToId: employeeId,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    const row = await prisma.timesheet.create({
      data: {
        organizationId: orgId,
        employeeId,
        workDate: parseDateOnly(date),
        category: "TASK",
        taskId: task.id,
        projectId,
        title: task.title,
      },
    });
    // 10:00 IST on that date
    const startedAt = new Date(`${date}T04:30:00.000Z`);
    await prisma.projectTimeEntry.create({
      data: {
        organizationId: orgId,
        taskId: task.id,
        employeeId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + minutes * 60_000),
        durationMinutes: minutes,
        entryDate: parseDateOnly(date),
        timesheetId: row.id,
        ...(over.reviewState ? { reviewState: over.reviewState } : {}),
      },
    });
    return task;
  }

  const attendance = (
    date: string,
    status: string | null,
    sessions?: { checkInAt: Date; checkOutAt: Date }[],
  ) =>
    prisma.attendanceRecord.create({
      data: {
        organizationId: orgId,
        employeeId,
        attendanceDate: parseDateOnly(date),
        ...(status ? { status } : {}),
        ...(sessions
          ? {
              sessions: {
                create: sessions.map((s) => ({ ...s, source: "SELF" })),
              },
            }
          : {}),
      },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    suffix = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Org TSA ${suffix}`, slug: `ts-att-${suffix}` },
    });
    orgId = org.id;

    const perm = await prisma.permission.upsert({
      where: { code: "employee_self_service.timesheet.read" },
      update: {},
      create: {
        code: "employee_self_service.timesheet.read",
        description: "read",
      },
    });
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${suffix}` },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });
    const email = `a@tsa-${suffix}.test`;
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: "Att A",
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    const designation = await prisma.designation.create({
      data: { organizationId: org.id, code: "ENG", name: "Engineer" },
    });
    const empType = await prisma.employmentType.create({
      data: { organizationId: org.id, code: "PERM", name: "Permanent" },
    });
    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        code: `T-${suffix}`,
        name: `Team ${suffix}`,
      },
    });
    const employee = await prisma.employee.create({
      data: {
        organization: { connect: { id: org.id } },
        user: { connect: { id: user.id } },
        team: { connect: { id: team.id } },
        employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
        fullName: "Att A",
        workEmail: email,
        designation: { connect: { id: designation.id } },
        employmentType: { connect: { id: empType.id } },
        dateOfJoining: new Date("2026-01-01T00:00:00Z"),
      },
    });
    employeeId = employee.id;
    projectId = (
      await prisma.project.create({
        data: {
          organizationId: org.id,
          projectCode: `TSA/${suffix}/1`,
          name: "Attendance project",
          startDate: new Date("2026-12-01"),
        },
      })
    ).id;

    // Sundays are the organization's weekly off from the start of the year.
    await prisma.weeklyOffRule.create({
      data: {
        organizationId: org.id,
        name: "Sunday off",
        daysOfWeek: [7],
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ organizationSlug: org.slug, email, password: "Password123!" })
      .expect(201);
    token = (res.body as { data: { accessToken: string } }).data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("a day HR has nothing for is Not marked, with no flags — never read as an absence", async () => {
    const d = await day("2026-11-02");
    expect(d.attendanceStatus).toBe("NOT_MARKED");
    expect(d.rows).toEqual([]);
    expect(d.flags).toEqual([]);
  });

  it("a weekly off is known without any attendance row", async () => {
    const d = await day("2026-11-08"); // a Sunday
    expect(d.attendanceStatus).toBe("WEEKLY_OFF");
    expect(d.flags).toEqual([]);
  });

  it("a holiday is known without any attendance row", async () => {
    await prisma.holiday.create({
      data: {
        organizationId: orgId,
        holidayDate: parseDateOnly("2026-11-10"),
        name: "Festival",
      },
    });
    const d = await day("2026-11-10");
    expect(d.attendanceStatus).toBe("HOLIDAY");
    expect(d.attendance?.status).toBe("HOLIDAY");
    expect(d.flags).toEqual([]);
  });

  it("work on a holiday or a weekly off is shown, counted, and flagged as information only", async () => {
    await work("2026-11-10", 90);
    const holiday = await day("2026-11-10");
    expect(holiday.totals.totalMinutes).toBe(90); // the hours are never dropped
    expect(holiday.flags).toMatchObject([
      { code: "WORK_ON_HOLIDAY", severity: "info" },
    ]);

    await work("2026-11-08", 30);
    expect((await day("2026-11-08")).flags).toMatchObject([
      { code: "WORK_ON_WEEKLY_OFF", severity: "info" },
    ]);
  });

  it("work on a day HR marked absent is a warning, and the absence is not changed", async () => {
    await attendance("2026-11-03", "ABSENT");
    await work("2026-11-03", 120);
    const d = await day("2026-11-03");
    expect(d.attendanceStatus).toBe("ABSENT");
    expect(d.totals.totalMinutes).toBe(120);
    expect(d.flags).toMatchObject([
      { code: "WORK_ON_ABSENT_DAY", severity: "warning" },
    ]);
    expect(
      (
        await prisma.attendanceRecord.findFirstOrThrow({
          where: { employeeId, attendanceDate: parseDateOnly("2026-11-03") },
        })
      ).status,
    ).toBe("ABSENT");
  });

  it("work on a past day with no attendance at all is a warning", async () => {
    await work("2026-11-04", 45);
    const d = await day("2026-11-04");
    expect(d.attendanceStatus).toBe("NOT_MARKED");
    expect(codes(d)).toEqual(["WORK_WITHOUT_ATTENDANCE"]);
  });

  it("a present day with punches shows HR's worked time and raises no flag", async () => {
    await attendance("2026-11-05", null, [
      {
        checkInAt: new Date("2026-11-05T03:30:00.000Z"), // 09:00 IST
        checkOutAt: new Date("2026-11-05T12:30:00.000Z"), // 18:00 IST
      },
    ]);
    await work("2026-11-05", 240);
    const d = await day("2026-11-05");
    expect(d.attendanceStatus).toBe("PRESENT");
    expect(d.attendance?.workedMinutes).toBe(540);
    // The punches the day timeline draws.
    expect(d.attendance?.checkInAt).toBe("2026-11-05T03:30:00.000Z");
    expect(d.attendance?.checkOutAt).toBe("2026-11-05T12:30:00.000Z");
    expect(d.flags).toEqual([]);
  });

  it("a half-day is shown as such, with no flag for working it", async () => {
    await attendance("2026-11-06", "HALF_DAY");
    await work("2026-11-06", 200);
    const d = await day("2026-11-06");
    expect(d.attendanceStatus).toBe("HALF_DAY");
    expect(d.flags).toEqual([]);
  });

  it("an approved leave day shows On leave; work on it is a warning", async () => {
    const leaveType = await prisma.leaveType.create({
      data: {
        organizationId: orgId,
        code: "CL",
        name: "Casual leave",
      },
    });
    await prisma.leaveRequest.create({
      data: {
        organizationId: orgId,
        employeeId,
        leaveTypeId: leaveType.id,
        startDate: parseDateOnly("2026-11-09"),
        endDate: parseDateOnly("2026-11-09"),
        reason: "Personal",
        status: "APPROVED",
        requestedBy: 1,
        decidedBy: 1,
        decidedAt: new Date(),
      },
    });
    expect((await day("2026-11-09")).attendanceStatus).toBe("ON_LEAVE");
    await work("2026-11-09", 60);
    expect(codes(await day("2026-11-09"))).toEqual(["WORK_ON_LEAVE"]);
  });

  it("a timer closed with no time counted raises the stale-session flag, even on a present day", async () => {
    await attendance("2026-11-11", "PRESENT");
    await work("2026-11-11", 0, { reviewState: "STALE_UNRESOLVED" });
    const d = await day("2026-11-11");
    expect(d.totals.totalMinutes).toBe(0);
    expect(codes(d)).toEqual(["STALE_SESSION"]);
  });

  it("today with no attendance yet is not flagged — HR may not have marked it", async () => {
    const today = businessToday();
    // an open attendance row would change the status; this employee has none today
    await work(today, 15);
    const d = await day(today);
    expect(codes(d)).not.toContain("WORK_WITHOUT_ATTENDANCE");
  });

  it("task history shows HR's status on the in-between days, including ones HR holds no row for", async () => {
    const task = await work("2026-11-05", 30); // a Thursday; has a PRESENT row
    const res = await get(
      `/timesheets/tasks/${task.id}/history?from=2026-11-05&to=2026-11-10`,
    ).expect(200);
    const days = (res.body as HistoryBody).data.days;
    const by = (date: string) => days.find((d) => d.date === date)!;
    expect(by("2026-11-05")).toMatchObject({ carried: false });
    // 6 Nov is a half day; 7 Nov HR has nothing (a Saturday, no rule); 8 Nov is a Sunday;
    // 9 Nov is approved leave; 10 Nov is a holiday
    expect(by("2026-11-06").attendanceStatus).toBe("HALF_DAY");
    expect(by("2026-11-07").attendanceStatus).toBe("NOT_MARKED");
    expect(by("2026-11-08")).toMatchObject({
      attendanceStatus: "WEEKLY_OFF",
      label: "Not worked",
    });
    expect(by("2026-11-09")).toMatchObject({
      attendanceStatus: "ON_LEAVE",
      label: "Not worked",
    });
    expect(by("2026-11-10")).toMatchObject({
      attendanceStatus: "HOLIDAY",
      label: "Not worked",
    });
  });

  it("another employee's attendance is never read: the status comes from the signed-in employee only", async () => {
    // a second employee in the same org absent on the day this one is unmarked
    const user2 = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: `b@tsa-${suffix}.test`,
        passwordHash: "x",
        fullName: "Att B",
      },
    });
    const emp1 = await prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
    });
    const other = await prisma.employee.create({
      data: {
        organizationId: orgId,
        userId: user2.id,
        teamId: emp1.teamId,
        employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
        fullName: "Att B",
        workEmail: `b@tsa-${suffix}.test`,
        designationId: emp1.designationId,
        employmentTypeId: emp1.employmentTypeId,
        dateOfJoining: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        organizationId: orgId,
        employeeId: other.id,
        attendanceDate: parseDateOnly("2026-11-12"),
        status: "ABSENT",
      },
    });
    expect((await day("2026-11-12")).attendanceStatus).toBe("NOT_MARKED");
  });
});
