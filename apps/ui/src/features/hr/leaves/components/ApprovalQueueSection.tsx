"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { useAwaitingLeave, useLeaveRequest } from "../hooks";
import type { LeaveRequestItem } from "../types";
import { DecideLeaveDialog } from "./DecideLeaveDialog";
import {
  appliedByOther,
  LeaveDatesCell,
  LeaveDaysCell,
  LeaveTypeCell,
} from "./cells";

const PAGE_SIZE = 10;

/** The caller's step on a queued request (server-computed `yourStep`). */
function StageCell({ r }: { r: LeaveRequestItem }) {
  const step = r.yourStep;
  if (step?.step === "HR") {
    return (
      <div className="flex flex-col gap-0.5">
        <StatusBadge
          label={step.override ? "HR step (as Admin)" : "HR approval (final)"}
          colorToken={step.override ? "warning" : "brand"}
        />
        {r.firstDecidedBy ? (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            1st: {r.firstDecidedBy.fullName}
          </span>
        ) : step.escalated ? (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Team lead did not decide in 2 working days
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <StatusBadge
      label={step && !step.final ? "Team lead · 1st of 2" : "Team lead"}
      colorToken="warning"
    />
  );
}

/**
 * "Waiting for me" (GET /hr/leave-requests/approvals): exactly what the
 * caller may decide now — their team (as its team lead) and delegations, their
 * approve scope, and for HR (`.all`) the second approval of two-level types.
 * Never their own requests or ones they applied for (Docs/HR_LEAVE.md §6.1).
 */
export function ApprovalQueueSection() {
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");

  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{
    request: LeaveRequestItem;
    decision: "approve" | "reject";
  } | null>(null);
  const list = useAwaitingLeave({ page, limit: PAGE_SIZE });

  // A notification links here with `?id=`: open that request's dialog ONCE
  // (not again after the list refreshes), wherever it is in the queue, and
  // only while it still waits for the caller (`yourStep`).
  const parsedId = urlId ? parseInt(urlId, 10) : NaN;
  const linkedId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const linked = useLeaveRequest(linkedId);
  const openedFor = useRef<number | null>(null);
  useEffect(() => {
    const request = linked.data;
    if (linkedId === null || !request || openedFor.current === linkedId) {
      return;
    }
    const timer = setTimeout(() => {
      openedFor.current = linkedId;
      if (request.status === "PENDING" && request.yourStep) {
        setDecision({ request, decision: "approve" });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [linkedId, linked.data]);

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
          <Alert dismissible variant="warning" title="You can't approve leave">
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
                    <div className="flex items-center gap-1.5">
                      <EmployeeIdentity
                        name={r.employee.fullName}
                        code={r.employee.employeeCode}
                        size="sm"
                      />
                      {urlId && Number(urlId) === r.id && (
                        <span className="rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-cyan-300 text-[9px] font-bold px-1.5 py-0.2 border border-brand-300/60 dark:border-brand-700">
                          Selected
                        </span>
                      )}
                    </div>
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
                cell: (r) => <StageCell r={r} />,
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
