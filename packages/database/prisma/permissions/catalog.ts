// The version-controlled permission catalogue: the single source of truth for
// which permission rows must exist in EVERY environment (dev, staging,
// production). `permissions` rows are data, not schema, so no migration
// creates them; `syncPermissions()` (sync.ts) makes the database match this
// file, additively and idempotently. Run it after `prisma migrate deploy` —
// see packages/database/prisma/permissions/README.md.
//
// Adding a permission = add it here in the same PR as the code that checks it.
// Naming rules (Docs/CODING_STANDARDS.md §2a) are enforced by validate.ts.

export interface PermissionDef {
  /** `<module>.<entity>.<action>[.<own|team|all>]` */
  code: string;
  description: string;
}

/** A permission that is no longer used. Sync deactivates it (never deletes
 * it — role grants and audit history may still reference it). */
export interface RetiredPermission {
  code: string;
  reason: string;
}

/** Expands a team-scoped permission into all three variants
 * (`.own`/`.team`/`.all`) — they are always seeded together
 * (Docs/CODING_STANDARDS.md §10a) so adding `.team` later never needs a data
 * migration on `role_permissions`. `prefix` is `<module>.<entity>.<action>`. */
export function scopedPermission(
  prefix: string,
  description: string,
): PermissionDef[] {
  return [
    { code: `${prefix}.own`, description: `${description} (own records)` },
    { code: `${prefix}.team`, description: `${description} (own team)` },
    { code: `${prefix}.all`, description: `${description} (all teams)` },
  ];
}

export const PERMISSION_CATALOG: readonly PermissionDef[] = [
  // apps/api/src/modules/_reference/tags — no team dimension.
  { code: "reference.tags.read", description: "View reference tags" },
  {
    code: "reference.tags.write",
    description: "Create/update/delete reference tags",
  },

  // apps/api/src/modules/settings/roles — no team dimension.
  {
    code: "settings.role.read",
    description: "View roles and their permissions",
  },
  {
    code: "settings.role.write",
    description: "Create/rename roles and assign/revoke their permissions",
  },

  // apps/api/src/modules/master-data/* — organization-wide reference data, no
  // team dimension. `write` covers create/update/activate/deactivate.
  { code: "master.designation.read", description: "View designations" },
  {
    code: "master.designation.write",
    description: "Create/update/deactivate designations",
  },
  { code: "master.employment_type.read", description: "View employment types" },
  {
    code: "master.employment_type.write",
    description: "Create/update/deactivate employment types",
  },
  { code: "master.work_location.read", description: "View work locations" },
  {
    code: "master.work_location.write",
    description: "Create/update/deactivate work locations",
  },

  // apps/api/src/platform/audit — read-only; no team dimension (design A-4).
  {
    code: "audit.log.read",
    description: "Browse the organization's audit trail",
  },
];

export const RETIRED_PERMISSIONS: readonly RetiredPermission[] = [];
