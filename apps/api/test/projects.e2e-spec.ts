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

  describe("Project customer link (Sales customers)", () => {
    const tag = randomUUID().slice(0, 8);
    let ownCustomer: { id: number; companyName: string };
    let otherOrgCustomer: { id: number };
    let linkedProjectId: number;

    function makeCustomer(organizationId: number, name: string, code: string) {
      return prisma.salesCustomer.create({
        data: {
          organizationId,
          customerCode: code,
          companyName: name,
          contactPerson: "Buyer",
          email: `buyer-${code}@example.test`,
          mobileNumber: "9876543210",
          bankName: "Secret Bank",
        },
      });
    }

    beforeAll(async () => {
      ownCustomer = await makeCustomer(
        orgA.id,
        `Acme Industries ${tag}`,
        `C-A-${tag}`,
      );
      otherOrgCustomer = await makeCustomer(
        orgB.id,
        `Foreign Co ${tag}`,
        `C-B-${tag}`,
      );
    });

    it("lists only this organization's active customers, identity fields only", async () => {
      const res = await request(app.getHttpServer())
        .get("/projects/customers")
        .query({ search: tag })
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const rows = (res.body as ApiResponse<Record<string, unknown>[]>).data;
      expect(rows.map((r) => r.id)).toEqual([ownCustomer.id]);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
        "companyName",
        "customerCode",
        "id",
      ]);
    });

    it("rejects the customer picker without projects.project.write", async () => {
      await request(app.getHttpServer())
        .get("/projects/customers")
        .set("Authorization", `Bearer ${tokenNoPerm}`)
        .expect(403);
    });

    it("creates a project linked to a Sales customer and copies its company name", async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Linked customer project",
          salesCustomerId: ownCustomer.id,
          customerName: "ignored free text",
          startDate: "2026-10-01",
        })
        .expect(201);

      const body = (
        res.body as ApiResponse<{
          id: number;
          salesCustomerId: number | null;
          customerName: string | null;
          salesCustomer: { id: number; companyName: string } | null;
        }>
      ).data;
      linkedProjectId = body.id;
      expect(body.salesCustomerId).toBe(ownCustomer.id);
      expect(body.customerName).toBe(ownCustomer.companyName);
      expect(body.salesCustomer?.companyName).toBe(ownCustomer.companyName);
    });

    it("filters the project list by salesCustomerId", async () => {
      const res = await request(app.getHttpServer())
        .get("/projects")
        .query({ salesCustomerId: ownCustomer.id })
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const ids = (res.body as ApiResponse<{ id: number }[]>).data.map(
        (p) => p.id,
      );
      expect(ids).toEqual([linkedProjectId]);
    });

    it("rejects a customer that belongs to another organization", async () => {
      await request(app.getHttpServer())
        .post("/projects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Cross-tenant customer",
          salesCustomerId: otherOrgCustomer.id,
          startDate: "2026-10-01",
        })
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/projects/${linkedProjectId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ salesCustomerId: otherOrgCustomer.id })
        .expect(404);
    });

    it("clears the link and the copied name when salesCustomerId is null", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${linkedProjectId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ salesCustomerId: null })
        .expect(200);

      const body = (
        res.body as ApiResponse<{
          salesCustomerId: number | null;
          customerName: string | null;
        }>
      ).data;
      expect(body.salesCustomerId).toBeNull();
      expect(body.customerName).toBeNull();
    });
  });

  describe("Projects Lifecycle", () => {
    let createdProjectId: number;
    let createdMilestoneId: number;
    let createdTaskId: number;

    it("creates a new project with an auto-issued legacy-format projectCode (TXW/PRJ/<FY>/NNN)", async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Mobile Banking App",
          description: "NextGen retail banking mobile app",
          departments: ["Engineering"],
          resourceNames: ["Priya Sharma"],
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
      expect(body.projectCode).toMatch(
        /^[A-Z0-9-]+\/[A-Z0-9-]+\/([A-Z0-9-]+\/)?\d{2}-\d{2}\/\d{3,}$/,
      );
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
      expect(listRes.data[0]?.projectCode).toMatch(/\/\d{2}-\d{2}\/\d{3,}$/);
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

    it("creates a task with an auto-issued <projectCode>-T01 taskCode and the manual ETA", async () => {
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
          hoursToComplete: 3.5,
        })
        .expect(201);

      const resBody = res.body as ApiResponse<TaskData>;
      const body = resBody.data;
      createdTaskId = body.id;
      expect(body.title).toBe("Setup PostgreSQL Schemas");
      expect(body.taskCode).toMatch(/-T\d{2,}$/);
      // The ETA is what was entered, not business days x 8 (which would be 16).
      expect(Number(body.hoursToComplete)).toBe(3.5);
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
          hoursToComplete: 2,
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

    it("refuses to start a timer before the employee checks in", async () => {
      await request(app.getHttpServer())
        .post(`/projects/tasks/${createdTaskId}/timer/start`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(422);
    });

    it("starts a live timer and prevents duplicate active timers", async () => {
      // The stopwatch is gated on attendance (legacy My Work): check the
      // employee in for today (IST business date) with an open session.
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date());
      await prisma.attendanceRecord.create({
        data: {
          organizationId: orgA.id,
          employeeId: employeeA.id,
          attendanceDate: new Date(`${today}T00:00:00.000Z`),
          sessions: { create: { checkInAt: new Date(), source: "SELF" } },
        },
      });

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

    it("returns hours per Monday-start week, tenant-scoped and permission-gated", async () => {
      type Week = { weekStart: string; hours: number; entries: number };
      const res = await request(app.getHttpServer())
        .get("/projects/analytics/hours-trend")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const weeks = (res.body as ApiResponse<Week[]>).data;
      expect(weeks).toHaveLength(7);
      expect(new Date(`${weeks[6]!.weekStart}T00:00:00Z`).getUTCDay()).toBe(1);
      // The timer test above logged an entry today.
      expect(weeks[6]!.entries).toBeGreaterThanOrEqual(1);

      await request(app.getHttpServer())
        .get("/projects/analytics/hours-trend?weeks=27")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(400);
      await request(app.getHttpServer())
        .get("/projects/analytics/hours-trend")
        .set("Authorization", `Bearer ${tokenNoPerm}`)
        .expect(403);

      const otherRes = await request(app.getHttpServer())
        .get("/projects/analytics/hours-trend?weeks=2")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      const other = (otherRes.body as ApiResponse<Week[]>).data;
      expect(other.every((w) => w.entries === 0)).toBe(true);
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
