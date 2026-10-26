import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface ProjectData {
  id: number;
  name: string;
  projectCode: string;
  expectedHours: number | string;
  projectPrice: number | string;
  actualCost: number | string;
  status: string;
  members: unknown[];
}

interface MilestoneData {
  id: number;
  title: string;
  status: string;
}

interface TaskData {
  id: number;
  title: string;
  taskCode: string;
  hoursToComplete: number | string;
  points: number;
  status: string;
}

interface TimerData {
  taskId: number;
  startedAt?: string;
  endedAt?: string;
}

interface ExpenseData {
  id: number;
  amount: number | string;
}

interface LeaderboardEntry {
  employeeId: number;
  totalPoints: number;
}

interface DashboardMetricsData {
  totalProjects: number;
  activeProjects: number;
  financials: Record<string, unknown>;
}

interface ResourcesData {
  resources: unknown[];
}

describe("Projects Module (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenNoPerm: string;
  let tokenB: string;
  let employeeA: { id: number };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);

    orgA = await prisma.organization.create({
      data: { name: `Org Projects A ${suffix}`, slug: `proj-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org Projects B ${suffix}`, slug: `proj-org-b-${suffix}` },
    });

    async function ensurePermission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const pRead = await ensurePermission("projects.project.read");
    const pWrite = await ensurePermission("projects.project.write");
    const pDelete = await ensurePermission("projects.project.delete");
    const pTaskWrite = await ensurePermission("projects.task.write");
    const pTimerWrite = await ensurePermission("projects.timer.write");
    const pExpenseRead = await ensurePermission("projects.expenses.read");
    const pExpenseWrite = await ensurePermission("projects.expenses.write");
    const pPoints = await ensurePermission("projects.points.manage");

    const allProjectPerms = [
      pRead.id,
      pWrite.id,
      pDelete.id,
      pTaskWrite.id,
      pTimerWrite.id,
      pExpenseRead.id,
      pExpenseWrite.id,
      pPoints.id,
    ];

    async function makeUser(
      orgId: number,
      email: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Project Engineer",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

    const userA = await makeUser(
      orgA.id,
      `admin@proj-a-${suffix}.test`,
      allProjectPerms,
    );
    await makeUser(orgA.id, `noperm@proj-a-${suffix}.test`, []);
    await makeUser(orgB.id, `admin@proj-b-${suffix}.test`, allProjectPerms);

    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: orgA.id, code: "ENG" } },
      update: {},
      create: {
        organizationId: orgA.id,
        code: "ENG",
        name: "Software Engineer",
      },
    });
    const empType = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: orgA.id, code: "PERM" } },
      update: {},
      create: { organizationId: orgA.id, code: "PERM", name: "Permanent" },
    });

    const team = await prisma.team.create({
      data: {
        organizationId: orgA.id,
        code: `ENG-${suffix}`,
        name: `Engineering Team ${suffix}`,
      },
    });

    const empCode = `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

    // Create an employee profile for userA so time-tracking and points work
    employeeA = await prisma.employee.create({
      data: {
        organization: { connect: { id: orgA.id } },
        user: { connect: { id: userA.id } },
        team: { connect: { id: team.id } },
        employeeCode: empCode,
        fullName: "Project Engineer",
        workEmail: userA.email,
        designation: { connect: { id: designation.id } },
        employmentType: { connect: { id: empType.id } },
        dateOfJoining: new Date("2026-01-01T00:00:00Z"),
      },
    });

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenA = await login(orgA.slug, `admin@proj-a-${suffix}.test`);
    tokenNoPerm = await login(orgA.slug, `noperm@proj-a-${suffix}.test`);
    tokenB = await login(orgB.slug, `admin@proj-b-${suffix}.test`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Projects Lifecycle", () => {
    let createdProjectId: number;
    let createdMilestoneId: number;
    let createdTaskId: number;

    it("creates a new project with auto-issued projectCode (PRJ-XXXXXX)", async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Mobile Banking App",
          description: "NextGen retail banking mobile app",
          department: "Engineering",
          startDate: "2026-10-01",
          plannedEndDate: "2026-12-31",
          expectedHours: 200,
          projectPrice: 75000,
          initialMemberEmployeeIds: [employeeA.id],
        })
        .expect(201);

      const resBody = res.body as ApiResponse<ProjectData>;
      const body = resBody.data;
      expect(body).toBeDefined();
      createdProjectId = body.id;
      expect(body.name).toBe("Mobile Banking App");
      expect(body.projectCode).toMatch(/^PRJ-\d{6}$/);
      expect(Number(body.expectedHours)).toBe(200);
      expect(Number(body.projectPrice)).toBe(75000);
      expect(body.status).toBe("active");
      expect(body.members).toHaveLength(1);
    });

    it("lists projects for the current tenant", async () => {
      const res = await request(app.getHttpServer())
        .get("/projects")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const listRes = res.body as ApiResponse<ProjectData[]>;
      expect(listRes.data).toBeInstanceOf(Array);
      expect(listRes.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.data[0]?.projectCode).toMatch(/^PRJ-\d{6}$/);
    });

    it("creates a milestone for the project", async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${createdProjectId}/milestones`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Sprint 1 — Architecture & Core DB",
          targetDate: "2026-10-31",
          order: 1,
        })
        .expect(201);

      const resBody = res.body as ApiResponse<MilestoneData>;
      const body = resBody.data;
      expect(body.title).toBe("Sprint 1 — Architecture & Core DB");
      expect(body.status).toBe("not_started");
      createdMilestoneId = body.id;
    });

    it("creates a task with auto-issued taskCode (TSK-XXXXXX) and computed hours", async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${createdProjectId}/tasks`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Setup PostgreSQL Schemas",
          description: "Run migrations and seed baseline data",
          milestoneId: createdMilestoneId,
          assignedToId: employeeA.id,
          startDate: "2026-10-05",
          endDate: "2026-10-06",
          priority: "high",
        })
        .expect(201);

      const resBody = res.body as ApiResponse<TaskData>;
      const body = resBody.data;
      createdTaskId = body.id;
      expect(body.title).toBe("Setup PostgreSQL Schemas");
      expect(body.taskCode).toMatch(/^TSK-\d{6}$/);
      expect(Number(body.hoursToComplete)).toBe(16); // 2 business days * 8 hours
      expect(body.points).toBe(20); // Default points for high priority
    });

    it("detects and rejects circular dependency on task creation", async () => {
      // Create a task that depends on createdTaskId
      const task2Res = await request(app.getHttpServer())
        .post(`/projects/${createdProjectId}/tasks`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Dependent API Controllers",
          startDate: "2026-10-07",
          endDate: "2026-10-08",
          dependencyTaskId: createdTaskId,
        })
        .expect(201);

      const task2ResBody = task2Res.body as ApiResponse<{ id: number }>;
      const task2Id = task2ResBody.data.id;

      // Attempting to make createdTaskId depend on task2Id would make createdTaskId -> task2Id -> createdTaskId
      await request(app.getHttpServer())
        .patch(`/projects/tasks/${createdTaskId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          dependencyTaskId: task2Id,
        })
        .expect(422);
    });

    it("starts a live timer and prevents duplicate active timers", async () => {
      // Start timer
      const res = await request(app.getHttpServer())
        .post(`/projects/tasks/${createdTaskId}/timer/start`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(201);

      const timerRes = res.body as ApiResponse<TimerData>;
      expect(timerRes.data.taskId).toBe(createdTaskId);

      // Attempt second timer (rejected by rule: only one active timer per employee)
      await request(app.getHttpServer())
        .post(`/projects/tasks/${createdTaskId}/timer/start`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(422);

      // Stop timer
      const stopRes = await request(app.getHttpServer())
        .post(`/projects/tasks/${createdTaskId}/timer/stop`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ notes: "Finished database setup" })
        .expect(200);

      const stopResBody = stopRes.body as ApiResponse<TimerData>;
      expect(stopResBody.data.endedAt).toBeDefined();
    });

    it("records a project expense and updates actualCost on project", async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${createdProjectId}/expenses`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          amount: 2500,
          expenseDate: "2026-10-15",
          department: "Engineering",
          vendor: "AWS Cloud",
          referenceNo: "INV-AWS-2026",
          notes: "Database hosting cluster",
        })
        .expect(201);

      const expRes = res.body as ApiResponse<ExpenseData>;
      expect(Number(expRes.data.amount)).toBe(2500);

      // Verify project actualCost incremented
      const projRes = await request(app.getHttpServer())
        .get(`/projects/${createdProjectId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const projResBody = projRes.body as ApiResponse<ProjectData>;
      expect(Number(projResBody.data.actualCost)).toBe(2500);
    });

    it("completes a task and awards gamification points", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/tasks/${createdTaskId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          status: "completed",
        })
        .expect(200);

      const completeRes = res.body as ApiResponse<TaskData>;
      expect(completeRes.data.status).toBe("completed");

      // Check leaderboard
      const leaderboardRes = await request(app.getHttpServer())
        .get("/projects/analytics/points/leaderboard")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const leaderboardBody = leaderboardRes.body as ApiResponse<
        LeaderboardEntry[]
      >;
      expect(leaderboardBody.data).toBeInstanceOf(Array);
      const entry = leaderboardBody.data.find(
        (e: LeaderboardEntry) => e.employeeId === employeeA.id,
      );
      expect(entry).toBeDefined();
      expect(entry?.totalPoints).toBeGreaterThanOrEqual(20);
    });

    it("returns dashboard metrics and resource utilization", async () => {
      const metricsRes = await request(app.getHttpServer())
        .get("/projects/analytics/dashboard")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const metricsBody = metricsRes.body as ApiResponse<DashboardMetricsData>;
      const metrics = metricsBody.data;
      expect(metrics.totalProjects).toBeGreaterThanOrEqual(1);
      expect(metrics.activeProjects).toBeGreaterThanOrEqual(1);
      expect(metrics.financials).toBeDefined();

      const resourcesRes = await request(app.getHttpServer())
        .get("/projects/analytics/resources")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const resData = resourcesRes.body as ApiResponse<ResourcesData>;
      expect(resData.data.resources).toBeInstanceOf(Array);
    });

    it("enforces tenant boundary — Org B cannot view Org A project", async () => {
      await request(app.getHttpServer())
        .get(`/projects/${createdProjectId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("enforces permissions — user without permission gets 403", async () => {
      await request(app.getHttpServer())
        .get("/projects")
        .set("Authorization", `Bearer ${tokenNoPerm}`)
        .expect(403);
    });
  });
});
