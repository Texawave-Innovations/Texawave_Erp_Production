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
 * Work logs: employee self-submission (JWT-resolved employee), own/team/all
 * read scope, approval by the reporting manager only, final decisions, org
 * isolation and audit. Edit and delete are NOT implemented (none in legacy)
 * and are asserted absent.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface WorkLog {
  id: number;
  employee: { id: number };
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: { id: number } | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

const PERMS = [
  "employee_self_service.work_log.create",
  "employee_self_service.work_log.read",
  "hr.work_log.read.own",
  "hr.work_log.read.team",
  "hr.work_log.read.all",
  "hr.work_log.approve",
];

describe("HR work logs (e2e)", () => {
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

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;
  const list = <T>(r: request.Response) => (r.body as Body<T[]>).data;

  const submit = (who: string, body: object) =>
    post(who, "/self-service/work-logs", body);
  const mkLog = async (who: string, over: Record<string, unknown> = {}) =>
    (
      (
        await submit(who, {
          workDate: "2026-10-05",
          hoursWorked: 7.5,
          taskDescription: "Fixed the payroll report",
          ...over,
        }).expect(201)
      ).body as Body<WorkLog>
    ).data;
  const decide = (
    who: string,
    id: number,
    action: "approve" | "reject",
    body: object = {},
  ) =>
    post(
      who,
      `/hr/work-logs/${id}/${action}`,
      action === "reject" ? { note: "hours not supported", ...body } : body,
    );

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
      data: { name: `WL A ${suffix}`, slug: `wl-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `WL B ${suffix}`, slug: `wl-b-${suffix.toLowerCase()}` },
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
      "employee_self_service.work_log.create",
      "employee_self_service.work_log.read",
    ];
    // Manager: approves, sees team 1 only (team scope), owns employee M.
    const mgr = await mkUser(
      orgA,
      "mgr",
      [...selfService, "hr.work_log.read.team", "hr.work_log.approve"],
      { teamIds: [team1] },
    );
    // Plain employees, no approve or HR read.
    const empA = await mkUser(orgA, "empA", selfService);
    const empB = await mkUser(orgA, "empB", selfService);
    // HR with organization-wide read but no approve permission.
    await mkUser(orgA, "hr", ["hr.work_log.read.all"]);
    // Holds nothing relevant at all.
    await mkUser(orgA, "none", []);
    // Other organization: all-read, must still see nothing of org A.
    await mkUser(orgB, "outsider", ["hr.work_log.read.all"]);

    emp.mgr = await mkEmp(orgA.id, team1, 1, { userId: mgr.id });
    emp.empA = await mkEmp(orgA.id, team1, 2, {
      userId: empA.id,
      reportsToId: emp.mgr,
    });
    emp.empB = await mkEmp(orgA.id, team2, 3, { userId: empB.id });
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
    it("rejects unauthenticated access", async () => {
      await request(app.getHttpServer())
        .get("/self-service/work-logs")
        .expect(401);
    });

    it("denies submission without the self-service create permission", async () => {
      const r = await submit("none", {
        workDate: "2026-10-05",
        hoursWorked: 1,
        taskDescription: "Anything",
      });
      expect(r.status).toBe(403);
    });

    it("denies HR read without the read permission", async () => {
      expect((await get("empA", "/hr/work-logs")).status).toBe(403);
    });

    it("denies approval to an employee without hr.work_log.approve", async () => {
      const log = await mkLog("empB");
      expect((await decide("empB", log.id, "approve")).status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("self-submission", () => {
    it("creates a PENDING log for the caller's own employee", async () => {
      const log = await mkLog("empA", { hoursWorked: 6.25 });
      expect(log.status).toBe("PENDING");
      expect(log.employee.id).toBe(emp.empA);
      expect(log.hoursWorked).toBe(6.25);
      expect(log.workDate).toBe("2026-10-05");
      expect(log.decidedBy).toBeNull();
    });

    it("refuses an employeeId supplied by the client and writes nothing for that employee", async () => {
      const before = await prisma.workLog.count({
        where: { employeeId: emp.empB! },
      });
      const r = await submit("empA", {
        workDate: "2026-10-05",
        hoursWorked: 2,
        taskDescription: "Client tried another employee",
        employeeId: emp.empB,
      });
      expect(r.status).toBe(400);
      const after = await prisma.workLog.count({
        where: { employeeId: emp.empB! },
      });
      expect(after).toBe(before);
    });

    it.each([
      ["zero hours", { hoursWorked: 0 }],
      ["more than 24 hours", { hoursWorked: 25 }],
      ["negative hours", { hoursWorked: -1 }],
      ["a blank description", { taskDescription: "  " }],
      ["a malformed date", { workDate: "05/10/2026" }],
    ])("rejects %s", async (_label, over) => {
      const r = await submit("empA", {
        workDate: "2026-10-05",
        hoursWorked: 3,
        taskDescription: "Valid text",
        ...over,
      });
      expect(r.status).toBe(400);
    });

    it("exposes no edit or delete route", async () => {
      const log = await mkLog("empA");
      await request(app.getHttpServer())
        .patch(`/hr/work-logs/${log.id}`)
        .set(auth("mgr"))
        .send({ hoursWorked: 1 })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/hr/work-logs/${log.id}`)
        .set(auth("mgr"))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("reads and scope", () => {
    it("self list returns only the caller's own logs", async () => {
      const mine = list<WorkLog>(await get("empB", "/self-service/work-logs"));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((l) => l.employee.id === emp.empB)).toBe(true);
    });

    it("team-scoped HR read sees team 1 logs and not team 2", async () => {
      const teamLog = await mkLog("empA", {
        taskDescription: "Team one entry",
      });
      const otherLog = await mkLog("empB", {
        taskDescription: "Team two entry",
      });
      const rows = list<WorkLog>(await get("mgr", "/hr/work-logs?limit=100"));
      const ids = rows.map((l) => l.id);
      expect(ids).toContain(teamLog.id);
      expect(ids).not.toContain(otherLog.id);
      expect((await get("mgr", `/hr/work-logs/${otherLog.id}`)).status).toBe(
        404,
      );
    });

    it("all-scope HR read sees every log in its organization", async () => {
      const a = await mkLog("empA", { taskDescription: "Org-wide one" });
      const b = await mkLog("empB", { taskDescription: "Org-wide two" });
      const rows = list<WorkLog>(await get("hr", "/hr/work-logs?limit=100"));
      const ids = rows.map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    });

    it("another organization never sees these logs", async () => {
      const own = await mkLog("empA", { taskDescription: "Isolated entry" });
      const rows = list<WorkLog>(
        await get("outsider", "/hr/work-logs?limit=100"),
      );
      expect(rows.map((l) => l.id)).not.toContain(own.id);
      expect((await get("outsider", `/hr/work-logs/${own.id}`)).status).toBe(
        404,
      );
    });

    it("filters by status and date range", async () => {
      const r = await get(
        "hr",
        "/hr/work-logs?status=PENDING&from=2026-10-01&to=2026-10-31&limit=100",
      );
      expect(r.status).toBe(200);
      const rows = list<WorkLog>(r);
      expect(rows.every((l) => l.status === "PENDING")).toBe(true);
      expect(
        rows.every(
          (l) => l.workDate >= "2026-10-01" && l.workDate <= "2026-10-31",
        ),
      ).toBe(true);
    });

    it("orders deterministically: work date descending, then id descending", async () => {
      const rows = list<WorkLog>(await get("hr", "/hr/work-logs?limit=100"));
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]!;
        const cur = rows[i]!;
        expect(prev.workDate >= cur.workDate).toBe(true);
        if (prev.workDate === cur.workDate) expect(prev.id > cur.id).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe("approval by the reporting manager", () => {
    it("the approvals queue shows only the manager's direct reports, PENDING by default", async () => {
      const mine = await mkLog("empA", { taskDescription: "Queue entry" });
      const other = await mkLog("empB", { taskDescription: "Not my report" });
      const rows = list<WorkLog>(
        await get("mgr", "/hr/work-logs/approvals?limit=100"),
      );
      const ids = rows.map((l) => l.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(other.id);
      expect(rows.every((l) => l.status === "PENDING")).toBe(true);
    });

    it("approves a direct report's pending log and records the decision", async () => {
      const log = await mkLog("empA", { taskDescription: "Approve me" });
      const r = await decide("mgr", log.id, "approve", { note: "Looks right" });
      expect(r.status).toBe(200);
      const decided = (r.body as Body<WorkLog>).data;
      expect(decided.status).toBe("APPROVED");
      expect(decided.decidedBy).not.toBeNull();
      expect(decided.decidedAt).not.toBeNull();
      expect(decided.decisionNote).toBe("Looks right");
    });

    it("rejects a direct report's pending log with a note", async () => {
      const log = await mkLog("empA", { taskDescription: "Reject me" });
      const r = await decide("mgr", log.id, "reject", { note: "Wrong day" });
      expect(r.status).toBe(200);
      expect((r.body as Body<WorkLog>).data.status).toBe("REJECTED");
    });

    it("a manager cannot decide a log that is not from a direct report (404, not 403)", async () => {
      const log = await mkLog("empB", {
        taskDescription: "Not mine to decide",
      });
      expect((await decide("mgr", log.id, "approve")).status).toBe(404);
    });

    it("a decided log is final", async () => {
      const log = await mkLog("empA", { taskDescription: "Decide once" });
      expect((await decide("mgr", log.id, "approve")).status).toBe(200);
      const again = await decide("mgr", log.id, "reject", {
        note: "Changed mind",
      });
      expect(again.status).toBe(422);
      expect(errorOf(again)).toBeDefined();
    });

    it("writes an audit row for the decision", async () => {
      const log = await mkLog("empA", { taskDescription: "Audited decision" });
      await decide("mgr", log.id, "approve").expect(200);
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          entityType: "work_log",
          entityId: BigInt(log.id),
          action: "approve",
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(userIds.mgr);
    });
  });
});
