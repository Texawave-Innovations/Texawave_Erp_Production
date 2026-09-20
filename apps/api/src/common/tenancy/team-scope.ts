/** Same shape as `OrgScope` (org-scope.ts), one level down — the actual
 * access boundary in this app (Docs/CODING_STANDARDS.md §10a). */
export type TeamAccessLevel = "own" | "team" | "all";

export interface TeamScope {
  level: TeamAccessLevel;
  userId: number;
  teamIds: number[]; // resolved from user_team_access at request time; empty for "all"
}
