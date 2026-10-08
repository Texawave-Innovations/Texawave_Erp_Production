import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { TenancyInterceptor } from "./tenancy.interceptor.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function run(request: Record<string, unknown>) {
  const store = new Map<string, unknown>();
  const cls = {
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const handled = of("response");
  const next = { handle: vi.fn().mockReturnValue(handled) };

  const interceptor = new TenancyInterceptor(cls as never);
  const result = interceptor.intercept(context as never, next as never);
  return { store, cls, next, result, handled };
}

describe("TenancyInterceptor", () => {
  it("populates org, user and role context from the authenticated user", () => {
    const { store, next, result, handled } = run({
      id: "req-123",
      ip: "10.0.0.5",
      user: { organizationId: 4, userId: 99, roleIds: [1, 2] },
    });

    expect(Object.fromEntries(store)).toEqual({
      correlationId: "req-123",
      ip: "10.0.0.5",
      organizationId: 4,
      userId: 99,
      roleIds: [1, 2],
    });
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(result).toBe(handled);
  });

  it("on a public route sets only correlation id and ip, never org/user", () => {
    const { store, next } = run({ id: "req-9", ip: "127.0.0.1" });

    expect([...store.keys()].sort()).toEqual(["correlationId", "ip"]);
    expect(store.has("organizationId")).toBe(false);
    expect(store.has("userId")).toBe(false);
    expect(store.has("roleIds")).toBe(false);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it("generates a fresh UUID correlation id when the request has no id", () => {
    const first = run({ ip: "1.1.1.1" }).store.get("correlationId");
    const second = run({ ip: "1.1.1.1" }).store.get("correlationId");

    expect(first).toMatch(UUID_RE);
    expect(second).toMatch(UUID_RE);
    expect(first).not.toBe(second);
  });

  it("records an undefined ip rather than inventing one", () => {
    const { store } = run({ id: "x" });
    expect(store.has("ip")).toBe(true);
    expect(store.get("ip")).toBeUndefined();
  });
});
