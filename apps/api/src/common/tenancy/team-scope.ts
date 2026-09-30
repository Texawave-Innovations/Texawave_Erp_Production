/** The only three scope suffixes a team-scoped permission may carry
 * (Docs/CODING_STANDARDS.md §2a), most permissive last. */
export const TEAM_ACCESS_LEVELS = ["own", "team", "all"] as const;

/** Same shape as `OrgScope` (org-scope.ts), one level down — the actual
 * access boundary in this app (Docs/CODING_STANDARDS.md §10a). */
export type TeamAccessLevel = (typeof TEAM_ACCESS_LEVELS)[number];

export interface TeamScope {
  level: TeamAccessLevel;
  userId: number;
  /** The caller's organization — `teamWhere()` always adds it, so a
   * team-scoped query is tenant-safe by construction. */
  organizationId: number;
  teamIds: number[]; // resolved from user_team_access at request time; empty for "all"
}
