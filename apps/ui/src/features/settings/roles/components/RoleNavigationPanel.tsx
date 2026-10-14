"use client";

import { useMemo } from "react";
import type { MenuItem } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Alert, Card, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useMenuItemsForRoles } from "../hooks";
import {
  levelOf,
  splitCode,
  withLevel,
  type AccessAction,
  type AccessSection,
  type Level,
} from "../utils/access-model";
import { ScopeControl } from "./ScopeControl";

interface NavRow {
  item: MenuItem;
  depth: number;
  action: AccessAction | null;
}

/**
 * Which navigation tabs this role sees. A tab shows when the role holds its
 * gating permission at any scope, so this panel edits the SAME draft as the
 * permission matrix: turning a tab on grants its permission, and the matrix
 * shows it immediately (and vice versa). Ungated tabs are always visible.
 */
export function RoleNavigationPanel({
  sections,
  draft,
  onChange,
  readOnly,
}: {
  sections: readonly AccessSection[];
  draft: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  readOnly: boolean;
}) {
  const menu = useMenuItemsForRoles();

  const rows = useMemo<NavRow[]>(() => {
    if (!menu.data) return [];
    const byCode = new Map<string, AccessAction>();
    for (const s of sections)
      for (const r of s.resources)
        for (const a of r.actions) byCode.set(a.code, a);
    const items = menu.data.filter((m) => m.isActive);
    const children = new Map<number | null, MenuItem[]>();
    for (const m of items) {
      const list = children.get(m.parentId) ?? [];
      list.push(m);
      children.set(m.parentId, list);
    }
    const out: NavRow[] = [];
    const walk = (parent: number | null, depth: number) => {
      for (const m of (children.get(parent) ?? []).sort(
        (a, b) => a.order - b.order,
      )) {
        out.push({
          item: m,
          depth,
          action: m.permission
            ? (byCode.get(splitCode(m.permission).base) ?? null)
            : null,
        });
        walk(m.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [menu.data, sections]);

  if (menu.isPending) return <Skeleton className="h-72 w-full" />;
  if (menu.isError) {
    return menu.error instanceof ApiError && menu.error.isPermissionError ? (
      <Alert variant="warning" title="You can't view navigation items">
        Navigation access needs the <code>menu.item.read</code> permission.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void menu.refetch()} />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">
          Navigation visibility
        </p>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          A tab appears in the sidebar when the role holds the permission behind
          it. Changing a tab here changes that permission in the matrix too.
        </p>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(({ item, depth, action }) => {
          const level: Level | null = action ? levelOf(action, draft) : null;
          const visible =
            action === null ? item.permission === null : level !== "none";
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              style={{ paddingLeft: `${16 + depth * 20}px` }}
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className={`text-theme-sm ${depth === 0 ? "font-semibold" : ""} text-gray-800 dark:text-gray-200`}
                >
                  {item.label}
                </span>
                <span className="truncate font-mono text-[11px] text-gray-400">
                  {item.path ?? "group"}
                  {item.permission
                    ? ` · ${splitCode(item.permission).base}`
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-theme-xs font-medium ${visible ? "text-success-700 dark:text-success-400" : "text-gray-400"}`}
                >
                  {item.permission === null
                    ? "Always visible"
                    : visible
                      ? "Visible"
                      : "Hidden"}
                </span>
                {action ? (
                  <ScopeControl
                    action={action}
                    level={level ?? "none"}
                    disabled={readOnly}
                    labelPrefix={`Menu ${item.label}`}
                    onChange={(next) =>
                      onChange(withLevel(action, draft, next))
                    }
                  />
                ) : item.permission ? (
                  <span
                    className="text-theme-xs text-warning-700"
                    title="This tab names a permission that is not in the catalog"
                  >
                    Unknown permission
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
