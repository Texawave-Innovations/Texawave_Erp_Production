import { describe, expect, it } from "vitest";
import type { OrgScope } from "../tenancy/org-scope.js";
import { OrgScoped } from "./org-scoped.decorator.js";

class Repo {
  prefix = "repo";

  @OrgScoped()
  find(scope: OrgScope, a: string, b: number) {
    return `${this.prefix}:${scope.organizationId}:${a}:${b}`;
  }
}

type LooseCall = (...args: unknown[]) => unknown;
const callFind = (repo: Repo, ...args: unknown[]) =>
  (repo.find as unknown as LooseCall).call(repo, ...args);

describe("@OrgScoped()", () => {
  it("passes a valid scope, the remaining args and `this` through", () => {
    expect(new Repo().find({ organizationId: 7 }, "x", 2)).toBe("repo:7:x:2");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["a string id", { organizationId: "7" }],
    ["a non-integer id", { organizationId: 1.5 }],
    ["NaN", { organizationId: Number.NaN }],
  ])("throws when the scope is %s, naming the method", (_label, scope) => {
    expect(() => callFind(new Repo(), scope, "x", 2)).toThrow(
      /^find was called without a valid OrgScope as its first argument/,
    );
  });

  it("never invokes the original method when the scope is invalid", () => {
    let calls = 0;
    class Counting {
      @OrgScoped()
      run(_scope: OrgScope) {
        calls += 1;
      }
    }
    expect(() =>
      (new Counting().run as unknown as LooseCall)(undefined),
    ).toThrow();
    expect(calls).toBe(0);
  });
});
