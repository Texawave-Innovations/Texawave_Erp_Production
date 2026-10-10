import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PERMISSION_CATALOG } from "./catalog.js";
import { DEFAULT_ROLES } from "./default-roles.js";

const catalog = new Set(PERMISSION_CATALOG.map((p) => p.code));
const role = (name: string) => {
  const found = DEFAULT_ROLES.find((r) => r.name === name);
  assert.ok(found, `role ${name} exists`);
  return found;
};

/** Anything that changes data or decides something, as opposed to reading. */
const isMutating = (code: string) =>
  /\.(write|approve|correct)(\.|$)/.test(code) ||
  code.includes("_status.") ||
  code.includes("_account.");

describe("default roles", () => {
  it("only reference permissions that exist in the catalogue (no typos, no stale codes)", () => {
    for (const r of DEFAULT_ROLES) {
      for (const code of r.permissions) {
        assert.ok(
          catalog.has(code),
          `${r.name} references unknown permission ${code}`,
        );
      }
    }
  });

  it("list each permission once per role", () => {
    for (const r of DEFAULT_ROLES) {
      assert.equal(
        new Set(r.permissions).size,
        r.permissions.length,
        `${r.name} has duplicates`,
      );
    }
  });

  it("Team Lead is READ-ONLY: no write, approve, status or account permission of any scope", () => {
    const mutating = role("Team Lead").permissions.filter(isMutating);
    assert.deepEqual(mutating, []);
    assert.ok(
      role("Team Lead").permissions.includes("hr.employee.read.team"),
      "but can read their own team",
    );
  });

  it("Team Lead never holds an organization-wide employee permission", () => {
    assert.deepEqual(
      role("Team Lead").permissions.filter(
        (c) => c.startsWith("hr.employee.") && c.endsWith(".all"),
      ),
      [],
    );
  });

  it("Employee holds no HR write/approve permission and no team/all read of others", () => {
    const perms = role("Employee").permissions;
    assert.deepEqual(
      perms
        .filter(isMutating)
        .filter((c) => !c.startsWith("employee_self_service.")),
      [],
    );
    assert.deepEqual(
      perms.filter((c) => /\.(team|all)$/.test(c)),
      [],
    );
  });

  it("Employee and Team Lead work in the portal, HR Manager in the HR workspace", () => {
    assert.ok(!role("Employee").permissions.includes("hr.workspace.access"));
    assert.ok(!role("Team Lead").permissions.includes("hr.workspace.access"));
    assert.ok(role("HR Manager").permissions.includes("hr.workspace.access"));
  });

  it("nobody but Super Admin can correct a terminal employment status", () => {
    for (const r of DEFAULT_ROLES) {
      assert.ok(
        !r.permissions.includes("hr.employee_status.correct"),
        `${r.name} must not hold it`,
      );
    }
  });

  it("no default role holds a .team write/approve permission (open decisions)", () => {
    for (const r of DEFAULT_ROLES) {
      const teamMutating = r.permissions.filter(
        (c) => c.endsWith(".team") && isMutating(c),
      );
      assert.deepEqual(teamMutating, [], `${r.name}`);
    }
  });

  it("no default role grants the reserved .own write/approve variants", () => {
    for (const r of DEFAULT_ROLES) {
      assert.deepEqual(
        r.permissions.filter((c) => c.endsWith(".own") && isMutating(c)),
        [],
        r.name,
      );
    }
  });

  it("HR Manager can run the HR areas the brief lists", () => {
    const perms = new Set(role("HR Manager").permissions);
    for (const needed of [
      "hr.employee.write.all",
      "hr.employee_status.write",
      "hr.employee_account.write",
      "hr.shift_assignment.write.all",
      "hr.holiday.write",
      "hr.weekly_off.write",
      "hr.leave.approve.all",
      "master.designation.write",
      "audit.log.read",
    ]) {
      assert.ok(perms.has(needed), `HR Manager should hold ${needed}`);
    }
  });
});
