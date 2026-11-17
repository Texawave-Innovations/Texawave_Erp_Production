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

// The employee portal's My Work tab: an Employee-role user holds
// projects.timer.write and projects.task.write but NOT projects.project.read.
// Everything My Work needs must work with that, and nothing org-wide may open.
describe("Employee portal My Work, no org-wide project read (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let token: string;
  let ownTaskId: number;
  let othersTaskId: number;

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
      data: { name: `Org Work ${suffix}`, slug: `proj-work-${suffix}` },
    });

    const perms = await Promise.all(
      ["projects.timer.write", "projects.task.write"].map((code) =>
        prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        }),
      ),
    );

    async function makeUser(email: string, withPerms: boolean) {
      const role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      if (withPerms) {
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

    const meEmail = `me@work-${suffix}.test`;
    const otherEmail = `other@work-${suffix}.test`;
    const meUser = await makeUser(meEmail, true);
    const otherUser = await makeUser(otherEmail, true);
    const me = await makeEmployee(meUser.id, meEmail, "Me Person");
    const other = await makeEmployee(otherUser.id, otherEmail, "Other Person");

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        projectCode: `WORK/${suffix}/1`,
        name: "Work project",
        customerName: "Acme Industries",
        startDate: new Date("2026-10-01"),
        projectPrice: 99999,
      },
    });
    const mkTask = (n: number, assignedToId: number) =>
      prisma.projectTask.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          taskCode: `WORK/${suffix}/1-T0${n}`,
          title: `Task ${n}`,
          assignedToId,
          startDate: new Date("2026-10-05"),
          endDate: new Date("2026-10-06"),
        },
      });
    ownTaskId = (await mkTask(1, me.id)).id;
    othersTaskId = (await mkTask(2, other.id)).id;

    // Every session belongs to its day's timesheet row (NOT NULL link).
    const entry = async (
      taskId: number,
      employeeId: number,
      minutes: number,
    ) => {
      const day = await prisma.timesheet.create({
        data: {
          organizationId: org.id,
          employeeId,
          workDate: new Date("2026-10-05"),
          category: "TASK",
          taskId,
          projectId: project.id,
          title: `Task ${taskId}`,
        },
      });
      return {
        organizationId: org.id,
        taskId,
        employeeId,
        startedAt: new Date("2026-10-05T04:00:00Z"),
        endedAt: new Date(Date.parse("2026-10-05T04:00:00Z") + minutes * 60000),
        durationMinutes: minutes,
        entryDate: new Date("2026-10-05"),
        timesheetId: day.id,
      };
    };
    await prisma.projectTimeEntry.createMany({
      data: [
        await entry(ownTaskId, me.id, 30),
        await entry(othersTaskId, other.id, 45),
      ],
    });

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: org.slug,
        email: meEmail,
        password: "Password123!",
      })
      .expect(201);
    token = (res.body as { data: { accessToken: string } }).data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set("Authorization", `Bearer ${token}`);

  it("lists only the caller's own tasks, with the client name on the project", async () => {
    const res = await get("/projects/tasks/my-work").expect(200);
    const rows = (
      res.body as {
        data: (Row & { project: { customerName: string | null } })[];
      }
    ).data;
    expect(rows.map((t) => t.id)).toEqual([ownTaskId]);
    expect(rows[0]?.project.customerName).toBe("Acme Industries");
    expect(rows[0]?.project).not.toHaveProperty("projectPrice");
  });

  it("serves the logged-today summary", async () => {
    await get("/projects/tasks/time-summary/me").expect(200);
  });

  it("lists only the caller's own time entries on their own task", async () => {
    const res = await get(
      `/projects/tasks/${ownTaskId}/time-entries/mine`,
    ).expect(200);
    const rows = (res.body as { data: (Row & { durationMinutes: number })[] })
      .data;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.durationMinutes).toBe(30);
  });

  it("404s the own-entries endpoint for a task assigned to someone else", async () => {
    await get(`/projects/tasks/${othersTaskId}/time-entries/mine`).expect(404);
  });

  it("still refuses everything org-wide", async () => {
    await get("/projects").expect(403);
    await get(`/projects/tasks/${othersTaskId}/time-entries`).expect(403);
    await get(`/projects/tasks/${othersTaskId}`).expect(403);
  });
});
