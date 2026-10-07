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
 * HR → Profiles. Personal profile (team-scoped through the employee) and the
 * separate sensitive record (organization-wide, `.all` only, audited reads).
 * Covers authentication, the permission matrix, own/team/all scope, org
 * isolation, validation, partial-update semantics, audit (field names only;
 * reads audited), persistence, separation of sensitive values, and DB constraints.
 */
interface Body<T> {
  data: T;
}

const PERMS = [
  "hr.employee_profile.read.own",
  "hr.employee_profile.read.team",
  "hr.employee_profile.read.all",
  "hr.employee_profile.write.own",
  "hr.employee_profile.write.team",
  "hr.employee_profile.write.all",
  "hr.employee_sensitive.read",
  "hr.employee_sensitive.write",
];

const FULL_PROFILE = {
  title: "Mr",
  dateOfBirth: "1992-04-18",
  gender: "Male",
  maritalStatus: "Married",
  bloodGroup: "O+",
  languages: ["Tamil", "English"],
  fatherName: "Ravi Kumar",
  motherName: "Lakshmi Kumar",
  spouseName: "Priya Kumar",
  emergencyContactName: "Ravi Kumar",
  emergencyContactPhone: "+91 98765 43210",
  emergencyContactRelation: "Father",
  presentAddress: {
    address: "12 Anna Street",
    area: "Adyar",
    district: "Chennai",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600020",
    country: "India",
  },
  permanentAddress: {
    address: "4 Gandhi Road",
    city: "Madurai",
    state: "Tamil Nadu",
    pincode: "625001",
  },
  isFresher: false,
  experienceYears: 4.5,
  previousCompany: "Acme Software",
  previousRole: "Engineer",
};

const SENSITIVE = {
  panNumber: "ABCDE1234F",
  aadhaarNumber: "123412341234",
  esiNumber: "1234567890",
  pfNumber: "TN/MAS/12345/001",
  bankName: "State Bank of India",
  bankBranch: "Adyar",
  bankAccountNo: "123456789012",
  bankIfsc: "SBIN0001234",
};

describe("HR profiles (e2e)", () => {
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

  const emp = { a1: 0, a2: 0, a3: 0, b1: 0 };
  let team1 = 0;
  let team2 = 0;
  let teamB = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const patch = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const profilePath = (id: number) => `/hr/employees/${id}/profile`;
  const sensitivePath = (id: number) => `/hr/employees/${id}/sensitive`;

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    opts: { teamIds?: number[]; employeeId?: number } = {},
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
    if (opts.employeeId) {
      await prisma.employee.update({
        where: { id: opts.employeeId },
        data: { userId: user.id },
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

  async function mkEmployee(orgId: number, teamId: number, n: number) {
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
          employeeCode: `EMP-9${String(n).padStart(5, "0")}`,
          fullName: `Profile ${n}`,
          teamId,
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

    orgA = await prisma.organization.create({
      data: { name: `Pf A ${suffix}`, slug: `pf-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Pf B ${suffix}`, slug: `pf-b-${suffix.toLowerCase()}` },
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

    emp.a1 = await mkEmployee(orgA.id, team1, 1);
    emp.a2 = await mkEmployee(orgA.id, team2, 2);
    emp.a3 = await mkEmployee(orgA.id, team1, 4);
    emp.b1 = await mkEmployee(orgB.id, teamB, 3);

    await mkUser(orgA, "hrAll", [
      "hr.employee_profile.read.all",
      "hr.employee_profile.write.all",
      "hr.employee_sensitive.read",
      "hr.employee_sensitive.write",
    ]);
    await mkUser(orgA, "noSens", [
      "hr.employee_profile.read.all",
      "hr.employee_profile.write.all",
    ]);
    await mkUser(
      orgA,
      "leadT1",
      ["hr.employee_profile.read.team", "hr.employee_profile.write.team"],
      { teamIds: [team1] },
    );
    await mkUser(orgA, "ownA", ["hr.employee_profile.read.own"], {
      employeeId: emp.a2,
    });
    await mkUser(
      orgA,
      "writerOwn",
      ["hr.employee_profile.read.own", "hr.employee_profile.write.own"],
      { employeeId: emp.a3 },
    );
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", [
      "hr.employee_profile.read.all",
      "hr.employee_profile.write.all",
      "hr.employee_sensitive.read",
      "hr.employee_sensitive.write",
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

  // ---------------------------------------------------------------------------
  describe("authentication and permissions", () => {
    it("401 without a token", async () => {
      await request(app.getHttpServer()).get(profilePath(emp.a1)).expect(401);
      await request(app.getHttpServer()).get(sensitivePath(emp.a1)).expect(401);
    });

    it("403 without any profile permission", async () => {
      await get("nobody", profilePath(emp.a1)).expect(403);
      await patch("nobody", profilePath(emp.a1), { title: "Mr" }).expect(403);
    });

    it("403 on sensitive data for every holder without the exact sensitive permission", async () => {
      await get("noSens", sensitivePath(emp.a1)).expect(403);
      await patch("noSens", sensitivePath(emp.a1), {
        bankIfsc: "SBIN0001234",
      }).expect(403);
      await get("leadT1", sensitivePath(emp.a1)).expect(403);
      await get("ownA", sensitivePath(emp.a2)).expect(403);
    });

    it("403 for an own-level writer: profile writing is reserved, never granted to self", async () => {
      await patch("writerOwn", profilePath(emp.a2), { title: "Mr" }).expect(
        403,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("scope: own, team and all", () => {
    it("all: reads and writes any employee in the organization", async () => {
      await get("hrAll", profilePath(emp.a2)).expect(200);
      await patch("hrAll", profilePath(emp.a2), { title: "Ms" }).expect(200);
    });

    it("team: reads and writes its own team's employee; another team is 404, not 403", async () => {
      await get("leadT1", profilePath(emp.a1)).expect(200);
      await patch("leadT1", profilePath(emp.a3), { title: "Dr" }).expect(200);
      await get("leadT1", profilePath(emp.a2)).expect(404);
      await patch("leadT1", profilePath(emp.a2), { title: "Dr" }).expect(404);
    });

    it("own: reads only the caller's own employee record; others are 404", async () => {
      await get("ownA", profilePath(emp.a2)).expect(200);
      await get("ownA", profilePath(emp.a1)).expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("profile writes, persistence and audit", () => {
    it("PATCH creates the profile and returns the saved shape with the employee summary", async () => {
      const r = await patch("hrAll", profilePath(emp.a1), FULL_PROFILE).expect(
        200,
      );
      const data = (r.body as Body<Record<string, unknown>>).data as {
        employee: { fullName: string; id: number };
        profile: Record<string, unknown>;
      };
      expect(data.employee).toMatchObject({
        id: emp.a1,
        fullName: "Profile 1",
      });
      expect(data.profile).toMatchObject({
        title: "Mr",
        dateOfBirth: "1992-04-18",
        languages: ["Tamil", "English"],
        experienceYears: 4.5,
        isFresher: false,
        presentAddress: FULL_PROFILE.presentAddress,
        permanentAddress: FULL_PROFILE.permanentAddress,
      });
    });

    it("persists the row in the hr schema, linked to the employee and the organization", async () => {
      const row = await prisma.employeeProfile.findUniqueOrThrow({
        where: { employeeId: emp.a1 },
      });
      expect(row.organizationId).toBe(orgA.id);
      expect(row.languages).toEqual(["Tamil", "English"]);
      expect(row.experienceYears?.toFixed(1)).toBe("4.5");
      expect(row.createdBy).toBe(userIds.hrAll);
    });

    it("writes a create audit row listing field NAMES only, never the values", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee_profile",
          action: "create",
          organizationId: orgA.id,
        },
        orderBy: { id: "desc" },
      });
      expect(audit.actorUserId).toBe(userIds.hrAll);
      expect(audit.after).toMatchObject({ employeeId: emp.a1 });
      const changed = (audit.after as { changedFields: string[] })
        .changedFields;
      expect(changed).toEqual(
        expect.arrayContaining(["fatherName", "presentAddress", "languages"]),
      );
      const text = JSON.stringify(audit.after);
      expect(text).not.toContain("Ravi");
      expect(text).not.toContain("Chennai");
      expect(text).not.toContain("Tamil");
    });

    it("partial update changes only the named fields; the rest keep their stored values", async () => {
      await patch("hrAll", profilePath(emp.a1), { gender: "Female" }).expect(
        200,
      );
      const r = await get("hrAll", profilePath(emp.a1)).expect(200);
      const profile = (r.body as Body<{ profile: Record<string, unknown> }>)
        .data.profile;
      expect(profile.gender).toBe("Female");
      expect(profile.fatherName).toBe("Ravi Kumar");
      expect(profile.languages).toEqual(["Tamil", "English"]);
    });

    it("an explicit null clears a field; an update writes an update audit row with field names", async () => {
      await patch("hrAll", profilePath(emp.a1), { fatherName: null }).expect(
        200,
      );
      const r = await get("hrAll", profilePath(emp.a1)).expect(200);
      expect(
        (r.body as Body<{ profile: Record<string, unknown> }>).data.profile
          .fatherName,
      ).toBeNull();
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee_profile",
          action: "update",
          organizationId: orgA.id,
        },
        orderBy: { id: "desc" },
      });
      expect(
        (audit.after as { changedFields: string[] }).changedFields,
      ).toEqual(["fatherName"]);
    });

    it("normalises languages: trims, drops duplicates", async () => {
      const r = await patch("hrAll", profilePath(emp.a1), {
        languages: [" Hindi ", "hindi", "Tamil"],
      }).expect(200);
      expect(
        (r.body as Body<{ profile: Record<string, unknown> }>).data.profile
          .languages,
      ).toEqual(["Hindi", "Tamil"]);
    });

    it("the profile response never contains sensitive identifiers", async () => {
      await patch("hrAll", sensitivePath(emp.a1), SENSITIVE).expect(200);
      const r = await get("hrAll", profilePath(emp.a1)).expect(200);
      const text = JSON.stringify(r.body);
      expect(text).not.toContain("ABCDE1234F");
      expect(text).not.toContain("123456789012");
      expect(text).not.toContain("SBIN0001234");
    });
  });

  // ---------------------------------------------------------------------------
  describe("validation", () => {
    it.each([
      ["unknown field: monthly salary", { monthlySalary: 50000 }],
      ["unknown field: employment status", { status: "Active" }],
      ["unknown field: allowances", { allowances: { basic: 1 } }],
      ["malformed date of birth", { dateOfBirth: "18-04-1992" }],
      ["impossible date of birth", { dateOfBirth: "1992-02-31" }],
      ["experience above the maximum", { experienceYears: 61 }],
      ["negative experience", { experienceYears: -1 }],
      ["experience with two decimals", { experienceYears: 1.25 }],
      [
        "more than ten languages",
        { languages: Array.from({ length: 11 }, (_, i) => `L${i}`) },
      ],
      [
        "address without a city",
        {
          presentAddress: {
            address: "12 Main",
            state: "TN",
            pincode: "600020",
          },
        },
      ],
      [
        "address with a bad pincode",
        {
          presentAddress: {
            address: "12 Main",
            city: "X",
            state: "TN",
            pincode: "@@",
          },
        },
      ],
      [
        "emergency phone with letters",
        { emergencyContactPhone: "call-me-maybe" },
      ],
    ])("400 for %s", async (_label, body) => {
      await patch("hrAll", profilePath(emp.a2), body).expect(400);
    });

    it.each([
      ["PAN in lower case", { panNumber: "abcde1234f" }],
      ["PAN with wrong shape", { panNumber: "ABCD51234F" }],
      ["Aadhaar with eleven digits", { aadhaarNumber: "12341234123" }],
      ["IFSC with a non-zero fifth character", { bankIfsc: "SBIN1001234" }],
      ["bank account with three digits", { bankAccountNo: "123" }],
      ["unknown field: a bank balance", { bankBalance: 10 }],
    ])("400 for sensitive data: %s", async (_label, body) => {
      await patch("hrAll", sensitivePath(emp.a2), body).expect(400);
    });

    it("a rejected write changes nothing", async () => {
      const before = await prisma.employeeProfile.findUnique({
        where: { employeeId: emp.a2 },
      });
      await patch("hrAll", profilePath(emp.a2), { experienceYears: 99 }).expect(
        400,
      );
      const after = await prisma.employeeProfile.findUnique({
        where: { employeeId: emp.a2 },
      });
      expect(after?.experienceYears?.toFixed(1) ?? null).toBe(
        before?.experienceYears?.toFixed(1) ?? null,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("sensitive record", () => {
    it("200 for the exact sensitive permission: reads back what was written", async () => {
      const r = await get("hrAll", sensitivePath(emp.a1)).expect(200);
      expect((r.body as Body<Record<string, unknown>>).data).toMatchObject(
        SENSITIVE,
      );
    });

    it("writes the sensitive row in the hr schema, and an update writes an audit row with field names only", async () => {
      await patch("hrAll", sensitivePath(emp.a1), {
        bankBranch: "Velachery",
      }).expect(200);
      const row = await prisma.employeeSensitiveInfo.findUniqueOrThrow({
        where: { employeeId: emp.a1 },
      });
      expect(row.organizationId).toBe(orgA.id);
      expect(row.bankBranch).toBe("Velachery");
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee_sensitive_info",
          action: "update",
          organizationId: orgA.id,
        },
        orderBy: { id: "desc" },
      });
      expect(
        (audit.after as { changedFields: string[] }).changedFields,
      ).toEqual(["bankBranch"]);
      expect(JSON.stringify([audit.before, audit.after])).not.toMatch(
        /Velachery|123456789012|ABCDE1234F/,
      );
    });

    it("every sensitive read writes a read_sensitive audit row before the data is returned", async () => {
      const before = await prisma.auditLog.count({
        where: {
          entityType: "employee_sensitive_info",
          action: "read_sensitive",
          organizationId: orgA.id,
        },
      });
      await get("hrAll", sensitivePath(emp.a1)).expect(200);
      const after = await prisma.auditLog.count({
        where: {
          entityType: "employee_sensitive_info",
          action: "read_sensitive",
          organizationId: orgA.id,
        },
      });
      expect(after).toBe(before + 1);
      const row = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee_sensitive_info",
          action: "read_sensitive",
          organizationId: orgA.id,
        },
        orderBy: { id: "desc" },
      });
      expect(row.actorUserId).toBe(userIds.hrAll);
      expect(JSON.stringify(row.after)).not.toMatch(/SBIN|123456789012|ABCDE/);
    });

    it("an employee with no sensitive record reads empty fields, not an error", async () => {
      const r = await get("hrAll", sensitivePath(emp.a2)).expect(200);
      expect((r.body as Body<Record<string, unknown>>).data).toMatchObject({
        panNumber: null,
        bankIfsc: null,
      });
    });

    it("another organization's employee is 404 on read and write; nothing changes", async () => {
      await get("hrAll", sensitivePath(emp.b1)).expect(404);
      await patch("hrAll", sensitivePath(emp.b1), {
        bankIfsc: "SBIN0001234",
      }).expect(404);
      await get("hrB", sensitivePath(emp.a1)).expect(404);
      await patch("hrB", sensitivePath(emp.a1), {
        bankIfsc: "HDFC0001234",
      }).expect(404);
      const row = await prisma.employeeSensitiveInfo.findUniqueOrThrow({
        where: { employeeId: emp.a1 },
      });
      expect(row.bankIfsc).toBe("SBIN0001234");
    });

    it("the employee-level profile is cross-organization isolated too", async () => {
      await get("hrB", profilePath(emp.a1)).expect(404);
      await patch("hrB", profilePath(emp.a1), { title: "Dr" }).expect(404);
      await get("hrB", profilePath(emp.b1)).expect(200);
    });

    it("exposes no delete route for profile or sensitive data", async () => {
      for (const path of [profilePath(emp.a1), sensitivePath(emp.a1)]) {
        const r = await request(app.getHttpServer())
          .delete(path)
          .set(auth("hrAll"));
        expect([404, 405]).toContain(r.status);
      }
      expect(
        await prisma.employeeProfile.findUnique({
          where: { employeeId: emp.a1 },
        }),
      ).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants", () => {
    it("one profile per employee", async () => {
      await expect(
        prisma.employeeProfile.create({
          data: { organizationId: orgA.id, employeeId: emp.a1 },
        }),
      ).rejects.toThrow();
    });

    it("rejects experience outside 0 to 60", async () => {
      await expect(
        prisma.employeeProfile.update({
          where: { employeeId: emp.a1 },
          data: { experienceYears: 61 },
        }),
      ).rejects.toThrow();
    });

    it("rejects an address stored as an array rather than an object", async () => {
      await expect(
        prisma.employeeProfile.update({
          where: { employeeId: emp.a1 },
          data: { presentAddress: [] },
        }),
      ).rejects.toThrow();
    });

    it("one sensitive record per employee", async () => {
      await expect(
        prisma.employeeSensitiveInfo.create({
          data: { organizationId: orgA.id, employeeId: emp.a1 },
        }),
      ).rejects.toThrow();
    });
  });
});
