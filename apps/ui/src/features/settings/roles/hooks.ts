"use client";

import type {
  CreateRoleInput,
  QueryRolesInput,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { listMenuItems } from "../../menu/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  createRole,
  getRole,
  listPermissionCatalog,
  listRoles,
  setRolePermissions,
  updateRole,
} from "./api";

function rolesKey(organizationId: number, query?: QueryRolesInput) {
  return orgScopedKey(organizationId, "settings-roles", query ?? {});
}

export function useRoles(query: QueryRolesInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: rolesKey(organizationId ?? 0, query),
    queryFn: () => listRoles(query),
    enabled: Boolean(organizationId),
  });
}

export function useRole(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "settings-roles",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getRole(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function usePermissionCatalog() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "settings-permissions"),
    queryFn: () => listPermissionCatalog(),
    enabled: Boolean(organizationId),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateRoleInput) => createRole(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "settings-roles"),
      });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateRoleInput }) =>
      updateRole(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "settings-roles"),
      });
    },
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: SetRolePermissionsInput;
    }) => setRolePermissions(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "settings-roles"),
      });
    },
  });
}

/** Every navigation item (for the role editor's Navigation panel). */
export function useMenuItemsForRoles() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "menu-items", "role-editor"),
    queryFn: async () => (await listMenuItems({ limit: 100 })).items,
    enabled: Boolean(organizationId),
  });
}

/** Details (with permissions) of several roles, for a user's effective
 * access. Shares the per-role cache with useRole(). */
export function useRoleDetails(ids: readonly number[]) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: orgScopedKey(
        organizationId ?? 0,
        "settings-roles",
        "detail",
        id,
      ),
      queryFn: () => getRole(id),
      enabled: Boolean(organizationId),
    })),
  });
}
