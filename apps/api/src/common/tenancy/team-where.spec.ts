import type { TeamScope } from "./team-scope.js";
import { teamWhere } from "./team-where.js";

const ALL: TeamScope = {
  level: "all",
  userId: 1,
  organizationId: 5,
  teamIds: [],
};
const TEAM: TeamScope = {
  level: "team",
  userId: 2,
  organizationId: 5,
  teamIds: [10, 11],
};
const OWN: TeamScope = {
  level: "own",
  userId: 3,
  organizationId: 5,
  teamIds: [],
};

describe("teamWhere", () => {
  it("'all' adds no restriction beyond the caller's filter", () => {
    expect(teamWhere(ALL, { deletedAt: null })).toEqual({
      AND: [{ deletedAt: null }, { organizationId: 5 }],
    });
    expect(teamWhere(ALL)).toEqual({ AND: [{}, { organizationId: 5 }] });
  });

  it("'team' restricts to the caller's team ids", () => {
    expect(teamWhere(TEAM, { deletedAt: null })).toEqual({
      AND: [
        { deletedAt: null },
        { organizationId: 5 },
        { teamId: { in: [10, 11] } },
      ],
    });
  });

  it("'own' restricts to the caller's own user id", () => {
    expect(teamWhere(OWN, { deletedAt: null })).toEqual({
      AND: [{ deletedAt: null }, { organizationId: 5 }, { userId: 3 }],
    });
  });

  it("does not let a caller-supplied teamId/userId filter replace the scope clause", () => {
    // Regression for the original spread-based implementation, where the
    // scope's `teamId`/`userId` silently overwrote the caller's filter: the
    // filter and the scope must both survive, so the DB returns their
    // intersection.
    expect(teamWhere(TEAM, { teamId: 99 })).toEqual({
      AND: [
        { teamId: 99 },
        { organizationId: 5 },
        { teamId: { in: [10, 11] } },
      ],
    });
    expect(teamWhere(OWN, { userId: 999 })).toEqual({
      AND: [{ userId: 999 }, { organizationId: 5 }, { userId: 3 }],
    });
  });

  it("does not mutate the caller's filter or the scope's teamIds", () => {
    const filter = { deletedAt: null };
    const scope: TeamScope = {
      level: "team",
      userId: 2,
      organizationId: 5,
      teamIds: [10],
    };
    const result = teamWhere(scope, filter);
    expect(filter).toEqual({ deletedAt: null });
    (result.AND[2] as { teamId: { in: number[] } }).teamId.in.push(77);
    expect(scope.teamIds).toEqual([10]);
  });

  it("fails closed: a 'team' scope with no teams matches nothing", () => {
    expect(
      teamWhere({ level: "team", userId: 2, organizationId: 5, teamIds: [] }),
    ).toEqual({
      AND: [{}, { organizationId: 5 }, { teamId: { in: [] } }],
    });
  });

  it("supports dotted field paths for tables keyed through a relation", () => {
    const fields = {
      teamField: "employee.teamId",
      ownerField: "employee.userId",
    };
    expect(teamWhere(TEAM, undefined, fields)).toEqual({
      AND: [
        {},
        { organizationId: 5 },
        { employee: { teamId: { in: [10, 11] } } },
      ],
    });
    expect(teamWhere(OWN, undefined, fields)).toEqual({
      AND: [{}, { organizationId: 5 }, { employee: { userId: 3 } }],
    });
  });

  it("supports custom (non-nested) column names", () => {
    expect(teamWhere(TEAM, undefined, { teamField: "ownerTeamId" })).toEqual({
      AND: [{}, { organizationId: 5 }, { ownerTeamId: { in: [10, 11] } }],
    });
  });

  it.each(["", "a..b", "a.", ".a", "a b", "a;drop", "1abc"])(
    "rejects invalid field path %j",
    (teamField) => {
      expect(() => teamWhere(TEAM, undefined, { teamField })).toThrow(
        /not a valid field path/,
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects an 'own' scope with invalid userId %s",
    (userId) => {
      expect(() =>
        teamWhere({ level: "own", userId, organizationId: 5, teamIds: [] }),
      ).toThrow(/valid userId/);
    },
  );

  it("always constrains to the caller's organization, whatever the level", () => {
    for (const scope of [ALL, TEAM, OWN]) {
      expect(teamWhere(scope).AND).toContainEqual({ organizationId: 5 });
    }
    expect(
      teamWhere(ALL, undefined, { orgField: "employee.organizationId" }).AND,
    ).toContainEqual({ employee: { organizationId: 5 } });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects a scope with invalid organizationId %s",
    (organizationId) => {
      expect(() => teamWhere({ ...ALL, organizationId })).toThrow(
        /valid organizationId/,
      );
    },
  );

  it("throws on an unknown level instead of falling through to a broader scope", () => {
    const bogus = {
      level: "any",
      userId: 1,
      organizationId: 5,
      teamIds: [],
    } as unknown as TeamScope;
    expect(() => teamWhere(bogus)).toThrow(/unknown scope level/);
  });
});
