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

  it("HR Manager prepares payroll but approval, reopen and settings stay with Super Admin", () => {
    const perms = new Set(role("HR Manager").permissions);
    for (const needed of [
      "hr.payroll.read.all",
      "hr.payroll.write.all",
      "hr.payroll.finalize.all",
      "hr.payroll.export.all",
      "hr.salary.write.all",
      "hr.loan.write.all",
      "hr.payslip.read.all",
      "hr.payment.write.all",
      "hr.loan.review.all",
    ]) {
      assert.ok(perms.has(needed), `HR Manager should hold ${needed}`);
    }
    for (const reserved of [
      "hr.payroll.approve.all",
      "hr.payroll.reopen.all",
      "hr.loan.approve.all",
      "hr.bonus.approve.all",
      "hr.payroll_settings.write",
    ]) {
      assert.ok(!perms.has(reserved), `HR Manager must not hold ${reserved}`);
    }
  });

  it("Team Lead sees no pay data", () => {
    const pay =
      /^hr.(payroll|salary|pf|esi|loan|bonus|payslip|payment|tax_declaration)./;
    assert.deepEqual(
      role("Team Lead").permissions.filter((c) => pay.test(c)),
      [],
    );
  });

  it("Employee reads only their own pay records (self-service codes)", () => {
    const perms = role("Employee").permissions;
    for (const needed of [
      "employee_self_service.payslip.read",
      "employee_self_service.loan.read",
      "employee_self_service.loan.write",
      "employee_self_service.tax_declaration.read",
      "employee_self_service.tax_declaration.write",
      "employee_self_service.form16.read",
    ]) {
      assert.ok(perms.includes(needed), `Employee should hold ${needed}`);
    }
    assert.deepEqual(
      perms.filter((c) =>
        /^hr.(payroll|salary|payslip|loan|tax_declaration)./.test(c),
      ),
      [],
    );
  });

  it("Sales Executive cannot delete customers or reveal bank accounts; only Sales roles hold sales.*", () => {
    const exec = role("Sales Executive").permissions;
    assert.ok(!exec.includes("sales.customer.delete"));
    assert.ok(!exec.includes("sales.customer_bank.reveal"));
    assert.ok(
      !exec.includes("sales.master.write"),
      "only managers edit the master list",
    );
    for (const code of exec) {
      assert.ok(!code.endsWith(".delete"), `executive must not hold ${code}`);
    }
    assert.ok(
      !exec.includes("sales.invoice_payment.write"),
      "only managers record payments",
    );
    assert.ok(
      role("Sales Manager").permissions.includes("sales.customer.delete"),
    );
    assert.ok(
      role("Sales Manager").permissions.includes("sales.invoice_payment.write"),
    );
    for (const r of DEFAULT_ROLES) {
      const isSales = r.name.startsWith("Sales ");
      for (const code of r.permissions) {
        assert.equal(
          code.startsWith("sales."),
          isSales,
          `${r.name} should ${isSales ? "only" : "never"} hold sales.* (${code})`,
        );
      }
    }
  });
});
