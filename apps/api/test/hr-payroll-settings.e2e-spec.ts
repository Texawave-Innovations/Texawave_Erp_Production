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
 * HR → Payroll settings (organization-wide salary split and PF/ESI limits),
 * the salary auto-split that uses them, salary-structure audit rows, and the
 * lock that keeps a finalized payroll's salary structure unchanged.
 */
interface Body<T> {
  data: T;
}
interface Settings {
  basicPercent: number;
  hraPercent: number;
  conveyancePercent: number;
  pfWageCeiling: number;
  esiWageThreshold: number;
  isDefault: boolean;
  version: number;
}

const PERMS = [
  "hr.payroll_settings.read",
  "hr.payroll_settings.write",
  "hr.salary.read.own",
  "hr.salary.read.team",
  "hr.salary.read.all",
  "hr.salary.write.own",
  "hr.salary.write.team",
  "hr.salary.write.all",
];

describe("HR payroll settings (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let org: { id: number; slug: string };
  let otherOrg: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let employeeA = 0;
  let employeeB = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());
  const get = (who: string, path: string) => http().get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    http().post(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    http().patch(path).set(auth(who)).send(body);
  const data = <T>(res: { body: unknown }) => (res.body as Body<T>).data;
  const errorOf = (res: { body: unknown }) =>
    (res.body as { error?: string }).error;

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
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    const login = await http().post("/auth/login").send({
      organizationSlug: o.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = data<{ accessToken: string }>(login).accessToken;
    userIds[key] = user.id;
  }

  async function mkEmployee(orgId: number, n: number) {
    const team = await prisma.team.create({
      data: { organizationId: orgId, name: `T${n}`, code: `T${n}${suffix}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: orgId, code: `D${n}`, name: `Engineer ${n}` },
    });
    const type = await prisma.employmentType.create({
      data: { organizationId: orgId, code: `P${n}`, name: `Permanent ${n}` },
    });
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-8${String(n).padStart(5, "0")}`,
          fullName: `Payroll ${n}`,
          teamId: team.id,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
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
      data: { name: `Pay ${suffix}`, slug: `pay-${suffix.toLowerCase()}` },
    });
    otherOrg = await prisma.organization.create({
      data: { name: `Pay B ${suffix}`, slug: `pay-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    employeeA = await mkEmployee(org.id, 1);
    employeeB = await mkEmployee(org.id, 2);

    await mkUser(org, "admin", PERMS);
    await mkUser(org, "viewer", ["hr.payroll_settings.read"]);
    await mkUser(org, "salaryOnly", [
      "hr.salary.read.all",
      "hr.salary.write.all",
    ]);
    await mkUser(otherOrg, "adminB", PERMS);
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

  describe("settings", () => {
    it("reads the built-in defaults until the first save", async () => {
      const s = data<Settings>(
        await get("viewer", "/hr/payroll/settings").expect(200),
      );
      expect(s).toMatchObject({
        basicPercent: 35,
        hraPercent: 30,
        conveyancePercent: 20,
        pfWageCeiling: 15000,
        esiWageThreshold: 21000,
        isDefault: true,
        version: 0,
      });
    });

    it("403 without the exact permission", async () => {
      await get("salaryOnly", "/hr/payroll/settings").expect(403);
      await patch("viewer", "/hr/payroll/settings", {
        version: 0,
        basicPercent: 40,
      }).expect(403);
    });

    it("saves with the version, audits before/after, and refuses a stale version", async () => {
      const saved = data<Settings>(
        await patch("admin", "/hr/payroll/settings", {
          version: 0,
          basicPercent: 40,
          hraPercent: 20,
        }).expect(200),
      );
      expect(saved).toMatchObject({
        basicPercent: 40,
        hraPercent: 20,
        conveyancePercent: 20,
        isDefault: false,
        version: 1,
      });
      const stale = await patch("admin", "/hr/payroll/settings", {
        version: 0,
        basicPercent: 41,
      }).expect(409);
      expect(errorOf(stale)).toBe("VERSION_CONFLICT");
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { organizationId: org.id, entityType: "payroll_settings" },
        orderBy: { id: "desc" },
      });
      expect(audit.actorUserId).toBe(userIds.admin);
      expect(audit.before).toMatchObject({ basicPercent: 35 });
      expect(audit.after).toMatchObject({ basicPercent: 40 });
    });

    it("422 when basic, HRA and conveyance exceed 100%; 400 for out-of-range values", async () => {
      const res = await patch("admin", "/hr/payroll/settings", {
        version: 1,
        basicPercent: 70,
      }).expect(422);
      expect(errorOf(res)).toBe("SALARY_SPLIT_OVER_100");
      await patch("admin", "/hr/payroll/settings", {
        version: 1,
        esiEmployeeRate: 101,
      }).expect(400);
    });

    it("is per organization", async () => {
      const b = data<Settings>(
        await get("adminB", "/hr/payroll/settings").expect(200),
      );
      expect(b).toMatchObject({ basicPercent: 35, isDefault: true });
    });

    it("previews a split for whoever sets salaries", async () => {
      const r = data<Record<string, number>>(
        await get(
          "salaryOnly",
          "/hr/payroll/settings/salary-split?grossMonthly=50000",
        ).expect(200),
      );
      expect(r).toEqual({
        grossMonthly: 50000,
        basic: 20000,
        hra: 10000,
        conveyance: 10000,
        otherAllowance: 10000,
      });
      await get(
        "viewer",
        "/hr/payroll/settings/salary-split?grossMonthly=1",
      ).expect(403);
    });
  });

  describe("salary structures", () => {
    let salaryId = 0;

    it("splits a gross-only salary by the organization's settings, and audits it", async () => {
      const res = await post("admin", "/hr/salaries", {
        employeeId: employeeA,
        effectiveFrom: "2026-01-01",
        grossMonthly: 52000,
        specialAllowance: 2000,
      }).expect(201);
      const s = data<Record<string, unknown> & { id: number }>(res);
      salaryId = s.id;
      expect(
        [
          "basic",
          "hra",
          "conveyance",
          "otherAllowance",
          "specialAllowance",
          "grossMonthly",
        ].map((k) => Number(s[k])),
      ).toEqual([20000, 10000, 10000, 10000, 2000, 52000]);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: org.id,
          entityType: "employee_salary",
          entityId: BigInt(salaryId),
          action: "create",
        },
      });
      expect(audit.after).toMatchObject({
        basic: "20000",
        grossMonthly: "52000",
      });
    });

    it("422 for half-given components", async () => {
      const res = await post("admin", "/hr/salaries", {
        employeeId: employeeB,
        effectiveFrom: "2026-01-01",
        basic: 10000,
      }).expect(422);
      expect(errorOf(res)).toBe("SALARY_COMPONENTS_INCOMPLETE");
    });

    it("an update is audited with before and after", async () => {
      await patch("admin", `/hr/salaries/${salaryId}`, { hra: 11000 }).expect(
        200,
      );
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: org.id,
          entityType: "employee_salary",
          entityId: BigInt(salaryId),
          action: "update",
        },
        orderBy: { id: "desc" },
      });
      expect(audit.before).toMatchObject({ hra: "10000" });
      expect(audit.after).toMatchObject({ hra: "11000" });
    });

    it("once a covered period is finalized, amounts are locked; arrears and a later end date are not", async () => {
      await prisma.payrollPeriod.create({
        data: {
          organizationId: org.id,
          year: 2026,
          month: 3,
          periodStart: new Date("2026-03-01T00:00:00Z"),
          periodEnd: new Date("2026-03-31T00:00:00Z"),
          status: "FINALIZED",
          finalizedAt: new Date(),
        },
      });
      const locked = await patch("admin", `/hr/salaries/${salaryId}`, {
        basic: 30000,
      }).expect(422);
      expect(errorOf(locked)).toBe("SALARY_LOCKED_BY_FINALIZED_PAYROLL");
      const early = await patch("admin", `/hr/salaries/${salaryId}`, {
        effectiveTo: "2026-03-15",
      }).expect(422);
      expect(errorOf(early)).toBe("SALARY_LOCKED_BY_FINALIZED_PAYROLL");
      await patch("admin", `/hr/salaries/${salaryId}`, {
        arrearsSalary: 500,
      }).expect(200);
      await patch("admin", `/hr/salaries/${salaryId}`, {
        effectiveTo: "2026-06-30",
      }).expect(200);
      const row = await prisma.employeeSalary.findUniqueOrThrow({
        where: { id: salaryId },
      });
      expect(Number(row.basic)).toBe(20000);
    });
  });
});
