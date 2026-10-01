import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { scopedPermission, type PermissionDef } from "./catalog.js";
import { syncPermissions } from "./sync.js";
import { CatalogValidationError } from "./validate.js";

interface Row {
  code: string;
  description: string;
  isActive: boolean;
}

/** In-memory stand-in for `client.permission`, recording every write. */
function fakeClient(rows: Row[]) {
  const writes: string[] = [];
  const client = {
    permission: {
      findMany: async () => rows.map((r) => ({ ...r })),
      create: async ({
        data,
      }: {
        data: { code: string; description: string };
      }) => {
        writes.push(`create ${data.code}`);
        rows.push({ ...data, isActive: true });
      },
      update: async ({
        where,
        data,
      }: {
        where: { code: string };
        data: Partial<Row>;
      }) => {
        writes.push(`update ${where.code}`);
        const row = rows.find((r) => r.code === where.code);
        if (row) Object.assign(row, data);
      },
      delete: async () => {
        writes.push("DELETE");
        throw new Error("sync must never delete");
      },
      deleteMany: async () => {
        writes.push("DELETEMANY");
        throw new Error("sync must never delete");
      },
    },
  };
  return {
    client: client as unknown as Pick<PrismaClient, "permission">,
    rows,
    writes,
  };
}

const catalog: PermissionDef[] = [
  { code: "a.b.read", description: "Read B" },
  ...scopedPermission("a.c.read", "Read C"),
];

describe("syncPermissions", () => {
  it("creates every missing permission on an empty database", async () => {
    const { client, rows } = fakeClient([]);
    const report = await syncPermissions(client, { catalog, retired: [] });
    assert.equal(report.created.length, 4);
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => r.isActive));
  });

  it("is idempotent: a second run changes nothing", async () => {
    const { client, writes } = fakeClient([]);
    await syncPermissions(client, { catalog, retired: [] });
    const before = writes.length;
    const second = await syncPermissions(client, { catalog, retired: [] });
    assert.equal(writes.length, before);
    assert.deepEqual(second.created, []);
    assert.deepEqual(second.updated, []);
    assert.equal(second.unchanged.length, 4);
  });

  it("refreshes a changed description without touching anything else", async () => {
    const { client, rows } = fakeClient([
      { code: "a.b.read", description: "old text", isActive: true },
    ]);
    const report = await syncPermissions(client, {
      catalog: [{ code: "a.b.read", description: "Read B" }],
      retired: [],
    });
    assert.deepEqual(report.updated, ["a.b.read"]);
    assert.equal(rows[0]?.description, "Read B");
    assert.equal(rows[0]?.isActive, true);
  });

  it("never re-activates a permission an administrator disabled", async () => {
    const { client, rows } = fakeClient([
      { code: "a.b.read", description: "Read B", isActive: false },
    ]);
    const report = await syncPermissions(client, {
      catalog: [{ code: "a.b.read", description: "Read B" }],
      retired: [],
    });
    assert.equal(rows[0]?.isActive, false);
    assert.deepEqual(report.keptInactive, ["a.b.read"]);
  });

  it("deactivates (never deletes) a retired permission, once", async () => {
    const { client, rows, writes } = fakeClient([
      { code: "x.y.old", description: "Old", isActive: true },
    ]);
    const opts = {
      catalog: [{ code: "a.b.read", description: "Read B" }],
      retired: [{ code: "x.y.old", reason: "module removed" }],
    };
    const first = await syncPermissions(client, opts);
    assert.deepEqual(first.deactivated, ["x.y.old"]);
    assert.equal(rows.find((r) => r.code === "x.y.old")?.isActive, false);

    const before = writes.length;
    const second = await syncPermissions(client, opts);
    assert.deepEqual(second.deactivated, []);
    assert.equal(writes.length, before);
    assert.ok(!writes.some((w) => w.startsWith("DELETE")));
  });

  it("does nothing for a retired permission that never existed", async () => {
    const { client, writes } = fakeClient([]);
    const report = await syncPermissions(client, {
      catalog: [],
      retired: [{ code: "x.y.old", reason: "r" }],
    });
    assert.deepEqual(report.deactivated, []);
    assert.equal(writes.length, 0);
  });

  it("reports unknown rows as orphans and leaves them untouched", async () => {
    const { client, rows } = fakeClient([
      { code: "manual.thing.read", description: "By hand", isActive: true },
    ]);
    const report = await syncPermissions(client, { catalog, retired: [] });
    assert.deepEqual(report.orphans, ["manual.thing.read"]);
    assert.equal(
      rows.find((r) => r.code === "manual.thing.read")?.isActive,
      true,
    );
  });

  it("dry run reports the plan and writes nothing", async () => {
    const { client, rows, writes } = fakeClient([
      { code: "a.b.read", description: "old", isActive: true },
    ]);
    const report = await syncPermissions(client, {
      catalog,
      retired: [],
      dryRun: true,
    });
    assert.equal(report.dryRun, true);
    assert.equal(report.created.length, 3);
    assert.deepEqual(report.updated, ["a.b.read"]);
    assert.equal(writes.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, "old");
  });

  it("rejects an invalid catalogue before reading or writing anything", async () => {
    const { client, writes } = fakeClient([]);
    await assert.rejects(
      syncPermissions(client, {
        catalog: [{ code: "not valid", description: "x" }],
        retired: [],
      }),
      CatalogValidationError,
    );
    assert.equal(writes.length, 0);
  });
});
