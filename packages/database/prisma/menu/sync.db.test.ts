// Real-Postgres check of syncMenuItems(). OPT-IN: it runs only when
// TEST_DATABASE_URL is set, and it writes there — so point it at a disposable
// database that has had `prisma migrate deploy` applied, never at a shared
// dev/staging/production database. Without the variable it is skipped, which
// keeps `turbo run test` from ever writing to whatever DATABASE_URL happens
// to be in the environment.
//
//   TEST_DATABASE_URL=postgresql://…/texawave_erp_test?schema=public \
//     pnpm --filter @texawave-erp/database test
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "../../generated/prisma/client.js";
import type { MenuItemDef } from "./catalog.js";
import { syncMenuItems } from "./sync.js";

const url = process.env.TEST_DATABASE_URL;
const prefix = `menutest${Date.now().toString(36)}`;

describe(
  "syncMenuItems against Postgres",
  { skip: !url && "TEST_DATABASE_URL not set" },
  () => {
    let prisma: PrismaClient;
    let organizationId: number;
    const catalog: MenuItemDef[] = [
      {
        code: `${prefix}-group`,
        label: "Group",
        path: null,
        order: 1,
        parentCode: null,
        permission: null,
      },
      {
        code: `${prefix}-child`,
        label: "Child",
        path: "/x",
        order: 1,
        parentCode: `${prefix}-group`,
        permission: null,
      },
    ];
    const codes = catalog.map((d) => d.code);

    before(async () => {
      prisma = new PrismaClient({
        datasources: { db: { url: url as string } },
      });
      const org = await prisma.organization.create({
        data: { name: `${prefix} org`, slug: `${prefix}-org` },
      });
      organizationId = org.id;
    });
    after(async () => {
      await prisma.menuItem.deleteMany({ where: { organizationId } });
      await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    const run = (dryRun = false) =>
      prisma.$transaction((tx) =>
        syncMenuItems(tx, organizationId, { catalog, dryRun }),
      );

    it("creates the rows with the parent resolved before the child, then is a no-op on the second run", async () => {
      const first = await run();
      assert.deepEqual([...first.created].sort(), [...codes].sort());
      const group = await prisma.menuItem.findFirstOrThrow({
        where: { organizationId, code: codes[0] as string },
      });
      const child = await prisma.menuItem.findFirstOrThrow({
        where: { organizationId, code: codes[1] as string },
      });
      assert.equal(child.parentId, group.id);

      const second = await run();
      assert.deepEqual(second.created, []);
      assert.deepEqual(second.updated, []);
    });

    it("leaves an admin-disabled item inactive", async () => {
      await prisma.menuItem.updateMany({
        where: { organizationId, code: codes[0] as string },
        data: { isActive: false },
      });

      const report = await run();

      assert.deepEqual(report.keptInactive, [codes[0]]);
      const after = await prisma.menuItem.findFirstOrThrow({
        where: { organizationId, code: codes[0] as string },
      });
      assert.equal(after.isActive, false);
    });

    it("dry run writes nothing", async () => {
      await prisma.menuItem.deleteMany({
        where: { organizationId, code: codes[1] as string },
      });
      const report = await run(true);
      assert.deepEqual(report.created, [codes[1]]);
      assert.equal(
        await prisma.menuItem.count({
          where: { organizationId, code: codes[1] as string },
        }),
        0,
      );
    });

    it("a failure part-way through the transaction leaves nothing applied", async () => {
      await prisma.menuItem.deleteMany({ where: { organizationId } });
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await syncMenuItems(tx, organizationId, { catalog });
          throw new Error("simulated failure after sync");
        }),
        /simulated failure/,
      );
      assert.equal(
        await prisma.menuItem.count({ where: { organizationId } }),
        0,
      );
    });
  },
);
