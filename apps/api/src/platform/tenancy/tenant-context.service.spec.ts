import { describe, expect, it, vi } from "vitest";
import { TenantContextService } from "./tenant-context.service.js";

function makeService(store: Record<string, unknown>) {
  const cls = { get: vi.fn((key: string) => store[key]) };
  return { service: new TenantContextService(cls as never), cls };
}

describe("TenantContextService.getOrgScope", () => {
  it("returns the organization from the request context", () => {
    const { service, cls } = makeService({ organizationId: 7 });
    expect(service.getOrgScope()).toEqual({ organizationId: 7 });
    expect(cls.get).toHaveBeenCalledWith("organizationId");
  });

  it("does not treat organizationId 0 as missing", () => {
    const { service } = makeService({ organizationId: 0 });
    expect(service.getOrgScope()).toEqual({ organizationId: 0 });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("throws when organizationId is %s (public route)", (_l, value) => {
    const { service } = makeService({ organizationId: value });
    expect(() => service.getOrgScope()).toThrow(/no organization in context/);
  });
});

describe("TenantContextService.getUserId", () => {
  it("returns the user id from the request context", () => {
    const { service } = makeService({ userId: 21 });
    expect(service.getUserId()).toBe(21);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("throws when userId is %s", (_l, value) => {
    const { service } = makeService({ userId: value });
    expect(() => service.getUserId()).toThrow(/no user in context/);
  });
});

describe("TenantContextService.getRoleIds", () => {
  it("returns the role ids from context", () => {
    const { service } = makeService({ roleIds: [2, 3] });
    expect(service.getRoleIds()).toEqual([2, 3]);
  });

  it("defaults to an empty array when none are set", () => {
    const { service } = makeService({});
    expect(service.getRoleIds()).toEqual([]);
  });
});

describe("TenantContextService.getCorrelationId", () => {
  it("returns the correlation id, or undefined when absent", () => {
    expect(
      makeService({ correlationId: "req-1" }).service.getCorrelationId(),
    ).toBe("req-1");
    expect(makeService({}).service.getCorrelationId()).toBeUndefined();
  });
});
