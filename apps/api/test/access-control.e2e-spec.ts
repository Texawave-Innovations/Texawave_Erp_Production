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
 * Access control, phase 2 (Docs/ARCHITECTURE.md §11, 2026-10-11): role
 * version (optimistic lock), system-role protection, "in use" deactivation
 * guard, the lock-out guard on "Manage roles", clone, per-role history and a
 * user's effective permissions — with permission and organization denial.
 */
interface Body<T> {
  data: T;
}
interface RoleDetail {
  id: number;
  name: string;
  version: number;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  lastChangedBy: { id: number; fullName: string } | null;
  permissions: { id: number; code: string }[];
}
interface RoleRow {
  id: number;
  userCount: number;
  permissionCount: number;
  isSystem: boolean;
  version: number;
}
interface AuditRow {
  action: string;
  after: Record<string, unknown> | null;
}
interface Effective {
  roles: { id: number; name: string; isActive: boolean }[];
  permissions: {
    code: string;
    grantedBy: { roleId: number; roleName: string }[];
  }[];
}

const CODES = [
  "settings.role.read",
  "settings.role.write",
  "users.user.read",
  "users.user.write",
  "hr.holiday.read",
  "hr.holiday.write",
];

describe("Access control — role lifecycle (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let org: { id: number; slug: string };
  let other: { id: number; slug: string };
  const perm = new Map<string, number>();
  const tokens: Record<string, string> = {};
  const users: Record<string, number> = {};
  const roles: Record<string, number> = {};
  const suffix = randomUUID().slice(0, 8);

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());
  const get = (who: string, path: string) => http().get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    http().post(path).set(auth(who)).send(body);
  const put = (who: string, path: string, body: object) =>
    http().put(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object) =>
    http().patch(path).set(auth(who)).send(body);
  const data = <T>(res: { body: unknown }) => (res.body as Body<T>).data;
  const errorOf = (res: { body: unknown }) =>
    (res.body as { error?: string }).error;
  const detail = async (id: number) =>
    data<RoleDetail>(await get("admin", `/settings/roles/${id}`));
  const ids = (...codes: string[]) => codes.map((c) => perm.get(c)!);

  async function mkRole(
    o: { id: number },
    key: string,
    codes: string[],
    isSystem = false,
  ) {
    const role = await prisma.role.create({
      data: { organizationId: o.id, name: `${key}-${suffix}`, isSystem },
    });
    if (codes.length) {
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perm.get(c)!,
        })),
      });
    }
    roles[key] = role.id;
    return role.id;
  }

  async function mkUser(
    o: { id: number; slug: string },
    key: string,
    roleIds: number[],
  ) {
    const user = await prisma.user.create({
      data: {
        organizationId: o.id,
        email: `${key}-${suffix}@${o.slug}.test`,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    for (const roleId of roleIds)
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    const login = await http().post("/auth/login").send({
      organizationSlug: o.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    users[key] = user.id;
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
      data: { name: `AC ${suffix}`, slug: `ac-${suffix}` },
    });
    other = await prisma.organization.create({
      data: { name: `AC2 ${suffix}`, slug: `ac2-${suffix}` },
    });
    for (const code of CODES) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }

    await mkRole(org, "admin", [
      "settings.role.read",
      "settings.role.write",
      "users.user.read",
    ]);
    await mkRole(org, "secondAdmin", [
      "settings.role.read",
      "settings.role.write",
    ]);
    await mkRole(org, "reader", ["settings.role.read"]);
    await mkRole(org, "system", ["hr.holiday.read"], true);
    await mkRole(org, "holidays", ["hr.holiday.read", "hr.holiday.write"]);
    await mkRole(org, "unused", ["hr.holiday.read"]);
    await mkRole(other, "otherAdmin", [
      "settings.role.read",
      "settings.role.write",
      "users.user.read",
    ]);

    await mkUser(org, "admin", [roles.admin!, roles.holidays!]);
    await mkUser(org, "admin2", [roles.secondAdmin!]);
    await mkUser(org, "reader", [roles.reader!, roles.system!]);
    await mkUser(other, "otherAdmin", [roles.otherAdmin!]);
  });

  afterAll(async () => {
    // Role changes are audited (append-only), so the organizations stay; only
    // this suite's cache keys are removed.
    await Promise.all(
      Object.values(users).map((id) => redis?.del(`permissions:${id}`)),
    );
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  it("lists roles with member and permission counts, version and the system flag", async () => {
    const res = await get("admin", "/settings/roles?limit=100");
    expect(res.status).toBe(200);
    const rows = data<RoleRow[]>(res);
    const holidays = rows.find((r) => r.id === roles.holidays)!;
    expect(holidays).toMatchObject({
      userCount: 1,
      permissionCount: 2,
      isSystem: false,
      version: 1,
    });
    expect(rows.find((r) => r.id === roles.system)!.isSystem).toBe(true);
    expect(rows.map((r) => r.id)).not.toContain(roles.otherAdmin);
  });

  it("refuses a stale version and accepts the current one, bumping it", async () => {
    const before = await detail(roles.holidays!);
    const ok = await put(
      "admin",
      `/settings/roles/${roles.holidays}/permissions`,
      {
        permissionIds: ids("hr.holiday.read"),
        version: before.version,
      },
    );
    expect(ok.status).toBe(200);
    expect(data<RoleDetail>(ok)).toMatchObject({
      version: before.version + 1,
      lastChangedBy: { id: users.admin },
    });

    const stale = await put(
      "admin",
      `/settings/roles/${roles.holidays}/permissions`,
      {
        permissionIds: ids("hr.holiday.read", "hr.holiday.write"),
        version: before.version,
      },
    );
    expect(stale.status).toBe(409);
    expect(errorOf(stale)).toBe("VERSION_CONFLICT");
    expect(
      (await detail(roles.holidays!)).permissions.map((p) => p.code),
    ).toEqual(["hr.holiday.read"]);

    const rename = await patch("admin", `/settings/roles/${roles.holidays}`, {
      name: `Leave ${suffix}`,
      version: 1,
    });
    expect(errorOf(rename)).toBe("VERSION_CONFLICT");
  });

  it("system roles keep their name and stay active, but their grants are editable", async () => {
    const rename = await patch("admin", `/settings/roles/${roles.system}`, {
      name: "Renamed",
    });
    expect(rename.status).toBe(422);
    expect(errorOf(rename)).toBe("SYSTEM_ROLE_PROTECTED");
    const deactivate = await patch("admin", `/settings/roles/${roles.system}`, {
      isActive: false,
    });
    expect(errorOf(deactivate)).toBe("SYSTEM_ROLE_PROTECTED");
    const grants = await put(
      "admin",
      `/settings/roles/${roles.system}/permissions`,
      {
        permissionIds: ids("hr.holiday.read", "hr.holiday.write"),
      },
    );
    expect(grants.status).toBe(200);
    const describe = await patch("admin", `/settings/roles/${roles.system}`, {
      description: "Read the calendar",
    });
    expect(describe.status).toBe(200);
  });

  it("a role users still hold cannot be deactivated; an unused one can", async () => {
    const inUse = await patch("admin", `/settings/roles/${roles.reader}`, {
      isActive: false,
    });
    expect(inUse.status).toBe(409);
    expect(errorOf(inUse)).toBe("ROLE_IN_USE");
    const unused = await patch("admin", `/settings/roles/${roles.unused}`, {
      isActive: false,
    });
    expect(unused.status).toBe(200);
    expect(data<RoleDetail>(unused).isActive).toBe(false);
  });

  it("refuses to remove Manage roles from the caller", async () => {
    const res = await put(
      "admin",
      `/settings/roles/${roles.admin}/permissions`,
      {
        permissionIds: ids("settings.role.read", "users.user.read"),
      },
    );
    expect(res.status).toBe(409);
    expect(errorOf(res)).toBe("ACCESS_LOCKOUT");
    expect(
      (await detail(roles.admin!)).permissions.map((p) => p.code),
    ).toContain("settings.role.write");
  });

  it("another admin may remove it from the caller's role while someone keeps it", async () => {
    const res = await put(
      "admin2",
      `/settings/roles/${roles.admin}/permissions`,
      {
        permissionIds: ids("settings.role.read", "users.user.read"),
      },
    );
    expect(res.status).toBe(200);
    // Put it back for the remaining tests (admin2 still holds it).
    const back = await put(
      "admin2",
      `/settings/roles/${roles.admin}/permissions`,
      {
        permissionIds: ids(
          "settings.role.read",
          "settings.role.write",
          "users.user.read",
        ),
      },
    );
    expect(back.status).toBe(200);
  });

  it("refuses a change that would leave nobody able to manage roles", async () => {
    // admin2 is the only holder of secondAdmin; removing it there while admin
    // still holds it is fine, so first take it away from admin's role via
    // admin2, then admin2 trying to drop its own last grant is refused.
    const strip = await put(
      "admin2",
      `/settings/roles/${roles.admin}/permissions`,
      {
        permissionIds: ids("settings.role.read", "users.user.read"),
      },
    );
    expect(strip.status).toBe(200);
    const last = await put(
      "admin2",
      `/settings/roles/${roles.secondAdmin}/permissions`,
      {
        permissionIds: ids("settings.role.read"),
      },
    );
    expect(last.status).toBe(409);
    expect(errorOf(last)).toBe("ACCESS_LOCKOUT");
    await put("admin2", `/settings/roles/${roles.admin}/permissions`, {
      permissionIds: ids(
        "settings.role.read",
        "settings.role.write",
        "users.user.read",
      ),
    });
  });

  it("clone copies the active grants into a new non-system role", async () => {
    const res = await post("admin", `/settings/roles/${roles.system}/clone`, {
      name: `Calendar copy ${suffix}`,
    });
    expect(res.status).toBe(201);
    const copy = data<RoleDetail>(res);
    expect(copy.isSystem).toBe(false);
    expect(copy.userCount).toBe(0);
    expect(copy.permissions.map((p) => p.code).sort()).toEqual([
      "hr.holiday.read",
      "hr.holiday.write",
    ]);

    const dup = await post("admin", `/settings/roles/${roles.system}/clone`, {
      name: `Calendar copy ${suffix}`,
    });
    expect(dup.status).toBe(409);
    expect(
      (
        await post("reader", `/settings/roles/${roles.system}/clone`, {
          name: "x",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post("otherAdmin", `/settings/roles/${roles.system}/clone`, {
          name: "x",
        })
      ).status,
    ).toBe(404);
  });

  it("records every change in the role's history, newest first", async () => {
    const res = await get("admin", `/settings/roles/${roles.system}/history`);
    expect(res.status).toBe(200);
    const rows = data<AuditRow[]>(res);
    expect(rows.map((r) => r.action)).toEqual(["update", "set_permissions"]);
    expect(rows[1]!.after).toMatchObject({
      grantedPermissionIds: ids("hr.holiday.write"),
      revokedPermissionIds: [],
    });
    expect(
      (await get("reader", `/settings/roles/${roles.system}/history`)).status,
    ).toBe(200);
    expect(
      (await get("otherAdmin", `/settings/roles/${roles.system}/history`))
        .status,
    ).toBe(404);
  });

  it("effective permissions list each grant with its source roles, ignoring inactive roles", async () => {
    await prisma.userRole.create({
      data: { userId: users.reader!, roleId: roles.unused! },
    }); // inactive role
    const res = await get(
      "admin",
      `/users/${users.reader}/effective-permissions`,
    );
    expect(res.status).toBe(200);
    const body = data<Effective>(res);
    expect(body.roles.find((r) => r.id === roles.unused)!.isActive).toBe(false);
    const holidayRead = body.permissions.find(
      (p) => p.code === "hr.holiday.read",
    )!;
    expect(holidayRead.grantedBy.map((g) => g.roleId)).toEqual([roles.system]);
    expect(body.permissions.map((p) => p.code)).toContain("settings.role.read");

    expect(
      (await get("reader", `/users/${users.reader}/effective-permissions`))
        .status,
    ).toBe(403);
    expect(
      (await get("otherAdmin", `/users/${users.reader}/effective-permissions`))
        .status,
    ).toBe(404);
  });

  it("the database refuses version 0", async () => {
    await expect(
      prisma.$executeRaw`UPDATE "platform"."roles" SET "version" = 0 WHERE "id" = ${roles.unused}`,
    ).rejects.toThrow();
  });

  describe("lock-out guard on Admin → Users", () => {
    let lockOrg: { id: number; slug: string };
    const del = (who: string, path: string) =>
      http().delete(path).set(auth(who));
    const userAudit = (userId: number) =>
      prisma.auditLog.findMany({
        where: { entityType: "user", entityId: BigInt(userId) },
        orderBy: { id: "asc" },
        select: { action: true, after: true },
      });

    beforeAll(async () => {
      lockOrg = await prisma.organization.create({
        data: { name: `ACL ${suffix}`, slug: `acl-${suffix}` },
      });
      // One role admin (who can also manage users), and a users-only admin.
      await mkRole(lockOrg, "lockRoleAdmin", [
        "settings.role.read",
        "settings.role.write",
        "users.user.read",
        "users.user.write",
      ]);
      await mkRole(lockOrg, "lockUserAdmin", [
        "users.user.read",
        "users.user.write",
      ]);
      await mkRole(lockOrg, "lockPlain", ["hr.holiday.read"]);
      await mkUser(lockOrg, "lockAdmin", [roles.lockRoleAdmin!]);
      await mkUser(lockOrg, "lockUsers", [roles.lockUserAdmin!]);
      await mkUser(lockOrg, "lockSpare", [roles.lockPlain!]);
    });

    it("a users-only admin cannot unassign, disable or delete the last role admin", async () => {
      const target = users.lockAdmin!;
      const unassign = await post("lockUsers", `/users/${target}/roles`, {
        roleIds: [roles.lockPlain!],
      });
      expect(unassign.status).toBe(409);
      expect(errorOf(unassign)).toBe("ACCESS_LOCKOUT");
      const disable = await patch("lockUsers", `/users/${target}`, {
        isActive: false,
      });
      expect(errorOf(disable)).toBe("ACCESS_LOCKOUT");
      const remove = await del("lockUsers", `/users/${target}`);
      expect(errorOf(remove)).toBe("ACCESS_LOCKOUT");

      const still = await prisma.user.findUniqueOrThrow({
        where: { id: target },
        include: { userRoles: { where: { isActive: true } } },
      });
      expect(still.isActive).toBe(true);
      expect(still.deletedAt).toBeNull();
      expect(still.userRoles.map((r) => r.roleId)).toEqual([
        roles.lockRoleAdmin,
      ]);
    });

    it("a role admin cannot take Manage roles away from themselves", async () => {
      const res = await post("lockAdmin", `/users/${users.lockAdmin}/roles`, {
        roleIds: [roles.lockPlain!],
      });
      expect(res.status).toBe(409);
      expect(errorOf(res)).toBe("ACCESS_LOCKOUT");
    });

    it("changes that keep a role admin go through and are audited", async () => {
      // Make the spare user a second role admin, then the first can be disabled.
      const promote = await post(
        "lockUsers",
        `/users/${users.lockSpare}/roles`,
        {
          roleIds: [roles.lockRoleAdmin!, roles.lockPlain!],
        },
      );
      expect(promote.status).toBe(201);
      const disable = await patch("lockUsers", `/users/${users.lockAdmin}`, {
        isActive: false,
      });
      expect(disable.status).toBe(200);

      expect((await userAudit(users.lockSpare!)).map((a) => a.action)).toEqual([
        "assign_roles",
      ]);
      const spareAudit = await userAudit(users.lockSpare!);
      expect(spareAudit[0]!.after).toMatchObject({
        addedRoleIds: [roles.lockRoleAdmin],
        removedRoleIds: [],
      });
      expect((await userAudit(users.lockAdmin!)).map((a) => a.action)).toEqual([
        "deactivate",
      ]);
    });

    it("team assignment changes are audited", async () => {
      const team = await prisma.team.create({
        data: { organizationId: lockOrg.id, name: "T", code: `ACL${suffix}` },
      });
      const res = await post("lockUsers", `/users/${users.lockSpare}/teams`, {
        teamIds: [team.id],
      });
      expect(res.status).toBe(201);
      const actions = (await userAudit(users.lockSpare!)).map((a) => a.action);
      expect(actions).toContain("assign_teams");
    });
  });
});
