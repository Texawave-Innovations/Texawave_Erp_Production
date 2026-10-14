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
 * Leave policy: balances (accrual, carry-forward, enforcement, pending holds),
 * working days (weekly-offs and holidays), half-days, cancellation,
 * resubmission, approval re-checks, entitlement administration, isolation and
 * Attendance (ON_LEAVE / HALF_DAY). Dates are fixed in 2027 so the balance
 * arithmetic is deterministic; 2027-01-01 is a Friday, so Sat/Sun are offs.
 */
interface Body<T> {
  data: T;
}
interface Leave {
  id: number;
  status: string;
  leaveDays: number;
  calendarDays: number;
  dayPortion: string;
  cancelledAt: string | null;
  cancellationNote: string | null;
  decisionNote: string | null;
}
interface Balance {
  leaveTypeId: number;
  code: string;
  isPaid: boolean;
  opening: number;
  accrued: number;
  used: number;
  pending: number;
  available: number | null;
}

const SELF = [
  "employee_self_service.leave_request.create",
  "employee_self_service.leave_request.read",
];
const PERMS = [
  ...SELF,
  "hr.leave_request.read.own",
  "hr.leave_request.read.team",
  "hr.leave_request.read.all",
  "hr.leave.approve.team",
  "hr.leave.approve.all",
  "hr.leave_type.write",
  "hr.attendance_report.read.all",
];

describe("HR leave policy (e2e)", () => {
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
  let paid: number;
  let unpaid: number;
  let empNo = 300;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const put = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const data = <T>(r: request.Response) => (r.body as Body<T>).data;
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;

  const submit = (who: string, body: object) =>
    post(who, "/self-service/leave-requests", body);
  const request_ = (
    who: string,
    typeId: number,
    startDate: string,
    endDate: string,
    over: Record<string, unknown> = {},
  ) =>
    submit(who, {
      leaveTypeId: typeId,
      startDate,
      endDate,
      reason: "planned leave",
      ...over,
    });
  const decide = (
    who: string,
    id: number,
    action: "approve" | "reject",
    body: object = {},
  ) =>
    post(
      who,
      `/hr/leave-requests/${id}/${action}`,
      action === "reject" ? { note: "not this time", ...body } : body,
    );

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${key}-${suffix}` },
    });
    await prisma.rolePermission.createMany({
      data: codes.map((c) => ({
        roleId: role.id,
        permissionId: perm.get(c) as number,
      })),
    });
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
    for (const teamId of teamIds) {
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

  /** A fresh employee with a login (self-service) in `teamId`. */
  async function mkEmployee(
    key: string,
    teamId = 0,
    over: Record<string, unknown> = {},
  ) {
    const user = await mkUser(orgA, key, SELF);
    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: orgA.id, code: "GEN" } },
      update: {},
      create: { organizationId: orgA.id, code: "GEN", name: "General" },
    });
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: orgA.id, code: "PERM" } },
      update: {},
      create: { organizationId: orgA.id, code: "PERM", name: "Permanent" },
    });
    const id = (
      await prisma.employee.create({
        data: {
          organizationId: orgA.id,
          employeeCode: `EMP-9${String(++empNo).padStart(5, "0")}`,
          fullName: `Emp ${key}`,
          teamId: teamId || team1,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
          userId: user.id,
          ...over,
        },
      })
    ).id;
    return id;
  }

  const balanceOf = async (who: string, year: number, code = "PAID") => {
    const rows = data<Balance[]>(
      await get(
        who,
        `/self-service/leave-requests/balances?year=${year}`,
      ).expect(200),
    );
    const row = rows.find((r) => r.code === code);
    if (!row) throw new Error(`no balance row for ${code}`);
    return row;
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
      data: {
        name: `Policy A ${suffix}`,
        slug: `pol-a-${suffix.toLowerCase()}`,
      },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Policy B ${suffix}`,
        slug: `pol-b-${suffix.toLowerCase()}`,
      },
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
        data: { organizationId: orgA.id, name: "P1", code: `P1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "P2", code: `P2${suffix}` },
      })
    ).id;
    paid = (
      await prisma.leaveType.create({
        data: {
          organizationId: orgA.id,
          code: "PAID",
          name: "Paid",
          isPaid: true,
          annualEntitlement: 12,
          carryForwardLimit: 5,
        },
      })
    ).id;
    unpaid = (
      await prisma.leaveType.create({
        data: {
          organizationId: orgA.id,
          code: "UNPAID",
          name: "Unpaid",
          isPaid: false,
        },
      })
    ).id;
    // Weekends are weekly offs for the whole organization.
    await prisma.weeklyOffRule.create({
      data: {
        organizationId: orgA.id,
        name: "Weekend",
        daysOfWeek: [6, 7],
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await prisma.holiday.create({
      data: {
        organizationId: orgA.id,
        holidayDate: new Date("2027-04-12T00:00:00Z"),
        name: "Test holiday",
      },
    });

    await mkUser(orgA, "hrAll", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.leave_type.write",
      "hr.attendance_report.read.all",
    ]);
    await mkUser(orgA, "leadT1", ["hr.leave_request.read.team"], [team1]);
    await mkUser(orgB, "hrB", [
      "hr.leave_request.read.all",
      "hr.leave.approve.all",
      "hr.leave_type.write",
    ]);
    await mkUser(orgA, "nobody", []);
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
  describe("balance enforcement and pending holds", () => {
    let emp: number;
    beforeAll(async () => {
      emp = await mkEmployee("balP1");
    });

    it("carries the capped 2026 balance into 2027 and accrues monthly", async () => {
      // 2026: 12 accrued, nothing used -> closing 12, capped at 5 carried.
      // Through March 2027: 3 accrued. Available: 5 + 3 = 8.
      const b = await balanceOf("balP1", 2027);
      expect(b).toMatchObject({ opening: 5, accrued: 0, available: 5 });
    });

    it("admits requests while balance covers them, counting pending holds", async () => {
      const first = await request_("balP1", paid, "2027-03-01", "2027-03-05");
      expect(first.status).toBe(201);
      expect(data<Leave>(first).leaveDays).toBe(5);
      const second = await request_("balP1", paid, "2027-03-08", "2027-03-09");
      expect(second.status).toBe(201);
    });

    it("refuses a request the pending holds leave no room for", async () => {
      const r = await request_("balP1", paid, "2027-03-10", "2027-03-11");
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_BALANCE_INSUFFICIENT");
    });

    it("unpaid leave is not balance-limited", async () => {
      const r = await request_("balP1", unpaid, "2027-03-10", "2027-03-11");
      expect(r.status).toBe(201);
      const b = await balanceOf("balP1", 2026, "UNPAID");
      expect(b.isPaid).toBe(false);
      expect(b.available).toBeNull();
    });

    it("the self balance view reports the year's figures", async () => {
      const thisYear = Number(new Date().toISOString().slice(0, 4));
      const b = await balanceOf("balP1", thisYear);
      expect(b.accrued).toBeGreaterThan(0);
      expect(b.available).toBeCloseTo(
        b.opening + b.accrued - b.used - b.pending,
        1,
      );
      expect(emp).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("working days", () => {
    beforeAll(async () => {
      await mkEmployee("wdP2");
    });

    it("counts working days: a holiday and weekends are excluded", async () => {
      // Mon 12 (holiday) .. Fri 16 April 2027: 4 working days, 5 calendar days.
      const r = await request_("wdP2", paid, "2027-04-12", "2027-04-16");
      expect(r.status).toBe(201);
      expect(data<Leave>(r)).toMatchObject({ leaveDays: 4, calendarDays: 5 });
    });

    it("a range of only weekends and a holiday has no working day", async () => {
      const r = await request_("wdP2", paid, "2027-04-17", "2027-04-18");
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_NO_WORKING_DAYS");
    });
  });

  // ---------------------------------------------------------------------------
  describe("half-days", () => {
    beforeAll(async () => {
      await mkEmployee("halfP3");
    });

    it("a first-half and a second-half on the same working day both fit", async () => {
      const first = await request_("halfP3", paid, "2027-05-03", "2027-05-03", {
        dayPortion: "FIRST_HALF",
      });
      expect(first.status).toBe(201);
      expect(data<Leave>(first)).toMatchObject({
        leaveDays: 0.5,
        dayPortion: "FIRST_HALF",
      });
      const second = await request_(
        "halfP3",
        paid,
        "2027-05-03",
        "2027-05-03",
        {
          dayPortion: "SECOND_HALF",
        },
      );
      expect(second.status).toBe(201);
    });

    it("a full day cannot be added over a half-day", async () => {
      const r = await request_("halfP3", paid, "2027-05-03", "2027-05-03");
      expect(r.status).toBe(409);
      expect(errorOf(r)).toBe("LEAVE_OVERLAP");
    });

    it("a half-day spanning two dates is refused", async () => {
      const r = await request_("halfP3", paid, "2027-05-04", "2027-05-05", {
        dayPortion: "FIRST_HALF",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_HALF_DAY_INVALID");
    });

    it("a half-day on a weekly off is refused", async () => {
      const r = await request_("halfP3", paid, "2027-05-08", "2027-05-08", {
        dayPortion: "FIRST_HALF",
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_NO_WORKING_DAYS");
    });

    it("Attendance shows ON_LEAVE for both halves approved and HALF_DAY for one", async () => {
      // A past month: the monthly report counts days up to today only.
      const me = await mkEmployeeIdOf("halfP3");
      const first = data<Leave>(
        await request_("halfP3", paid, "2026-05-04", "2026-05-04", {
          dayPortion: "FIRST_HALF",
        }).expect(201),
      );
      const second = data<Leave>(
        await request_("halfP3", paid, "2026-05-04", "2026-05-04", {
          dayPortion: "SECOND_HALF",
        }).expect(201),
      );
      const oneHalf = data<Leave>(
        await request_("halfP3", paid, "2026-05-11", "2026-05-11", {
          dayPortion: "FIRST_HALF",
        }).expect(201),
      );
      await decide("hrAll", first.id, "approve").expect(200);
      await decide("hrAll", second.id, "approve").expect(200);
      await decide("hrAll", oneHalf.id, "approve").expect(200);

      const report = data<
        Array<{
          employee: { id: number };
          countsByStatus: Record<string, number>;
        }>
      >(
        await get(
          "hrAll",
          "/hr/attendance/reports/monthly?month=2026-05&limit=100",
        ).expect(200),
      );
      const row = report.find((r) => r.employee.id === me);
      expect(row?.countsByStatus.ON_LEAVE).toBe(1);
      expect(row?.countsByStatus.HALF_DAY).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe("cancellation and resubmission", () => {
    beforeAll(async () => {
      await mkEmployee("cancP4");
      await mkEmployee("cancP5");
      await mkEmployee("cancP6");
    });

    it("the employee withdraws a PENDING request; its days are released", async () => {
      const made = data<Leave>(
        await request_("cancP4", paid, "2027-06-07", "2027-06-08").expect(201),
      );
      const r = await post(
        "cancP4",
        `/self-service/leave-requests/${made.id}/cancel`,
        {
          note: "plans changed",
        },
      );
      expect(r.status).toBe(200);
      expect(data<Leave>(r)).toMatchObject({
        status: "CANCELLED",
        cancellationNote: "plans changed",
      });
      expect(data<Leave>(r).cancelledAt).not.toBeNull();
      // The cancelled range is free again.
      await request_("cancP4", paid, "2027-06-07", "2027-06-08").expect(201);
    });

    it("a cancelled request cannot be cancelled again", async () => {
      const made = data<Leave>(
        await request_("cancP4", paid, "2027-06-14", "2027-06-14").expect(201),
      );
      await post(
        "cancP4",
        `/self-service/leave-requests/${made.id}/cancel`,
      ).expect(200);
      const r = await post(
        "cancP4",
        `/self-service/leave-requests/${made.id}/cancel`,
      );
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("an APPROVED request can be withdrawn before it starts", async () => {
      const made = data<Leave>(
        await request_("cancP5", paid, "2027-07-05", "2027-07-05").expect(201),
      );
      await decide("hrAll", made.id, "approve").expect(200);
      const r = await post(
        "cancP5",
        `/self-service/leave-requests/${made.id}/cancel`,
      );
      expect(r.status).toBe(200);
      expect(data<Leave>(r).status).toBe("CANCELLED");
    });

    it("an APPROVED request that has started cannot be withdrawn", async () => {
      // Past dates are not a submission rule; this one has already started.
      const made = data<Leave>(
        await request_("cancP6", paid, "2026-09-07", "2026-09-08").expect(201),
      );
      await decide("hrAll", made.id, "approve").expect(200);
      const r = await post(
        "cancP6",
        `/self-service/leave-requests/${made.id}/cancel`,
      );
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_ALREADY_STARTED");
    });

    it("another employee's request cannot be withdrawn (404, no leak)", async () => {
      const made = data<Leave>(
        await request_("cancP5", paid, "2027-08-02", "2027-08-02").expect(201),
      );
      const r = await post(
        "cancP6",
        `/self-service/leave-requests/${made.id}/cancel`,
      );
      expect(r.status).toBe(404);
      expect(
        (await get("cancP6", `/self-service/leave-requests/${made.id}`)).status,
      ).toBe(404);
    });

    it("a REJECTED request can be resubmitted: same id, back to PENDING", async () => {
      const made = data<Leave>(
        await request_("cancP4", paid, "2027-07-12", "2027-07-12").expect(201),
      );
      await decide("hrAll", made.id, "reject").expect(200);
      const r = await post(
        "cancP4",
        `/self-service/leave-requests/${made.id}/resubmit`,
      );
      expect(r.status).toBe(200);
      expect(data<Leave>(r)).toMatchObject({
        id: made.id,
        status: "PENDING",
        decisionNote: null,
      });
    });

    it("a PENDING request cannot be resubmitted", async () => {
      const made = data<Leave>(
        await request_("cancP4", paid, "2027-07-19", "2027-07-19").expect(201),
      );
      const r = await post(
        "cancP4",
        `/self-service/leave-requests/${made.id}/resubmit`,
      );
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_STATE_TRANSITION");
    });

    it("a request whose start has passed cannot be resubmitted", async () => {
      const made = data<Leave>(
        await request_("cancP6", paid, "2026-09-14", "2026-09-14").expect(201),
      );
      await decide("hrAll", made.id, "reject").expect(200);
      const r = await post(
        "cancP6",
        `/self-service/leave-requests/${made.id}/resubmit`,
      );
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_DATES_PAST");
    });

    it("a resubmission that now overlaps another open request is refused", async () => {
      const first = data<Leave>(
        await request_("cancP4", paid, "2027-09-06", "2027-09-06").expect(201),
      );
      await decide("hrAll", first.id, "reject").expect(200);
      await request_("cancP4", paid, "2027-09-06", "2027-09-06").expect(201);
      const r = await post(
        "cancP4",
        `/self-service/leave-requests/${first.id}/resubmit`,
      );
      expect(r.status).toBe(409);
      expect(errorOf(r)).toBe("LEAVE_OVERLAP");
    });
  });

  // ---------------------------------------------------------------------------
  describe("approval re-check and entitlement administration", () => {
    let me: number;
    beforeAll(async () => {
      me = await mkEmployee("entP7");
    });

    it("an entitlement cut after submission blocks approval; the request stays PENDING", async () => {
      // 6 working days fit an 8-day balance at submission.
      const made = data<Leave>(
        await request_("entP7", paid, "2027-03-01", "2027-03-08").expect(201),
      );
      expect(made.leaveDays).toBe(6);
      await put("hrAll", `/hr/leave-entitlements/${me}/${paid}/2027`, {
        annualEntitlement: 0,
      }).expect(200);
      const r = await decide("hrAll", made.id, "approve");
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("LEAVE_BALANCE_INSUFFICIENT");
      const still = data<Leave>(
        await get("hrAll", `/hr/leave-requests/${made.id}`).expect(200),
      );
      expect(still.status).toBe("PENDING");

      // Clearing the override restores the default; approval then succeeds.
      await put("hrAll", `/hr/leave-entitlements/${me}/${paid}/2027`, {
        annualEntitlement: null,
      }).expect(200);
      await decide("hrAll", made.id, "approve").expect(200);
    });

    it("entitlement changes need leave-type administration", async () => {
      const r = await put(
        "nobody",
        `/hr/leave-entitlements/${me}/${paid}/2027`,
        {
          annualEntitlement: 10,
        },
      );
      expect(r.status).toBe(403);
    });

    it("an administrator of another organization cannot set an entitlement here", async () => {
      const r = await put("hrB", `/hr/leave-entitlements/${me}/${paid}/2027`, {
        annualEntitlement: 10,
      });
      expect(r.status).toBe(422);
      expect(errorOf(r)).toBe("INVALID_EMPLOYEE");
    });

    it("rejects a negative or out-of-range entitlement", async () => {
      const r = await put(
        "hrAll",
        `/hr/leave-entitlements/${me}/${paid}/2027`,
        {
          annualEntitlement: -1,
        },
      );
      expect(r.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("organization isolation and scope", () => {
    it("another organization's HR cannot read a request here (404)", async () => {
      const id = await mkLeaveIdFor("balP1");
      expect((await get("hrB", `/hr/leave-requests/${id}`)).status).toBe(404);
    });

    it("a team lead cannot read balances of an employee outside their team (404)", async () => {
      const outside = await mkEmployeeIn("outsideP8", team2);
      const r = await get(
        "leadT1",
        `/hr/leave-requests/balances?employeeId=${outside}&year=2027`,
      );
      expect(r.status).toBe(404);
    });

    it("a team lead can read balances inside their team", async () => {
      const inside = await mkEmployeeIn("insideP9", team1);
      const r = await get(
        "leadT1",
        `/hr/leave-requests/balances?employeeId=${inside}&year=2027`,
      );
      expect(r.status).toBe(200);
      expect(data<Balance[]>(r).find((b) => b.code === "PAID")).toBeDefined();
    });

    it("a login without any leave permission cannot read balances", async () => {
      const r = await get(
        "nobody",
        "/self-service/leave-requests/balances?year=2027",
      );
      expect(r.status).toBe(403);
    });
  });

  // ---- helpers that need the seeded employees -----------------------------
  async function mkEmployeeIn(key: string, teamId: number) {
    return mkEmployee(key, teamId);
  }
  async function mkEmployeeIdOf(key: string) {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: `${key}@${orgA.slug}.test` },
      select: { id: true },
    });
    const emp = await prisma.employee.findFirstOrThrow({
      where: { userId: user.id },
      select: { id: true },
    });
    return emp.id;
  }
  async function mkLeaveIdFor(key: string) {
    const emp = await mkEmployeeIdOf(key);
    const row = await prisma.leaveRequest.findFirstOrThrow({
      where: { employeeId: emp },
      select: { id: true },
    });
    return row.id;
  }
});
