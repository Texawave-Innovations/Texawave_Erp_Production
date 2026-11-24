"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  Flag,
  FolderKanban,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ActionMenu,
  Button,
  DataTable,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SpringGlideSegmentedControl,
  TableToolbar,
  Tabs,
  useToast,
  type DataTableColumn,
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
import { ProjectBoard } from "@/features/projects/components/ProjectBoard";
import { ProjectMeter } from "@/features/projects/components/ProjectMeter";
import type { Project } from "@/features/projects/types";
import { useDebouncedValue } from "@/features/hr/employees/hooks";

// Legacy `ProjectList.tsx` status tabs + health signal chips. Status values
// follow the API enum (`on_hold`, not legacy `on-hold`).
const STATUS_TABS = [
  { id: "all", label: "All Status" },
  { id: "active", label: "Active" },
  { id: "on_hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const HEALTH_FILTERS = [
  { id: "all", label: "All Projects" },
  { id: "on-track", label: "On Track" },
  { id: "delayed", label: "Delayed Milestones" },
  { id: "upcoming", label: "Due in 7 Days" },
] as const;

const VIEW_OPTIONS = [
  { id: "table", label: "Table", icon: List },
  { id: "board", label: "Board", icon: LayoutGrid },
] as const;

/** The API caps a page at 100 rows; the board shows one such page, ungrouped by page. */
const BOARD_LIMIT = 100;

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
  const view = searchParams.get("view") === "board" ? "board" : "table";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const health = SIGNAL_TO_HEALTH[signal];
  const pageSize = view === "board" ? BOARD_LIMIT : PAGE_SIZE;
  const projectsQuery = useProjects({
    search: debouncedSearch || undefined,
    status: status || undefined,
    health,
    page: view === "board" ? 1 : page,
    limit: pageSize,
  });
  const deleteProjectMutation = useDeleteProject();

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data],
  );

  const total = projectsQuery.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = status !== "" || signal !== "" || search !== "";

  function setParams(next: {
    status?: string;
    filter?: string;
    view?: string;
  }) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.filter) params.set("filter", next.filter);
    if ((next.view ?? view) === "board") params.set("view", "board");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    setPage(1);
  }

  // Legacy: picking a status clears the health signal and vice versa.
  const handleStatusChange = (s: string) =>
    setParams({ status: s === "all" ? "" : s });
  const handleSignalChange = (sig: string) =>
    setParams({ filter: sig === "all" ? "" : sig });

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

  const columns: DataTableColumn<Project>[] = [
    {
      header: "Project",
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-theme-xs font-semibold text-brand-700 dark:text-cyan-300">
            {p.projectCode}
          </p>
          <Link
            href={`/projects/${p.id}`}
            className="block text-theme-sm font-semibold text-gray-900 hover:text-brand-700 hover:underline dark:text-white/90 dark:hover:text-cyan-300"
          >
            {p.name}
          </Link>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {p.departments && p.departments.length > 0
              ? p.departments.join(", ")
              : "General"}
          </p>
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (p) => p.customerName || p.salesCustomer?.companyName || "—",
    },
    {
      header: "Status & Health",
      cell: (p) => (
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={p.status} />
          <HealthBadge health={p.health} />
        </div>
      ),
    },
    {
      header: "Milestones",
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5 text-theme-sm text-gray-700 dark:text-gray-300">
          <Flag className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
          {p.milestones.filter((m) => m.status === "completed").length} /{" "}
          {p.milestones.length} done
        </span>
      ),
    },
    {
      header: "Hours",
      cell: (p) => {
        const expected = Number(p.expectedHours) || 0;
        const logged = p.totalLoggedHours ?? 0;
        return (
          <ProjectMeter
            label={`Hours used for ${p.name}`}
            used={`${logged}h`}
            total={`/ ${expected}h`}
            pct={percent(logged, expected)}
          />
        );
      },
    },
    {
      header: "Budget",
      cell: (p) => {
        const spent = Number(p.actualCost) || 0;
        const price = Number(p.projectPrice) || 0;
        return (
          <ProjectMeter
            label={`Budget used for ${p.name}`}
            used={formatCurrency(spent)}
            total={`/ ${formatCurrency(price)}`}
            pct={percent(spent, price)}
            className="min-w-40"
          />
        );
      },
    },
    {
      header: "Due",
      cell: (p) => formatDate(p.plannedEndDate),
    },
    {
      header: "Actions",
      align: "right",
      cell: (p) => (
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
              onClick: () => router.push(`/projects/edit/${p.id}`),
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
      ),
    },
  ];

  const emptyState = (
    <EmptyState
      title={
        hasFilters
          ? "No projects found matching filter criteria"
          : "No projects created yet"
      }
      action={
        hasFilters ? (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        ) : (
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Create First Project
            </Button>
          </Link>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="banner"
        icon={FolderKanban}
        title="All Projects"
        description="Searchable project index with milestone health, hours utilization and financial metrics."
        action={
          <Link href="/projects/new">
            <Button variant="glass">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <TableToolbar
            search={{
              value: search,
              onChange: (v) => {
                setSearch(v);
                setPage(1);
              },
              onClear: () => setSearch(""),
              placeholder: "Search by project name, code or customer...",
              ariaLabel: "Search projects",
            }}
            resultCount={projectsQuery.isSuccess ? total : undefined}
            hasActiveFilters={hasFilters}
            onClearFilters={clearFilters}
            actions={
              <SpringGlideSegmentedControl
                ariaLabel="Project view"
                options={VIEW_OPTIONS}
                value={view}
                onChange={(v) => setParams({ status, filter: signal, view: v })}
              />
            }
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Tabs<string>
              label="Filter by status"
              idPrefix="project-status"
              tabs={STATUS_TABS}
              value={status === "" ? "all" : status}
              onChange={handleStatusChange}
              panel={false}
            />
            <Tabs<string>
              label="Filter by health"
              idPrefix="project-health"
              tabs={HEALTH_FILTERS}
              value={signal === "" ? "all" : signal}
              onChange={handleSignalChange}
              panel={false}
            />
          </div>
        </div>

        {projectsQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Could not load projects"
              description={errorMessage(projectsQuery.error, "")}
              onRetry={() => projectsQuery.refetch()}
            />
          </div>
        ) : view === "board" && projectsQuery.isSuccess ? (
          projects.length === 0 ? (
            <div className="py-14">{emptyState}</div>
          ) : (
            <>
              <ProjectBoard projects={projects} />
              {total > BOARD_LIMIT ? (
                <p className="border-t border-gray-100 px-4 py-3 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Showing the first {BOARD_LIMIT} of {total} projects. Narrow
                  the filters, or switch to the table to page through all of
                  them.
                </p>
              ) : null}
            </>
          )
        ) : (
          <DataTable
            columns={columns}
            rows={projects}
            getRowKey={(p) => String(p.id)}
            caption="Projects"
            loading={projectsQuery.isPending}
            loadingRowsCount={6}
            emptyState={<div className="py-10">{emptyState}</div>}
          />
        )}

        {view === "table" && total > 0 ? (
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
