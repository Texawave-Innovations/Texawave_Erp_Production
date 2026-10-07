"use client";

import { useState } from "react";
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
import { useMyWorkLogs } from "../hooks";
import { SELF_SERVICE_CREATE, SELF_SERVICE_READ } from "../permissions";
import { STATUS_LABELS } from "../status";
import { WORK_LOG_STATUSES, type WorkLogStatus } from "../types";
import { CreateWorkLogDialog } from "./CreateWorkLogDialog";
import { WorkLogStatusBadge } from "./WorkLogStatusBadge";

const PAGE_SIZE = 20;

interface Filters {
  status: "" | WorkLogStatus;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { status: "", from: "", to: "" };

/** The authenticated user's own work logs: submit new ones, see decisions. */
export function MyWorkLogsView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);

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

  const list = useMyWorkLogs(query);
  const hasFilters =
    filters.status !== "" || filters.from !== "" || filters.to !== "";

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to work logs">
        Ask an administrator for the{" "}
        <code>employee_self_service.work_log.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          My Work Logs
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {hasFilters
              ? `Showing ${list.data.meta.total} matching work logs`
              : `${list.data.meta.total} work logs`}
          </p>
        ) : null}
      </div>
      {canCreate ? (
        <Button onClick={() => setCreateOpen(true)}>Submit work log</Button>
      ) : null}
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
                : "No work logs yet"
            }
            description={
              hasFilters
                ? "Try a different status or date range, or clear the filters."
                : canCreate
                  ? "Submit your first work log to see it here."
                  : "Your work logs will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My work logs"
            rows={list.data.data}
            getRowKey={(w) => String(w.id)}
            columns={[
              { header: "Date", cell: (w) => w.workDate },
              { header: "Hours", cell: (w) => w.hoursWorked },
              { header: "Task", cell: (w) => w.taskDescription },
              {
                header: "Status",
                cell: (w) => <WorkLogStatusBadge status={w.status} />,
              },
              { header: "Note", cell: (w) => w.decisionNote ?? "—" },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {createOpen ? (
        <CreateWorkLogDialog open onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
