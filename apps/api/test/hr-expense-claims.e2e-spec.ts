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
 * Expense claims: employee self-submission (JWT-resolved employee), own/team/all
 * read scope, team/all decision scope, self-approval refused, final decisions,
 * org isolation and audit. Edit, cancel and resubmit are NOT implemented (none
 * in legacy) and are asserted absent.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface Claim {
  id: number;
  employee: { id: number };
  expenseType: string;
  amount: number;
  expenseDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: { id: number } | null;
  decisionNote: string | null;
}

const PERMS = [
  "employee_self_service.expense_claim.create",
  "employee_self_service.expense_claim.read",
  "hr.expense_claim.read.own",
  "hr.expense_claim.read.team",
  "hr.expense_claim.read.all",
  "hr.expense_claim.decide.own",
  "hr.expense_claim.decide.team",
  "hr.expense_claim.decide.all",
];

const SELF_SERVICE = [
  "employee_self_service.expense_claim.create",
  "employee_self_service.expense_claim.read",
];

describe("HR expense claims (e2e)", () => {
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

  const claimBody = (over: Record<string, unknown> = {}) => ({
    expenseType: "Travel",
    amount: 1250.5,
    expenseDate: "2026-10-05",
    description: "Cab to client site",
    ...over,
  });
  const submit = (who: string, over: Record<string, unknown> = {}) =>
    post(who, "/self-service/expense-claims", claimBody(over));
  const mkClaim = async (who: string, over: Record<string, unknown> = {}) =>
    ((await submit(who, over).expect(201)).body as Body<Claim>).data;
  const decide = (
    who: string,
    id: number,
    decision: "APPROVED" | "REJECTED",
    note?: string,
  ) => post(who, `/hr/expense-claims/${id}/decision`, { decision, note });

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
      data: { name: `EC A ${suffix}`, slug: `ec-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `EC B ${suffix}`, slug: `ec-b-${suffix.toLowerCase()}` },
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

    // HR approver for team 1: decides and reads team 1 only.
    const hrTeam = await mkUser(
      orgA,
      "hrteam",
      [
        ...SELF_SERVICE,
        "hr.expense_claim.read.team",
        "hr.expense_claim.decide.team",
      ],
      { teamIds: [team1] },
    );
    // Plain employees.
    const empA = await mkUser(orgA, "empA", SELF_SERVICE);
    const empB = await mkUser(orgA, "empB", SELF_SERVICE);
    // HR who is also an employee in team 1 (self-approval case).
    const hrSelf = await mkUser(
      orgA,
      "hrself",
      [
        ...SELF_SERVICE,
        "hr.expense_claim.read.team",
        "hr.expense_claim.decide.team",
      ],
      { teamIds: [team1] },
    );
    // Holds decide.own only: must be refused on decision.
    await mkUser(orgA, "ownonly", [
      "hr.expense_claim.read.own",
      "hr.expense_claim.decide.own",
    ]);
    // Plain employee with no decision rights.
    await mkUser(orgA, "none", SELF_SERVICE);
    // Other organization: all-read and all-decide, must still see nothing of org A.
    const outsider = await mkUser(orgB, "outsider", [
      "hr.expense_claim.read.all",
      "hr.expense_claim.decide.all",
    ]);

    emp.hrTeam = await mkEmp(orgA.id, team1, 1, { userId: hrTeam.id });
    emp.empA = await mkEmp(orgA.id, team1, 2, { userId: empA.id });
    emp.empB = await mkEmp(orgA.id, team2, 3, { userId: empB.id });
    emp.hrSelf = await mkEmp(orgA.id, team1, 4, { userId: hrSelf.id });
    // Outsider is a real employee of org B, so the decision reaches the repository.
    emp.other = await mkEmp(orgB.id, teamB, 5, { userId: outsider.id });
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
        .get("/self-service/expense-claims")
        .expect(401);
    });

    it("an employee without decide rights gets 403 on the decision route", async () => {
      const claim = await mkClaim("empA");
      expect((await decide("none", claim.id, "APPROVED")).status).toBe(403);
    });

    it("own-level decide holder is refused with 403 DECISION_SCOPE_REQUIRED", async () => {
      const claim = await mkClaim("empA");
      const r = await decide("ownonly", claim.id, "APPROVED");
      expect(r.status).toBe(403);
      expect(errorOf(r)).toBeDefined();
    });
  });

  describe("employee self-service", () => {
    it("refuses a client-supplied employeeId (the employee comes from the JWT)", async () => {
      const r = await submit("empA", { employeeId: emp.empB });
      expect(r.status).toBe(400);
    });

    it("creates a claim for the caller starting PENDING", async () => {
      const r = await submit("empA");
      expect(r.status).toBe(201);
      const claim = (r.body as Body<Claim>).data;
      expect(claim.status).toBe("PENDING");
      expect(claim.employee.id).toBe(emp.empA);
      expect(claim.amount).toBe(1250.5);
      expect(claim.decidedBy).toBeNull();
    });

    it.each([
      ["zero amount", { amount: 0 }],
      ["negative amount", { amount: -10 }],
      ["three decimals", { amount: 10.123 }],
      ["unknown category", { expenseType: "Fuel" }],
      ["blank description", { description: "   " }],
      ["future date", { expenseDate: "2999-01-01" }],
    ])("rejects %s", async (_label, over) => {
      const r = await submit("empA", over);
      expect([400, 422]).toContain(r.status);
    });

    it("lists only the caller's own claims", async () => {
      await mkClaim("empB", { description: "Empb only" });
      const r = await get("empA", "/self-service/expense-claims?limit=100");
      expect(r.status).toBe(200);
      const rows = list<Claim>(r);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((c) => c.employee.id === emp.empA)).toBe(true);
    });

    it("gets own claim; another employee's claim is 404, not 403", async () => {
      const mine = await mkClaim("empA");
      expect(
        (await get("empA", `/self-service/expense-claims/${mine.id}`)).status,
      ).toBe(200);
      const theirs = await mkClaim("empB");
      const r = await get("empA", `/self-service/expense-claims/${theirs.id}`);
      expect(r.status).toBe(404);
    });

    it("has no edit, cancel or resubmit routes", async () => {
      const claim = await mkClaim("empA");
      await request(app.getHttpServer())
        .patch(`/self-service/expense-claims/${claim.id}`)
        .set(auth("empA"))
        .send({ amount: 5 })
        .expect(404);
      await post(
        "empA",
        `/self-service/expense-claims/${claim.id}/cancel`,
      ).expect(404);
    });
  });

  describe("HR scope and decision", () => {
    it("team HR sees team 1 claims and not team 2", async () => {
      const inTeam = await mkClaim("empA", { description: "Team one claim" });
      const outTeam = await mkClaim("empB", { description: "Team two claim" });
      expect(
        (await get("hrteam", `/hr/expense-claims/${inTeam.id}`)).status,
      ).toBe(200);
      expect(
        (await get("hrteam", `/hr/expense-claims/${outTeam.id}`)).status,
      ).toBe(404);
    });

    it("approves a PENDING claim in scope and writes an audit row", async () => {
      const claim = await mkClaim("empA", { description: "To approve" });
      const r = await decide("hrteam", claim.id, "APPROVED", "Looks right");
      expect(r.status).toBe(200);
      const decided = (r.body as Body<Claim>).data;
      expect(decided.status).toBe("APPROVED");
      expect(decided.decidedBy?.id).toBe(userIds.hrteam);
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          entityType: "expense_claim",
          entityId: BigInt(claim.id),
          action: "approve",
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(userIds.hrteam);
    });

    it("rejects a PENDING claim", async () => {
      const claim = await mkClaim("empA", { description: "To reject" });
      const r = await decide("hrteam", claim.id, "REJECTED", "Missing bill");
      expect(r.status).toBe(200);
      expect((r.body as Body<Claim>).data.status).toBe("REJECTED");
    });

    it("a decided claim is final: approve-after-reject and reject-after-approve are refused", async () => {
      const claim = await mkClaim("empA", { description: "Decide once" });
      expect((await decide("hrteam", claim.id, "APPROVED")).status).toBe(200);
      expect((await decide("hrteam", claim.id, "REJECTED")).status).toBe(422);
      expect((await decide("hrteam", claim.id, "APPROVED")).status).toBe(422);
    });

    it("refuses self-approval with 403 SELF_APPROVAL_FORBIDDEN", async () => {
      const own = await mkClaim("hrself", { description: "My own claim" });
      const r = await decide("hrself", own.id, "APPROVED");
      expect(r.status).toBe(403);
      expect(errorOf(r)).toBeDefined();
      const still = await prisma.expenseClaim.findUnique({
        where: { id: own.id },
      });
      expect(still?.status).toBe("PENDING");
    });

    it("a claim outside the decision scope is 404 on decision", async () => {
      const outTeam = await mkClaim("empB", {
        description: "Other team decide",
      });
      expect((await decide("hrteam", outTeam.id, "APPROVED")).status).toBe(404);
    });

    it("writes an audit row on create", async () => {
      const claim = await mkClaim("empA", { description: "Audited create" });
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          entityType: "expense_claim",
          entityId: BigInt(claim.id),
          action: "create",
        },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("organization isolation", () => {
    it("another organization's HR cannot read or decide org A claims (404)", async () => {
      const claim = await mkClaim("empA", { description: "Org A only" });
      expect(
        (await get("outsider", `/hr/expense-claims/${claim.id}`)).status,
      ).toBe(404);
      expect((await decide("outsider", claim.id, "APPROVED")).status).toBe(404);
      const still = await prisma.expenseClaim.findUnique({
        where: { id: claim.id },
      });
      expect(still?.status).toBe("PENDING");
    });
  });
});
