"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Search,
  Shield,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import type { Permission, User } from "@texawave-erp/api-types";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { useEffectivePermissions } from "../hooks";
import {
  buildAccessModel,
  levelLabel,
  levelOf,
  SCOPES,
  type Level,
} from "../utils/access-model";

/**
 * Render scope badge with consistent width and semantic colors
 */
function ScopeBadge({ level }: { level: Level }) {
  switch (level) {
    case "all":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30">
          All
        </span>
      );
    case "team":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-500/30">
          Team
        </span>
      );
    case "own":
      return (
        <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-inset ring-cyan-600/20 dark:bg-cyan-950/40 dark:text-cyan-400 dark:ring-cyan-500/30">
          Own
        </span>
      );
    case "granted":
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
          Granted
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-400/20">
          {levelLabel(level)}
        </span>
      );
  }
}

/**
 * "Who has access": pick a user and see everything they can do, at what
 * scope, and which role grants it — from GET /users/:id/effective-permissions
 * (the server applies the same rule as at request time: only active roles
 * and active grants count).
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
  const effective = useEffectivePermissions(userId);

  const groups = useMemo(() => {
    if (!effective.data) return [];
    const granted = new Set(effective.data.permissions.map((p) => p.id));
    const sourcesById = new Map(
      effective.data.permissions.map((p) => [p.id, p.grantedBy]),
    );
    const needle = filter.trim().toLowerCase();

    return sections
      .map((s) => ({
        section: s,
        items: s.resources.flatMap((r) =>
          r.actions.flatMap((a) => {
            const level = levelOf(a, granted);
            if (level === "none") return [];
            const text =
              `${r.label} ${a.label} ${a.description} ${a.code}`.toLowerCase();
            if (needle && !text.includes(needle)) return [];
            // Sources per granted variant, e.g. "HR Manager (All)".
            const variants =
              a.kind === "flat"
                ? [{ id: a.id, tag: "" }]
                : SCOPES.map((sc) => ({
                    id: a.ids[sc],
                    tag: ` (${sc[0]!.toUpperCase()}${sc.slice(1)})`,
                  }));
            const from = variants.flatMap((v) =>
              v.id !== undefined && v.id !== null && granted.has(v.id)
                ? (sourcesById.get(v.id) ?? []).map(
                    (g) => `${g.roleName}${v.tag}`,
                  )
                : [],
            );
            return [{ key: a.code, resource: r.label, action: a, level, from }];
          }),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [effective.data, sections, filter]);

  const data = effective.data;

  const totalEffectiveCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups],
  );

  const teamScoped = useMemo(
    () => groups.some((g) => g.items.some((i) => i.level === "team")),
    [groups],
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.id === userId) ?? null,
    [users, userId],
  );

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Search and User Selection Toolbar */}
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="user-select" className="sr-only">
              Choose a user
            </label>
            <Select
              id="user-select"
              aria-label="User"
              value={userId ?? ""}
              onChange={(e) =>
                setUserId(e.target.value ? Number(e.target.value) : null)
              }
              className="h-10 text-theme-sm"
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} · {u.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative">
            <Input
              type="search"
              aria-label="Filter effective permissions"
              placeholder="Filter permissions by name, module, or code…"
              value={filter}
              disabled={userId === null}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 pl-9 pr-8 text-theme-sm"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label="Clear filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {usersPartial ? (
          <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            Listing the first 100 users.
          </p>
        ) : null}
      </Card>

      {userId === null ? (
        <Card>
          <EmptyState
            title="Choose a user"
            description="See exactly what they can do, at what scope, and which role gives it — useful for “why can this person see payroll?”."
          />
        </Card>
      ) : effective.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : effective.isError || !data ? (
        <ErrorState onRetry={() => void effective.refetch()} />
      ) : (
        <>
          {/* User Summary Card */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 text-theme-sm dark:bg-brand-900/60 dark:text-brand-300">
                    {data.user.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || <UserIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white">
                        {data.user.fullName}
                      </h3>
                      <StatusBadge
                        label={data.user.isActive ? "Active" : "Disabled"}
                        colorToken={data.user.isActive ? "success" : "gray"}
                      />
                    </div>
                    {selectedUser?.email ? (
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {selectedUser.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {totalEffectiveCount} effective permission
                    {totalEffectiveCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Roles and Teams Meta Chips */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-theme-xs">
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-gray-500 dark:text-gray-400">
                    <Shield className="h-3.5 w-3.5" />
                    Assigned Roles ({data.roles.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.roles.length === 0 ? (
                      <span className="italic text-gray-400">
                        No roles assigned
                      </span>
                    ) : (
                      data.roles.map((r) => (
                        <span
                          key={r.id}
                          className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ring-1 ring-inset ${
                            r.isActive
                              ? "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-500/30"
                              : "bg-gray-50 text-gray-400 line-through ring-gray-400/20 dark:bg-gray-800"
                          }`}
                          title={
                            r.isActive
                              ? "Active role"
                              : "Inactive role (grants nothing)"
                          }
                        >
                          {r.name}
                          {!r.isActive && (
                            <span className="ml-1 text-[10px] no-underline">
                              (inactive)
                            </span>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-gray-500 dark:text-gray-400">
                    <Users className="h-3.5 w-3.5" />
                    Assigned Teams / Team Scope ({data.teams.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.teams.length === 0 ? (
                      <span className="italic text-gray-400">
                        No teams assigned
                      </span>
                    ) : (
                      data.teams.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-500/30"
                        >
                          {t.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {teamScoped && data.teams.length === 0 ? (
            <Alert variant="warning" title="Team scope with no team">
              This user has Team-scoped permissions but no team, so those
              permissions show them nothing.
            </Alert>
          ) : null}

          {/* Grouped Permission Tables */}
          {groups.length === 0 ? (
            <Card>
              <EmptyState
                title={filter ? "No matching permissions" : "No permissions"}
                description={
                  filter
                    ? `No permissions match "${filter}". Try adjusting your search query.`
                    : "This user's active roles grant nothing."
                }
              />
            </Card>
          ) : (
            groups.map(({ section, items }) => (
              <Card
                key={section.key}
                className="overflow-hidden border border-gray-200/80 p-0 shadow-theme-xs dark:border-gray-800"
              >
                {/* Unified Section Header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center gap-2">
                    <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {section.label}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {items.length}
                    </span>
                  </div>
                  {section.description ? (
                    <span className="hidden text-theme-xs text-gray-500 sm:inline dark:text-gray-400">
                      {section.description}
                    </span>
                  ) : null}
                </div>

                {/* Unified Fixed-Width 3-Column Table */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed text-left text-theme-xs">
                    <caption className="sr-only">
                      {section.label} — effective permissions
                    </caption>
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/30 text-gray-500 dark:border-gray-800 dark:bg-gray-800/20 dark:text-gray-400">
                        <th
                          scope="col"
                          className="w-[44%] px-4 py-2 font-medium"
                        >
                          Permission
                        </th>
                        <th
                          scope="col"
                          className="w-[18%] px-4 py-2 font-medium"
                        >
                          Scope
                        </th>
                        <th
                          scope="col"
                          className="w-[38%] px-4 py-2 font-medium"
                        >
                          Granted by
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                      {items.map((i) => (
                        <tr
                          key={`${section.key}-${i.key}`}
                          className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                        >
                          {/* Col 1: Permission */}
                          <td className="px-4 py-2.5 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="break-words font-medium text-gray-800 dark:text-gray-200">
                                <span className="font-normal text-gray-500 dark:text-gray-400">
                                  {i.resource} ·{" "}
                                </span>
                                {i.action.label}
                              </span>
                              {i.action.sensitive ? (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30"
                                  title="Sensitive high-impact permission"
                                >
                                  <AlertTriangle
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  Sensitive
                                </span>
                              ) : null}
                            </div>
                            {i.action.description ? (
                              <p className="mt-0.5 break-words text-[11px] text-gray-500 dark:text-gray-400">
                                {i.action.description}
                              </p>
                            ) : null}
                          </td>

                          {/* Col 2: Scope */}
                          <td className="whitespace-nowrap px-4 py-2.5 align-top">
                            <ScopeBadge level={i.level} />
                          </td>

                          {/* Col 3: Granted by */}
                          <td className="px-4 py-2.5 align-top">
                            {i.from.length === 0 ? (
                              <span className="italic text-gray-400">
                                Direct grant
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {i.from.map((source, sIdx) => (
                                  <span
                                    key={`${i.key}-${source}-${sIdx}`}
                                    className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-700"
                                  >
                                    {source}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
