"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, Shield, ShieldCheck, Users } from "lucide-react";
import type { RoleListItem } from "@texawave-erp/api-types";
import { Button, Input, StatusBadge, cn } from "@texawave-erp/ui-kit";

/**
 * Compact horizontal role selector displaying all system and custom roles
 * with status, permission count, and member count.
 */
export function RoleList({
  roles,
  selectedId,
  canWrite,
  onSelect,
  onCreate,
}: {
  roles: readonly RoleListItem[];
  selectedId: number | null;
  canWrite: boolean;
  onSelect: (role: RoleListItem) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...roles]
      .filter((r) => needle === "" || r.name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          Number(b.isSystem) - Number(a.isSystem) ||
          a.name.localeCompare(b.name),
      );
  }, [roles, query]);

  return (
    <nav aria-label="Role selector" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Select Role ({roles.length})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {roles.length > 4 ? (
            <div className="relative w-44 sm:w-52">
              <Input
                type="search"
                aria-label="Filter roles"
                placeholder="Filter roles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-theme-xs"
              />
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>
          ) : null}

          {canWrite ? (
            <Button
              type="button"
              size="sm"
              onClick={onCreate}
              className="h-8 gap-1.5 px-3 text-theme-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New role</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((role) => {
          const isSelected = role.id === selectedId;
          return (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelect(role)}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                isSelected
                  ? "border-brand-500 bg-linear-to-b from-brand-50/70 to-brand-50/30 ring-2 ring-brand-500/20 shadow-theme-xs dark:from-brand-950/40 dark:to-brand-950/10 dark:border-brand-500"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/60",
                !role.isActive && "opacity-60 border-dashed",
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {role.name}
                    </span>
                    {role.isSystem ? (
                      <span
                        className="inline-flex shrink-0 text-brand-600 dark:text-brand-400"
                        title="System role"
                      >
                        <ShieldCheck
                          className="h-3.5 w-3.5"
                          aria-label="System role"
                        />
                      </span>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={role.isActive ? "Active" : "Inactive"}
                    colorToken={role.isActive ? "success" : "gray"}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-theme-xs text-gray-500 dark:border-gray-800/60 dark:text-gray-400">
                <span className="flex items-center gap-1 font-medium">
                  <Shield className="h-3 w-3 text-gray-400" />
                  {role.permissionCount} perms
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title="Users assigned to this role"
                >
                  <Users className="h-3 w-3" aria-hidden />
                  {role.userCount} {role.userCount === 1 ? "user" : "users"}
                </span>
              </div>

              {isSelected ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white shadow-xs">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-theme-xs text-gray-500 dark:border-gray-800">
          No roles match &quot;{query}&quot;.
        </div>
      ) : null}
    </nav>
  );
}
