import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import {
  addDays,
  businessInstant,
  businessToday,
} from "../src/common/dates/business-date.js";
import { parseDateOnly } from "../src/common/dates/date-only.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface ActivityBody {
  data: {
    id: number;
    category: string;
    title: string;
    projectId: number | null;
    workDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isBackdated: boolean;
    lateEntryReason: string | null;
    submissionStatus: string;
  };
}

interface DayBody {
  data: {
    totals: {
      customMinutes: number;
      taskMinutes: number;
      totalMinutes: number;
    };
    rows: {
      id: number;
      category: string;
      title: string;
      durationMinutes: number;
    }[];
  };
}

// Custom activities: meetings, discussions, research... — timesheet rows that
// are NOT project tasks. Times are typed as IST HH:mm on a work date; the
// server builds the instants and the duration.
describe("Timesheet custom activities (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgId: number;
  let suffix: string;
  let tokenA: string;
  let tokenB: string;
  let tokenReadOnly: string;
  let employeeA: { id: number };
  let projectA: { id: number }; // A is a member
  let projectOther: { id: number }; // A has no link to it

  const today = businessToday();
  // distinct dates per scenario so intervals never collide between tests
  const day = (back: number) => addDays(today, -back);

  const req = (
    method: "get" | "post" | "patch" | "delete",
    token: string,
    url: string,
    body?: object,
  ) => {
    const r = request(app.getHttpServer())
      [method](url)
      .set("Authorization", `Bearer ${token}`);
    return body ? r.send(body) : r;
  };

  const create = (token: string, body: Record<string, unknown>) =>
    req("post", token, "/timesheets/custom-activities", {
      category: "INTERNAL_MEETING",
      title: "Internal team discussion",
      startTime: "14:00",
      endTime: "15:00",
      lateEntryReason: "Forgot to log it on the day",
      ...body,
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
      data: { name: `Org Act ${suffix}`, slug: `ts-act-${suffix}` },
    });
    orgId = org.id;

    const perm = (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const [pRead, pWrite] = await Promise.all([
      perm("employee_self_service.timesheet.read"),
      perm("employee_self_service.timesheet.write"),
    ]);

    async function makeUser(email: string, perms: { id: number }[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      if (perms.length > 0) {
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

    const emailA = `a@act-${suffix}.test`;
    const emailB = `b@act-${suffix}.test`;
    const emailRo = `ro@act-${suffix}.test`;
    const userA = await makeUser(emailA, [pRead, pWrite]);
    const userB = await makeUser(emailB, [pRead, pWrite]);
    const userRo = await makeUser(emailRo, [pRead]); // read only: no write
    employeeA = await makeEmployee(userA.id, emailA, "Employee A");
    const employeeB = await makeEmployee(userB.id, emailB, "Employee B");
    await makeEmployee(userRo.id, emailRo, "Employee RO");

    projectA = await prisma.project.create({
      data: {
        organizationId: org.id,
        projectCode: `ACT/${suffix}/A`,
        name: "FAS ERP",
        startDate: new Date("2026-01-01"),
      },
    });
    projectOther = await prisma.project.create({
      data: {
        organizationId: org.id,
        projectCode: `ACT/${suffix}/B`,
        name: "Someone else's project",
        startDate: new Date("2026-01-01"),
      },
    });
    await prisma.projectMember.create({
      data: {
        organizationId: org.id,
        projectId: projectA.id,
        employeeId: employeeA.id,
      },
    });
    await prisma.projectMember.create({
      data: {
        organizationId: org.id,
        projectId: projectOther.id,
        employeeId: employeeB.id,
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: org.slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };
    tokenA = await login(emailA);
    tokenB = await login(emailB);
    tokenReadOnly = await login(emailRo);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("recording an activity", () => {
    it("14:00-15:00 IST is exactly one hour, calculated by the server, and shows on that day", async () => {
      const date = day(3);
      const res = await create(tokenA, { workDate: date }).expect(201);
      const a = (res.body as ActivityBody).data;
      expect(a).toMatchObject({
        category: "INTERNAL_MEETING",
        workDate: date,
        startTime: "14:00",
        endTime: "15:00",
        durationMinutes: 60,
        submissionStatus: "DRAFT",
      });

      const view = await req("get", tokenA, `/timesheets/my/${date}`).expect(
        200,
      );
      const dayView = (view.body as DayBody).data;
      expect(
        dayView.rows.some((r) => r.id === a.id && r.durationMinutes === 60),
      ).toBe(true);
      expect(dayView.totals.customMinutes).toBe(60);
      expect(dayView.totals.totalMinutes).toBe(60);
    });

    it("stores real instants built from the IST times (14:00 IST = 08:30 UTC)", async () => {
      const date = day(4);
      const a = (
        (await create(tokenA, { workDate: date }).expect(201))
          .body as ActivityBody
      ).data;
      const row = await prisma.timesheet.findUniqueOrThrow({
        where: { id: a.id },
      });
      expect(row.startedAt?.toISOString()).toBe(`${date}T08:30:00.000Z`);
      expect(row.endedAt?.toISOString()).toBe(`${date}T09:30:00.000Z`);
      expect(row.category).toBe("INTERNAL_MEETING");
      expect(row.taskId).toBeNull();
      expect(row.createdBy).not.toBeNull();
    });

    it("a late entry (work date before today) needs a reason, and is flagged", async () => {
      const date = day(5);
      const noReason = await create(tokenA, {
        workDate: date,
        lateEntryReason: undefined,
      }).expect(422);
      expect(JSON.stringify(noReason.body)).toContain("reason is required");

      const ok = await create(tokenA, { workDate: date }).expect(201);
      expect((ok.body as ActivityBody).data).toMatchObject({
        isBackdated: true,
        lateEntryReason: "Forgot to log it on the day",
      });
    });

    it("an activity for today needs no reason and is not flagged", async () => {
      const res = await create(tokenA, {
        workDate: today,
        startTime: "00:00",
        endTime: "00:01",
        lateEntryReason: undefined,
        title: "Quick sync",
      }).expect(201);
      expect((res.body as ActivityBody).data).toMatchObject({
        isBackdated: false,
        lateEntryReason: null,
        durationMinutes: 1,
      });
    });

    it("refuses an end before the start, a zero length and a time in the future (422)", async () => {
      await create(tokenA, {
        workDate: day(6),
        startTime: "15:00",
        endTime: "14:00",
      }).expect(422);
      await create(tokenA, {
        workDate: day(6),
        startTime: "14:00",
        endTime: "14:00",
      }).expect(422);
      const tomorrow = addDays(today, 1);
      const future = await create(tokenA, {
        workDate: tomorrow,
        lateEntryReason: undefined,
      }).expect(422);
      expect(JSON.stringify(future.body)).toContain("future");
    });

    it("validates the request shape: unknown category, bad time, unknown field, missing title (400)", async () => {
      await create(tokenA, { workDate: day(6), category: "TASK" }).expect(400);
      await create(tokenA, {
        workDate: day(6),
        category: "NOT_A_CATEGORY",
      }).expect(400);
      await create(tokenA, { workDate: day(6), startTime: "9:5" }).expect(400);
      await create(tokenA, { workDate: day(6), endTime: "24:00" }).expect(400);
      await create(tokenA, { workDate: "16-11-2026" }).expect(400);
      await create(tokenA, { workDate: day(6), title: "" }).expect(400);
      // the employee is never taken from the body
      await create(tokenA, { workDate: day(6), employeeId: 1 }).expect(400);
    });

    it("never creates a project task", async () => {
      const before = await prisma.projectTask.count({
        where: { organizationId: orgId },
      });
      await create(tokenA, { workDate: day(7) }).expect(201);
      expect(
        await prisma.projectTask.count({ where: { organizationId: orgId } }),
      ).toBe(before);
    });
  });

  describe("overlap", () => {
    it("an activity may not overlap another activity; touching ends are fine", async () => {
      const date = day(8);
      await create(tokenA, {
        workDate: date,
        startTime: "10:00",
        endTime: "11:00",
      }).expect(201);

      const overlap = await create(tokenA, {
        workDate: date,
        title: "Overlaps",
        startTime: "10:30",
        endTime: "11:30",
      }).expect(422);
      expect(JSON.stringify(overlap.body)).toContain("overlaps");

      // starts exactly when the first ends: allowed
      await create(tokenA, {
        workDate: date,
        title: "Right after",
        startTime: "11:00",
        endTime: "12:00",
      }).expect(201);
    });

    it("an activity may not overlap a work session on a task", async () => {
      const date = day(9);
      const task = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId: projectA.id,
          taskCode: `ACT/${suffix}/T1`,
          title: "A task",
          assignedToId: employeeA.id,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const sheet = await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: employeeA.id,
          workDate: parseDateOnly(date),
          category: "TASK",
          taskId: task.id,
          projectId: projectA.id,
          title: task.title,
        },
      });
      await prisma.projectTimeEntry.create({
        data: {
          organizationId: orgId,
          taskId: task.id,
          employeeId: employeeA.id,
          startedAt: businessInstant(date, "10:00") as Date,
          endedAt: businessInstant(date, "12:00") as Date,
          durationMinutes: 120,
          entryDate: parseDateOnly(date),
          timesheetId: sheet.id,
        },
      });

      const res = await create(tokenA, {
        workDate: date,
        startTime: "11:00",
        endTime: "13:00",
      }).expect(422);
      expect(JSON.stringify(res.body)).toContain(task.taskCode);
      // before and after the session is fine
      await create(tokenA, {
        workDate: date,
        startTime: "09:00",
        endTime: "10:00",
      }).expect(201);
      await create(tokenA, {
        workDate: date,
        title: "After",
        startTime: "12:00",
        endTime: "13:00",
      }).expect(201);
    });

    it("two simultaneous overlapping requests: exactly one is recorded", async () => {
      const date = day(10);
      const results = await Promise.all(
        [1, 2, 3].map((n) =>
          create(tokenA, {
            workDate: date,
            title: `Race ${n}`,
            startTime: "10:00",
            endTime: "11:00",
          }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 422)).toHaveLength(2);
      expect(
        await prisma.timesheet.count({
          where: {
            employeeId: employeeA.id,
            workDate: parseDateOnly(date),
            category: { not: "TASK" },
            deletedAt: null,
          },
        }),
      ).toBe(1);
    });

    it("another employee's activity at the same time is not an overlap", async () => {
      const date = day(11);
      await create(tokenA, { workDate: date }).expect(201);
      await create(tokenB, { workDate: date }).expect(201);
    });
  });

  describe("project link", () => {
    it("links a project the employee belongs to", async () => {
      const res = await create(tokenA, {
        workDate: day(12),
        projectId: projectA.id,
      }).expect(201);
      expect((res.body as ActivityBody).data.projectId).toBe(projectA.id);
    });

    it("refuses a project the employee has no link to (422)", async () => {
      const res = await create(tokenA, {
        workDate: day(13),
        projectId: projectOther.id,
      }).expect(422);
      expect(JSON.stringify(res.body)).toContain("member of or hold a task in");
    });

    it("lists only the projects the employee may link", async () => {
      const res = await req(
        "get",
        tokenA,
        "/timesheets/linkable-projects",
      ).expect(200);
      const ids = (res.body as { data: { id: number }[] }).data.map(
        (p) => p.id,
      );
      expect(ids).toContain(projectA.id);
      expect(ids).not.toContain(projectOther.id);
    });

    it("a project with only an assigned task also counts", async () => {
      await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId: projectOther.id,
          taskCode: `ACT/${suffix}/T2`,
          title: "Task in the other project",
          assignedToId: employeeA.id,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      await create(tokenA, {
        workDate: day(13),
        projectId: projectOther.id,
      }).expect(201);
    });
  });

  describe("categories", () => {
    it("serves the category list from one source, never TASK", async () => {
      const res = await req(
        "get",
        tokenA,
        "/timesheets/activity-categories",
      ).expect(200);
      const list = (res.body as { data: { code: string; label: string }[] })
        .data;
      expect(list.length).toBeGreaterThanOrEqual(11);
      expect(list.find((c) => c.code === "INTERNAL_MEETING")?.label).toBe(
        "Internal meeting",
      );
      expect(list.find((c) => c.code === "TECHNICAL_DISCUSSION")).toBeDefined();
      expect(list.some((c) => c.code === "TASK")).toBe(false);
    });
  });

  describe("editing and deleting", () => {
    it("the owner edits an activity; the duration is recalculated; history is audited", async () => {
      const date = day(14);
      const a = (
        (await create(tokenA, { workDate: date }).expect(201))
          .body as ActivityBody
      ).data;

      const res = await req(
        "patch",
        tokenA,
        `/timesheets/custom-activities/${a.id}`,
        {
          title: "Longer discussion",
          endTime: "16:30",
        },
      ).expect(200);
      expect((res.body as ActivityBody).data).toMatchObject({
        title: "Longer discussion",
        startTime: "14:00",
        endTime: "16:30",
        durationMinutes: 150,
      });

      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "timesheet_activity",
          entityId: BigInt(a.id),
        },
        orderBy: { id: "asc" },
      });
      expect(audit.map((x) => x.action)).toEqual(["create", "update"]);
    });

    it("an edit may stay inside its own interval but may not run into another activity", async () => {
      const date = day(15);
      const first = (
        (
          await create(tokenA, {
            workDate: date,
            startTime: "09:00",
            endTime: "10:00",
          }).expect(201)
        ).body as ActivityBody
      ).data;
      await create(tokenA, {
        workDate: date,
        title: "Second",
        startTime: "11:00",
        endTime: "12:00",
      }).expect(201);

      // extend the first within free time: fine (overlap check excludes itself)
      await req("patch", tokenA, `/timesheets/custom-activities/${first.id}`, {
        endTime: "10:30",
      }).expect(200);
      // extend it into the second: refused
      await req("patch", tokenA, `/timesheets/custom-activities/${first.id}`, {
        endTime: "11:30",
      }).expect(422);
    });

    it("an edit is validated like a create (end before start)", async () => {
      const a = (
        (await create(tokenA, { workDate: day(16) }).expect(201))
          .body as ActivityBody
      ).data;
      await req("patch", tokenA, `/timesheets/custom-activities/${a.id}`, {
        endTime: "13:00",
      }).expect(422);
    });

    it("removes the project link with null", async () => {
      const a = (
        (
          await create(tokenA, {
            workDate: day(17),
            projectId: projectA.id,
          }).expect(201)
        ).body as ActivityBody
      ).data;
      const res = await req(
        "patch",
        tokenA,
        `/timesheets/custom-activities/${a.id}`,
        { projectId: null },
      ).expect(200);
      expect((res.body as ActivityBody).data.projectId).toBeNull();
    });

    it("another employee cannot edit or delete it (404, existence not confirmed)", async () => {
      const a = (
        (await create(tokenA, { workDate: day(18) }).expect(201))
          .body as ActivityBody
      ).data;
      await req("patch", tokenB, `/timesheets/custom-activities/${a.id}`, {
        title: "Hijack",
      }).expect(404);
      await req(
        "delete",
        tokenB,
        `/timesheets/custom-activities/${a.id}`,
      ).expect(404);
    });

    it("deleting removes it from the day, keeps the row (soft delete) and audits it", async () => {
      const date = day(19);
      const a = (
        (await create(tokenA, { workDate: date }).expect(201))
          .body as ActivityBody
      ).data;
      await req(
        "delete",
        tokenA,
        `/timesheets/custom-activities/${a.id}`,
      ).expect(200);

      const view = await req("get", tokenA, `/timesheets/my/${date}`).expect(
        200,
      );
      expect((view.body as DayBody).data.rows.some((r) => r.id === a.id)).toBe(
        false,
      );
      const row = await prisma.timesheet.findUniqueOrThrow({
        where: { id: a.id },
      });
      expect(row.deletedAt).not.toBeNull();
      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "timesheet_activity",
          entityId: BigInt(a.id),
        },
        orderBy: { id: "asc" },
      });
      expect(audit.map((x) => x.action)).toEqual(["create", "delete"]);
      // and the slot is free again
      await create(tokenA, { workDate: date }).expect(201);
    });

    it("a task row cannot be edited or deleted through the activity endpoints (404)", async () => {
      const date = day(20);
      const task = await prisma.projectTask.create({
        data: {
          organizationId: orgId,
          projectId: projectA.id,
          taskCode: `ACT/${suffix}/T3`,
          title: "Task row",
          assignedToId: employeeA.id,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const sheet = await prisma.timesheet.create({
        data: {
          organizationId: orgId,
          employeeId: employeeA.id,
          workDate: parseDateOnly(date),
          category: "TASK",
          taskId: task.id,
          projectId: projectA.id,
          title: task.title,
        },
      });
      await req("patch", tokenA, `/timesheets/custom-activities/${sheet.id}`, {
        title: "x",
      }).expect(404);
      await req(
        "delete",
        tokenA,
        `/timesheets/custom-activities/${sheet.id}`,
      ).expect(404);
    });
  });

  describe("submitted and approved days are protected", () => {
    it("no new activity lands on a day that is submitted; the submitted one cannot change", async () => {
      const date = day(21);
      const a = (
        (await create(tokenA, { workDate: date }).expect(201))
          .body as ActivityBody
      ).data;
      await prisma.timesheet.update({
        where: { id: a.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), submittedBy: 1 },
      });

      const add = await create(tokenA, {
        workDate: date,
        title: "Late add",
        startTime: "17:00",
        endTime: "18:00",
      }).expect(422);
      expect(JSON.stringify(add.body)).toContain("submitted or approved");
      await req("patch", tokenA, `/timesheets/custom-activities/${a.id}`, {
        title: "Tamper",
      }).expect(422);
      await req(
        "delete",
        tokenA,
        `/timesheets/custom-activities/${a.id}`,
      ).expect(422);
    });

    it("a returned (rejected) activity can be corrected again", async () => {
      const a = (
        (await create(tokenA, { workDate: day(22) }).expect(201))
          .body as ActivityBody
      ).data;
      await prisma.timesheet.update({
        where: { id: a.id },
        data: {
          status: "REJECTED",
          submittedAt: new Date(),
          submittedBy: 1,
          decidedAt: new Date(),
          decidedBy: 2,
          decisionNote: "Wrong time",
        },
      });
      await req("patch", tokenA, `/timesheets/custom-activities/${a.id}`, {
        startTime: "13:00",
      }).expect(200);
    });
  });

  describe("permissions", () => {
    it("needs a login (401) and the write permission to change anything (403)", async () => {
      await request(app.getHttpServer())
        .post("/timesheets/custom-activities")
        .send({})
        .expect(401);
      await create(tokenReadOnly, { workDate: day(23) }).expect(403);
      // read-only users can still read the form data
      await req("get", tokenReadOnly, "/timesheets/activity-categories").expect(
        200,
      );
    });
  });
});
