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
 * HR's new hire, end to end (POST /hr/employees/new-hire): HR creates the
 * employee record and their login together, in one transaction, with only
 * the Employee role (and optionally Team Lead) — without Settings → Users or
 * Roles access. Covers success, a duplicate login, rollback when the employee
 * part fails, unauthorized role assignment and the permission checks.
 */
interface Body<T> {
  data: T;
}
interface Emp {
  id: number;
  employeeCode: string;
  userId: number | null;
  workEmail?: string | null;
}

const PERMS = [
  "hr.employee.read.all",
  "hr.employee.write.all",
  "hr.employee_account.write",
  "users.user.write",
  "settings.role.read",
];

describe("HR new hire: employee + login in one transaction (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let org: { id: number; slug: string };
  let orgNoRoles: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let passwordHash: string;
  let team: number;
  let teamNoRoles: number;
  let desig: number;
  let desigOff: number;
  let desigNoRoles: number;
  let empType: number;
  let empTypeNoRoles: number;
  let employeeRole: number;
  let teamLeadRole: number;
  let superAdminRole: number;

  const post = (who: string, path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set({ Authorization: `Bearer ${tokens[who] ?? ""}` })
      .send(body);
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;

  let counter = 0;
  const newHire = (over: Record<string, unknown> = {}) => {
    counter += 1;
    return {
      fullName: `New Hire ${counter} ${suffix}`,
      email: `new.hire.${counter}.${suffix.toLowerCase()}@example.test`,
      tempPassword: "Welcome@2026x",
      // Employee phone numbers are unique: one per person.
      phone: `98765${String(counter).padStart(5, "0")}`,
      teamId: team,
      designationId: desig,
      employmentTypeId: empType,
      dateOfJoining: "2026-11-02",
      ...over,
    };
  };
  const userByEmail = (email: string) =>
    prisma.user.findFirst({
      where: { email },
      include: { userRoles: { where: { isActive: true } } },
    });

  async function mkUser(
    o: { id: number; slug: string },
    key: string,
    codes: string[],
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
        passwordHash,
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    userIds[key] = user.id;
    const res = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: o.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(res.status).toBe(201);
    tokens[key] = (res.body as Body<{ accessToken: string }>).data.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    passwordHash = await bcrypt.hash("Password123!", 10);

    org = await prisma.organization.create({
      data: { name: `NH ${suffix}`, slug: `nh-${suffix.toLowerCase()}` },
    });
    orgNoRoles = await prisma.organization.create({
      data: { name: `NH0 ${suffix}`, slug: `nh0-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T", code: `NH${suffix}` },
      })
    ).id;
    teamNoRoles = (
      await prisma.team.create({
        data: { organizationId: orgNoRoles.id, name: "T", code: `N0${suffix}` },
      })
    ).id;
    desig = (
      await prisma.designation.create({
        data: { organizationId: org.id, code: `D_${suffix}`, name: "Engineer" },
      })
    ).id;
    desigOff = (
      await prisma.designation.create({
        data: {
          organizationId: org.id,
          code: `OFF_${suffix}`,
          name: "Retired",
          isActive: false,
        },
      })
    ).id;
    desigNoRoles = (
      await prisma.designation.create({
        data: {
          organizationId: orgNoRoles.id,
          code: `D_${suffix}`,
          name: "Engineer",
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: { organizationId: org.id, code: `P_${suffix}`, name: "Perm" },
      })
    ).id;
    empTypeNoRoles = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgNoRoles.id,
          code: `P_${suffix}`,
          name: "Perm",
        },
      })
    ).id;
    // The organization's named roles (Settings → Roles).
    employeeRole = (
      await prisma.role.create({
        data: { organizationId: org.id, name: "Employee" },
      })
    ).id;
    teamLeadRole = (
      await prisma.role.create({
        data: { organizationId: org.id, name: "Team Lead" },
      })
    ).id;
    superAdminRole = (
      await prisma.role.create({
        data: { organizationId: org.id, name: "Super Admin" },
      })
    ).id;

    // HR: employees + accounts, but NOT Settings → Users / Roles.
    await mkUser(org, "hr", [
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee_account.write",
    ]);
    await mkUser(org, "hrNoAccount", [
      "hr.employee.read.all",
      "hr.employee.write.all",
    ]);
    await mkUser(org, "accountOnly", ["hr.employee_account.write"]);
    await mkUser(orgNoRoles, "hrNoRoles", [
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee_account.write",
    ]);
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

  it("creates the employee and their login together: Employee role only, linked, forced password change, audited", async () => {
    const body = newHire();
    const res = await post("hr", "/hr/employees/new-hire", body).expect(201);
    const emp = (res.body as Body<Emp>).data;
    expect(emp.employeeCode).toMatch(/^EMP-\d{6}$/);
    expect(emp.workEmail).toBe(body.email);

    const user = await userByEmail(body.email);
    expect(user).not.toBeNull();
    expect(emp.userId).toBe(user!.id);
    expect(user!.organizationId).toBe(org.id);
    expect(user!.mustChangePassword).toBe(true);
    expect(user!.userRoles.map((r) => r.roleId)).toEqual([employeeRole]);
    // The password is stored hashed and works for sign-in.
    expect(user!.passwordHash).not.toBe(body.tempPassword);
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: body.email,
      password: body.tempPassword,
    });
    expect(login.status).toBe(201);

    // Both writes are audited, by the HR user.
    const audits = await prisma.auditLog.findMany({
      where: {
        actorUserId: userIds.hr as number,
        OR: [
          { entityType: "user", entityId: BigInt(user!.id) },
          { entityType: "employee", entityId: BigInt(emp.id) },
        ],
      },
      select: { entityType: true, action: true },
    });
    expect(audits).toEqual(
      expect.arrayContaining([
        { entityType: "user", action: "create" },
        { entityType: "user", action: "assign_roles" },
        expect.objectContaining({ entityType: "employee" }),
      ]),
    );
  });

  it("adds Team Lead only when asked", async () => {
    const body = newHire({ additionalRole: "TEAM_LEAD" });
    await post("hr", "/hr/employees/new-hire", body).expect(201);
    const user = await userByEmail(body.email);
    expect(user!.userRoles.map((r) => r.roleId).sort()).toEqual(
      [employeeRole, teamLeadRole].sort(),
    );
  });

  it("a duplicate login e-mail is a 409, and no employee is created", async () => {
    const body = newHire({ email: `hr@${org.slug}.test` });
    const before = await prisma.employee.count({
      where: { organizationId: org.id },
    });
    const res = await post("hr", "/hr/employees/new-hire", body).expect(409);
    expect(res.status).toBe(409);
    expect(
      await prisma.employee.count({ where: { organizationId: org.id } }),
    ).toBe(before);
  });

  it("rolls the login back when the employee part fails (one transaction)", async () => {
    // An inactive designation is refused inside the transaction, after the
    // login was written.
    const body = newHire({ designationId: desigOff });
    const res = await post("hr", "/hr/employees/new-hire", body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await userByEmail(body.email)).toBeNull();
    expect(
      await prisma.employee.count({ where: { workEmail: body.email } }),
    ).toBe(0);
    // The same person can then be created once the data is fixed.
    await post("hr", "/hr/employees/new-hire", {
      ...body,
      designationId: desig,
    }).expect(201);
  });

  it("HR cannot hand out any other role: role ids and unknown roles are refused, nothing is written", async () => {
    const smuggled = newHire({ roleIds: [superAdminRole] });
    await post("hr", "/hr/employees/new-hire", smuggled).expect(400);
    const unknown = newHire({ additionalRole: "SUPER_ADMIN" });
    await post("hr", "/hr/employees/new-hire", unknown).expect(400);
    const viaUserId = newHire({ userId: userIds.hrNoAccount });
    await post("hr", "/hr/employees/new-hire", viaUserId).expect(400);
    for (const b of [smuggled, unknown, viaUserId]) {
      expect(await userByEmail(b.email)).toBeNull();
    }
    expect(
      await prisma.userRole.count({ where: { roleId: superAdminRole } }),
    ).toBe(0);
  });

  it("needs hr.employee_account.write as well as hr.employee.write", async () => {
    const noAccount = newHire();
    await post("hrNoAccount", "/hr/employees/new-hire", noAccount).expect(403);
    const accountOnly = newHire();
    await post("accountOnly", "/hr/employees/new-hire", accountOnly).expect(
      403,
    );
    expect(await userByEmail(noAccount.email)).toBeNull();
    expect(await userByEmail(accountOnly.email)).toBeNull();
  });

  it("is a clear 422 when the organization has no Employee role, and writes nothing", async () => {
    const body = newHire({
      teamId: teamNoRoles,
      designationId: desigNoRoles,
      employmentTypeId: empTypeNoRoles,
    });
    const res = await post("hrNoRoles", "/hr/employees/new-hire", body).expect(
      422,
    );
    expect(errorOf(res)).toBe("NEW_HIRE_ROLE_MISSING");
    expect(await userByEmail(body.email)).toBeNull();
  });

  it("validates the login fields: a weak temporary password is refused", async () => {
    const body = newHire({ tempPassword: "weak" });
    await post("hr", "/hr/employees/new-hire", body).expect(400);
    expect(await userByEmail(body.email)).toBeNull();
  });
});
