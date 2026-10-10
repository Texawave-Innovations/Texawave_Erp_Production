import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MENU_CATALOG, type MenuItemDef } from "./catalog.js";
import {
  assertValidMenuCatalog,
  findMenuCatalogProblems,
  MenuCatalogValidationError,
} from "./validate.js";

const def = (overrides: Partial<MenuItemDef> = {}): MenuItemDef => ({
  code: "x",
  label: "X",
  path: null,
  order: 1,
  parentCode: null,
  permission: null,
  ...overrides,
});

describe("the real catalogue", () => {
  it("is valid", () => {
    assert.deepEqual(findMenuCatalogProblems(MENU_CATALOG), []);
  });
});

describe("findMenuCatalogProblems", () => {
  it("accepts a minimal valid catalogue", () => {
    assert.deepEqual(findMenuCatalogProblems([def()]), []);
  });

  it("rejects a duplicate code", () => {
    const problems = findMenuCatalogProblems([def(), def()]);
    assert.ok(problems.some((p) => p.includes("listed more than once")));
  });

  it("rejects an empty label", () => {
    const problems = findMenuCatalogProblems([def({ label: "" })]);
    assert.ok(problems.some((p) => p.includes("empty label")));
  });

  it("rejects a path that doesn't start with /", () => {
    const problems = findMenuCatalogProblems([def({ path: "portal/leave" })]);
    assert.ok(problems.some((p) => p.includes('must start with "/"')));
  });

  it("rejects a negative order", () => {
    const problems = findMenuCatalogProblems([def({ order: -1 })]);
    assert.ok(problems.some((p) => p.includes("non-negative integer")));
  });

  it("rejects a parentCode that isn't in the catalogue", () => {
    const problems = findMenuCatalogProblems([
      def({ code: "child", parentCode: "ghost" }),
    ]);
    assert.ok(problems.some((p) => p.includes("not in the catalogue")));
  });

  it("rejects an item that is its own parent", () => {
    const problems = findMenuCatalogProblems([
      def({ code: "self", parentCode: "self" }),
    ]);
    assert.ok(problems.some((p) => p.includes("own parent")));
  });

  it("rejects a parentCode cycle", () => {
    const problems = findMenuCatalogProblems([
      def({ code: "a", parentCode: "b" }),
      def({ code: "b", parentCode: "a" }),
    ]);
    assert.ok(problems.some((p) => p.includes("cycle")));
  });

  it("accepts a permission that exactly matches the permission catalogue", () => {
    assert.deepEqual(
      findMenuCatalogProblems([def({ permission: "reference.tags.read" })]),
      [],
    );
  });

  it("accepts a permission that is a scoped family's prefix", () => {
    assert.deepEqual(
      findMenuCatalogProblems([def({ permission: "hr.task.write" })]),
      [],
    );
  });

  it("rejects a permission that matches nothing in the permission catalogue", () => {
    const problems = findMenuCatalogProblems([
      def({ permission: "nope.not.real" }),
    ]);
    assert.ok(problems.some((p) => p.includes("unknown permission")));
  });

  it("reports every problem, not just the first", () => {
    const problems = findMenuCatalogProblems([
      def({ code: "a", label: "", order: -1 }),
    ]);
    assert.ok(problems.length >= 2);
  });
});

describe("assertValidMenuCatalog", () => {
  it("throws MenuCatalogValidationError listing the problems", () => {
    assert.throws(
      () => assertValidMenuCatalog([def({ label: "" })]),
      MenuCatalogValidationError,
    );
  });

  it("does not throw for a valid catalogue", () => {
    assert.doesNotThrow(() => assertValidMenuCatalog([def()]));
  });
});
