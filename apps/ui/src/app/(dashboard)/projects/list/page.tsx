"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, Flag, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ActionMenu,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useDeleteProject, useProjects } from "@/features/projects/hooks";
import {
  HealthBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";
import {
  errorMessage,
  formatCurrency,
  formatDate,
  percent,
} from "@/features/projects/format";
import type { Project } from "@/features/projects/types";
import { useDebouncedValue } from "@/features/hr/employees/hooks";

// Legacy `ProjectList.tsx` status tabs + health signal chips. Status values
// follow the API enum (`on_hold`, not legacy `on-hold`).
const STATUS_TABS = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const HEALTH_FILTERS = [
  { value: "", label: "All Projects" },
  { value: "on-track", label: "✓ On Track" },
  { value: "delayed", label: "⚠ Delayed Milestones" },
  { value: "upcoming", label: "⏳ Due in 7 Days" },
] as const;

const PAGE_SIZE = 10;

/** URL signal (`?filter=`) -> API `health` query value. The API computes
 * health over ALL projects and paginates the matches, so these filters are
 * no longer limited to the first 100 rows. */
const SIGNAL_TO_HEALTH: Record<string, string> = {
  "on-track": "on_track",
  delayed: "delayed",
  upcoming: "upcoming",
};

export default function ProjectsListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // URL is the source of truth so dashboard links (?status= / ?filter=)
  // apply even when this page is already mounted.
  const status = searchParams.get("status") ?? "";
  const signal = searchParams.get("filter") ?? "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const health = SIGNAL_TO_HEALTH[signal];
  const projectsQuery = useProjects({
    search: debouncedSearch || undefined,
    status: status || undefined,
    health,
    page,
    limit: PAGE_SIZE,
  });
  const deleteProjectMutation = useDeleteProject();

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data],
  );

  const total = projectsQuery.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = status !== "" || signal !== "" || search !== "";

  function setParams(next: { status?: string; filter?: string }) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.filter) params.set("filter", next.filter);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    setPage(1);
  }

  // Legacy: picking a status clears the health signal and vice versa.
  const handleStatusChange = (s: string) => setParams({ status: s });
  const handleSignalChange = (sig: string) => setParams({ filter: sig });

  function clearFilters() {
    setSearch("");
    setParams({});
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProjectMutation.mutateAsync(pendingDelete.id);
      toast({ title: "Project deleted", variant: "success" });
      setPendingDelete(null);
    } catch (err) {
      toast({
        title: "Failed to delete project",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header banner (legacy "All Projects Directory") */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-500/15 sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="rounded-2xl border border-white/15 bg-white/10 p-2.5 text-cyan-100 backdrop-blur-md">
              <FolderKanban className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight">
              All Projects Directory
            </h1>
          </div>
          <p className="pl-1 text-xs text-cyan-50/90 sm:text-sm">
            Searchable project index with milestone health progress, hours
            utilization &amp; financial metrics
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex shrink-0 items-center gap-1.5 self-start rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-blue-800 shadow-md transition-colors hover:bg-cyan-50 sm:self-auto"
        >
          <Plus className="h-4 w-4" /> New Project
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {/* Search + status tabs */}
        <div className="flex flex-col gap-4 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <SearchInput
              className="w-full md:max-w-md"
              placeholder="Search by project name, code or customer..."
              value={search}
              onChangeValue={(v) => {
                setSearch(v);
                setPage(1);
              }}
              onClear={() => setSearch("")}
              aria-label="Search projects"
            />
            <div
              role="tablist"
              aria-label="Filter by status"
              className="flex w-full items-center gap-1.5 overflow-x-auto pb-1 md:w-auto md:pb-0"
            >
              {STATUS_TABS.map((s) => {
                const active = status === s.value && signal === "";
                return (
                  <button
                    key={s.value || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleStatusChange(s.value)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Health signal chips (from dashboard clickable cards) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] font-black uppercase text-gray-400">
              Health Filters:
            </span>
            {HEALTH_FILTERS.map((f) => {
              const active = signal === f.value;
              return (
                <button
                  key={f.value || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSignalChange(f.value)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? "border border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {projectsQuery.isPending ? (
          <TableSkeleton rowsCount={6} columnsCount={7} className="m-4" />
        ) : projectsQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Could not load projects"
              description={errorMessage(projectsQuery.error, "")}
              onRetry={() => projectsQuery.refetch()}
            />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-14">
            <EmptyState
              title={
                hasFilters
                  ? "No projects found matching filter criteria"
                  : "No projects created yet"
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md"
                  >
                    <Plus className="h-4 w-4" /> Create First Project
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-xs font-black uppercase tracking-wider text-white">
                <tr>
                  <th className="rounded-l-xl px-4 py-3.5 text-center">
                    Code / Project
                  </th>
                  <th className="px-4 py-3.5 text-center">Customer</th>
                  <th className="px-4 py-3.5 text-center">
                    Status &amp; Health
                  </th>
                  <th className="px-4 py-3.5 text-center">Milestones</th>
                  <th className="px-4 py-3.5 text-center">Hours Utilization</th>
                  <th className="px-4 py-3.5 text-center">
                    Budget Utilization
                  </th>
                  <th className="rounded-r-xl px-4 py-3.5 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projects.map((p) => {
                  const milestonesDone = p.milestones.filter(
                    (m) => m.status === "completed",
                  ).length;
                  const logged = p.totalLoggedHours ?? 0;
                  const expected = Number(p.expectedHours) || 0;
                  const hPct = percent(logged, expected);
                  const spent = Number(p.actualCost) || 0;
                  const price = Number(p.projectPrice) || 0;
                  const bPct = percent(spent, price);
                  return (
                    <tr
                      key={p.id}
                      className="group transition-colors hover:bg-sky-50/40 dark:hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-4 text-center">
                        <span className="mx-auto block w-fit rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                          {p.projectCode}
                        </span>
                        <Link
                          href={`/projects/${p.id}`}
                          className="mx-auto mt-1 block text-center text-sm font-bold text-gray-900 hover:underline group-hover:text-brand-700 dark:text-white dark:group-hover:text-cyan-300"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-[10px] text-gray-400">
                          {p.departments && p.departments.length > 0
                            ? p.departments.join(", ")
                            : "General"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-gray-700 dark:text-gray-300">
                        {p.customerName || p.customer?.name || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <StatusBadge status={p.status} />
                          <HealthBadge health={p.health} />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          <Flag className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
                          {milestonesDone} / {p.milestones.length} Done
                        </span>
                      </td>
                      <td className="min-w-[150px] px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-brand-700 dark:text-cyan-300">
                              {logged}h
                            </span>
                            <span className="text-gray-400">
                              / {expected}h ({hPct}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full ${hPct > 90 ? "bg-rose-500" : "bg-gradient-to-r from-blue-600 to-cyan-500"}`}
                              style={{ width: `${hPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="min-w-[170px] px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex justify-between gap-2 text-[11px] font-bold">
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(spent)}
                            </span>
                            <span className="text-gray-400">
                              / {formatCurrency(price)} ({bPct}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full ${bPct > 90 ? "bg-rose-500" : "bg-emerald-600"}`}
                              style={{ width: `${bPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ActionMenu
                          ariaLabel={`Actions for ${p.name}`}
                          triggerIcon="horizontal"
                          items={[
                            {
                              label: "View Tracker Details",
                              icon: <Eye className="h-4 w-4" />,
                              onClick: () => router.push(`/projects/${p.id}`),
                            },
                            {
                              label: "Edit Project",
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () =>
                                router.push(`/projects/edit/${p.id}`),
                            },
                            {
                              label: "Delete Project",
                              icon: <Trash2 className="h-4 w-4" />,
                              variant: "destructive",
                              separator: true,
                              onClick: () => setPendingDelete(p),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 ? (
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
      </div>

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete project"
        itemName={pendingDelete?.name ?? ""}
        description="This cannot be undone."
        loading={deleteProjectMutation.isPending}
      />
    </div>
  );
}
