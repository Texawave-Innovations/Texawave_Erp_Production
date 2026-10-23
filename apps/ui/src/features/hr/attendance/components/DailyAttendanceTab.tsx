"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Pencil,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SearchInput,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useDailyReport } from "../hooks";
import { WRITE_ANY_SCOPE } from "../permissions";
import { formatMinutes, formatTime, STATUS_LABELS } from "../status";
import type { DailyAttendanceRow, EffectiveStatus } from "../types";
import { AttendanceDetailDialog } from "./AttendanceDetailDialog";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { DayTimeline } from "./DayTimeline";
import { ManualEditAttendanceDialog } from "./ManualEditAttendanceDialog";

const PAGE_SIZE = 100;

export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Bucket = "ALL" | "PRESENT" | "ABSENT" | "NOT_MARKED" | "AWAY";

const BUCKETS: {
  id: Bucket;
  label: string;
  matches: (s: EffectiveStatus) => boolean;
}[] = [
  { id: "ALL", label: "All", matches: () => true },
  {
    id: "PRESENT",
    label: "Present",
    matches: (s) => s === "PRESENT" || s === "HALF_DAY",
  },
  { id: "ABSENT", label: "Absent", matches: (s) => s === "ABSENT" },
  { id: "NOT_MARKED", label: "Not marked", matches: (s) => s === "NOT_MARKED" },
  {
    id: "AWAY",
    label: "Leave / off",
    matches: (s) => s === "ON_LEAVE" || s === "HOLIDAY" || s === "WEEKLY_OFF",
  },
];

/**
 * Daily roster: every employee in the caller's report scope for one date.
 * Features 4 Executive Presence KPI Tiles, integrated date & search toolbar,
 * and pure Nunito Sans typography (zero font-mono).
 */
export function DailyAttendanceTab() {
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date");
  const urlEmpId = searchParams.get("employeeId");

  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const [date, setDate] = useState(() => urlDate || todayIst());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [detail, setDetail] = useState<DailyAttendanceRow | null>(null);
  const [editing, setEditing] = useState<DailyAttendanceRow | null>(null);

  const [prevUrlDate, setPrevUrlDate] = useState(urlDate);
  if (urlDate && urlDate !== prevUrlDate) {
    setPrevUrlDate(urlDate);
    setDate(urlDate);
  }

  const report = useDailyReport({ date, page, limit: PAGE_SIZE });
  const rows = useMemo(() => report.data?.data ?? [], [report.data]);

  useEffect(() => {
    if (!urlEmpId || rows.length === 0) return;
    const eid = parseInt(urlEmpId, 10);
    if (isNaN(eid) || eid <= 0) return;
    const match = rows.find((r) => r.employee.id === eid);
    if (match) {
      const timer = setTimeout(() => {
        setDetail(match);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [urlEmpId, rows]);

  const counts = useMemo(() => {
    const out = Object.fromEntries(BUCKETS.map((b) => [b.id, 0])) as Record<
      Bucket,
      number
    >;
    for (const r of rows) {
      for (const b of BUCKETS) if (b.matches(r.status)) out[b.id] += 1;
    }
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matcher = BUCKETS.find((b) => b.id === bucket)!.matches;
    return rows.filter(
      (r) =>
        matcher(r.status) &&
        (needle === "" ||
          r.employee.fullName.toLowerCase().includes(needle) ||
          r.employee.employeeCode.toLowerCase().includes(needle)),
    );
  }, [rows, search, bucket]);

  function changeDate(next: string) {
    setDate(next);
    setPage(1);
  }

  const isToday = date === todayIst();
  const total = report.data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Executive Presence KPI Tiles */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Total Scheduled */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
              Scheduled Roster
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-[#0a3271] dark:text-white">
              {counts.ALL}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Total staff for date
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Present & Active */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Present & Active
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-white">
              {counts.PRESENT}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Punched in today
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center justify-between rounded-2xl border border-rose-200/80 bg-linear-to-r from-[#fff1f2] to-[#fff5f5] p-4 shadow-xs dark:border-rose-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Absent / Late
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-rose-800 dark:text-white">
              {counts.ABSENT}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              No punch recorded
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/80 bg-white text-rose-600 shadow-xs dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300">
            <UserX className="h-5 w-5" />
          </div>
        </div>

        {/* Leave / Off */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fefce8] p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              On Leave / Off
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
              {counts.AWAY}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Leaves, off & holidays
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. Executive Date & Filter Toolbar */}
      <div className="relative z-20 focus-within:z-30 flex flex-col gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Date Navigator */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Previous day"
              onClick={() => changeDate(shiftDate(date, -1))}
              className="h-10 rounded-xl px-2.5 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              aria-label="Roster date"
              value={date}
              max={todayIst()}
              onChange={(e) => e.target.value && changeDate(e.target.value)}
              className="h-10 w-44 rounded-xl text-xs font-semibold"
            >
              {null}
            </Input>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => changeDate(shiftDate(date, 1))}
              className="h-10 rounded-xl px-2.5 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => changeDate(todayIst())}
                className="h-10 rounded-xl px-3 text-xs font-semibold text-brand-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
              >
                Today
              </Button>
            ) : null}
          </div>

          {/* Search Box */}
          <div className="w-full lg:w-80">
            <SearchInput
              aria-label="Search by name or code"
              placeholder="Search by name or employee code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              clearable
            />
          </div>
        </div>

        {/* Filter Badges Group */}
        <div
          className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
          role="group"
          aria-label="Filter by status"
        >
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={bucket === b.id}
              onClick={() => setBucket(b.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                bucket === b.id
                  ? "border-sky-300 bg-sky-50 text-[#0284c7] shadow-2xs dark:border-sky-700 dark:bg-sky-950/80 dark:text-sky-200"
                  : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <span>{b.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                  bucket === b.id
                    ? "bg-[#0284c7] text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {counts[b.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Data Content */}
      {report.isPending ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <TableSkeleton rowsCount={8} columnsCount={7} />
        </div>
      ) : report.isError ? (
        report.error instanceof ApiError && report.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to the daily roster"
            className="rounded-2xl"
          >
            Ask an administrator for the <code>hr.attendance_report.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void report.refetch()} />
        )
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={
              rows.length === 0
                ? "No employees rostered for this date"
                : "No employees match these filters"
            }
            description={
              rows.length === 0
                ? "There are no employee schedules active for this date."
                : "Try adjusting your search criteria or selecting a different status filter."
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              caption={`Daily roster for ${date}`}
              rows={visible}
              getRowKey={(r) => String(r.employee.id)}
              columns={[
                {
                  header: "Employee",
                  cell: (r) => (
                    <div className="flex items-center gap-2">
                      <EmployeeIdentity
                        name={r.employee.fullName}
                        code={r.employee.employeeCode}
                        avatarSize="sm"
                        size="sm"
                      />
                      {urlEmpId && Number(urlEmpId) === r.employee.id && (
                        <span className="rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-cyan-300 text-[9px] font-bold px-1.5 py-0.2 border border-brand-300/60 dark:border-brand-700">
                          Selected
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => <AttendanceStatusBadge status={r.status} />,
                },
                {
                  header: "Check-in",
                  cell: (r) => (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {r.sessions[0]
                        ? formatTime(r.sessions[0].checkInAt)
                        : "—"}
                    </span>
                  ),
                },
                {
                  header: "Check-out",
                  cell: (r) => {
                    const last = r.sessions[r.sessions.length - 1];
                    return (
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {r.hasOpenSession ? (
                          <span className="font-bold text-brand-500 dark:text-sky-300">
                            Working
                          </span>
                        ) : last?.checkOutAt ? (
                          formatTime(last.checkOutAt)
                        ) : (
                          "—"
                        )}
                      </span>
                    );
                  },
                },
                {
                  header: "9 AM – 9 PM",
                  cell: (r) => (
                    <DayTimeline sessions={r.sessions} className="w-40" />
                  ),
                },
                {
                  header: "Worked",
                  cell: (r) => (
                    <span className="text-xs font-semibold">
                      <span className="text-slate-900 dark:text-white">
                        {formatMinutes(r.workedMinutes)}
                      </span>
                      {r.overtimeMinutes > 0 ? (
                        <span className="ml-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatMinutes(r.overtimeMinutes)}
                        </span>
                      ) : r.shortfallMinutes > 0 &&
                        r.status === "PRESENT" &&
                        !r.hasOpenSession ? (
                        <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                          −{formatMinutes(r.shortfallMinutes)}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) =>
                    r.recordId === null ? (
                      <span
                        className="text-xs font-medium text-slate-400"
                        title="No record for this day yet"
                      >
                        {STATUS_LABELS[r.status] === "Not Marked"
                          ? "No record"
                          : "—"}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetail(r)}
                          disabled={r.sessions.length === 0}
                          title={
                            r.sessions.length === 0
                              ? "No punches to display"
                              : "View punches and timeline"
                          }
                          className="h-8 gap-1 rounded-lg px-2 text-xs font-semibold text-brand-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </Button>
                        {canWrite ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(r)}
                            title="Edit this day's attendance record"
                            className="h-8 gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </Button>
                        ) : null}
                      </div>
                    ),
                },
              ]}
            />
          </div>

          {report.data && report.data.meta.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={report.data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* 4. Modals */}
      {detail !== null && detail.recordId !== null ? (
        <AttendanceDetailDialog
          open
          id={detail.recordId}
          canEdit={canWrite}
          employee={detail.employee}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
        />
      ) : null}
      {editing !== null && editing.recordId !== null ? (
        <ManualEditAttendanceDialog
          open
          record={editing}
          employee={editing.employee}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
