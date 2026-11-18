import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { ClsService } from "nestjs-cls";
import { AppModule } from "../src/app.module.js";
import { addDays, businessDateOf } from "../src/common/dates/business-date.js";
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { OpenSessionSweepService } from "../src/modules/projects/open-session-sweep.service.js";
import { EmployeesRepository } from "../src/modules/hr/employees/employees.repository.js";
import { TaskLifecycleRepository } from "../src/modules/projects/task-lifecycle.repository.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface SessionBody {
  data: { id: number; taskId: number; timesheetId: number };
}

/** `timer/stop` with pause / complete: the closed session plus the task move. */
interface MovedBody {
  data: {
    id?: number;
    taskId: number;
    taskStatus: string;
    dailyStatus: string | null;
    timesheetId: number | null;
  };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const IST_TODAY = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

// The employee task lifecycle (Start / Pause / Resume / Complete) over HTTP, and
// the multi-day behaviour of the day layer with an injected clock (the service
// stamps `new Date()` on the server; the repository takes `now` so the Mon-Thu
// scenario can be replayed deterministically on future dates, which the
// database's "a past day is immutable" trigger — keyed on the real clock —
// does not interfere with).
describe("Timesheet task lifecycle (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let cls: ClsService;
  let lifecycle: TaskLifecycleRepository;

  let orgId: number;
  let userA: { id: number };
  let employeeA: { id: number };
  let employeeB: { id: number };
  let projectId: number;
  let tokenA: string;
  let tokenB: string;
  let userBId: number;
  let tokenNoPerm: string;
  let suffix: string;
  let taskSeq = 0;

  const mkTask = async (assignedToId: number, extra: object = {}) => {
    taskSeq += 1;
    return prisma.projectTask.create({
      data: {
        organizationId: orgId,
        projectId,
        taskCode: `TSL/${suffix}/T${taskSeq}`,
        title: `Lifecycle task ${taskSeq}`,
        assignedToId,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-31"),
        points: 25,
        ...extra,
      },
    });
  };

  /** Run repository code as the signed-in user (the audit writer reads the
   * actor from the request context). */
  const asA = <T>(fn: () => Promise<T>) =>
    cls.run(async () => {
      cls.set("organizationId", orgId);
      cls.set("userId", userA.id);
      return fn();
    });

  const post = (token: string, url: string, body: object = {}) =>
    request(app.getHttpServer())
      .post(url)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const startTimer = (token: string, taskId: number) =>
    post(token, `/projects/tasks/${taskId}/timer/start`);
  const stopTimer = (token: string, taskId: number, body: object = {}) =>
    post(token, `/projects/tasks/${taskId}/timer/stop`, body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    cls = app.get(ClsService);
    lifecycle = app.get(TaskLifecycleRepository);

    suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const org = await prisma.organization.create({
      data: { name: `Org TSL ${suffix}`, slug: `ts-life-${suffix}` },
    });
    orgId = org.id;

    const perms = await Promise.all(
      [
        "projects.timer.write",
        "employee_self_service.timesheet.read",
        "projects.task.write",
        "projects.project.delete",
      ].map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        }),
      ),
    );

    async function makeUser(email: string, grant = true) {
      const role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      if (grant) {
        await prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          fullName: email.split("@")[0] ?? "user",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

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
    async function makeEmployee(userId: number, email: string, name: string) {
      return prisma.employee.create({
        data: {
          organization: { connect: { id: org.id } },
          user: { connect: { id: userId } },
          team: { connect: { id: team.id } },
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: name,
          workEmail: email,
          designation: { connect: { id: designation.id } },
          employmentType: { connect: { id: empType.id } },
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
    }

    const emailA = `a@ts-${suffix}.test`;
    const emailB = `b@ts-${suffix}.test`;
    userA = await makeUser(emailA);
    const userB = await makeUser(emailB);
    userBId = userB.id;
    const emailNoPerm = `c@ts-${suffix}.test`;
    await makeUser(emailNoPerm, false);
    employeeA = await makeEmployee(userA.id, emailA, "Employee A");
    employeeB = await makeEmployee(userB.id, emailB, "Employee B");

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        projectCode: `TSL/${suffix}/1`,
        name: "FAS ERP",
        startDate: new Date("2026-12-01"),
      },
    });
    projectId = project.id;

    // Both are checked in today (IST) with an open attendance session so the
    // stopwatch gate passes.
    for (const e of [employeeA, employeeB]) {
      await prisma.attendanceRecord.create({
        data: {
          organizationId: org.id,
          employeeId: e.id,
          attendanceDate: new Date(`${IST_TODAY()}T00:00:00.000Z`),
          sessions: { create: { checkInAt: new Date(), source: "SELF" } },
        },
      });
    }

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: org.slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };
    tokenA = await login(emailA);
    tokenB = await login(emailB);
    tokenNoPerm = await login(emailNoPerm);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("over HTTP (timer/start, timer/stop with pause / complete)", () => {
    let taskId: number;
    let otherTaskId: number;
    let dayId: number;

    beforeAll(async () => {
      taskId = (await mkTask(employeeA.id)).id;
      otherTaskId = (await mkTask(employeeA.id)).id;
    });

    it("timer/start opens a session on today's IST day and puts the task in progress", async () => {
      const res = await startTimer(tokenA, taskId).expect(201);
      const body = (res.body as SessionBody).data;
      expect(body.taskId).toBe(taskId);

      const session = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(session.endedAt).toBeNull();
      expect(ymd(session.entryDate)).toBe(IST_TODAY()); // the IST day, not the UTC date
      expect(session.source).toBe("TIMER");
      dayId = session.timesheetId;

      const day = await prisma.timesheet.findUniqueOrThrow({
        where: { id: dayId },
      });
      expect(day).toMatchObject({
        category: "TASK",
        taskId,
        employeeId: employeeA.id,
        dailyStatus: "IN_PROGRESS",
        status: "DRAFT",
        origin: "NATIVE",
      });
      expect(ymd(day.workDate)).toBe(IST_TODAY());
      expect(
        (await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } }))
          .status,
      ).toBe("in_progress");
    });

    it("writes the status change to the audit log (the task's status history)", async () => {
      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "project_task",
          entityId: BigInt(taskId),
        },
        orderBy: { id: "asc" },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: "status_change",
        before: { status: "not_started" },
        after: { status: "in_progress" },
      });
    });

    it("a second Start on the running task is refused (422): still one open session", async () => {
      await startTimer(tokenA, taskId).expect(422);
      expect(
        await prisma.projectTimeEntry.count({
          where: { employeeId: employeeA.id, endedAt: null },
        }),
      ).toBe(1);
    });

    it("refuses another task while one is running (422)", async () => {
      await startTimer(tokenA, otherTaskId).expect(422);
      expect(
        await prisma.projectTimeEntry.count({
          where: { employeeId: employeeA.id, endedAt: null },
        }),
      ).toBe(1);
    });

    it("another employee cannot pause or complete this task (404, existence not confirmed)", async () => {
      await stopTimer(tokenB, taskId, { pause: true }).expect(404);
      await stopTimer(tokenB, taskId, { complete: true }).expect(404);
    });

    it("rejects client-supplied employee or time fields (never trusted)", async () => {
      await stopTimer(tokenA, taskId, {
        employeeId: employeeB.id,
        endedAt: "2020-01-01T00:00:00Z",
      }).expect(400);
    });

    it("refuses pause and complete together (422) and changes nothing", async () => {
      await stopTimer(tokenA, taskId, { pause: true, complete: true }).expect(
        422,
      );
      expect(
        await prisma.projectTimeEntry.count({
          where: { taskId, endedAt: null },
        }),
      ).toBe(1);
    });

    it("stop with pause closes the session, holds the task and keeps the day In Progress", async () => {
      const res = await stopTimer(tokenA, taskId, {
        pause: true,
        notes: "Waiting for the sensor spec",
      }).expect(200);
      const body = (res.body as MovedBody).data;
      expect(body.taskStatus).toBe("hold");
      expect(body.dailyStatus).toBe("IN_PROGRESS"); // a pause is not a daily status
      expect(body.timesheetId).toBe(dayId);

      const session = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: body.id! },
      });
      expect(session.endedAt).not.toBeNull();
      expect(session.closedReason).toBe("PAUSED");
      expect(session.durationMinutes).toBeGreaterThanOrEqual(1);
      expect(session.notes).toBe("Waiting for the sensor spec");

      const task = await prisma.projectTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(task.status).toBe("hold");
      expect(Number(task.loggedHours)).toBeGreaterThan(0);
    });

    it("pausing a task that is already on hold is refused (422)", async () => {
      await stopTimer(tokenA, taskId, { pause: true }).expect(422);
    });

    it("timer/start on a task on hold resumes it: today's row is reused, a second session is added", async () => {
      await startTimer(tokenA, taskId).expect(201);
      expect(
        (await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } }))
          .status,
      ).toBe("in_progress");
      expect(
        await prisma.timesheet.count({
          where: { employeeId: employeeA.id, taskId },
        }),
      ).toBe(1); // one task, one day -> one row
      expect(await prisma.projectTimeEntry.count({ where: { taskId } })).toBe(
        2,
      );
    });

    it("stop with complete closes the session, completes the task and pays the points once", async () => {
      const res = await stopTimer(tokenA, taskId, {
        complete: true,
        notes: "Delivered",
      }).expect(200);
      const body = (res.body as MovedBody).data;
      expect(body.taskStatus).toBe("completed");
      expect(body.dailyStatus).toBe("COMPLETED");

      const task = await prisma.projectTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(task.status).toBe("completed");
      expect(task.completionPercent).toBe(100);
      expect(ymd(task.actualEndDate!)).toBe(IST_TODAY()); // completion day, IST

      const day = await prisma.timesheet.findUniqueOrThrow({
        where: { id: dayId },
      });
      expect(day.dailyStatus).toBe("COMPLETED");
      expect(day.notes).toBe("Delivered");

      const points = await prisma.projectPointsLedger.findMany({
        where: { organizationId: orgId, taskId },
      });
      expect(points).toHaveLength(1);
      expect(points[0]?.points).toBe(25);
      expect(
        await prisma.projectTimeEntry.count({
          where: { taskId, endedAt: null },
        }),
      ).toBe(0);
    });

    it("a duplicate complete is refused (422) and pays nothing twice", async () => {
      await stopTimer(tokenA, taskId, { complete: true }).expect(422);
      expect(
        await prisma.projectPointsLedger.count({
          where: { organizationId: orgId, taskId },
        }),
      ).toBe(1);
    });

    it("keeps one audit row per status change: start, pause, resume, complete", async () => {
      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "project_task",
          entityId: BigInt(taskId),
        },
        orderBy: { id: "asc" },
      });
      expect(
        audit.map(
          (a) =>
            `${(a.before as { status: string }).status}>${(a.after as { status: string }).status}`,
        ),
      ).toEqual([
        "not_started>in_progress",
        "in_progress>hold",
        "hold>in_progress",
        "in_progress>completed",
      ]);
    });
  });

  describe("multi-day task (Mon works, Tue idle, Wed absent, Thu completes)", () => {
    // Future dates on purpose (see the header comment). Mon 7 Dec 2026 .. Thu 10 Dec.
    const MON_START = new Date("2026-12-07T04:30:00Z"); // 10:00 IST
    const MON_PAUSE = new Date("2026-12-07T06:30:00Z"); // 12:00 IST  -> 2h
    const THU_RESUME = new Date("2026-12-10T04:30:00Z"); // 10:00 IST
    const THU_DONE = new Date("2026-12-10T07:30:00Z"); // 13:00 IST  -> 3h
    let taskId: number;
    let mondayRowBefore: {
      id: number;
      dailyStatus: string;
      updatedAt: Date;
      status: string;
    };

    beforeAll(async () => {
      taskId = (
        await mkTask(employeeA.id, { title: "Implement Production Dashboard" })
      ).id;
    });

    it("Monday: start 10:00, pause 12:00 -> 2 hours, task on hold", async () => {
      const base = { taskId, employeeId: employeeA.id, userId: userA.id };
      await asA(() =>
        lifecycle.begin(
          { organizationId: orgId },
          { ...base, now: MON_START, mode: "start" },
        ),
      );
      await asA(() =>
        lifecycle.pause({ organizationId: orgId }, { ...base, now: MON_PAUSE }),
      );
      const monday = await prisma.timesheet.findFirstOrThrow({
        where: {
          employeeId: employeeA.id,
          taskId,
          workDate: new Date("2026-12-07"),
        },
      });
      mondayRowBefore = {
        id: monday.id,
        dailyStatus: monday.dailyStatus,
        updatedAt: monday.updatedAt,
        status: monday.status,
      };
      expect(monday.dailyStatus).toBe("IN_PROGRESS");
      const sessions = await prisma.projectTimeEntry.findMany({
        where: { taskId },
      });
      expect(sessions.map((s) => s.durationMinutes)).toEqual([120]);
      expect(
        (await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } }))
          .status,
      ).toBe("hold");
    });

    it("Tuesday and Wednesday leave NO rows and NO minutes (nothing fabricated)", async () => {
      const rows = await prisma.timesheet.findMany({
        where: { employeeId: employeeA.id, taskId },
        orderBy: { workDate: "asc" },
      });
      expect(rows.map((r) => ymd(r.workDate))).toEqual(["2026-12-07"]);
    });

    it("Thursday: resume 10:00, complete 13:00 -> 3 hours, task completed on Thursday", async () => {
      const base = { taskId, employeeId: employeeA.id, userId: userA.id };
      await asA(() =>
        lifecycle.begin(
          { organizationId: orgId },
          { ...base, now: THU_RESUME, mode: "resume" },
        ),
      );
      await asA(() =>
        lifecycle.complete(
          { organizationId: orgId },
          { ...base, now: THU_DONE },
        ),
      );

      const rows = await prisma.timesheet.findMany({
        where: { employeeId: employeeA.id, taskId },
        orderBy: { workDate: "asc" },
      });
      expect(rows.map((r) => `${ymd(r.workDate)}:${r.dailyStatus}`)).toEqual([
        "2026-12-07:IN_PROGRESS",
        "2026-12-10:COMPLETED",
      ]);
      // one session per working day, 2h + 3h, and the task's total is 5h
      const sessions = await prisma.projectTimeEntry.findMany({
        where: { taskId },
        orderBy: { startedAt: "asc" },
      });
      expect(sessions.map((s) => s.durationMinutes)).toEqual([120, 180]);
      expect(sessions.reduce((n, s) => n + s.durationMinutes, 0)).toBe(300);
      const task = await prisma.projectTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(task.status).toBe("completed");
      expect(ymd(task.actualEndDate!)).toBe("2026-12-10");
      expect(Number(task.loggedHours)).toBe(5);
    });

    it("completing on Thursday did not rewrite Monday's record", async () => {
      const monday = await prisma.timesheet.findUniqueOrThrow({
        where: { id: mondayRowBefore.id },
      });
      expect(monday.dailyStatus).toBe(mondayRowBefore.dailyStatus);
      expect(monday.status).toBe(mondayRowBefore.status);
      expect(monday.updatedAt.getTime()).toBe(
        mondayRowBefore.updatedAt.getTime(),
      );
      const mondaySessions = await prisma.projectTimeEntry.findMany({
        where: { timesheetId: monday.id },
      });
      expect(mondaySessions).toHaveLength(1);
      expect(mondaySessions[0]?.durationMinutes).toBe(120);
    });
  });

  describe("sessions never span two IST days", () => {
    it("splits a 23:00 -> 00:30 session into two days, minutes add up, both days get a row", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      const base = { taskId, employeeId: employeeA.id, userId: userA.id };
      await asA(() =>
        lifecycle.begin(
          { organizationId: orgId },
          { ...base, now: new Date("2026-12-14T17:30:00Z"), mode: "start" }, // 23:00 IST
        ),
      );
      await asA(() =>
        lifecycle.pause(
          { organizationId: orgId },
          {
            ...base,
            now: new Date("2026-12-14T19:00:00Z"), // 00:30 IST next day
          },
        ),
      );
      const sessions = await prisma.projectTimeEntry.findMany({
        where: { taskId },
        orderBy: { startedAt: "asc" },
      });
      expect(
        sessions.map((s) => [ymd(s.entryDate), s.durationMinutes]),
      ).toEqual([
        ["2026-12-14", 60],
        ["2026-12-15", 30],
      ]);
      const rows = await prisma.timesheet.findMany({
        where: { employeeId: employeeA.id, taskId },
        orderBy: { workDate: "asc" },
      });
      expect(rows.map((r) => ymd(r.workDate))).toEqual([
        "2026-12-14",
        "2026-12-15",
      ]);
      // every session sits inside its own day's row
      expect(sessions.map((s) => s.timesheetId)).toEqual(rows.map((r) => r.id));
      const task = await prisma.projectTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(Number(task.loggedHours)).toBe(1.5);
    });
  });

  describe("concurrency and invariants", () => {
    it("five simultaneous Starts of one task open exactly one session", async () => {
      const taskId = (await mkTask(employeeB.id)).id;
      const base = { taskId, employeeId: employeeB.id, userId: null };
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          asA(() =>
            lifecycle.begin(
              { organizationId: orgId },
              { ...base, now: new Date("2026-12-21T04:30:00Z"), mode: "begin" },
            ),
          ),
        ),
      );
      expect(new Set(results.map((r) => r.sessionId)).size).toBe(1);
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect(
        await prisma.projectTimeEntry.count({
          where: { taskId, endedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.timesheet.count({
          where: { employeeId: employeeB.id, taskId },
        }),
      ).toBe(1);
      // leave no running timer behind for later tests
      await prisma.projectTimeEntry.updateMany({
        where: { taskId, endedAt: null },
        data: {
          endedAt: new Date("2026-12-21T04:30:00Z"),
          durationMinutes: 0,
        },
      });
    });

    it("the database refuses a second open timer for the same employee, whatever the code does", async () => {
      const t = await mkTask(employeeA.id);
      const existing = await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: employeeA.id,
          workDate: new Date("2026-12-28"),
          category: "TASK",
          taskId: t.id,
          projectId,
          title: "x",
        },
      });
      const open = (n: number) =>
        prisma.projectTimeEntry.create({
          data: {
            organizationId: orgId,
            taskId: t.id,
            employeeId: employeeA.id,
            startedAt: new Date(`2026-12-28T0${n}:00:00Z`),
            entryDate: new Date("2026-12-28"),
            timesheetId: existing.id,
          },
        });
      const first = await open(5);
      await expect(open(6)).rejects.toThrow(/Unique constraint failed/);
      // leave no running timer behind for later tests
      await prisma.projectTimeEntry.update({
        where: { id: first.id },
        data: { endedAt: first.startedAt, durationMinutes: 0 },
      });
    });

    it("a past day's recorded status cannot be rewritten (database trigger)", async () => {
      const t = await mkTask(employeeA.id);
      const past = await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: employeeA.id,
          workDate: new Date("2026-01-05"),
          category: "TASK",
          taskId: t.id,
          projectId,
          title: "old",
        },
      });
      await expect(
        prisma.timesheet.update({
          where: { id: past.id },
          data: { dailyStatus: "COMPLETED" },
        }),
      ).rejects.toThrow(/TIMESHEET_DAY_CLOSED/);
    });

    it("a submitted day refuses new work with a clear 422", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      const first = await startTimer(tokenA, taskId).expect(201);
      await stopTimer(tokenA, taskId, { pause: true }).expect(200);
      const dayId = (first.body as SessionBody).data.timesheetId;
      await prisma.timesheet.update({
        where: { id: dayId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          submittedBy: userA.id,
        },
      });
      const res = await startTimer(tokenA, taskId).expect(422);
      expect(JSON.stringify(res.body)).toContain("already submitted");

      // A day under review takes no work through ANY task, not only this one.
      const otherTaskId = (await mkTask(employeeA.id)).id;
      const other = await startTimer(tokenA, otherTaskId).expect(422);
      expect(JSON.stringify(other.body)).toContain("already submitted");

      // Put today back: later tests in this suite start timers on today's day.
      await prisma.timesheet.update({
        where: { id: dayId },
        data: { status: "DRAFT", submittedAt: null, submittedBy: null },
      });
    });
  });

  describe("status history and guards on every path", () => {
    const patch = (token: string, url: string, body: object) =>
      request(app.getHttpServer())
        .patch(url)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
    const del = (token: string, url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set("Authorization", `Bearer ${token}`);
    const statusTrail = async (taskId: number) =>
      (
        await prisma.auditLog.findMany({
          where: {
            organizationId: orgId,
            entityType: "project_task",
            entityId: BigInt(taskId),
          },
          orderBy: { id: "asc" },
        })
      ).map(
        (a) =>
          `${(a.before as { status: string }).status}>${(a.after as { status: string }).status}`,
      );

    it("the manager PATCH path writes the same audit trail as the employee flow", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "in_progress",
      }).expect(200);
      await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "hold",
      }).expect(200);
      expect(await statusTrail(taskId)).toEqual([
        "not_started>in_progress",
        "in_progress>hold",
      ]);
      // an edit that does not change the status adds nothing to the history
      await patch(tokenA, `/projects/tasks/${taskId}`, {
        title: "Renamed",
      }).expect(200);
      expect(await statusTrail(taskId)).toHaveLength(2);
    });

    it("a reopen needs a reason, is audited with it, and re-completing pays the points only once", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "completed",
      }).expect(200);
      const paid = () =>
        prisma.projectPointsLedger.count({
          where: { organizationId: orgId, taskId },
        });
      expect(await paid()).toBe(1);

      const refused = await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "in_progress",
      }).expect(422);
      expect(JSON.stringify(refused.body)).toContain("reason is required");

      await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "in_progress",
        statusChangeReason: "Client asked for changes after delivery",
      }).expect(200);
      const reopen = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: orgId,
          entityType: "project_task",
          entityId: BigInt(taskId),
        },
        orderBy: { id: "desc" },
      });
      expect(reopen.reason).toBe("Client asked for changes after delivery");

      await patch(tokenA, `/projects/tasks/${taskId}`, {
        status: "completed",
      }).expect(200);
      expect(await paid()).toBe(1); // not paid a second time
    });

    it("a task with a running timer cannot be reassigned or deleted until it is paused", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      await startTimer(tokenA, taskId).expect(201);

      const r1 = await patch(tokenA, `/projects/tasks/${taskId}`, {
        assignedToId: employeeB.id,
      }).expect(409);
      expect(JSON.stringify(r1.body)).toContain("running timer");
      await del(tokenA, `/projects/tasks/${taskId}`).expect(409);

      await stopTimer(tokenA, taskId, { pause: true }).expect(200);
      await patch(tokenA, `/projects/tasks/${taskId}`, {
        assignedToId: employeeB.id,
      }).expect(200);
    });

    it("a project with a running timer cannot be deleted", async () => {
      const proj = await prisma.project.create({
        data: {
          organizationId: orgId,
          projectCode: `TSL/${suffix}/DEL`,
          name: "To delete",
          startDate: new Date("2026-12-01"),
        },
      });
      const task = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId: proj.id,
          taskCode: `TSL/${suffix}/DEL-T1`,
          title: "Running",
          assignedToId: employeeA.id,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      await startTimer(tokenA, task.id).expect(201);
      const res = await del(tokenA, `/projects/${proj.id}`).expect(409);
      expect(JSON.stringify(res.body)).toContain("running timer");
      await stopTimer(tokenA, task.id, { pause: true }).expect(200);
      await del(tokenA, `/projects/${proj.id}`).expect(200);
    });
  });

  describe("the legacy stopwatch endpoints write the same linked records", () => {
    it("timer/start and timer/stop create a linked IST-day session and move the task", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      const started = await post(
        tokenA,
        `/projects/tasks/${taskId}/timer/start`,
      ).expect(201);
      const sessionId = (started.body as { data: { id: number } }).data.id;

      const open = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: sessionId },
      });
      expect(open.timesheetId).toBeGreaterThan(0);
      expect(ymd(open.entryDate)).toBe(IST_TODAY());
      expect(
        (await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } }))
          .status,
      ).toBe("in_progress");

      await post(tokenA, `/projects/tasks/${taskId}/timer/stop`, {
        notes: "done for now",
      }).expect(200);
      const closed = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: sessionId },
      });
      expect(closed.endedAt).not.toBeNull();
      expect(closed.closedReason).toBe("STOPPED");
      // stopping is not pausing: the task status is left to the caller
      expect(
        (await prisma.projectTask.findUniqueOrThrow({ where: { id: taskId } }))
          .status,
      ).toBe("in_progress");
    });

    it("a manual entry becomes a linked duration-only session; a future date is refused", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      const res = await post(tokenA, `/projects/tasks/${taskId}/time-entries`, {
        durationMinutes: 45,
        entryDate: IST_TODAY(),
        notes: "Pair debugging",
      }).expect(201);
      const entry = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: (res.body as { data: { id: number } }).data.id },
      });
      expect(entry).toMatchObject({
        source: "MANUAL",
        timePrecision: "DURATION_ONLY",
        durationMinutes: 45,
      });
      expect(entry.timesheetId).toBeGreaterThan(0);

      const tomorrow = new Date(Date.now() + 36 * 3600_000)
        .toISOString()
        .slice(0, 10);
      await post(tokenA, `/projects/tasks/${taskId}/time-entries`, {
        durationMinutes: 45,
        entryDate: tomorrow,
      }).expect(422);
    });

    it("an employee can still stop their own timer after the task was deleted", async () => {
      const taskId = (await mkTask(employeeA.id)).id;
      await post(tokenA, `/projects/tasks/${taskId}/timer/start`).expect(201);
      await prisma.projectTask.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
      await post(tokenA, `/projects/tasks/${taskId}/timer/stop`).expect(200);
      expect(
        await prisma.projectTimeEntry.count({
          where: { taskId, endedAt: null },
        }),
      ).toBe(0);
    });
  });

  describe("employees with timesheet history", () => {
    it("cannot be hard-deleted: a clear conflict says to deactivate instead", async () => {
      const repo = app.get(EmployeesRepository, { strict: false });
      await expect(
        asA(() => repo.delete({ organizationId: orgId }, employeeA.id)),
      ).rejects.toThrow(/timesheet records/);
      expect(await prisma.employee.count({ where: { id: employeeA.id } })).toBe(
        1,
      );
    });

    it("an employee with no timesheet history is still deleted as before", async () => {
      const team = await prisma.team.findFirstOrThrow({
        where: { organizationId: orgId },
      });
      const designation = await prisma.designation.findFirstOrThrow({
        where: { organizationId: orgId },
      });
      const empType = await prisma.employmentType.findFirstOrThrow({
        where: { organizationId: orgId },
      });
      const lone = await prisma.employee.create({
        data: {
          organization: { connect: { id: orgId } },
          team: { connect: { id: team.id } },
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: "No History",
          workEmail: `lone@ts-${suffix}.test`,
          designation: { connect: { id: designation.id } },
          employmentType: { connect: { id: empType.id } },
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
      const repo = app.get(EmployeesRepository, { strict: false });
      await expect(
        asA(() => repo.delete({ organizationId: orgId }, lone.id)),
      ).resolves.toBe(true);
    });
  });

  describe("read side: my day and a task's day history", () => {
    const get = (token: string, url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set("Authorization", `Bearer ${token}`);

    interface DayBody {
      data: {
        date: string;
        attendanceStatus: string | null;
        totals: {
          taskMinutes: number;
          customMinutes: number;
          totalMinutes: number;
          rowCount: number;
        };
        rows: {
          id: number;
          category: string;
          taskId: number | null;
          taskCode: string | null;
          dailyStatus: string;
          durationMinutes: number;
          sessions: { id: number; endedAt: string | null }[];
        }[];
        carried: { taskId: number; taskStatus: string; minutes: number }[];
      };
    }
    interface HistoryBody {
      data: {
        task: { id: number; status: string };
        totalMinutes: number;
        days: {
          date: string;
          carried: boolean;
          minutes: number;
          label: string;
          attendanceStatus: string | null;
          dailyStatus: string | null;
        }[];
      };
    }

    let workedTaskId: number;
    let idleTaskId: number;
    const today = IST_TODAY();
    const yesterday = addDays(today, -1);

    beforeAll(async () => {
      workedTaskId = (await mkTask(employeeA.id)).id;
      // assigned and in progress, but no work today -> a carried (no-work) item
      idleTaskId = (await mkTask(employeeA.id, { status: "in_progress" })).id;
      // HR recorded yesterday as an absence
      await prisma.attendanceRecord.create({
        data: {
          organizationId: orgId,
          employeeId: employeeA.id,
          attendanceDate: new Date(`${yesterday}T00:00:00.000Z`),
          status: "ABSENT",
        },
      });
      await startTimer(tokenA, workedTaskId).expect(201);
    });

    it("needs a login (401) and the timesheet permission (403)", async () => {
      await request(app.getHttpServer())
        .get(`/timesheets/my/${today}`)
        .expect(401);
      await get(tokenNoPerm, `/timesheets/my/${today}`).expect(403);
      await get(
        tokenNoPerm,
        `/timesheets/tasks/${workedTaskId}/history?from=${today}&to=${today}`,
      ).expect(403);
    });

    it("rejects a malformed date (400)", async () => {
      await get(tokenA, "/timesheets/my/16-11-2026").expect(400);
      await get(tokenA, "/timesheets/my/2026-02-30").expect(400);
    });

    it("my day: the worked task has one row with its running session; an open session counts for nothing yet", async () => {
      const res = await get(tokenA, `/timesheets/my/${today}`).expect(200);
      const day = (res.body as DayBody).data;
      expect(day.date).toBe(today);
      const row = day.rows.find((r) => r.taskId === workedTaskId)!;
      expect(row).toMatchObject({
        category: "TASK",
        dailyStatus: "IN_PROGRESS",
      });
      expect(row.sessions).toHaveLength(1);
      expect(row.sessions[0]?.endedAt).toBeNull();
      // the running session adds nothing until it is closed; the day total is
      // exactly the sum of the rows (other tests already logged time today)
      expect(row.durationMinutes).toBe(0);
      expect(day.totals.totalMinutes).toBe(
        day.rows.reduce((n, r) => n + r.durationMinutes, 0),
      );
    });

    it("my day: an assigned in-progress task with no work today is shown as carried, 0 minutes, and not counted", async () => {
      const res = await get(tokenA, `/timesheets/my/${today}`).expect(200);
      const day = (res.body as DayBody).data;
      const idle = day.carried.find((c) => c.taskId === idleTaskId);
      expect(idle).toMatchObject({ taskStatus: "in_progress", minutes: 0 });
      expect(day.carried.some((c) => c.taskId === workedTaskId)).toBe(false);
      expect(day.rows.some((r) => r.taskId === idleTaskId)).toBe(false); // no row stored
      expect(day.totals.rowCount).toBe(day.rows.length);
    });

    it("my day: totals follow the closed sessions once the task is paused", async () => {
      await stopTimer(tokenA, workedTaskId, { pause: true }).expect(200);
      const res = await get(tokenA, `/timesheets/my/${today}`).expect(200);
      const day = (res.body as DayBody).data;
      const row = day.rows.find((r) => r.taskId === workedTaskId)!;
      expect(row.durationMinutes).toBeGreaterThanOrEqual(1);
      const taskRows = day.rows.filter((r) => r.category === "TASK");
      expect(day.totals.taskMinutes).toBe(
        taskRows.reduce((n, r) => n + r.durationMinutes, 0),
      );
      expect(day.totals.taskMinutes).toBeGreaterThanOrEqual(
        row.durationMinutes,
      );
      expect(day.totals.totalMinutes).toBe(
        day.totals.taskMinutes + day.totals.customMinutes,
      );
      // the day stays In Progress after a pause
      expect(row.dailyStatus).toBe("IN_PROGRESS");
    });

    it("my day: a day with no work is empty, with HR's status where HR has a record", async () => {
      const res = await get(tokenA, `/timesheets/my/${yesterday}`).expect(200);
      const day = (res.body as DayBody).data;
      expect(day.rows).toEqual([]);
      expect(day.totals.totalMinutes).toBe(0);
      expect(day.attendanceStatus).toBe("ABSENT"); // from HR, never inferred
      expect(day.carried).toEqual([]); // carried tasks are only shown for today
    });

    it("my day: only the caller's own rows (employee B sees none of A's work)", async () => {
      const res = await get(tokenB, `/timesheets/my/${today}`).expect(200);
      expect(
        (res.body as DayBody).data.rows.some((r) => r.taskId === workedTaskId),
      ).toBe(false);
    });

    it("task history: the worked day is recorded, earlier days are derived with 0 minutes", async () => {
      const from = addDays(today, -2);
      const res = await get(
        tokenA,
        `/timesheets/tasks/${workedTaskId}/history?from=${from}&to=${today}`,
      ).expect(200);
      const history = (res.body as HistoryBody).data;
      expect(history.days.map((d) => d.date)).toEqual([from, yesterday, today]);

      const todayRow = history.days[2]!;
      expect(todayRow).toMatchObject({
        carried: false,
        dailyStatus: "IN_PROGRESS",
      });
      expect(todayRow.minutes).toBeGreaterThanOrEqual(1);

      // the days before the task was started: nothing stored, nothing counted
      for (const d of history.days.slice(0, 2)) {
        expect(d).toMatchObject({
          carried: true,
          minutes: 0,
          dailyStatus: null,
        });
      }
      // HR's absence is shown, and wins the label
      expect(history.days[1]).toMatchObject({
        attendanceStatus: "ABSENT",
        label: "Not worked",
      });
      expect(history.totalMinutes).toBe(todayRow.minutes);
    });

    it("task history: another employee's task is a 404, and a bad range is refused (422)", async () => {
      await get(
        tokenB,
        `/timesheets/tasks/${workedTaskId}/history?from=${today}&to=${today}`,
      ).expect(404);
      await get(
        tokenA,
        `/timesheets/tasks/${workedTaskId}/history?from=${today}&to=${yesterday}`,
      ).expect(422);
      await get(
        tokenA,
        `/timesheets/tasks/${workedTaskId}/history?from=${addDays(today, -70)}&to=${today}`,
      ).expect(422);
    });
  });

  describe("forgotten timers (open-session sweep)", () => {
    let sweep: OpenSessionSweepService;

    beforeAll(() => {
      sweep = app.get(OpenSessionSweepService);
    });

    /** A timer left running: an open session on a task assigned to employee B,
     * linked to its day's row, started at `startedAt`. */
    async function openSession(startedAt: Date) {
      const task = await mkTask(employeeB.id);
      const day = await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: employeeB.id,
          workDate: parseDateOnly(businessDateOf(startedAt)),
          category: "TASK",
          taskId: task.id,
          projectId,
          title: task.title,
        },
      });
      const session = await prisma.projectTimeEntry.create({
        data: {
          organizationId: orgId,
          taskId: task.id,
          employeeId: employeeB.id,
          startedAt,
          entryDate: parseDateOnly(businessDateOf(startedAt)),
          timesheetId: day.id,
        },
      });
      return { task, session };
    }

    /** HR's attendance record with one session. */
    const attendanceDay = (date: string, checkInAt: Date, checkOutAt: Date) =>
      prisma.attendanceRecord.create({
        data: {
          organizationId: orgId,
          employeeId: employeeB.id,
          attendanceDate: parseDateOnly(date),
          sessions: { create: { checkInAt, checkOutAt, source: "SELF" } },
        },
      });

    it("closes a forgotten timer at the employee's real check-out, with the hours rolled up", async () => {
      const { task, session } = await openSession(
        new Date("2026-11-10T04:30:00Z"), // 10:00 IST
      );
      await attendanceDay(
        "2026-11-10",
        new Date("2026-11-10T03:30:00Z"),
        new Date("2026-11-10T12:30:00Z"), // checked out 18:00 IST
      );

      const result = await sweep.runForOrganization(
        orgId,
        new Date("2026-11-10T14:00:00Z"),
      );
      expect(result.closedAtCheckout).toBeGreaterThanOrEqual(1);

      const closed = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(closed.endedAt?.toISOString()).toBe("2026-11-10T12:30:00.000Z");
      expect(closed.durationMinutes).toBe(480);
      expect(closed.closedReason).toBe("ATTENDANCE_CHECKOUT");
      expect(closed.reviewState).toBe("OK");
      expect(
        Number(
          (
            await prisma.projectTask.findUniqueOrThrow({
              where: { id: task.id },
            })
          ).loggedHours,
        ),
      ).toBe(8);
    });

    it("a check-out after IST midnight splits the session across both days; the minutes add up", async () => {
      const { session } = await openSession(
        new Date("2026-11-12T17:30:00Z"), // 23:00 IST
      );
      await attendanceDay(
        "2026-11-12",
        new Date("2026-11-12T04:00:00Z"),
        new Date("2026-11-12T19:00:00Z"), // checked out 00:30 IST next day
      );

      await sweep.runForOrganization(orgId, new Date("2026-11-13T03:00:00Z"));

      const parts = await prisma.projectTimeEntry.findMany({
        where: {
          taskId: (
            await prisma.projectTimeEntry.findUniqueOrThrow({
              where: { id: session.id },
            })
          ).taskId,
        },
        orderBy: { startedAt: "asc" },
      });
      expect(parts.map((p) => [ymd(p.entryDate), p.durationMinutes])).toEqual([
        ["2026-11-12", 60],
        ["2026-11-13", 30],
      ]);
      expect(new Set(parts.map((p) => p.timesheetId)).size).toBe(2); // one row per day
    });

    it("no check-out and midnight crossed: closed with ZERO minutes, flagged, employee told once", async () => {
      const { task, session } = await openSession(
        new Date("2026-11-14T12:00:00Z"), // 17:30 IST
      );
      const now = new Date("2026-11-14T19:00:00Z"); // 00:30 IST next day

      const first = await sweep.runForOrganization(orgId, now);
      expect(first.closedStale).toBeGreaterThanOrEqual(1);

      const closed = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(closed.endedAt?.getTime()).toBe(closed.startedAt.getTime()); // no invented end
      expect(closed.durationMinutes).toBe(0);
      expect(closed.reviewState).toBe("STALE_UNRESOLVED");
      expect(closed.closedReason).toBe("STALE");
      expect(
        Number(
          (
            await prisma.projectTask.findUniqueOrThrow({
              where: { id: task.id },
            })
          ).loggedHours,
        ),
      ).toBe(0);

      const notices = await prisma.notification.findMany({
        where: {
          organizationId: orgId,
          userId: userBId,
          dedupKey: `timesheet.stale:${session.id}`,
        },
      });
      expect(notices).toHaveLength(1);
      expect(notices[0]?.type).toBe("timesheet.stale_session");

      // a repeat run finds nothing left to do and tells no one again
      await sweep.runForOrganization(orgId, now);
      expect(
        await prisma.notification.count({
          where: {
            organizationId: orgId,
            dedupKey: `timesheet.stale:${session.id}`,
          },
        }),
      ).toBe(1);
    });

    it("a timer that is simply still running is left alone", async () => {
      const { session } = await openSession(new Date("2026-11-15T04:30:00Z"));
      await sweep.runForOrganization(orgId, new Date("2026-11-15T08:30:00Z"));
      const still = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(still.endedAt).toBeNull();
      // leave nothing running for later tests
      await prisma.projectTimeEntry.update({
        where: { id: session.id },
        data: { endedAt: session.startedAt, durationMinutes: 0 },
      });
    });

    it("a forgotten timer from an earlier day never blocks starting a new one", async () => {
      await openSession(new Date(Date.now() - 3 * 86_400_000)); // three days ago
      const fresh = await mkTask(employeeB.id);
      // employee B is checked in today (fixture), so Start must succeed
      await startTimer(tokenB, fresh.id).expect(201);
      expect(
        await prisma.projectTimeEntry.count({
          where: { employeeId: employeeB.id, endedAt: null },
        }),
      ).toBe(1); // only the new one is running
      // stop it again so no timer is left running
      await stopTimer(tokenB, fresh.id).expect(200);
    });
  });
});
