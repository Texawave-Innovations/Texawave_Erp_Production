"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Pagination,
  Select,
  cn,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  EmployeePicker,
  type EmployeeOption,
} from "@/components/widgets/EmployeePicker";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { exportLeaveRequestsCsv } from "../api";
import { leaveErrorMessage } from "../errors";
import {
  useLeaveRequests,
  useLeaveStatusCounts,
  useLeaveTypes,
} from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  CREATE_ON_BEHALF_SCOPE,
  EXPORT_ANY_SCOPE,
  HR_CANCEL_SCOPE,
  LEAVE_TYPE_READ,
} from "../permissions";
import type { LeaveRequestItem, LeaveStatus } from "../types";
import { ApplyOnBehalfDialog } from "./ApplyOnBehalfDialog";
import { DecideLeaveDialog } from "./DecideLeaveDialog";
import { HrCancelLeaveDialog } from "./HrCancelLeaveDialog";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import {
  appliedByOther,
  LeaveDatesCell,
  LeaveDaysCell,
  LeaveTypeCell,
} from "./cells";

const PAGE_SIZE = 10;
const thisMonth = () =>
  new Intl.DateTimeFormat("en-CA").format(new Date()).slice(0, 7);

/** `2026-10` → first and last day of that month. */
function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

const CARDS: { id: "" | LeaveStatus; label: string; tone: string }[] = [
  { id: "", label: "Total", tone: "text-gray-900 dark:text-white/90" },
  {
    id: "PENDING",
    label: "Pending",
    tone: "text-warning-600 dark:text-warning-400",
  },
  {
    id: "APPROVED",
    label: "Approved",
    tone: "text-success-600 dark:text-success-400",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    tone: "text-error-600 dark:text-error-400",
  },
  {
    id: "CANCELLED",
    label: "Cancelled",
    tone: "text-gray-500 dark:text-gray-400",
  },
];

/**
 * Leave applications in the caller's read scope — the legacy "Leave
 * Applications" tab: clickable status cards, a month filter (default this
 * month), leave type and employee filters, CSV export, HR applying on
 * someone's behalf, approve/reject and HR cancellation. Every action is
 * shown by permission and re-checked by the API.
 */
export function ApplicationsSection() {
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const canCreate = usePermission(CREATE_ON_BEHALF_SCOPE);
  const canCancel = usePermission(HR_CANCEL_SCOPE);
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const canReadTypes = usePermission(LEAVE_TYPE_READ);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | LeaveStatus>("");
  const [month, setMonth] = useState(thisMonth());
  const [leaveTypeId, setLeaveTypeId] = useState(0);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [exporting, setExporting] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [decision, setDecision] = useState<{
    request: LeaveRequestItem;
    decision: "approve" | "reject";
  } | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequestItem | null>(null);

  const range = monthRange(month);
  const filters = {
    ...(range ?? {}),
    ...(leaveTypeId ? { leaveTypeId } : {}),
    ...(employee ? { employeeId: employee.id } : {}),
  };
  const list = useLeaveRequests({
    page,
    limit: PAGE_SIZE,
    ...filters,
    ...(status ? { status } : {}),
  });
  const counts = useLeaveStatusCounts(filters);
  const types = useLeaveTypes({ page: 1, limit: 100 }, canReadTypes);
  const hasFilters = Boolean(
    status || leaveTypeId || employee || month !== thisMonth(),
  );

  function reset() {
    setStatus("");
    setMonth(thisMonth());
    setLeaveTypeId(0);
    setEmployee(null);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportLeaveRequestsCsv({
        ...filters,
        ...(status ? { status } : {}),
      });
    } catch (err) {
      toast({
        title: "Could not export",
        description: leaveErrorMessage(
          err,
          "You don't have permission to export leave.",
        ),
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Leave applications
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Every request in your scope. Click a card to filter by status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <Button
              variant="secondary"
              loading={exporting}
              onClick={() => void handleExport()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={() => setApplyOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Apply for an employee
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map((c) => {
          const value =
            counts.data === undefined
              ? "…"
              : c.id === ""
                ? counts.data.total
                : counts.data[c.id];
          const selected = status === c.id;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStatus(c.id);
                setPage(1);
              }}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left transition-colors dark:bg-white/[0.03]",
                selected
                  ? "border-brand-500 ring-2 ring-brand-500/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700",
              )}
            >
              <span className={cn("block text-2xl font-semibold", c.tone)}>
                {value}
              </span>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Month">
          {(f) => (
            <Input
              {...f}
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
            />
          )}
        </FormField>
        {canReadTypes ? (
          <FormField label="Leave type">
            {(f) => (
              <Select
                {...f}
                value={leaveTypeId || ""}
                onChange={(e) => {
                  setLeaveTypeId(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="">All leave types</option>
                {(types.data?.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}
        <FormField label="Employee">
          {(f) => (
            <EmployeePicker
              {...f}
              value={employee}
              onChange={(e) => {
                setEmployee(e);
                setPage(1);
              }}
            />
          )}
        </FormField>
        {hasFilters ? (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {list.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={8} />
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
                : "No leave requests this month"
            }
            description="Try another month, status or employee."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Leave applications"
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
              { header: "Leave type", cell: (r) => <LeaveTypeCell r={r} /> },
              { header: "Dates", cell: (r) => <LeaveDatesCell r={r} /> },
              { header: "Days", cell: (r) => <LeaveDaysCell r={r} /> },
              {
                header: "Reason",
                cell: (r) => (
                  <p
                    className="max-w-[14rem] truncate text-theme-sm text-gray-600 dark:text-gray-300"
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
                    <LeaveStatusBadge status={r.status} awaiting={r.awaiting} />
                    {appliedByOther(r) ? (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Applied by {appliedByOther(r)}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Decided / cancelled by",
                cell: (r) => {
                  const who =
                    r.status === "CANCELLED"
                      ? r.cancelledBy?.fullName
                      : (r.decidedBy?.fullName ?? r.firstDecidedBy?.fullName);
                  const note =
                    r.status === "CANCELLED"
                      ? r.cancellationNote
                      : r.decisionNote;
                  return (
                    <div className="flex max-w-[12rem] flex-col">
                      <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                        {who ?? "—"}
                      </span>
                      {note ? (
                        <span
                          className="truncate text-[11px] text-gray-500 dark:text-gray-400"
                          title={note}
                        >
                          {note}
                        </span>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                header: "Applied on",
                cell: (r) => (
                  <span className="whitespace-nowrap text-theme-xs text-gray-500 dark:text-gray-400">
                    {r.createdAt.slice(0, 10)}
                  </span>
                ),
              },
              ...(canApprove || canCancel
                ? [
                    {
                      header: "Actions",
                      cell: (r: LeaveRequestItem) => (
                        <div className="flex items-center gap-2">
                          {canApprove && r.status === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setDecision({
                                    request: r,
                                    decision: "approve",
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setDecision({
                                    request: r,
                                    decision: "reject",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {canCancel &&
                          (r.status === "PENDING" ||
                            r.status === "APPROVED") ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCancelling(r)}
                            >
                              Cancel
                            </Button>
                          ) : null}
                          {r.status !== "PENDING" && r.status !== "APPROVED" ? (
                            <span className="text-gray-400 dark:text-gray-500">
                              —
                            </span>
                          ) : null}
                        </div>
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

      {applyOpen ? (
        <ApplyOnBehalfDialog open onClose={() => setApplyOpen(false)} />
      ) : null}
      {decision ? (
        <DecideLeaveDialog
          open
          onClose={() => setDecision(null)}
          request={decision.request}
          decision={decision.decision}
        />
      ) : null}
      {cancelling ? (
        <HrCancelLeaveDialog
          open
          onClose={() => setCancelling(null)}
          request={cancelling}
        />
      ) : null}
    </div>
  );
}
