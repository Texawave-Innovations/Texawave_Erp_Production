import type {
  CreateRoleInput,
  PaginatedEnvelope,
  Permission,
  QueryRolesInput,
  Role,
  RoleDetail,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Mirrors apps/api/src/modules/settings/roles/. Every feature's `api.ts`
 * looks like this: thin wrappers around the shared `apiClient`, never
 * `fetch` called directly from a component or hook
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
export function listRoles(
  query: QueryRolesInput,
): Promise<PaginatedEnvelope<Role>> {
  return withAuthRetry(() =>
    apiClient.get<Role[]>("/settings/roles", { query }),
  ) as Promise<PaginatedEnvelope<Role>>;
}

export async function getRole(id: number): Promise<RoleDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<RoleDetail>(`/settings/roles/${id}`),
  );
  return data;
}

export async function listPermissionCatalog(): Promise<Permission[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Permission[]>("/settings/permissions"),
  );
  return data;
}

export async function createRole(input: CreateRoleInput): Promise<Role> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Role>("/settings/roles", input),
  );
  return data;
}

export async function updateRole(
  id: number,
  input: UpdateRoleInput,
): Promise<Role> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Role>(`/settings/roles/${id}`, input),
  );
  return data;
}

export async function setRolePermissions(
  id: number,
  input: SetRolePermissionsInput,
): Promise<RoleDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<RoleDetail>(`/settings/roles/${id}/permissions`, input),
  );
  return data;
}
