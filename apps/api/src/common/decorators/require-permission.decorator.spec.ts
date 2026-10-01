import "reflect-metadata";
import {
  PERMISSION_KEY,
  RequirePermission,
  RequireScopedPermission,
  SCOPED_PERMISSION_KEY,
} from "./require-permission.decorator.js";

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
