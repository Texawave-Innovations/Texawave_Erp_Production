"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
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
import { DAY_PORTION_LABELS, canCancel, canResubmit } from "../status";
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

type LeavesTab = "all" | "mine" | "approvals";

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

  // `canRead` only means the account holds the self-service permission, not
  // that it's actually linked to an employee — an admin/HR account can hold
  // employee_self_service.leave_request.read without being an employee
  // itself, and "my leave" is structurally empty for them, not broken. Hide
  // the whole section rather than show a request failure that will never
  // resolve by retrying.
  if (!canRead) return null;
  if (
    (list.isError &&
      list.error instanceof ApiError &&
      list.error.errorCode === "NOT_AN_EMPLOYEE") ||
    (balances.isError &&
      balances.error instanceof ApiError &&
      balances.error.errorCode === "NOT_AN_EMPLOYEE")
  ) {
    return null;
  }

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            My leave
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Review your personal leave balances, entitlement breakdown, and
            request history.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setRequestOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Request leave
          </Button>
        ) : null}
      </div>

      <LeaveBalanceCards
        balances={balances.data}
        isPending={balances.isPending}
      />

      <div className="flex flex-col gap-3">
        <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
          Leave history
        </h3>

        {list.isPending ? (
          <TableSkeleton rowsCount={4} columnsCount={6} />
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
                {
                  header: "Leave type",
                  cell: (r) => (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white/90">
                        {r.leaveType.name}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {r.leaveType.code}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Dates",
                  cell: (r) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white/90">
                        {r.startDate === r.endDate
                          ? r.startDate
                          : `${r.startDate} – ${r.endDate}`}
                      </span>
                      {r.dayPortion !== "FULL" ? (
                        <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                          {DAY_PORTION_LABELS[r.dayPortion]}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Days",
                  cell: (r) => (
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {r.leaveDays}{" "}
                      <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                        {r.leaveDays === 1 ? "day" : "days"}
                      </span>
                    </span>
                  ),
                },
                {
                  header: "Reason",
                  cell: (r) => (
                    <p
                      className="max-w-xs truncate text-theme-sm text-gray-600 dark:text-gray-300"
                      title={r.reason}
                    >
                      {r.reason}
                    </p>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => (
                    <div className="flex flex-col gap-0.5">
                      <LeaveStatusBadge status={r.status} />
                      {r.status === "REJECTED" && r.decisionNote ? (
                        <span
                          className="max-w-45 truncate text-[11px] text-error-600 dark:text-error-400"
                          title={r.decisionNote}
                        >
                          Note: {r.decisionNote}
                        </span>
                      ) : null}
                      {r.status === "CANCELLED" && r.cancellationNote ? (
                        <span
                          className="max-w-45 truncate text-[11px] text-gray-500 dark:text-gray-400"
                          title={r.cancellationNote}
                        >
                          Note: {r.cancellationNote}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex items-center gap-2">
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
                      {!canCancel(r) && !canResubmit(r) ? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      ) : null}
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
      </div>

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

  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABEL[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    if (filters.employeeId) {
      chips.push({
        id: "employeeId",
        label: "Employee ID",
        value: filters.employeeId,
        onRemove: () => update("employeeId", ""),
      });
    }
    return chips;
  }, [filters]);

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
          ) : (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Review and decide employee leave requests within your approval
              scope.
            </p>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
          {hasFilters ? (
            <div className="flex items-center">
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
        </div>

        {hasFilters && activeChips.length > 0 ? (
          <FilterChips
            chips={activeChips}
            onClearAll={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          />
        ) : null}
      </Card>

      {list.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
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
              {
                header: "Employee",
                cell: (r) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    size="sm"
                  />
                ),
              },
              {
                header: "Leave type",
                cell: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {r.leaveType.name}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {r.leaveType.code}
                    </span>
                  </div>
                ),
              },
              {
                header: "Dates",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {r.startDate === r.endDate
                        ? r.startDate
                        : `${r.startDate} – ${r.endDate}`}
                    </span>
                    {r.dayPortion !== "FULL" ? (
                      <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                        {DAY_PORTION_LABELS[r.dayPortion]}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Days",
                cell: (r) => (
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    {r.leaveDays}{" "}
                    <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                      {r.leaveDays === 1 ? "day" : "days"}
                    </span>
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (r) => <LeaveStatusBadge status={r.status} />,
              },
              {
                header: "Decided by",
                cell: (r) => (
                  <span className="text-theme-sm text-gray-600 dark:text-gray-400">
                    {r.decidedBy?.fullName ?? "—"}
                  </span>
                ),
              },
              ...(canApprove
                ? [
                    {
                      header: "Actions",
                      cell: (r: LeaveRequestItem) =>
                        r.status === "PENDING" ? (
                          <div className="flex items-center gap-2">
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
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
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
 * scoped view with unified navigation tabs for streamlined switching.
 */
export function LeavesView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canReadAny = usePermission(READ_ANY_SCOPE);
  const [activeTab, setActiveTab] = useState<LeavesTab>("all");

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to leave">
        Ask an administrator for the{" "}
        <code>employee_self_service.leave_request.read</code> or{" "}
        <code>hr.leave_request.read</code> permission.
      </Alert>
    );
  }

  const showTabs = canReadMine && canReadAny;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Leaves
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Manage your leave requests and review team requests.
        </p>
      </div>

      {/* Navigation tabs if user holds both self-service and team/all scopes */}
      {showTabs ? (
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
              activeTab === "all"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mine")}
            className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
              activeTab === "mine"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            My Leave
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
              activeTab === "approvals"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Team Requests
          </button>
        </div>
      ) : null}

      {/* Content based on permissions and selected tab */}
      {(activeTab === "all" || activeTab === "mine") && canReadMine ? (
        <MySection />
      ) : null}

      {activeTab === "all" && canReadMine && canReadAny ? (
        <hr className="border-gray-200 dark:border-gray-800" />
      ) : null}

      {(activeTab === "all" || activeTab === "approvals") && canReadAny ? (
        <ApprovalsSection />
      ) : null}
    </div>
  );
}
