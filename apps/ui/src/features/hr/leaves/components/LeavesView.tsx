"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import {
  useMyLeaveBalances,
  useMyLeaveRequests,
  useResubmitMyLeaveRequest,
} from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  LEAVE_TYPE_READ,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { DAY_PORTION_LABELS, canCancel, canResubmit } from "../status";
import type { LeaveRequestItem } from "../types";
import { AllotmentSection } from "./AllotmentSection";
import { ApplicationsSection } from "./ApplicationsSection";
import { ApprovalQueueSection } from "./ApprovalQueueSection";
import { CancelLeaveDialog } from "./CancelLeaveDialog";
import { DelegationsSection } from "./DelegationsSection";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { LeaveTypesSection } from "./LeaveTypesSection";
import { RequestLeaveDialog } from "./RequestLeaveDialog";
import { appliedByOther } from "./cells";

const PAGE_SIZE = 10;

type LeavesTab =
  "mine" | "approvals" | "applications" | "allotment" | "delegations" | "types";

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
                      <LeaveStatusBadge
                        status={r.status}
                        awaiting={r.awaiting}
                      />
                      {appliedByOther(r) ? (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Applied by {appliedByOther(r)}
                        </span>
                      ) : null}
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
                          {r.cancelledBy &&
                          r.cancelledBy.fullName !== r.employee.fullName
                            ? `Cancelled by ${r.cancelledBy.fullName}: `
                            : "Note: "}
                          {r.cancellationNote}
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

/**
 * Leaves (Docs/HR_LEAVE.md): one route, one tab per job, each shown only
 * with its permission — the API re-checks every action.
 *
 *  - My leave: balances, request, history, cancel, resubmit (self-service).
 *  - Approvals: what waits for MY decision (reporting line, delegation,
 *    scope, HR's second approval).
 *  - Applications: everything in my read scope, legacy-style status cards,
 *    month filter, export, apply on behalf, HR cancel.
 *  - Allotment: entitlement and balance per employee; edit, import, export.
 *  - Delegations: my stand-ins while I'm away.
 *  - Leave types: administration.
 */
export function LeavesView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canReadAny = usePermission(READ_ANY_SCOPE);
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const canReadTypes = usePermission(LEAVE_TYPE_READ);

  const tabs = [
    ...(canReadMine ? [{ id: "mine" as const, label: "My leave" }] : []),
    ...(canApprove ? [{ id: "approvals" as const, label: "Approvals" }] : []),
    ...(canReadAny
      ? [
          { id: "applications" as const, label: "Applications" },
          { id: "allotment" as const, label: "Allotment" },
        ]
      : []),
    ...(canApprove
      ? [{ id: "delegations" as const, label: "Delegations" }]
      : []),
    ...(canReadTypes ? [{ id: "types" as const, label: "Leave types" }] : []),
  ];
  // A notification links approvers to `?tab=approvals`.
  const requested = useSearchParams().get("tab");
  const [chosen, setChosen] = useState<LeavesTab | null>(
    requested as LeavesTab | null,
  );
  const active: LeavesTab | undefined =
    tabs.find((t) => t.id === chosen)?.id ?? tabs[0]?.id;

  if (!active) {
    return (
      <Alert variant="warning" title="You don't have access to leave">
        Ask an administrator for the{" "}
        <code>employee_self_service.leave_request.read</code> or{" "}
        <code>hr.leave_request.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Leaves
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Request and track leave, approve your team&apos;s requests, and manage
          allotments.
        </p>
      </div>

      <Tabs
        label="Leave sections"
        idPrefix="leaves"
        tabs={tabs}
        value={active}
        onChange={setChosen}
      >
        {active === "mine" ? <MySection /> : null}
        {active === "approvals" ? <ApprovalQueueSection /> : null}
        {active === "applications" ? <ApplicationsSection /> : null}
        {active === "allotment" ? <AllotmentSection /> : null}
        {active === "delegations" ? <DelegationsSection /> : null}
        {active === "types" ? <LeaveTypesSection /> : null}
      </Tabs>
    </div>
  );
}
