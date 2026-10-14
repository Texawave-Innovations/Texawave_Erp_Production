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
 * Exit requests: employee self-submission (JWT-resolved employee), one active
 * request per employee (legacy hasActiveRequest), own/team/all read scope,
 * team/all decision scope, self-decision refused, the transition map, final
 * states, concurrent-decision safety, organization isolation and audit. Approval
 * and completion do NOT change the employee record (decision E2). Cancel,
 * withdraw and resubmit-while-active are NOT implemented (none in legacy) and
 * are asserted absent.
 *
 * Every scenario that needs its own request gets its own employee, so the
 * one-active-request rule never leaks between tests.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface ExitRequest {
  id: number;
  employee: { id: number };
  status: string;
  noticePeriodDays: number;
  confirmedLastWorkingDate: string | null;
  settlementStatus: string | null;
  hrNote: string | null;
  decidedBy: { id: number } | null;
}

const PERMS = [
  "employee_self_service.exit_request.create",
  "employee_self_service.exit_request.read",
  "hr.exit_request.read.own",
  "hr.exit_request.read.team",
  "hr.exit_request.read.all",
  "hr.exit_request.decide.own",
  "hr.exit_request.decide.team",
  "hr.exit_request.decide.all",
];

const SELF_SERVICE = [
  "employee_self_service.exit_request.create",
  "employee_self_service.exit_request.read",
];

const PAST = "2000-01-01";
const FUTURE = "2999-12-31";

describe("HR exit requests (e2e)", () => {
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
  let seq = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;
  const rowsOf = (r: request.Response) => (r.body as Body<ExitRequest[]>).data;

  const requestBody = (over: Record<string, unknown> = {}) => ({
    reason: "Relocating to another city",
    preferredLastWorkingDate: FUTURE,
    ...over,
  });
  const submit = (who: string, over: Record<string, unknown> = {}) =>
    post(who, "/self-service/exit-requests", requestBody(over));
  const mkRequest = async (who: string, over: Record<string, unknown> = {}) =>
    ((await submit(who, over).expect(201)).body as Body<ExitRequest>).data;
  const review = (id: number, body: object, who = "hrteam") =>
    patch(who, `/hr/exit-requests/${id}`, body);
  /** The id of the caller's most recent request. */
  const myLatestId = async (who: string) =>
    rowsOf(await get(who, "/self-service/exit-requests?limit=100"))[0]!.id;

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
    seq += 1;
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: `Exit Emp ${seq}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          ...over,
        },
      })
    ).id;
  };

  /** A new employee with their own login in team 1, keyed by `prefix`. Returns
   * the key to use with `submit`/`mkRequest`. */
  async function employeeKey(prefix: string, teamId = team1): Promise<string> {
    const key = `${prefix}${suffix.toLowerCase()}`;
    await mkUser(orgA, key, SELF_SERVICE);
    await mkEmp(orgA.id, teamId, { userId: userIds[key] });
    return key;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    orgA = await prisma.organization.create({
      data: { name: `EX A ${suffix}`, slug: `ex-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `EX B ${suffix}`, slug: `ex-b-${suffix.toLowerCase()}` },
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
        data: { organizationId: orgA.id, name: "T1", code: `XT1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "T2", code: `XT2${suffix}` },
      })
    ).id;
    teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `XTB${suffix}` },
      })
    ).id;

    // HR approver for team 1: reads and decides team 1 only.
    const hrTeam = await mkUser(
      orgA,
      "hrteam",
      [
        ...SELF_SERVICE,
        "hr.exit_request.read.team",
        "hr.exit_request.decide.team",
      ],
      { teamIds: [team1] },
    );
    // Plain employee in team 2 (outside hrteam's scope).
    await mkUser(orgA, "empB", SELF_SERVICE);
    // Plain employee in team 1, with one request kept active across tests.
    await mkUser(orgA, "empA", SELF_SERVICE);
    // HR who is also an employee in team 1 (self-decision case).
    await mkUser(
      orgA,
      "hrself",
      [
        ...SELF_SERVICE,
        "hr.exit_request.read.team",
        "hr.exit_request.decide.team",
      ],
      { teamIds: [team1] },
    );
    // Holds decide.own only: refused on any decision.
    await mkUser(orgA, "ownonly", [
      "hr.exit_request.read.own",
      "hr.exit_request.decide.own",
    ]);
    // Plain employee with no decision rights.
    await mkUser(orgA, "none", SELF_SERVICE);
    // Other organization: read.all and decide.all, must still see nothing of org A.
    const outsider = await mkUser(orgB, "outsider", [
      "hr.exit_request.read.all",
      "hr.exit_request.decide.all",
    ]);

    emp.hrTeam = await mkEmp(orgA.id, team1, { userId: hrTeam.id });
    emp.empA = await mkEmp(orgA.id, team1, { userId: userIds.empA });
    emp.empB = await mkEmp(orgA.id, team2, { userId: userIds.empB });
    emp.hrSelf = await mkEmp(orgA.id, team1, { userId: userIds.hrself });
    emp.other = await mkEmp(orgB.id, teamB, { userId: outsider.id });
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

  describe("authentication and permission", () => {
    it("rejects unauthenticated access", async () => {
      await request(app.getHttpServer())
        .get("/self-service/exit-requests")
        .expect(401);
    });

    it("an employee without decide rights gets 403 on the review route", async () => {
      const id = (await mkRequest(await employeeKey("perm"))).id;
      expect((await review(id, { hrNote: "x" }, "none")).status).toBe(403);
    });

    it("an own-level decide holder is refused with 403 DECISION_SCOPE_REQUIRED", async () => {
      const id = (await mkRequest(await employeeKey("ownlvl"))).id;
      const r = await review(id, { status: "UNDER_REVIEW" }, "ownonly");
      expect(r.status).toBe(403);
      expect(errorOf(r)).toBe("DECISION_SCOPE_REQUIRED");
    });
  });

  describe("employee self-service", () => {
    it("refuses a client-supplied employeeId (the employee comes from the JWT)", async () => {
      const r = await submit("empB", { employeeId: emp.empA });
      expect(r.status).toBe(400);
    });

    it("creates a request for the caller in SUBMITTED with the legacy 30-day default", async () => {
      const r = await submit("empA");
      expect(r.status).toBe(201);
      const row = (r.body as Body<ExitRequest>).data;
      expect(row.status).toBe("SUBMITTED");
      expect(row.employee.id).toBe(emp.empA);
      expect(row.noticePeriodDays).toBe(30);
      expect(row.decidedBy).toBeNull();
    });

    it("refuses a second request while the first is active (legacy hasActiveRequest)", async () => {
      const r = await submit("empA");
      expect(r.status).toBe(409);
      expect(errorOf(r)).toBe("ACTIVE_EXIT_REQUEST_EXISTS");
    });

    it.each([
      ["blank reason", { reason: "   " }, 400],
      ["negative notice period", { noticePeriodDays: -1 }, 400],
      ["an unknown field", { status: "APPROVED" }, 400],
      ["a past last working day", { preferredLastWorkingDate: PAST }, 422],
    ])("rejects %s", async (_label, over, status) => {
      const r = await submit("empB", over);
      expect(r.status).toBe(status);
    });

    it("accepts a caller-entered notice period as given", async () => {
      const r = await submit("empB", { noticePeriodDays: 60 });
      expect(r.status).toBe(201);
      expect((r.body as Body<ExitRequest>).data.noticePeriodDays).toBe(60);
    });

    it("lists only the caller's own requests", async () => {
      const r = await get("empB", "/self-service/exit-requests?limit=100");
      expect(r.status).toBe(200);
      const rows = rowsOf(r);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((x) => x.employee.id === emp.empB)).toBe(true);
    });

    it("gets own request; another employee's request is 404, not 403", async () => {
      const own = await myLatestId("empB");
      expect(
        (await get("empB", `/self-service/exit-requests/${own}`)).status,
      ).toBe(200);
      const theirs = await myLatestId("empA");
      expect(
        (await get("empB", `/self-service/exit-requests/${theirs}`)).status,
      ).toBe(404);
    });

    it("has no cancel, withdraw or resubmit route (none in legacy)", async () => {
      const id = await myLatestId("empA");
      for (const action of ["cancel", "withdraw", "resubmit"]) {
        const r = await post(
          "empA",
          `/self-service/exit-requests/${id}/${action}`,
        );
        expect(r.status).toBe(404);
      }
    });
  });

  describe("HR view (own · team · all)", () => {
    it("hrteam sees team 1 requests and gets 404 for a team 2 request", async () => {
      const r = await get("hrteam", "/hr/exit-requests?limit=100");
      expect(r.status).toBe(200);
      const rows = rowsOf(r);
      expect(rows.some((x) => x.employee.id === emp.empA)).toBe(true);
      expect(rows.some((x) => x.employee.id === emp.empB)).toBe(false);
      const teamTwoId = await myLatestId("empB");
      expect(
        (await get("hrteam", `/hr/exit-requests/${teamTwoId}`)).status,
      ).toBe(404);
    });

    it("another organization's HR sees and decides none of org A's requests (404)", async () => {
      const id = await myLatestId("empA");
      expect((await get("outsider", `/hr/exit-requests/${id}`)).status).toBe(
        404,
      );
      const rows = rowsOf(await get("outsider", "/hr/exit-requests?limit=100"));
      expect(rows.every((x) => x.employee.id === emp.other)).toBe(true);
      expect(
        (await review(id, { status: "UNDER_REVIEW" }, "outsider")).status,
      ).toBe(404);
    });

    it("filters by status", async () => {
      const r = await get(
        "hrteam",
        "/hr/exit-requests?status=SUBMITTED&limit=100",
      );
      expect(r.status).toBe(200);
      expect(rowsOf(r).every((x) => x.status === "SUBMITTED")).toBe(true);
    });
  });

  describe("review, decision and transitions", () => {
    it("runs the full path SUBMITTED → UNDER_REVIEW → APPROVED → COMPLETED", async () => {
      const key = await employeeKey("lifecycle");
      const id = (await mkRequest(key)).id;

      const under = await review(id, { status: "UNDER_REVIEW" });
      expect(under.status).toBe(200);
      expect((under.body as Body<ExitRequest>).data.status).toBe(
        "UNDER_REVIEW",
      );

      const approved = await review(id, {
        status: "APPROVED",
        confirmedLastWorkingDate: FUTURE,
        settlementStatus: "IN_PROGRESS",
        hrNote: "Approved, handover due",
      });
      expect(approved.status).toBe(200);
      const a = (approved.body as Body<ExitRequest>).data;
      expect(a.status).toBe("APPROVED");
      expect(a.decidedBy?.id).toBe(userIds.hrteam);
      expect(a.confirmedLastWorkingDate).toBe(FUTURE);
      expect(a.settlementStatus).toBe("IN_PROGRESS");

      const completed = await review(id, { status: "COMPLETED" });
      expect(completed.status).toBe(200);
      const c = (completed.body as Body<ExitRequest>).data;
      expect(c.status).toBe("COMPLETED");
      expect(c.decidedBy?.id).toBe(userIds.hrteam);
    });

    it("does not change the employee record on approval or completion (decision E2)", async () => {
      const key = await employeeKey("record");
      const employeeId = (
        await prisma.employee.findFirstOrThrow({
          where: { userId: userIds[key] as number },
          select: { id: true },
        })
      ).id;
      const before = await prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
      });
      const id = (await mkRequest(key)).id;
      await review(id, { status: "APPROVED" }).expect(200);
      await review(id, { status: "COMPLETED" }).expect(200);
      const after = await prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
      });
      expect(after.status).toBe(before.status);
      expect(after.status).toBe("ACTIVE");
    });

    it("refuses an invalid transition (SUBMITTED → COMPLETED)", async () => {
      const id = (await mkRequest(await employeeKey("invalid"))).id;
      const r = await review(id, { status: "COMPLETED" });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("refuses a second approval (naming the current status)", async () => {
      const id = (await mkRequest(await employeeKey("double"))).id;
      await review(id, { status: "APPROVED" }).expect(200);
      const r = await review(id, { status: "APPROVED" });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("a rejected request is final: no approval and no edit after rejection", async () => {
      const id = (await mkRequest(await employeeKey("rejected"))).id;
      const rej = await review(id, {
        status: "REJECTED",
        hrNote: "Not accepted",
      });
      expect(rej.status).toBe(200);
      expect((rej.body as Body<ExitRequest>).data.hrNote).toBe("Not accepted");
      const approve = await review(id, { status: "APPROVED" });
      expect(approve.status).toBe(422);
      expect(errorOf(approve)).toBe("INVALID_STATE_TRANSITION");
      expect((await review(id, { hrNote: "changed" })).status).toBe(422);
    });

    it("after a rejection the employee may submit a new request", async () => {
      const key = await employeeKey("resubmit");
      const id = (await mkRequest(key)).id;
      await review(id, { status: "REJECTED" }).expect(200);
      expect((await submit(key)).status).toBe(201);
    });

    it("field-only edits: an empty hrNote clears it; no status is sent", async () => {
      const id = (await mkRequest(await employeeKey("note"))).id;
      const set = await review(id, { hrNote: "Check handover" });
      expect(set.status).toBe(200);
      expect((set.body as Body<ExitRequest>).data.hrNote).toBe(
        "Check handover",
      );
      const cleared = await review(id, { hrNote: "" });
      expect(cleared.status).toBe(200);
      expect((cleared.body as Body<ExitRequest>).data.hrNote).toBeNull();
    });

    it("refuses an update that changes nothing", async () => {
      const id = (await mkRequest(await employeeKey("empty"))).id;
      const r = await review(id, {});
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("NO_CHANGES");
    });

    it("refuses a settlement status outside the legacy options", async () => {
      const id = (await mkRequest(await employeeKey("settle"))).id;
      expect((await review(id, { settlementStatus: "Paid" })).status).toBe(400);
    });

    it("refuses reviewing your own request, even as an HR approver", async () => {
      const id = (await mkRequest("hrself")).id;
      const r = await review(id, { status: "APPROVED" }, "hrself");
      expect(r.status).toBe(403);
      expect(errorOf(r)).toBe("SELF_DECISION_FORBIDDEN");
      const row = await prisma.exitRequest.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("SUBMITTED");
    });

    it("lets exactly one of two concurrent approvals win", async () => {
      const id = (await mkRequest(await employeeKey("race"))).id;
      const [a, b] = await Promise.all([
        review(id, { status: "APPROVED" }),
        review(id, { status: "APPROVED" }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
      const row = await prisma.exitRequest.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("APPROVED");
    });

    it("the database refuses a second active request for the same employee", async () => {
      // emp.empA already has an active request from the self-service tests.
      await expect(
        prisma.exitRequest.create({
          data: {
            organizationId: orgA.id,
            employeeId: emp.empA as number,
            reason: "Second active row",
            preferredLastWorkingDate: new Date(`${FUTURE}T00:00:00.000Z`),
            requestedBy: userIds.empA as number,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("database invariants (raw writes)", () => {
    it("refuses an approved status without a recorded decision", async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO hr.exit_requests (organization_id, employee_id, status, reason, preferred_last_working_date, requested_by, updated_at)
           VALUES ($1, $2, 'APPROVED', 'Raw', DATE '2999-12-31', $3, now())`,
          orgA.id,
          emp.empB,
          userIds.empB,
        ),
      ).rejects.toThrow();
    });

    it("refuses a negative notice period and a blank reason", async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO hr.exit_requests (organization_id, employee_id, status, reason, preferred_last_working_date, notice_period_days, requested_by, updated_at)
           VALUES ($1, $2, 'SUBMITTED', 'Raw', DATE '2999-12-31', -1, $3, now())`,
          orgA.id,
          emp.empB,
          userIds.empB,
        ),
      ).rejects.toThrow();
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO hr.exit_requests (organization_id, employee_id, status, reason, preferred_last_working_date, requested_by, updated_at)
           VALUES ($1, $2, 'SUBMITTED', '   ', DATE '2999-12-31', $3, now())`,
          orgA.id,
          emp.empB,
          userIds.empB,
        ),
      ).rejects.toThrow();
    });
  });

  describe("audit", () => {
    it("writes audit rows for create, review, approval and completion", async () => {
      const key = await employeeKey("audit");
      const id = (await mkRequest(key)).id;
      await review(id, { status: "UNDER_REVIEW" }).expect(200);
      await review(id, { status: "APPROVED" }).expect(200);
      await review(id, { status: "COMPLETED" }).expect(200);
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: "exit_request",
          entityId: BigInt(id),
        },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => r.action)).toEqual([
        "create",
        "review",
        "approve",
        "complete",
      ]);
      expect(rows[0]?.actorUserId).toBe(userIds[key]);
    });

    it("keeps the reason and HR note out of audit snapshots", async () => {
      const key = await employeeKey("privacy");
      const id = (await mkRequest(key, { reason: "Private family matter" })).id;
      await review(id, { hrNote: "Confidential note" }).expect(200);
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: "exit_request",
          entityId: BigInt(id),
        },
      });
      const text = JSON.stringify(rows, (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(text).not.toContain("Private family matter");
      expect(text).not.toContain("Confidential note");
    });
  });
});
