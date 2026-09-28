/**
 * Pure evaluation helper to check whether a user's granted permissions
 * satisfy one or more required permissions.
 *
 * Mode:
 * - "atLeastOne": true if user has at least one of the required permissions (default)
 * - "all": true only if user has all required permissions
 */
export function hasPermission(
  userPermissions: readonly string[] | Set<string> | undefined | null,
  required: string | readonly string[],
  mode: "atLeastOne" | "all" = "atLeastOne",
): boolean {
  if (!userPermissions) {
    return false;
  }

  const permsSet =
    userPermissions instanceof Set ? userPermissions : new Set(userPermissions);

  const reqArray = Array.isArray(required) ? required : [required];
  if (reqArray.length === 0) {
    return true;
  }

  if (mode === "all") {
    return reqArray.every((req) => permsSet.has(req));
  }

  return reqArray.some((req) => permsSet.has(req));
}
