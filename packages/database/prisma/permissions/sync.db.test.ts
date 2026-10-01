// Real-Postgres check of syncPermissions(). OPT-IN: it runs only when
// TEST_DATABASE_URL is set, and it writes there — so point it at a disposable
// database that has had `prisma migrate deploy` applied, never at a shared
// dev/staging/production database. Without the variable it is skipped, which
// keeps `turbo run test` from ever writing to whatever DATABASE_URL happens to
// be in the environment.
//
//   TEST_DATABASE_URL=postgresql://…/texawave_erp_test?schema=public \
//     pnpm --filter @texawave-erp/database test
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "../../generated/prisma/client.js";
import { scopedPermission, type PermissionDef } from "./catalog.js";
import { syncPermissions } from "./sync.js";

const url = process.env.TEST_DATABASE_URL;
const prefix = `dbtest${Date.now().toString(36)}`;

describe(
  "syncPermissions against Postgres",
  { skip: !url && "TEST_DATABASE_URL not set" },
  () => {
    let prisma: PrismaClient;
    const catalog: PermissionDef[] = [
      { code: `${prefix}.entity.read`, description: "Read" },
      ...scopedPermission(`${prefix}.entity.write`, "Write"),
    ];
    const codes = catalog.map((d) => d.code);

    before(() => {
      prisma = new PrismaClient({
        datasources: { db: { url: url as string } },
      });
    });
    after(async () => {
      await prisma.permission.deleteMany({
        where: { code: { startsWith: prefix } },
      });
      await prisma.$disconnect();
    });

    const run = (dryRun = false) =>
      prisma.$transaction((tx) =>
        syncPermissions(tx, { catalog, retired: [], dryRun }),
      );

    it("creates the rows, then is a no-op on the second run", async () => {
      const first = await run();
      assert.deepEqual([...first.created].sort(), [...codes].sort());
      const second = await run();
      assert.deepEqual(second.created, []);
      assert.deepEqual(second.updated, []);
      assert.equal(
        await prisma.permission.count({ where: { code: { in: codes } } }),
        codes.length,
      );
    });

    it("leaves role grants and admin-disabled permissions alone", async () => {
      const org = await prisma.organization.create({
        data: { name: `${prefix} org`, slug: `${prefix}-org` },
      });
      try {
        const role = await prisma.role.create({
          data: { organizationId: org.id, name: `${prefix} role` },
        });
        const disabled = await prisma.permission.update({
          where: { code: codes[0] as string },
          data: { isActive: false },
        });
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: disabled.id },
        });

        const report = await run();

        assert.deepEqual(report.keptInactive, [codes[0]]);
        const after = await prisma.permission.findUniqueOrThrow({
          where: { code: codes[0] as string },
        });
        assert.equal(after.isActive, false);
        assert.equal(
          await prisma.rolePermission.count({ where: { roleId: role.id } }),
          1,
        );
      } finally {
        await prisma.rolePermission.deleteMany({
          where: { role: { organizationId: org.id } },
        });
        await prisma.role.deleteMany({ where: { organizationId: org.id } });
        await prisma.organization.delete({ where: { id: org.id } });
      }
    });

    it("dry run writes nothing", async () => {
      await prisma.permission.deleteMany({
        where: { code: codes[1] as string },
      });
      const report = await run(true);
      assert.deepEqual(report.created, [codes[1]]);
      assert.equal(
        await prisma.permission.count({ where: { code: codes[1] as string } }),
        0,
      );
    });

    it("a failure part-way through the transaction leaves nothing applied", async () => {
      await prisma.permission.deleteMany({
        where: { code: { startsWith: prefix } },
      });
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await syncPermissions(tx, { catalog, retired: [] });
          throw new Error("simulated failure after sync");
        }),
        /simulated failure/,
      );
      assert.equal(
        await prisma.permission.count({
          where: { code: { startsWith: prefix } },
        }),
        0,
      );
    });
  },
);
