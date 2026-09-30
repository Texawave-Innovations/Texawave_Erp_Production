import { Controller, Get, Query, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Prisma } from "@texawave-erp/database";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../src/common/decorators/require-permission.decorator.js";
import { tenantWhere } from "../src/common/tenancy/tenant-where.js";
import { teamWhere } from "../src/common/tenancy/team-where.js";
import { AppModule } from "../src/app.module.js";
import { TeamContextService } from "../src/platform/tenancy/team-context.service.js";
import { TenantContextService } from "../src/platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Proof of the RBAC + team-scope skeleton that Docs/ARCHITECTURE.md §8 step 3
 * asks for and that nothing had exercised until now: the any-scope permission
 * guard, `TeamContextService.resolveScope()` and `teamWhere()` working together
 * over real HTTP, Postgres and Redis — including the negative cases (a team
 * lead is filtered away from another team's rows, `.own` sees only itself, no
 * cross-organization access, revocation is immediate).
 *
 * No HR module exists yet, so this registers a test-only probe controller next
 * to `AppModule`. `user_team_access` is the fixture table because it already
 * carries both a `userId` and a `teamId` column, like `employees` will.
 */
const PREFIX = "testscope.membership.read";

@Controller("__test/team-scope")
class TeamScopeProbeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly team: TeamContextService,
    private readonly tenant: TenantContextService,
  ) {}

  private async rows(
    fields: { teamField?: string; ownerField?: string },
    teamIdFilter?: string,
  ) {
    const scope = await this.team.resolveScope(PREFIX);
    const where: Prisma.UserTeamAccessWhereInput = teamWhere(
      scope,
      tenantWhere<Prisma.UserTeamAccessWhereInput>(this.tenant.getOrgScope(), {
        deletedAt: null,
        ...(teamIdFilter ? { teamId: Number(teamIdFilter) } : {}),
      }),
      fields,
    );
    const found = await this.prisma.userTeamAccess.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return { level: scope.level, ids: found.map((r) => r.id) };
  }

  @Get("memberships")
  @RequireScopedPermission(PREFIX)
  list(@Query("teamId") teamId?: string) {
    return this.rows({}, teamId);
  }

  /** Same data through dotted field paths (relation-keyed tables such as
   * attendance/leave rows will use `employee.teamId`). */
  @Get("memberships-nested")
  @RequireScopedPermission(PREFIX)
  listNested() {
    return this.rows({ teamField: "team.id", ownerField: "user.id" });
  }

  /** Exact-match route: unchanged behaviour of `@RequirePermission`. */
  @Get("exact-team-only")
  @RequirePermission(`${PREFIX}.team`)
  exactTeamOnly() {
    return { ok: true };
  }

  /** A route that forgot the guard decorator but still resolves a scope:
   * must fail as 403, not 500 and not with a default scope. */
  @Get("unguarded-resolve")
  unguardedResolve() {
    return this.rows({});
  }
}

interface Body<T> {
  data: T;
}
type Listing = { level: string; ids: number[] };

describe("team scope & any-scope permissions (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: number[] = [];
  const row: Record<string, number> = {}; // "user@team" -> user_team_access.id
  let permissionIds: number[] = [];
  let team1: number;
  let team2: number;
  let leadT1Id: number;

  const suffix = randomUUID().slice(0, 8);

  const get = (path: string, who: string) =>
    request(app.getHttpServer())
      .get(`/__test/team-scope/${path}`)
      .set("Authorization", `Bearer ${tokens[who] ?? ""}`);

  const listing = async (who: string, path = "memberships") =>
    (await get(path, who).expect(200)).body as Body<Listing>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TeamScopeProbeController],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `TS Org A ${suffix}`, slug: `ts-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `TS Org B ${suffix}`, slug: `ts-b-${suffix}` },
    });

    const perms: Record<string, number> = {};
    for (const level of ["own", "team", "all"]) {
      const code = `${PREFIX}.${level}`;
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: `test ${level}` },
      });
      perms[level] = p.id;
    }
    permissionIds = Object.values(perms);

    const mkTeam = (orgId: number, code: string, isActive = true) =>
      prisma.team.create({
        data: { organizationId: orgId, name: code, code, isActive },
      });
    const t1 = await mkTeam(orgA.id, `T1-${suffix}`);
    const t2 = await mkTeam(orgA.id, `T2-${suffix}`);
    const t3Inactive = await mkTeam(orgA.id, `T3-${suffix}`, false);
    const tB = await mkTeam(orgB.id, `TB-${suffix}`);
    team1 = t1.id;
    team2 = t2.id;

    async function mkUser(
      orgId: number,
      key: string,
      permissionKeys: string[],
      orgSlug: string,
    ) {
      const role = await prisma.role.create({
        data: { organizationId: orgId, name: `role-${key}-${suffix}` },
      });
      if (permissionKeys.length) {
        await prisma.rolePermission.createMany({
          data: permissionKeys.map((k) => ({
            roleId: role.id,
            permissionId: perms[k] as number,
          })),
        });
      }
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email: `${key}@${orgSlug}.test`,
          passwordHash,
          fullName: key,
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      userIds.push(user.id);
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          organizationSlug: orgSlug,
          email: user.email,
          password: "Password123!",
        })
        .expect(201);
      tokens[key] = (
        login.body as Body<{ accessToken: string }>
      ).data.accessToken;
      return user.id;
    }

    leadT1Id = await mkUser(orgA.id, "leadT1", ["team"], orgA.slug);
    const leadT2Id = await mkUser(orgA.id, "leadT2", ["team"], orgA.slug);
    const member1Id = await mkUser(orgA.id, "member1", ["own"], orgA.slug);
    const member2Id = await mkUser(orgA.id, "member2", ["own"], orgA.slug);
    const member3Id = await mkUser(orgA.id, "member3", ["own"], orgA.slug);
    await mkUser(orgA.id, "hrAll", ["all"], orgA.slug);
    await mkUser(orgA.id, "noPerm", [], orgA.slug);
    const multiId = await mkUser(
      orgA.id,
      "multi", // holds .own AND .team — most permissive must win
      ["own", "team"],
      orgA.slug,
    );
    const userBId = await mkUser(orgB.id, "adminB", ["all"], orgB.slug);

    async function member(
      orgId: number,
      key: string,
      userId: number,
      teamId: number,
      extra: { isActive?: boolean; deletedAt?: Date } = {},
    ) {
      const created = await prisma.userTeamAccess.create({
        data: { organizationId: orgId, userId, teamId, ...extra },
      });
      row[key] = created.id;
    }
    await member(orgA.id, "leadT1@T1", leadT1Id, t1.id);
    await member(orgA.id, "member1@T1", member1Id, t1.id);
    await member(orgA.id, "member2@T1", member2Id, t1.id);
    await member(orgA.id, "leadT2@T2", leadT2Id, t2.id);
    await member(orgA.id, "member3@T2", member3Id, t2.id);
    await member(orgA.id, "multi@T2", multiId, t2.id);
    // leadT1's *deactivated* membership of T2 and membership of a deactivated
    // team must not widen leadT1's scope.
    await member(orgA.id, "leadT1@T2(revoked)", leadT1Id, t2.id, {
      isActive: false,
    });
    await member(orgA.id, "leadT1@T3(team inactive)", leadT1Id, t3Inactive.id);
    // A soft-deleted row is invisible to everyone.
    await member(orgA.id, "member2@T2(deleted)", member2Id, t2.id, {
      deletedAt: new Date(),
    });
    await member(orgB.id, "adminB@TB", userBId, tB.id);
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.userTeamAccess.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.team.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: permissionIds } },
    });
    await prisma.permission.deleteMany({
      where: { id: { in: permissionIds } },
    });
    await Promise.all(
      userIds.flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    await app.close();
  });

  const ids = (...keys: string[]) =>
    keys.map((k) => row[k]).sort((a, b) => (a as number) - (b as number));
  const sorted = (l: Listing) => [...l.ids].sort((a, b) => a - b);

  describe("access to the route", () => {
    it("rejects an unauthenticated request with 401", async () => {
      await request(app.getHttpServer())
        .get("/__test/team-scope/memberships")
        .expect(401);
    });

    it("rejects a caller holding none of .own/.team/.all with 403", async () => {
      await get("memberships", "noPerm").expect(403);
    });

    it.each(["member1", "leadT1", "hrAll"])(
      "admits a caller holding only one variant (%s)",
      async (who) => {
        await get("memberships", who).expect(200);
      },
    );
  });

  describe("row scoping", () => {
    it(".all sees every non-deleted row of its organization, and only its organization", async () => {
      const { data } = await listing("hrAll");
      expect(data.level).toBe("all");
      expect(sorted(data)).toEqual(
        ids(
          "leadT1@T1",
          "member1@T1",
          "member2@T1",
          "leadT2@T2",
          "member3@T2",
          "multi@T2",
          "leadT1@T2(revoked)",
          "leadT1@T3(team inactive)",
        ),
      );
      expect(data.ids).not.toContain(row["adminB@TB"]);
      expect(data.ids).not.toContain(row["member2@T2(deleted)"]);
    });

    it(".team sees its own team's rows and nothing from another team (negative test)", async () => {
      const { data } = await listing("leadT1");
      expect(data.level).toBe("team");
      expect(sorted(data)).toEqual(
        ids("leadT1@T1", "member1@T1", "member2@T1"),
      );
      for (const other of ["leadT2@T2", "member3@T2", "multi@T2"]) {
        expect(data.ids).not.toContain(row[other]);
      }
    });

    it(".team is not widened by a revoked membership or an inactive team", async () => {
      const { data } = await listing("leadT1");
      expect(data.ids).not.toContain(row["leadT1@T2(revoked)"]);
      expect(data.ids).not.toContain(row["leadT1@T3(team inactive)"]);
    });

    it("a different team lead gets that team's rows, not the first lead's", async () => {
      const { data } = await listing("leadT2");
      expect(sorted(data)).toEqual(
        ids("leadT2@T2", "member3@T2", "multi@T2", "leadT1@T2(revoked)"),
      );
    });

    it(".own sees only the caller's own row", async () => {
      const { data } = await listing("member1");
      expect(data.level).toBe("own");
      expect(sorted(data)).toEqual(ids("member1@T1"));
    });

    it("a caller holding .own and .team is resolved to the most permissive one (.team)", async () => {
      const { data } = await listing("multi");
      expect(data.level).toBe("team");
      expect(sorted(data)).toEqual(
        ids("leadT2@T2", "member3@T2", "multi@T2", "leadT1@T2(revoked)"),
      );
    });

    it("another organization's .all caller sees only its own organization", async () => {
      const { data } = await listing("adminB");
      expect(data.ids).toEqual(ids("adminB@TB"));
    });
  });

  describe("a caller-supplied filter can narrow but never widen the scope", () => {
    it("teamId filter for a team outside the caller's scope returns nothing (not the caller's own team)", async () => {
      const { data } = await get(`memberships?teamId=${team2}`, "leadT1")
        .expect(200)
        .then((r) => r.body as Body<Listing>);
      expect(data.ids).toEqual([]);
    });

    it("teamId filter inside the scope is honoured", async () => {
      const { data } = await get(`memberships?teamId=${team1}`, "leadT1")
        .expect(200)
        .then((r) => r.body as Body<Listing>);
      expect(sorted(data)).toEqual(
        ids("leadT1@T1", "member1@T1", "member2@T1"),
      );
    });

    it(".own with a teamId filter never exposes other users' rows", async () => {
      const { data } = await get(`memberships?teamId=${team1}`, "member1")
        .expect(200)
        .then((r) => r.body as Body<Listing>);
      expect(data.ids).toEqual(ids("member1@T1"));
    });

    it(".all may use the filter to narrow", async () => {
      const { data } = await get(`memberships?teamId=${team2}`, "hrAll")
        .expect(200)
        .then((r) => r.body as Body<Listing>);
      expect(sorted(data)).toEqual(
        ids("leadT2@T2", "member3@T2", "multi@T2", "leadT1@T2(revoked)"),
      );
    });
  });

  describe("dotted field paths (relation-keyed tables)", () => {
    it("scopes identically through team.id / user.id paths", async () => {
      expect(
        sorted((await listing("leadT1", "memberships-nested")).data),
      ).toEqual(ids("leadT1@T1", "member1@T1", "member2@T1"));
      expect((await listing("member1", "memberships-nested")).data.ids).toEqual(
        ids("member1@T1"),
      );
      expect(
        (await listing("hrAll", "memberships-nested")).data.ids,
      ).toHaveLength(8);
    });
  });

  describe("@RequirePermission (exact) is unchanged", () => {
    it("admits only the exact permission — an .all holder is NOT admitted to a .team-only route", async () => {
      await get("exact-team-only", "leadT1").expect(200);
      await get("exact-team-only", "hrAll").expect(403);
      await get("exact-team-only", "noPerm").expect(403);
    });
  });

  describe("fail-closed behaviour", () => {
    it("a route that resolves a scope without the guard decorator returns 403 (not 500) for a caller with no grant", async () => {
      await get("unguarded-resolve", "noPerm").expect(403);
    });

    it("...and still scopes correctly for a caller who does hold a grant", async () => {
      const { data } = await listing("member1", "unguarded-resolve");
      expect(data.ids).toEqual(ids("member1@T1"));
    });
  });

  describe("revocation", () => {
    it("deactivating a lead's team membership takes effect on the very next request", async () => {
      expect((await listing("leadT1")).data.ids).toHaveLength(3);

      await prisma.userTeamAccess.update({
        where: { id: row["leadT1@T1"] as number },
        data: { isActive: false },
      });

      // Same token, no re-login: team ids are resolved per request.
      expect((await listing("leadT1")).data.ids).toEqual([]);

      await prisma.userTeamAccess.update({
        where: { id: row["leadT1@T1"] as number },
        data: { isActive: true },
      });
      expect((await listing("leadT1")).data.ids).toHaveLength(3);
      expect(leadT1Id).toBeGreaterThan(0);
    });
  });
});
