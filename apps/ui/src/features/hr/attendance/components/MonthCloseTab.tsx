"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Lock, RotateCcw, Send, Undo2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import type { MonthDecision } from "../api";
import { useApproveMonths, useFinalizeMonth, useMonthLocks } from "../hooks";
import {
  LOCK_APPROVE_TEAM_OR_ALL,
  LOCK_FINALIZE_TEAM_OR_ALL,
} from "../permissions";
import { formatMinutes } from "../status";
import {
  MONTH_LOCK_FILTERS,
  type MonthLockRow,
  type MonthLockStatus,
} from "../types";
import { describeMonthError, MonthDecisionDialog } from "./MonthDecisionDialog";

const PAGE_SIZE = 50;

const STATUS_META: Record<
  MonthLockStatus,
  { label: string; color: "brand" | "gray" | "success" | "warning" | "error" }
> = {
  OPEN: { label: "Open", color: "gray" },
  SUBMITTED: { label: "Awaiting approval", color: "brand" },
  APPROVED: { label: "Approved · locked", color: "success" },
  RETURNED: { label: "Returned", color: "warning" },
  REOPENED: { label: "Reopened", color: "warning" },
};

const SUBMITTABLE: readonly MonthLockStatus[] = [
  "OPEN",
  "RETURNED",
  "REOPENED",
];

function previousMonth(): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date())
    .slice(0, 7);
}

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(iso),
      )
    : "";

type Outcome = {
  title: string;
  done: number;
  skipped: { who: string; message: string }[];
} | null;

/**
 * Monthly attendance close (legacy "Timesheet Approvals"): HR submits a
 * finished month per employee, an approver approves it (locks it for
 * payroll) or returns it, and may reopen an approved month. The API enforces
 * scope, "not your own month" and "the submitter cannot approve"; the UI
 * only hides what the caller can't do.
 */
export function MonthCloseTab() {
  const canFinalize = usePermission(LOCK_FINALIZE_TEAM_OR_ALL);
  const canApprove = usePermission(LOCK_APPROVE_TEAM_OR_ALL);
  const myUserId = useAuthStore((s) => s.user?.userId ?? null);
  const [month, setMonth] = useState(previousMonth());
  const [status, setStatus] = useState<"" | MonthLockStatus>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    row: MonthLockRow;
    decision: MonthDecision;
  } | null>(null);
  const { toast } = useToast();

  const list = useMonthLocks({
    page,
    limit: PAGE_SIZE,
    month,
    ...(status ? { status } : {}),
  });
  const finalize = useFinalizeMonth();
  const approve = useApproveMonths();
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const monthEnded = month < currentMonth();
  const nameOf = useMemo(
    () => new Map(rows.map((r) => [r.employee.id, r.employee.fullName])),
    [rows],
  );

  const submittableSelected = rows.filter(
    (r) => selected.has(r.employee.id) && SUBMITTABLE.includes(r.status),
  );
  const approvableSelected = rows.filter(
    (r) =>
      selected.has(r.employee.id) && r.status === "SUBMITTED" && r.id !== null,
  );

  function reset() {
    setSelected(new Set());
    setPage(1);
    setOutcome(null);
    setActionError(null);
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(employeeIds?: number[]) {
    setActionError(null);
    try {
      const report = await finalize.mutateAsync({
        month,
        ...(employeeIds ? { employeeIds } : {}),
      });
      setOutcome({
        title: "Submitted for approval",
        done: report.submitted.length,
        skipped: report.skipped.map((s) => ({
          who: nameOf.get(s.employeeId) ?? `Employee #${s.employeeId}`,
          message: s.message,
        })),
      });
      setSelected(new Set());
      if (report.submitted.length > 0) {
        toast({
          title: `${report.submitted.length} submitted`,
          variant: "success",
        });
      }
    } catch (error) {
      setActionError(describeMonthError(error));
    }
  }

  async function approveSelected() {
    setActionError(null);
    const byLock = new Map(
      approvableSelected.map((r) => [r.id as number, r.employee.fullName]),
    );
    try {
      const report = await approve.mutateAsync({ ids: [...byLock.keys()] });
      setOutcome({
        title: "Approved",
        done: report.approved.length,
        skipped: report.skipped.map((s) => ({
          who: byLock.get(s.id) ?? `#${s.id}`,
          message: s.message,
        })),
      });
      setSelected(new Set());
      if (report.approved.length > 0) {
        toast({
          title: `${report.approved.length} approved`,
          variant: "success",
        });
      }
    } catch (error) {
      setActionError(describeMonthError(error));
    }
  }

  const counts = useMemo(() => {
    const out: Partial<Record<MonthLockStatus, number>> = {};
    for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
    return out;
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="month"
              aria-label="Month to close"
              value={month}
              max={currentMonth()}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value);
                  reset();
                }
              }}
            />
            <Select
              aria-label="Filter by close status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | MonthLockStatus);
                reset();
              }}
            >
              <option value="">All statuses</option>
              {MONTH_LOCK_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {canFinalize ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!monthEnded || submittableSelected.length === 0}
                  loading={finalize.isPending}
                  onClick={() =>
                    void submit(submittableSelected.map((r) => r.employee.id))
                  }
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Submit selected ({submittableSelected.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!monthEnded}
                  loading={finalize.isPending}
                  onClick={() => void submit()}
                >
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Submit all eligible
                </Button>
              </>
            ) : null}
            {canApprove ? (
              <Button
                type="button"
                size="sm"
                disabled={approvableSelected.length === 0}
                loading={approve.isPending}
                onClick={() => void approveSelected()}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Approve selected ({approvableSelected.length})
              </Button>
            ) : null}
          </div>
        </div>
        {canFinalize && !monthEnded ? (
          <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {month} has not ended yet. A month can be submitted from the 1st of
            the next month.
          </p>
        ) : null}
        {rows.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-3 text-theme-xs text-gray-600 dark:text-gray-400">
            {MONTH_LOCK_FILTERS.filter((s) => counts[s]).map((s) => (
              <span key={s}>
                {STATUS_META[s].label}:{" "}
                <span className="font-semibold">{counts[s]}</span>
              </span>
            ))}
            {(list.data?.meta.totalPages ?? 1) > 1 ? (
              <span>(this page)</span>
            ) : null}
          </div>
        ) : null}
      </Card>

      {actionError ? (
        <Alert variant="error" title="Nothing was changed">
          {actionError}
        </Alert>
      ) : null}
      {outcome ? (
        <Alert
          variant={outcome.skipped.length > 0 ? "warning" : "success"}
          title={`${outcome.title}: ${outcome.done}${outcome.skipped.length ? ` · skipped ${outcome.skipped.length}` : ""}`}
        >
          {outcome.skipped.length > 0 ? (
            <ul className="mt-1 list-disc pl-4">
              {outcome.skipped.slice(0, 20).map((s, i) => (
                <li key={i}>
                  <span className="font-semibold">{s.who}</span>: {s.message}
                </li>
              ))}
              {outcome.skipped.length > 20 ? (
                <li>…and {outcome.skipped.length - 20} more</li>
              ) : null}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to month close">
            Ask an administrator for the <code>hr.attendance_lock.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Nobody to show"
            description="No employee in your scope matches this month and status."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption={`Attendance close for ${month}`}
            rows={rows}
            getRowKey={(r) => String(r.employee.id)}
            columns={[
              ...(canFinalize || canApprove
                ? [
                    {
                      header: "Select",
                      cell: (r: MonthLockRow) => (
                        <Checkbox
                          aria-label={`Select ${r.employee.fullName}`}
                          checked={selected.has(r.employee.id)}
                          disabled={r.status === "APPROVED"}
                          onChange={() => toggle(r.employee.id)}
                        />
                      ),
                    },
                  ]
                : []),
              {
                header: "Employee",
                cell: (r: MonthLockRow) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Status",
                cell: (r: MonthLockRow) => (
                  <StatusBadge
                    label={STATUS_META[r.status].label}
                    colorToken={STATUS_META[r.status].color}
                  />
                ),
              },
              {
                header: "Summary at submission",
                cell: (r: MonthLockRow) =>
                  r.summary ? (
                    <div className="flex flex-col text-theme-xs text-gray-700 dark:text-gray-300">
                      <span>
                        P {r.summary.countsByStatus.PRESENT} · ½{" "}
                        {r.summary.countsByStatus.HALF_DAY} · A{" "}
                        {r.summary.countsByStatus.ABSENT} · L{" "}
                        {r.summary.countsByStatus.ON_LEAVE}
                        {r.summary.countsByStatus.NOT_MARKED > 0 ? (
                          <span className="ml-1 font-semibold text-warning-700 dark:text-warning-400">
                            · unmarked {r.summary.countsByStatus.NOT_MARKED}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-gray-500">
                        {formatMinutes(r.summary.workedMinutes)} worked · net OT{" "}
                        {r.summary.netOvertimeMinutes < 0 ? "−" : ""}
                        {formatMinutes(Math.abs(r.summary.netOvertimeMinutes))}
                      </span>
                    </div>
                  ) : (
                    <span className="text-theme-xs text-gray-400">
                      Not submitted
                    </span>
                  ),
              },
              {
                header: "History",
                cell: (r: MonthLockRow) => (
                  <div className="flex max-w-64 flex-col text-theme-xs text-gray-600 dark:text-gray-400">
                    {r.submittedBy ? (
                      <span>
                        Submitted by {r.submittedBy.fullName}{" "}
                        {when(r.submittedAt)}
                      </span>
                    ) : null}
                    {r.decidedBy && r.status !== "SUBMITTED" ? (
                      <span>
                        {STATUS_META[r.status].label.split(" ")[0]} by{" "}
                        {r.decidedBy.fullName} {when(r.decidedAt)}
                      </span>
                    ) : null}
                    {r.decisionNote ? (
                      <span className="italic">“{r.decisionNote}”</span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Actions",
                cell: (r: MonthLockRow) => {
                  if (!canApprove || r.id === null)
                    return (
                      <span className="text-theme-xs text-gray-400">—</span>
                    );
                  if (r.status === "SUBMITTED") {
                    if (r.submittedBy?.id === myUserId) {
                      return (
                        <span
                          className="text-theme-xs text-gray-500"
                          title="Someone else must approve what you submitted"
                        >
                          Needs another approver
                        </span>
                      );
                    }
                    return (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDeciding({ row: r, decision: "return" })
                          }
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          Return
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setDeciding({ row: r, decision: "approve" })
                          }
                        >
                          Approve
                        </Button>
                      </div>
                    );
                  }
                  if (r.status === "APPROVED") {
                    return (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeciding({ row: r, decision: "reopen" })
                        }
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Reopen
                      </Button>
                    );
                  }
                  return <span className="text-theme-xs text-gray-400">—</span>;
                },
              },
            ]}
          />
          {list.data.meta.totalPages > 1 ? (
            <Pagination
              page={list.data.meta.page}
              totalPages={list.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      {deciding ? (
        <MonthDecisionDialog
          row={deciding.row}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </div>
  );
}
