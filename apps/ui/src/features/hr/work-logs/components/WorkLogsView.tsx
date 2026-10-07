"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
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
 * logs awaiting the caller's decision. Filtering, sorting and paging happen
 * server-side; this view only builds the query.
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

  if (!canRead && !canApprove) {
    return (
      <Alert variant="warning" title="You don't have access to work logs">
        Ask an administrator for the <code>hr.work_log.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Work Logs
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {hasFilters
              ? `Showing ${list.data.meta.total} matching work logs`
              : `${list.data.meta.total} work logs`}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <>
            <Button
              variant={tab === "approvals" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setTab("approvals");
                setPage(1);
              }}
            >
              Approvals
            </Button>
            {canRead ? (
              <Button
                variant={tab === "scope" ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setTab("scope");
                  setPage(1);
                }}
              >
                All work logs
              </Button>
            ) : null}
          </>
        ) : null}
        {canSelfService ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/self-service/work-logs")}
          >
            My work logs
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Logged on or after"
              value={filters.from}
              onChange={(e) => update("from", e.target.value)}
            />
            <Input
              type="date"
              aria-label="Logged on or before"
              value={filters.to}
              onChange={(e) => update("to", e.target.value)}
            />
          </div>
        </div>
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
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
                : tab === "approvals"
                  ? "Nothing to approve"
                  : "No work logs yet"
            }
            description={
              hasFilters
                ? "Try a different status or date range, or clear the filters."
                : tab === "approvals"
                  ? "Work logs from your direct reports awaiting a decision will appear here."
                  : "Work logs you are allowed to see will appear here."
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
              { header: "Employee", cell: (w) => w.employee.fullName },
              { header: "Date", cell: (w) => w.workDate },
              { header: "Hours", cell: (w) => w.hoursWorked },
              { header: "Task", cell: (w) => w.taskDescription },
              {
                header: "Status",
                cell: (w) => <WorkLogStatusBadge status={w.status} />,
              },
              {
                header: "Decided by",
                cell: (w) => w.decidedBy?.fullName ?? "—",
              },
              ...(canApprove && tab === "approvals"
                ? [
                    {
                      header: "Actions",
                      cell: (w: WorkLogItem) =>
                        w.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({ workLog: w, decision: "approve" })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({ workLog: w, decision: "reject" })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          "—"
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
