// HANDWRITTEN — mirrors apps/api/src/modules/settings/roles/. See
// packages/api-types/README.md.

export interface Permission {
  id: number;
  code: string;
  description: string;
}

export interface Role {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  /** Shipped by the platform: grants editable, name and status fixed. */
  isSystem: boolean;
  /** Optimistic lock: send it back on PATCH / PUT permissions. */
  version: number;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Row of GET /settings/roles. */
export interface RoleListItem extends Role {
  permissionCount: number;
  /** Active users holding the role. */
  userCount: number;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
  userCount: number;
  lastChangedBy: { id: number; fullName: string } | null;
}

export interface CloneRoleInput {
  name: string;
  description?: string;
}

/** Row of GET /settings/roles/:id/history (platform audit_logs). */
export interface RoleHistoryEntry {
  id: string;
  action: string;
  actorUserId: number | null;
  actorName: string | null;
  actorType: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  at: string;
}

/** GET /users/:id/effective-permissions */
export interface EffectivePermissions {
  user: { id: number; fullName: string; isActive: boolean };
  roles: { id: number; name: string; isActive: boolean; isSystem: boolean }[];
  teams: { id: number; name: string; isLead: boolean }[];
  permissions: {
    id: number;
    code: string;
    description: string;
    grantedBy: { roleId: number; roleName: string }[];
  }[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  version?: number;
}

export interface SetRolePermissionsInput {
  permissionIds: number[];
  version?: number;
}

export interface QueryRolesInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
