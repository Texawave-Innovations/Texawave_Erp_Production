"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Button,
  Dialog,
  ErrorState,
  FormField,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useDecideDay, useReviewDay } from "../hooks";
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_DEFAULT_CLASS,
  ATTENDANCE_LABEL,
  formatClock,
  formatDay,
  formatMinutes,
} from "./MyTimesheetView";
import { ReopenPanel, SessionFix } from "./ReviewDayActions";
import { ReviewStatusChip } from "./ReviewStatus";

const NOTE_MAX = 1000;

function attendanceChip(status: string) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
        ATTENDANCE_CLASS[status] ?? ATTENDANCE_DEFAULT_CLASS
      }`}
    >
      {ATTENDANCE_LABEL[status] ?? status}
    </span>
  );
}

/**
 * One submitted day for a reviewer: what was worked, HR's attendance now (and
 * what it was when the day was submitted), the flags, and the decision. The
 * decision buttons show only when the server says the caller may decide this
 * day right now (`canDecide`); the server enforces it again on every write.
 */
export function ReviewDayDialog({
  employeeId,
  date,
  onClose,
}: {
  employeeId: number;
  date: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useReviewDay(employeeId, date);
  const decide = useDecideDay();
  const { toast } = useToast();
  const [mode, setMode] = useState<"approve" | "return" | null>(null);
  const [note, setNote] = useState("");

  async function submit(decision: "approve" | "reject") {
    const text = note.trim();
    if (decision === "reject" && !text) return;
    try {
      const result = await decide.mutateAsync({
        employeeId,
        date,
        decision,
        ...(text ? { note: text } : {}),
      });
      toast({
        title:
          decision === "reject"
            ? "Day returned to the employee"
            : result.status === "APPROVED"
              ? "Day approved"
              : "First approval given — it now waits for HR",
        variant: "success",
      });
      onClose();
    } catch (err) {
      toast({
        title:
          err instanceof Error && err.message
            ? err.message
            : "Could not save the decision",
        variant: "error",
      });
    }
  }

  const firstApproval =
    data?.stage === "MANAGER" && data.approvalLevels === 2 && data.canDecide;

  return (
    <Dialog open onClose={onClose} size="lg" title="Review timesheet">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState
          title="Could not load this timesheet"
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {data.employee.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.employee.code} · {data.employee.team}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {formatDay(data.date)}
            </span>
            <ReviewStatusChip status={data.status} stage={data.stage} />
            {data.attendance ? attendanceChip(data.attendance.status) : null}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatMinutes(data.totalMinutes)} logged
              {data.attendance && data.attendance.workedMinutes > 0
                ? ` · HR counts ${formatMinutes(data.attendance.workedMinutes)}`
                : ""}
            </span>
          </div>

          {data.flags.length > 0 ? (
            <ul aria-label="Attendance checks" className="flex flex-col gap-2">
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

          <ul className="flex flex-col gap-2">
            {data.rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {row.title}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatMinutes(row.durationMinutes)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {row.taskCode ??
                    row.category.replace(/_/g, " ").toLowerCase()}
                  {row.projectName ? ` · ${row.projectName}` : ""}
                  {row.startedAt && row.endedAt
                    ? ` · ${formatClock(row.startedAt)} – ${formatClock(row.endedAt)}`
                    : ""}
                </p>
                {row.lateEntryReason ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Late entry: {row.lateEntryReason}
                  </p>
                ) : null}
                {row.sessions.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {row.sessions.map((s) => (
                      <li
                        key={s.id}
                        className="text-xs text-gray-600 dark:text-gray-300"
                      >
                        {s.endedAt
                          ? `${formatClock(s.startedAt)} – ${formatClock(s.endedAt)} · ${formatMinutes(s.durationMinutes)}`
                          : `Running since ${formatClock(s.startedAt)}`}
                        {s.reviewState === "STALE_UNRESOLVED"
                          ? " · left running, 0 min counted"
                          : s.reviewState === "REVIEW_REQUIRED"
                            ? " · needs a check"
                            : ""}
                        {data.canCorrect &&
                        s.endedAt !== null &&
                        s.reviewState !== "OK" ? (
                          <div className="mt-1">
                            <SessionFix
                              sessionId={s.id}
                              onDone={() => void refetch()}
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>

          {data.firstApprovedAt ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              First approval given
              {data.firstApprovalNote ? `: ${data.firstApprovalNote}` : "."}
            </p>
          ) : null}
          {data.decidedAt && data.decisionNote ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Decision note: {data.decisionNote}
            </p>
          ) : null}

          {data.canReopen ? (
            <ReopenPanel
              employeeId={data.employee.id}
              date={data.date}
              onDone={onClose}
            />
          ) : null}

          {data.canDecide ? (
            mode === null ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setMode("return")}>
                  Return to employee
                </Button>
                <Button onClick={() => setMode("approve")}>
                  {firstApproval ? "Approve (first approval)" : "Approve"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <FormField
                  label={
                    mode === "return"
                      ? "Reason for returning"
                      : "Note (optional)"
                  }
                  required={mode === "return"}
                  hint={
                    mode === "return"
                      ? "The employee sees this and must fix the day and submit it again."
                      : firstApproval
                        ? "This is the first approval; HR gives the second."
                        : undefined
                  }
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={2}
                      maxLength={NOTE_MAX}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMode(null);
                      setNote("");
                    }}
                    disabled={decide.isPending}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() =>
                      void submit(mode === "return" ? "reject" : "approve")
                    }
                    loading={decide.isPending}
                    disabled={mode === "return" && note.trim() === ""}
                  >
                    {mode === "return" ? "Return day" : "Confirm approval"}
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
