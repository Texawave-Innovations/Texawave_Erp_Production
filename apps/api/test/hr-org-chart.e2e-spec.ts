import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * HR org chart, end to end: permission enforcement, organization isolation,
 * team/own scope, hierarchy shape, depth, department filter, the
 * direct-reports endpoint, and the fields that leave the API.
 */
interface Body<T> {
  data: T;
}
interface Node {
  id: number;
  employeeCode: string;
  fullName: string;
  reportsToId: number | null;
  directReportCount: number;
  children: Node[];
  workEmail?: string;
  phone?: string;
  salary?: unknown;
}

const PERMS = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
];

/** Flattens a forest to the ids it contains, depth-first. */
const allIds = (nodes: Node[]): number[] =>
  nodes.flatMap((n) => [n.id, ...allIds(n.children)]);

describe("HR org chart (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let orgEmpty: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let passwordHash: string;

  let team1: number;
  let team2: number;
  let deptEng: number;
  let deptOps: number;
  let desig: number;
  let empType: number;
  let teamB: number;
  let desigB: number;
  let empTypeB: number;

  // Org A tree:  top(team1) -> mid(team1) -> leaf(team1)
  //              top -> crossTeamReport(team2)   (reports to top, team2)
  //              mid -> gone (RESIGNED, must not show) -> ghost (team1, reports to gone)
  //              opsRoot (team1, dept Ops) -> opsChild (team1, dept Ops)
  // Team2 boss(team2) -> teamTwoReport(team2)   (so team1 user cannot see boss)
  const ids: Record<string, number> = {};
  let orgBBoss: number;
  let orgBReport: number;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));

  let counter = 0;
  const emp = async (
    org: { id: number },
    over: {
      name: string;
      teamId: number;
      departmentId?: number | null;
      reportsToId?: number | null;
      designationId?: number;
      employmentTypeId?: number;
      status?: string;
      workEmail?: string;
    },
  ) => {
    counter += 1;
    const row = await prisma.employee.create({
      data: {
        organizationId: org.id,
        employeeCode: `EMP-${String(counter).padStart(6, "0")}`,
        fullName: over.name,
        teamId: over.teamId,
        departmentId: over.departmentId ?? null,
        designationId: over.designationId ?? desig,
        employmentTypeId: over.employmentTypeId ?? empType,
        reportsToId: over.reportsToId ?? null,
        status: over.status ?? "ACTIVE",
        // Exit statuses carry an exit date and reason (DB CHECK).
        // DB CHECK: isActive must agree with status.
        isActive: (over.status ?? "ACTIVE") === "ACTIVE",
        ...(over.status === "RESIGNED"
          ? {
              dateOfExit: new Date("2026-03-01T00:00:00Z"),
              exitReason: "Resigned",
            }
          : {}),
        dateOfJoining: new Date("2026-01-05T00:00:00Z"),
        workEmail: over.workEmail ?? null,
        phone: "+91 90000 00000",
      },
    });
    return row.id;
  };

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    teamIds: number[] = [],
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
        passwordHash,
        fullName: `User ${key}`,
        isActive: true,
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
    const res = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(res.status).toBe(201);
    tokens[key] = (res.body as Body<{ accessToken: string }>).data.accessToken;
    return user;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await bcrypt.hash("Password123!", 10);

    orgA = await prisma.organization.create({
      data: {
        name: `Chart A ${suffix}`,
        slug: `chart-a-${suffix.toLowerCase()}`,
      },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Chart B ${suffix}`,
        slug: `chart-b-${suffix.toLowerCase()}`,
      },
    });
    orgEmpty = await prisma.organization.create({
      data: {
        name: `Chart E ${suffix}`,
        slug: `chart-e-${suffix.toLowerCase()}`,
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

    deptEng = (
      await prisma.department.create({
        data: { organizationId: orgA.id, name: `Eng ${suffix}` },
      })
    ).id;
    deptOps = (
      await prisma.department.create({
        data: { organizationId: orgA.id, name: `Ops ${suffix}` },
      })
    ).id;
    team1 = (
      await prisma.team.create({
        data: {
          organizationId: orgA.id,
          name: "T1",
          code: `T1${suffix}`,
          departmentId: deptEng,
        },
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
    desig = (
      await prisma.designation.create({
        data: {
          organizationId: orgA.id,
          code: `ENG_${suffix}`,
          name: `Engineer ${suffix}`,
        },
      })
    ).id;
    desigB = (
      await prisma.designation.create({
        data: {
          organizationId: orgB.id,
          code: `ENG_${suffix}`,
          name: `Engineer ${suffix}`,
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgA.id,
          code: `PERM_${suffix}`,
          name: `Permanent ${suffix}`,
        },
      })
    ).id;
    empTypeB = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgB.id,
          code: `PERM_${suffix}`,
          name: `Permanent ${suffix}`,
        },
      })
    ).id;

    // Org A — team 1 under Engineering
    ids.top = await emp(orgA, {
      name: "Anita Top",
      teamId: team1,
      departmentId: deptEng,
      workEmail: "anita@x.test",
    });
    ids.mid = await emp(orgA, {
      name: "Bala Mid",
      teamId: team1,
      departmentId: deptEng,
      reportsToId: ids.top,
    });
    ids.leaf = await emp(orgA, {
      name: "Chitra Leaf",
      teamId: team1,
      departmentId: deptEng,
      reportsToId: ids.mid,
    });
    ids.gone = await emp(orgA, {
      name: "Dev Gone",
      teamId: team1,
      departmentId: deptEng,
      reportsToId: ids.mid,
      status: "RESIGNED",
    });
    ids.ghost = await emp(orgA, {
      name: "Esha Ghost",
      teamId: team1,
      departmentId: deptEng,
      reportsToId: ids.gone,
    });
    // Cross-team: reports to top (team 1), but sits in team 2
    ids.crossTeam = await emp(orgA, {
      name: "Farid CrossTeam",
      teamId: team2,
      departmentId: deptEng,
      reportsToId: ids.top,
    });
    // Team 2 boss: a team-1-only user must not see them
    ids.boss2 = await emp(orgA, {
      name: "Gita Boss2",
      teamId: team2,
      departmentId: deptEng,
    });
    ids.report2 = await emp(orgA, {
      name: "Hari Report2",
      teamId: team2,
      departmentId: deptEng,
      reportsToId: ids.boss2,
    });
    // Operations department, separate tree
    ids.opsRoot = await emp(orgA, {
      name: "Ila OpsRoot",
      teamId: team1,
      departmentId: deptOps,
    });
    ids.opsChild = await emp(orgA, {
      name: "Jay OpsChild",
      teamId: team1,
      departmentId: deptOps,
      reportsToId: ids.opsRoot,
    });

    // Org B — must never leak into org A's chart
    orgBBoss = await prisma.employee
      .create({
        data: {
          organizationId: orgB.id,
          employeeCode: "EMP-900001",
          fullName: "Other Org Boss",
          teamId: teamB,
          designationId: desigB,
          employmentTypeId: empTypeB,
          dateOfJoining: new Date("2026-01-05T00:00:00Z"),
        },
      })
      .then((r) => r.id);
    orgBReport = await prisma.employee
      .create({
        data: {
          organizationId: orgB.id,
          employeeCode: "EMP-900002",
          fullName: "Other Org Report",
          teamId: teamB,
          designationId: desigB,
          employmentTypeId: empTypeB,
          dateOfJoining: new Date("2026-01-05T00:00:00Z"),
          reportsToId: orgBBoss,
        },
      })
      .then((r) => r.id);

    await mkUser(orgA, "all", ["hr.employee.read.all"]);
    await mkUser(orgA, "team1", ["hr.employee.read.team"], [team1]);
    await mkUser(orgA, "own", ["hr.employee.read.own"]);
    await mkUser(orgA, "none", []);
    await mkUser(orgB, "allB", ["hr.employee.read.all"]);
    await mkUser(orgEmpty, "allE", ["hr.employee.read.all"]);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("permission enforcement", () => {
    it("rejects an anonymous request", async () => {
      await request(app.getHttpServer()).get("/hr/org-chart").expect(401);
    });

    it("rejects a user who holds no employee-read permission", async () => {
      await get("none", "/hr/org-chart").expect(403);
      await get("none", `/hr/employees/${ids.top}/direct-reports`).expect(403);
    });
  });

  describe("organization isolation", () => {
    it("an org-wide reader sees only their own organization's employees", async () => {
      const res = await get("all", "/hr/org-chart").expect(200);
      const seen = allIds((res.body as Body<Node[]>).data);
      expect(seen).toContain(ids.top);
      expect(seen).not.toContain(orgBBoss);
      expect(seen).not.toContain(orgBReport);
    });

    it("another org's employee is a 404 when used as the subtree root", async () => {
      await get("all", `/hr/org-chart?rootEmployeeId=${orgBBoss}`).expect(404);
    });

    it("another org's employee is a 404 for direct reports", async () => {
      await get("all", `/hr/employees/${orgBBoss}/direct-reports`).expect(404);
    });

    it("an org with no employees gets an empty chart, not an error", async () => {
      const res = await get("allE", "/hr/org-chart").expect(200);
      expect((res.body as Body<Node[]>).data).toEqual([]);
    });
  });

  describe("team and own scope", () => {
    it("a team reader sees their team's employees, not other teams'", async () => {
      const res = await get("team1", "/hr/org-chart").expect(200);
      const seen = allIds((res.body as Body<Node[]>).data);
      expect(seen).toContain(ids.leaf);
      expect(seen).not.toContain(ids.boss2);
      expect(seen).not.toContain(ids.report2);
    });

    it("a team-2 report of a team-1 manager is hidden from a team-1 reader", async () => {
      // crossTeam (team 2) reports to top (team 1). Scope is per employee's
      // own team, so the team-1 reader does not see crossTeam at all.
      const res = await get("team1", "/hr/org-chart").expect(200);
      const seen = allIds((res.body as Body<Node[]>).data);
      expect(seen).not.toContain(ids.crossTeam);
    });

    it("an own-scoped reader sees only themselves", async () => {
      const res = await get("own", "/hr/org-chart").expect(200);
      const data = (res.body as Body<Node[]>).data;
      expect(data).toEqual([]);
    });

    it("an own-scoped reader cannot open another person's direct reports", async () => {
      await get("own", `/hr/employees/${ids.top}/direct-reports`).expect(404);
    });
  });

  describe("hierarchy shape", () => {
    let chart: Node[];
    beforeAll(async () => {
      const res = await get(
        "all",
        `/hr/org-chart?departmentId=${deptEng}`,
      ).expect(200);
      chart = (res.body as Body<Node[]>).data;
    });

    it("places a top-level employee at the root", () => {
      expect(chart.map((n) => n.id)).toContain(ids.top);
    });

    it("nests direct reports and counts them", () => {
      const top = chart.find((n) => n.id === ids.top)!;
      expect(top.directReportCount).toBe(2);
      expect(top.children.map((c) => c.id)).toEqual(
        expect.arrayContaining([ids.mid, ids.crossTeam]),
      );
    });

    it("nests reports of reports", () => {
      const top = chart.find((n) => n.id === ids.top)!;
      const mid = top.children.find((c) => c.id === ids.mid)!;
      expect(mid.children.map((c) => c.id)).toEqual([ids.leaf]);
    });

    it("returns an employee with no reports as a leaf", () => {
      const top = chart.find((n) => n.id === ids.top)!;
      const mid = top.children.find((c) => c.id === ids.mid)!;
      const leaf = mid.children.find((c) => c.id === ids.leaf)!;
      expect(leaf.children).toEqual([]);
      expect(leaf.directReportCount).toBe(0);
    });

    it("hides RESIGNED employees, and their reports become top-level", () => {
      expect(allIds(chart)).not.toContain(ids.gone);
      expect(allIds(chart)).toContain(ids.ghost);
      expect(chart.map((n) => n.id)).toContain(ids.ghost);
    });

    it("keeps the department filter: Operations is not in the Engineering chart", () => {
      expect(allIds(chart)).not.toContain(ids.opsRoot);
    });

    it("returns Operations as its own tree when filtered to it", async () => {
      const res = await get(
        "all",
        `/hr/org-chart?departmentId=${deptOps}`,
      ).expect(200);
      const data = (res.body as Body<Node[]>).data;
      expect(data.map((n) => n.id)).toEqual([ids.opsRoot]);
      expect(data[0]!.children.map((c) => c.id)).toEqual([ids.opsChild]);
    });

    it("returns a subtree when rootEmployeeId is given", async () => {
      const res = await get(
        "all",
        `/hr/org-chart?rootEmployeeId=${ids.mid}`,
      ).expect(200);
      const data = (res.body as Body<Node[]>).data;
      expect(data.map((n) => n.id)).toEqual([ids.mid]);
      expect(data[0]!.children.map((c) => c.id)).toEqual([ids.leaf]);
    });

    it("cuts depth at the requested level and reports what lies below", async () => {
      const res = await get(
        "all",
        `/hr/org-chart?rootEmployeeId=${ids.top}&depth=1`,
      ).expect(200);
      const top = (res.body as Body<Node[]>).data[0]!;
      expect(top.children).toEqual([]);
      expect(top.directReportCount).toBe(2);
    });

    it("rejects an out-of-range depth", async () => {
      await get("all", "/hr/org-chart?depth=11").expect(400);
      await get("all", "/hr/org-chart?depth=0").expect(400);
    });

    it("rejects a non-numeric root", async () => {
      await get("all", "/hr/org-chart?rootEmployeeId=abc").expect(400);
    });

    it("exposes only chart fields — no contact details", () => {
      const top = chart.find((n) => n.id === ids.top)!;
      expect(top.workEmail).toBeUndefined();
      expect(top.phone).toBeUndefined();
      expect(top.salary).toBeUndefined();
    });
  });

  describe("direct reports endpoint", () => {
    it("lists a manager's visible reports, ordered by name", async () => {
      const res = await get(
        "all",
        `/hr/employees/${ids.top}/direct-reports`,
      ).expect(200);
      const data = (res.body as Body<Node[]>).data;
      expect(data.map((n) => n.fullName)).toEqual([
        "Bala Mid",
        "Farid CrossTeam",
      ]);
    });

    it("returns each report's visible direct-report count", async () => {
      const res = await get(
        "all",
        `/hr/employees/${ids.top}/direct-reports`,
      ).expect(200);
      const mid = (res.body as Body<Node[]>).data.find(
        (n) => n.id === ids.mid,
      )!;
      expect(mid.directReportCount).toBe(1);
    });

    it("returns an empty list for a visible employee with no reports", async () => {
      const res = await get(
        "all",
        `/hr/employees/${ids.leaf}/direct-reports`,
      ).expect(200);
      expect((res.body as Body<Node[]>).data).toEqual([]);
    });

    it("applies the caller's team scope to the reports it returns", async () => {
      await get("team1", `/hr/employees/${ids.boss2}/direct-reports`).expect(
        404,
      );
    });
  });
});
