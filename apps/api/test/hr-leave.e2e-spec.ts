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
 * Leave: types (covered in master-data.e2e-spec) and requests — self-service
 * submission for the authenticated user's own employee, date validation,
 * overlap prevention, approve/reject with maker-checker, final decisions,
 * scope, isolation, immutability and audit. Balances, accrual, half-days and
 * cancellation are NOT implemented (unapproved) and are asserted absent.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}
interface Leave {
  id: number;
  employee: { id: number };
  leaveType: { id: number };
  startDate: string;
  endDate: string;
  calendarDays: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: { id: number } | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

const PERMS = [
  "hr.leave_request.read.own",
  "hr.leave_request.read.team",
  "hr.leave_request.read.all",
  "hr.leave.approve.own",
  "hr.leave.approve.team",
  "hr.leave.approve.all",
  "employee_self_service.leave_request.create",
  "employee_self_service.leave_request.read",
];

describe("HR leave requests (e2e)", () => {
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
  let casual: number;
  let sick: number;
  let inactiveType: number;
  let typeB: number;
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
    post(who, "/self-service/leave-requests", body);
  const mkLeave = async (who: string, over: Record<string, unknown> = {}) =>
    (
      (
        await submit(who, {
          leaveTypeId: casual,
          startDate: "2027-01-04",
          endDate: "2027-01-05",
          reason: "family event",
          ...over,
        }).expect(201)
      ).body as Body<Leave>
    ).data;
  const decide = (
    who: string,
    id: number,
    action: "approve" | "reject",
    body: object = {},
  ) =>
    post(
      who,
      `/hr/leave-requests/${id}/${action}`,
      action === "reject" ? { note: "not possible then", ...body } : body,
    );

  // Each test that needs a clean employee/date window uses its own year so
  // ranges never collide across tests (overlap prevention is a feature here).
  let yearCounter = 2100;
  const nextYear = () => String(++yearCounter);

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
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
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
          employeeCode: `EMP-7${String(n).padStart(5, "0")}`,
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
      data: { name: `Lv A ${suffix}`, slug: `lv-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Lv B ${suffix}`, slug: `lv-b-${suffix.toLowerCase()}` },
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
    const teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "TB", code: `TB${suffix}` },
      })
    ).id;
    casual = (
      await prisma.leaveType.create({
        data: { organizationId: orgA.id, code: "CASUAL", name: "Casual" },
      })
    ).id;
    sick = (
      await prisma.leaveType.create({
        data: { organizationId: orgA.id, code: "SICK", name: "Sick" },
      })
    ).id;
    inactiveType = (
      await prisma.leaveType.create({
        data: {
          organizationId: orgA.id,
          code: "OLD",
          name: "Retired",
          isActive: false,
        },
      })
    ).id;
    typeB = (
      await prisma.leaveType.create({
        data: { organizationId: orgB.id, code: "CASUAL", name: "Casual" },
      })
    ).id;

    const selfService = [
      "employee_self_service.leave_request.create",
      "employee_self_service.leave_request.read",
    ];
    const a = await mkUser(orgA, "empA", [
      ...selfService,
      "hr.leave_request.read.own",
    ]);
    const a2 = await mkUser(orgA, "empA2", selfService);
    const t2 = await mkUser(orgA, "empT2", selfService);
    const mgr = await mkUser(orgA, "hrApprover", [
      ...selfService,
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
    ]);
    const mgrEmployeeOnly = await mkUser(orgA, "empLeftUser", selfService);
    const inactiveUser = await mkUser(orgA, "empInactiveUser", selfService);
    await mkUser(orgA, "unlinked", selfService);
    await mkUser(orgA, "hrAll", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
    ]);
    await mkUser(orgA, "leadT1", ["hr.leave_request.read.team"], {
      teamIds: [team1],
    });
    await mkUser(
      orgA,
      "approverT1",
      ["hr.leave_request.read.team", "hr.leave.approve.team"],
      { teamIds: [team1] },
    );
    await mkUser(orgA, "ownApprover", [
      "hr.leave_request.read.own",
      "hr.leave.approve.own",
    ]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
    ]);
    const bUser = await mkUser(orgB, "empB", selfService);

    emp.A = await mkEmp(orgA.id, team1, 1, { userId: a.id });
    emp.A2 = await mkEmp(orgA.id, team1, 2, { userId: a2.id });
    emp.T2 = await mkEmp(orgA.id, team2, 3, { userId: t2.id });
    emp.mgr = await mkEmp(orgA.id, team1, 4, { userId: mgr.id });
    emp.left = await mkEmp(orgA.id, team1, 5, {
      userId: mgrEmployeeOnly.id,
      status: "RESIGNED",
      isActive: false,
      dateOfExit: new Date("2026-06-30T00:00:00Z"),
      exitReason: "left",
    });
    emp.inactive = await mkEmp(orgA.id, team1, 6, {
      userId: inactiveUser.id,
      status: "INACTIVE",
      isActive: false,
    });
    emp.B = await mkEmp(orgB.id, teamB, 1, { userId: bUser.id });
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
  describe("self-service submission", () => {
    it("401 unauthenticated; 403 without permission; 403 NOT_AN_EMPLOYEE for an unlinked login", async () => {
      await request(app.getHttpServer())
        .post("/self-service/leave-requests")
        .send({})
        .expect(401);
      await request(app.getHttpServer())
        .get("/self-service/leave-requests")
        .expect(401);
      await post("nobody", "/self-service/leave-requests", {}).expect(403);
      await get("nobody", "/self-service/leave-requests").expect(403);
      const res = await submit("unlinked", {
        leaveTypeId: casual,
        startDate: "2027-02-01",
        endDate: "2027-02-01",
        reason: "no record",
      }).expect(403);
      expect(errorOf(res)).toBe("NOT_AN_EMPLOYEE");
      expect(
        errorOf(
          await get("unlinked", "/self-service/leave-requests").expect(403),
        ),
      ).toBe("NOT_AN_EMPLOYEE");
    });

    it("submits for the AUTHENTICATED user's employee, starts PENDING, counts calendar days inclusively, and audits it", async () => {
      const l = await mkLeave("empA", {
        startDate: "2027-03-01",
        endDate: "2027-03-03",
        reason: "  wedding  ",
      });
      expect(l).toMatchObject({
        employee: { id: emp.A },
        leaveType: { id: casual },
        startDate: "2027-03-01",
        endDate: "2027-03-03",
        calendarDays: 3,
        reason: "wedding",
        status: "PENDING",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "leave_request",
          entityId: BigInt(l.id),
          action: "submit",
        },
      });
      expect(audit).toMatchObject({
        actorUserId: userIds.empA,
        organizationId: orgA.id,
      });
      expect(audit.after).toMatchObject({
        employeeId: emp.A,
        status: "PENDING",
      });
      // The free-text reason (possibly medical) is not copied into the trail.
      expect(JSON.stringify(audit.after)).not.toContain("wedding");
      expect(
        (await prisma.leaveRequest.findUniqueOrThrow({ where: { id: l.id } }))
          .requestedBy,
      ).toBe(userIds.empA);
    });

    it("a single-day request counts as 1 day", async () => {
      expect(
        (
          await mkLeave("empA", {
            startDate: "2027-04-01",
            endDate: "2027-04-01",
          })
        ).calendarDays,
      ).toBe(1);
    });

    it("the employee cannot be chosen: a forged employeeId is rejected and never used", async () => {
      await submit("empA", {
        leaveTypeId: casual,
        startDate: "2027-05-01",
        endDate: "2027-05-01",
        reason: "abc",
        employeeId: emp.A2,
      }).expect(400);
      await submit("empA", {
        leaveTypeId: casual,
        startDate: "2027-05-01",
        endDate: "2027-05-01",
        reason: "abc",
        requestedBy: 1,
      }).expect(400);
    });

    it.each([
      ["a missing leave type", { leaveTypeId: undefined }],
      ["a missing start date", { startDate: undefined }],
      ["a missing end date", { endDate: undefined }],
      ["a missing reason", { reason: undefined }],
      ["a too-short reason", { reason: "ab" }],
      ["a 501-character reason", { reason: "r".repeat(501) }],
      ["an impossible date", { startDate: "2027-02-30" }],
      ["a non-ISO date", { endDate: "01/05/2027" }],
      ["a non-numeric leave type", { leaveTypeId: "casual" }],
      ["a client-supplied status", { status: "APPROVED" }],
      ["a half-day flag (unapproved policy)", { halfDay: true }],
      ["a client-supplied organizationId", { organizationId: 9 }],
    ])("400 for %s", async (_l, over) => {
      await submit("empA", {
        leaveTypeId: casual,
        startDate: "2028-01-04",
        endDate: "2028-01-05",
        reason: "family event",
        ...over,
      }).expect(400);
    });

    it.each([
      [
        "an end before the start",
        () => ({ startDate: "2028-06-10", endDate: "2028-06-09" }),
        "LEAVE_DATES_INVALID",
      ],
      [
        "an unknown leave type",
        () => ({ leaveTypeId: 999999999 }),
        "INVALID_LEAVE_TYPE",
      ],
      [
        "an inactive leave type",
        () => ({ leaveTypeId: inactiveType }),
        "INVALID_LEAVE_TYPE",
      ],
      [
        "another organization's leave type",
        () => ({ leaveTypeId: typeB }),
        "INVALID_LEAVE_TYPE",
      ],
      [
        "a start before the date of joining",
        () => ({ startDate: "2025-12-31", endDate: "2026-01-02" }),
        "LEAVE_BEFORE_JOINING",
      ],
    ])("422 for %s", async (_l, over, code) => {
      expect(
        errorOf(
          await submit("empA", {
            leaveTypeId: casual,
            startDate: "2028-07-01",
            endDate: "2028-07-02",
            reason: "family event",
            ...over(),
          }).expect(422),
        ),
      ).toBe(code);
    });

    it("only an ACTIVE employee can request: a resigned or inactive employee is refused", async () => {
      expect(
        errorOf(
          await submit("empLeftUser", {
            leaveTypeId: casual,
            startDate: "2028-08-01",
            endDate: "2028-08-01",
            reason: "abc",
          }).expect(422),
        ),
      ).toBe("EMPLOYEE_NOT_ACTIVE");
      expect(
        errorOf(
          await submit("empInactiveUser", {
            leaveTypeId: casual,
            startDate: "2028-08-01",
            endDate: "2028-08-01",
            reason: "abc",
          }).expect(422),
        ),
      ).toBe("EMPLOYEE_NOT_ACTIVE");
    });

    it("has no balance, accrual, half-day, edit, cancel or delete surface (unapproved policy)", async () => {
      const l = await mkLeave("empA", {
        startDate: "2029-01-04",
        endDate: "2029-01-04",
      });
      await request(app.getHttpServer())
        .patch(`/self-service/leave-requests/${l.id}`)
        .set(auth("empA"))
        .send({ reason: "changed" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/self-service/leave-requests/${l.id}`)
        .set(auth("empA"))
        .expect(404);
      await post("empA", `/self-service/leave-requests/${l.id}/cancel`).expect(
        404,
      );
      await request(app.getHttpServer())
        .patch(`/hr/leave-requests/${l.id}`)
        .set(auth("hrAll"))
        .send({ reason: "x" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/hr/leave-requests/${l.id}`)
        .set(auth("hrAll"))
        .expect(404);
      await post("hrAll", `/hr/leave-requests/${l.id}/cancel`).expect(404);
      await get("empA", "/self-service/leave-balances").expect(404);
      await get("hrAll", "/hr/leave-balances").expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("overlap prevention", () => {
    it("refuses an overlapping request of the same employee with 409 naming the clash", async () => {
      const first = await mkLeave("empA2", {
        startDate: "2030-03-10",
        endDate: "2030-03-14",
      });
      const res = await submit("empA2", {
        leaveTypeId: sick,
        startDate: "2030-03-14",
        endDate: "2030-03-16",
        reason: "unwell",
      }).expect(409);
      expect(errorOf(res)).toBe("LEAVE_OVERLAP");
      expect((res.body as { message: string }).message).toContain(
        `#${first.id}`,
      );
      expect((res.body as { message: string }).message).toContain(
        "2030-03-10 to 2030-03-14",
      );
    });

    it("allows adjacent ranges, and other employees may take the same dates", async () => {
      await mkLeave("empA2", {
        startDate: "2030-03-15",
        endDate: "2030-03-16",
      }); // the day after 14th
      await mkLeave("empA", { startDate: "2030-03-10", endDate: "2030-03-14" });
      await mkLeave("empT2", {
        startDate: "2030-03-10",
        endDate: "2030-03-14",
      });
    });

    it("an APPROVED request still blocks; a REJECTED one does not", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-06-01`,
        endDate: `${y}-06-05`,
      });
      await decide("hrAll", l.id, "approve").expect(200);
      await submit("empA", {
        leaveTypeId: casual,
        startDate: `${y}-06-03`,
        endDate: `${y}-06-04`,
        reason: "again",
      }).expect(409);
      const r = await mkLeave("empA", {
        startDate: `${y}-07-01`,
        endDate: `${y}-07-05`,
      });
      await decide("hrAll", r.id, "reject").expect(200);
      await mkLeave("empA", { startDate: `${y}-07-01`, endDate: `${y}-07-05` }); // same dates again: allowed
    });

    it("of 8 simultaneous overlapping submissions exactly one wins, none is a 500", async () => {
      const y = nextYear();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          submit("empA", {
            leaveTypeId: casual,
            startDate: `${y}-09-01`,
            endDate: `${y}-09-05`,
            reason: "race",
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([
        201, 409, 409, 409, 409, 409, 409, 409,
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("listing and reading", () => {
    let mine: Leave;
    let other: Leave;
    let t2Leave: Leave;
    beforeAll(async () => {
      const y = nextYear();
      mine = await mkLeave("empA", {
        leaveTypeId: sick,
        startDate: `${y}-02-02`,
        endDate: `${y}-02-03`,
      });
      other = await mkLeave("empA2", {
        startDate: `${y}-02-02`,
        endDate: `${y}-02-03`,
      });
      t2Leave = await mkLeave("empT2", {
        startDate: `${y}-02-02`,
        endDate: `${y}-02-03`,
      });
      await mkLeave("empA", { startDate: `${y}-03-02`, endDate: `${y}-03-03` });
    });

    it("self-service lists only my own requests, with filters, sorting and pagination", async () => {
      const all = list<Leave>(
        await get("empA", "/self-service/leave-requests?limit=100").expect(200),
      );
      expect(all.length).toBeGreaterThan(0);
      expect(all.every((l) => l.employee.id === emp.A)).toBe(true);
      expect(all.map((l) => l.id)).not.toContain(other.id);
      const sickOnly = list<Leave>(
        await get(
          "empA",
          `/self-service/leave-requests?leaveTypeId=${sick}&limit=100`,
        ).expect(200),
      );
      expect(sickOnly.every((l) => l.leaveType.id === sick)).toBe(true);
      const pending = list<Leave>(
        await get(
          "empA",
          "/self-service/leave-requests?status=PENDING&limit=100",
        ).expect(200),
      );
      expect(pending.every((l) => l.status === "PENDING")).toBe(true);
      const asc = list<Leave>(
        await get(
          "empA",
          "/self-service/leave-requests?limit=100&order=asc",
        ).expect(200),
      ).map((l) => l.startDate);
      expect(asc).toEqual([...asc].sort());
      const page = (
        await get("empA", "/self-service/leave-requests?limit=2&page=1").expect(
          200,
        )
      ).body as Body<Leave[]>;
      expect(page.data).toHaveLength(2);
      expect(page.meta?.total).toBeGreaterThan(2);
    });

    it("self-service filters by date range (a request is included if its range touches it)", async () => {
      const y = mine.startDate.slice(0, 4);
      const inFeb = list<Leave>(
        await get(
          "empA",
          `/self-service/leave-requests?from=${y}-02-01&to=${y}-02-28&limit=100`,
        ).expect(200),
      );
      expect(inFeb.map((l) => l.id)).toEqual([mine.id]);
    });

    it("there is no way to list someone else's leave through self-service", async () => {
      // The platform's @Paginate ignores unknown query parameters rather than
      // rejecting them, so what matters is that this one has NO effect: the
      // employee is always the JWT's, whatever the query string says.
      const res = list<Leave>(
        await get(
          "empA",
          `/self-service/leave-requests?employeeId=${emp.A2}&limit=100`,
        ).expect(200),
      );
      expect(res.length).toBeGreaterThan(0);
      expect(res.every((l) => l.employee.id === emp.A)).toBe(true);
    });

    it.each([
      ["an unknown status", "status=DONE"],
      ["a bad date", "from=2026-13-01"],
      ["an unknown sort", "sortBy=reason"],
      ["limit above 100", "limit=101"],
    ])("400 for %s", async (_l, qs) => {
      await get("empA", `/self-service/leave-requests?${qs}`).expect(400);
      await get("hrAll", `/hr/leave-requests?${qs}`).expect(400);
    });

    it(".all sees every request of the organization (and filters by employee — the leave history) but none of another", async () => {
      const ids = list<Leave>(
        await get("hrAll", "/hr/leave-requests?limit=100").expect(200),
      ).map((l) => l.id);
      expect(ids).toEqual(
        expect.arrayContaining([mine.id, other.id, t2Leave.id]),
      );
      const history = list<Leave>(
        await get(
          "hrAll",
          `/hr/leave-requests?employeeId=${emp.A}&limit=100`,
        ).expect(200),
      );
      expect(history.every((l) => l.employee.id === emp.A)).toBe(true);
      expect(history.length).toBeGreaterThan(2);
      expect(
        list<Leave>(
          await get("hrB", "/hr/leave-requests?limit=100").expect(200),
        ),
      ).toEqual([]);
    });

    it(".team sees only its team's requests — list, by id and by employee filter", async () => {
      const ids = list<Leave>(
        await get("leadT1", "/hr/leave-requests?limit=100").expect(200),
      ).map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining([mine.id, other.id]));
      expect(ids).not.toContain(t2Leave.id);
      await get("leadT1", `/hr/leave-requests/${mine.id}`).expect(200);
      await get("leadT1", `/hr/leave-requests/${t2Leave.id}`).expect(404);
      expect(
        list<Leave>(
          await get("leadT1", `/hr/leave-requests?employeeId=${emp.T2}`).expect(
            200,
          ),
        ),
      ).toEqual([]);
    });

    it(".own sees only the caller's own requests through the HR endpoints", async () => {
      const own = list<Leave>(
        await get("empA", "/hr/leave-requests?limit=100").expect(200),
      );
      expect(own.length).toBeGreaterThan(0);
      expect(own.every((l) => l.employee.id === emp.A)).toBe(true);
      await get("empA", `/hr/leave-requests/${mine.id}`).expect(200);
      await get("empA", `/hr/leave-requests/${other.id}`).expect(404);
    });

    it("another organization cannot read a request; ids are 404/400, never another tenant's data", async () => {
      await get("hrB", `/hr/leave-requests/${mine.id}`).expect(404);
      await get("hrAll", "/hr/leave-requests/999999999").expect(404);
      await get("hrAll", "/hr/leave-requests/abc").expect(400);
    });

    it("401 / 403 on the HR endpoints", async () => {
      await request(app.getHttpServer()).get("/hr/leave-requests").expect(401);
      await get("nobody", "/hr/leave-requests").expect(403);
      await get("empA2", "/hr/leave-requests").expect(403); // self-service perms alone are not HR read
    });
  });

  // ---------------------------------------------------------------------------
  describe("approve and reject", () => {
    it("approves: records who and when, keeps the optional note, audits it", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-04-01`,
        endDate: `${y}-04-02`,
      });
      const res = (
        (await decide("hrAll", l.id, "approve", { note: "enjoy" }).expect(200))
          .body as Body<Leave>
      ).data;
      expect(res).toMatchObject({
        status: "APPROVED",
        decidedBy: { id: userIds.hrAll },
        decisionNote: "enjoy",
      });
      expect(res.decidedAt).not.toBeNull();
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "leave_request",
          entityId: BigInt(l.id),
          action: "approve",
        },
      });
      expect(audit).toMatchObject({
        actorUserId: userIds.hrAll,
        reason: "enjoy",
      });
      expect(audit.before).toMatchObject({ status: "PENDING" });
      expect(audit.after).toMatchObject({
        status: "APPROVED",
        decidedBy: userIds.hrAll,
      });
      // The employee sees the outcome.
      const mine = list<Leave>(
        await get(
          "empA",
          `/self-service/leave-requests?from=${y}-04-01&to=${y}-04-30`,
        ).expect(200),
      );
      expect(mine[0]).toMatchObject({
        status: "APPROVED",
        decisionNote: "enjoy",
      });
    });

    it("approval needs no note", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-04-01`,
        endDate: `${y}-04-02`,
      });
      expect(
        (
          (await decide("hrAll", l.id, "approve").expect(200))
            .body as Body<Leave>
        ).data.decisionNote,
      ).toBeNull();
    });

    it("rejects with a mandatory note", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-04-01`,
        endDate: `${y}-04-02`,
      });
      await post("hrAll", `/hr/leave-requests/${l.id}/reject`, {}).expect(400);
      await post("hrAll", `/hr/leave-requests/${l.id}/reject`, {
        note: "no",
      }).expect(400);
      const res = (
        (
          await post("hrAll", `/hr/leave-requests/${l.id}/reject`, {
            note: "team is short-staffed",
          }).expect(200)
        ).body as Body<Leave>
      ).data;
      expect(res).toMatchObject({
        status: "REJECTED",
        decisionNote: "team is short-staffed",
        decidedBy: { id: userIds.hrAll },
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "leave_request",
          entityId: BigInt(l.id),
          action: "reject",
        },
      });
      expect(audit.reason).toBe("team is short-staffed");
    });

    it("a decision is final: it cannot be repeated, reversed or changed", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-05-01`,
        endDate: `${y}-05-02`,
      });
      await decide("hrAll", l.id, "approve").expect(200);
      for (const action of ["approve", "reject"] as const) {
        const res = await decide("hrAll", l.id, action).expect(422);
        expect(errorOf(res)).toBe("INVALID_STATE_TRANSITION");
      }
      const r = await mkLeave("empA", {
        startDate: `${y}-06-01`,
        endDate: `${y}-06-02`,
      });
      await decide("hrAll", r.id, "reject").expect(200);
      expect(errorOf(await decide("hrAll", r.id, "approve").expect(422))).toBe(
        "INVALID_STATE_TRANSITION",
      );
      expect(
        (await prisma.leaveRequest.findUniqueOrThrow({ where: { id: r.id } }))
          .status,
      ).toBe("REJECTED");
    });

    it("two approvers racing: exactly one decision is recorded, the other is refused", async () => {
      const y = nextYear();
      const l = await mkLeave("empA", {
        startDate: `${y}-08-01`,
        endDate: `${y}-08-02`,
      });
      const results = await Promise.all([
        decide("hrAll", l.id, "approve"),
        decide("approverT1", l.id, "reject"),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      const decisions = await prisma.auditLog.count({
        where: {
          entityType: "leave_request",
          entityId: BigInt(l.id),
          action: { in: ["approve", "reject"] },
        },
      });
      expect(decisions).toBe(1);
    });

    describe("authorization", () => {
      let l: Leave;
      let t2: Leave;
      beforeAll(async () => {
        const y = nextYear();
        l = await mkLeave("empA", {
          startDate: `${y}-10-01`,
          endDate: `${y}-10-02`,
        });
        t2 = await mkLeave("empT2", {
          startDate: `${y}-10-01`,
          endDate: `${y}-10-02`,
        });
      });

      it("401 unauthenticated; 403 for users without the approve permission", async () => {
        await request(app.getHttpServer())
          .post(`/hr/leave-requests/${l.id}/approve`)
          .send({})
          .expect(401);
        await decide("nobody", l.id, "approve").expect(403);
        await decide("empA2", l.id, "approve").expect(403);
      });

      it("a team lead with read-only access cannot decide (approval is not implied by reading)", async () => {
        await decide("leadT1", l.id, "approve").expect(403);
        await decide("leadT1", l.id, "reject").expect(403);
        expect(
          (await prisma.leaveRequest.findUniqueOrThrow({ where: { id: l.id } }))
            .status,
        ).toBe("PENDING");
      });

      it(".own approve is reserved and grants nothing", async () => {
        await decide("ownApprover", l.id, "approve").expect(403);
      });

      it("a .team approver decides its own team's requests only; other teams' requests are invisible (404)", async () => {
        await decide("approverT1", t2.id, "approve").expect(404);
        await decide("approverT1", t2.id, "reject").expect(404);
        expect(
          (
            await prisma.leaveRequest.findUniqueOrThrow({
              where: { id: t2.id },
            })
          ).status,
        ).toBe("PENDING");
        await decide("approverT1", l.id, "approve").expect(200);
      });

      it("another organization cannot decide these requests", async () => {
        await decide("hrB", t2.id, "approve").expect(404);
        await decide("hrB", t2.id, "reject").expect(404);
        expect(
          (
            await prisma.leaveRequest.findUniqueOrThrow({
              where: { id: t2.id },
            })
          ).status,
        ).toBe("PENDING");
      });

      it("404 for an unknown request and 400 for a non-numeric id", async () => {
        await decide("hrAll", 999999999, "approve").expect(404);
        await post("hrAll", "/hr/leave-requests/abc/approve").expect(400);
      });
    });

    describe("maker-checker: nobody decides their own request", () => {
      it("an approver with organization-wide approval still cannot approve or reject their own leave", async () => {
        const y = nextYear();
        const own = await mkLeave("hrApprover", {
          startDate: `${y}-11-01`,
          endDate: `${y}-11-02`,
        });
        expect(own.employee.id).toBe(emp.mgr);
        for (const action of ["approve", "reject"] as const) {
          const res = await decide("hrApprover", own.id, action).expect(403);
          expect(errorOf(res)).toBe("SELF_APPROVAL_FORBIDDEN");
        }
        const row = await prisma.leaveRequest.findUniqueOrThrow({
          where: { id: own.id },
        });
        expect(row).toMatchObject({ status: "PENDING", decidedBy: null });
        // ...but someone else can.
        await decide("hrAll", own.id, "approve").expect(200);
      });

      it("the refusal leaves no decision or audit trace", async () => {
        const y = nextYear();
        const own = await mkLeave("hrApprover", {
          startDate: `${y}-11-01`,
          endDate: `${y}-11-02`,
        });
        await decide("hrApprover", own.id, "approve").expect(403);
        expect(
          await prisma.auditLog.count({
            where: {
              entityType: "leave_request",
              entityId: BigInt(own.id),
              action: { in: ["approve", "reject"] },
            },
          }),
        ).toBe(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants (independent of the API)", () => {
    const row = (over: Record<string, unknown> = {}) => ({
      organizationId: orgA.id,
      employeeId: emp.A2 as number,
      leaveTypeId: casual,
      requestedBy: userIds.empA2 as number,
      startDate: new Date("2090-01-10T00:00:00Z"),
      endDate: new Date("2090-01-12T00:00:00Z"),
      reason: "db test",
      ...over,
    });

    it("statuses, date order and a non-blank reason are enforced", async () => {
      await expect(
        prisma.leaveRequest.create({ data: row({ status: "CANCELLED" }) }),
      ).rejects.toThrow(
        /leave_requests_status_check|leave_requests_decision_consistency_check/,
      );
      await expect(
        prisma.leaveRequest.create({
          data: row({ endDate: new Date("2090-01-09T00:00:00Z") }),
        }),
      ).rejects.toThrow(/leave_requests_dates_check/);
      await expect(
        prisma.leaveRequest.create({ data: row({ reason: "   " }) }),
      ).rejects.toThrow(/leave_requests_reason_check/);
    });

    it("a decision must be complete and a rejection must explain itself", async () => {
      await expect(
        prisma.leaveRequest.create({ data: row({ status: "APPROVED" }) }),
      ).rejects.toThrow(/leave_requests_decision_consistency_check/);
      await expect(
        prisma.leaveRequest.create({
          data: row({
            status: "PENDING",
            decidedBy: userIds.hrAll,
            decidedAt: new Date(),
          }),
        }),
      ).rejects.toThrow(/leave_requests_decision_consistency_check/);
      await expect(
        prisma.leaveRequest.create({
          data: row({
            status: "REJECTED",
            decidedBy: userIds.hrAll,
            decidedAt: new Date(),
          }),
        }),
      ).rejects.toThrow(/leave_requests_decision_consistency_check/);
    });

    it("overlap is rejected for open requests but not for rejected ones", async () => {
      await prisma.leaveRequest.create({ data: row() });
      await expect(
        prisma.leaveRequest.create({
          data: row({
            startDate: new Date("2090-01-12T00:00:00Z"),
            endDate: new Date("2090-01-13T00:00:00Z"),
          }),
        }),
      ).rejects.toThrow(/leave_requests_employee_no_overlap/);
      await prisma.leaveRequest.create({
        data: row({
          status: "REJECTED",
          decidedBy: userIds.hrAll,
          decidedAt: new Date(),
          decisionNote: "no",
        }),
      });
    });

    it("a PENDING request's submitted fields cannot be edited, but it can be decided", async () => {
      const r = await prisma.leaveRequest.create({
        data: row({
          startDate: new Date("2091-01-10T00:00:00Z"),
          endDate: new Date("2091-01-11T00:00:00Z"),
        }),
      });
      await expect(
        prisma.leaveRequest.update({
          where: { id: r.id },
          data: { reason: "rewritten" },
        }),
      ).rejects.toThrow(/cannot be edited/);
      await expect(
        prisma.leaveRequest.update({
          where: { id: r.id },
          data: { employeeId: emp.A as number },
        }),
      ).rejects.toThrow(/cannot be edited/);
      await expect(
        prisma.leaveRequest.update({
          where: { id: r.id },
          data: { endDate: new Date("2091-01-20T00:00:00Z") },
        }),
      ).rejects.toThrow(/cannot be edited/);
      await prisma.leaveRequest.update({
        where: { id: r.id },
        data: {
          status: "APPROVED",
          decidedBy: userIds.hrAll as number,
          decidedAt: new Date(),
        },
      });
    });

    it("a decided request is final — no update, and no delete, ever", async () => {
      const r = await prisma.leaveRequest.create({
        data: row({
          startDate: new Date("2092-01-10T00:00:00Z"),
          endDate: new Date("2092-01-11T00:00:00Z"),
          status: "APPROVED",
          decidedBy: userIds.hrAll,
          decidedAt: new Date(),
        }),
      });
      await expect(
        prisma.leaveRequest.update({
          where: { id: r.id },
          data: { status: "REJECTED", decisionNote: "flip" },
        }),
      ).rejects.toThrow(/final and cannot be changed/);
      await expect(
        prisma.leaveRequest.update({
          where: { id: r.id },
          data: { decisionNote: "edit" },
        }),
      ).rejects.toThrow(/final and cannot be changed/);
      await expect(
        prisma.leaveRequest.delete({ where: { id: r.id } }),
      ).rejects.toThrow(/append-only/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("audit", () => {
    it("submissions and decisions are attributable and secret-free", async () => {
      const rows = await prisma.auditLog.findMany({
        where: { organizationId: orgA.id, entityType: "leave_request" },
      });
      const actions = new Set(rows.map((r) => r.action));
      for (const a of ["submit", "approve", "reject"])
        expect(actions).toContain(a);
      expect(
        rows.every(
          (r) => r.actorUserId !== null && r.organizationId === orgA.id,
        ),
      ).toBe(true);
      expect(JSON.stringify(rows.map((r) => [r.before, r.after]))).not.toMatch(
        /password|token|\$2[aby]\$/i,
      );
    });
  });
});
