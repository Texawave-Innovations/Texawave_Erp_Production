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
 * Leave workflow (Docs/HR_LEAVE.md §2, §6): reporting-manager approval and
 * delegation, two-level approval (manager, then HR), the approval queue, HR
 * applying on someone's behalf, HR cancelling approved leave, the closed
 * attendance month, notifications, CSV export, the balance report, and bulk /
 * CSV entitlement administration — every route through its RBAC.
 */
interface Body<T> {
  data: T;
  meta?: { total: number };
}
interface Leave {
  id: number;
  employee: { id: number };
  status: string;
  approvalLevels: number;
  awaiting: "FIRST" | "HR" | null;
  requestedBy: { id: number };
  firstDecidedBy: { id: number } | null;
  decidedBy: { id: number } | null;
  cancelledBy: { id: number } | null;
}

const PERMS = [
  "hr.leave_request.read.own",
  "hr.leave_request.read.team",
  "hr.leave_request.read.all",
  "hr.leave.approve.own",
  "hr.leave.approve.team",
  "hr.leave.approve.all",
  "hr.leave_request.create.own",
  "hr.leave_request.create.team",
  "hr.leave_request.create.all",
  "hr.leave.cancel.own",
  "hr.leave.cancel.team",
  "hr.leave.cancel.all",
  "hr.leave_request.export.own",
  "hr.leave_request.export.team",
  "hr.leave_request.export.all",
  "hr.leave_type.write",
  "employee_self_service.leave_request.create",
  "employee_self_service.leave_request.read",
];
type UserKey =
  | "mgr"
  | "empA"
  | "empB"
  | "empC"
  | "deputy"
  | "noApprove"
  | "lead1"
  | "hr1"
  | "hr2"
  | "hrTeam1"
  | "ownOnly"
  | "hrB";
type EmpKey = "mgr" | "A" | "B" | "C" | "hr2" | "X";

const SELF = [
  "employee_self_service.leave_request.create",
  "employee_self_service.leave_request.read",
];

describe("HR leave workflow (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let org: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens = {} as Record<UserKey, string>;
  const userIds = {} as Record<UserKey, number>;
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let team1: number;
  let team2: number;
  let casual: number;
  let twoLevel: number;
  const emp = {} as Record<EmpKey, number>;
  const code = {} as Record<EmpKey, string>;

  const auth = (who: UserKey) => ({
    Authorization: `Bearer ${tokens[who]}`,
  });
  const get = (who: UserKey, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: UserKey, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const put = (who: UserKey, path: string, body: object = {}) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;
  const dataOf = <T>(r: request.Response) => (r.body as Body<T>).data;

  let yearCounter = 2300;
  const nextYear = () => String(++yearCounter);

  const submit = async (
    who: UserKey,
    leaveTypeId: number,
    start: string,
    end = start,
  ) =>
    dataOf<Leave>(
      await post(who, "/self-service/leave-requests", {
        leaveTypeId,
        startDate: start,
        endDate: end,
        reason: "family event",
      }).expect(201),
    );
  const approve = (who: UserKey, id: number) =>
    post(who, `/hr/leave-requests/${id}/approve`, {});
  const status = async (id: number) =>
    (await prisma.leaveRequest.findUniqueOrThrow({ where: { id } })).status;

  async function mkUser(
    o: { id: number; slug: string },
    key: UserKey,
    codes: string[],
    teamIds: number[] = [],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: o.id, name: `role-${key}-${suffix}` },
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
        organizationId: o.id,
        email: `${key}@${o.slug}.test`,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    for (const teamId of teamIds) {
      await prisma.userTeamAccess.create({
        data: { organizationId: o.id, userId: user.id, teamId },
      });
    }
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: o.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = dataOf<{ accessToken: string }>(login).accessToken;
    userIds[key] = user.id;
    return user;
  }

  async function mkEmp(
    o: { id: number },
    key: EmpKey,
    teamId: number,
    over: Record<string, unknown> = {},
  ) {
    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: o.id, code: "GEN" } },
      update: {},
      create: { organizationId: o.id, code: "GEN", name: "General" },
    });
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: o.id, code: "PERM" } },
      update: {},
      create: { organizationId: o.id, code: "PERM", name: "Permanent" },
    });
    code[key] = `EMP-8${String(Object.keys(code).length).padStart(5, "0")}`;
    emp[key] = (
      await prisma.employee.create({
        data: {
          organizationId: o.id,
          employeeCode: code[key],
          fullName: `Emp ${key}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          ...over,
        },
      })
    ).id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    org = await prisma.organization.create({
      data: { name: `Wf ${suffix}`, slug: `wf-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Wf B ${suffix}`, slug: `wf-b-${suffix.toLowerCase()}` },
    });
    for (const c of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code: c },
        update: {},
        create: { code: c, description: c },
      });
      perm.set(c, p.id);
    }
    team1 = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T1", code: `W1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T2", code: `W2${suffix}` },
      })
    ).id;
    const teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `WB${suffix}` },
      })
    ).id;
    casual = (
      await prisma.leaveType.create({
        data: {
          organizationId: org.id,
          code: "CASUAL",
          name: "Casual",
          annualEntitlement: 366,
          carryForwardLimit: 366,
        },
      })
    ).id;
    twoLevel = (
      await prisma.leaveType.create({
        data: {
          organizationId: org.id,
          code: "LONG",
          name: "Long leave",
          annualEntitlement: 366,
          carryForwardLimit: 366,
          approvalLevels: 2,
        },
      })
    ).id;

    // Reporting line: mgr (a manager with only approve.own) ← empA, empB.
    const mgr = await mkUser(org, "mgr", [...SELF, "hr.leave.approve.own"]);
    const a = await mkUser(org, "empA", SELF);
    const b = await mkUser(org, "empB", SELF);
    const c = await mkUser(org, "empC", SELF); // team2, no manager
    await mkUser(org, "deputy", ["hr.leave.approve.own"]);
    await mkUser(org, "noApprove", []);
    await mkUser(org, "lead1", ["hr.leave.approve.team"], [team1]);
    await mkUser(org, "hr1", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.leave_request.create.all",
      "hr.leave.cancel.all",
      "hr.leave_request.export.all",
      "hr.leave_type.write",
    ]);
    const hr2 = await mkUser(org, "hr2", [
      ...SELF,
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.leave_request.create.all",
      "hr.leave.cancel.all",
    ]);
    await mkUser(
      org,
      "hrTeam1",
      [
        "hr.leave_request.read.team",
        "hr.leave_request.create.team",
        "hr.leave.cancel.team",
        "hr.leave_request.export.team",
      ],
      [team1],
    );
    await mkUser(org, "ownOnly", [
      "hr.leave_request.create.own",
      "hr.leave.cancel.own",
    ]);
    await mkUser(orgB, "hrB", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.leave.cancel.all",
      "hr.leave_request.create.all",
    ]);

    await mkEmp(org, "mgr", team1, { userId: mgr.id });
    await mkEmp(org, "A", team1, { userId: a.id, reportsToId: emp.mgr });
    await mkEmp(org, "B", team1, { userId: b.id, reportsToId: emp.mgr });
    await mkEmp(org, "C", team2, { userId: c.id });
    await mkEmp(org, "hr2", team2, { userId: hr2.id });
    await mkEmp(orgB, "X", teamB);
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
  describe("reporting-manager approval", () => {
    it("the manager (approve.own) decides a direct report's leave", async () => {
      const l = await submit("empA", casual, `${nextYear()}-01-05`);
      expect(l.awaiting).toBe("FIRST");
      const r = await approve("mgr", l.id).expect(200);
      expect(dataOf<Leave>(r)).toMatchObject({
        status: "APPROVED",
        decidedBy: { id: userIds.mgr },
      });
    });

    it("approve.own grants nothing over someone who does not report to you (403); no approve permission at all is 403", async () => {
      const l = await submit("empC", casual, `${nextYear()}-01-05`);
      await approve("mgr", l.id).expect(403);
      await approve("noApprove", l.id).expect(403);
      expect(await status(l.id)).toBe("PENDING");
    });

    it("a team approver still decides within scope; another organization never sees the request", async () => {
      const l = await submit("empB", casual, `${nextYear()}-01-05`);
      await approve("hrB", l.id).expect(404);
      await approve("lead1", l.id).expect(200);
    });

    it("the approval queue lists what waits for the caller, never their own requests", async () => {
      const year = nextYear();
      const a = await submit("empA", casual, `${year}-01-05`);
      const c = await submit("empC", casual, `${year}-01-05`);
      const mine = await submit("mgr", casual, `${year}-01-05`);
      const ids = (who: UserKey) =>
        get(who, "/hr/leave-requests/approvals?limit=100")
          .expect(200)
          .then((r) => dataOf<Leave[]>(r).map((l) => l.id));
      const forMgr = await ids("mgr");
      expect(forMgr).toContain(a.id);
      expect(forMgr).not.toContain(c.id);
      expect(forMgr).not.toContain(mine.id);
      const forLead = await ids("lead1");
      expect(forLead).toEqual(expect.arrayContaining([a.id, mine.id]));
      expect(forLead).not.toContain(c.id);
      await get("noApprove", "/hr/leave-requests/approvals").expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("two-level approval", () => {
    it("manager first, then a different HR approver; the request stays PENDING in between", async () => {
      const l = await submit("empA", twoLevel, `${nextYear()}-02-02`);
      expect(l.approvalLevels).toBe(2);
      const first = dataOf<Leave>(await approve("mgr", l.id).expect(200));
      expect(first).toMatchObject({
        status: "PENDING",
        awaiting: "HR",
        firstDecidedBy: { id: userIds.mgr },
        decidedBy: null,
      });
      expect(errorOf(await approve("mgr", l.id).expect(403))).toBe(
        "LEAVE_AWAITING_HR",
      );
      expect(errorOf(await approve("lead1", l.id).expect(403))).toBe(
        "LEAVE_AWAITING_HR",
      );
      const queue = dataOf<Leave[]>(
        await get("hr1", "/hr/leave-requests/approvals?limit=100").expect(200),
      );
      expect(queue.map((q) => q.id)).toContain(l.id);
      const done = dataOf<Leave>(await approve("hr1", l.id).expect(200));
      expect(done).toMatchObject({
        status: "APPROVED",
        awaiting: null,
        decidedBy: { id: userIds.hr1 },
      });
    });

    it("the same HR approver cannot give both approvals", async () => {
      const l = await submit("empC", twoLevel, `${nextYear()}-02-02`);
      await approve("hr1", l.id).expect(200);
      expect(errorOf(await approve("hr1", l.id).expect(403))).toBe(
        "LEAVE_SAME_APPROVER",
      );
      await approve("hr2", l.id).expect(200);
      expect(await status(l.id)).toBe("APPROVED");
    });

    it("a rejection at the HR stage is final", async () => {
      const l = await submit("empA", twoLevel, `${nextYear()}-02-02`);
      await approve("mgr", l.id).expect(200);
      await post("hr1", `/hr/leave-requests/${l.id}/reject`, {
        note: "peak season",
      }).expect(200);
      expect(await status(l.id)).toBe("REJECTED");
    });

    it("the database refuses one person as both approvers and a change of levels outside resubmission", async () => {
      const l = await submit("empB", twoLevel, `${nextYear()}-02-02`);
      await expect(
        prisma.leaveRequest.update({
          where: { id: l.id },
          data: {
            firstDecidedBy: userIds.hr1,
            firstDecidedAt: new Date(),
            status: "APPROVED",
            decidedBy: userIds.hr1,
            decidedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/two_approvers/);
      await expect(
        prisma.leaveRequest.update({
          where: { id: l.id },
          data: { approvalLevels: 1 },
        }),
      ).rejects.toThrow(/approval levels change only on resubmission/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("delegation", () => {
    it("a delegate decides the delegator's direct reports while the delegation is active, and not after revocation", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const created = await post("mgr", "/hr/leave-delegations", {
        delegateUserId: userIds.deputy,
        startDate: today,
        endDate: today,
        reason: "On leave",
      }).expect(201);
      const delegation = dataOf<{ id: number }>(created);
      const notified = await prisma.notification.findFirst({
        where: { userId: userIds.deputy, type: "leave.delegation_created" },
      });
      expect(notified).not.toBeNull();

      const year = nextYear();
      const l1 = await submit("empA", casual, `${year}-03-02`);
      expect(
        dataOf<Leave[]>(
          await get("deputy", "/hr/leave-requests/approvals").expect(200),
        ).map((l) => l.id),
      ).toContain(l1.id);
      await approve("deputy", l1.id).expect(200);

      const l2 = await submit("empB", casual, `${year}-03-03`);
      await post(
        "deputy",
        `/hr/leave-delegations/${delegation.id}/revoke`,
      ).expect(404);
      await post("mgr", `/hr/leave-delegations/${delegation.id}/revoke`).expect(
        200,
      );
      await approve("deputy", l2.id).expect(403);
    });

    it("refuses a delegate who cannot approve, yourself, and an overlapping delegation", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const make = (delegateUserId: number) =>
        post("mgr", "/hr/leave-delegations", {
          delegateUserId,
          startDate: today,
          endDate: today,
        });
      expect(errorOf(await make(userIds.noApprove).expect(422))).toBe(
        "DELEGATE_CANNOT_APPROVE",
      );
      expect(errorOf(await make(userIds.mgr).expect(422))).toBe(
        "INVALID_DELEGATE",
      );
      const first = dataOf<{ id: number }>(
        await make(userIds.deputy).expect(201),
      );
      expect(errorOf(await make(userIds.lead1).expect(409))).toBe(
        "LEAVE_DELEGATION_OVERLAP",
      );
      await post("mgr", `/hr/leave-delegations/${first.id}/revoke`).expect(200);
      await post("noApprove", "/hr/leave-delegations", {}).expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("HR applies on an employee's behalf", () => {
    it("creates a PENDING request for someone in scope, recorded as requested by HR, who then cannot approve it", async () => {
      const r = await post("hr1", "/hr/leave-requests", {
        employeeId: emp.A,
        leaveTypeId: casual,
        startDate: `${nextYear()}-04-06`,
        endDate: `${yearCounter}-04-07`,
        reason: "called in sick",
      }).expect(201);
      const l = dataOf<Leave>(r);
      expect(l).toMatchObject({
        status: "PENDING",
        employee: { id: emp.A },
        requestedBy: { id: userIds.hr1 },
      });
      expect(errorOf(await approve("hr1", l.id).expect(403))).toBe(
        "SELF_APPROVAL_FORBIDDEN",
      );
      const forEmployee = await prisma.notification.findFirst({
        where: { userId: userIds.empA, type: "leave.submitted_on_behalf" },
      });
      expect(forEmployee).not.toBeNull();
      const forManager = await prisma.notification.findFirst({
        where: { userId: userIds.mgr, type: "leave.submitted" },
      });
      expect(forManager).not.toBeNull();
      await approve("mgr", l.id).expect(200);
    });

    it("scope, .own and one's own record", async () => {
      const body = (employeeId: number) => ({
        employeeId,
        leaveTypeId: casual,
        startDate: `${nextYear()}-04-06`,
        endDate: `${yearCounter}-04-06`,
        reason: "called in sick",
      });
      await post("hrTeam1", "/hr/leave-requests", body(emp.B)).expect(201);
      await post("hrTeam1", "/hr/leave-requests", body(emp.C)).expect(404);
      await post("ownOnly", "/hr/leave-requests", body(emp.B)).expect(403);
      await post("noApprove", "/hr/leave-requests", body(emp.B)).expect(403);
      await post("hrB", "/hr/leave-requests", body(emp.B)).expect(404);
      expect(
        errorOf(
          await post("hr2", "/hr/leave-requests", body(emp.hr2)).expect(403),
        ),
      ).toBe("LEAVE_OWN_VIA_SELF_SERVICE");
    });

    it("applies the same validation as self-service", async () => {
      await post("hr1", "/hr/leave-requests", {
        employeeId: emp.A,
        leaveTypeId: casual,
        startDate: "2025-12-01",
        endDate: "2025-12-01",
        reason: "before joining",
      }).expect(422);
    });
  });

  // ---------------------------------------------------------------------------
  describe("HR cancels leave", () => {
    it("cancels approved leave that has already started, with a reason, and tells the employee", async () => {
      const l = await submit("empA", casual, "2026-02-02", "2026-02-04");
      await approve("mgr", l.id).expect(200);
      // The employee cannot withdraw it once started…
      await post("empA", `/self-service/leave-requests/${l.id}/cancel`, {
        note: "came back early",
      }).expect(422);
      await post("hr1", `/hr/leave-requests/${l.id}/cancel`, {}).expect(400);
      const r = await post("hr1", `/hr/leave-requests/${l.id}/cancel`, {
        note: "came back to work",
      }).expect(200);
      expect(dataOf<Leave>(r)).toMatchObject({
        status: "CANCELLED",
        cancelledBy: { id: userIds.hr1 },
      });
      expect(
        await prisma.notification.findFirst({
          where: { userId: userIds.empA, type: "leave.cancelled_by_hr" },
        }),
      ).not.toBeNull();
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "leave_request",
          entityId: l.id,
          action: "cancel_by_hr",
        },
      });
      expect(audit).not.toBeNull();
    });

    it("scope, .own, one's own request and final states", async () => {
      const year = nextYear();
      const b = await submit("empB", casual, `${year}-05-04`);
      const c = await submit("empC", casual, `${year}-05-04`);
      const own = await submit("hr2", casual, `${year}-05-04`);
      const note = { note: "no longer needed" };
      await post("hrTeam1", `/hr/leave-requests/${c.id}/cancel`, note).expect(
        404,
      );
      await post("ownOnly", `/hr/leave-requests/${b.id}/cancel`, note).expect(
        403,
      );
      await post("hrB", `/hr/leave-requests/${b.id}/cancel`, note).expect(404);
      expect(
        errorOf(
          await post("hr2", `/hr/leave-requests/${own.id}/cancel`, note).expect(
            403,
          ),
        ),
      ).toBe("LEAVE_OWN_VIA_SELF_SERVICE");
      await post("hrTeam1", `/hr/leave-requests/${b.id}/cancel`, note).expect(
        200,
      );
      expect(
        errorOf(
          await post(
            "hrTeam1",
            `/hr/leave-requests/${b.id}/cancel`,
            note,
          ).expect(422),
        ),
      ).toBe("INVALID_STATE_TRANSITION");
    });
  });

  // ---------------------------------------------------------------------------
  describe("closed attendance month", () => {
    it("refuses approving, or cancelling approved, leave in a submitted month; rejecting is still allowed", async () => {
      const approved = await submit("empB", casual, "2026-03-09");
      await approve("mgr", approved.id).expect(200);
      const pending = await submit("empB", casual, "2026-03-10");
      const pending2 = await submit("empB", casual, "2026-03-11");
      await prisma.attendanceMonthLock.create({
        data: {
          organizationId: org.id,
          employeeId: emp.B,
          month: new Date("2026-03-01T00:00:00Z"),
          status: "SUBMITTED",
          summary: {},
          submittedBy: userIds.hr1,
          submittedAt: new Date(),
        },
      });
      expect(errorOf(await approve("mgr", pending.id).expect(409))).toBe(
        "ATTENDANCE_MONTH_LOCKED",
      );
      expect(await status(pending.id)).toBe("PENDING");
      expect(
        errorOf(
          await post("hr1", `/hr/leave-requests/${approved.id}/cancel`, {
            note: "mistake",
          }).expect(409),
        ),
      ).toBe("ATTENDANCE_MONTH_LOCKED");
      expect(await status(approved.id)).toBe("APPROVED");
      await post("mgr", `/hr/leave-requests/${pending2.id}/reject`, {
        note: "month is closed",
      }).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe("notifications", () => {
    it("the manager hears about a new request and the employee about the decision", async () => {
      const l = await submit("empB", casual, `${nextYear()}-06-01`);
      const toManager = await prisma.notification.findMany({
        where: { userId: userIds.mgr, type: "leave.submitted" },
      });
      expect(toManager.some((n) => n.body.includes(code.B))).toBe(true);
      await approve("mgr", l.id).expect(200);
      const toEmployee = await prisma.notification.findMany({
        where: { userId: userIds.empB, type: "leave.approved" },
      });
      expect(toEmployee.length).toBeGreaterThan(0);
      // Nobody is told about their own action.
      expect(
        await prisma.notification.count({
          where: { userId: userIds.mgr, type: "leave.approved" },
        }),
      ).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("export and balance report", () => {
    it("exports CSV within the export scope only", async () => {
      const all = await get("hr1", "/hr/leave-requests/export").expect(200);
      expect(all.headers["content-type"]).toMatch(/text\/csv/);
      expect(all.text).toContain("Employee Code,Employee,Leave Type");
      expect(all.text).toContain(code.C);
      const team = await get("hrTeam1", "/hr/leave-requests/export").expect(
        200,
      );
      expect(team.text).toContain(code.A);
      expect(team.text).not.toContain(code.C);
      await get("lead1", "/hr/leave-requests/export").expect(403);
    });

    it("reports balances for a page of employees in scope, marking custom allotments", async () => {
      await put("hr1", `/hr/leave-entitlements/${emp.A}/${casual}/2026`, {
        annualEntitlement: 12,
      }).expect(200);
      const r = await get(
        "hrTeam1",
        "/hr/leave-requests/balances/report?year=2026&limit=100",
      ).expect(200);
      const rows = dataOf<
        {
          employee: { id: number };
          balances: {
            leaveTypeId: number;
            isOverride: boolean;
            entitlement: number;
          }[];
        }[]
      >(r);
      const ids = rows.map((x) => x.employee.id);
      expect(ids).toEqual(expect.arrayContaining([emp.A, emp.B]));
      expect(ids).not.toContain(emp.C);
      const a = rows.find((x) => x.employee.id === emp.A);
      expect(a?.balances.find((b) => b.leaveTypeId === casual)).toMatchObject({
        isOverride: true,
        entitlement: 12,
      });
      const csv = await get(
        "hr1",
        "/hr/leave-requests/balances/export?year=2026",
      ).expect(200);
      expect(csv.text).toContain("Allotment");
      expect(csv.text).toContain(
        `${code.A},Emp A,2026,CASUAL,Casual,Yes,Custom`,
      );
      await get("noApprove", "/hr/leave-requests/balances/report").expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("bulk and CSV entitlements", () => {
    it("sets many at once, all or none", async () => {
      const ok = await put("hr1", "/hr/leave-entitlements", {
        items: [
          {
            employeeId: emp.B,
            leaveTypeId: casual,
            year: 2031,
            annualEntitlement: 8,
          },
          {
            employeeId: emp.C,
            leaveTypeId: casual,
            year: 2031,
            annualEntitlement: 9,
          },
        ],
      }).expect(200);
      expect(dataOf<{ updated: number }>(ok).updated).toBe(2);
      await put("hr1", "/hr/leave-entitlements", {
        items: [
          {
            employeeId: emp.B,
            leaveTypeId: casual,
            year: 2032,
            annualEntitlement: 8,
          },
          {
            employeeId: emp.X,
            leaveTypeId: casual,
            year: 2032,
            annualEntitlement: 9,
          },
        ],
      }).expect(422);
      expect(
        await prisma.leaveEntitlement.count({
          where: { employeeId: emp.B, year: 2032 },
        }),
      ).toBe(0);
      await put("hrTeam1", "/hr/leave-entitlements", {
        items: [
          {
            employeeId: emp.B,
            leaveTypeId: casual,
            year: 2033,
            annualEntitlement: 1,
          },
        ],
      }).expect(403);
    });

    it("imports a CSV: dry run, any bad row saves nothing, then a clean file is saved", async () => {
      const upload = (csv: string, dryRun = false) =>
        request(app.getHttpServer())
          .post(`/hr/leave-entitlements/import${dryRun ? "?dryRun=true" : ""}`)
          .set(auth("hr1"))
          .attach("file", Buffer.from(csv, "utf8"), "allotment.csv");
      const header = "Employee Code,Leave Type Code,Year,Annual Entitlement";
      const bad = await upload(
        `${header}\n${code.A},CASUAL,2034,10\nNOPE,CASUAL,2034,3\n`,
      ).expect(200);
      expect(
        dataOf<{ imported: number; errors: { row: number }[] }>(bad),
      ).toMatchObject({
        imported: 0,
        errors: [{ row: 3 }],
      });
      const dry = await upload(
        `${header}\n${code.A},CASUAL,2034,10\n`,
        true,
      ).expect(200);
      expect(
        dataOf<{ validRows: number; imported: number }>(dry),
      ).toMatchObject({
        validRows: 1,
        imported: 0,
      });
      expect(
        await prisma.leaveEntitlement.count({
          where: { employeeId: emp.A, year: 2034 },
        }),
      ).toBe(0);
      const good = await upload(
        `${header}\n${code.A},casual,2034,10\n${code.B},CASUAL,2034,\n`,
      ).expect(200);
      expect(dataOf<{ imported: number }>(good).imported).toBe(2);
      const row = await prisma.leaveEntitlement.findFirstOrThrow({
        where: { employeeId: emp.A, year: 2034 },
      });
      expect(row.annualEntitlement.toNumber()).toBe(10);
      await request(app.getHttpServer())
        .post("/hr/leave-entitlements/import")
        .set(auth("hrTeam1"))
        .attach("file", Buffer.from(header, "utf8"), "a.csv")
        .expect(403);
    });
  });
});
