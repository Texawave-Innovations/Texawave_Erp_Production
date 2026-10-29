"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  FileText,
  List,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  Alert,
  Button,
  DatePicker,
  ErrorState,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { useMyAttendance } from "@/features/hr/attendance/hooks";
import { SELF_SERVICE_READ } from "@/features/hr/attendance/permissions";
import type { AttendanceDayView } from "@/features/hr/attendance/types";
import { useHolidays } from "@/features/hr/holidays/hooks";
import { READ as HOLIDAY_READ } from "@/features/hr/holidays/permissions";
import { useMyLeaveRequests } from "@/features/hr/leaves/hooks";
import { useCorrections } from "@/features/hr/regularization/hooks";
import {
  READ_ANY_SCOPE as CORRECTION_READ,
  SELF_SERVICE_CREATE as CORRECTION_CREATE,
} from "@/features/hr/regularization/permissions";
import { CORRECTION_TYPE_LABELS } from "@/features/hr/regularization/status";
import { SubmitCorrectionDialog } from "@/features/hr/regularization/components/SubmitCorrectionDialog";
import { useTodayAttendance } from "@/features/employee-self-service/dashboard/useTodayAttendance";
import {
  DAY_TYPE_STYLE,
  TL_LABELS,
  classifyDay,
  dayTypeOf,
  hourLabel,
  hourPct,
  isoDate,
  lateBy,
  msToHM,
  time12,
  workedMs,
  type DayKind,
} from "../attendance-utils";
import { DayDetailPanel } from "./DayDetailPanel";
import { TimelineBar } from "./TimelineBar";

type ViewMode = "daily" | "week" | "month";
type StatusFilter = "all" | "Present" | "Absent" | "Leave" | "Holiday";
type Tab = "summary" | "regularization";

function passesFilter(kind: DayKind, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "Present") return kind === "present" || kind === "half";
  if (filter === "Absent") return kind === "absent";
  if (filter === "Leave") return kind === "leave";
  return kind === "holiday";
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand-500 active:scale-95 ${
        active
          ? "scale-[1.03] bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan text-white shadow-md"
          : "text-slate-600 hover:bg-white hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function offLine(label: string, line: string, pill: string) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className={`h-px flex-1 ${line}`} />
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${pill}`}
      >
        {label}
      </span>
      <div className={`h-px flex-1 ${line}`} />
    </div>
  );
}

/**
 * "My Attendance", laid out like the legacy tracker (TexaWave_ERP_old
 * src/modules/employee/MyAttendance.tsx): Attendance Summary / Regularization
 * tabs; a status filter and Daily / Week / Month switch; a week/month
 * navigator with a date jump and Today; the shift bar with the live
 * Check in / Check out button; this week's OT summary; one row per day with
 * a punch timeline (or the month calendar grid); a day detail side panel;
 * and the Days / Hours stats bar with payable days.
 *
 * Every figure comes from the self-service attendance API
 * (/hr/attendance/mine, check-in, check-out); days with no record are
 * labelled from the holiday calendar and approved leave the employee can
 * read. Regularization uses the attendance-correction API.
 */
export function MyAttendanceTrackerView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canReadHolidays = usePermission(HOLIDAY_READ);
  const canReadCorrections = usePermission(CORRECTION_READ);
  const canRequestCorrection = usePermission(CORRECTION_CREATE);
  const employee = useMyEmployee();
  const live = useTodayAttendance();

  const [tab, setTab] = useState<Tab>("summary");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [displayMode, setDisplayMode] = useState<"days" | "hours">("days");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [regOpen, setRegOpen] = useState(false);
  const [regDate, setRegDate] = useState<string | undefined>(undefined);
  const [regKey, setRegKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = isoDate(new Date());
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const rangeStart = viewMode === "month" ? monthStart : weekStart;
  const rangeEnd = viewMode === "month" ? monthEnd : weekEnd;
  const from = isoDate(rangeStart);
  const to = isoDate(rangeEnd);

  const attendance = useMyAttendance(
    { page: 1, limit: 100, from, to },
    canRead,
  );
  const holidaysQuery = useHolidays(
    { page: 1, limit: 100, from, to, isActive: true },
    canReadHolidays,
  );
  const leavesQuery = useMyLeaveRequests({
    page: 1,
    limit: 100,
    status: "APPROVED",
    from,
    to,
  });
  const corrections = useCorrections(
    { page: 1, limit: 100 },
    canReadCorrections,
  );

  const rows = useMemo(() => {
    const map = new Map<string, AttendanceDayView>();
    for (const r of attendance.data?.data ?? []) map.set(r.attendanceDate, r);
    return map;
  }, [attendance.data]);

  const myLocationId = employee.data?.workLocation?.id ?? null;
  const holidays = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of holidaysQuery.data?.data ?? []) {
      if (h.workLocation === null || h.workLocation.id === myLocationId) {
        map.set(h.holidayDate, h.name);
      }
    }
    return map;
  }, [holidaysQuery.data, myLocationId]);

  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    for (const l of leavesQuery.data?.data ?? []) {
      for (
        let d = new Date(`${l.startDate}T00:00:00`);
        isoDate(d) <= l.endDate;
        d = addDays(d, 1)
      ) {
        set.add(isoDate(d));
      }
    }
    return set;
  }, [leavesQuery.data]);

  const requests = useMemo(
    () =>
      [...(corrections.data?.data ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [corrections.data],
  );
  const requestedDates = new Set(requests.map((r) => r.attendanceDate));
  const pendingCount = requests.filter((r) => r.status === "SUBMITTED").length;

  const ctx = { today, holidays, leaveDays };
  const kindOf = (ds: string) => classifyDay(ds, rows.get(ds) ?? null, ctx);

  const visibleDays =
    viewMode === "daily"
      ? [anchor]
      : eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Bottom stats bar (legacy: Full / Half / Short by hours worked, Leave,
  // Weekend; payable = full + half × 0.5).
  let fullDays = 0;
  let halfDays = 0;
  let shortDays = 0;
  let leaveCount = 0;
  let weekends = 0;
  let totalMs = 0;
  for (const d of visibleDays) {
    const ds = isoDate(d);
    const kind = kindOf(ds);
    const row = rows.get(ds) ?? null;
    const ms = workedMs(row, now);
    totalMs += ms;
    if (kind === "weekend" || kind === "weekoff") {
      weekends++;
      continue;
    }
    if (kind === "holiday") continue;
    if (kind === "leave") {
      leaveCount++;
      continue;
    }
    if (kind === "half") {
      halfDays++;
      continue;
    }
    if (kind === "present") {
      const type = dayTypeOf(ms);
      if (type === "Full Day") fullDays++;
      else if (type === "Half Day") halfDays++;
      else if (type === "Short") shortDays++;
    }
  }
  const payableDays = fullDays + halfDays * 0.5;

  // This week's OT summary (API overtime / shortfall minutes).
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekRows = weekDays.map((d) => rows.get(isoDate(d)) ?? null);
  const otMin = weekRows.reduce((s, r) => s + (r?.overtimeMinutes ?? 0), 0);
  const shortMin = weekRows.reduce((s, r) => s + (r?.shortfallMinutes ?? 0), 0);
  const netMin = otMin - shortMin;
  const signed = (m: number) =>
    `${m >= 0 ? "+" : "-"}${msToHM(Math.abs(m) * 60000)}`;

  function prev() {
    setAnchor((a) => (viewMode === "month" ? subMonths(a, 1) : subWeeks(a, 1)));
  }
  function next() {
    setAnchor((a) => (viewMode === "month" ? addMonths(a, 1) : addWeeks(a, 1)));
  }
  function openRegularize(date?: string) {
    setRegDate(date);
    setRegKey((k) => k + 1);
    setRegOpen(true);
  }

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the{" "}
        <code>employee_self_service.attendance.read</code> permission.
      </Alert>
    );
  }

  const rangeLabel =
    viewMode === "month"
      ? format(anchor, "MMMM yyyy")
      : `${format(weekStart, "dd MMM yyyy")} – ${format(weekEnd, "dd MMM yyyy")}`;

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h1 className="sr-only">My Attendance</h1>

      {/* Tabs & view mode header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 pb-2 pt-3 dark:border-gray-800">
        <div className="flex items-center gap-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "summary"}
            onClick={() => setTab("summary")}
            className={`-mb-px pb-2.5 text-sm transition-colors ${
              tab === "summary"
                ? "border-b-2 border-brand-500 font-semibold text-brand-600"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Attendance Summary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "regularization"}
            onClick={() => setTab("regularization")}
            className={`-mb-px flex items-center gap-1.5 pb-2.5 text-sm transition-colors ${
              tab === "regularization"
                ? "border-b-2 border-brand-500 font-semibold text-brand-600"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Regularization
            {pendingCount > 0 ? (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold tabular-nums text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
        </div>

        {tab === "summary" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-8 w-32 text-xs font-semibold"
            >
              <option value="all">All Status</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Holiday">Holiday</option>
            </Select>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
              <SegButton
                active={viewMode === "daily"}
                onClick={() => setViewMode("daily")}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" /> Daily
              </SegButton>
              <SegButton
                active={viewMode === "week"}
                onClick={() => setViewMode("week")}
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Week
              </SegButton>
              <SegButton
                active={viewMode === "month"}
                onClick={() => setViewMode("month")}
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Month
              </SegButton>
            </div>
          </div>
        ) : null}
      </div>

      {/* Regularization tab */}
      {tab === "regularization" ? (
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                My Regularization Requests
              </h2>
              <p className="text-xs text-gray-500">
                Raise a request for missed or incorrect attendance entries
              </p>
            </div>
            {canRequestCorrection ? (
              <Button size="sm" onClick={() => openRegularize()}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Raise Request
              </Button>
            ) : null}
          </div>
          {!canReadCorrections ? (
            <p className="py-16 text-center text-sm text-gray-500">
              Your role cannot list correction requests.
            </p>
          ) : corrections.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : corrections.isError ? (
            <ErrorState onRetry={() => void corrections.refetch()} />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
              <FileText className="h-8 w-8 opacity-30" aria-hidden="true" />
              <p className="text-sm">No regularization requests yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/40"
                >
                  <span className="mt-0.5 shrink-0">
                    {req.status === "APPROVED" ? (
                      <CircleCheck
                        className="h-4 w-4 text-green-500"
                        aria-hidden="true"
                      />
                    ) : req.status === "REJECTED" ? (
                      <CircleX
                        className="h-4 w-4 text-red-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleAlert
                        className="h-4 w-4 text-amber-500"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {format(
                          new Date(`${req.attendanceDate}T00:00:00`),
                          "dd MMM yyyy",
                        )}
                      </span>
                      <span className="rounded border border-gray-300 px-1.5 text-[10px] dark:border-gray-700">
                        {CORRECTION_TYPE_LABELS[req.correctionType]}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          req.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : req.status === "REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {req.status === "SUBMITTED"
                          ? "Pending"
                          : req.status === "APPROVED"
                            ? "Approved"
                            : "Rejected"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{req.reason}</p>
                    {req.requestedCheckInAt || req.requestedCheckOutAt ? (
                      <p className="mt-0.5 text-xs text-blue-600">
                        {req.requestedCheckInAt
                          ? `In: ${time12(req.requestedCheckInAt)}`
                          : ""}
                        {req.requestedCheckInAt && req.requestedCheckOutAt
                          ? "  •  "
                          : ""}
                        {req.requestedCheckOutAt
                          ? `Out: ${time12(req.requestedCheckOutAt)}`
                          : ""}
                      </p>
                    ) : null}
                    {req.decidedBy ? (
                      <p className="mt-1 text-[10px] text-gray-500">
                        Reviewed by {req.decidedBy.fullName}
                        {req.decisionNote ? ` — "${req.decisionNote}"` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] text-gray-500">
                    {format(new Date(req.createdAt), "dd MMM, hh:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "summary" ? (
        <>
          {/* Navigator */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50/60 px-5 py-2 dark:border-gray-800 dark:bg-gray-800/30">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-brand-200 bg-white p-1 shadow-2xs dark:border-brand-900 dark:bg-gray-900">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label={
                    viewMode === "month" ? "Previous month" : "Previous week"
                  }
                  onClick={prev}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-200/60 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {rangeLabel}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label={viewMode === "month" ? "Next month" : "Next week"}
                  onClick={next}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-bold"
                onClick={() => setAnchor(new Date())}
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Today
              </Button>
              <div className="w-40">
                <DatePicker
                  aria-label="Jump to date"
                  value={isoDate(anchor)}
                  onChange={(e) => {
                    if (e.target.value)
                      setAnchor(new Date(`${e.target.value}T00:00:00`));
                  }}
                />
              </div>
            </div>
            {live.checkingIn || live.checkingOut ? (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                Saving...
              </span>
            ) : null}
          </div>

          {/* Shift bar + Check In/Out */}
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-2.5 dark:border-gray-800 dark:bg-gray-800/30">
            <span className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              General [ 10:00 AM – 7:00 PM ]
            </span>
            <span className="flex-1" />
            {live.canPunch ? (
              <Button
                size="sm"
                variant={live.isCheckedIn ? "ghost" : "primary"}
                loading={live.checkingIn || live.checkingOut}
                onClick={() =>
                  void (live.isCheckedIn
                    ? live.handleCheckOut()
                    : live.handleCheckIn())
                }
                className={`shrink-0 whitespace-nowrap text-xs font-semibold ${
                  live.isCheckedIn
                    ? "bg-amber-500 text-white hover:bg-amber-600 dark:text-white"
                    : ""
                }`}
              >
                {live.isCheckedIn ? (
                  <>
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Check Out&nbsp;
                    <span className="font-mono">{live.totalElapsed}</span>
                    &nbsp;Hrs
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                    Check in&nbsp;
                    <span className="font-mono">{live.totalElapsed}</span>
                    &nbsp;Hrs
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {/* This week's OT summary */}
          <div className="px-5 pt-4">
            <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200/70 bg-linear-to-r from-brand-50/70 via-white to-sky-50/60 p-3 dark:border-brand-900/60 dark:from-brand-950/30 dark:via-gray-900 dark:to-gray-900">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="rounded-lg bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan p-2 text-white shadow-xs">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    This Week&apos;s OT Summary
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    OT {signed(otMin)} · Shortfall {signed(-shortMin)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weekDays.map((d) => {
                  const r = rows.get(isoDate(d));
                  const ot = r?.overtimeMinutes ?? 0;
                  const sf = r?.shortfallMinutes ?? 0;
                  return (
                    <span
                      key={isoDate(d)}
                      title={`${format(d, "EEE dd MMM")}: ${ot > 0 ? `+${msToHM(ot * 60000)} OT` : sf > 0 ? `-${msToHM(sf * 60000)} shortfall` : "—"}`}
                      className={`hidden rounded-lg border px-1.5 py-0.5 text-[10px] font-bold md:inline ${
                        ot > 0
                          ? "border-brand-200 bg-brand-50 text-brand-700"
                          : sf > 0
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900"
                      }`}
                    >
                      {format(d, "EEE")}
                    </span>
                  );
                })}
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-2xs ${
                    netMin >= 0
                      ? "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan"
                      : "bg-amber-600"
                  }`}
                >
                  Net {signed(netMin)}
                </span>
              </div>
            </div>
          </div>

          {attendance.isPending ? (
            <div className="space-y-2 px-5 pb-5">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : attendance.isError ? (
            <div className="p-5">
              <ErrorState onRetry={() => void attendance.refetch()} />
            </div>
          ) : viewMode === "month" ? (
            /* Month view */
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {(() => {
                let present = 0;
                let absent = 0;
                let leaveHoli = 0;
                let monthMs = 0;
                for (const d of visibleDays) {
                  const ds = isoDate(d);
                  const k = kindOf(ds);
                  monthMs += workedMs(rows.get(ds) ?? null, now);
                  if (k === "present" || k === "half") present++;
                  else if (k === "absent") absent++;
                  else if (k === "leave" || k === "holiday") leaveHoli++;
                }
                const tiles = [
                  {
                    label: "Total Worked Hours",
                    value: monthMs > 0 ? msToHM(monthMs) : "0h 00m",
                    cls: "border-brand-200 bg-brand-50/60 text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-300",
                  },
                  {
                    label: "Present Days",
                    value: `${present} Days`,
                    cls: "border-brand-200 bg-brand-50/60 text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-300",
                  },
                  {
                    label: "Absent Days",
                    value: `${absent} Days`,
                    cls: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
                  },
                  {
                    label: "Leave / Holidays",
                    value: `${leaveHoli} Days`,
                    cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
                  },
                ];
                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {tiles.map((t) => (
                      <div
                        key={t.label}
                        className={`rounded-xl border p-3 ${t.cls}`}
                      >
                        <p className="text-[10px] font-semibold opacity-80">
                          {t.label}
                        </p>
                        <p className="mt-0.5 text-lg font-extrabold">
                          {t.value}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="grid grid-cols-7 gap-2 pt-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((h) => (
                  <div
                    key={h}
                    className="py-1 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </div>
                ))}
                {Array.from({
                  length: (monthStart.getDay() + 6) % 7,
                }).map((_, i) => (
                  <div
                    key={`pad-${i}`}
                    className="pointer-events-none min-h-[72px] rounded-xl border border-slate-100 bg-slate-50/40 dark:border-gray-800 dark:bg-gray-900/40"
                  />
                ))}
                {visibleDays.map((day) => {
                  const ds = isoDate(day);
                  const kind = kindOf(ds);
                  const row = rows.get(ds) ?? null;
                  const ms = workedMs(row, now);
                  const isToday = ds === today;
                  if (!passesFilter(kind, statusFilter)) {
                    return <div key={ds} className="min-h-[72px]" />;
                  }
                  const tone = isToday
                    ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50/60 dark:bg-brand-950/30"
                    : kind === "holiday"
                      ? "bg-purple-50/60 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900"
                      : kind === "leave"
                        ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                        : kind === "weekoff" || kind === "weekend"
                          ? "bg-gray-50/60 border-gray-200 dark:bg-gray-800/40 dark:border-gray-700"
                          : kind === "present" || kind === "half"
                            ? "bg-brand-50/30 border-brand-200/60 dark:border-brand-900"
                            : kind === "absent"
                              ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                              : "bg-white border-gray-200 hover:bg-slate-50 dark:bg-gray-900 dark:border-gray-800";
                  const tag: Partial<Record<DayKind, [string, string]>> = {
                    holiday: ["Holi", "text-purple-600 bg-purple-100"],
                    leave: ["Leave", "text-amber-600 bg-amber-100"],
                    weekoff: ["WO", "text-gray-600 bg-gray-100"],
                    present: ["P", "text-brand-700 bg-brand-100"],
                    half: ["HD", "text-amber-700 bg-amber-100"],
                    absent: ["A", "text-red-600 bg-red-100"],
                  };
                  const t = tag[kind];
                  return (
                    <button
                      key={ds}
                      type="button"
                      onClick={() => setSelectedDay(ds)}
                      className={`flex min-h-[72px] flex-col justify-between rounded-xl border p-2 text-left transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500 ${tone}`}
                    >
                      <span className="flex items-center justify-between">
                        <span
                          className={`text-sm font-bold ${isToday ? "text-brand-600" : "text-gray-900 dark:text-white"}`}
                        >
                          {day.getDate()}
                        </span>
                        {t ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t[1]}`}
                          >
                            {t[0]}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`mt-1 text-[10px] font-medium tabular-nums ${ms > 0 ? "text-gray-900 dark:text-white" : "text-gray-300"}`}
                      >
                        {ms > 0
                          ? displayMode === "hours"
                            ? `${(ms / 3_600_000).toFixed(1)}h`
                            : msToHM(ms)
                          : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Week / daily rows */
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visibleDays.map((day) => {
                const ds = isoDate(day);
                const kind = kindOf(ds);
                if (!passesFilter(kind, statusFilter)) return null;
                const row = rows.get(ds) ?? null;
                const isWknd = kind === "weekend";
                const isOff =
                  kind === "holiday" || kind === "leave" || kind === "weekoff";
                const isToday = ds === today;
                const sessions = row?.sessions ?? [];
                const ms = workedMs(row, now);
                const firstIn = sessions[0];
                const lastClosed = [...sessions]
                  .reverse()
                  .find((s) => s.checkOutAt);
                const hasActive = row?.hasOpenSession ?? false;
                const regularized = sessions.some(
                  (s) => s.source === "CORRECTION" || s.source === "HR",
                );
                const late = lateBy(row);
                const ot = row?.overtimeMinutes ?? 0;
                const dayType =
                  kind === "half"
                    ? ("Half Day" as const)
                    : kind === "present"
                      ? dayTypeOf(ms)
                      : null;
                const clickable = !isWknd && !isOff;
                const canRegularize =
                  canRequestCorrection && clickable && ds < today;
                const requested = requestedDates.has(ds);
                return (
                  <div
                    key={ds}
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={clickable ? `Details for ${ds}` : undefined}
                    onClick={() => clickable && setSelectedDay(ds)}
                    onKeyDown={(e) => {
                      if (clickable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setSelectedDay(ds);
                      }
                    }}
                    className={`group flex items-stretch border-b border-gray-100 transition-colors dark:border-gray-800 ${
                      isWknd
                        ? "cursor-default bg-gray-50/70 dark:bg-gray-800/30"
                        : kind === "holiday"
                          ? "cursor-default bg-purple-50/60 dark:bg-purple-950/20"
                          : kind === "leave"
                            ? "cursor-default bg-amber-50/60 dark:bg-amber-950/20"
                            : kind === "weekoff"
                              ? "cursor-default bg-gray-50/60 dark:bg-gray-800/30"
                              : "cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-950/20"
                    } ${isToday && !isWknd ? "bg-brand-50/60 dark:bg-brand-950/30" : ""}`}
                  >
                    {/* Day label */}
                    <div
                      className={`flex w-16 shrink-0 flex-col items-center justify-center py-3.5 ${isWknd ? "opacity-40" : ""}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        {isToday && !isWknd ? "Today" : format(day, "EEE")}
                      </span>
                      <span
                        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          isToday && !isWknd
                            ? "bg-brand-500 text-white"
                            : kind === "holiday"
                              ? "bg-purple-100 text-purple-700"
                              : kind === "leave"
                                ? "bg-amber-100 text-amber-700"
                                : kind === "weekoff"
                                  ? "bg-gray-200 text-gray-600"
                                  : kind === "absent"
                                    ? "bg-red-100 text-red-700"
                                    : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Check-in info */}
                    <div className="flex w-28 shrink-0 flex-col justify-center px-1 py-3">
                      {kind === "holiday" ? (
                        <span className="text-[10px] font-semibold text-purple-600">
                          🎉 Holiday
                        </span>
                      ) : kind === "leave" ? (
                        <span className="text-[10px] font-semibold text-amber-600">
                          🌴 On Leave
                        </span>
                      ) : kind === "weekoff" ? (
                        <span className="text-[10px] font-semibold text-gray-500">
                          🛌 Week Off
                        </span>
                      ) : kind === "absent" ? (
                        <span className="text-[10px] font-semibold text-red-600">
                          ❌ Absent
                        </span>
                      ) : !isWknd && firstIn ? (
                        <>
                          <span
                            className={`text-[10px] font-semibold ${regularized ? "text-sky-600" : "text-green-600"}`}
                          >
                            {regularized ? "Regularized In" : "Office In"}
                          </span>
                          <span
                            className={`text-xs font-bold leading-tight ${regularized ? "text-sky-600" : "text-gray-900 dark:text-white"}`}
                          >
                            {time12(firstIn.checkInAt)}
                          </span>
                          {late ? (
                            <span className="text-[10px] font-semibold text-amber-500">
                              Late by {late}
                            </span>
                          ) : null}
                        </>
                      ) : !isWknd ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <span className="text-center text-xs text-gray-300">
                          Weekend
                        </span>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="flex min-w-0 flex-1 items-center px-2 py-3">
                      {kind === "holiday" ? (
                        offLine(
                          holidays.get(ds) ?? "Holiday",
                          "bg-purple-200",
                          "border-purple-200 bg-purple-100 text-purple-500",
                        )
                      ) : kind === "leave" ? (
                        offLine(
                          "Approved Leave",
                          "bg-amber-200",
                          "border-amber-200 bg-amber-100 text-amber-600",
                        )
                      ) : kind === "weekoff" ? (
                        offLine(
                          "Week Off",
                          "bg-gray-200",
                          "border-gray-200 bg-gray-100 text-gray-500",
                        )
                      ) : kind === "absent" ? (
                        offLine(
                          "Absent",
                          "bg-red-200",
                          "border-red-200 bg-red-100 text-red-500",
                        )
                      ) : (
                        <TimelineBar
                          sessions={sessions}
                          isWeekend={isWknd}
                          isLiveToday={isToday && hasActive}
                        />
                      )}
                    </div>

                    {/* Check-out info */}
                    <div className="flex w-28 shrink-0 flex-col justify-center px-1 py-3 text-right">
                      {clickable &&
                      kind !== "absent" &&
                      lastClosed?.checkOutAt ? (
                        <>
                          <span className="text-[10px] font-semibold text-rose-500">
                            Office Out
                          </span>
                          <span className="text-xs font-bold leading-tight text-gray-900 dark:text-white">
                            {time12(lastClosed.checkOutAt)}
                          </span>
                        </>
                      ) : clickable && hasActive ? (
                        <span className="animate-pulse text-[10px] font-semibold text-amber-500">
                          Active
                        </span>
                      ) : null}
                    </div>

                    {/* Hours + badges + Regularize */}
                    <div className="flex w-28 shrink-0 flex-col items-end justify-center gap-0.5 py-3 pr-4">
                      {!isWknd ? (
                        <>
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`text-sm font-extrabold leading-tight ${
                                ms >= 4 * 3_600_000
                                  ? "text-amber-500"
                                  : ms > 0
                                    ? "text-red-500"
                                    : "text-gray-300"
                              }`}
                            >
                              {displayMode === "hours"
                                ? `${(ms / 3_600_000).toFixed(1)} Hrs`
                                : ms > 0
                                  ? msToHM(ms)
                                  : "00:00"}
                            </span>
                            {ot > 0 ? (
                              <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-extrabold text-brand-600 shadow-2xs">
                                +{msToHM(ot * 60000)}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-gray-500">
                            Hrs worked
                          </span>
                          {dayType ? (
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] ${DAY_TYPE_STYLE[dayType]}`}
                            >
                              {dayType}
                            </span>
                          ) : null}
                          {regularized ? (
                            <span className="rounded border border-sky-300 bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                              Regularized
                            </span>
                          ) : null}
                          {sessions.length > 1 ? (
                            <span className="text-[10px] text-slate-500">
                              {sessions.length} sessions
                            </span>
                          ) : null}
                        </>
                      ) : null}
                      {canRegularize ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requested}
                          title={
                            requested
                              ? "A regularization request for this date has already been submitted"
                              : undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!requested) openRegularize(ds);
                          }}
                          className="mt-1 h-6 px-2 text-[10px] font-semibold"
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {requested ? "Submitted" : "Regularize"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline hour labels */}
          {viewMode === "week" ? (
            <div className="flex shrink-0 items-stretch border-t border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30">
              <div className="w-16 shrink-0" />
              <div className="w-28 shrink-0" />
              <div className="relative h-6 flex-1 px-2">
                {TL_LABELS.map((h) => (
                  <span
                    key={h}
                    className="absolute top-1.5 -translate-x-1/2 font-mono text-[10px] text-gray-500"
                    style={{ left: `${hourPct(h)}%` }}
                  >
                    {hourLabel(h)}
                  </span>
                ))}
              </div>
              <div className="w-28 shrink-0" />
              <div className="w-28 shrink-0" />
            </div>
          ) : null}

          {/* Bottom stats bar */}
          <div className="flex shrink-0 items-center overflow-x-auto border-t border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mr-5 flex shrink-0 items-center gap-1.5">
              {(["days", "hours"] as const).map((m, i) => (
                <span key={m} className="flex items-center gap-1.5">
                  {i === 1 ? (
                    <span className="text-xs text-gray-300">|</span>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={displayMode === m}
                    onClick={() => setDisplayMode(m)}
                    className={`pb-0.5 text-xs font-bold transition-colors ${
                      displayMode === m
                        ? "border-b-2 border-brand-500 text-brand-600"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {m === "days" ? "Days" : "Hours"}
                  </button>
                </span>
              ))}
            </div>
            <div className="shrink-0">
              {displayMode === "hours" ? (
                <>
                  <p className="text-sm font-bold tabular-nums text-brand-600">
                    {(totalMs / 3_600_000).toFixed(1)} Hrs
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Total Worked Hours
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {payableDays} Days
                  </p>
                  <p className="text-[10px] text-gray-500">Payable Days</p>
                </>
              )}
            </div>
            {[
              {
                label: "Full Day",
                val: fullDays,
                dot: "bg-green-500",
                text: "text-green-700",
              },
              {
                label: "Half Day",
                val: halfDays,
                dot: "bg-amber-400",
                text: "text-amber-700",
              },
              {
                label: "Short",
                val: shortDays,
                dot: "bg-red-400",
                text: "text-red-600",
              },
              {
                label: "Leave",
                val: leaveCount,
                dot: "bg-amber-400",
                text: "text-amber-700",
              },
              {
                label: "Weekend",
                val: weekends,
                dot: "bg-gray-300",
                text: "text-gray-500",
              },
            ].map((s) => (
              <div key={s.label} className="flex shrink-0 items-center gap-3">
                <div className="mx-2 h-3.5 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                  <div>
                    <p className={`text-sm font-bold tabular-nums ${s.text}`}>
                      {s.val} {s.val === 1 ? "Day" : "Days"}
                    </p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-3 pl-4">
              <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] leading-relaxed text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                <span className="font-semibold text-green-600">≥ 7.5h</span>{" "}
                Full ·{" "}
                <span className="font-semibold text-amber-600">≥ 4h</span> Half
                · <span className="font-semibold text-red-500">&lt; 4h</span>{" "}
                Short
              </div>
              <span className="rounded bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                General [10:00 AM...]
              </span>
            </div>
          </div>
        </>
      ) : null}

      {selectedDay ? (
        <DayDetailPanel
          dateStr={selectedDay}
          row={rows.get(selectedDay) ?? null}
          kind={kindOf(selectedDay)}
          now={now}
          onClose={() => setSelectedDay(null)}
        />
      ) : null}

      {regOpen ? (
        <SubmitCorrectionDialog
          key={regKey}
          open
          onClose={() => setRegOpen(false)}
          {...(regDate ? { initialDate: regDate } : {})}
        />
      ) : null}
    </div>
  );
}
