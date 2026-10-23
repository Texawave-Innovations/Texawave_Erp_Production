"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  Edit2,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useProjects, useDeleteProject } from "@/features/projects/hooks";
import {
  HealthBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function ProjectsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: projectsData, isLoading } = useProjects({
    search: search || undefined,
    status: status || undefined,
    page,
    limit,
  });

  const deleteProjectMutation = useDeleteProject();

  const projects = projectsData?.data ?? [];
  const meta = projectsData?.meta ?? { total: 0, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / limit) || 1;

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete project "${name}"?`)) {
      await deleteProjectMutation.mutateAsync(id);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <Link
          href="/projects/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-105 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </Link>
      </div>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="py-3.5 pl-6 pr-4">Project & Code</th>
                <th className="py-3.5 px-4">Status & Health</th>
                <th className="py-3.5 px-4">Timeline</th>
                <th className="py-3.5 px-4">Progress</th>
                <th className="py-3.5 px-4">Budget & Cost</th>
                <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    Loading projects...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No projects found matching the criteria.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr
                    key={p.id}
                    className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  >
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-bold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-cyan-400"
                        >
                          {p.name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400">
                            {p.projectCode}
                          </span>
                          <span>•</span>
                          <span>{p.department || "General"}</span>
                          {p.customerName && (
                            <>
                              <span>•</span>
                              <span className="text-gray-600 dark:text-gray-300">
                                {p.customerName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <StatusBadge status={p.status} />
                        <HealthBadge health={p.health} />
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>
                          {new Date(p.startDate).toLocaleDateString()}
                        </span>
                        <span>→</span>
                        <span>
                          {p.plannedEndDate
                            ? new Date(p.plannedEndDate).toLocaleDateString()
                            : "Ongoing"}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex w-32 flex-col gap-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-500">Completed</span>
                          <span className="text-gray-900 dark:text-white">
                            {p.progressPercent ?? 0}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                            style={{
                              width: `${Math.min(100, p.progressPercent ?? 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(Number(p.projectPrice))}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Spent: {formatCurrency(Number(p.actualCost))}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 pl-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          title="View Details"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/projects/edit/${p.id}`}
                          title="Edit Project"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Delete Project"
                          className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <span>
            Showing {projects.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
            {Math.min(page * limit, meta.total)} of {meta.total} projects
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 font-semibold transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 font-semibold transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
