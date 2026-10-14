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
  Pagination,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useAwaitingLeave } from "../hooks";
import type { LeaveRequestItem } from "../types";
import { DecideLeaveDialog } from "./DecideLeaveDialog";
import {
  appliedByOther,
  LeaveDatesCell,
  LeaveDaysCell,
  LeaveTypeCell,
} from "./cells";

const PAGE_SIZE = 10;

/**
 * "Waiting for me" (GET /hr/leave-requests/approvals): exactly what the
 * caller may decide now — their direct reports and delegations, their
 * approve scope, and for HR (`.all`) the second approval of two-level types.
 * Never their own requests or ones they applied for (Docs/HR_LEAVE.md §6.1).
 */
export function ApprovalQueueSection() {
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{
    request: LeaveRequestItem;
    decision: "approve" | "reject";
  } | null>(null);
  const list = useAwaitingLeave({ page, limit: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          Waiting for my approval
        </h2>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {list.data
            ? `${list.data.meta.total} request${list.data.meta.total === 1 ? "" : "s"} need your decision.`
            : "Leave of the people who report to you, your approval scope, and anyone who delegated to you."}
        </p>
      </div>

      {list.isPending ? (
        <TableSkeleton rowsCount={4} columnsCount={6} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You can't approve leave">
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing is waiting for you"
            description="New requests from your team appear here, and you also get a notification."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Leave requests waiting for my approval"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <EmployeeIdentity
                      name={r.employee.fullName}
                      code={r.employee.employeeCode}
                      size="sm"
                    />
                    {appliedByOther(r) ? (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Applied by {appliedByOther(r)}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              { header: "Leave type", cell: (r) => <LeaveTypeCell r={r} /> },
              { header: "Dates", cell: (r) => <LeaveDatesCell r={r} /> },
              { header: "Days", cell: (r) => <LeaveDaysCell r={r} /> },
              {
                header: "Stage",
                cell: (r) =>
                  r.awaiting === "HR" ? (
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge label="HR approval" colorToken="brand" />
                      {r.firstDecidedBy ? (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          1st: {r.firstDecidedBy.fullName}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <StatusBadge
                      label={r.approvalLevels === 2 ? "1st of 2" : "Approval"}
                      colorToken="warning"
                    />
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
                header: "Actions",
                cell: (r) => (
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
