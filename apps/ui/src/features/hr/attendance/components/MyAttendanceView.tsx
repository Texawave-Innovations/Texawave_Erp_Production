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
  useAttendanceCorrections,
  useCheckIn,
  useCheckOut,
  useMyAttendance,
} from "../hooks";
import {
  CORRECTION_READ_ANY_SCOPE,
  SELF_SERVICE_CORRECTION_CREATE,
  SELF_SERVICE_PUNCH,
  SELF_SERVICE_READ,
} from "../permissions";
import { CORRECTION_TYPE_LABELS, formatMinutes } from "../status";
import { CORRECTION_STATUSES, type CorrectionStatus } from "../types";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { CorrectionStatusBadge } from "./CorrectionStatusBadge";
import { SubmitCorrectionDialog } from "./SubmitCorrectionDialog";

const PAGE_SIZE = 20;
type Tab = "history" | "corrections";

function today(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function startOfMonth(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA").format(
    new Date(d.getFullYear(), d.getMonth(), 1),
  );
}

function describePunchError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "ALREADY_CHECKED_IN") {
      return "You are already checked in.";
    }
    if (error.errorCode === "NOT_CHECKED_IN") {
      return "You are not checked in.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to punch attendance.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** The authenticated user's own attendance: check in/out, see history, and
 * request a correction for a past day (legacy Regularization,
 * `Docs/ATTENDANCE_LEGACY_PARITY.md` §5.2). An employee's own corrections are
 * the `.own` scope of the same `hr/attendance/corrections` list the HR screen
 * uses — there is no separate self-service list endpoint. */
export function MyAttendanceView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canPunch = usePermission(SELF_SERVICE_PUNCH);
  const canRequestCorrection = usePermission(SELF_SERVICE_CORRECTION_CREATE);
  const canReadCorrections = usePermission(CORRECTION_READ_ANY_SCOPE);
  const [tab, setTab] = useState<Tab>("history");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [punchError, setPunchError] = useState<string | null>(null);
  const [submitCorrectionOpen, setSubmitCorrectionOpen] = useState(false);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { toast } = useToast();

  const list = useMyAttendance({ page, limit: PAGE_SIZE, from, to });

  const [correctionPage, setCorrectionPage] = useState(1);
  const [correctionStatus, setCorrectionStatus] = useState<
    "" | CorrectionStatus
  >("");
  const corrections = useAttendanceCorrections({
    page: correctionPage,
    limit: PAGE_SIZE,
    ...(correctionStatus ? { status: correctionStatus } : {}),
  });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the{" "}
        <code>employee_self_service.attendance.read</code> permission.
      </Alert>
    );
  }

  const todayRow = list.data?.data.find((r) => r.attendanceDate === today());
  const checkedIn = todayRow?.hasOpenSession ?? false;

  async function handleCheckIn() {
    setPunchError(null);
    try {
      await checkIn.mutateAsync();
      toast({ title: "Checked in", variant: "success" });
    } catch (error) {
      setPunchError(describePunchError(error));
    }
  }

  async function handleCheckOut() {
    setPunchError(null);
    try {
      await checkOut.mutateAsync();
      toast({ title: "Checked out", variant: "success" });
    } catch (error) {
      setPunchError(describePunchError(error));
    }
  }

  const punching = checkIn.isPending || checkOut.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          My Attendance
        </h1>
        <div className="flex flex-wrap gap-2">
          {canReadCorrections ? (
            <>
              <Button
                variant={tab === "history" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTab("history")}
              >
                History
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
          {canPunch ? (
            <>
              <Button
                onClick={handleCheckIn}
                disabled={punching || checkedIn}
                loading={checkIn.isPending}
              >
                Check in
              </Button>
              <Button
                variant="secondary"
                onClick={handleCheckOut}
                disabled={punching || !checkedIn}
                loading={checkOut.isPending}
              >
                Check out
              </Button>
            </>
          ) : null}
          {canRequestCorrection ? (
            <Button
              variant="ghost"
              onClick={() => setSubmitCorrectionOpen(true)}
            >
              Request correction
            </Button>
          ) : null}
        </div>
      </div>

      {punchError ? (
        <Alert variant="error" title="Could not punch">
          {punchError}
        </Alert>
      ) : null}

      {tab === "history" ? (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-2 md:w-1/2">
              <Input
                type="date"
                aria-label="From date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                type="date"
                aria-label="To date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
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
                title="You don't have access to attendance"
              >
                Your access to this list has changed. Contact an administrator.
              </Alert>
            ) : (
              <ErrorState onRetry={() => void list.refetch()} />
            )
          ) : list.data.data.length === 0 ? (
            <Card>
              <EmptyState
                title="No attendance yet"
                description="Your attendance history will appear here once you check in."
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption="My attendance"
                rows={list.data.data}
                getRowKey={(r) => String(r.recordId ?? r.attendanceDate)}
                columns={[
                  { header: "Date", cell: (r) => r.attendanceDate },
                  {
                    header: "Status",
                    cell: (r) => <AttendanceStatusBadge status={r.status} />,
                  },
                  {
                    header: "Worked",
                    cell: (r) => formatMinutes(r.workedMinutes),
                  },
                  {
                    header: "Overtime",
                    cell: (r) => formatMinutes(r.overtimeMinutes),
                  },
                  {
                    header: "Open session",
                    cell: (r) => (r.hasOpenSession ? "Yes" : "No"),
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
                aria-label="Filter my corrections by status"
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
                title="No correction requests yet"
                description={
                  canRequestCorrection
                    ? "Request a correction for a past day to see it here."
                    : "Your correction requests will appear here."
                }
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption="My corrections"
                rows={corrections.data.data}
                getRowKey={(c) => String(c.id)}
                columns={[
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
                  { header: "Note", cell: (c) => c.decisionNote ?? "—" },
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

      {submitCorrectionOpen ? (
        <SubmitCorrectionDialog
          open
          onClose={() => setSubmitCorrectionOpen(false)}
        />
      ) : null}
    </div>
  );
}
