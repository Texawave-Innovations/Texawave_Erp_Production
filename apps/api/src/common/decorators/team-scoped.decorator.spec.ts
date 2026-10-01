import type { TeamScope } from "../tenancy/team-scope.js";
import { TeamScoped } from "./team-scoped.decorator.js";

class Repo {
  @TeamScoped()
  find(scope: TeamScope, extra: string) {
    return `${scope.level}:${extra}`;
  }
}

describe("@TeamScoped()", () => {
  it.each(["own", "team", "all"] as const)(
    "passes a valid '%s' scope and the remaining arguments through",
    (level) => {
      const scope: TeamScope = {
        level,
        userId: 1,
        organizationId: 1,
        teamIds: [],
      };
      expect(new Repo().find(scope, "x")).toBe(`${level}:x`);
    },
  );

  it("throws when called without a scope", () => {
    const call = new Repo().find as unknown as (...a: unknown[]) => unknown;
    expect(() => call.call(new Repo(), undefined, "x")).toThrow(
      /without a valid TeamScope/,
    );
  });

  it("throws when the first argument is not a TeamScope (e.g. an OrgScope)", () => {
    const call = new Repo().find as unknown as (...a: unknown[]) => unknown;
    expect(() => call.call(new Repo(), { organizationId: 1 }, "x")).toThrow(
      /without a valid TeamScope/,
    );
  });

  it("throws when the scope carries no organizationId", () => {
    const call = new Repo().find as unknown as (...a: unknown[]) => unknown;
    expect(() =>
      call.call(new Repo(), { level: "all", userId: 1, teamIds: [] }, "x"),
    ).toThrow(/no organizationId/);
  });

  it("throws on an unknown level", () => {
    const call = new Repo().find as unknown as (...a: unknown[]) => unknown;
    expect(() =>
      call.call(
        new Repo(),
        { level: "any", userId: 1, organizationId: 1, teamIds: [] },
        "x",
      ),
    ).toThrow(/without a valid TeamScope/);
  });
});
