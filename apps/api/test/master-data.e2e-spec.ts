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
 * HR master data — designations, employment types, work locations and leave
 * types. The modules are generated from one template, so one parameterized spec proves
 * the same guarantees for each: permissions, validation, transactional audit,
 * conflict handling (including a real concurrent race), organization
 * isolation, and the deactivate/activate lifecycle.
 */
interface Kind {
  route: string;
  /** Full URL when the module is not under /master-data (leave types are HR-owned). */
  path?: string;
  entityType: string;
  perm: string;
  extra?: Record<string, unknown>;
}
const KINDS: Kind[] = [
  {
    route: "designations",
    entityType: "designation",
    perm: "master.designation",
  },
  {
    route: "employment-types",
    entityType: "employment_type",
    perm: "master.employment_type",
    extra: { probationDays: 90, noticeDays: 30 },
  },
  {
    route: "work-locations",
    entityType: "work_location",
    perm: "master.work_location",
  },
  {
    route: "leave-types",
    path: "/hr/leave-types",
    entityType: "leave_type",
    perm: "hr.leave_type",
  },
];

interface Body<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
interface Row {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  probationDays?: number | null;
  noticeDays?: number | null;
}

describe("HR master data (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    orgA = await prisma.organization.create({
      data: { name: `MD A ${suffix}`, slug: `md-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `MD B ${suffix}`, slug: `md-b-${suffix.toLowerCase()}` },
    });

    const codes = ["audit.log.read"];
    for (const k of KINDS) codes.push(`${k.perm}.read`, `${k.perm}.write`);
    const perms = new Map<string, number>();
    for (const code of codes) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perms.set(code, p.id);
    }
    const all = (suffixes: string[]) =>
      KINDS.flatMap((k) =>
        suffixes.map((s) => perms.get(`${k.perm}.${s}`) as number),
      );

    async function mkUser(
      orgId: number,
      slug: string,
      key: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: { organizationId: orgId, name: `role-${key}-${suffix}` },
      });
      if (permissionIds.length) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
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
    await mkUser(orgA.id, orgA.slug, "hrA", all(["read", "write"]));
    await mkUser(orgA.id, orgA.slug, "readerA", all(["read"]));
    await mkUser(orgA.id, orgA.slug, "nobodyA", []);
    await mkUser(orgB.id, orgB.slug, "hrB", all(["read", "write"]));
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.designation.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.employmentType.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.workLocation.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.leaveType.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
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
    // Users/orgs that produced audit rows are intentionally left (audit_logs is append-only).
    await app.close();
  });

  describe.each(KINDS)("$route", (kind) => {
    const url = kind.path ?? `/master-data/${kind.route}`;
    const code = (n: string) => `${n}_${suffix}`;
    let counter = 0;
    const fresh = (over: Record<string, unknown> = {}) => {
      counter += 1;
      return {
        code: code(`C${counter}`),
        name: `Name ${kind.route} ${suffix} ${counter}`,
        ...kind.extra,
        ...over,
      };
    };
    const create = (who: string, body: object) =>
      request(app.getHttpServer()).post(url).set(auth(who)).send(body);
    const auditRows = (id: number) =>
      prisma.auditLog.findMany({
        where: { entityType: kind.entityType, entityId: BigInt(id) },
        orderBy: { id: "asc" },
      });

    describe("authentication and permissions", () => {
      it("401 without a token", async () => {
        await request(app.getHttpServer()).get(url).expect(401);
        await request(app.getHttpServer()).post(url).send(fresh()).expect(401);
      });
      it("403 for a user holding no permission", async () => {
        await request(app.getHttpServer())
          .get(url)
          .set(auth("nobodyA"))
          .expect(403);
        await create("nobodyA", fresh()).expect(403);
      });
      it("read permission lists but cannot write", async () => {
        await request(app.getHttpServer())
          .get(url)
          .set(auth("readerA"))
          .expect(200);
        await create("readerA", fresh()).expect(403);
        const row = (await create("hrA", fresh()).expect(201))
          .body as Body<Row>;
        const id = row.data.id;
        await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("readerA"))
          .send({ name: "x" })
          .expect(403);
        await request(app.getHttpServer())
          .post(`${url}/${id}/deactivate`)
          .set(auth("readerA"))
          .expect(403);
        await request(app.getHttpServer())
          .post(`${url}/${id}/activate`)
          .set(auth("readerA"))
          .expect(403);
        await request(app.getHttpServer())
          .get(`${url}/${id}`)
          .set(auth("readerA"))
          .expect(200);
      });
      it("has no DELETE route (rows are deactivated, never deleted)", async () => {
        await request(app.getHttpServer())
          .delete(`${url}/1`)
          .set(auth("hrA"))
          .expect(404);
      });
    });

    describe("create", () => {
      it("creates, normalizes the code to upper-case, trims text, and audits in the same transaction", async () => {
        const body = fresh({
          code: ` ${code("lower")} `,
          name: "  Padded Name " + suffix + "  ",
          description: " desc ",
        });
        const res = await create("hrA", body).expect(201);
        const row = (res.body as Body<Row>).data;
        expect(row).toMatchObject({
          code: code("LOWER"),
          name: `Padded Name ${suffix}`,
          description: "desc",
          isActive: true,
        });
        const rows = await auditRows(row.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          action: "create",
          organizationId: orgA.id,
          actorUserId: userIds.hrA,
          before: null,
        });
        expect(rows[0]?.after).toMatchObject({
          code: code("LOWER"),
          isActive: true,
        });
      });

      it("rejects a duplicate code with 409", async () => {
        const body = fresh();
        await create("hrA", body).expect(201);
        const dup = await create("hrA", {
          ...body,
          name: `Different ${suffix} ${counter}`,
        }).expect(409);
        expect((dup.body as { error: string }).error).toBe("RESOURCE_CONFLICT");
      });

      it("rejects a duplicate name, ignoring case and surrounding spaces, with 409", async () => {
        const body = fresh({ name: `Case Test ${kind.route} ${suffix}` });
        await create("hrA", body).expect(201);
        // The first name has an upper-case suffix; a lower-cased, padded twin must clash.
        await create("hrA", {
          ...fresh(),
          name: ` case TEST ${kind.route} ${suffix.toLowerCase()} `,
        }).expect(409);
      });

      it("a concurrent race on the same code yields exactly one 201 and the rest 409 — never a 500", async () => {
        const body = fresh();
        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            create("hrA", {
              ...body,
              name: `Race ${kind.route} ${suffix} ${counter} ${i}`,
            }),
          ),
        );
        const statuses = results.map((r) => r.status).sort();
        expect(statuses.filter((s) => s === 201)).toHaveLength(1);
        expect(statuses.filter((s) => s === 409)).toHaveLength(7);
        const stored = await prisma.auditLog.count({
          where: {
            organizationId: orgA.id,
            entityType: kind.entityType,
            after: { path: ["code"], equals: body.code },
          },
        });
        expect(stored).toBe(1);
      });

      it.each([
        ["a missing name", { code: "OK_CODE" }],
        ["a missing code", { name: "Named" }],
        [
          "a lower-case-only invalid code (leading digit)",
          { code: "1BAD", name: "n" },
        ],
        ["a code with a space", { code: "BAD CODE", name: "n" }],
        ["a one-character code", { code: "A", name: "n" }],
        ["a 31-character code", { code: "A".repeat(31), name: "n" }],
        ["an empty name", { code: "OK_CODE", name: "   " }],
        ["a 101-character name", { code: "OK_CODE", name: "n".repeat(101) }],
        [
          "a 501-character description",
          { code: "OK_CODE", name: "n", description: "d".repeat(501) },
        ],
        ["an unknown field", { code: "OK_CODE", name: "n", surprise: true }],
        [
          "a client-supplied organizationId",
          { code: "OK_CODE", name: "n", organizationId: 999 },
        ],
        ["a non-string code", { code: 42, name: "n" }],
      ])("400 for %s", async (_label, body) => {
        await create("hrA", body).expect(400);
      });
    });

    describe("read, update, activate/deactivate", () => {
      let id: number;
      beforeAll(async () => {
        id = (
          (
            await create(
              "hrA",
              fresh({ name: `Lifecycle ${kind.route} ${suffix}` }),
            ).expect(201)
          ).body as Body<Row>
        ).data.id;
      });

      it("returns the row by id, 404 for an unknown id, 400 for a non-numeric id", async () => {
        const res = await request(app.getHttpServer())
          .get(`${url}/${id}`)
          .set(auth("hrA"))
          .expect(200);
        expect((res.body as Body<Row>).data.id).toBe(id);
        await request(app.getHttpServer())
          .get(`${url}/999999999`)
          .set(auth("hrA"))
          .expect(404);
        await request(app.getHttpServer())
          .get(`${url}/abc`)
          .set(auth("hrA"))
          .expect(400);
      });

      it("updates the name and records before/after in the audit trail", async () => {
        const res = await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({
            name: `Renamed ${kind.route} ${suffix}`,
            description: "now described",
          })
          .expect(200);
        expect((res.body as Body<Row>).data.name).toBe(
          `Renamed ${kind.route} ${suffix}`,
        );
        const update = (await auditRows(id)).find((r) => r.action === "update");
        expect(update?.before).toMatchObject({
          name: `Lifecycle ${kind.route} ${suffix}`,
        });
        expect(update?.after).toMatchObject({
          name: `Renamed ${kind.route} ${suffix}`,
          description: "now described",
        });
      });

      it("treats an empty description as clearing it", async () => {
        const res = await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({ description: "" })
          .expect(200);
        expect((res.body as Body<Row>).data.description).toBeNull();
      });

      it("a no-op PATCH changes nothing and writes no audit row", async () => {
        const before = (await auditRows(id)).length;
        await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({})
          .expect(200);
        await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({ name: `Renamed ${kind.route} ${suffix}` })
          .expect(200);
        expect((await auditRows(id)).length).toBe(before);
      });

      it("the code is immutable: sending it is rejected", async () => {
        await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({ code: "NEW_CODE" })
          .expect(400);
      });

      it("renaming to another row's name is a 409, but re-sending your own name is fine", async () => {
        const other = (
          (
            await create(
              "hrA",
              fresh({ name: `Other ${kind.route} ${suffix}` }),
            ).expect(201)
          ).body as Body<Row>
        ).data;
        await request(app.getHttpServer())
          .patch(`${url}/${id}`)
          .set(auth("hrA"))
          .send({ name: other.name.toUpperCase() })
          .expect(409);
      });

      it("deactivate/activate are idempotent, audited once per real change, and keep the row readable", async () => {
        const base = (await auditRows(id)).length;
        const off = await request(app.getHttpServer())
          .post(`${url}/${id}/deactivate`)
          .set(auth("hrA"))
          .expect(200);
        expect((off.body as Body<Row>).data.isActive).toBe(false);
        await request(app.getHttpServer())
          .post(`${url}/${id}/deactivate`)
          .set(auth("hrA"))
          .expect(200); // idempotent
        expect((await auditRows(id)).length).toBe(base + 1);

        const read = await request(app.getHttpServer())
          .get(`${url}/${id}`)
          .set(auth("readerA"))
          .expect(200);
        expect((read.body as Body<Row>).data.isActive).toBe(false);

        const on = await request(app.getHttpServer())
          .post(`${url}/${id}/activate`)
          .set(auth("hrA"))
          .expect(200);
        expect((on.body as Body<Row>).data.isActive).toBe(true);
        await request(app.getHttpServer())
          .post(`${url}/${id}/activate`)
          .set(auth("hrA"))
          .expect(200);
        const actions = (await auditRows(id)).map((r) => r.action);
        expect(actions.filter((a) => a === "deactivate")).toHaveLength(1);
        expect(actions.filter((a) => a === "activate")).toHaveLength(1);
      });

      it("404 when updating or (de)activating an id that does not exist", async () => {
        await request(app.getHttpServer())
          .patch(`${url}/999999999`)
          .set(auth("hrA"))
          .send({ name: "x" })
          .expect(404);
        await request(app.getHttpServer())
          .post(`${url}/999999999/deactivate`)
          .set(auth("hrA"))
          .expect(404);
      });
    });

    describe("listing", () => {
      beforeAll(async () => {
        for (const n of ["Alpha", "Bravo", "Charlie"]) {
          await create(
            "hrA",
            fresh({
              code: code(`LIST_${n.toUpperCase()}`),
              name: `${n} list ${kind.route} ${suffix}`,
            }),
          ).expect(201);
        }
        const inactive = (
          (
            await create(
              "hrA",
              fresh({
                code: code("LIST_OFF"),
                name: `Zulu off ${kind.route} ${suffix}`,
              }),
            ).expect(201)
          ).body as Body<Row>
        ).data;
        await request(app.getHttpServer())
          .post(`${url}/${inactive.id}/deactivate`)
          .set(auth("hrA"))
          .expect(200);
      });
      const list = (qs: string) =>
        request(app.getHttpServer()).get(`${url}?${qs}`).set(auth("readerA"));

      it("paginates with the standard meta envelope", async () => {
        const res = await list("limit=2&page=1").expect(200);
        const body = res.body as Body<Row[]>;
        expect(body.data).toHaveLength(2);
        expect(body.meta).toMatchObject({ page: 1, limit: 2 });
        expect(body.meta?.total).toBeGreaterThan(2);
        expect(body.meta?.totalPages).toBe(
          Math.ceil((body.meta?.total ?? 0) / 2),
        );
        const page2 = (await list("limit=2&page=2").expect(200)).body as Body<
          Row[]
        >;
        expect(page2.data.map((r) => r.id)).not.toEqual(
          body.data.map((r) => r.id),
        );
      });

      it("searches code or name case-insensitively", async () => {
        const res = await list(
          `search=${encodeURIComponent(`bravo list ${kind.route}`)}`,
        ).expect(200);
        expect((res.body as Body<Row[]>).data).toHaveLength(1);
        const byCode = await list(
          `search=${code("list_charlie").toLowerCase()}`,
        ).expect(200);
        expect((byCode.body as Body<Row[]>).data.map((r) => r.code)).toEqual([
          code("LIST_CHARLIE"),
        ]);
      });

      it("filters by isActive", async () => {
        const off = (
          await list(`isActive=false&search=${suffix}&limit=100`).expect(200)
        ).body as Body<Row[]>;
        expect(off.data.length).toBeGreaterThan(0);
        expect(off.data.every((r) => r.isActive === false)).toBe(true);
        const on = (
          await list(`isActive=true&search=${suffix}&limit=100`).expect(200)
        ).body as Body<Row[]>;
        expect(on.data.every((r) => r.isActive)).toBe(true);
      });

      it("sorts by name ascending by default and honors sortBy/order", async () => {
        const asc = (
          (
            await list(`search=list ${kind.route} ${suffix}&limit=100`).expect(
              200,
            )
          ).body as Body<Row[]>
        ).data.map((r) => r.name);
        expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
        const desc = (
          (
            await list(
              `search=list ${kind.route} ${suffix}&sortBy=name&order=desc&limit=100`,
            ).expect(200)
          ).body as Body<Row[]>
        ).data.map((r) => r.name);
        expect(desc).toEqual([...asc].reverse());
        const byCode = (
          (
            await list(
              `search=list ${kind.route} ${suffix}&sortBy=code&limit=100`,
            ).expect(200)
          ).body as Body<Row[]>
        ).data.map((r) => r.code);
        expect(byCode).toEqual([...byCode].sort());
      });

      it.each([
        ["an invalid isActive", "isActive=maybe"],
        ["a limit above 100", "limit=101"],
        ["page 0", "page=0"],
        ["an unknown sort field", "sortBy=password"],
        ["an invalid order", "order=sideways"],
      ])("400 for %s", async (_l, qs) => {
        await list(qs).expect(400);
      });
    });

    describe("organization isolation", () => {
      it("another organization can neither see, read, edit nor (de)activate a row — and may reuse the same code", async () => {
        const body = fresh();
        const row = ((await create("hrA", body).expect(201)).body as Body<Row>)
          .data;

        const listB = (
          (
            await request(app.getHttpServer())
              .get(`${url}?limit=100&search=${suffix}`)
              .set(auth("hrB"))
              .expect(200)
          ).body as Body<Row[]>
        ).data;
        expect(listB.map((r) => r.id)).not.toContain(row.id);

        await request(app.getHttpServer())
          .get(`${url}/${row.id}`)
          .set(auth("hrB"))
          .expect(404);
        await request(app.getHttpServer())
          .patch(`${url}/${row.id}`)
          .set(auth("hrB"))
          .send({ name: "Hijack" })
          .expect(404);
        await request(app.getHttpServer())
          .post(`${url}/${row.id}/deactivate`)
          .set(auth("hrB"))
          .expect(404);
        const still = await request(app.getHttpServer())
          .get(`${url}/${row.id}`)
          .set(auth("hrA"))
          .expect(200);
        expect((still.body as Body<Row>).data).toMatchObject({
          name: body.name,
          isActive: true,
        });

        // Same code/name in the other organization is not a conflict.
        const twin = await create("hrB", body).expect(201);
        expect((twin.body as Body<Row>).data.id).not.toBe(row.id);
        // ...and audit rows are attributed to the right organization.
        const twinAudit = await auditRows((twin.body as Body<Row>).data.id);
        expect(twinAudit[0]?.organizationId).toBe(orgB.id);
      });
    });
  });

  describe("employment types: probation/notice days", () => {
    const url = "/master-data/employment-types";
    it.each([
      ["negative probation", { probationDays: -1 }],
      ["non-integer notice", { noticeDays: 1.5 }],
      ["absurdly large probation", { probationDays: 100000 }],
      ["a string", { noticeDays: "thirty" }],
    ])("400 for %s", async (_l, extra) => {
      await request(app.getHttpServer())
        .post(url)
        .set(auth("hrA"))
        .send({ code: `BAD_${suffix}`, name: `Bad ${suffix}`, ...extra })
        .expect(400);
    });

    it("can be set, updated, and cleared with null; both are optional", async () => {
      const created = (
        await request(app.getHttpServer())
          .post(url)
          .set(auth("hrA"))
          .send({ code: `NULLS_${suffix}`, name: `Nulls ${suffix}` })
          .expect(201)
      ).body as Body<Row>;
      expect(created.data.probationDays).toBeNull();
      const set = await request(app.getHttpServer())
        .patch(`${url}/${created.data.id}`)
        .set(auth("hrA"))
        .send({ probationDays: 60, noticeDays: 15 })
        .expect(200);
      expect((set.body as Body<Row>).data).toMatchObject({
        probationDays: 60,
        noticeDays: 15,
      });
      const cleared = await request(app.getHttpServer())
        .patch(`${url}/${created.data.id}`)
        .set(auth("hrA"))
        .send({ probationDays: null })
        .expect(200);
      expect((cleared.body as Body<Row>).data).toMatchObject({
        probationDays: null,
        noticeDays: 15,
      });
    });
  });

  describe("database invariants (independent of the API)", () => {
    it("rejects a lower-case or malformed code and a blank name at the database", async () => {
      await expect(
        prisma.designation.create({
          data: { organizationId: orgA.id, code: "lower", name: "x" },
        }),
      ).rejects.toThrow(/designations_code_format_check/);
      await expect(
        prisma.workLocation.create({
          data: { organizationId: orgA.id, code: "OK_LOC", name: "   " },
        }),
      ).rejects.toThrow(/work_locations_name_not_blank_check/);
      await expect(
        prisma.employmentType.create({
          data: {
            organizationId: orgA.id,
            code: "OK_ET",
            name: "n",
            probationDays: -5,
          },
        }),
      ).rejects.toThrow(/employment_types_days_check/);
    });

    it("enforces case-insensitive name uniqueness within an organization at the database", async () => {
      await prisma.designation.create({
        data: {
          organizationId: orgA.id,
          code: `DB_ONE_${suffix}`,
          name: `Db Unique ${suffix}`,
        },
      });
      await expect(
        prisma.designation.create({
          data: {
            organizationId: orgA.id,
            code: `DB_TWO_${suffix}`,
            name: `DB UNIQUE ${suffix}`,
          },
        }),
      ).rejects.toThrow(
        /Unique constraint failed|designations_org_lower_name_key/,
      );
    });
  });
});
