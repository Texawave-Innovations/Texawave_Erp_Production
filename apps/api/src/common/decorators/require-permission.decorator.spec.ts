import "reflect-metadata";
import {
  ANY_PERMISSION_KEY,
  PERMISSION_KEY,
  RequireAnyPermission,
  RequirePermission,
  RequireScopedPermission,
  SCOPED_PERMISSION_KEY,
} from "./require-permission.decorator.js";

describe("RequireAnyPermission", () => {
  it("stores the codes under its own metadata key", () => {
    class Probe {
      @RequireAnyPermission(
        "employee_self_service.work.write",
        "projects.timer.write",
      )
      handler() {}
    }
    const handler = Probe.prototype.handler;
    expect(Reflect.getMetadata(ANY_PERMISSION_KEY, handler)).toEqual([
      "employee_self_service.work.write",
      "projects.timer.write",
    ]);
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toBeUndefined();
  });

  it("refuses a single code (that is @RequirePermission) and blank codes", () => {
    expect(() =>
      (RequireAnyPermission as (...p: string[]) => unknown)("a.b.c"),
    ).toThrow(/at least two/);
    expect(() => RequireAnyPermission("a.b.c", " ")).toThrow(/non-empty/);
  });
});

describe("RequireScopedPermission", () => {
  it("stores the prefix under its own metadata key, not the exact-match key", () => {
    class Probe {
      @RequireScopedPermission("hr.employee.read")
      handler() {}
    }
    const handler = Probe.prototype.handler;
    expect(Reflect.getMetadata(SCOPED_PERMISSION_KEY, handler)).toBe(
      "hr.employee.read",
    );
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toBeUndefined();
  });

  it("accepts underscores inside a segment", () => {
    expect(() =>
      RequireScopedPermission("employee_self_service.leave_request.read"),
    ).not.toThrow();
  });

  it.each(["own", "team", "all"])(
    "rejects a prefix that already ends in .%s (with a message naming the fix)",
    (level) => {
      expect(() =>
        RequireScopedPermission(`hr.employee.read.${level}`),
      ).toThrow(/without the "\.\w+" scope suffix/);
    },
  );

  it.each([
    "hr.employee", // two segments
    "hr.employee.read.extra", // four segments, last not a scope
    "HR.employee.read", // upper case
    "hr..read", // empty segment
    "hr.employee.read ", // whitespace
    "",
  ])("rejects malformed prefix %j at decoration time", (prefix) => {
    expect(() => RequireScopedPermission(prefix)).toThrow();
  });

  it("leaves @RequirePermission's exact-string behaviour unchanged", () => {
    class Probe {
      @RequirePermission("hr.employee.read.team")
      handler() {}
    }
    expect(Reflect.getMetadata(PERMISSION_KEY, Probe.prototype.handler)).toBe(
      "hr.employee.read.team",
    );
  });
});
