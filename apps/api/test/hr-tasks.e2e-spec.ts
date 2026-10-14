import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Task Assignment: admin assignment and reassignment, the legacy status
 * lifecycle (start, complete, admin approve, reopen), employee self-service
 * (own tasks only, locked after approval), team/all scope, org isolation,
 * 404-not-403 for out-of-scope rows, audit and DB invariants.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface Task {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: string;
  dueDate: string;
  isOverdue: boolean;
  awaitingApproval: boolean;
  adminApproved: boolean;
  isEmployeeCreated: boolean;
  requestToAdmin: boolean;
  assignee: { id: number; fullName: string };
}

const PERMS = [
  "employee_self_service.task.read",
  "employee_self_service.task.create",
  "employee_self_service.task.update_status",
  "hr.task.read.team",
  "hr.task.write.team",
  "hr.task.read.all",
  "hr.task.write.all",
];

const FUTURE = "2099-12-31";
const PAST = "2000-01-01";

describe("HR task assignment (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  let team1: number;
  let team2: number;
  let teamB: number;
  const emp: Record<string, number> = {};

  /** Fixture id that must exist; fails loudly instead of passing `undefined`. */
  const need = (m: Record<string, number>, k: string): number => {
    const v = m[k];
    if (v === undefined) throw new Error(`missing test fixture: ${k}`);
    return v;
  };

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;
  const dataOf = <T>(r: request.Response) => (r.body as Body<T>).data;

  /** Admin (HR) creates a task for an employee. */
  const assign = (who: string, body: object) =>
    post(who, "/hr/tasks", {
      title: "Quarterly audit",
      assigneeId: emp.empA,
      dueDate: FUTURE,
      ...body,
    });
  const mkAdminTask = async (who: string, body: object = {}) =>
    dataOf<Task>(await assign(who, body).expect(201));

  /** Employee creates a task for themselves. */
  const selfCreate = (who: string, body: object) =>
    post(who, "/self-service/tasks", {
      title: "Write the handover note",
      dueDate: FUTURE,
      ...body,
    });

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    opts: { teamIds?: number[] } = {},
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${key}-${suffix}` },
    });
    if (codes.length) {
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perm.get(c) as number,
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
    for (const teamId of opts.teamIds ?? []) {
      await prisma.userTeamAccess.create({
        data: { organizationId: org.id, userId: user.id, teamId },
      });
    }
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    userIds[key] = user.id;
    return user;
  }

  const mkEmp = async (
    orgId: number,
    teamId: number,
    n: number,
    over: Record<string, unknown> = {},
  ) => {
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
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: `Emp ${n}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          ...over,
        },
      })
    ).id;
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
      data: { name: `TK A ${suffix}`, slug: `tk-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `TK B ${suffix}`, slug: `tk-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team1 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T1", code: `T1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T2", code: `T2${suffix}` },
      })
    ).id;
    teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `TB${suffix}` },
      })
    ).id;

    const selfService = [
      "employee_self_service.task.read",
      "employee_self_service.task.create",
      "employee_self_service.task.update_status",
    ];
    // Team-1 manager: assigns and approves within team 1 only.
    const mgr = await mkUser(
      orgA,
      "mgr",
      [...selfService, "hr.task.read.team", "hr.task.write.team"],
      { teamIds: [team1] },
    );
    // Plain employees: self-service only.
    const empA = await mkUser(orgA, "empA", selfService);
    const empB = await mkUser(orgA, "empB", selfService);
    // Organization-wide HR (admin).
    await mkUser(orgA, "hr", ["hr.task.read.all", "hr.task.write.all"]);
    // Read-only HR: can see everything, can write nothing.
    await mkUser(orgA, "hrRead", ["hr.task.read.all"]);
    // Holds nothing relevant.
    await mkUser(orgA, "none", []);
    // Other organization: all-scope, must still see nothing of org A.
    await mkUser(orgB, "outsider", ["hr.task.read.all", "hr.task.write.all"]);

    emp.mgr = await mkEmp(orgA.id, team1, 1, { userId: mgr.id });
    emp.empA = await mkEmp(orgA.id, team1, 2, { userId: empA.id });
    emp.empB = await mkEmp(orgA.id, team2, 3, { userId: empB.id });
    emp.teamTwoOnly = await mkEmp(orgA.id, team2, 5);
    emp.other = await mkEmp(orgB.id, teamB, 4);
  });

  afterAll(async () => {
    await Promise.all(
      Object.values(userIds).flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe("authentication and permission", () => {
    it("rejects unauthenticated access to both surfaces", async () => {
      await request(app.getHttpServer()).get("/hr/tasks").expect(401);
      await request(app.getHttpServer()).get("/self-service/tasks").expect(401);
    });

    it("an employee cannot reach the HR surface", async () => {
      const r = await get("empA", "/hr/tasks");
      expect(r.status).toBe(403);
    });

    it("a user with no task permission cannot reach the self-service surface", async () => {
      const r = await get("none", "/self-service/tasks");
      expect(r.status).toBe(403);
    });

    it("a read-only HR user cannot assign, reassign, change status or approve", async () => {
      expect((await assign("hrRead", {})).status).toBe(403);
      const task = await mkAdminTask("hr");
      expect(
        (
          await patch("hrRead", `/hr/tasks/${task.id}`, {
            assigneeId: emp.empB,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await post("hrRead", `/hr/tasks/${task.id}/status`, {
            status: "DONE",
          })
        ).status,
      ).toBe(403);
      expect(
        (await post("hrRead", `/hr/tasks/${task.id}/approve`)).status,
      ).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("admin assignment", () => {
    it("creates a PENDING task assigned to the employee, with the caller as assigner", async () => {
      const r = await assign("hr", { description: "Check the ledgers" });
      expect(r.status).toBe(201);
      const task = dataOf<Task>(r);
      expect(task.status).toBe("PENDING");
      expect(task.priority).toBe("MEDIUM");
      expect(task.isEmployeeCreated).toBe(false);
      expect(task.assignee.id).toBe(emp.empA);
    });

    it("refuses a past due date (422) and a missing one (400)", async () => {
      const past = await assign("hr", { dueDate: PAST });
      expect(past.status).toBe(422);
      expect(errorOf(past)).toBe("DUE_DATE_IN_PAST");
      const missing = await post("hr", "/hr/tasks", {
        title: "No date",
        assigneeId: emp.empA,
      });
      expect(missing.status).toBe(400);
    });

    it("the team manager can assign within their team but not to another team (422, not 201)", async () => {
      const inTeam = await assign("mgr", { assigneeId: emp.empA });
      expect(inTeam.status).toBe(201);
      const outOfTeam = await assign("mgr", { assigneeId: emp.empB });
      expect(outOfTeam.status).toBe(422);
      expect(errorOf(outOfTeam)).toBe("INVALID_ASSIGNEE");
    });

    it("refuses a title of 81 characters and a description over 500", async () => {
      expect((await assign("hr", { title: "x".repeat(81) })).status).toBe(400);
      expect(
        (await assign("hr", { description: "x".repeat(501) })).status,
      ).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("employee self-service", () => {
    it("rejects an assignee in the body (400): an employee can only create work for themselves", async () => {
      const r = await selfCreate("empA", { assigneeId: emp.empB });
      expect(r.status).toBe(400);
    });

    it("creates a task assigned to and created by the caller", async () => {
      const r = await selfCreate("empA", { requestToAdmin: true });
      expect(r.status).toBe(201);
      const task = dataOf<Task>(r);
      expect(task.assignee.id).toBe(emp.empA);
      expect(task.isEmployeeCreated).toBe(true);
      expect(task.requestToAdmin).toBe(true);
    });

    it("refuses a past due date for a self-created task", async () => {
      const r = await selfCreate("empA", { dueDate: PAST });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("DUE_DATE_IN_PAST");
    });

    it("lists only tasks assigned to or created by the caller", async () => {
      const mine = await get("empA", "/self-service/tasks?limit=100");
      expect(mine.status).toBe(200);
      const rows = dataOf<Task[]>(mine);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((t) => t.assignee.id === emp.empA)).toBe(true);
    });

    it("an employee cannot read another employee's task (404, not 403)", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empB });
      const r = await get("empA", `/self-service/tasks/${task.id}`);
      expect(r.status).toBe(404);
      expect(errorOf(r)).toBe("RESOURCE_NOT_FOUND");
    });

    it("an employee cannot change another employee's task status (404)", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empB });
      const r = await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "DONE",
      });
      expect(r.status).toBe(404);
    });

    it("runs the legacy path: Start Working, Mark as Done, then the checkbox reopens it", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const start = await post(
        "empA",
        `/self-service/tasks/${task.id}/status`,
        {
          status: "IN_PROGRESS",
        },
      );
      expect(start.status).toBe(200);
      expect(dataOf<Task>(start).status).toBe("IN_PROGRESS");

      const done = await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "DONE",
      });
      expect(dataOf<Task>(done).awaitingApproval).toBe(true);

      const back = await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(back.status).toBe(200);
      expect(dataOf<Task>(back).status).toBe("PENDING");
    });

    it("refuses moves the legacy screen does not offer (IN_PROGRESS -> PENDING, CANCELLED)", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "IN_PROGRESS",
      }).expect(200);
      const back = await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(back.status).toBe(422);
      expect(errorOf(back)).toBe("INVALID_STATE_TRANSITION");
      const cancel = await post(
        "empA",
        `/self-service/tasks/${task.id}/status`,
        { status: "CANCELLED" },
      );
      expect(cancel.status).toBe(400);
    });

    it("an approved task is locked against the employee", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      await post("hr", `/hr/tasks/${task.id}/approve`).expect(200);
      const r = await post("empA", `/self-service/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(r.status).toBe(422);
    });
  });

  // ---------------------------------------------------------------------------
  describe("admin lifecycle, approval and reopen", () => {
    it("send to approval (DONE), approve, and approved is final", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const done = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      });
      expect(dataOf<Task>(done).awaitingApproval).toBe(true);

      const approve = await post("hr", `/hr/tasks/${task.id}/approve`);
      expect(approve.status).toBe(200);
      expect(dataOf<Task>(approve).adminApproved).toBe(true);

      const again = await post("hr", `/hr/tasks/${task.id}/approve`);
      expect(again.status).toBe(422);
      const reopen = await post("hr", `/hr/tasks/${task.id}/reopen`);
      expect(reopen.status).toBe(422);
      const reset = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(reset.status).toBe(422);
    });

    it("a DONE task cannot be set through the status dropdown (must approve or reopen)", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      const r = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "IN_PROGRESS",
      });
      expect(r.status).toBe(422);
    });

    it("reopen returns an unapproved DONE task to IN_PROGRESS", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      const r = await post("hr", `/hr/tasks/${task.id}/reopen`);
      expect(r.status).toBe(200);
      expect(dataOf<Task>(r).status).toBe("IN_PROGRESS");
      expect(dataOf<Task>(r).awaitingApproval).toBe(false);
    });

    it("approve refuses a task that is not DONE", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const r = await post("hr", `/hr/tasks/${task.id}/approve`);
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("cancelling is reversible by an admin (legacy dropdown allows it)", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const cancelled = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "CANCELLED",
      });
      expect(dataOf<Task>(cancelled).status).toBe("CANCELLED");
      const restored = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(dataOf<Task>(restored).status).toBe("PENDING");
    });

    it("a no-op status change returns the task unchanged without a write", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const r = await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "PENDING",
      });
      expect(r.status).toBe(200);
      const audits = await prisma.auditLog.count({
        where: {
          entityType: "task",
          entityId: task.id,
          action: "status_change",
        },
      });
      expect(audits).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("reassignment", () => {
    it("reassigns an open admin task within scope", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const r = await patch("hr", `/hr/tasks/${task.id}`, {
        assigneeId: emp.empB,
      });
      expect(r.status).toBe(200);
      expect(dataOf<Task>(r).assignee.id).toBe(emp.empB);
    });

    it("refuses to reassign a DONE task", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      const r = await patch("hr", `/hr/tasks/${task.id}`, {
        assigneeId: emp.empB,
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("TASK_NOT_REASSIGNABLE");
    });

    it("refuses to reassign an employee-created task (it belongs to the employee)", async () => {
      const own = dataOf<Task>(await selfCreate("empA", {}).expect(201));
      const r = await patch("hr", `/hr/tasks/${own.id}`, {
        assigneeId: emp.empB,
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("EMPLOYEE_CREATED_TASK_NOT_REASSIGNABLE");
    });

    it("refuses to reassign outside the manager's team", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      const r = await patch("mgr", `/hr/tasks/${task.id}`, {
        assigneeId: emp.empB,
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_ASSIGNEE");
    });
  });

  // ---------------------------------------------------------------------------
  describe("team scope and org isolation", () => {
    it("the team manager sees their team's tasks and not another team's (404)", async () => {
      const inTeam = await mkAdminTask("hr", { assigneeId: emp.empA });
      const other = await mkAdminTask("hr", { assigneeId: emp.empB });
      expect((await get("mgr", `/hr/tasks/${inTeam.id}`)).status).toBe(200);
      const r = await get("mgr", `/hr/tasks/${other.id}`);
      expect(r.status).toBe(404);
      const list = await get("mgr", "/hr/tasks?limit=100");
      const ids = dataOf<Task[]>(list).map((t) => t.id);
      expect(ids).toContain(inTeam.id);
      expect(ids).not.toContain(other.id);
    });

    it("HR with org-wide scope sees every team", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empB });
      expect((await get("hr", `/hr/tasks/${task.id}`)).status).toBe(200);
    });

    it("an outsider with all-scope in another organization sees nothing of org A", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      expect((await get("outsider", `/hr/tasks/${task.id}`)).status).toBe(404);
      const list = await get("outsider", "/hr/tasks?limit=100");
      expect(dataOf<Task[]>(list)).toEqual([]);
    });

    it("an admin cannot assign to an employee of another organization (422)", async () => {
      const r = await assign("outsider", { assigneeId: emp.empA });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_ASSIGNEE");
    });
  });

  // ---------------------------------------------------------------------------
  describe("filters and derived buckets", () => {
    it("overdue lists open tasks due before today, and excludes finished ones", async () => {
      // The API refuses past due dates, so an overdue row is set up directly.
      const orgAEmployee = need(emp, "teamTwoOnly");
      const overdue = await prisma.task.create({
        data: {
          organizationId: orgA.id,
          title: "Overdue on purpose",
          assigneeId: orgAEmployee,
          assignedByUserId: need(userIds, "hr"),
          dueDate: new Date("2000-01-01T00:00:00Z"),
          status: "IN_PROGRESS",
        },
      });
      const r = await get("hr", "/hr/tasks?overdue=true&limit=100");
      const ids = dataOf<Task[]>(r).map((t) => t.id);
      expect(ids).toContain(overdue.id);
      expect(dataOf<Task[]>(r).every((t) => t.isOverdue)).toBe(true);

      await prisma.task.update({
        where: { id: overdue.id },
        data: { status: "DONE" },
      });
      const after = await get("hr", "/hr/tasks?overdue=true&limit=100");
      expect(dataOf<Task[]>(after).map((t) => t.id)).not.toContain(overdue.id);
    });

    it("awaitingApproval lists DONE tasks not yet approved", async () => {
      const task = await mkAdminTask("hr", { assigneeId: emp.empA });
      await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      const r = await get("hr", "/hr/tasks?awaitingApproval=true&limit=100");
      expect(dataOf<Task[]>(r).map((t) => t.id)).toContain(task.id);
      expect(
        dataOf<Task[]>(r).every((t) => t.status === "DONE" && !t.adminApproved),
      ).toBe(true);
    });

    it("q matches the title or the assignee's name", async () => {
      const task = await mkAdminTask("hr", {
        title: "Zebra inventory count",
        assigneeId: emp.empA,
      });
      const r = await get("hr", "/hr/tasks?q=zebra&limit=100");
      expect(dataOf<Task[]>(r).map((t) => t.id)).toContain(task.id);
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit and database invariants", () => {
    it("writes an audit row for create, approve, reassign and status change, without free text", async () => {
      const task = await mkAdminTask("hr", {
        assigneeId: emp.empA,
        description: "SECRET-FREE-TEXT-MARKER",
      });
      await patch("hr", `/hr/tasks/${task.id}`, {
        assigneeId: emp.empB,
      }).expect(200);
      await post("hr", `/hr/tasks/${task.id}/status`, {
        status: "DONE",
      }).expect(200);
      await post("hr", `/hr/tasks/${task.id}/approve`).expect(200);

      const rows = await prisma.auditLog.findMany({
        where: { entityType: "task", entityId: task.id },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => r.action)).toEqual([
        "create",
        "reassign",
        "status_change",
        "approve",
      ]);
      for (const row of rows) {
        expect(JSON.stringify(row.after ?? {})).not.toContain(
          "SECRET-FREE-TEXT-MARKER",
        );
        expect(JSON.stringify(row.before ?? {})).not.toContain(
          "SECRET-FREE-TEXT-MARKER",
        );
      }
    });

    it("the database refuses an unknown status, a blank title, and an approval that is not DONE", async () => {
      const base = {
        organizationId: orgA.id,
        assigneeId: need(emp, "empA"),
        assignedByUserId: need(userIds, "hr"),
        dueDate: new Date("2099-01-01T00:00:00Z"),
      };
      await expect(
        prisma.task.create({ data: { ...base, title: "x", status: "BOGUS" } }),
      ).rejects.toThrow();
      await expect(
        prisma.task.create({ data: { ...base, title: "   " } }),
      ).rejects.toThrow();
      await expect(
        prisma.task.create({
          data: {
            ...base,
            title: "approved but open",
            status: "PENDING",
            adminApproved: true,
            approvedByUserId: need(userIds, "hr"),
            approvedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
  });
});
