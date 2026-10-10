import { describe, expect, it } from "vitest";
import { tenantWhere } from "./tenant-where.js";

describe("tenantWhere", () => {
  it("returns just the scope when no filter is given", () => {
    expect(tenantWhere({ organizationId: 3 })).toEqual({ organizationId: 3 });
  });

  it("merges a caller filter with the scope", () => {
    expect(
      tenantWhere({ organizationId: 3 }, { status: "ACTIVE", name: "x" }),
    ).toEqual({ status: "ACTIVE", name: "x", organizationId: 3 });
  });

  it("never lets a filter override the scope's organizationId", () => {
    const hostile = { organizationId: 999, deletedAt: null };
    expect(tenantWhere({ organizationId: 3 }, hostile)).toEqual({
      organizationId: 3,
      deletedAt: null,
    });
  });

  it("does not mutate the inputs", () => {
    const scope = { organizationId: 3 };
    const filter = { organizationId: 9, q: "a" };
    const result = tenantWhere(scope, filter);
    expect(filter).toEqual({ organizationId: 9, q: "a" });
    expect(result).not.toBe(filter);
    expect(result).not.toBe(scope);
  });
});
