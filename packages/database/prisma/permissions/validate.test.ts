import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PERMISSION_CATALOG,
  RETIRED_PERMISSIONS,
  scopedPermission,
  type PermissionDef,
} from "./catalog.js";
import {
  CatalogValidationError,
  assertValidCatalog,
  findCatalogProblems,
} from "./validate.js";

const def = (code: string, description = "desc"): PermissionDef => ({
  code,
  description,
});

describe("the real catalogue", () => {
  it("is valid", () => {
    assert.deepEqual(
      findCatalogProblems(PERMISSION_CATALOG, RETIRED_PERMISSIONS),
      [],
    );
  });
});

describe("scopedPermission", () => {
  it("expands to .own, .team and .all with distinct descriptions", () => {
    const defs = scopedPermission("hr.employee.read", "View employees");
    assert.deepEqual(
      defs.map((d) => d.code),
      ["hr.employee.read.own", "hr.employee.read.team", "hr.employee.read.all"],
    );
    assert.equal(new Set(defs.map((d) => d.description)).size, 3);
    assert.deepEqual(findCatalogProblems(defs), []);
  });
});

describe("findCatalogProblems", () => {
  it("accepts unscoped, scoped and underscore-segment codes", () => {
    assert.deepEqual(
      findCatalogProblems([
        def("settings.role.read"),
        ...scopedPermission("employee_self_service.leave_request.read", "x"),
      ]),
      [],
    );
  });

  for (const bad of [
    "hr.employee", // 2 segments
    "hr.employee.read.everyone", // 4 segments, not a scope
    "hr.employee.read.team.extra",
    "HR.employee.read", // upper case
    "hr..read",
    "hr.employee.read ",
    "hr-employee.read.all", // hyphen
    "",
  ]) {
    it(`rejects malformed code ${JSON.stringify(bad)}`, () => {
      const problems = findCatalogProblems([def(bad)]);
      assert.equal(problems.length, 1);
      assert.match(problems[0] as string, /does not match/);
    });
  }

  it("rejects duplicates", () => {
    const problems = findCatalogProblems([def("a.b.read"), def("a.b.read")]);
    assert.deepEqual(problems, ['"a.b.read" is listed more than once']);
  });

  it("rejects an empty or over-long description", () => {
    assert.match(
      findCatalogProblems([def("a.b.read", "  ")])[0] as string,
      /empty description/,
    );
    assert.match(
      findCatalogProblems([def("a.b.read", "x".repeat(201))])[0] as string,
      /longer than 200/,
    );
  });

  it("requires all three variants of a team-scoped permission", () => {
    const problems = findCatalogProblems([
      def("hr.employee.read.own"),
      def("hr.employee.read.all"),
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0] as string, /missing \.team/);
  });

  it("rejects a permission that is both scoped and unscoped", () => {
    const problems = findCatalogProblems([
      def("hr.employee.read"),
      ...scopedPermission("hr.employee.read", "x"),
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0] as string, /both without a scope and with one/);
  });

  it("treats different actions on the same entity as separate families", () => {
    assert.deepEqual(
      findCatalogProblems([
        ...scopedPermission("hr.employee.read", "x"),
        def("hr.employee.write.all"),
      ]).length,
      1, // write is only .all → incomplete family
    );
  });

  it("validates the retired list", () => {
    assert.deepEqual(
      findCatalogProblems(
        [def("a.b.read")],
        [{ code: "a.b.old", reason: "r" }],
      ),
      [],
    );
    const problems = findCatalogProblems(
      [def("a.b.read")],
      [
        { code: "a.b.read", reason: "still in catalogue" },
        { code: "BAD", reason: "r" },
        { code: "a.b.old", reason: " " },
        { code: "a.b.old", reason: "dup" },
      ],
    );
    assert.equal(problems.length, 4);
    assert.ok(
      problems.some((p) => /both in the catalogue and retired/.test(p)),
    );
    assert.ok(
      problems.some((p) => /does not match the naming pattern/.test(p)),
    );
    assert.ok(problems.some((p) => /needs a reason/.test(p)));
    assert.ok(problems.some((p) => /listed more than once/.test(p)));
  });

  it("reports every problem, not just the first", () => {
    assert.equal(
      findCatalogProblems([def("bad"), def("also.bad"), def("a.b.read", "")])
        .length,
      3,
    );
  });
});

describe("assertValidCatalog", () => {
  it("throws CatalogValidationError listing the problems", () => {
    assert.throws(
      () => assertValidCatalog([def("bad")]),
      (error: unknown) =>
        error instanceof CatalogValidationError &&
        error.problems.length === 1 &&
        /1 problem/.test(error.message),
    );
  });
  it("does not throw for a valid catalogue", () => {
    assert.doesNotThrow(() => assertValidCatalog([def("a.b.read")]));
  });
});
