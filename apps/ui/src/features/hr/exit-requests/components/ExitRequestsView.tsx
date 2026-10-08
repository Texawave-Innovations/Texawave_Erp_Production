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
import { useExitRequests, useMyExitRequests } from "../hooks";
import {
  DECIDE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  ACTIVE_STATUSES,
  EXIT_REQUEST_STATUSES,
  type ExitRequestItem,
  type ExitRequestStatus,
} from "../types";
import { ExitRequestStatusBadge } from "./ExitRequestStatusBadge";
import { ReviewExitRequestDialog } from "./ReviewExitRequestDialog";
import { SubmitExitRequestDialog } from "./SubmitExitRequestDialog";

const PAGE_SIZE = 10;

interface Filters {
  status: "" | ExitRequestStatus;
  employeeId: string;
}
const EMPTY_FILTERS: Filters = { status: "", employeeId: "" };

/** My exit requests: submit and history. Legacy blocks a new request while
 * one of ACTIVE_STATUSES exists — the backend enforces this with a 409
 * (ACTIVE_EXIT_REQUEST_EXISTS), so this just disables the button as a hint. */
function MySection() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const list = useMyExitRequests({ page, limit: PAGE_SIZE });

  // `canRead` only means the account holds the self-service permission, not
  // that it's actually linked to an employee — an admin/HR account can hold
  // employee_self_service.exit_request.read without being an employee
  // itself, and "my exit requests" is structurally empty for them, not
  // broken. Hide the whole section rather than show a request failure that
  // will never resolve by retrying.
  if (!canRead) return null;
  if (
    list.isError &&
    list.error instanceof ApiError &&
    list.error.errorCode === "NOT_AN_EMPLOYEE"
  ) {
    return null;
  }

  const hasActiveRequest =
    list.data?.data.some((r) => ACTIVE_STATUSES.includes(r.status)) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          My exit requests
        </h2>
        {canCreate ? (
          <Button
            onClick={() => setSubmitOpen(true)}
            disabled={hasActiveRequest}
            title={
              hasActiveRequest
                ? "You already have an active exit request"
                : undefined
            }
          >
            Raise exit request
          </Button>
        ) : null}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No exit requests yet"
            description={
              canCreate
                ? "Raise an exit request to see it here."
                : "Your exit request history will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My exit requests"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Submitted",
                cell: (r) => r.createdAt.slice(0, 10),
              },
              {
                header: "Preferred last working date",
                cell: (r) => r.preferredLastWorkingDate,
              },
              {
                header: "Notice period",
                cell: (r) => `${r.noticePeriodDays} day(s)`,
              },
              {
                header: "Status",
                cell: (r) => <ExitRequestStatusBadge status={r.status} />,
              },
              {
                header: "Confirmed last working date",
                cell: (r) => r.confirmedLastWorkingDate ?? "—",
              },
              { header: "HR note", cell: (r) => r.hrNote ?? "—" },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {submitOpen ? (
        <SubmitExitRequestDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}
    </div>
  );
}

/** HR/reviewer queue: team/all scope, filterable, review (status change,
 * confirmed last working date, settlement status, HR note). */
function ReviewSection() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canDecide = usePermission(DECIDE_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [reviewing, setReviewing] = useState<ExitRequestItem | null>(null);

  const employeeIdNum = Number(filters.employeeId);
  const hasValidEmployeeId =
    filters.employeeId !== "" &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0;

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(hasValidEmployeeId ? { employeeId: employeeIdNum } : {}),
  };

  const list = useExitRequests(query, canRead);
  const hasFilters = filters.status !== "" || filters.employeeId !== "";

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  if (!canRead) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Exit requests (team / organization)
          </h2>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters
                ? `Showing ${list.data.meta.total} matching requests`
                : `${list.data.meta.total} requests`}
            </p>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | ExitRequestStatus)
            }
          >
            <option value="">All statuses</option>
            {EXIT_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min="1"
            aria-label="Filter by employee ID"
            placeholder="Employee ID"
            value={filters.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
          />
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
          <Alert
            variant="warning"
            title="You don't have access to exit requests"
          >
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
                ? "No requests match these filters"
                : "No exit requests yet"
            }
            description={
              hasFilters
                ? "Try a different status or employee, or clear the filters."
                : "Requests from your team will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Exit requests"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Employee", cell: (r) => r.employee.fullName },
              {
                header: "Preferred last working date",
                cell: (r) => r.preferredLastWorkingDate,
              },
              {
                header: "Status",
                cell: (r) => <ExitRequestStatusBadge status={r.status} />,
              },
              {
                header: "Confirmed last working date",
                cell: (r) => r.confirmedLastWorkingDate ?? "—",
              },
              {
                header: "Decided by",
                cell: (r) => r.decidedBy?.fullName ?? "—",
              },
              ...(canDecide
                ? [
                    {
                      header: "Actions",
                      cell: (r: ExitRequestItem) => (
                        <Button size="sm" onClick={() => setReviewing(r)}>
                          Review
                        </Button>
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

      {reviewing ? (
        <ReviewExitRequestDialog
          open
          onClose={() => setReviewing(null)}
          request={reviewing}
        />
      ) : null}
    </div>
  );
}

/**
 * Exit Requests: self-service (raise, history) and the HR/reviewer queue
 * (team/all, filterable, review with status transitions, confirmed last
 * working date, settlement status and HR note), on one route — mirrors
 * Expense Approvals' single scoped view.
 */
export function ExitRequestsView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canReadAny = usePermission(READ_ANY_SCOPE);

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to exit requests">
        Ask an administrator for the{" "}
        <code>employee_self_service.exit_request.read</code> or{" "}
        <code>hr.exit_request.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Exit Requests
      </h1>
      <MySection />
      {canReadMine && canReadAny ? (
        <hr className="border-gray-200 dark:border-gray-800" />
      ) : null}
      <ReviewSection />
    </div>
  );
}
