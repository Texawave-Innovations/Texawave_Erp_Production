"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Send,
  Timer,
  Trash2,
} from "lucide-react";
import { addBusinessDays, businessToday } from "@texawave-erp/core";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  Tabs,
  type TabItem,
  StatCard,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useActivityCategories,
  useDeleteCustomActivity,
  useMyDay,
  useMyMonth,
  useSubmitDay,
  useSubmitWeek,
} from "../hooks";
import { TIMESHEET_SUBMIT, TIMESHEET_WRITE } from "../permissions";
import { AttendanceMonthView, currentMonth } from "./AttendanceMonthView";
import { CustomActivityDialog } from "./CustomActivityDialog";
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_DEFAULT_CLASS,
  ATTENDANCE_LABEL,
  formatClock,
  formatDay,
  formatMinutes,
  formatPermissionWindow,
} from "./format";
import { ReviewStatusChip } from "./ReviewStatus";
import type {
  CarriedTask,
  DailyStatus,
  TimesheetRow,
  TimesheetSession,
} from "../types";

// Re-exported so the reviewer and report views keep importing them from here.
export {
  ATTENDANCE_CLASS,
  ATTENDANCE_DEFAULT_CLASS,
  ATTENDANCE_LABEL,
  formatClock,
  formatDay,
  formatMinutes,
};

const SECTION_TABS: TabItem<"log" | "attendance">[] = [
  { id: "log", label: "Log Work" },
  { id: "attendance", label: "Attendance" },
];

const DAILY_STATUS_LABEL: Record<DailyStatus, string> = {
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
};

// Literal class maps (never interpolated) so Tailwind keeps every class.
const DAILY_STATUS_CLASS: Record<DailyStatus, string> = {
  IN_PROGRESS: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ON_HOLD:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

const CLOSED_REASON_LABEL: Record<string, string> = {
  STOPPED: "Stopped",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ATTENDANCE_CHECKOUT: "Closed at check-out",
  AUTO_CHECKOUT: "Closed at auto check-out",
  STALE: "Left running",
  MIDNIGHT_SPLIT: "Continued past midnight",
  CORRECTED: "Corrected",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  hold: "On hold",
  not_started: "Not started",
  completed: "Completed",
};

function SessionLine({ session }: { session: TimesheetSession }) {
  const running = session.endedAt === null;
  const reason = session.closedReason
    ? (CLOSED_REASON_LABEL[session.closedReason] ?? session.closedReason)
    : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
      <span className="font-semibold">
        {session.timePrecision === "DURATION_ONLY"
          ? "Logged duration"
          : running
            ? `Running since ${formatClock(session.startedAt)}`
            : `${formatClock(session.startedAt)} – ${formatClock(session.endedAt as string)}`}
      </span>
      {!running ? <span>{formatMinutes(session.durationMinutes)}</span> : null}
      {reason ? (
        <span className="text-gray-400 dark:text-gray-500">{reason}</span>
      ) : null}
      {session.reviewState === "STALE_UNRESOLVED" ? (
        <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Timer was left running — 0 min counted
        </span>
      ) : null}
      {session.reviewState === "REVIEW_REQUIRED" ? (
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Needs review
        </span>
      ) : null}
      {session.notes ? (
        <span className="italic text-gray-500 dark:text-gray-400">
          “{session.notes}”
        </span>
      ) : null}
    </li>
  );
}

/** A custom activity can be changed until its day is submitted (or after it is
 * returned); task rows are edited through the stopwatch, never here. */
function isEditableActivity(row: TimesheetRow): boolean {
  return (
    row.category !== "TASK" &&
    (row.submissionStatus === "DRAFT" || row.submissionStatus === "REJECTED")
  );
}

function RowCard({
  row,
  categoryLabel,
  canWrite,
  onEdit,
  onDelete,
}: {
  row: TimesheetRow;
  categoryLabel: string;
  canWrite: boolean;
  onEdit: (row: TimesheetRow) => void;
  onDelete: (row: TimesheetRow) => void;
}) {
  const runningNow = row.sessions.some((s) => s.endedAt === null);
  const custom = row.category !== "TASK";
  return (
    <li className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
            {row.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {row.category === "TASK"
              ? `${row.taskCode ?? "Task"}${row.projectName ? ` · ${row.projectName}` : ""}`
              : `${categoryLabel}${row.projectName ? ` · ${row.projectName}` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${DAILY_STATUS_CLASS[row.dailyStatus]}`}
          >
            {DAILY_STATUS_LABEL[row.dailyStatus]}
          </span>
          <span className="text-sm font-extrabold text-gray-900 dark:text-white">
            {formatMinutes(row.durationMinutes)}
          </span>
          {canWrite && isEditableActivity(row) ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onEdit(row)}
                aria-label={`Edit ${row.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDelete(row)}
                aria-label={`Delete ${row.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {custom && row.startedAt && row.endedAt ? (
        <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {formatClock(row.startedAt)} – {formatClock(row.endedAt)}
        </p>
      ) : null}
      {custom && row.description ? (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          {row.description}
        </p>
      ) : null}
      {custom && row.notes ? (
        <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
          “{row.notes}”
        </p>
      ) : null}
      {custom && row.isBackdated ? (
        <p className="mt-2 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Late entry{row.lateEntryReason ? ` — ${row.lateEntryReason}` : ""}
        </p>
      ) : null}
      {custom && row.submissionStatus === "REJECTED" ? (
        <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
          Returned for correction.
        </p>
      ) : null}
      {runningNow ? (
        <p className="mt-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
          Timer running — time counts once it is stopped or paused.
        </p>
      ) : null}
      {row.sessions.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
          {row.sessions.map((s) => (
            <SessionLine key={s.id} session={s} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CarriedCard({ task }: { task: CarriedTask }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-xs dark:border-gray-700 dark:bg-gray-900">
      <span className="font-semibold text-gray-700 dark:text-gray-200">
        {task.taskCode} — {task.title}
        {task.projectName ? (
          <span className="font-normal text-gray-500 dark:text-gray-400">
            {" "}
            · {task.projectName}
          </span>
        ) : null}
      </span>
      <span className="text-gray-500 dark:text-gray-400">
        {TASK_STATUS_LABEL[task.taskStatus] ?? task.taskStatus} · no work today
      </span>
    </li>
  );
}

/**
 * The signed-in employee's timesheet for one day: what they worked on, each
 * work session, the day's total, and HR's attendance status for the day. Days
 * in between (a task on hold, an absence) have no stored rows and show 0 time —
 * nothing is invented. Working a task happens in My Work.
 */
export function MyTimesheetView() {
  const today = businessToday();
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<"log" | "attendance">("log");
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading, isError, refetch } = useMyDay(date);
  const monthQuery = useMyMonth(month);
  const { toast } = useToast();
  const canWrite = usePermission(TIMESHEET_WRITE);
  const canSubmit = usePermission(TIMESHEET_SUBMIT);
  const submitDay = useSubmitDay();
  const submitWeek = useSubmitWeek();
  const [confirmSubmit, setConfirmSubmit] = useState<"day" | "week" | null>(
    null,
  );
  const categories = useActivityCategories();
  const deleteActivity = useDeleteCustomActivity();
  // The add/edit dialog is mounted only while open, so it starts fresh each time.
  const [dialog, setDialog] = useState<{
    open: boolean;
    editing: TimesheetRow | null;
  }>({ open: false, editing: null });
  const [toDelete, setToDelete] = useState<TimesheetRow | null>(null);
  const categoryLabels = new Map(
    (categories.data ?? []).map((c) => [c.code, c.label]),
  );

  const isToday = date === today;
  const attendance = data?.attendanceStatus ?? null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            My Timesheet
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track attendance and log daily work. Start and stop work in{" "}
            <Link
              href="/portal/work"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-cyan-300"
            >
              My Work
            </Link>
            .
          </p>
        </div>
        {tab === "log" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDate(addBusinessDays(date, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              aria-label="Choose a date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              className="w-44"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDate(addBusinessDays(date, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDate(today)}
              disabled={isToday}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Today
            </Button>
            {canWrite ? (
              <Button
                size="sm"
                onClick={() => setDialog({ open: true, editing: null })}
              >
                <Plus className="h-3.5 w-3.5" />
                Add custom activity
              </Button>
            ) : null}
            {canSubmit && data?.review.canSubmit ? (
              <Button size="sm" onClick={() => setConfirmSubmit("day")}>
                <Send className="h-3.5 w-3.5" />
                Submit day
              </Button>
            ) : null}
            {canSubmit ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmSubmit("week")}
              >
                <Send className="h-3.5 w-3.5" />
                Submit week
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <Tabs
        label="Timesheet sections"
        idPrefix="my-timesheet"
        tabs={SECTION_TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "attendance" ? (
          <AttendanceMonthView
            month={month}
            onMonthChange={setMonth}
            data={monthQuery.data}
            isLoading={monthQuery.isLoading}
            isError={monthQuery.isError}
            onRetry={() => void monthQuery.refetch()}
            onOpenDay={(d) => {
              setDate(d);
              setTab("log");
            }}
          />
        ) : null}

        {tab === "log" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {formatDay(date)}
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  attendance
                    ? (ATTENDANCE_CLASS[attendance] ?? ATTENDANCE_DEFAULT_CLASS)
                    : ATTENDANCE_DEFAULT_CLASS
                }`}
                title="Attendance status from HR for this day"
              >
                {attendance
                  ? (ATTENDANCE_LABEL[attendance] ?? attendance)
                  : "No attendance record"}
              </span>
              {data ? (
                <ReviewStatusChip
                  status={data.review.status}
                  stage={data.review.stage}
                />
              ) : null}
              {data?.attendance && data.attendance.workedMinutes > 0 ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  HR counts {formatMinutes(data.attendance.workedMinutes)}{" "}
                  worked
                  {data.attendance.targetMinutes !== null
                    ? ` of ${formatMinutes(data.attendance.targetMinutes)}`
                    : ""}
                </span>
              ) : null}
            </div>

            {data?.attendance && data.attendance.permissions.length > 0 ? (
              <ul
                aria-label="Approved permissions"
                className="flex flex-col gap-2"
                data-testid="day-permissions"
              >
                {data.attendance.permissions.map((p) => (
                  <li
                    key={`${p.fromTime}-${p.toTime}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                  >
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">
                      Permission {formatPermissionWindow(p)} (
                      {formatMinutes(p.minutes)}, approved)
                    </span>
                    {data.attendance?.baseTargetMinutes != null &&
                    data.attendance.targetMinutes !== null ? (
                      <span>
                        Today&apos;s target is{" "}
                        {formatMinutes(data.attendance.targetMinutes)} (
                        {formatMinutes(data.attendance.baseTargetMinutes)} shift
                        minus {formatMinutes(data.attendance.permissionMinutes)}{" "}
                        permission).
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {data?.review.status === "REJECTED" ? (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This day was returned
                  {data.review.decisionNote
                    ? `: ${data.review.decisionNote}`
                    : "."}{" "}
                  Fix it and submit it again.
                </span>
              </div>
            ) : null}

            {data && data.flags.length > 0 ? (
              <ul
                aria-label="Attendance checks"
                className="flex flex-col gap-2"
              >
                {data.flags.map((flag) => (
                  <li
                    key={flag.code}
                    className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
                      flag.severity === "warning"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                    }`}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{flag.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
              </div>
            ) : isError ? (
              <ErrorState
                title="Could not load your timesheet"
                onRetry={() => void refetch()}
              />
            ) : data ? (
              <>
                <section
                  aria-label="Day summary"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                  <StatCard
                    headingId="ts-total"
                    label="Total time"
                    value={formatMinutes(data.totals.totalMinutes)}
                    note="Stopped and paused work counts; a running timer does not yet"
                    tone="brand"
                    icon={Clock}
                  />
                  <StatCard
                    headingId="ts-tasks"
                    label="Task time"
                    value={formatMinutes(data.totals.taskMinutes)}
                    note="From your task timers"
                    tone="blue"
                    icon={Timer}
                  />
                  <StatCard
                    headingId="ts-rows"
                    label="Activities"
                    value={data.totals.rowCount}
                    note={
                      data.totals.customMinutes > 0
                        ? `${formatMinutes(data.totals.customMinutes)} other activity time`
                        : "Tasks worked on this day"
                    }
                    tone="info"
                    icon={CheckSquare}
                  />
                </section>

                {data.rows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
                    <EmptyState
                      title="No work recorded for this day"
                      description={
                        attendance === "ABSENT" ||
                        attendance === "ON_LEAVE" ||
                        attendance === "HOLIDAY" ||
                        attendance === "WEEKLY_OFF"
                          ? "No work is expected on this day."
                          : "Nothing was started or logged. This is not an absence — attendance is recorded by HR."
                      }
                    />
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.rows.map((row) => (
                      <RowCard
                        key={row.id}
                        row={row}
                        categoryLabel={
                          categoryLabels.get(row.category) ??
                          row.category.replace(/_/g, " ").toLowerCase()
                        }
                        canWrite={canWrite}
                        onEdit={(r) => setDialog({ open: true, editing: r })}
                        onDelete={setToDelete}
                      />
                    ))}
                  </ul>
                )}

                {isToday && data.carried.length > 0 ? (
                  <section aria-label="Open tasks with no work today">
                    <h3 className="mb-2 text-xs font-extrabold uppercase text-gray-400">
                      Open on your plate — no work yet today
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {data.carried.map((task) => (
                        <CarriedCard key={task.taskId} task={task} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Tabs>

      {dialog.open ? (
        <CustomActivityDialog
          defaultDate={date}
          editing={dialog.editing}
          onClose={() => setDialog({ open: false, editing: null })}
        />
      ) : null}

      <ConfirmDialog
        open={confirmSubmit !== null}
        onClose={() => setConfirmSubmit(null)}
        title={
          confirmSubmit === "week"
            ? "Submit this week for approval?"
            : "Submit this day for approval?"
        }
        description={
          confirmSubmit === "week"
            ? "Every day of this week that has work goes to your reviewers. Submitted days cannot be edited unless they are returned."
            : "The day goes to your reviewers. It cannot be edited unless it is returned."
        }
        itemName={confirmSubmit === "week" ? undefined : formatDay(date)}
        confirmText="Submit"
        loading={submitDay.isPending || submitWeek.isPending}
        onConfirm={async () => {
          try {
            if (confirmSubmit === "week") {
              const result = await submitWeek.mutateAsync(date);
              toast({
                title:
                  result.submitted.length > 0
                    ? `Submitted ${result.submitted.length} day${result.submitted.length === 1 ? "" : "s"}`
                    : "Nothing to submit this week",
                ...(result.skipped.length > 0
                  ? {
                      description: result.skipped
                        .map((d) => `${d.date}: ${d.reason}`)
                        .join(" "),
                    }
                  : {}),
                variant: result.skipped.length > 0 ? "error" : "success",
              });
            } else {
              await submitDay.mutateAsync(date);
              toast({ title: "Day submitted", variant: "success" });
            }
            setConfirmSubmit(null);
          } catch (err) {
            toast({
              title:
                err instanceof Error && err.message
                  ? err.message
                  : "Could not submit",
              variant: "error",
            });
            setConfirmSubmit(null);
          }
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete this activity?"
        description="It is removed from your timesheet for the day. This is recorded in the audit log."
        itemName={toDelete?.title}
        confirmText="Delete"
        variant="destructive"
        loading={deleteActivity.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteActivity.mutateAsync(toDelete.id);
            toast({ title: "Activity deleted", variant: "success" });
            setToDelete(null);
          } catch (err) {
            toast({
              title:
                err instanceof Error && err.message
                  ? err.message
                  : "Could not delete the activity",
              variant: "error",
            });
          }
        }}
      />
    </div>
  );
}
