import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

/** `<module>.<entity>.<action>`, e.g. `reference.tags.write`
 * (Docs/CODING_STANDARDS.md §2). Checked by `PermissionsGuard`
 * (platform/roles-permissions). */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
