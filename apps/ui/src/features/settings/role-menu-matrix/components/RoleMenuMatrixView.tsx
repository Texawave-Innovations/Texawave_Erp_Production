"use client";

import {
  Alert,
  Button,
  Checkbox,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useSetRolePermissions } from "../../roles/hooks";
import { type Scope, useRoleMenuMatrix } from "../hooks";

export interface RoleMenuMatrixViewProps {
  roleId: number;
  roleName: string;
  onClose: () => void;
}

const SCOPE_LABEL: Record<Scope, string> = {
  own: "Own records",
  team: "Own team",
  all: "All teams",
};

/**
 * Per-role tab-visibility matrix: one row per sidebar `MenuItem`, showing the
 * access level (`None`/`Own`/`Team`/`All`, or a plain grant checkbox for
 * flat/admin-only tabs) that currently gates it for this role.
 *
 * This is a view over the same data `RolePermissionsForm` edits — a tab's
 * visibility is never stored independently, it's derived from
 * `MenuItem.permission` + whichever of that permission's `.own/.team/.all`
 * variants the role holds (apps/api/src/modules/menu/menu.service.ts
 * `getMyMenu`). Saving here calls the same
 * `PUT /settings/roles/:id/permissions` full-replace endpoint, only touching
 * the permission ids this matrix actually displays — every other grant the
 * role holds (actions with no menu tab, e.g. `.write`/`.approve`) is carried
 * through unchanged.
 */
export function RoleMenuMatrixView({
  roleId,
  roleName,
  onClose,
}: RoleMenuMatrixViewProps) {
  const { isPending, isError, error, matrix, refetch } =
    useRoleMenuMatrix(roleId);
  const setPermissions = useSetRolePermissions();
  const { toast } = useToast();

  // Overrides keyed by menu item id. `undefined` = unchanged from the role's
  // current grants; for scoped rows the value is the chosen Scope or `null`
  // (none); for flat rows it's a boolean.
  const [scopeOverrides, setScopeOverrides] = useState<
    Map<number, Scope | null>
  >(new Map());
  const [flatOverrides, setFlatOverrides] = useState<Map<number, boolean>>(
    new Map(),
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !matrix) {
    return (
      <Alert variant="error" title="Could not load the menu matrix">
        {error instanceof Error
          ? error.message
          : "Close this dialog and try again."}
      </Alert>
    );
  }

  const visibleRows = matrix.rows.filter(
    (row) => row.scoped !== null || row.flat !== null,
  );

  async function handleSave() {
    const finalIds = new Set(matrix!.grantedIds);

    for (const row of visibleRows) {
      if (row.scoped) {
        const chosen = scopeOverrides.has(row.menuItem.id)
          ? scopeOverrides.get(row.menuItem.id)!
          : row.currentScope;
        for (const scope of Object.keys(row.scoped) as Scope[]) {
          const permission = row.scoped[scope];
          if (permission) finalIds.delete(permission.id);
        }
        if (chosen) {
          const permission = row.scoped[chosen];
          if (permission) finalIds.add(permission.id);
        }
      } else if (row.flat) {
        const granted =
          flatOverrides.get(row.menuItem.id) ?? row.currentFlatGranted;
        if (granted) {
          finalIds.add(row.flat.id);
        } else {
          finalIds.delete(row.flat.id);
        }
      }
    }

    try {
      await setPermissions.mutateAsync({
        id: roleId,
        input: { permissionIds: [...finalIds] },
      });
      toast({
        title: `Updated menu access for "${roleName}"`,
        variant: "success",
      });
      onClose();
    } catch {
      toast({ title: "Could not update menu access", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {visibleRows.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No permission-gated tabs exist yet.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {visibleRows.map((row) => {
            const currentScope = scopeOverrides.has(row.menuItem.id)
              ? scopeOverrides.get(row.menuItem.id)!
              : row.currentScope;
            const currentFlat =
              flatOverrides.get(row.menuItem.id) ?? row.currentFlatGranted;

            return (
              <div
                key={row.menuItem.id}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-2.5 dark:border-gray-800"
              >
                <div className="flex flex-col">
                  <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.menuItem.label}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {row.prefix}
                  </span>
                </div>

                {row.scoped ? (
                  <Select
                    className="w-40"
                    value={currentScope ?? ""}
                    disabled={setPermissions.isPending}
                    onChange={(e) => {
                      const value = e.target.value as Scope | "";
                      setScopeOverrides((prev) => {
                        const next = new Map(prev);
                        next.set(row.menuItem.id, value === "" ? null : value);
                        return next;
                      });
                    }}
                  >
                    <option value="">None</option>
                    {(Object.keys(row.scoped) as Scope[]).map((scope) => (
                      <option key={scope} value={scope}>
                        {SCOPE_LABEL[scope]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={currentFlat}
                      disabled={setPermissions.isPending}
                      onChange={() =>
                        setFlatOverrides((prev) => {
                          const next = new Map(prev);
                          next.set(row.menuItem.id, !currentFlat);
                          return next;
                        })
                      }
                    />
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      Granted
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setScopeOverrides(new Map());
            setFlatOverrides(new Map());
            refetch();
            onClose();
          }}
          disabled={setPermissions.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={setPermissions.isPending}
          onClick={() => void handleSave()}
        >
          Save menu access
        </Button>
      </div>
    </div>
  );
}
