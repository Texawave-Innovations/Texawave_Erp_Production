"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  Timer,
  TrendingUp,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Pagination,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useCheckIn, useCheckOut, useMyAttendance } from "../hooks";
import { SELF_SERVICE_PUNCH, SELF_SERVICE_READ } from "../permissions";
import { formatMinutes, formatTime } from "../status";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";

const PAGE_SIZE = 20;

function today(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function startOfMonth(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA").format(
    new Date(d.getFullYear(), d.getMonth(), 1),
  );
}

function formatFriendlyToday(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
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

/** The authenticated user's own attendance: check in/out and see history. */
export function MyAttendanceView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canPunch = usePermission(SELF_SERVICE_PUNCH);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [punchError, setPunchError] = useState<string | null>(null);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { toast } = useToast();

  const list = useMyAttendance({ page, limit: PAGE_SIZE, from, to });

  const todayRow = list.data?.data.find((r) => r.attendanceDate === today());
  const checkedIn = todayRow?.hasOpenSession ?? false;

  const currentPunchTime = useMemo(() => {
    if (!todayRow || todayRow.sessions.length === 0) return null;
    const latest = todayRow.sessions[todayRow.sessions.length - 1];
    return latest ? formatTime(latest.checkInAt) : null;
  }, [todayRow]);

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (from && to && (from !== startOfMonth() || to !== today())) {
      chips.push({
        id: "date-range",
        label: "Range",
        value: `${from} to ${to}`,
        onRemove: () => {
          setFrom(startOfMonth());
          setTo(today());
          setPage(1);
        },
      });
    }
    return chips;
  }, [from, to]);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the{" "}
        <code>employee_self_service.attendance.read</code> permission.
      </Alert>
    );
  }

  async function handleCheckIn() {
    setPunchError(null);
    try {
      await checkIn.mutateAsync();
      toast({ title: "Checked in successfully", variant: "success" });
    } catch (error) {
      setPunchError(describePunchError(error));
    }
  }

  async function handleCheckOut() {
    setPunchError(null);
    try {
      await checkOut.mutateAsync();
      toast({ title: "Checked out successfully", variant: "success" });
    } catch (error) {
      setPunchError(describePunchError(error));
    }
  }

  const punching = checkIn.isPending || checkOut.isPending;

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div>
        <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
          My Attendance
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
          View your daily attendance history and punch sessions.
        </p>
      </div>

      {punchError ? (
        <Alert variant="error" title="Could not record punch">
          {punchError}
        </Alert>
      ) : null}

      {/* Hero Attendance Action Banner */}
      <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 bg-linear-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-900/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Status & Date */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              <Calendar className="h-4 w-4 text-brand-500" />
              <span>{formatFriendlyToday()}</span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`relative flex h-3 w-3 shrink-0 rounded-full ${
                  checkedIn ? "bg-emerald-500" : "bg-gray-400 dark:bg-gray-500"
                }`}
              >
                {checkedIn ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                ) : null}
              </span>
              <div>
                <h2 className="text-theme-lg font-bold text-gray-900 dark:text-white">
                  {checkedIn ? "Currently Checked In" : "Currently Checked Out"}
                </h2>
                {checkedIn && currentPunchTime ? (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Active session started at{" "}
                    <strong className="text-gray-800 dark:text-gray-200 font-mono">
                      {currentPunchTime}
                    </strong>
                  </p>
                ) : (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Ready to start your work session today.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Today's Working Summary Metrics (if row exists) */}
          {todayRow ? (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-brand-500" />
                  Worked Today
                </span>
                <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                  {formatMinutes(todayRow.workedMinutes)}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-purple-500" />
                  Overtime
                </span>
                <span className="text-theme-sm font-bold text-purple-700 dark:text-purple-400">
                  {formatMinutes(todayRow.overtimeMinutes)}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-gray-400" />
                  Status
                </span>
                <AttendanceStatusBadge status={todayRow.status} />
              </div>
            </div>
          ) : null}

          {/* Punch Buttons */}
          {canPunch ? (
            <div className="flex items-center gap-3 shrink-0">
              <Button
                size="md"
                onClick={handleCheckIn}
                disabled={punching || checkedIn}
                loading={checkIn.isPending}
                className="inline-flex items-center gap-2 shadow-xs"
              >
                <LogIn className="h-4 w-4" />
                Check in
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={handleCheckOut}
                disabled={punching || !checkedIn}
                loading={checkOut.isPending}
                className="inline-flex items-center gap-2 hover:border-error-300 hover:text-error-600 dark:hover:border-error-700 dark:hover:text-error-400"
              >
                <LogOut className="h-4 w-4" />
                Check out
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full md:w-96">
              <DateRangePicker
                value={{ from, to }}
                onChange={(r) => {
                  setFrom(r.from);
                  setTo(r.to);
                  setPage(1);
                }}
                onClear={() => {
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
                fromAriaLabel="From date"
                toAriaLabel="To date"
              />
            </div>
          </div>

          {activeChips.length > 0 ? (
            <FilterChips
              chips={activeChips}
              onClearAll={() => {
                setFrom(startOfMonth());
                setTo(today());
                setPage(1);
              }}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          ) : null}
        </div>
      </Card>

      {/* History Table States */}
      {list.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
      ) : list.isError ? (
        list.error instanceof ApiError &&
        list.error.errorCode === "NOT_AN_EMPLOYEE" ? (
          <Alert
            variant="warning"
            title="Administrator Account (Not an Employee)"
          >
            Your current account is an organization administrator and is not
            linked to an employee record. Personal attendance tracking is
            recorded by company employees.
          </Alert>
        ) : list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to attendance">
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
              {
                header: "Date",
                cell: (r) => (
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-theme-xs">
                    {r.attendanceDate}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (r) => <AttendanceStatusBadge status={r.status} />,
              },
              {
                header: "Check-in",
                cell: (r) => {
                  const first = r.sessions[0];
                  return (
                    <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                      {first ? formatTime(first.checkInAt) : "—"}
                    </span>
                  );
                },
              },
              {
                header: "Check-out",
                cell: (r) => {
                  const last = r.sessions[r.sessions.length - 1];
                  return (
                    <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                      {last?.checkOutAt ? (
                        formatTime(last.checkOutAt)
                      ) : r.hasOpenSession ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Open
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  );
                },
              },
              {
                header: "Worked",
                cell: (r) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {formatMinutes(r.workedMinutes)}
                  </span>
                ),
              },
              {
                header: "Overtime",
                cell: (r) =>
                  r.overtimeMinutes > 0 ? (
                    <span className="font-semibold text-purple-700 dark:text-purple-400 text-theme-xs">
                      +{formatMinutes(r.overtimeMinutes)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-theme-xs">
                      —
                    </span>
                  ),
              },
              {
                header: "Sessions",
                cell: (r) => (
                  <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                    {r.sessions.length}{" "}
                    {r.sessions.length === 1 ? "session" : "sessions"}
                  </span>
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
  );
}
