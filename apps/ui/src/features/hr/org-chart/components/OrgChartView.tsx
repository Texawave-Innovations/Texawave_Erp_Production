"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
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

export function OrgChartView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);

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

  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Org chart
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Reporting structure for the employees visible to you.
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-xl">
          <Input
            type="search"
            placeholder="Search by name, code or designation"
            aria-label="Search org chart"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
      </Card>

      <Card>
        {chart.isPending ? (
          <div className="flex gap-6 p-4">
            <Skeleton className="h-32 w-36" />
            <Skeleton className="h-32 w-36" />
            <Skeleton className="h-32 w-36" />
          </div>
        ) : chart.isError ? (
          chart.error instanceof ApiError && chart.error.isPermissionError ? (
            <Alert
              variant="warning"
              title="You don't have access to this part of the org chart"
            >
              Some employees are outside the scope your role can view.
            </Alert>
          ) : (
            <ErrorState onRetry={() => chart.refetch()} />
          )
        ) : !chart.data || chart.data.length === 0 ? (
          <EmptyState
            title="No employees found"
            description={
              departmentId
                ? "No employees in this department yet."
                : "There are no employees to show in the org chart yet."
            }
          />
        ) : (
          <div className="overflow-x-auto p-4">
            <OrgTree
              nodes={chart.data}
              matchedIds={matchedIds}
              collapsedIds={effectiveCollapsedIds}
              onToggleCollapse={toggleCollapse}
              onSelect={setSelectedNode}
            />
          </div>
        )}
      </Card>

      <EmployeeDetailDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
