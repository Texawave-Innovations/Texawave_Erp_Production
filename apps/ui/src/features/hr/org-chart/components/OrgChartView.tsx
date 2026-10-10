"use client";

import { useMemo, useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Minus,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useDepartments } from "@/features/departments/hooks";
import { usePermission } from "@/hooks/usePermission";
import { useOrgChart } from "../hooks";
import { READ_ANY_SCOPE } from "../permissions";
import type { OrgChartNode } from "../types";
import { EmployeeDetailDrawer } from "./EmployeeDetailDrawer";
import { OrgTree } from "./OrgTree";

function collectMatches(
  nodes: OrgChartNode[],
  query: string,
  into: Set<number>,
): void {
  const q = query.trim().toLowerCase();
  if (!q) return;
  for (const node of nodes) {
    if (
      node.fullName.toLowerCase().includes(q) ||
      node.employeeCode.toLowerCase().includes(q) ||
      node.designation.name.toLowerCase().includes(q)
    ) {
      into.add(node.id);
    }
    collectMatches(node.children, query, into);
  }
}

/** Every node whose subtree contains a match — expanded automatically so a
 * search result is never hidden behind a collapsed branch. */
function collectAncestorsOfMatches(
  nodes: OrgChartNode[],
  matchedIds: Set<number>,
  into: Set<number>,
): boolean {
  let anyMatch = false;
  for (const node of nodes) {
    const childHasMatch = collectAncestorsOfMatches(
      node.children,
      matchedIds,
      into,
    );
    if (matchedIds.has(node.id) || childHasMatch) {
      into.add(node.id);
      anyMatch = true;
    }
  }
  return anyMatch;
}

function collectParentIds(nodes: OrgChartNode[], into: Set<number>): void {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      into.add(node.id);
      collectParentIds(node.children, into);
    }
  }
}

function countTotalNodes(nodes: OrgChartNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countTotalNodes(node.children);
  }
  return count;
}

export function OrgChartView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  const departments = useDepartments({ page: 1, limit: 100 });
  const chart = useOrgChart(
    departmentId ? { departmentId: Number(departmentId) } : {},
  );

  const matchedIds = useMemo(() => {
    const ids = new Set<number>();
    if (chart.data) collectMatches(chart.data, search, ids);
    return ids;
  }, [chart.data, search]);

  const expandedByMatch = useMemo(() => {
    const ids = new Set<number>();
    if (chart.data && search.trim()) {
      collectAncestorsOfMatches(chart.data, matchedIds, ids);
    }
    return ids;
  }, [chart.data, matchedIds, search]);

  const totalMembers = useMemo(() => {
    return chart.data ? countTotalNodes(chart.data) : 0;
  }, [chart.data]);

  const allParentIds = useMemo(() => {
    const ids = new Set<number>();
    if (chart.data) collectParentIds(chart.data, ids);
    return ids;
  }, [chart.data]);

  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedIds(new Set(allParentIds));
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(1.5, Math.round((z + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to the org chart">
        Ask an administrator for the <code>hr.employee.read</code> permission.
      </Alert>
    );
  }

  const effectiveCollapsedIds = search.trim()
    ? new Set([...collapsedIds].filter((id) => !expandedByMatch.has(id)))
    : collapsedIds;

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-2xl">
              Org chart
            </h1>
            {totalMembers > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                <Users className="h-3 w-3" />
                {totalMembers} {totalMembers === 1 ? "member" : "members"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
            Reporting structure for the employees visible to you.
          </p>
        </div>
      </div>

      {/* Interactive Control Toolbar */}
      <Card className="border-neutral-200/80 bg-white p-3.5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search & Department Filters */}
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                id="org-search"
                type="search"
                placeholder="Search by name, code or designation..."
                aria-label="Search org chart"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-8 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:border-brand-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Department Filter Select */}
            <div className="w-full sm:w-56">
              <Select
                aria-label="Filter by department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {(departments.data?.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Search Matches Count Indicator */}
            {search.trim() ? (
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                {matchedIds.size}{" "}
                {matchedIds.size === 1 ? "match found" : "matches found"}
              </span>
            ) : null}
          </div>

          {/* Zoom & Hierarchy Expansion Controls */}
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800 lg:border-t-0 lg:pt-0">
            {/* Zoom Controls */}
            <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50/60 p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.6}
                aria-label="Zoom out"
                className="rounded-md p-1.5 text-neutral-600 hover:bg-white hover:shadow-xs disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 1.5}
                aria-label="Zoom in"
                className="rounded-md p-1.5 text-neutral-600 hover:bg-white hover:shadow-xs disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expand / Collapse All */}
            <div className="inline-flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExpandAll}
                title="Expand all branches"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                Expand all
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCollapseAll}
                title="Collapse all branches"
              >
                <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
                Collapse
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Hierarchy Canvas Card */}
      <Card className="relative overflow-hidden border-neutral-200/80 bg-neutral-50/30 p-0 shadow-xs dark:border-neutral-800 dark:bg-neutral-950/30">
        {chart.isPending ? (
          <div className="flex flex-col items-center justify-center p-16 animate-pulse">
            <Skeleton className="h-28 w-60 rounded-xl mb-6" />
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mb-6" />
            <div className="flex gap-8">
              <Skeleton className="h-28 w-60 rounded-xl" />
              <Skeleton className="h-28 w-60 rounded-xl" />
              <Skeleton className="h-28 w-60 rounded-xl" />
            </div>
          </div>
        ) : chart.isError ? (
          chart.error instanceof ApiError && chart.error.isPermissionError ? (
            <div className="p-8">
              <Alert
                variant="warning"
                title="You don't have access to this part of the org chart"
              >
                Some employees are outside the scope your role can view.
              </Alert>
            </div>
          ) : (
            <div className="p-8">
              <ErrorState onRetry={() => chart.refetch()} />
            </div>
          )
        ) : !chart.data || chart.data.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No employees found"
              description={
                departmentId
                  ? "No employees found in this department."
                  : search
                    ? "No employees match your search query."
                    : "There are no employees to show in the org chart yet."
              }
              action={
                search || departmentId ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setDepartmentId("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          /* Scrollable Canvas Area with Subtle Dot Grid */
          <div className="min-h-140 max-h-195 w-full overflow-auto p-8 sm:p-12 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] bg-size-[20px_20px]">
            <div
              className="inline-block min-w-full text-center transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            >
              <OrgTree
                nodes={chart.data}
                matchedIds={matchedIds}
                selectedId={selectedNode?.id}
                collapsedIds={effectiveCollapsedIds}
                onToggleCollapse={toggleCollapse}
                onSelect={setSelectedNode}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Right-Side Slideout Employee Detail Drawer */}
      <EmployeeDetailDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
