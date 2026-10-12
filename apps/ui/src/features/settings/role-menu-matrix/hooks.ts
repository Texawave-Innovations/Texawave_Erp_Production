"use client";

import type { MenuItem, Permission } from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { listMenuItems } from "../../menu/api";
import { getRole, listPermissionCatalog } from "../roles/api";

const SCOPES = ["own", "team", "all"] as const;
export type Scope = (typeof SCOPES)[number];

/** Strips a trailing `.own`/`.team`/`.all` if present — `MenuItem.permission`
 * is always stored as the bare, scope-less prefix (see
 * packages/database/prisma/seed.ts), but this stays defensive in case a menu
 * item is ever pointed at an already-scoped code. */
function basePrefix(code: string): string {
  const parts = code.split(".");
  const last = parts[parts.length - 1];
  if (SCOPES.includes(last as Scope)) {
    return parts.slice(0, -1).join(".");
  }
  return code;
}

export interface MatrixRow {
  menuItem: MenuItem;
  /** `null` when the tab is ungated (`permission: null`) — always visible. */
  prefix: string | null;
  /** Scoped row: one `Permission` per level that exists in the catalog. */
  scoped: Partial<Record<Scope, Permission>> | null;
  /** Flat row: the single permission that gates this tab (no scope variants). */
  flat: Permission | null;
  /** Currently granted level/permission, derived from the role's grants. */
  currentScope: Scope | null;
  currentFlatGranted: boolean;
}

export interface RoleMenuMatrix {
  rows: MatrixRow[];
  grantedIds: Set<number>;
}

function buildMatrix(
  menuItems: MenuItem[],
  catalog: Permission[],
  grantedIds: Set<number>,
): RoleMenuMatrix {
  const byCode = new Map(catalog.map((p) => [p.code, p]));
  const rows: MatrixRow[] = [];

  for (const menuItem of menuItems) {
    if (!menuItem.permission) {
      rows.push({
        menuItem,
        prefix: null,
        scoped: null,
        flat: null,
        currentScope: null,
        currentFlatGranted: false,
      });
      continue;
    }

    const prefix = basePrefix(menuItem.permission);
    const scoped: Partial<Record<Scope, Permission>> = {};
    for (const scope of SCOPES) {
      const permission = byCode.get(`${prefix}.${scope}`);
      if (permission) scoped[scope] = permission;
    }
    const hasScoped = Object.keys(scoped).length > 0;

    if (hasScoped) {
      const currentScope =
        SCOPES.find((scope) => {
          const permission = scoped[scope];
          return permission ? grantedIds.has(permission.id) : false;
        }) ?? null;
      rows.push({
        menuItem,
        prefix,
        scoped,
        flat: null,
        currentScope,
        currentFlatGranted: false,
      });
    } else {
      const flat = byCode.get(menuItem.permission) ?? null;
      rows.push({
        menuItem,
        prefix,
        scoped: null,
        flat,
        currentScope: null,
        currentFlatGranted: flat ? grantedIds.has(flat.id) : false,
      });
    }
  }

  return { rows, grantedIds };
}

export function useRoleMenuMatrix(roleId: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);

  const menuQuery = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "menu-items", "matrix"),
    queryFn: () => listMenuItems({ limit: 100 }),
    enabled: Boolean(organizationId),
  });
  const catalogQuery = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "settings-permissions"),
    queryFn: () => listPermissionCatalog(),
    enabled: Boolean(organizationId),
  });
  const roleQuery = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "settings-roles",
      "detail",
      roleId ?? 0,
    ),
    queryFn: () => getRole(roleId as number),
    enabled: Boolean(organizationId) && roleId !== undefined,
  });

  const isPending =
    menuQuery.isPending || catalogQuery.isPending || roleQuery.isPending;
  const isError =
    menuQuery.isError || catalogQuery.isError || roleQuery.isError;

  const matrix =
    !isPending && !isError
      ? buildMatrix(
          menuQuery.data.items,
          catalogQuery.data,
          new Set(roleQuery.data.permissions.map((p) => p.id)),
        )
      : undefined;

  return {
    isPending,
    isError,
    error: menuQuery.error ?? catalogQuery.error ?? roleQuery.error,
    matrix,
    refetch: () => {
      void menuQuery.refetch();
      void catalogQuery.refetch();
      void roleQuery.refetch();
    },
  };
}
