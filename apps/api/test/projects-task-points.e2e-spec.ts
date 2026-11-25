import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface Row {
  id: number;
  [key: string]: unknown;
}

// Team-lead task assignment, the manual ETA, and time-based reward points:
// every rule goes through the real API, guards and database.
describe("Projects: team-lead assignment, manual ETA and time-based points (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgId: number;

  let adminToken: string;
  let leadToken: string;
  let empToken: string;

  let empAId: number;
  let empBId: number;
  let projectId: number;
  let otherProjectId: number;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());
  const post = (token: string, url: string, body: object) =>
    http().post(url).set(bearer(token)).send(body);
  const patch = (token: string, url: string, body: object) =>
    http().patch(url).set(bearer(token)).send(body);
  const get = (token: string, url: string) =>
    http().get(url).set(bearer(token));

  const taskBody = (over: Record<string, unknown> = {}) => ({
    title: `Task ${randomUUID().slice(0, 6)}`,
    startDate: "2026-10-05",
    endDate: "2026-10-09",
    hoursToComplete: 2,
    ...over,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Org Points ${suffix}`, slug: `proj-pts-${suffix}` },
    });
    orgId = org.id;

    const ensurePerms = (codes: string[]) =>
      Promise.all(
        codes.map((code) =>
          prisma.permission.upsert({
            where: { code },
            update: {},
            create: { code, description: code },
          }),
        ),
      );

    async function makeUser(email: string, codes: string[]) {
      const perms = await ensurePerms(codes);
      const role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
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
    const teamA = await prisma.team.create({
      data: { organizationId: org.id, code: `A-${suffix}`, name: "Team A" },
    });
    const teamB = await prisma.team.create({
      data: { organizationId: org.id, code: `B-${suffix}`, name: "Team B" },
    });
    async function makeEmployee(
      userId: number,
      teamId: number,
      email: string,
      name: string,
    ) {
      return prisma.employee.create({
        data: {
          organization: { connect: { id: org.id } },
          user: { connect: { id: userId } },
          team: { connect: { id: teamId } },
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: name,
          workEmail: email,
          designation: { connect: { id: designation.id } },
          employmentType: { connect: { id: empType.id } },
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
    }

    const adminEmail = `admin@pts-${suffix}.test`;
    const leadEmail = `lead@pts-${suffix}.test`;
    const aEmail = `a@pts-${suffix}.test`;
    const bEmail = `b@pts-${suffix}.test`;
    const adminUser = await makeUser(adminEmail, [
      "projects.project.read",
      "projects.task.write",
      "projects.points.manage",
    ]);
    const leadUser = await makeUser(leadEmail, [
      "projects.project.read",
      "projects.task_assignment.write.team",
    ]);
    const aUser = await makeUser(aEmail, ["projects.timer.write"]);
    const bUser = await makeUser(bEmail, ["projects.timer.write"]);
    void adminUser;
    const empA = await makeEmployee(aUser.id, teamA.id, aEmail, "Emp A");
    const empB = await makeEmployee(bUser.id, teamB.id, bEmail, "Emp B");
    empAId = empA.id;
    empBId = empB.id;

    // The lead leads team A only.
    await prisma.userTeamAccess.create({
      data: {
        userId: leadUser.id,
        teamId: teamA.id,
        organizationId: org.id,
      },
    });

    const mkProject = (n: number) =>
      prisma.project.create({
        data: {
          organizationId: org.id,
          projectCode: `PTS/${suffix}/${n}`,
          name: `Points project ${n}`,
          customerName: "Acme",
          startDate: new Date("2026-10-01"),
          projectPrice: 1000,
        },
      });
    projectId = (await mkProject(1)).id;
    otherProjectId = (await mkProject(2)).id;
    // Team A's employee is on project 1 only.
    await prisma.projectMember.create({
      data: { organizationId: org.id, projectId, employeeId: empA.id },
    });

    async function login(email: string) {
      const res = await http()
        .post("/auth/login")
        .send({
          organizationSlug: org.slug,
          email,
          password: "Password123!",
        })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    }
    adminToken = await login(adminEmail);
    leadToken = await login(leadEmail);
    empToken = await login(aEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("team lead", () => {
    it("creates a task for an employee of their own team", async () => {
      const res = await post(
        leadToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId }),
      ).expect(201);
      expect((res.body as { data: Row }).data.id).toBeGreaterThan(0);
    });

    it("cannot assign to another team's employee, or leave a task unassigned", async () => {
      await post(
        leadToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empBId }),
      ).expect(403);
      await post(leadToken, `/projects/${projectId}/tasks`, taskBody()).expect(
        403,
      );
    });

    it("cannot edit, reassign or delete another team's task", async () => {
      const made = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empBId }),
      ).expect(201);
      const id = (made.body as { data: Row }).data.id;
      await patch(leadToken, `/projects/tasks/${id}`, {
        title: "hijack",
      }).expect(403);
      await http()
        .delete(`/projects/tasks/${id}`)
        .set(bearer(leadToken))
        .expect(403);

      const own = await post(
        leadToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId }),
      ).expect(201);
      const ownId = (own.body as { data: Row }).data.id;
      await patch(leadToken, `/projects/tasks/${ownId}`, {
        assignedToId: empBId,
      }).expect(403);
    });

    it("manages milestones only on a project that includes their team", async () => {
      await post(leadToken, `/projects/${projectId}/milestones`, {
        title: "Design freeze",
        targetDate: "2026-10-30",
      }).expect(201);
      await post(leadToken, `/projects/${otherProjectId}/milestones`, {
        title: "Nope",
        targetDate: "2026-10-30",
      }).expect(403);
    });

    it("holds no org-wide write: the points config is off limits", async () => {
      await patch(leadToken, "/projects/points/config", {
        timeBasedEnabled: true,
      }).expect(403);
    });
  });

  describe("manual ETA", () => {
    it("is required, at least 0.25h and in steps of 0.25h", async () => {
      const body = taskBody({ assignedToId: empAId });
      delete (body as { hoursToComplete?: number }).hoursToComplete;
      await post(adminToken, `/projects/${projectId}/tasks`, body).expect(400);
      for (const bad of [0, 0.1, 0.3, 501]) {
        await post(
          adminToken,
          `/projects/${projectId}/tasks`,
          taskBody({ assignedToId: empAId, hoursToComplete: bad }),
        ).expect(400);
      }
    });

    it("is stored as entered, not as business days x 8", async () => {
      const res = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId, hoursToComplete: 3.5 }),
      ).expect(201);
      const task = (res.body as { data: Row }).data;
      expect(Number(task.hoursToComplete)).toBe(3.5);
    });

    it("changes freely before work starts, needs a reason after, and is audited", async () => {
      const made = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId, hoursToComplete: 2 }),
      ).expect(201);
      const id = (made.body as { data: Row }).data.id;

      await patch(adminToken, `/projects/tasks/${id}`, {
        hoursToComplete: 4,
      }).expect(200);

      await patch(adminToken, `/projects/tasks/${id}`, {
        status: "in_progress",
      }).expect(200);
      await patch(adminToken, `/projects/tasks/${id}`, {
        hoursToComplete: 6,
      }).expect((res) => {
        if (res.status < 400) throw new Error("expected a rejection");
      });
      await patch(adminToken, `/projects/tasks/${id}`, {
        hoursToComplete: 6,
        hoursChangeReason: "Client added scope",
      }).expect(200);

      const audit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: "project_task",
          entityId: BigInt(id),
          action: "eta_change",
        },
        orderBy: { id: "asc" },
      });
      expect(audit).toHaveLength(2);
      expect(audit[1]?.reason).toBe("Client added scope");
      expect(audit[1]?.after).toMatchObject({ hoursToComplete: 6 });
    });
  });

  describe("time-based points", () => {
    let taskId: number;

    async function timer(taskId: number, minutes: number, source = "TIMER") {
      // One timesheet row per employee, day and task: reuse it across calls.
      const workDate = new Date("2026-10-05");
      const day =
        (await prisma.timesheet.findFirst({
          where: {
            organizationId: orgId,
            employeeId: empAId,
            taskId,
            workDate,
          },
        })) ??
        (await prisma.timesheet.create({
          data: {
            organizationId: orgId,
            employeeId: empAId,
            workDate,
            category: "TASK",
            taskId,
            projectId,
            title: `Task ${taskId}`,
          },
        }));
      await prisma.projectTimeEntry.create({
        data: {
          organizationId: orgId,
          taskId,
          employeeId: empAId,
          startedAt: new Date("2026-10-05T04:00:00Z"),
          endedAt: new Date(
            Date.parse("2026-10-05T04:00:00Z") + minutes * 60000,
          ),
          durationMinutes: minutes,
          entryDate: new Date("2026-10-05"),
          timesheetId: day.id,
          source,
        },
      });
    }

    it("pays the legacy priority points while the rule is off", async () => {
      const made = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId, priority: "high" }),
      ).expect(201);
      const task = (made.body as { data: Row }).data;
      expect(task.points).toBe(20);
      await patch(adminToken, `/projects/tasks/${task.id}`, {
        status: "completed",
      }).expect(200);
      const row = await prisma.projectPointsLedger.findFirst({
        where: { organizationId: orgId, taskId: task.id },
      });
      expect(row?.points).toBe(20);
      expect(row?.rule).toBeNull();
    });

    it("switches on, and every new task is worth the same configured points", async () => {
      await patch(adminToken, "/projects/points/config", {
        timeBasedEnabled: true,
        defaultTaskPoints: 10,
        onTimeBonus: 1,
        graceMinutes: 5,
      }).expect(200);
      const made = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({
          assignedToId: empAId,
          priority: "urgent",
          points: 99,
          hoursToComplete: 2,
        }),
      ).expect(201);
      const task = (made.body as { data: Row }).data;
      taskId = task.id;
      expect(task.points).toBe(10);
    });

    it("will not complete a task with no timer time", async () => {
      const res = await patch(adminToken, `/projects/tasks/${taskId}`, {
        status: "completed",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain("NO_TIMER_TIME_LOGGED");
    });

    it("awards 7 for 2h30 on a 2h task, counting timer minutes only", async () => {
      await timer(taskId, 150);
      // A manual entry must not count: it would otherwise push this to 0.
      await timer(taskId, 600, "MANUAL");
      await patch(adminToken, `/projects/tasks/${taskId}`, {
        status: "completed",
      }).expect(200);
      const row = await prisma.projectPointsLedger.findFirst({
        where: { organizationId: orgId, taskId },
      });
      expect(row).toMatchObject({
        points: 7,
        etaMinutes: 120,
        workedMinutes: 150,
        basePoints: 10,
        bonusPoints: 0,
        overrunMinutes: 30,
        rule: "time_v1",
      });
    });

    it("pays once: re-completing a reopened task keeps the first award", async () => {
      await patch(adminToken, `/projects/tasks/${taskId}`, {
        status: "in_progress",
        statusChangeReason: "More work found",
      }).expect(200);
      await timer(taskId, 10);
      await patch(adminToken, `/projects/tasks/${taskId}`, {
        status: "completed",
      }).expect(200);
      const rows = await prisma.projectPointsLedger.findMany({
        where: { organizationId: orgId, taskId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.points).toBe(7);
    });

    it("gives the employee their awards with the breakdown", async () => {
      const res = await get(empToken, "/projects/points/my").expect(200);
      const rows = (res.body as { data: Row[] }).data;
      const mine = rows.find((r) => r.taskId === taskId);
      expect(mine).toMatchObject({
        points: 7,
        etaMinutes: 120,
        workedMinutes: 150,
        rule: "time_v1",
      });
    });

    it("awards base + 1 for a task finished inside its ETA", async () => {
      const made = await post(
        adminToken,
        `/projects/${projectId}/tasks`,
        taskBody({ assignedToId: empAId, hoursToComplete: 2 }),
      ).expect(201);
      const id = (made.body as { data: Row }).data.id;
      await timer(id, 110);
      await patch(adminToken, `/projects/tasks/${id}`, {
        status: "completed",
      }).expect(200);
      const row = await prisma.projectPointsLedger.findFirst({
        where: { organizationId: orgId, taskId: id },
      });
      expect(row).toMatchObject({ points: 11, bonusPoints: 1 });
    });
  });
});
