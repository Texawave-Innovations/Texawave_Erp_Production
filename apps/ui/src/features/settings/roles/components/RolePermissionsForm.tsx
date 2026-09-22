"use client";

import {
  Alert,
  Button,
  Checkbox,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermissionCatalog, useRole, useSetRolePermissions } from "../hooks";

export interface RolePermissionsFormProps {
  roleId: number;
  roleName: string;
  onClose: () => void;
}

/** `module.entity.action[.scope]` → `{ module.entity, action[.scope] }` —
 * groups the flat catalog by module/entity for display. Works unchanged
 * once permissions with `.own`/`.team`/`.all` scope suffixes exist again
 * (Docs/CODING_STANDARDS.md §2a) — nothing here assumes the current
 * scope-less catalog is permanent. */
function groupKey(code: string): string {
  return code.split(".").slice(0, 2).join(".");
}

function actionLabel(code: string): string {
  return code.split(".").slice(2).join(".");
}

/**
 * Checkbox grid for one role's granted permissions — the UI half of
 * apps/api/src/modules/settings/roles/ (Docs/ARCHITECTURE.md §11,
 * 2026-09-22 changelog entry). Submits the full desired set via
 * `PUT /settings/roles/:id/permissions`; the backend diffs it against what's
 * currently granted (never deletes a grant row, flips `isActive` instead).
 */
export function RolePermissionsForm({
  roleId,
  roleName,
  onClose,
}: RolePermissionsFormProps) {
  const roleQuery = useRole(roleId);
  const catalogQuery = usePermissionCatalog();
  const setPermissions = useSetRolePermissions();
  const { toast } = useToast();

  // `null` = "no user edits yet, derive from the loaded role" — avoids
  // syncing query data into state via an effect (this component is
  // remounted per role via `key={role.id}` in RolesView, so a fresh `null`
  // here already means "freshly opened for this role").
  const [selected, setSelected] = useState<Set<number> | null>(null);

  if (roleQuery.isPending || catalogQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (roleQuery.isError || catalogQuery.isError) {
    return (
      <Alert variant="error" title="Could not load permissions">
        Close this dialog and try again.
      </Alert>
    );
  }

  const catalog = catalogQuery.data;
  const grantedIds = new Set(roleQuery.data.permissions.map((p) => p.id));
  const effectiveSelected = selected ?? grantedIds;

  const groups = new Map<string, typeof catalog>();
  for (const permission of catalog) {
    const key = groupKey(permission.code);
    groups.set(key, [...(groups.get(key) ?? []), permission]);
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev ?? grantedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    try {
      await setPermissions.mutateAsync({
        id: roleId,
        input: { permissionIds: [...effectiveSelected] },
      });
      toast({
        title: `Updated permissions for "${roleName}"`,
        variant: "success",
      });
      onClose();
    } catch {
      toast({ title: "Could not update permissions", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {catalog.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          The permission catalog is empty — nothing to assign yet.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
          {[...groups.entries()].map(([group, permissions]) => (
            <div key={group} className="flex flex-col gap-2">
              <span className="text-theme-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                {group}
              </span>
              {permissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300"
                >
                  <Checkbox
                    checked={effectiveSelected.has(permission.id)}
                    onChange={() => toggle(permission.id)}
                    disabled={setPermissions.isPending}
                  />
                  <span>
                    {actionLabel(permission.code)}
                    <span className="ml-2 text-gray-400 dark:text-gray-500">
                      {permission.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={setPermissions.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={setPermissions.isPending}
          onClick={() => void handleSave()}
        >
          Save permissions
        </Button>
      </div>
    </div>
  );
}
