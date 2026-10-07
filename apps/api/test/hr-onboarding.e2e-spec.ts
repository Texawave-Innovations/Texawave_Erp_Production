import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * HR employee onboarding, end to end (TEXA-16 self-onboarding story):
 * HR creates a login (temp password, forced change) and an employee record
 * linked to it in two existing, composed calls (POST /users, then
 * POST /hr/employees with that userId) — never a combined endpoint, per
 * CreateEmployeeDto's own documented boundary ("a login is a separate users
 * row... never stored here"). Then: the new hire logs in, is blocked from
 * submitting their onboarding profile until they change the temp password,
 * changes it, and the gate lifts.
 */
interface Body<T> {
  data: T;
}

const PERMS = [
  "users.user.read",
  "users.user.write",
  "hr.employee.read.all",
  "hr.employee.write.all",
  "employee_self_service.profile.read",
  "employee_self_service.profile.write",
];

describe("HR onboarding handoff (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID().slice(0, 8);
  let hrPasswordHash: string;
  let team: number;
  let desig: number;
  let empType: number;
  let employeeRoleId: number;

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post("/auth/login")
      .send({ organizationSlug: org.slug, email, password });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    hrPasswordHash = await bcrypt.hash("Password123!", 10);

    org = await prisma.organization.create({
      data: { name: `Onboard Org ${suffix}`, slug: `onboard-org-${suffix}` },
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
        data: {
          organizationId: org.id,
          name: "Onboard Team",
          code: `OT${suffix}`,
        },
      })
    ).id;
    desig = (
      await prisma.designation.create({
        data: {
          organizationId: org.id,
          code: `OD${suffix.toUpperCase()}`,
          name: "Engineer",
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: {
          organizationId: org.id,
          code: `OF${suffix.toUpperCase()}`,
          name: "Full-time",
        },
      })
    ).id;

    // HR role: everything needed to onboard someone.
    const hrRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `HR-${suffix}`,
        rolePermissions: {
          create: PERMS.map((code) => ({
            permissionId: perm.get(code) as number,
          })),
        },
      },
    });
    const hrUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `hr-${suffix}@example.com`,
        passwordHash: hrPasswordHash,
        fullName: "HR Admin",
      },
    });
    await prisma.userRole.create({
      data: { userId: hrUser.id, roleId: hrRole.id },
    });
    const hrLogin = await login(hrUser.email, "Password123!").expect(201);
    tokens.hr = (
      hrLogin.body as Body<{ accessToken: string }>
    ).data.accessToken;

    // Employee role: self-service only, nothing HR-wide.
    const employeeRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `Employee-${suffix}`,
        rolePermissions: {
          create: [
            {
              permissionId: perm.get(
                "employee_self_service.profile.read",
              ) as number,
            },
            {
              permissionId: perm.get(
                "employee_self_service.profile.write",
              ) as number,
            },
          ],
        },
      },
    });
    employeeRoleId = employeeRole.id;
  });

  afterAll(async () => {
    // Employees and their status history are permanent by design (append-only
    // audit trail) — this suite's organization is left behind, unique-slugged,
    // on the disposable test DB, same convention as hr-employees.e2e-spec.ts.
    await app.close();
  });

  it("403s a user without users.user.write trying to create a login", async () => {
    const noPermRole = await prisma.role.create({
      data: { organizationId: org.id, name: `NoPerm-${suffix}` },
    });
    const noPermUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `noperm-${suffix}@example.com`,
        passwordHash: hrPasswordHash,
        fullName: "No Perm",
      },
    });
    await prisma.userRole.create({
      data: { userId: noPermUser.id, roleId: noPermRole.id },
    });
    const noPermLogin = await login(noPermUser.email, "Password123!").expect(
      201,
    );
    const noPermToken = (noPermLogin.body as Body<{ accessToken: string }>).data
      .accessToken;

    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${noPermToken}`)
      .send({
        email: `blocked-${suffix}@example.com`,
        fullName: "Blocked Hire",
        password: "TempPass123!",
        mustChangePassword: true,
      })
      .expect(403);
  });

  it("rejects a temp password that does not meet the strength rule", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .set(auth("hr"))
      .send({
        email: `weakpw-${suffix}@example.com`,
        fullName: "Weak Pw",
        password: "weak",
        mustChangePassword: true,
      })
      .expect(400);
  });

  it("completes the full handoff: HR creates login + employee, new hire logs in forced to change password, is blocked from submitting until they do, then the gate lifts", async () => {
    const email = `newhire-${suffix}@example.com`;
    const tempPassword = "TempPass123!";

    // 1. HR creates the login with a temp password, forced change, and the
    //    employee's self-service role — nothing HR-wide.
    const userRes = await request(app.getHttpServer())
      .post("/users")
      .set(auth("hr"))
      .send({
        email,
        fullName: "New Hire",
        password: tempPassword,
        mustChangePassword: true,
        roleIds: [employeeRoleId],
      })
      .expect(201);
    const newUserId = (
      userRes.body as Body<{ id: number; mustChangePassword: boolean }>
    ).data.id;
    expect(
      (userRes.body as Body<{ mustChangePassword: boolean }>).data
        .mustChangePassword,
    ).toBe(true);

    // 2. HR links that login to a new employee record, in the SAME existing
    //    endpoint any other employee is created through — userId is the only
    //    onboarding-specific input.
    const employeeRes = await request(app.getHttpServer())
      .post("/hr/employees")
      .set(auth("hr"))
      .send({
        fullName: "New Hire",
        teamId: team,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: "2026-10-01",
        userId: newUserId,
      })
      .expect(201);
    expect(
      (employeeRes.body as Body<{ userId: number; onboardingStatus: string }>)
        .data.userId,
    ).toBe(newUserId);
    expect(
      (employeeRes.body as Body<{ onboardingStatus: string }>).data
        .onboardingStatus,
    ).toBe("PENDING_ACTIVATION");

    // 3. The new hire logs in with the temp password.
    const hireLogin = await login(email, tempPassword).expect(201);
    tokens.hire = (
      hireLogin.body as Body<{ accessToken: string }>
    ).data.accessToken;

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set(auth("hire"))
      .expect(200);
    expect(
      (me.body as Body<{ mustChangePassword: boolean }>).data
        .mustChangePassword,
    ).toBe(true);

    // 4. Blocked from submitting their onboarding profile until the temp
    //    password is changed, even though nothing has been filled in yet —
    //    the password gate is checked before completeness.
    const blocked = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth("hire"))
      .expect(422);
    expect((blocked.body as { error: string }).error).toBe(
      "PASSWORD_CHANGE_REQUIRED",
    );

    // 5. Changes the temp password — every session is revoked.
    const newPassword = "BrandNewPass456!";
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set(auth("hire"))
      .send({ currentPassword: tempPassword, newPassword })
      .expect(201);

    await login(email, tempPassword).expect(401);
    const relogin = await login(email, newPassword).expect(201);
    tokens.hire = (
      relogin.body as Body<{ accessToken: string }>
    ).data.accessToken;

    const meAfter = await request(app.getHttpServer())
      .get("/auth/me")
      .set(auth("hire"))
      .expect(200);
    expect(
      (meAfter.body as Body<{ mustChangePassword: boolean }>).data
        .mustChangePassword,
    ).toBe(false);

    // 6. The password gate is lifted — submit now reports what's missing
    //    instead of demanding a password change.
    const afterChange = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth("hire"))
      .expect(201);
    const result = afterChange.body as Body<{ missing: string[] }>;
    expect(result.data.missing.length).toBeGreaterThan(0);
    expect(result.data.missing).not.toContain("PASSWORD_CHANGE_REQUIRED");
  });

  it("HR reads an employee's onboarding progress; a user scoped to 'own' gets 404 for someone else's", async () => {
    const created = await request(app.getHttpServer())
      .post("/hr/employees")
      .set(auth("hr"))
      .send({
        fullName: "Progress Subject",
        teamId: team,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: "2026-10-02",
      })
      .expect(201);
    const employeeId = (created.body as Body<{ id: number }>).data.id;

    const progress = await request(app.getHttpServer())
      .get(`/hr/employees/${employeeId}/onboarding`)
      .set(auth("hr"))
      .expect(200);
    const body = (
      progress.body as Body<{
        employeeId: number;
        onboardingStatus: string;
        missing: string[];
      }>
    ).data;
    expect(body.employeeId).toBe(employeeId);
    expect(body.onboardingStatus).toBe("PENDING_ACTIVATION");
    expect(body.missing).toContain("personal.dateOfBirth");

    // A user whose read scope is 'own' cannot see another employee's progress.
    const ownPerm = await prisma.permission.upsert({
      where: { code: "hr.employee.read.own" },
      update: {},
      create: {
        code: "hr.employee.read.own",
        description: "hr.employee.read.own",
      },
    });
    const ownRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `Own-${suffix}`,
        rolePermissions: { create: [{ permissionId: ownPerm.id }] },
      },
    });
    const ownUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `ownscope-${suffix}@example.com`,
        passwordHash: hrPasswordHash,
        fullName: "Own Scope",
      },
    });
    await prisma.userRole.create({
      data: { userId: ownUser.id, roleId: ownRole.id },
    });
    const ownLogin = await login(ownUser.email, "Password123!").expect(201);
    tokens.own = (
      ownLogin.body as Body<{ accessToken: string }>
    ).data.accessToken;

    await request(app.getHttpServer())
      .get(`/hr/employees/${employeeId}/onboarding`)
      .set(auth("own"))
      .expect(404);
  });

  it("409s creating a login with an email already in use", async () => {
    const email = `dupe-${suffix}@example.com`;
    await request(app.getHttpServer())
      .post("/users")
      .set(auth("hr"))
      .send({ email, fullName: "First", password: "TempPass123!" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/users")
      .set(auth("hr"))
      .send({ email, fullName: "Second", password: "TempPass123!" })
      .expect(409);
  });
});
