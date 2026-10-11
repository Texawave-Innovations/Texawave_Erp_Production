"use client";

import { useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, Users } from "lucide-react";
import type { Role } from "@texawave-erp/api-types";
import { Button, Input } from "@texawave-erp/ui-kit";
import { SYSTEM_ROLE_NAMES } from "../utils/access-model";

/** Searchable list of roles with member counts; the selected one is edited
 * on the right. Inactive roles are listed last and dimmed. */
export function RoleList({
  roles,
  selectedId,
  memberCounts,
  countsPartial,
  canWrite,
  onSelect,
  onCreate,
}: {
  roles: readonly Role[];
  selectedId: number | null;
  memberCounts: ReadonlyMap<number, number>;
  countsPartial: boolean;
  canWrite: boolean;
  onSelect: (role: Role) => void;
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
          a.name.localeCompare(b.name),
      );
  }, [roles, query]);

  return (
    <nav aria-label="Roles" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="search"
            aria-label="Search roles"
            placeholder="Search roles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            aria-label="New role"
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((role) => {
          const selected = role.id === selectedId;
          const count = memberCounts.get(role.id) ?? 0;
          return (
            <li key={role.id}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(role)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  selected
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/60"
                } ${role.isActive ? "" : "opacity-60"}`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-theme-sm font-semibold text-gray-900 dark:text-white">
                    {role.name}
                    {SYSTEM_ROLE_NAMES.has(role.name) ? (
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0 text-brand-600"
                        aria-label="System role"
                      />
                    ) : null}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {role.isActive ? "Active" : "Inactive"}
                  </span>
                </span>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title={
                    countsPartial
                      ? "Counted from the first 100 users"
                      : "Users with this role"
                  }
                >
                  <Users className="h-3 w-3" aria-hidden />
                  {count}
                  {countsPartial ? "+" : ""}
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li className="py-4 text-center text-theme-xs text-gray-500">
            No roles match.
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
