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
 * Location Privilege (e2e). Configuration and its authorization, team scope,
 * organization isolation, and the attendance punch gate: a REMOTE employee
 * punches from any network, an OFFICE employee only from an active office
 * address, and a denied punch writes nothing. Every privilege and office-list
 * change is audited.
 *
 * Supertest connects over loopback, so the caller's address is 127.0.0.1. The
 * office list is changed during the run to make loopback allowed or denied.
 */
interface Body<T> {
  data: T;
}

interface Privilege {
  employeeId: number;
  mode: "OFFICE" | "REMOTE" | null;
  source?: "explicit" | "unset";
}

interface OfficeNetwork {
  id: number;
  ipAddress: string;
  isActive: boolean;
}

const LOOPBACK = "127.0.0.1";

const PERMS = [
  "employee_self_service.attendance.punch",
  "employee_self_service.attendance.read",
  "hr.location_privilege.read",
  "hr.location_privilege.write",
  "hr.office_network.read",
  "hr.office_network.write",
];

describe("HR location privilege (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let team1: number;
  let team2: number;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  const emp: Record<string, number> = {};
  let empCounter = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const put = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const checkIn = (who: string) =>
    request(app.getHttpServer())
      .post("/hr/attendance/check-in")
      .set(auth(who))
      .send({});

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

  /** An employee, optionally linked to a login (self-service needs that). */
  async function mkEmp(
    orgId: number,
    teamId: number,
    over: { userId?: number } = {},
  ) {
    const n = ++empCounter;
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
          // Matches employees_code_format_check: EMP- followed by 6+ digits.
          employeeCode: `EMP-${200000 + n}`,
          fullName: `Loc Emp ${n}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2025-01-01T00:00:00Z"),
          ...(over.userId ? { userId: over.userId } : {}),
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

    orgA = await prisma.organization.create({
      data: { name: `Loc A ${suffix}`, slug: `loc-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Loc B ${suffix}`, slug: `loc-b-${suffix.toLowerCase()}` },
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
        data: { organizationId: orgA.id, name: "L1", code: `L1${suffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "L2", code: `L2${suffix}` },
      })
    ).id;

    // The office list starts without loopback, so the caller is off-network.
    await prisma.officeNetworkAddress.create({
      data: {
        organizationId: orgA.id,
        ipAddress: "203.0.113.200",
        isActive: true,
      },
    });

    await mkUser(orgA, "hrAll", [
      "hr.location_privilege.read",
      "hr.location_privilege.write",
      "hr.office_network.read",
      "hr.office_network.write",
    ]);
    // An HR user who is also an employee: may change others, never themselves.
    const hrSelfUser = await mkUser(orgA, "hrSelf", [
      "hr.location_privilege.read",
      "hr.location_privilege.write",
    ]);
    emp.hrSelf = await mkEmp(orgA.id, team1, { userId: hrSelfUser.id });
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "hr.location_privilege.read",
      "hr.location_privilege.write",
      "hr.office_network.read",
      "hr.office_network.write",
    ]);

    // Employees: one linked to a self-service login, one remote, one in team2.
    const selfUser = await mkUser(orgA, "selfOffice", [
      "employee_self_service.attendance.punch",
      "employee_self_service.attendance.read",
    ]);
    emp.selfOffice = await mkEmp(orgA.id, team1, { userId: selfUser.id });
    emp.remote = await mkEmp(orgA.id, team1);
    emp.team2 = await mkEmp(orgA.id, team2);
    emp.orgB = await mkEmp(
      orgB.id,
      (
        await prisma.team.create({
          data: { organizationId: orgB.id, name: "LB", code: `LB${suffix}` },
        })
      ).id,
    );
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  describe("authorization and scope", () => {
    it("rejects an unauthenticated call", async () => {
      await request(app.getHttpServer())
        .get(`/hr/location-privileges/employees/${emp.remote}`)
        .expect(401);
    });

    it("refuses the privilege read to a user with no location permission", async () => {
      const r = await get(
        "nobody",
        `/hr/location-privileges/employees/${emp.remote}`,
      );
      expect(r.status).toBe(403);
    });

    it("reports a never-set employee as mode null with source unset", async () => {
      const r = await get(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
      );
      expect(r.status).toBe(200);
      expect((r.body as Body<Privilege>).data).toMatchObject({
        employeeId: emp.remote,
        mode: null,
        source: "unset",
      });
    });

    it("lets an HR user set and then read a mode", async () => {
      const set = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
        {
          mode: "REMOTE",
        },
      );
      expect(set.status).toBe(200);
      expect((set.body as Body<{ changed: boolean }>).data.changed).toBe(true);

      const read = await get(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
      );
      expect((read.body as Body<Privilege>).data).toMatchObject({
        mode: "REMOTE",
        source: "explicit",
      });
    });

    it("reports no change when the mode is already set", async () => {
      const again = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
        {
          mode: "REMOTE",
        },
      );
      expect((again.body as Body<{ changed: boolean }>).data.changed).toBe(
        false,
      );
    });

    it("rejects a mode outside OFFICE and REMOTE", async () => {
      const r = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
        {
          mode: "HOME",
        },
      );
      expect(r.status).toBe(400);
    });

    it("rejects unknown body fields (whitelisted DTO)", async () => {
      const r = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.remote}`,
        {
          mode: "OFFICE",
          employeeId: emp.team2,
        },
      );
      expect(r.status).toBe(400);
    });

    it("lets an HR user with the permission change any employee in the organization", async () => {
      const r = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.team2}`,
        { mode: "REMOTE" },
      );
      expect(r.status).toBe(200);
    });

    it("refuses a change to the caller's own employee record (403), even with the permission", async () => {
      const r = await put(
        "hrSelf",
        `/hr/location-privileges/employees/${emp.hrSelf}`,
        { mode: "REMOTE" },
      );
      expect(r.status).toBe(403);
      const row = await prisma.employeeLocationPrivilege.findFirst({
        where: { employeeId: emp.hrSelf ?? 0 },
      });
      expect(row).toBeNull();
    });
  });

  describe("organization isolation", () => {
    it("does not expose another organization's employee", async () => {
      const r = await get(
        "hrAll",
        `/hr/location-privileges/employees/${emp.orgB}`,
      );
      expect(r.status).toBe(404);
    });

    it("does not let another organization change this employee's privilege", async () => {
      const r = await put(
        "hrB",
        `/hr/location-privileges/employees/${emp.remote}`,
        {
          mode: "OFFICE",
        },
      );
      expect(r.status).toBe(404);
      const unchanged = await prisma.employeeLocationPrivilege.findFirst({
        where: { employeeId: emp.remote ?? 0 },
      });
      expect(unchanged?.mode).toBe("REMOTE");
    });

    it("keeps each organization's office list separate", async () => {
      const r = await get("hrB", "/hr/office-networks");
      expect(r.status).toBe(200);
      const ips = (r.body as Body<OfficeNetwork[]>).data.map(
        (n) => n.ipAddress,
      );
      expect(ips).not.toContain("203.0.113.200");
    });
  });

  describe("attendance punch gate", () => {
    it("marks the self-service employee OFFICE so the gate applies to it", async () => {
      const r = await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.selfOffice}`,
        { mode: "OFFICE" },
      );
      expect(r.status).toBe(200);
    });

    it("lets an employee with no privilege row punch from off the office network", async () => {
      // Opt-in gate: an employee nobody classified keeps today's check-in.
      const unsetUser = await mkUser(orgA, "selfUnset", [
        "employee_self_service.attendance.punch",
        "employee_self_service.attendance.read",
      ]);
      await mkEmp(orgA.id, team1, { userId: unsetUser.id });
      const punch = await checkIn("selfUnset");
      expect(punch.status).toBe(201);
      await request(app.getHttpServer())
        .post("/hr/attendance/check-out")
        .set(auth("selfUnset"))
        .send({});
    });

    it("denies an OFFICE employee when the caller is off the office network", async () => {
      const r = await checkIn("selfOffice");
      expect(r.status).toBe(403);
      expect((r.body as { error: string }).error).toBe("LOCATION_NOT_ALLOWED");
    });

    it("writes no attendance for a denied punch", async () => {
      const sessions = await prisma.attendanceSession.count({
        where: { record: { employeeId: emp.selfOffice ?? 0 } },
      });
      expect(sessions).toBe(0);
    });

    it("admits an OFFICE employee once the caller's address is on the office list", async () => {
      const added = await post("hrAll", "/hr/office-networks", {
        ipAddress: LOOPBACK,
        label: "e2e loopback",
      });
      expect(added.status).toBe(201);
      const id = (added.body as Body<OfficeNetwork>).data.id;

      const r = await checkIn("selfOffice");
      expect(r.status).toBe(201);

      // Clean up the open session so later punches start from a known state.
      await request(app.getHttpServer())
        .post("/hr/attendance/check-out")
        .set(auth("selfOffice"))
        .send({});
      await patch("hrAll", `/hr/office-networks/${id}`, { isActive: false });
    });

    it("denies again once the address is deactivated", async () => {
      const r = await checkIn("selfOffice");
      expect(r.status).toBe(403);
    });

    it("lets a REMOTE employee punch from an off-network address", async () => {
      // The employee is off the office list here (the address was deactivated
      // above), so switching the same employee to REMOTE isolates the gate.
      await put(
        "hrAll",
        `/hr/location-privileges/employees/${emp.selfOffice}`,
        {
          mode: "REMOTE",
        },
      );
      const punch = await checkIn("selfOffice");
      expect(punch.status).toBe(201);
      await request(app.getHttpServer())
        .post("/hr/attendance/check-out")
        .set(auth("selfOffice"))
        .send({});
    });
  });

  describe("office network list", () => {
    it("refuses a malformed IP address", async () => {
      const r = await post("hrAll", "/hr/office-networks", {
        ipAddress: "not-an-ip",
      });
      expect(r.status).toBe(400);
    });

    it("refuses a duplicate address for the same organization", async () => {
      const r = await post("hrAll", "/hr/office-networks", {
        ipAddress: "203.0.113.200",
      });
      expect(r.status).toBe(409);
    });

    it("normalizes an IPv4-mapped IPv6 address to its IPv4 form", async () => {
      const r = await post("hrAll", "/hr/office-networks", {
        ipAddress: "::ffff:198.51.100.7",
      });
      expect(r.status).toBe(201);
      expect((r.body as Body<OfficeNetwork>).data.ipAddress).toBe(
        "198.51.100.7",
      );
    });
  });

  describe("audit", () => {
    it("records a privilege change with before and after", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: "employee_location_privilege",
        },
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row.action === "create")).toBe(true);
    });

    it("records an office network addition and its deactivation", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityType: "office_network_address",
        },
      });
      expect(rows.some((row) => row.action === "create")).toBe(true);
      expect(rows.some((row) => row.action === "update")).toBe(true);
    });

    it("writes no audit row for a no-op set", async () => {
      const before = await prisma.auditLog.count({
        where: {
          organizationId: orgA.id,
          entityType: "employee_location_privilege",
        },
      });
      await put("hrAll", `/hr/location-privileges/employees/${emp.remote}`, {
        mode: "REMOTE",
      });
      const after = await prisma.auditLog.count({
        where: {
          organizationId: orgA.id,
          entityType: "employee_location_privilege",
        },
      });
      expect(after).toBe(before);
    });
  });
});
