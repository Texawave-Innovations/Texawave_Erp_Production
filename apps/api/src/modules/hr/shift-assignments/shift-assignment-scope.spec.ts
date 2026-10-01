import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { shiftAssignmentScopeWhere } from "./shift-assignment-scope.js";

const scope = (over: Partial<TeamScope>): TeamScope => ({
  level: "all",
  userId: 7,
  organizationId: 3,
  teamIds: [],
  ...over,
});

describe("shiftAssignmentScopeWhere", () => {
  it("'all' is the whole organization and nothing more", () => {
    expect(shiftAssignmentScopeWhere(scope({ level: "all" }))).toEqual({
      organizationId: 3,
    });
  });

  it("'team' covers employees of the caller's teams and those teams' own assignments", () => {
    expect(
      shiftAssignmentScopeWhere(scope({ level: "team", teamIds: [1, 2] })),
    ).toEqual({
      organizationId: 3,
      OR: [
        { employee: { teamId: { in: [1, 2] } } },
        { teamId: { in: [1, 2] } },
      ],
    });
  });

  it("'team' with no teams matches nothing (fails closed)", () => {
    const where = shiftAssignmentScopeWhere(
      scope({ level: "team", teamIds: [] }),
    );
    expect(where).toEqual({
      organizationId: 3,
      OR: [{ employee: { teamId: { in: [] } } }, { teamId: { in: [] } }],
    });
  });

  it("'own' is only the caller's own employee assignments, not team defaults", () => {
    expect(shiftAssignmentScopeWhere(scope({ level: "own" }))).toEqual({
      organizationId: 3,
      employee: { userId: 7 },
    });
  });

  it("always carries the organization", () => {
    for (const level of ["all", "team", "own"] as const) {
      expect(shiftAssignmentScopeWhere(scope({ level }))).toMatchObject({
        organizationId: 3,
      });
    }
  });

  it("does not share the caller's teamIds array with the query", () => {
    const teamIds = [1];
    const where = shiftAssignmentScopeWhere(scope({ level: "team", teamIds }));
    (where.OR?.[1] as { teamId: { in: number[] } }).teamId.in.push(99);
    expect(teamIds).toEqual([1]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects organizationId %s",
    (organizationId) => {
      expect(() =>
        shiftAssignmentScopeWhere(scope({ organizationId })),
      ).toThrow(/organizationId/);
    },
  );

  it("rejects an 'own' scope without a valid user and an unknown level", () => {
    expect(() =>
      shiftAssignmentScopeWhere(scope({ level: "own", userId: 0 })),
    ).toThrow(/userId/);
    expect(() =>
      shiftAssignmentScopeWhere({
        ...scope({}),
        level: "any",
      } as unknown as TeamScope),
    ).toThrow(/unknown scope level/);
  });
});
