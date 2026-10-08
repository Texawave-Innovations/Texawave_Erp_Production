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
import { useAttendanceCorrections, useAttendanceList } from "../hooks";
import {
  CORRECTION_APPROVE_ANY_SCOPE,
  CORRECTION_READ_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_READ,
  WRITE_ANY_SCOPE,
} from "../permissions";
import { CORRECTION_TYPE_LABELS, STATUS_LABELS } from "../status";
import {
  CORRECTION_STATUSES,
  STORED_STATUSES,
  type AttendanceCorrection,
  type AttendanceDayView,
  type CorrectionStatus,
  type StoredStatus,
} from "../types";
import { AttendanceDetailDialog } from "./AttendanceDetailDialog";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { CorrectionStatusBadge } from "./CorrectionStatusBadge";
import { DecideCorrectionDialog } from "./DecideCorrectionDialog";
import { ManualEditAttendanceDialog } from "./ManualEditAttendanceDialog";

const PAGE_SIZE = 20;
const MAX_RANGE_DAYS = 62;

function today(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function startOfMonth(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA").format(
    new Date(d.getFullYear(), d.getMonth(), 1),
  );
}

interface Filters {
  from: string;
  to: string;
  employeeId: string;
  status: "" | StoredStatus;
}

type Tab = "records" | "corrections";

type Decision = {
  correction: AttendanceCorrection;
  decision: "approve" | "reject";
} | null;

/**
 * HR Attendance: the caller's own/team/all scope, filtered by date range,
 * employee id and stored status. Filtering and paging happen server-side.
 * There is no employee name on the attendance-records API payload, so rows
 * show the employee id, matching what the backend actually returns. A second
 * tab covers the correction-request workflow (legacy Regularization,
 * `Docs/ATTENDANCE_LEGACY_PARITY.md` §5.2) end to end: the backend has had
 * `hr/attendance/corrections` endpoints since the module was built, but no UI
 * — this view and `MyAttendanceView` are what wire that up.
 */
export function AttendanceView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const canSelfService = usePermission(SELF_SERVICE_READ);
  const canReadCorrections = usePermission(CORRECTION_READ_ANY_SCOPE);
  const canApproveCorrections = usePermission(CORRECTION_APPROVE_ANY_SCOPE);
  const [tab, setTab] = useState<Tab>("records");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    from: startOfMonth(),
    to: today(),
    employeeId: "",
    status: "",
  });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceDayView | null>(null);

  const [correctionPage, setCorrectionPage] = useState(1);
  const [correctionStatus, setCorrectionStatus] = useState<
    "" | CorrectionStatus
  >("");
  const [decision, setDecision] = useState<Decision>(null);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    if (next.from && next.to) {
      const days =
        Math.round(
          (new Date(next.to).getTime() - new Date(next.from).getTime()) /
            86_400_000,
        ) + 1;
      setRangeError(
        next.from > next.to
          ? "`From` must not be after `to`."
          : days > MAX_RANGE_DAYS
            ? `The date range may not exceed ${MAX_RANGE_DAYS} days.`
            : null,
      );
    }
  }

  const employeeIdNum = Number(filters.employeeId);
  const query = {
    page,
    limit: PAGE_SIZE,
    from: filters.from,
    to: filters.to,
    ...(filters.employeeId &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0
      ? { employeeId: employeeIdNum }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const list = useAttendanceList(query);

  const correctionQuery = {
    page: correctionPage,
    limit: PAGE_SIZE,
    ...(correctionStatus ? { status: correctionStatus } : {}),
  };
  const corrections = useAttendanceCorrections(correctionQuery);

  if (!canRead && !canReadCorrections && !canApproveCorrections) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the <code>hr.attendance.read</code> permission.
      </Alert>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Attendance
        </h1>
        {tab === "records" && list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {list.data.meta.total} attendance records
          </p>
        ) : null}
        {tab === "corrections" && corrections.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {corrections.data.meta.total} correction requests
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canRead && (canReadCorrections || canApproveCorrections) ? (
          <>
            <Button
              variant={tab === "records" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("records")}
            >
              Records
            </Button>
            <Button
              variant={tab === "corrections" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("corrections")}
            >
              Corrections
            </Button>
          </>
        ) : null}
        {canSelfService ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/self-service/attendance")}
          >
            My attendance
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}

      {tab === "records" && canRead ? (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  aria-label="From date"
                  value={filters.from}
                  onChange={(e) => update("from", e.target.value)}
                />
                <Input
                  type="date"
                  aria-label="To date"
                  value={filters.to}
                  onChange={(e) => update("to", e.target.value)}
                />
              </div>
              <Input
                type="number"
                min="1"
                aria-label="Filter by employee id"
                placeholder="Employee ID"
                value={filters.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
              />
              <Select
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) =>
                  update("status", e.target.value as "" | StoredStatus)
                }
              >
                <option value="">All statuses</option>
                {STORED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {rangeError ? (
            <Alert variant="warning" title="Invalid date range">
              {rangeError}
            </Alert>
          ) : list.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            list.error instanceof ApiError && list.error.isPermissionError ? (
              <Alert
                variant="warning"
                title="You don't have access to attendance"
              >
                Your access to this list has changed. Contact an administrator.
              </Alert>
            ) : list.error instanceof ApiError &&
              list.error.errorCode === "RANGE_TOO_LARGE" ? (
              <Alert variant="warning" title="Date range too large">
                {list.error.message}
              </Alert>
            ) : (
              <ErrorState onRetry={() => void list.refetch()} />
            )
          ) : list.data.data.length === 0 ? (
            <Card>
              <EmptyState
                title="No attendance records match these filters"
                description="Try a different date range, employee or status."
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption="Attendance"
                rows={list.data.data}
                getRowKey={(r) =>
                  String(r.recordId ?? `${r.employeeId}-${r.attendanceDate}`)
                }
                columns={[
                  { header: "Employee", cell: (r) => `#${r.employeeId}` },
                  { header: "Date", cell: (r) => r.attendanceDate },
                  {
                    header: "Status",
                    cell: (r) => <AttendanceStatusBadge status={r.status} />,
                  },
                  {
                    header: "Worked",
                    cell: (r) =>
                      `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m`,
                  },
                  {
                    header: "Overtime",
                    cell: (r) =>
                      `${Math.floor(r.overtimeMinutes / 60)}h ${r.overtimeMinutes % 60}m`,
                  },
                  {
                    header: "Actions",
                    cell: (r) =>
                      r.recordId === null ? (
                        "—"
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailId(r.recordId as number)}
                        >
                          Details
                        </Button>
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
        </>
      ) : null}

      {tab === "corrections" ? (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select
                aria-label="Filter corrections by status"
                value={correctionStatus}
                onChange={(e) => {
                  setCorrectionStatus(e.target.value as "" | CorrectionStatus);
                  setCorrectionPage(1);
                }}
              >
                <option value="">All statuses</option>
                {CORRECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {corrections.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : corrections.isError ? (
            corrections.error instanceof ApiError &&
            corrections.error.isPermissionError ? (
              <Alert
                variant="warning"
                title="You don't have access to attendance corrections"
              >
                Your access to this list has changed. Contact an administrator.
              </Alert>
            ) : (
              <ErrorState onRetry={() => void corrections.refetch()} />
            )
          ) : corrections.data.data.length === 0 ? (
            <Card>
              <EmptyState
                title="No correction requests match these filters"
                description="Try a different status."
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption="Attendance corrections"
                rows={corrections.data.data}
                getRowKey={(c) => String(c.id)}
                columns={[
                  { header: "Employee", cell: (c) => c.employee.fullName },
                  { header: "Date", cell: (c) => c.attendanceDate },
                  {
                    header: "Type",
                    cell: (c) => CORRECTION_TYPE_LABELS[c.correctionType],
                  },
                  { header: "Reason", cell: (c) => c.reason },
                  {
                    header: "Status",
                    cell: (c) => <CorrectionStatusBadge status={c.status} />,
                  },
                  {
                    header: "Decided by",
                    cell: (c) => c.decidedBy?.fullName ?? "—",
                  },
                  ...(canApproveCorrections
                    ? [
                        {
                          header: "Actions",
                          cell: (c: AttendanceCorrection) =>
                            c.status === "SUBMITTED" ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setDecision({
                                      correction: c,
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
                                      correction: c,
                                      decision: "reject",
                                    })
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
                page={corrections.data.meta.page}
                totalPages={corrections.data.meta.totalPages}
                onPageChange={setCorrectionPage}
              />
            </>
          )}
        </>
      ) : null}

      {detailId !== null ? (
        <AttendanceDetailDialog
          open
          id={detailId}
          canEdit={canWrite}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const row = list.data?.data.find((r) => r.recordId === detailId);
            if (row) setEditRecord(row);
            setDetailId(null);
          }}
        />
      ) : null}

      {editRecord ? (
        <ManualEditAttendanceDialog
          open
          record={editRecord}
          onClose={() => setEditRecord(null)}
        />
      ) : null}

      {decision ? (
        <DecideCorrectionDialog
          open
          correction={decision.correction}
          decision={decision.decision}
          onClose={() => setDecision(null)}
        />
      ) : null}
    </div>
  );
}
