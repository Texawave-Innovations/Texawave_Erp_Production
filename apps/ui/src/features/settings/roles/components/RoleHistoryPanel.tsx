"use client";

import { useMemo, useState } from "react";
import type { Permission, RoleHistoryEntry } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useRoleHistory } from "../hooks";
import { buildAccessModel, splitCode } from "../utils/access-model";

const ACTION_LABELS: Record<string, string> = {
  create: "Created the role",
  clone: "Created the role as a copy",
  update: "Edited the role",
  activate: "Reactivated the role",
  deactivate: "Deactivated the role",
  set_permissions: "Changed permissions",
  attach_permissions: "Added permissions",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function ids(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((v): v is number => typeof v === "number")
    : [];
}

/**
 * The role's audit trail (GET /settings/roles/:id/history): who changed what
 * and when. Grant changes are stored as permission ids; they are shown with
 * the same labels as the matrix.
 */
export function RoleHistoryPanel({
  roleId,
  catalog,
}: {
  roleId: number;
  catalog: readonly Permission[];
}) {
  const [page, setPage] = useState(1);
  const history = useRoleHistory(roleId, page);

  const labelOf = useMemo(() => {
    const byId = new Map<number, string>();
    const sections = buildAccessModel(catalog);
    for (const p of catalog) {
      const { base, scope } = splitCode(p.code);
      let label = p.code;
      for (const s of sections)
        for (const r of s.resources)
          for (const a of r.actions)
            if (a.code === base) label = `${r.label} · ${a.label}`;
      byId.set(
        p.id,
        scope
          ? `${label} (${scope[0]!.toUpperCase()}${scope.slice(1)})`
          : label,
      );
    }
    return (id: number) => byId.get(id) ?? `Permission #${id}`;
  }, [catalog]);

  if (history.isPending) return <Skeleton className="h-64 w-full" />;
  if (history.isError) {
    return history.error instanceof ApiError &&
      history.error.isPermissionError ? (
      <Alert variant="warning" title="You can't view this history">
        Role history needs the <code>settings.role.read</code> permission.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void history.refetch()} />
    );
  }
  if (history.data.data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No recorded changes yet"
          description="Changes made from now on are listed here. Older changes, made before role history existed, were not recorded."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-0">
        <ol className="divide-y divide-gray-100 dark:divide-gray-800">
          {history.data.data.map((entry: RoleHistoryEntry) => {
            const after = entry.after ?? {};
            const before = entry.before ?? {};
            const granted = ids(after.grantedPermissionIds);
            const revoked = ids(after.revokedPermissionIds);
            return (
              <li key={entry.id} className="flex flex-col gap-1.5 px-4 py-3">
                <p className="text-theme-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">
                    {entry.actorName ??
                      (entry.actorType === "system"
                        ? "System"
                        : "Unknown user")}
                  </span>{" "}
                  · {ACTION_LABELS[entry.action] ?? entry.action}
                  <span className="ml-2 text-theme-xs text-gray-500">
                    {when(entry.at)}
                  </span>
                </p>
                {entry.action === "update" &&
                before.name !== undefined &&
                before.name !== after.name ? (
                  <p className="text-theme-xs text-gray-600 dark:text-gray-400">
                    Renamed “{String(before.name)}” → “{String(after.name)}”
                  </p>
                ) : null}
                {entry.action === "clone" ? (
                  <p className="text-theme-xs text-gray-600 dark:text-gray-400">
                    Copied from “{String(after.clonedFrom ?? "")}” with{" "}
                    {String(after.permissions ?? 0)} permissions
                  </p>
                ) : null}
                {granted.length > 0 ? (
                  <p className="text-theme-xs text-success-700 dark:text-success-400">
                    Granted: {granted.map(labelOf).join(", ")}
                  </p>
                ) : null}
                {revoked.length > 0 ? (
                  <p className="text-theme-xs text-error-700 dark:text-error-400">
                    Removed: {revoked.map(labelOf).join(", ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>
      {history.data.meta.totalPages > 1 ? (
        <Pagination
          page={history.data.meta.page}
          totalPages={history.data.meta.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
