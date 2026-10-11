"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { Permission, User } from "@texawave-erp/api-types";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useRoleDetails } from "../hooks";
import {
  buildAccessModel,
  levelLabel,
  levelOf,
  type Level,
} from "../utils/access-model";

const RANK: Record<Level, number> = {
  none: 0,
  own: 1,
  team: 2,
  all: 3,
  granted: 3,
};

/**
 * "Who has access": pick a user and see everything they can do — the union
 * of their ACTIVE roles, the widest scope per permission, and which role
 * grants it. Computed in the browser from the roles' permission lists (the
 * same rule the API applies: inactive roles grant nothing).
 */
export function EffectiveAccessView({
  users,
  catalog,
  usersPartial,
}: {
  users: readonly User[];
  catalog: readonly Permission[];
  usersPartial: boolean;
}) {
  const [userId, setUserId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const sections = useMemo(() => buildAccessModel(catalog), [catalog]);
  const user = users.find((u) => u.id === userId) ?? null;
  const activeRoles = useMemo(
    () => (user ? user.roles.filter((r) => r.isActive) : []),
    [user],
  );
  const details = useRoleDetails(activeRoles.map((r) => r.id));

  const loading = details.some((d) => d.isPending);
  const failed = details.find((d) => d.isError);

  const rows = useMemo(() => {
    if (loading || failed) return [];
    const grants = details.map((d) => ({
      name: d.data!.name,
      ids: new Set(d.data!.permissions.map((p) => p.id)),
    }));
    const needle = filter.trim().toLowerCase();
    return sections
      .map((s) => ({
        section: s,
        items: s.resources.flatMap((r) =>
          r.actions.flatMap((a) => {
            let best: Level = "none";
            const from: string[] = [];
            for (const g of grants) {
              const level = levelOf(a, g.ids);
              if (level === "none") continue;
              from.push(
                `${g.name} (${levelLabel(level).replace(" scope", "")})`,
              );
              if (RANK[level] > RANK[best]) best = level;
            }
            if (best === "none") return [];
            const text = `${r.label} ${a.label} ${a.description}`.toLowerCase();
            if (needle && !text.includes(needle)) return [];
            return [
              { key: a.code, resource: r.label, action: a, level: best, from },
            ];
          }),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [loading, failed, details, sections, filter]);

  const teamScoped = rows.some((g) => g.items.some((i) => i.level === "team"));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            aria-label="User"
            value={userId ?? ""}
            onChange={(e) =>
              setUserId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Choose a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} · {u.email}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Input
              type="search"
              aria-label="Filter effective permissions"
              placeholder="Filter permissions…"
              value={filter}
              disabled={!user}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        {usersPartial ? (
          <p className="mt-2 text-theme-xs text-gray-500">
            Listing the first 100 users.
          </p>
        ) : null}
      </Card>

      {!user ? (
        <Card>
          <EmptyState
            title="Choose a user"
            description="See exactly what they can do, at what scope, and which role gives it — useful for “why can this person see payroll?”."
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-col gap-2 text-theme-sm">
              <p>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {user.fullName}
                </span>{" "}
                <span className="text-gray-500">
                  {user.isActive ? "" : "(disabled — cannot sign in)"}
                </span>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Roles:{" "}
                {user.roles.length === 0
                  ? "none"
                  : user.roles
                      .map(
                        (r) =>
                          `${r.name}${r.isActive ? "" : " (inactive, grants nothing)"}`,
                      )
                      .join(", ")}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Teams (what “Team” scope covers):{" "}
                {user.teams.length === 0
                  ? "none"
                  : user.teams.map((t) => t.name).join(", ")}
              </p>
            </div>
          </Card>
          {teamScoped && user.teams.length === 0 ? (
            <Alert variant="warning" title="Team scope with no team">
              This user has Team-scoped permissions but no team, so those
              permissions show them nothing.
            </Alert>
          ) : null}
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : failed ? (
            <ErrorState onRetry={() => void failed.refetch()} />
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                title={filter ? "Nothing matches" : "No permissions"}
                description={
                  filter
                    ? "Clear the filter."
                    : "This user's active roles grant nothing."
                }
              />
            </Card>
          ) : (
            rows.map(({ section, items }) => (
              <Card key={section.key} className="overflow-hidden p-0">
                <p className="border-b border-gray-100 px-4 py-2.5 text-theme-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
                  {section.label}{" "}
                  <span className="font-normal text-gray-500">
                    · {items.length}
                  </span>
                </p>
                <table className="w-full text-left text-theme-xs">
                  <caption className="sr-only">
                    {section.label} — effective permissions
                  </caption>
                  <thead className="text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Permission
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Scope
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Granted by
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((i) => (
                      <tr key={i.key}>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                            {i.resource} · {i.action.label}
                            {i.action.sensitive ? (
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-warning-600"
                                aria-label="Sensitive"
                              />
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {levelLabel(i.level)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {i.from.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
