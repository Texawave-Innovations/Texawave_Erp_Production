/** The validated JWT payload, attached to `request.user` by `JwtStrategy` /
 * `JwtAuthGuard`. Mirrors Docs/ARCHITECTURE.md §6 point 1 — permissions are
 * resolved separately (cached in Redis, see platform/roles-permissions) so
 * the token stays small and revocable without reissuing it. */
export interface AuthenticatedUser {
  userId: number;
  organizationId: number;
  roleIds: number[];
}
