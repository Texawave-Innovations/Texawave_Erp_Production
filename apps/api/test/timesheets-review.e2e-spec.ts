import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { BOM } from "../src/common/csv/csv.js";
import { addDays, businessToday } from "../src/common/dates/business-date.js";

// the export starts with a UTF-8 byte-order mark so Excel reads names correctly
const BOM_RE = new RegExp(`^${BOM}`);
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface DayBody {
  data: {
    date: string;
    flags: { code: string }[];
    review: {
      status: string | null;
      stage: string | null;
      approvalLevels: number;
      firstApprovedAt: string | null;
      decidedAt: string | null;
      decisionNote: string | null;
      canSubmit: boolean;
    };
    rows: { id: number; submissionStatus: string }[];
  };
}
interface DecisionBody {
  data: {
    status: string;
    stage: number;
    override: boolean;
    rowCount: number;
  };
}
// the list endpoints answer { data: items[], meta: { total, ... } }
interface ListBody {
  data: {
    employee: { id: number };
    date: string;
    status: string;
    stage: string | null;
    approvalLevels: number;
  }[];
  meta: { total: number };
}
interface DetailBody {
  data: {
    canDecide: boolean;
    status: string;
    flags: { code: string }[];
    attendanceStatusAtSubmit: string | null;
    rows: unknown[];
  };
}

// Submit and review of timesheet days: the reporting manager gives the first
// approval, HR the second (or HR alone when the employee has no reporting
// manager). Its own organization, its own people, fixed past dates.
describe("Timesheet submit and review (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgId: number;
  let projectId: number;
  let suffix: string;
  let seq = 0;

  const people = {} as Record<
    "emp" | "lonely" | "manager" | "stranger" | "hr" | "hrEmp",
    { userId: number; employeeId: number | null; token: string }
  >;

  const today = businessToday();

  const call = (
    method: "get" | "post",
    who: keyof typeof people,
    url: string,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set("Authorization", `Bearer ${people[who].token}`);
    return body ? req.send(body) : req;
  };
  const myDay = async (who: keyof typeof people, date: string) =>
    (
      (await call("get", who, `/timesheets/my/${date}`).expect(200))
        .body as DayBody
    ).data;
  const submit = (who: keyof typeof people, date: string) =>
    call("post", who, `/timesheets/my/${date}/submit`);
  const approve = (
    who: keyof typeof people,
    employeeId: number,
    date: string,
    note?: string,
  ) =>
    call(
      "post",
      who,
      `/timesheets/review/${employeeId}/${date}/approve`,
      note ? { note } : {},
    );
  const reject = (
    who: keyof typeof people,
    employeeId: number,
    date: string,
    note?: string,
  ) =>
    call(
      "post",
      who,
      `/timesheets/review/${employeeId}/${date}/reject`,
      note ? { note } : {},
    );
  const awaiting = async (who: keyof typeof people) =>
    (
      (
        await call("get", who, "/timesheets/review/awaiting?limit=100").expect(
          200,
        )
      ).body as ListBody
    ).data;

  /** A closed work session of `minutes` for the employee on `date` (IST). */
  async function work(employeeId: number, date: string, minutes = 60) {
    seq += 1;
    const task = await prisma.projectTask.create({
      data: {
        organizationId: orgId,
        projectId,
        taskCode: `TSR/${suffix}/T${seq}`,
        title: `Review task ${seq}`,
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
      },
    });
    return row;
  }

  /** One open timer per employee is a database rule: close a test's leftover
   * so the next test can open its own. (Zero minutes, like a stale close.) */
  const closeOpenSessions = (employeeId: number) =>
    prisma.$executeRaw`UPDATE projects.project_time_entries SET ended_at = started_at, duration_minutes = 0 WHERE employee_id = ${employeeId} AND ended_at IS NULL`;

  const rowsOf = (employeeId: number, date: string) =>
    prisma.timesheet.findMany({
      where: { employeeId, workDate: parseDateOnly(date), deletedAt: null },
    });
  const auditActions = async (rowId: number) =>
    (
      await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "timesheet_day",
          entityId: BigInt(rowId),
        },
        orderBy: { id: "asc" },
      })
    ).map((a) => a.action);
  const noticesTo = (userId: number, type: string) =>
    prisma.notification.findMany({
      where: { organizationId: orgId, userId, type },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const org = await prisma.organization.create({
      data: { name: `Org TSR ${suffix}`, slug: `ts-rev-${suffix}` },
    });
    orgId = org.id;

    const codes = {
      self: [
        "employee_self_service.timesheet.read",
        "employee_self_service.timesheet.write",
        "employee_self_service.timesheet.submit",
        "projects.timer.write",
      ],
      manager: ["hr.timesheet.read.own", "hr.timesheet.approve.own"],
      hr: [
        "hr.timesheet.read.all",
        "hr.timesheet.approve.all",
        "hr.timesheet.export.all",
      ],
    };
    const perm = async (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });

    async function makeUser(name: string, grant: string[]) {
      const role = await prisma.role.create({
        data: { organizationId: org.id, name: `role-${name}-${suffix}` },
      });
      for (const code of grant) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: (await perm(code)).id },
        });
      }
      const email = `${name}@tsr-${suffix}.test`;
      const user = await prisma.user.create({
        data: { organizationId: org.id, email, passwordHash, fullName: name },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return { user, email };
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
    async function makeEmployee(
      userId: number,
      email: string,
      name: string,
      reportsToId?: number,
    ) {
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
          ...(reportsToId
            ? { reportsTo: { connect: { id: reportsToId } } }
            : {}),
        },
      });
    }

    const mgrU = await makeUser("manager", [...codes.self, ...codes.manager]);
    const mgrE = await makeEmployee(mgrU.user.id, mgrU.email, "Manager");
    const empU = await makeUser("emp", codes.self);
    const empE = await makeEmployee(empU.user.id, empU.email, "Emp", mgrE.id);
    const lonelyU = await makeUser("lonely", codes.self);
    const lonelyE = await makeEmployee(
      lonelyU.user.id,
      lonelyU.email,
      "Lonely",
    );
    // another manager's person: holds approve.own but manages nobody here
    const strU = await makeUser("stranger", [...codes.self, ...codes.manager]);
    const strE = await makeEmployee(strU.user.id, strU.email, "Stranger");
    // HR, deliberately NOT anyone's reporting manager
    const hrU = await makeUser("hr", codes.hr);
    // an employee who is also an HR approver (for the self-decision rule)
    const hrEmpU = await makeUser("hrEmp", [...codes.self, ...codes.hr]);
    const hrEmpE = await makeEmployee(hrEmpU.user.id, hrEmpU.email, "HR Emp");

    projectId = (
      await prisma.project.create({
        data: {
          organizationId: org.id,
          projectCode: `TSR/${suffix}/1`,
          name: "Review project",
          startDate: new Date("2026-12-01"),
        },
      })
    ).id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: org.slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };
    people.emp = {
      userId: empU.user.id,
      employeeId: empE.id,
      token: await login(empU.email),
    };
    people.lonely = {
      userId: lonelyU.user.id,
      employeeId: lonelyE.id,
      token: await login(lonelyU.email),
    };
    people.manager = {
      userId: mgrU.user.id,
      employeeId: mgrE.id,
      token: await login(mgrU.email),
    };
    people.stranger = {
      userId: strU.user.id,
      employeeId: strE.id,
      token: await login(strU.email),
    };
    people.hr = {
      userId: hrU.user.id,
      employeeId: null,
      token: await login(hrU.email),
    };
    people.hrEmp = {
      userId: hrEmpU.user.id,
      employeeId: hrEmpE.id,
      token: await login(hrEmpU.email),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  const empId = () => people.emp.employeeId!;
  const lonelyId = () => people.lonely.employeeId!;

  describe("submit", () => {
    it("a day with no work, or in the future, cannot be submitted (422)", async () => {
      const empty = await submit("emp", "2026-09-01").expect(422);
      expect((empty.body as { error: string }).error).toBe(
        "TIMESHEET_NOTHING_TO_SUBMIT",
      );
      const future = await submit("emp", addDays(today, 3)).expect(422);
      expect((future.body as { error: string }).error).toBe(
        "TIMESHEET_FUTURE_DAY",
      );
    });

    it("a day with a timer still running cannot be submitted (422)", async () => {
      const date = "2026-09-02";
      const row = await work(empId(), date);
      await prisma.projectTimeEntry.create({
        data: {
          organizationId: orgId,
          taskId: row.taskId!,
          employeeId: empId(),
          startedAt: new Date(`${date}T08:00:00.000Z`),
          entryDate: parseDateOnly(date),
          timesheetId: row.id,
        },
      });
      const res = await submit("emp", date).expect(422);
      expect((res.body as { error: string }).error).toBe(
        "TIMESHEET_OPEN_SESSION",
      );
      expect((await myDay("emp", date)).review.canSubmit).toBe(false);
      await closeOpenSessions(empId());
    });

    it("submits every row of the day, routes it to the reporting manager, and locks it", async () => {
      const date = "2026-09-03";
      await work(empId(), date, 90);
      expect((await myDay("emp", date)).review).toMatchObject({
        status: "DRAFT",
        canSubmit: true,
      });

      const res = await submit("emp", date).expect(201);
      expect((res.body as { data: object }).data).toMatchObject({
        date,
        rowCount: 1,
        approvalLevels: 2,
        approverBasis: "REPORTING_MANAGER",
      });

      const [row] = await rowsOf(empId(), date);
      expect(row).toMatchObject({
        status: "SUBMITTED",
        approvalLevels: 2,
        approverBasis: "REPORTING_MANAGER",
        submittedBy: people.emp.userId,
        attendanceStatusAtSubmit: "NOT_MARKED",
      });
      expect(row?.approverEmployeeId).toBe(people.manager.employeeId);
      expect(await auditActions(row!.id)).toEqual(["submit"]);

      const day = await myDay("emp", date);
      expect(day.review).toMatchObject({
        status: "SUBMITTED",
        stage: "MANAGER",
        canSubmit: false,
      });
      // the manager is told; the employee is not
      expect(
        await noticesTo(people.manager.userId, "timesheet.submitted"),
      ).toHaveLength(1);
      expect(
        await noticesTo(people.emp.userId, "timesheet.submitted"),
      ).toHaveLength(0);

      // submitting again, and adding work to the locked day, are refused
      const again = await submit("emp", date).expect(422);
      expect((again.body as { error: string }).error).toBe(
        "TIMESHEET_ALREADY_SUBMITTED",
      );
    });

    it("a person with no reporting manager is routed to HR alone", async () => {
      const date = "2026-09-04";
      await work(lonelyId(), date);
      const res = await submit("lonely", date).expect(201);
      expect((res.body as { data: object }).data).toMatchObject({
        approvalLevels: 1,
        approverBasis: "HR",
      });
      expect((await myDay("lonely", date)).review.stage).toBe("HR");
    });

    it("submit needs the submit permission (403) and a login (401)", async () => {
      await request(app.getHttpServer())
        .post("/timesheets/my/2026-09-03/submit")
        .expect(401);
      await submit("hr", "2026-09-03").expect(403);
    });

    it("a week submits every day with work and skips the rest, reporting the ones it could not send", async () => {
      // Mon 2026-08-03 .. Sun: work on Mon and Wed, a running timer on Thu
      const monday = "2026-08-03";
      await work(empId(), monday);
      await work(empId(), addDays(monday, 2));
      const thu = addDays(monday, 3);
      const thuRow = await work(empId(), thu);
      await prisma.projectTimeEntry.create({
        data: {
          organizationId: orgId,
          taskId: thuRow.taskId!,
          employeeId: empId(),
          startedAt: new Date(`${thu}T08:00:00.000Z`),
          entryDate: parseDateOnly(thu),
          timesheetId: thuRow.id,
        },
      });

      const res = await call("post", "emp", "/timesheets/my/submit-week", {
        weekStart: addDays(monday, 4), // any date in the week
      }).expect(201);
      const body = (
        res.body as {
          data: {
            weekStart: string;
            submitted: { date: string }[];
            skipped: { date: string; reason: string }[];
          };
        }
      ).data;
      expect(body.weekStart).toBe(monday);
      expect(body.submitted.map((d) => d.date)).toEqual([
        monday,
        addDays(monday, 2),
      ]);
      expect(body.skipped.map((d) => d.date)).toEqual([thu]);
      expect(body.skipped[0]?.reason).toMatch(/timer is still running/);
      await closeOpenSessions(empId());
    });
  });

  describe("two-level approval: reporting manager, then HR", () => {
    const date = "2026-09-10";
    beforeAll(async () => {
      await work(empId(), date, 120);
      await submit("emp", date).expect(201);
    });

    it("the manager and HR see the day waiting; a stranger and the employee do not", async () => {
      const mine = await awaiting("manager");
      expect(
        mine.find((d) => d.employee.id === empId() && d.date === date),
      ).toMatchObject({ stage: "MANAGER", approvalLevels: 2 });
      expect(
        (await awaiting("hr")).some(
          (d) => d.employee.id === empId() && d.date === date,
        ),
      ).toBe(true); // HR may override
      expect(
        (await awaiting("stranger")).some((d) => d.employee.id === empId()),
      ).toBe(false);
    });

    it("a reviewer outside the reporting line gets a 404, never the day", async () => {
      await call(
        "get",
        "stranger",
        `/timesheets/review/${empId()}/${date}`,
      ).expect(404);
      await approve("stranger", empId(), date).expect(404);
    });

    it("rejecting needs a reason (422)", async () => {
      const res = await reject("manager", empId(), date).expect(422);
      expect((res.body as { error: string }).error).toBe(
        "TIMESHEET_DECISION_NOTE_REQUIRED",
      );
    });

    it("the manager's approval is the first, not the last: the day stays submitted for HR", async () => {
      const res = await approve("manager", empId(), date, "Looks right").expect(
        201,
      );
      expect((res.body as DecisionBody).data).toMatchObject({
        status: "SUBMITTED",
        stage: 1,
        override: false,
      });
      const rows = await rowsOf(empId(), date);
      expect(rows[0]).toMatchObject({
        status: "SUBMITTED",
        firstDecidedBy: people.manager.userId,
        firstDecisionNote: "Looks right",
      });
      expect(rows[0]?.decidedAt).toBeNull();

      expect((await myDay("emp", date)).review).toMatchObject({
        status: "SUBMITTED",
        stage: "HR",
      });
      // the employee and HR are told
      expect(
        await noticesTo(people.emp.userId, "timesheet.first_approved"),
      ).toHaveLength(1);
      expect(
        await noticesTo(people.hr.userId, "timesheet.awaiting_hr"),
      ).not.toHaveLength(0);
      // the manager cannot approve again: it now waits for HR
      await approve("manager", empId(), date).expect(403);
      expect(
        (await awaiting("manager")).some(
          (d) => d.employee.id === empId() && d.date === date,
        ),
      ).toBe(false);
      const detail = (
        (
          await call(
            "get",
            "manager",
            `/timesheets/review/${empId()}/${date}`,
          ).expect(200)
        ).body as DetailBody
      ).data;
      expect(detail.canDecide).toBe(false);
    });

    it("HR gives the second approval: the day is approved and the employee is told", async () => {
      const res = await approve("hr", empId(), date, "Approved").expect(201);
      expect((res.body as DecisionBody).data).toMatchObject({
        status: "APPROVED",
        stage: 2,
        override: false,
      });
      const [row] = await rowsOf(empId(), date);
      expect(row).toMatchObject({
        status: "APPROVED",
        decidedBy: people.hr.userId,
        decisionNote: "Approved",
      });
      expect(await auditActions(row!.id)).toEqual([
        "submit",
        "first_approve",
        "approve",
      ]);
      expect(
        await noticesTo(people.emp.userId, "timesheet.approved"),
      ).toHaveLength(1);
      expect((await myDay("emp", date)).review).toMatchObject({
        status: "APPROVED",
        stage: null,
      });
      // a decided day is final
      await approve("hr", empId(), date).expect(422);
      await reject("hr", empId(), date, "too late").expect(422);
    });

    it("an approved day is locked: its work cannot be edited or added to", async () => {
      const res = await call("post", "emp", "/timesheets/custom-activities", {
        category: "INTERNAL_MEETING",
        title: "Late addition",
        workDate: date,
        startTime: "09:00",
        endTime: "10:00",
        lateEntryReason: "forgot",
      }).expect(422);
      expect((res.body as { error: string }).error).toBe("TIMESHEET_LOCKED");
    });
  });

  describe("returning a day", () => {
    const date = "2026-09-11";
    beforeAll(async () => {
      await work(empId(), date, 45);
      await submit("emp", date).expect(201);
    });

    it("a manager returns a day with a reason; the employee sees it, fixes it and resubmits from scratch", async () => {
      // first approval given, then HR returns it: the first approval is void
      await approve("manager", empId(), date).expect(201);
      const res = await reject(
        "hr",
        empId(),
        date,
        "Hours do not match",
      ).expect(201);
      expect((res.body as DecisionBody).data.status).toBe("REJECTED");

      const returned = await myDay("emp", date);
      expect(returned.review).toMatchObject({
        status: "REJECTED",
        decisionNote: "Hours do not match",
        canSubmit: true,
      });
      expect(
        await noticesTo(people.emp.userId, "timesheet.rejected"),
      ).not.toHaveLength(0);

      // a returned day is editable again
      await call("post", "emp", "/timesheets/custom-activities", {
        category: "INTERNAL_MEETING",
        title: "Missing meeting",
        workDate: date,
        startTime: "15:00",
        endTime: "16:00",
        lateEntryReason: "left it out",
      }).expect(201);

      // resubmitting sends the old row and the new one together, and starts the review over
      const again = await submit("emp", date).expect(201);
      expect((again.body as { data: { rowCount: number } }).data.rowCount).toBe(
        2,
      );
      const rows = await rowsOf(empId(), date);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row).toMatchObject({
          status: "SUBMITTED",
          firstDecidedBy: null,
          decidedBy: null,
          decisionNote: null,
        });
      }
      expect((await myDay("emp", date)).review.stage).toBe("MANAGER");
    });
  });

  describe("HR alone, and HR overriding", () => {
    it("a day with no reporting manager is decided by HR only: a reporting-line approver cannot see it", async () => {
      const date = "2026-09-14";
      await work(lonelyId(), date);
      await submit("lonely", date).expect(201);

      await approve("manager", lonelyId(), date).expect(404);
      await approve("stranger", lonelyId(), date).expect(404);

      const res = await approve("hr", lonelyId(), date).expect(201);
      expect((res.body as DecisionBody).data).toMatchObject({
        status: "APPROVED",
        stage: 1,
        override: false,
      });
    });

    it("HR may decide a two-level day that has no first approval yet: an override, recorded as such", async () => {
      const date = "2026-09-15";
      await work(empId(), date);
      await submit("emp", date).expect(201);
      const res = await approve("hr", empId(), date, "Manager is away").expect(
        201,
      );
      expect((res.body as DecisionBody).data).toMatchObject({
        status: "APPROVED",
        override: true,
      });
      const [row] = await rowsOf(empId(), date);
      expect(await auditActions(row!.id)).toEqual([
        "submit",
        "override_approve",
      ]);
    });

    it("nobody decides their own day, even with HR rights (403)", async () => {
      const date = "2026-09-16";
      await work(people.hrEmp.employeeId!, date);
      await submit("hrEmp", date).expect(201);
      // a reviewer's list never contains their own days, and deciding is refused
      expect(
        (await awaiting("hrEmp")).some(
          (d) => d.employee.id === people.hrEmp.employeeId,
        ),
      ).toBe(false);
      await approve("hrEmp", people.hrEmp.employeeId!, date).expect(403);
      // another HR approver can decide it
      await approve("hr", people.hrEmp.employeeId!, date).expect(201);
    });
  });

  describe("reading", () => {
    it("the review list shows the days in the caller's reach, filtered by status and employee", async () => {
      const all = (
        await call("get", "hr", "/timesheets/review?limit=100").expect(200)
      ).body as ListBody;
      expect(all.meta.total).toBeGreaterThan(0);
      const approved = (
        (
          await call(
            "get",
            "hr",
            `/timesheets/review?status=APPROVED&employeeId=${empId()}&limit=100`,
          ).expect(200)
        ).body as ListBody
      ).data;
      expect(approved.every((d) => d.status === "APPROVED")).toBe(true);
      expect(approved.every((d) => d.employee.id === empId())).toBe(true);

      // the manager reaches only the person who reports to them
      const mine = (
        (
          await call("get", "manager", "/timesheets/review?limit=100").expect(
            200,
          )
        ).body as ListBody
      ).data;
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((d) => d.employee.id === empId())).toBe(true);
      expect(
        (
          (await call("get", "stranger", "/timesheets/review").expect(200))
            .body as ListBody
        ).data,
      ).toEqual([]);
    });

    it("a reviewer needs a review permission (403); the employee has none", async () => {
      await call("get", "emp", "/timesheets/review").expect(403);
      await call("get", "emp", "/timesheets/review/awaiting").expect(403);
      await approve("emp", empId(), "2026-09-10").expect(403);
    });

    it("if HR changes attendance after submission, the reviewer is told (and the submitted day is untouched)", async () => {
      const date = "2026-09-17";
      await work(empId(), date);
      await prisma.attendanceRecord.create({
        data: {
          organizationId: orgId,
          employeeId: empId(),
          attendanceDate: parseDateOnly(date),
          status: "PRESENT",
        },
      });
      await submit("emp", date).expect(201);
      expect((await rowsOf(empId(), date))[0]?.attendanceStatusAtSubmit).toBe(
        "PRESENT",
      );

      await prisma.attendanceRecord.updateMany({
        where: { employeeId: empId(), attendanceDate: parseDateOnly(date) },
        data: { status: "ABSENT" },
      });
      const detail = (
        (
          await call(
            "get",
            "manager",
            `/timesheets/review/${empId()}/${date}`,
          ).expect(200)
        ).body as DetailBody
      ).data;
      expect(detail.attendanceStatusAtSubmit).toBe("PRESENT");
      expect(detail.flags.map((f) => f.code)).toEqual(
        expect.arrayContaining([
          "ATTENDANCE_CHANGED_AFTER_SUBMIT",
          "WORK_ON_ABSENT_DAY",
        ]),
      );
      expect(detail.status).toBe("SUBMITTED");
      expect(detail.canDecide).toBe(true);
    });

    it("two approvers deciding at the same moment: exactly one decision lands", async () => {
      const date = "2026-09-18";
      await work(lonelyId(), date);
      await submit("lonely", date).expect(201);
      const [a, b] = await Promise.all([
        approve("hr", lonelyId(), date),
        reject("hr", lonelyId(), date, "no"),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 422]);
      const [row] = await rowsOf(lonelyId(), date);
      expect(["APPROVED", "REJECTED"]).toContain(row?.status);
      expect(await auditActions(row!.id)).toHaveLength(2); // submit + one decision
    });
  });

  // ---------------------------------------------------------------------------
  // PR5b: reopen, HR correction of a flagged timer, counts, reports
  // ---------------------------------------------------------------------------

  const reopen = (
    who: keyof typeof people,
    employeeId: number,
    date: string,
    note?: string,
  ) =>
    call(
      "post",
      who,
      `/timesheets/review/${employeeId}/${date}/reopen`,
      note ? { note } : {},
    );

  describe("reopening an approved day", () => {
    it("HR sends an approved day back with a reason; the employee fixes it and resubmits", async () => {
      const date = "2026-10-05";
      await work(empId(), date);
      await submit("emp", date).expect(201);
      await approve("manager", empId(), date).expect(201);
      await approve("hr", empId(), date).expect(201);

      const noReason = await reopen("hr", empId(), date).expect(422);
      expect((noReason.body as { error: string }).error).toBe(
        "TIMESHEET_DECISION_NOTE_REQUIRED",
      );
      // a reviewer who is not HR learns nothing about the day
      await reopen("manager", empId(), date, "not allowed").expect(404);

      const res = await reopen(
        "hr",
        empId(),
        date,
        "Attendance was corrected",
      ).expect(201);
      expect((res.body as { data: { status: string } }).data.status).toBe(
        "REJECTED",
      );
      const rows = await rowsOf(empId(), date);
      for (const row of rows) {
        expect(row).toMatchObject({
          status: "REJECTED",
          decidedBy: people.hr.userId,
          decisionNote: "Attendance was corrected",
          firstDecidedBy: null,
        });
      }
      expect(await auditActions(rows[0]!.id)).toEqual([
        "submit",
        "first_approve",
        "approve",
        "reopen",
      ]);
      expect(
        await noticesTo(people.emp.userId, "timesheet.reopened"),
      ).toHaveLength(1);
      expect((await myDay("emp", date)).review).toMatchObject({
        status: "REJECTED",
        canSubmit: true,
      });

      // it goes through review again from the start
      await submit("emp", date).expect(201);
      expect((await myDay("emp", date)).review.stage).toBe("MANAGER");
      // a day under review is not "approved", so it cannot be reopened
      await reopen("hr", empId(), date, "again").expect(422);
    });

    it("never your own day, and never a day that is not approved", async () => {
      const own = "2026-10-06";
      const hrEmpId = people.hrEmp.employeeId!;
      await work(hrEmpId, own);
      await submit("hrEmp", own).expect(201);
      await approve("hr", hrEmpId, own).expect(201);
      await reopen("hrEmp", hrEmpId, own, "mine").expect(403);

      const draft = "2026-10-07";
      await work(lonelyId(), draft);
      await reopen("hr", lonelyId(), draft, "not approved").expect(422);
    });
  });

  describe("HR confirms the end of a flagged timer", () => {
    /** A forgotten timer, closed by the sweep with no time counted. */
    async function staleSession(employeeId: number, date: string) {
      const row = await work(employeeId, date, 60);
      const session = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: row.id },
      });
      await prisma.projectTimeEntry.update({
        where: { id: session.id },
        data: {
          endedAt: session.startedAt,
          durationMinutes: 0,
          reviewState: "STALE_UNRESOLVED",
          closedReason: "STALE",
        },
      });
      return { taskId: row.taskId!, sessionId: session.id, rowId: row.id };
    }
    const correct = (
      who: keyof typeof people,
      sessionId: number,
      body: object,
    ) => call("post", who, `/timesheets/sessions/${sessionId}/correct`, body);

    it("sets the real end: minutes, the task's hours and the audit trail follow, and the flag clears", async () => {
      const date = "2026-10-08";
      const { taskId, sessionId } = await staleSession(empId(), date);
      expect((await myDay("emp", date)).flags.map((f) => f.code)).toContain(
        "STALE_SESSION",
      );

      const res = await correct("hr", sessionId, {
        endTime: "12:30",
        reason: "Employee confirmed they stopped at 12:30",
      }).expect(201);
      expect((res.body as { data: object }).data).toMatchObject({
        sessionId,
        minutes: 150,
        previousMinutes: 0,
      });

      const fixed = await prisma.projectTimeEntry.findUniqueOrThrow({
        where: { id: sessionId },
      });
      expect(fixed.endedAt?.toISOString()).toBe(
        `${date}T07:00:00.000Z`, // 12:30 IST
      );
      expect(fixed).toMatchObject({
        durationMinutes: 150,
        reviewState: "OK",
        closedReason: "CORRECTED",
      });
      const task = await prisma.projectTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(Number(task.loggedHours)).toBe(2.5);

      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "project_time_entry",
          entityId: BigInt(sessionId),
        },
      });
      expect(audit.map((a) => a.action)).toEqual(["correct"]);
      expect(audit[0]?.reason).toMatch(/12:30/);
      expect(
        await noticesTo(people.emp.userId, "timesheet.corrected"),
      ).not.toHaveLength(0);

      const day = await myDay("emp", date);
      expect(day.flags.map((f) => f.code)).not.toContain("STALE_SESSION");
      // it is counted now
      expect(
        (day as unknown as { totals: { totalMinutes: number } }).totals
          .totalMinutes,
      ).toBe(150);
      // and it is fixed: a second correction is refused (no longer flagged)
      const again = await correct("hr", sessionId, {
        endTime: "13:00",
        reason: "second try",
      }).expect(422);
      expect((again.body as { error: string }).error).toBe(
        "SESSION_NOT_FLAGGED",
      );
    });

    it("works on an approved day too, which stays approved", async () => {
      const date = "2026-10-09";
      const { sessionId } = await staleSession(lonelyId(), date);
      await submit("lonely", date).expect(201);
      await approve("hr", lonelyId(), date).expect(201);

      await correct("hr", sessionId, {
        endTime: "11:00",
        reason: "Confirmed with the employee",
      }).expect(201);
      const [row] = await rowsOf(lonelyId(), date);
      expect(row?.status).toBe("APPROVED");
      expect(
        (
          await prisma.projectTimeEntry.findUniqueOrThrow({
            where: { id: sessionId },
          })
        ).durationMinutes,
      ).toBe(60);
    });

    it("only HR may correct; an approver in the reporting line cannot, nor the employee", async () => {
      const { sessionId } = await staleSession(empId(), "2026-10-12");
      const body = { endTime: "11:00", reason: "Confirmed" };
      await correct("manager", sessionId, body).expect(403);
      await correct("emp", sessionId, body).expect(403);
      await correct("stranger", sessionId, body).expect(403);
      // nothing moved
      expect(
        (
          await prisma.projectTimeEntry.findUniqueOrThrow({
            where: { id: sessionId },
          })
        ).reviewState,
      ).toBe("STALE_UNRESOLVED");
    });

    it("refuses an end that does not make sense", async () => {
      const date = "2026-10-13";
      const { sessionId } = await staleSession(empId(), date); // starts 10:00 IST
      const code = async (body: object) =>
        (
          (await correct("hr", sessionId, body).expect(422)).body as {
            error: string;
          }
        ).error;

      expect(await code({ endTime: "09:00", reason: "before start" })).toBe(
        "SESSION_END_BEFORE_START",
      );
      expect(await code({ endTime: "10:00", reason: "zero length" })).toBe(
        "SESSION_END_BEFORE_START",
      );
      expect(await code({ endTime: "23:00", reason: "thirteen hours" })).toBe(
        "SESSION_TOO_LONG",
      );
      // validation: format and reason are checked before anything is read
      await correct("hr", sessionId, {
        endTime: "25:99",
        reason: "bad time",
      }).expect(400);
      await correct("hr", sessionId, { endTime: "11:00", reason: "x" }).expect(
        400,
      );
      await correct("hr", 987_654_321, {
        endTime: "11:00",
        reason: "no such session",
      }).expect(404);
    });

    it("refuses an end in the future, and one that overlaps the employee's other work", async () => {
      // today: a stale session from 00:10 IST, end "23:59" is later than now
      const today2 = businessToday();
      const row = await work(lonelyId(), today2, 60);
      const session = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: row.id },
      });
      const early = new Date(`${today2}T00:10:00+05:30`);
      await prisma.projectTimeEntry.update({
        where: { id: session.id },
        data: {
          startedAt: early,
          endedAt: early,
          durationMinutes: 0,
          reviewState: "STALE_UNRESOLVED",
          closedReason: "STALE",
        },
      });
      const future = await correct("hr", session.id, {
        endTime: "23:59",
        reason: "in the future",
      }).expect(422);
      expect((future.body as { error: string }).error).toBe(
        "SESSION_END_IN_FUTURE",
      );

      // overlap: another closed session of the same person on the same day
      const date = "2026-10-14";
      const { sessionId } = await staleSession(empId(), date); // 10:00
      await work(empId(), date, 90); // 10:00-11:30 on another task
      const overlap = await correct("hr", sessionId, {
        endTime: "11:00",
        reason: "overlaps",
      }).expect(422);
      expect((overlap.body as { error: string }).error).toBe("SESSION_OVERLAP");
    });

    it("a running timer cannot be corrected, a normal session is not flagged, and nobody corrects their own time", async () => {
      // running
      const date = "2026-10-15";
      const row = await work(lonelyId(), date, 60);
      const session = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: row.id },
      });
      await prisma.projectTimeEntry.update({
        where: { id: session.id },
        data: { endedAt: null, durationMinutes: 0 },
      });
      const running = await correct("hr", session.id, {
        endTime: "11:00",
        reason: "still running",
      }).expect(422);
      expect((running.body as { error: string }).error).toBe(
        "SESSION_STILL_RUNNING",
      );
      await closeOpenSessions(lonelyId());

      // an ordinary closed session
      const ok = await work(empId(), "2026-10-16", 60);
      const normal = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: ok.id },
      });
      const notFlagged = await correct("hr", normal.id, {
        endTime: "11:30",
        reason: "not flagged",
      }).expect(422);
      expect((notFlagged.body as { error: string }).error).toBe(
        "SESSION_NOT_FLAGGED",
      );

      // HR's own time
      const mine = await staleSession(people.hrEmp.employeeId!, "2026-10-19");
      await correct("hrEmp", mine.sessionId, {
        endTime: "11:00",
        reason: "my own",
      }).expect(403);
    });
  });

  describe("counts and reports", () => {
    interface SummaryBody {
      data: {
        month: string;
        awaitingMe: number | null;
        submitted: number;
        needsAttention: number;
        returned: number;
        approvedThisMonth: number;
      };
    }
    interface ReportBody {
      data: {
        lines: {
          employee: { id: number };
          daysRecorded: number;
          totalMinutes: number;
          approvedDays: number;
          submittedDays: number;
          notSubmittedDays: number;
          returnedDays: number;
        }[];
      };
    }
    const range = { from: "2026-07-01", to: "2026-07-07" };
    const q = (extra = "") =>
      `from=${range.from}&to=${range.to}${extra ? `&${extra}` : ""}`;

    it("the summary counts what is in the caller's reach, and only approvers get an 'awaiting me' number", async () => {
      const date = "2026-10-20";
      await work(empId(), date);
      await submit("emp", date).expect(201);

      const hr = (
        (await call("get", "hr", "/timesheets/review/summary").expect(200))
          .body as SummaryBody
      ).data;
      expect(hr.submitted).toBeGreaterThan(0);
      expect(typeof hr.awaitingMe).toBe("number");

      const mgr = (
        (await call("get", "manager", "/timesheets/review/summary").expect(200))
          .body as SummaryBody
      ).data;
      expect(mgr.awaitingMe).toBe((await awaiting("manager")).length);
      expect(mgr.submitted).toBeGreaterThan(0);

      // the stranger reviews nobody
      const none = (
        (
          await call("get", "stranger", "/timesheets/review/summary").expect(
            200,
          )
        ).body as SummaryBody
      ).data;
      expect(none).toMatchObject({ submitted: 0, returned: 0 });

      await call("get", "emp", "/timesheets/review/summary").expect(403);
    });

    it("the employee report adds up hours and days in each review state", async () => {
      // 1 Jul approved (60), 2 Jul submitted (90), 3 Jul draft (30)
      await work(empId(), "2026-07-01", 60);
      await submit("emp", "2026-07-01").expect(201);
      await approve("manager", empId(), "2026-07-01").expect(201);
      await approve("hr", empId(), "2026-07-01").expect(201);
      await work(empId(), "2026-07-02", 90);
      await submit("emp", "2026-07-02").expect(201);
      await work(empId(), "2026-07-03", 30);

      const res = await call(
        "get",
        "hr",
        `/timesheets/reports/employees?${q(`employeeId=${empId()}`)}`,
      ).expect(200);
      const [line] = (res.body as ReportBody).data.lines;
      expect(line).toMatchObject({
        daysRecorded: 3,
        totalMinutes: 180,
        approvedDays: 1,
        submittedDays: 1,
        notSubmittedDays: 1,
        returnedDays: 0,
      });

      // the reporting manager sees the same person; a stranger sees no one
      const mgr = (
        (
          await call(
            "get",
            "manager",
            `/timesheets/reports/employees?${q()}`,
          ).expect(200)
        ).body as ReportBody
      ).data.lines;
      expect(mgr.map((l) => l.employee.id)).toEqual([empId()]);
      expect(
        (
          (
            await call(
              "get",
              "stranger",
              `/timesheets/reports/employees?${q()}`,
            ).expect(200)
          ).body as ReportBody
        ).data.lines,
      ).toEqual([]);
    });

    it("the day report gives one line per employee per day, drafts included, in the caller's reach", async () => {
      interface DaysBody {
        data: {
          from: string;
          to: string;
          days: {
            employee: { id: number; code: string; name: string };
            date: string;
            status: string;
            stage: string | null;
            totalMinutes: number;
            taskMinutes: number;
            customMinutes: number;
            needsAttention: boolean;
          }[];
        };
      }
      // the three days created by the report test above: approved, submitted, draft
      const res = await call(
        "get",
        "hr",
        `/timesheets/reports/days?${q(`employeeId=${empId()}`)}`,
      ).expect(200);
      const body = (res.body as DaysBody).data;
      expect(body).toMatchObject({ from: range.from, to: range.to });
      const byDate = new Map(body.days.map((d) => [d.date, d]));
      expect([...byDate.keys()].sort()).toEqual([
        "2026-07-01",
        "2026-07-02",
        "2026-07-03",
      ]);
      expect(byDate.get("2026-07-01")).toMatchObject({
        status: "APPROVED",
        totalMinutes: 60,
      });
      expect(byDate.get("2026-07-02")).toMatchObject({
        status: "SUBMITTED",
        stage: "MANAGER",
        totalMinutes: 90,
      });
      // the draft is here too: the grid shows work that is not submitted yet
      expect(byDate.get("2026-07-03")).toMatchObject({
        status: "DRAFT",
        totalMinutes: 30,
        taskMinutes: 30,
        customMinutes: 0,
      });

      // the reporting manager reaches only their own report; a stranger nobody
      const mgr = (
        (
          await call(
            "get",
            "manager",
            `/timesheets/reports/days?${q()}`,
          ).expect(200)
        ).body as DaysBody
      ).data.days;
      expect(mgr.every((d) => d.employee.id === empId())).toBe(true);
      expect(mgr.length).toBeGreaterThanOrEqual(3);
      expect(
        (
          (
            await call(
              "get",
              "stranger",
              `/timesheets/reports/days?${q()}`,
            ).expect(200)
          ).body as DaysBody
        ).data.days,
      ).toEqual([]);

      // the same range and permission rules as the other reports
      await call(
        "get",
        "hr",
        "/timesheets/reports/days?from=2026-07-10&to=2026-07-01",
      ).expect(422);
      await call(
        "get",
        "hr",
        "/timesheets/reports/days?from=2026-01-01&to=2026-12-31",
      ).expect(422);
      await call("get", "emp", `/timesheets/reports/days?${q()}`).expect(403);
    });

    it("a report needs a sensible range and the read permission", async () => {
      await call(
        "get",
        "hr",
        "/timesheets/reports/employees?from=2026-07-10&to=2026-07-01",
      ).expect(422);
      await call(
        "get",
        "hr",
        "/timesheets/reports/employees?from=2026-01-01&to=2026-12-31",
      ).expect(422);
      await call("get", "hr", "/timesheets/reports/employees?from=nope").expect(
        400,
      );
      await call("get", "emp", `/timesheets/reports/employees?${q()}`).expect(
        403,
      );
    });

    it("the CSV needs the export permission and carries the same numbers", async () => {
      // the reporting manager can read the report but not download it
      await call(
        "get",
        "manager",
        `/timesheets/reports/employees.csv?${q()}`,
      ).expect(403);

      const res = await call(
        "get",
        "hr",
        `/timesheets/reports/employees.csv?${q(`employeeId=${empId()}`)}`,
      ).expect(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(/attachment/);
      const text = (res.text ?? "").replace(BOM_RE, "");
      const lines = text.trim().split("\r\n");
      expect(lines[0]).toBe(
        "Employee Code,Employee,Team,Days Recorded,Task Hours,Other Activity Hours,Total Hours,Not Submitted,Submitted,Approved,Returned,Needs Attention",
      );
      // 3 days recorded, 3.0 hours, 1 not submitted, 1 submitted, 1 approved
      expect(lines[1]).toMatch(/,Emp,.*,3,3,0,3,1,1,1,0,0$/);

      const days = await call(
        "get",
        "hr",
        `/timesheets/reports/days.csv?${q(`employeeId=${empId()}`)}`,
      ).expect(200);
      const dayLines = (days.text ?? "")
        .replace(BOM_RE, "")
        .trim()
        .split("\r\n");
      expect(dayLines).toHaveLength(4); // header + 3 days
      expect(dayLines.slice(1).map((l) => l.split(",")[3])).toEqual([
        "2026-07-03",
        "2026-07-02",
        "2026-07-01",
      ]);
      expect(dayLines.join("\n")).toMatch(/Approved/);
      expect(dayLines.join("\n")).toMatch(/Draft/);
    });
  });

  // ---------------------------------------------------------------------------
  // PR6: isolation between organizations, and refusing what the client must not send
  // ---------------------------------------------------------------------------

  describe("another organization", () => {
    let otherToken: string;
    let otherEmployeeId: number;
    let otherSessionId: number;
    const date = "2026-06-10";

    beforeAll(async () => {
      const suffix2 = randomUUID().slice(0, 8);
      const org2 = await prisma.organization.create({
        data: { name: `Org TSR2 ${suffix2}`, slug: `ts-rev2-${suffix2}` },
      });
      const role = await prisma.role.create({
        data: { organizationId: org2.id, name: `hr2-${suffix2}` },
      });
      for (const code of [
        "hr.timesheet.read.all",
        "hr.timesheet.approve.all",
        "hr.timesheet.export.all",
      ]) {
        const p = await prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        });
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
      }
      const email = `hr2@tsr-${suffix2}.test`;
      const user = await prisma.user.create({
        data: {
          organizationId: org2.id,
          email,
          passwordHash: await bcrypt.hash("Password123!", 10),
          fullName: "HR Two",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      const designation = await prisma.designation.create({
        data: { organizationId: org2.id, code: "ENG", name: "Engineer" },
      });
      const empType = await prisma.employmentType.create({
        data: { organizationId: org2.id, code: "PERM", name: "Permanent" },
      });
      const team = await prisma.team.create({
        data: {
          organizationId: org2.id,
          code: `T2-${suffix2}`,
          name: `Team2 ${suffix2}`,
        },
      });
      const euser = await prisma.user.create({
        data: {
          organizationId: org2.id,
          email: `e2@tsr-${suffix2}.test`,
          passwordHash: "x",
          fullName: "Other Org Employee",
        },
      });
      const employee = await prisma.employee.create({
        data: {
          organization: { connect: { id: org2.id } },
          user: { connect: { id: euser.id } },
          team: { connect: { id: team.id } },
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: "Other Org Employee",
          workEmail: euser.email,
          designation: { connect: { id: designation.id } },
          employmentType: { connect: { id: empType.id } },
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
      otherEmployeeId = employee.id;
      const project = await prisma.project.create({
        data: {
          organizationId: org2.id,
          projectCode: `TSR2/${suffix2}/1`,
          name: "Other project",
          startDate: new Date("2026-12-01"),
        },
      });
      const task = await prisma.projectTask.create({
        data: {
          organizationId: org2.id,
          projectId: project.id,
          taskCode: `TSR2/${suffix2}/T1`,
          title: "Other task",
          assignedToId: employee.id,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const row = await prisma.timesheet.create({
        data: {
          organizationId: org2.id,
          employeeId: employee.id,
          workDate: parseDateOnly(date),
          category: "TASK",
          taskId: task.id,
          projectId: project.id,
          title: task.title,
        },
      });
      const startedAt = new Date(`${date}T04:30:00.000Z`);
      const session = await prisma.projectTimeEntry.create({
        data: {
          organizationId: org2.id,
          taskId: task.id,
          employeeId: employee.id,
          startedAt,
          endedAt: startedAt,
          durationMinutes: 0,
          entryDate: parseDateOnly(date),
          timesheetId: row.id,
          reviewState: "STALE_UNRESOLVED",
          closedReason: "STALE",
        },
      });
      otherSessionId = session.id;
      // submitted last: a submitted row takes no new session (that is the point)
      await prisma.timesheet.update({
        where: { id: row.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          submittedBy: euser.id,
          approvalLevels: 1,
          approverBasis: "HR",
        },
      });
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: org2.slug, email, password: "Password123!" })
        .expect(201);
      otherToken = (res.body as { data: { accessToken: string } }).data
        .accessToken;
    });

    const asOther = (method: "get" | "post", url: string, body?: object) => {
      const req = request(app.getHttpServer())
        [method](url)
        .set("Authorization", `Bearer ${otherToken}`);
      return body ? req.send(body) : req;
    };

    it("HR of the first organization cannot see, decide, reopen or correct the other organization's day", async () => {
      const key = `${otherEmployeeId}/${date}`;
      await call("get", "hr", `/timesheets/review/${key}`).expect(404);
      await approve("hr", otherEmployeeId, date).expect(404);
      await reject("hr", otherEmployeeId, date, "no").expect(404);
      await reopen("hr", otherEmployeeId, date, "no").expect(404);
      await call(
        "post",
        "hr",
        `/timesheets/sessions/${otherSessionId}/correct`,
        {
          endTime: "11:00",
          reason: "cross-organization attempt",
        },
      ).expect(404);
      // and nothing moved
      const row = await prisma.timesheet.findFirstOrThrow({
        where: { employeeId: otherEmployeeId, workDate: parseDateOnly(date) },
      });
      expect(row.status).toBe("SUBMITTED");
      expect(
        (
          await prisma.projectTimeEntry.findUniqueOrThrow({
            where: { id: otherSessionId },
          })
        ).reviewState,
      ).toBe("STALE_UNRESOLVED");
    });

    it("lists, summaries and reports never mix organizations", async () => {
      const mine = (
        (await call("get", "hr", "/timesheets/review?limit=100").expect(200))
          .body as ListBody
      ).data;
      expect(mine.some((d) => d.employee.id === otherEmployeeId)).toBe(false);
      expect(
        (await awaiting("hr")).some((d) => d.employee.id === otherEmployeeId),
      ).toBe(false);

      // asking for the other organization's employee in a report gives nothing
      const report = (
        (
          await call(
            "get",
            "hr",
            `/timesheets/reports/employees?from=2026-06-01&to=2026-06-30&employeeId=${otherEmployeeId}`,
          ).expect(200)
        ).body as { data: { lines: unknown[] } }
      ).data.lines;
      expect(report).toEqual([]);
      const csv = await call(
        "get",
        "hr",
        `/timesheets/reports/days.csv?from=2026-06-01&to=2026-06-30&employeeId=${otherEmployeeId}`,
      ).expect(200);
      expect(csv.text.trim().split("\r\n")).toHaveLength(1); // header only

      // and the other organization's HR sees only its own person
      const theirs = (
        (await asOther("get", "/timesheets/review/awaiting").expect(200))
          .body as ListBody
      ).data;
      expect(theirs.map((d) => d.employee.id)).toEqual([otherEmployeeId]);
      await asOther("get", `/timesheets/review/${empId()}/2026-09-03`).expect(
        404,
      );
    });
  });

  // Found by the independent review of this module.
  describe("regressions from the independent review", () => {
    const manualEntry = (
      who: keyof typeof people,
      taskId: number,
      body: object,
    ) => call("post", who, `/projects/tasks/${taskId}/time-entries`, body);

    it("a day under review takes no work through ANY task (no mixed-status day)", async () => {
      const date = "2026-10-22";
      await work(empId(), date); // task A, submitted
      await submit("emp", date).expect(201);
      const before = await rowsOf(empId(), date);

      // a different task, same day
      const other = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId,
          taskCode: `TSR/${suffix}/LATE`,
          title: "Another task",
          assignedToId: empId(),
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const res = await manualEntry("emp", other.id, {
        entryDate: date,
        durationMinutes: 30,
      }).expect(422);
      expect((res.body as { error: string }).error).toBe("TIMESHEET_LOCKED");
      // no draft row slipped into the submitted day
      const after = await rowsOf(empId(), date);
      expect(after).toHaveLength(before.length);
      expect(after.every((r) => r.status === "SUBMITTED")).toBe(true);

      // and the day still goes through review as one unit
      await approve("manager", empId(), date).expect(201);
      await approve("hr", empId(), date).expect(201);
      expect(
        (await rowsOf(empId(), date)).every((r) => r.status === "APPROVED"),
      ).toBe(true);
    });

    it("a manual entry is a day's work: more than 16 hours is refused (400, not a crash)", async () => {
      const task = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId,
          taskCode: `TSR/${suffix}/BIG`,
          title: "Big entry",
          assignedToId: empId(),
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      await manualEntry("emp", task.id, {
        entryDate: "2026-10-23",
        durationMinutes: 961,
      }).expect(400);
      await manualEntry("emp", task.id, {
        entryDate: "2026-10-23",
        durationMinutes: 99_999_999_999,
      }).expect(400);
      await manualEntry("emp", task.id, {
        entryDate: "2026-10-23",
        durationMinutes: 960,
      }).expect(201);
    });

    it("a logged duration is not a clock interval: it cannot block HR confirming a timer's end", async () => {
      const date = "2026-10-26";
      const stale = await work(empId(), date, 60);
      const staleSession = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: stale.id },
      });
      await prisma.projectTimeEntry.update({
        where: { id: staleSession.id },
        data: {
          endedAt: staleSession.startedAt,
          durationMinutes: 0,
          reviewState: "STALE_UNRESOLVED",
          closedReason: "STALE",
        },
      });
      // a 10-hour logged duration whose placeholder instants (05:30 IST + 10 h)
      // cover the stale timer's 10:00 start
      const manual = await work(empId(), date, 1);
      const manualSession = await prisma.projectTimeEntry.findFirstOrThrow({
        where: { timesheetId: manual.id },
      });
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      await prisma.projectTimeEntry.update({
        where: { id: manualSession.id },
        data: {
          startedAt: dayStart,
          endedAt: new Date(dayStart.getTime() + 600 * 60_000),
          durationMinutes: 600,
          timePrecision: "DURATION_ONLY",
          source: "MANUAL",
        },
      });
      await call(
        "post",
        "hr",
        `/timesheets/sessions/${staleSession.id}/correct`,
        {
          endTime: "11:00",
          reason: "Confirmed with the employee",
        },
      ).expect(201);
    });

    it("the all-submitted list shows recent days by default; older ones need a date range", async () => {
      const old = "2025-01-06";
      const task = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId,
          taskCode: `TSR/${suffix}/OLD`,
          title: "Old task",
          assignedToId: empId(),
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: empId(),
          workDate: parseDateOnly(old),
          category: "TASK",
          taskId: task.id,
          projectId,
          title: task.title,
          status: "APPROVED",
          submittedAt: new Date(),
          submittedBy: people.emp.userId,
          decidedAt: new Date(),
          decidedBy: people.hr.userId,
          approvalLevels: 1,
        },
      });
      const defaults = (
        (
          await call(
            "get",
            "hr",
            `/timesheets/review?employeeId=${empId()}&limit=100`,
          ).expect(200)
        ).body as ListBody
      ).data;
      expect(defaults.some((d) => d.date === old)).toBe(false);

      const ranged = (
        (
          await call(
            "get",
            "hr",
            `/timesheets/review?employeeId=${empId()}&from=2025-01-01&to=2025-01-31`,
          ).expect(200)
        ).body as ListBody
      ).data;
      expect(ranged.map((d) => d.date)).toEqual([old]);
    });
  });

  describe("input the client must not control", () => {
    it("unknown fields are refused (400), so nothing can be mass-assigned", async () => {
      await call(
        "post",
        "hr",
        `/timesheets/review/${lonelyId()}/2026-09-04/approve`,
        { note: "ok", status: "APPROVED", decidedBy: 1 },
      ).expect(400);
      await call("post", "emp", "/timesheets/my/submit-week", {
        weekStart: "2026-08-03",
        employeeId: lonelyId(),
      }).expect(400);
      await call("post", "hr", "/timesheets/sessions/1/correct", {
        endTime: "11:00",
        reason: "extra field",
        durationMinutes: 9999,
      }).expect(400);
    });

    it("the employee always comes from the login: a body naming someone else changes nothing", async () => {
      const date = "2026-10-21";
      await work(lonelyId(), date); // someone else's draft day
      await call("post", "emp", `/timesheets/my/${date}/submit`, {
        employeeId: lonelyId(),
      }).expect(422); // emp has no work that day
      const [row] = await rowsOf(lonelyId(), date);
      expect(row?.status).toBe("DRAFT");
    });

    it("paging and range limits are enforced", async () => {
      await call("get", "hr", "/timesheets/review?limit=1000").expect(400);
      await call("get", "hr", "/timesheets/review?page=0").expect(400);
      await call("get", "hr", "/timesheets/review?status=DRAFT").expect(400);
      await call("get", "hr", "/timesheets/review/abc/2026-09-03").expect(400);
      await call("get", "hr", "/timesheets/review/1/2026-02-30").expect(400);
    });

    it("a name that looks like a spreadsheet formula is exported as text", async () => {
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email: `formula@tsr-${suffix}.test`,
          passwordHash: "x",
          fullName: "Formula",
        },
      });
      const base = await prisma.employee.findUniqueOrThrow({
        where: { id: empId() },
      });
      const evil = await prisma.employee.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          teamId: base.teamId,
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: '=HYPERLINK("http://example.test","click")',
          workEmail: user.email,
          designationId: base.designationId,
          employmentTypeId: base.employmentTypeId,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await work(evil.id, "2026-05-04");
      const csv = await call(
        "get",
        "hr",
        `/timesheets/reports/days.csv?from=2026-05-01&to=2026-05-31&employeeId=${evil.id}`,
      ).expect(200);
      const lines = csv.text.replace(BOM_RE, "").trim().split("\r\n");
      expect(lines).toHaveLength(2);
      // the cell is text, never a live formula
      expect(lines[1]).toContain(
        `"'=HYPERLINK(""http://example.test"",""click"")"`,
      );
    });
  });
});
