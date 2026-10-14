import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { MenuItemDef } from "./catalog.js";
import { syncMenuItems } from "./sync.js";
import { MenuCatalogValidationError } from "./validate.js";

interface Row {
  id: number;
  code: string;
  label: string;
  path: string | null;
  order: number;
  parentId: number | null;
  permission: string | null;
  isActive: boolean;
  deletedAt: Date | null;
}

const ORG_ID = 1;

/** In-memory stand-in for `client.menuItem`, recording every write. */
function fakeClient(initialRows: Row[]) {
  const rows = [...initialRows];
  let nextId = (rows.reduce((max, r) => Math.max(max, r.id), 0) ?? 0) + 1;
  const writes: string[] = [];
  const client = {
    menuItem: {
      findMany: async ({ where }: { where: { organizationId: number } }) =>
        rows
          .filter((r) => r.deletedAt === null)
          .map((r) => ({ ...r }))
          .filter(() => where.organizationId === ORG_ID),
      create: async ({
        data,
      }: {
        data: Omit<Row, "id" | "isActive" | "deletedAt">;
      }) => {
        writes.push(`create ${data.code}`);
        const row: Row = {
          ...data,
          id: nextId++,
          isActive: true,
          deletedAt: null,
        };
        rows.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<Row>;
      }) => {
        writes.push(`update ${where.id}`);
        const row = rows.find((r) => r.id === where.id);
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
    client: client as unknown as Pick<PrismaClient, "menuItem">,
    rows,
    writes,
  };
}

const catalog: MenuItemDef[] = [
  {
    code: "hr",
    label: "HR",
    path: null,
    order: 1,
    parentCode: null,
    permission: null,
  },
  {
    code: "hr-employees",
    label: "Employees",
    path: "/hr/employees",
    order: 1,
    parentCode: "hr",
    permission: null,
  },
];

describe("syncMenuItems", () => {
  it("creates every missing item on an empty organization, parent before child", async () => {
    const { client, rows } = fakeClient([]);
    const report = await syncMenuItems(client, ORG_ID, { catalog });
    assert.deepEqual(report.created, ["hr", "hr-employees"]);
    assert.equal(rows.length, 2);
    const hr = rows.find((r) => r.code === "hr")!;
    const child = rows.find((r) => r.code === "hr-employees")!;
    assert.equal(child.parentId, hr.id);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const { client, writes } = fakeClient([]);
    await syncMenuItems(client, ORG_ID, { catalog });
    const before = writes.length;
    const second = await syncMenuItems(client, ORG_ID, { catalog });
    assert.equal(writes.length, before);
    assert.deepEqual(second.created, []);
    assert.deepEqual(second.updated, []);
    assert.equal(second.unchanged.length, 2);
  });

  it("refreshes a changed label/path/order/permission without re-creating the row", async () => {
    const { client, rows } = fakeClient([
      {
        id: 1,
        code: "hr",
        label: "old label",
        path: null,
        order: 1,
        parentId: null,
        permission: null,
        isActive: true,
        deletedAt: null,
      },
    ]);
    const report = await syncMenuItems(client, ORG_ID, {
      catalog: [
        {
          code: "hr",
          label: "HR",
          path: null,
          order: 1,
          parentCode: null,
          permission: null,
        },
      ],
    });
    assert.deepEqual(report.updated, ["hr"]);
    assert.equal(rows[0]?.label, "HR");
    assert.equal(rows.length, 1);
  });

  it("re-parents a row when the catalogue's parentCode changes", async () => {
    const { client, rows } = fakeClient([
      {
        id: 1,
        code: "admin",
        label: "Admin",
        path: null,
        order: 1,
        parentId: null,
        permission: null,
        isActive: true,
        deletedAt: null,
      },
      {
        id: 2,
        code: "hr",
        label: "HR",
        path: null,
        order: 2,
        parentId: null,
        permission: null,
        isActive: true,
        deletedAt: null,
      },
      {
        id: 3,
        code: "hr-employees",
        label: "Employees",
        path: "/hr/employees",
        order: 1,
        parentId: 2,
        permission: null,
        isActive: true,
        deletedAt: null,
      },
    ]);
    const report = await syncMenuItems(client, ORG_ID, {
      catalog: [
        {
          code: "admin",
          label: "Admin",
          path: null,
          order: 1,
          parentCode: null,
          permission: null,
        },
        {
          code: "hr",
          label: "HR",
          path: null,
          order: 2,
          parentCode: null,
          permission: null,
        },
        {
          code: "hr-employees",
          label: "Employees",
          path: "/hr/employees",
          order: 1,
          parentCode: "admin",
          permission: null,
        },
      ],
    });
    assert.deepEqual(report.updated, ["hr-employees"]);
    assert.equal(rows.find((r) => r.code === "hr-employees")?.parentId, 1);
  });

  it("never re-activates an item an administrator disabled", async () => {
    const { client, rows } = fakeClient([
      {
        id: 1,
        code: "hr",
        label: "HR",
        path: null,
        order: 1,
        parentId: null,
        permission: null,
        isActive: false,
        deletedAt: null,
      },
    ]);
    const report = await syncMenuItems(client, ORG_ID, {
      catalog: [
        {
          code: "hr",
          label: "HR",
          path: null,
          order: 1,
          parentCode: null,
          permission: null,
        },
      ],
    });
    assert.equal(rows[0]?.isActive, false);
    assert.deepEqual(report.keptInactive, ["hr"]);
  });

  it("reports unknown rows as orphans and leaves them untouched, never deletes", async () => {
    const { client, rows, writes } = fakeClient([
      {
        id: 1,
        code: "manual-item",
        label: "By hand",
        path: "/manual",
        order: 1,
        parentId: null,
        permission: null,
        isActive: true,
        deletedAt: null,
      },
    ]);
    const report = await syncMenuItems(client, ORG_ID, { catalog });
    assert.deepEqual(report.orphans, ["manual-item"]);
    assert.equal(rows.find((r) => r.code === "manual-item")?.isActive, true);
    assert.ok(!writes.some((w) => w.startsWith("DELETE")));
  });

  it("dry run reports the plan and writes nothing", async () => {
    const { client, rows, writes } = fakeClient([]);
    const report = await syncMenuItems(client, ORG_ID, {
      catalog,
      dryRun: true,
    });
    assert.equal(report.dryRun, true);
    assert.deepEqual(report.created, ["hr", "hr-employees"]);
    assert.equal(writes.length, 0);
    assert.equal(rows.length, 0);
  });

  it("rejects an invalid catalogue before reading or writing anything", async () => {
    const { client, writes } = fakeClient([]);
    await assert.rejects(
      syncMenuItems(client, ORG_ID, {
        catalog: [
          {
            code: "orphan-child",
            label: "Orphan",
            path: null,
            order: 1,
            parentCode: "does-not-exist",
            permission: null,
          },
        ],
      }),
      MenuCatalogValidationError,
    );
    assert.equal(writes.length, 0);
  });
});
