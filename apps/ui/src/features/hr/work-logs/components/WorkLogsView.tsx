"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useWorkLogApprovals, useWorkLogs } from "../hooks";
import { APPROVE, READ_ANY_SCOPE, SELF_SERVICE_READ } from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  WORK_LOG_STATUSES,
  type WorkLogItem,
  type WorkLogStatus,
} from "../types";
import { DecideWorkLogDialog } from "./DecideWorkLogDialog";
import { WorkLogStatusBadge } from "./WorkLogStatusBadge";

const PAGE_SIZE = 20;

interface Filters {
  status: "" | WorkLogStatus;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { status: "", from: "", to: "" };

type Tab = "scope" | "approvals";

type Decision = { workLog: WorkLogItem; decision: "approve" | "reject" } | null;

/**
 * HR Work Logs: the caller's own/team/all scope (read-only here — decisions
 * are always made against the direct-reports queue) and an Approvals tab for
 * logs awaiting the caller's decision.
 */
export function WorkLogsView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canApprove = usePermission(APPROVE);
  const canSelfService = usePermission(SELF_SERVICE_READ);
  const [tab, setTab] = useState<Tab>(canApprove ? "approvals" : "scope");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [decision, setDecision] = useState<Decision>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };

  const scopeList = useWorkLogs(query);
  const approvalsList = useWorkLogApprovals(query);
  const list = tab === "approvals" ? approvalsList : scopeList;

  const hasFilters =
    filters.status !== "" || filters.from !== "" || filters.to !== "";

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABELS[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    if (filters.from && filters.to) {
      chips.push({
        id: "dateRange",
        label: "Date Range",
        value: `${filters.from} to ${filters.to}`,
        onRemove: () => {
          setFilters((f) => ({ ...f, from: "", to: "" }));
          setPage(1);
        },
      });
    } else if (filters.from) {
      chips.push({
        id: "from",
        label: "From",
        value: filters.from,
        onRemove: () => update("from", ""),
      });
    } else if (filters.to) {
      chips.push({
        id: "to",
        label: "To",
        value: filters.to,
        onRemove: () => update("to", ""),
      });
    }
    return chips;
  }, [filters]);

  if (!canRead && !canApprove) {
    return (
      <Alert variant="warning" title="You don't have access to work logs">
        Ask an administrator for the <code>hr.work_log.read</code> permission.
      </Alert>
    );
  }

  const isApprovalsTab = tab === "approvals";

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Work Logs
          </h1>
          {list.data ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-semibold border ${
                isApprovalsTab
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                  : "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800"
              }`}
            >
              {list.data.meta.total}{" "}
              {isApprovalsTab ? "pending approvals" : "work logs"}
            </span>
          ) : null}
        </div>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {isApprovalsTab
            ? "Review and approve employee work logs."
            : "View organization and team work log records."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/50 p-1 dark:border-gray-800 dark:bg-gray-900/50">
            <Button
              variant={isApprovalsTab ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                setTab("approvals");
                setPage(1);
              }}
              className="text-theme-xs font-medium"
            >
              Approvals
            </Button>
            {canRead ? (
              <Button
                variant={tab === "scope" ? "primary" : "ghost"}
                size="sm"
                onClick={() => {
                  setTab("scope");
                  setPage(1);
                }}
                className="text-theme-xs font-medium"
              >
                All work logs
              </Button>
            ) : null}
          </div>
        ) : null}
        {canSelfService ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/portal/work-logs")}
            className="text-theme-xs"
          >
            My work logs
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Filter toolbar */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-center">
            <Select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                update("status", e.target.value as "" | WorkLogStatus)
              }
            >
              <option value="">All statuses</option>
              {WORK_LOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>

            <div className="xl:col-span-2">
              <DateRangePicker
                value={{ from: filters.from, to: filters.to }}
                onChange={(r) => {
                  setFilters((f) => ({ ...f, from: r.from, to: r.to }));
                  setPage(1);
                }}
                onClear={() => {
                  setFilters((f) => ({ ...f, from: "", to: "" }));
                  setPage(1);
                }}
                fromAriaLabel="Logged on or after"
                toAriaLabel="Logged on or before"
              />
            </div>

            {hasFilters ? (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                  className="text-theme-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset filters
                </Button>
              </div>
            ) : null}
          </div>

          {activeChips.length > 0 ? (
            <FilterChips
              chips={activeChips}
              onClearAll={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          ) : null}
        </div>
      </Card>

      {/* Table states */}
      {list.isPending ? (
        <TableSkeleton
          rowsCount={6}
          columnsCount={canApprove && isApprovalsTab ? 7 : 6}
        />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to work logs">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No work logs match these filters"
                : isApprovalsTab
                  ? "Nothing to approve"
                  : "No work logs yet"
            }
            description={
              hasFilters
                ? "Try a different status or date range, or clear the filters."
                : isApprovalsTab
                  ? "Work logs from your direct reports awaiting a decision will appear here."
                  : "Work logs you are allowed to see will appear here."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Work logs"
            rows={list.data.data}
            getRowKey={(w) => String(w.id)}
            columns={[
              {
                header: "Employee",
                cell: (w) => (
                  <EmployeeIdentity
                    name={w.employee.fullName}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Date",
                cell: (w) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {w.workDate}
                  </span>
                ),
              },
              {
                header: "Hours",
                cell: (w) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-theme-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-mono">
                    {w.hoursWorked} hrs
                  </span>
                ),
              },
              {
                header: "Task",
                cell: (w) => (
                  <span
                    title={w.taskDescription}
                    className="block max-w-sm truncate text-theme-xs text-gray-600 dark:text-gray-300"
                  >
                    {w.taskDescription}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (w) => <WorkLogStatusBadge status={w.status} />,
              },
              {
                header: "Decided by",
                cell: (w) => (
                  <div className="flex flex-col">
                    <span className="text-theme-xs text-gray-800 dark:text-gray-200 font-medium">
                      {w.decidedBy?.fullName ?? "—"}
                    </span>
                    {w.decisionNote ? (
                      <span
                        title={w.decisionNote}
                        className="text-[11px] text-gray-400 truncate max-w-40 italic"
                      >
                        &ldquo;{w.decisionNote}&rdquo;
                      </span>
                    ) : null}
                  </div>
                ),
              },
              ...(canApprove && isApprovalsTab
                ? [
                    {
                      header: "Actions",
                      cell: (w: WorkLogItem) =>
                        w.status === "PENDING" ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({ workLog: w, decision: "approve" })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({ workLog: w, decision: "reject" })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-theme-xs text-gray-400">—</span>
                        ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {decision ? (
        <DecideWorkLogDialog
          open
          onClose={() => setDecision(null)}
          workLog={decision.workLog}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}
