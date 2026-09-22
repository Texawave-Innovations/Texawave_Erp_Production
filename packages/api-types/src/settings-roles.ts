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
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface CreateRoleInput {
  name: string;
}

export interface UpdateRoleInput {
  name?: string;
  isActive?: boolean;
}

export interface SetRolePermissionsInput {
  permissionIds: number[];
}

export interface QueryRolesInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
