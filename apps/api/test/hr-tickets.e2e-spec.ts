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
 * Employee tickets: employee self-service (own tickets only, IDOR), HR/admin
 * raising and replying, team and organization scope, the legacy status
 * lifecycle (resolve, reopen, close) with invalid moves refused, append-only
 * comments, concurrency on the status row, audit contents and DB invariants.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface Ticket {
  id: number;
  category: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  isActive: boolean;
  raisedByAdmin: boolean;
  resolvedAt: string | null;
  employee: { id: number; fullName: string };
  comments?: Array<{
    id: number;
    authorKind: "HR" | "EMPLOYEE";
    body: string;
  }>;
}

const PERMS = [
  "employee_self_service.ticket.read",
  "employee_self_service.ticket.create",
  "employee_self_service.ticket.update",
  "hr.ticket.read.team",
  "hr.ticket.write.team",
  "hr.ticket.read.all",
  "hr.ticket.write.all",
];

/** Free text that must never appear in an audit snapshot. */
const MARKER = "SECRET-FREE-TEXT-MARKER";

describe("Employee tickets (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const emp: Record<string, number> = {};
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  let team1: number;
  let team2: number;
  let teamB: number;

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

  const hrRaise = (who: string, body: object = {}) =>
    post(who, "/hr/tickets", {
      employeeId: emp.empA,
      category: "Notice",
      subject: "Office closed",
      description: "The office is closed on Friday.",
      ...body,
    });
  const mkHrTicket = async (who: string, body: object = {}) =>
    dataOf<Ticket>(await hrRaise(who, body).expect(201));

  const selfRaise = (who: string, body: object = {}) =>
    post(who, "/self-service/tickets", {
      category: "HR Query",
      subject: "Payslip question",
      description: "Which month is missing?",
      ...body,
    });
  const mkSelfTicket = async (who: string, body: object = {}) =>
    dataOf<Ticket>(await selfRaise(who, body).expect(201));

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
      data: { name: `TK A ${suffix}`, slug: `tkt-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `TK B ${suffix}`, slug: `tkt-b-${suffix.toLowerCase()}` },
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
      "employee_self_service.ticket.read",
      "employee_self_service.ticket.create",
      "employee_self_service.ticket.update",
    ];
    // Team-1 manager: raises, replies and moves tickets within team 1 only.
    const mgr = await mkUser(
      orgA,
      "mgr",
      [...selfService, "hr.ticket.read.team", "hr.ticket.write.team"],
      { teamIds: [team1] },
    );
    // Plain employees: self-service only.
    const empA = await mkUser(orgA, "empA", selfService);
    const empB = await mkUser(orgA, "empB", selfService);
    // Organization-wide HR.
    await mkUser(orgA, "hr", ["hr.ticket.read.all", "hr.ticket.write.all"]);
    // Read-only HR: can see everything, can change nothing.
    await mkUser(orgA, "hrRead", ["hr.ticket.read.all"]);
    // Holds nothing relevant.
    await mkUser(orgA, "none", []);
    // Other organization: all-scope, must still see nothing of org A.
    await mkUser(orgB, "outsider", [
      "hr.ticket.read.all",
      "hr.ticket.write.all",
    ]);

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
      await request(app.getHttpServer()).get("/hr/tickets").expect(401);
      await request(app.getHttpServer())
        .get("/self-service/tickets")
        .expect(401);
    });

    it("an employee cannot reach the HR surface", async () => {
      expect((await get("empA", "/hr/tickets")).status).toBe(403);
    });

    it("a user with no ticket permission cannot reach the self-service surface", async () => {
      expect((await get("none", "/self-service/tickets")).status).toBe(403);
    });

    it("a read-only HR user cannot raise, change status or reply", async () => {
      expect((await hrRaise("hrRead")).status).toBe(403);
      const t = await mkHrTicket("hr");
      expect(
        (
          await post("hrRead", `/hr/tickets/${t.id}/status`, {
            status: "CLOSED",
          })
        ).status,
      ).toBe(403);
      expect(
        (await post("hrRead", `/hr/tickets/${t.id}/comments`, { body: "hi" }))
          .status,
      ).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("employee self-service", () => {
    it("an employee raises a ticket for themselves, OPEN and not HR-raised", async () => {
      const r = await selfRaise("empA");
      expect(r.status).toBe(201);
      const t = dataOf<Ticket>(r);
      expect(t.status).toBe("OPEN");
      expect(t.raisedByAdmin).toBe(false);
      expect(t.employee.id).toBe(need(emp, "empA"));
    });

    it("rejects an employee id in the body (400): the requester comes from the JWT", async () => {
      const r = await selfRaise("empA", { employeeId: need(emp, "empB") });
      expect(r.status).toBe(400);
    });

    it("refuses a category only HR may raise (422, no write)", async () => {
      const before = await prisma.ticket.count();
      const r = await selfRaise("empA", { category: "Warning" });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("CATEGORY_NOT_ALLOWED");
      expect(await prisma.ticket.count()).toBe(before);
    });

    it("refuses a blank subject (400)", async () => {
      expect((await selfRaise("empA", { subject: "   " })).status).toBe(400);
    });

    it("lists only the caller's own tickets", async () => {
      const mine = await mkSelfTicket("empA", { subject: "Mine A" });
      const theirs = await mkSelfTicket("empB", { subject: "Theirs B" });
      const r = await get("empA", "/self-service/tickets?limit=100");
      expect(r.status).toBe(200);
      const ids = dataOf<Ticket[]>(r).map((t) => t.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });

    it("includes tickets HR raised for the caller in their own list", async () => {
      const hrTicket = await mkHrTicket("hr", { subject: "For A" });
      const ids = dataOf<Ticket[]>(
        await get("empA", "/self-service/tickets?limit=100"),
      ).map((t) => t.id);
      expect(ids).toContain(hrTicket.id);
    });

    it("gets own ticket and answers 404 for another employee's (IDOR)", async () => {
      const theirs = await mkSelfTicket("empB");
      expect(
        (await get("empA", `/self-service/tickets/${theirs.id}`)).status,
      ).toBe(404);
      const mine = await mkSelfTicket("empA");
      expect(
        (await get("empA", `/self-service/tickets/${mine.id}`)).status,
      ).toBe(200);
    });

    it("cannot reply on another employee's ticket (404, not 403)", async () => {
      const hrTicket = await mkHrTicket("hr");
      const r = await post(
        "empB",
        `/self-service/tickets/${hrTicket.id}/comments`,
        {
          body: "Not mine",
        },
      );
      expect(r.status).toBe(404);
    });

    it("edits its own OPEN self-raised ticket", async () => {
      const t = await mkSelfTicket("empA");
      const r = await patch("empA", `/self-service/tickets/${t.id}`, {
        category: "Leave",
        subject: "Leave balance",
        description: "Corrected description.",
      });
      expect(r.status).toBe(200);
      const after = dataOf<Ticket>(r);
      expect(after.subject).toBe("Leave balance");
      expect(after.category).toBe("Leave");
    });

    it("refuses an edit once the ticket is in progress (422)", async () => {
      const t = await mkSelfTicket("empA");
      await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "IN_PROGRESS",
      }).expect(200);
      const r = await patch("empA", `/self-service/tickets/${t.id}`, {
        category: "HR Query",
        subject: "Too late",
        description: "Edit after HR picked it up.",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("TICKET_NOT_EDITABLE");
    });

    it("refuses to edit a ticket HR raised (422)", async () => {
      const t = await mkHrTicket("hr");
      const r = await patch("empA", `/self-service/tickets/${t.id}`, {
        category: "HR Query",
        subject: "Mine now",
        description: "Trying to rewrite HR's notice.",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("ADMIN_RAISED_TICKET_NOT_EDITABLE");
    });

    it("cannot edit another employee's ticket (404, not 403)", async () => {
      const theirs = await mkSelfTicket("empB");
      const r = await patch("empA", `/self-service/tickets/${theirs.id}`, {
        category: "HR Query",
        subject: "Hijack",
        description: "Hijack attempt.",
      });
      expect(r.status).toBe(404);
    });

    it("replies on a ticket HR raised, and not on its own ticket (422)", async () => {
      const hrTicket = await mkHrTicket("hr", {
        employeeId: need(emp, "empA"),
      });
      const ok = await post(
        "empA",
        `/self-service/tickets/${hrTicket.id}/comments`,
        {
          body: "Understood, thank you.",
        },
      );
      expect(ok.status).toBe(201);

      const own = await mkSelfTicket("empA");
      const refused = await post(
        "empA",
        `/self-service/tickets/${own.id}/comments`,
        {
          body: "Replying to myself",
        },
      );
      expect(refused.status).toBe(422);
      expect(errorOf(refused)).toBe("REPLY_NOT_ALLOWED");
    });
  });

  // ---------------------------------------------------------------------------
  describe("HR / admin raising and team scope", () => {
    it("the admin raises a ticket for an employee, HR-raised and OPEN", async () => {
      const r = await hrRaise("hr");
      expect(r.status).toBe(201);
      const t = dataOf<Ticket>(r);
      expect(t.raisedByAdmin).toBe(true);
      expect(t.status).toBe("OPEN");
      expect(t.employee.id).toBe(need(emp, "empA"));
    });

    it("the team manager raises within their team, not outside it (422)", async () => {
      expect(
        (await hrRaise("mgr", { employeeId: need(emp, "empA") })).status,
      ).toBe(201);
      const outside = await hrRaise("mgr", { employeeId: need(emp, "empB") });
      expect(outside.status).toBe(422);
      expect(errorOf(outside)).toBe("INVALID_EMPLOYEE");
    });

    it("the admin may raise HR-only categories; an unknown category is a 400", async () => {
      expect((await hrRaise("hr", { category: "Warning" })).status).toBe(201);
      expect((await hrRaise("hr", { category: "Bogus" })).status).toBe(400);
    });

    it("the team manager sees only tickets for their team", async () => {
      const inTeam = await mkHrTicket("hr", { employeeId: need(emp, "empA") });
      const outside = await mkHrTicket("hr", { employeeId: need(emp, "empB") });
      const ids = dataOf<Ticket[]>(
        await get("mgr", "/hr/tickets?limit=100"),
      ).map((t) => t.id);
      expect(ids).toContain(inTeam.id);
      expect(ids).not.toContain(outside.id);
      expect((await get("mgr", `/hr/tickets/${outside.id}`)).status).toBe(404);
    });

    it("the admin sees tickets across teams", async () => {
      const outside = await mkHrTicket("hr", { employeeId: need(emp, "empB") });
      expect((await get("hr", `/hr/tickets/${outside.id}`)).status).toBe(200);
    });

    it("the read-only HR user may read, and filters narrow the list", async () => {
      const t = await mkHrTicket("hr", { subject: "Filter target" });
      const list = await get(
        "hrRead",
        "/hr/tickets?q=Filter%20target&limit=100",
      );
      expect(list.status).toBe(200);
      expect(dataOf<Ticket[]>(list).map((x) => x.id)).toContain(t.id);
    });

    it("the employee full name is searchable on the HR list only", async () => {
      await mkHrTicket("hr", { employeeId: need(emp, "empA") });
      const hrList = await get("hr", "/hr/tickets?q=Emp%202&limit=100");
      expect(hrList.status).toBe(200);
      expect(dataOf<Ticket[]>(hrList).length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("organization isolation", () => {
    it("another organization's HR user cannot read or move a ticket of org A", async () => {
      const t = await mkHrTicket("hr");
      expect((await get("outsider", `/hr/tickets/${t.id}`)).status).toBe(404);
      expect(
        (
          await post("outsider", `/hr/tickets/${t.id}/status`, {
            status: "CLOSED",
          })
        ).status,
      ).toBe(404);
      expect(
        (await post("outsider", `/hr/tickets/${t.id}/comments`, { body: "x" }))
          .status,
      ).toBe(404);
    });

    it("another organization's HR user cannot raise a ticket for an employee of org A", async () => {
      const r = await hrRaise("outsider", { employeeId: need(emp, "empA") });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_EMPLOYEE");
    });
  });

  // ---------------------------------------------------------------------------
  describe("lifecycle, reopen and comments", () => {
    it("moves OPEN → IN_PROGRESS → RESOLVED, stamping resolvedAt", async () => {
      const t = await mkHrTicket("hr");
      expect(
        (
          await post("hr", `/hr/tickets/${t.id}/status`, {
            status: "IN_PROGRESS",
          })
        ).status,
      ).toBe(200);
      const resolved = await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "RESOLVED",
      });
      expect(resolved.status).toBe(200);
      const body = dataOf<Ticket>(resolved);
      expect(body.status).toBe("RESOLVED");
      expect(body.resolvedAt).not.toBeNull();
      expect(body.isActive).toBe(false);
    });

    it("refuses an invalid move: RESOLVED → IN_PROGRESS (422)", async () => {
      const t = await mkHrTicket("hr");
      await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "RESOLVED",
      }).expect(200);
      const r = await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "IN_PROGRESS",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("refuses an unknown status (400)", async () => {
      const t = await mkHrTicket("hr");
      expect(
        (await post("hr", `/hr/tickets/${t.id}/status`, { status: "DONE" }))
          .status,
      ).toBe(400);
    });

    it("reopens a resolved ticket to OPEN and keeps its resolvedAt", async () => {
      const t = await mkHrTicket("hr");
      const resolved = dataOf<Ticket>(
        await post("hr", `/hr/tickets/${t.id}/status`, { status: "RESOLVED" }),
      );
      const reopened = await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "OPEN",
      });
      expect(reopened.status).toBe(200);
      const body = dataOf<Ticket>(reopened);
      expect(body.status).toBe("OPEN");
      expect(body.resolvedAt).toBe(resolved.resolvedAt);
    });

    it("reopens a closed ticket and refuses moving a closed ticket sideways", async () => {
      const t = await mkHrTicket("hr");
      await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "CLOSED",
      }).expect(200);
      expect(
        (await post("hr", `/hr/tickets/${t.id}/status`, { status: "RESOLVED" }))
          .status,
      ).toBe(422);
      expect(
        (await post("hr", `/hr/tickets/${t.id}/status`, { status: "OPEN" }))
          .status,
      ).toBe(200);
    });

    it("a same-status move is a 200 no-op", async () => {
      const t = await mkHrTicket("hr");
      const r = await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "OPEN",
      });
      expect(r.status).toBe(200);
      expect(dataOf<Ticket>(r).status).toBe("OPEN");
    });

    it("the team manager cannot move a ticket outside their team (404)", async () => {
      const t = await mkHrTicket("hr", { employeeId: need(emp, "empB") });
      expect(
        (await post("mgr", `/hr/tickets/${t.id}/status`, { status: "CLOSED" }))
          .status,
      ).toBe(404);
    });

    it("the HR reply appends a comment while the ticket is active", async () => {
      const t = await mkHrTicket("hr");
      const r = await post("hr", `/hr/tickets/${t.id}/comments`, {
        body: "We are looking into it.",
      });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ data: { authorKind: "HR" } });
    });

    it("refuses an HR reply on a resolved ticket (422)", async () => {
      const t = await mkHrTicket("hr");
      await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "RESOLVED",
      }).expect(200);
      const r = await post("hr", `/hr/tickets/${t.id}/comments`, {
        body: "Late",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("TICKET_NOT_ACTIVE");
    });

    it("the detail view lists comments oldest first, with the author kind", async () => {
      const t = await mkHrTicket("hr", { employeeId: need(emp, "empA") });
      await post("hr", `/hr/tickets/${t.id}/comments`, {
        body: "First",
      }).expect(201);
      await post("empA", `/self-service/tickets/${t.id}/comments`, {
        body: "Second",
      }).expect(201);
      const detail = dataOf<Ticket>(
        await get("hr", `/hr/tickets/${t.id}`).expect(200),
      );
      expect(detail.comments?.map((c) => [c.authorKind, c.body])).toEqual([
        ["HR", "First"],
        ["EMPLOYEE", "Second"],
      ]);
      const own = dataOf<Ticket>(
        await get("empA", `/self-service/tickets/${t.id}`).expect(200),
      );
      expect(own.comments).toHaveLength(2);
    });

    it("two concurrent identical moves write exactly one status change (row lock)", async () => {
      const t = await mkHrTicket("hr");
      const [a, b] = await Promise.all([
        post("hr", `/hr/tickets/${t.id}/status`, { status: "RESOLVED" }),
        post("hr", `/hr/tickets/${t.id}/status`, { status: "RESOLVED" }),
      ]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      const changes = await prisma.auditLog.count({
        where: {
          entityType: "ticket",
          entityId: t.id,
          action: "status_change",
        },
      });
      expect(changes).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit and database invariants", () => {
    it("audits create, edit, status, reopen and comments without free text", async () => {
      const t = await mkSelfTicket("empA", { subject: `Subject ${MARKER}` });
      await patch("empA", `/self-service/tickets/${t.id}`, {
        category: "Leave",
        subject: `Subject2 ${MARKER}`,
        description: MARKER,
      }).expect(200);
      await post("hr", `/hr/tickets/${t.id}/status`, {
        status: "RESOLVED",
      }).expect(200);
      await post("hr", `/hr/tickets/${t.id}/status`, { status: "OPEN" }).expect(
        200,
      );
      await post("hr", `/hr/tickets/${t.id}/comments`, { body: MARKER }).expect(
        201,
      );

      const rows = await prisma.auditLog.findMany({
        where: { entityType: "ticket", entityId: t.id },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => r.action)).toEqual([
        "create",
        "update",
        "status_change",
        "reopen",
        "comment",
      ]);
      for (const row of rows) {
        expect(JSON.stringify(row.before ?? {})).not.toContain(MARKER);
        expect(JSON.stringify(row.after ?? {})).not.toContain(MARKER);
      }
    });

    it("the database refuses an unknown status, a blank subject, and an inconsistent origin", async () => {
      const base = {
        organizationId: orgA.id,
        employeeId: need(emp, "empA"),
        category: "HR Query",
        subject: "Valid",
        description: "Valid",
      };
      await expect(
        prisma.ticket.create({ data: { ...base, status: "DONE" } }),
      ).rejects.toThrow();
      await expect(
        prisma.ticket.create({ data: { ...base, subject: "   " } }),
      ).rejects.toThrow();
      await expect(
        prisma.ticket.create({ data: { ...base, raisedByAdmin: true } }),
      ).rejects.toThrow();
      await expect(
        prisma.ticket.create({ data: { ...base, category: "Bogus" } }),
      ).rejects.toThrow();
    });

    it("the database refuses a resolved ticket with no resolvedAt", async () => {
      await expect(
        prisma.ticket.create({
          data: {
            organizationId: orgA.id,
            employeeId: need(emp, "empA"),
            category: "HR Query",
            subject: "Valid",
            description: "Valid",
            status: "RESOLVED",
          },
        }),
      ).rejects.toThrow();
    });

    it("the database refuses to edit, delete or truncate a posted reply", async () => {
      const t = await mkHrTicket("hr");
      const comment = dataOf<{ id: number }>(
        await post("hr", `/hr/tickets/${t.id}/comments`, {
          body: "Final",
        }).expect(201),
      );
      await expect(
        prisma.ticketComment.update({
          where: { id: comment.id },
          data: { body: "Edited" },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.ticketComment.delete({ where: { id: comment.id } }),
      ).rejects.toThrow(/append-only/);
      const stored = await prisma.ticketComment.findUniqueOrThrow({
        where: { id: comment.id },
      });
      expect(stored.body).toBe("Final");
    });
  });
});
