import { Body, Controller, Post, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { RequirePermission } from "../src/common/decorators/require-permission.decorator.js";
import { TenantContextService } from "../src/platform/tenancy/tenant-context.service.js";
import { AuditWriter } from "../src/platform/audit/audit-writer.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * The properties of the audit platform that only a real database can prove
 * (reports/AUDIT_PLATFORM_DESIGN.md): audit row and business change commit or
 * roll back together, the actor is always the JWT's, the trail is append-only
 * at the database level, secrets never reach it, and the read API is
 * permissioned and organization-scoped. `tags` is the business table under
 * audit here only because it already exists.
 */
const WRITE_PERMISSION = "testaudit.probe.write";

@Controller("__test/audit")
class AuditProbeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AuditWriter,
    private readonly tenant: TenantContextService,
  ) {}

  @Post("tag")
  @RequirePermission(WRITE_PERMISSION)
  async createTag(
    @Body()
    body: {
      name: string;
      failAfterAudit?: boolean;
      hugeSnapshot?: boolean;
      // A client trying to forge who did it:
      actorUserId?: number;
      organizationId?: number;
    },
  ) {
    const scope = this.tenant.getOrgScope();
    return this.prisma.$transaction(async (tx) => {
      const tag = await tx.tag.create({
        data: { organizationId: scope.organizationId, name: body.name },
      });
      await this.writer.write(tx, {
        entityType: "tag",
        entityId: tag.id,
        action: "create",
        after: body.hugeSnapshot
          ? { blob: "x".repeat(20_000) }
          : { name: tag.name, passwordHash: "must-not-be-stored" },
        reason: "e2e",
      });
      if (body.failAfterAudit) throw new Error("boom after audit");
      return { id: tag.id };
    });
  }
}

interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number };
}

describe("audit platform (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  let permissionIds: number[] = [];
  const suffix = randomUUID().slice(0, 8);

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuditProbeController],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `Audit A ${suffix}`, slug: `audit-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Audit B ${suffix}`, slug: `audit-b-${suffix}` },
    });

    const perm = async (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const writeP = await perm(WRITE_PERMISSION);
    const readP = await perm("audit.log.read");
    permissionIds = [writeP.id];

    async function mkUser(
      orgId: number,
      slug: string,
      key: string,
      perms: number[],
    ) {
      const role = await prisma.role.create({
        data: { organizationId: orgId, name: `role-${key}-${suffix}` },
      });
      if (perms.length) {
        await prisma.rolePermission.createMany({
          data: perms.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email: `${key}@${slug}.test`,
          passwordHash,
          fullName: `User ${key}`,
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          organizationSlug: slug,
          email: user.email,
          password: "Password123!",
        })
        .expect(201);
      tokens[key] = (
        login.body as Body<{ accessToken: string }>
      ).data.accessToken;
      userIds[key] = user.id;
    }
    await mkUser(orgA.id, orgA.slug, "writerA", [writeP.id, readP.id]);
    await mkUser(orgA.id, orgA.slug, "readerA", [readP.id]);
    await mkUser(orgA.id, orgA.slug, "nobodyA", []);
    await mkUser(orgB.id, orgB.slug, "writerB", [writeP.id, readP.id]);
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    // audit_logs is append-only, so a test organization that produced audit
    // rows cannot be deleted; its rows stay behind by design and are keyed by
    // a unique slug, so they cannot collide with anything.
    await prisma.tag.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.userRole.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: orgIds } } },
    });
    await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await Promise.all(
      Object.values(userIds).flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    void permissionIds;
    await app.close();
  });

  const createTag = (who: string, body: object) =>
    request(app.getHttpServer())
      .post("/__test/audit/tag")
      .set(auth(who))
      .send(body);

  describe("transactional writes", () => {
    it("commits the business change and its audit row together, attributed to the JWT user", async () => {
      const res = await createTag("writerA", {
        name: `t-${randomUUID()}`,
      }).expect(201);
      const id = (res.body as Body<{ id: number }>).data.id;

      expect(await prisma.tag.findUnique({ where: { id } })).not.toBeNull();
      const rows = await prisma.auditLog.findMany({
        where: { entityType: "tag", entityId: BigInt(id) },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organizationId: orgA.id,
        actorUserId: userIds.writerA,
        actorType: "user",
        action: "create",
        reason: "e2e",
      });
      expect(rows[0]?.correlationId).toBeTruthy();
      expect(rows[0]?.at).toBeInstanceOf(Date);
    });

    it("cannot be told who the actor is: forged ids in the body are ignored", async () => {
      const res = await createTag("writerA", {
        name: `t-${randomUUID()}`,
        actorUserId: userIds.writerB,
        organizationId: orgB.id,
      });
      // (forbidNonWhitelisted only applies to DTO classes; this probe uses a plain body)
      expect(res.status).toBe(201);
      const id = (res.body as Body<{ id: number }>).data.id;
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: "tag", entityId: BigInt(id) },
      });
      expect(row.actorUserId).toBe(userIds.writerA);
      expect(row.organizationId).toBe(orgA.id);
    });

    it("rolls back BOTH the change and the audit row when anything fails afterwards", async () => {
      const name = `rollback-${randomUUID()}`;
      await createTag("writerA", { name, failAfterAudit: true }).expect(500);
      expect(await prisma.tag.findFirst({ where: { name } })).toBeNull();
      const stray = await prisma.auditLog.count({
        where: {
          organizationId: orgA.id,
          entityType: "tag",
          after: { path: ["name"], equals: name },
        },
      });
      expect(stray).toBe(0);
    });

    it("fails closed: if the audit record cannot be written the business change is undone", async () => {
      const name = `closed-${randomUUID()}`;
      await createTag("writerA", { name, hugeSnapshot: true }).expect(500);
      expect(await prisma.tag.findFirst({ where: { name } })).toBeNull();
    });

    it("never stores a secret from a snapshot", async () => {
      const res = await createTag("writerA", {
        name: `t-${randomUUID()}`,
      }).expect(201);
      const id = (res.body as Body<{ id: number }>).data.id;
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: "tag", entityId: BigInt(id) },
      });
      expect(JSON.stringify(row.after)).not.toContain("must-not-be-stored");
      expect(row.after).toMatchObject({ passwordHash: "[redacted]" });
    });
  });

  describe("append-only at the database level", () => {
    let rowId: bigint;
    beforeAll(async () => {
      const res = await createTag("writerA", {
        name: `t-${randomUUID()}`,
      }).expect(201);
      const id = (res.body as Body<{ id: number }>).data.id;
      rowId = (
        await prisma.auditLog.findFirstOrThrow({
          where: { entityType: "tag", entityId: BigInt(id) },
        })
      ).id;
    });

    it("rejects UPDATE", async () => {
      await expect(
        prisma.auditLog.update({
          where: { id: rowId },
          data: { action: "tampered" },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.$executeRaw`UPDATE platform.audit_logs SET reason = 'x' WHERE id = ${rowId}`,
      ).rejects.toThrow(/append-only/);
    });

    it("rejects DELETE", async () => {
      await expect(
        prisma.auditLog.delete({ where: { id: rowId } }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.$executeRaw`DELETE FROM platform.audit_logs WHERE id = ${rowId}`,
      ).rejects.toThrow(/append-only/);
    });

    it("rejects TRUNCATE", async () => {
      await expect(
        prisma.$executeRawUnsafe("TRUNCATE TABLE platform.audit_logs"),
      ).rejects.toThrow(/append-only/);
    });

    it("leaves the row intact after all of that", async () => {
      const row = await prisma.auditLog.findUniqueOrThrow({
        where: { id: rowId },
      });
      expect(row.action).toBe("create");
    });

    it("rejects a user-actor row with no actor id", async () => {
      await expect(
        prisma.auditLog.create({
          data: {
            organizationId: orgA.id,
            actorType: "user",
            entityType: "tag",
            entityId: 1n,
            action: "create",
          },
        }),
      ).rejects.toThrow(/audit_logs_actor_present_check/);
    });

    it("rejects an unknown actor type", async () => {
      await expect(
        prisma.auditLog.create({
          data: {
            organizationId: orgA.id,
            actorUserId: userIds.writerA as number,
            actorType: "robot",
            entityType: "tag",
            entityId: 1n,
            action: "create",
          },
        }),
      ).rejects.toThrow(/audit_logs_actor_type_check/);
    });

    it("accepts a system actor with no user", async () => {
      const row = await prisma.auditLog.create({
        data: {
          organizationId: orgA.id,
          actorType: "system",
          entityType: "tag",
          entityId: 1n,
          action: "auto_close",
        },
      });
      expect(row.actorUserId).toBeNull();
    });
  });

  describe("read API: GET /audit/logs", () => {
    let aTagId: number;
    let bTagId: number;
    beforeAll(async () => {
      aTagId = (
        (await createTag("writerA", { name: `t-${randomUUID()}` }).expect(201))
          .body as Body<{
          id: number;
        }>
      ).data.id;
      bTagId = (
        (await createTag("writerB", { name: `t-${randomUUID()}` }).expect(201))
          .body as Body<{
          id: number;
        }>
      ).data.id;
    });

    const list = (who: string, qs = "") =>
      request(app.getHttpServer()).get(`/audit/logs${qs}`).set(auth(who));

    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/audit/logs").expect(401);
    });

    it("rejects a caller without audit.log.read", async () => {
      await list("nobodyA").expect(403);
    });

    it("returns the caller's organization's records, newest first, with an envelope", async () => {
      const res = await list("readerA", "?limit=100").expect(200);
      const body = res.body as Body<
        Array<{ id: string; entityId: number; actorName: string | null }>
      >;
      expect(body.meta?.total).toBeGreaterThan(0);
      const ids = body.data.map((r) => BigInt(r.id));
      expect([...ids].sort((a, b) => (a > b ? -1 : 1))).toEqual(ids);
      expect(body.data.every((r) => typeof r.id === "string")).toBe(true);
      expect(body.data.some((r) => r.actorName === "User writerA")).toBe(true);
    });

    it("never shows another organization's records, even when asked for them by id", async () => {
      const res = await list(
        "readerA",
        `?entityType=tag&entityId=${bTagId}`,
      ).expect(200);
      expect((res.body as Body<unknown[]>).data).toEqual([]);
      const own = await list(
        "readerA",
        `?entityType=tag&entityId=${aTagId}`,
      ).expect(200);
      expect((own.body as Body<unknown[]>).data).toHaveLength(1);

      const asB = await list("writerB", "?limit=100").expect(200);
      const orgIds = new Set(
        (asB.body as Body<Array<{ entityId: number }>>).data.map(
          (r) => r.entityId,
        ),
      );
      expect(orgIds.has(aTagId)).toBe(false);
    });

    it("filters by actor, action and date range", async () => {
      const byActor = await list(
        "readerA",
        `?actorUserId=${userIds.writerA}&limit=100`,
      ).expect(200);
      const rows = (byActor.body as Body<Array<{ actorUserId: number }>>).data;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.actorUserId === userIds.writerA)).toBe(true);

      const noMatch = await list("readerA", "?action=does_not_exist").expect(
        200,
      );
      expect((noMatch.body as Body<unknown[]>).data).toEqual([]);

      const future = new Date(Date.now() + 86_400_000).toISOString();
      const none = await list(
        "readerA",
        `?from=${encodeURIComponent(future)}`,
      ).expect(200);
      expect((none.body as Body<unknown[]>).data).toEqual([]);
    });

    it("paginates", async () => {
      const res = await list("readerA", "?limit=1&page=1").expect(200);
      const body = res.body as Body<unknown[]>;
      expect(body.data).toHaveLength(1);
      expect(body.meta?.limit).toBe(1);
    });

    it.each([
      ["entityId without entityType", "?entityId=5"],
      ["from >= to", "?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z"],
      ["a malformed entityType", "?entityType=Bad-Type"],
      ["a non-numeric actor", "?actorUserId=abc"],
      ["limit above the maximum", "?limit=101"],
    ])("rejects %s with 400", async (_label, qs) => {
      await list("readerA", qs).expect(400);
    });

    it("has no write routes", async () => {
      await request(app.getHttpServer())
        .post("/audit/logs")
        .set(auth("writerA"))
        .send({})
        .expect(404);
      await request(app.getHttpServer())
        .delete("/audit/logs/1")
        .set(auth("writerA"))
        .expect(404);
      await request(app.getHttpServer())
        .patch("/audit/logs/1")
        .set(auth("writerA"))
        .send({})
        .expect(404);
    });
  });
});
