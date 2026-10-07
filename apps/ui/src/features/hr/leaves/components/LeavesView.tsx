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
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useLeaveRequests,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useResubmitMyLeaveRequest,
} from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { canCancel, canResubmit } from "../status";
import {
  LEAVE_STATUSES,
  type LeaveRequestItem,
  type LeaveStatus,
} from "../types";
import { CancelLeaveDialog } from "./CancelLeaveDialog";
import { DecideLeaveDialog } from "./DecideLeaveDialog";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { RequestLeaveDialog } from "./RequestLeaveDialog";

const PAGE_SIZE = 10;
const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

interface Filters {
  status: "" | LeaveStatus;
  employeeId: string;
}
const EMPTY_FILTERS: Filters = { status: "", employeeId: "" };

type Decision = {
  request: LeaveRequestItem;
  decision: "approve" | "reject";
} | null;

/** My leave: balances, history, request, cancel and resubmit. */
function MySection() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequestItem | null>(null);
  const balances = useMyLeaveBalances();
  const list = useMyLeaveRequests({ page, limit: PAGE_SIZE });
  const resubmit = useResubmitMyLeaveRequest();
  const { toast } = useToast();

  if (!canRead) return null;

  async function handleResubmit(id: number) {
    try {
      await resubmit.mutateAsync(id);
      toast({ title: "Leave request resubmitted", variant: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError
            ? err.message
            : "Could not resubmit the request",
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          My leave
        </h2>
        {canCreate ? (
          <Button onClick={() => setRequestOpen(true)}>Request leave</Button>
        ) : null}
      </div>

      <LeaveBalanceCards
        balances={balances.data}
        isPending={balances.isPending}
      />

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
            title="No leave requests yet"
            description={
              canCreate
                ? "Request leave to see it here."
                : "Your leave history will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My leave requests"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Leave type", cell: (r) => r.leaveType.name },
              {
                header: "Dates",
                cell: (r) =>
                  r.startDate === r.endDate
                    ? r.startDate
                    : `${r.startDate} – ${r.endDate}`,
              },
              { header: "Days", cell: (r) => r.leaveDays },
              { header: "Reason", cell: (r) => r.reason },
              {
                header: "Status",
                cell: (r) => <LeaveStatusBadge status={r.status} />,
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex gap-2">
                    {canCreate && canCancel(r) ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelling(r)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    {canCreate && canResubmit(r) ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resubmit.isPending}
                        onClick={() => void handleResubmit(r.id)}
                      >
                        Resubmit
                      </Button>
                    ) : null}
                    {!canCancel(r) && !canResubmit(r) ? "—" : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {requestOpen ? (
        <RequestLeaveDialog open onClose={() => setRequestOpen(false)} />
      ) : null}
      {cancelling ? (
        <CancelLeaveDialog
          open
          onClose={() => setCancelling(null)}
          request={cancelling}
        />
      ) : null}
    </div>
  );
}

/** HR/approver queue: team/all scope, filterable, approve/reject. */
function ApprovalsSection() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [decision, setDecision] = useState<Decision>(null);

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

  const list = useLeaveRequests(query, canRead);
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
            Leave requests (team / organization)
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
              update("status", e.target.value as "" | LeaveStatus)
            }
          >
            <option value="">All statuses</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
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
            title="You don't have access to leave requests"
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
                : "No leave requests yet"
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
            caption="Leave requests"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Employee", cell: (r) => r.employee.fullName },
              { header: "Leave type", cell: (r) => r.leaveType.name },
              {
                header: "Dates",
                cell: (r) =>
                  r.startDate === r.endDate
                    ? r.startDate
                    : `${r.startDate} – ${r.endDate}`,
              },
              { header: "Days", cell: (r) => r.leaveDays },
              {
                header: "Status",
                cell: (r) => <LeaveStatusBadge status={r.status} />,
              },
              {
                header: "Decided by",
                cell: (r) => r.decidedBy?.fullName ?? "—",
              },
              ...(canApprove
                ? [
                    {
                      header: "Actions",
                      cell: (r: LeaveRequestItem) =>
                        r.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({ request: r, decision: "approve" })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({ request: r, decision: "reject" })
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
        <DecideLeaveDialog
          open
          onClose={() => setDecision(null)}
          request={decision.request}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}

/**
 * Leaves: self-service (balances, request, history, cancel, resubmit) and
 * the HR/approver queue (team/all, filterable, approve/reject with a
 * mandatory rejection reason), on one route — mirrors Regularization's single
 * scoped view rather than Work Logs' split self-service/HR routes, since
 * leave approval and an employee's own leave naturally sit on the same page.
 */
export function LeavesView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canReadAny = usePermission(READ_ANY_SCOPE);

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to leave">
        Ask an administrator for the{" "}
        <code>employee_self_service.leave_request.read</code> or{" "}
        <code>hr.leave_request.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Leaves
      </h1>
      <MySection />
      {canReadMine && canReadAny ? (
        <hr className="border-gray-200 dark:border-gray-800" />
      ) : null}
      <ApprovalsSection />
    </div>
  );
}
