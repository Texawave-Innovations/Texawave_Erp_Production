"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  SpringGlideSegmentedControl,
  StatCard,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAwaitingDays, useReviewDays, useReviewSummary } from "../hooks";
import {
  REVIEW_APPROVE_ANY_SCOPE,
  REVIEW_READ_ANY_SCOPE,
} from "../permissions";
import type { ReviewDaySummary } from "../types";
import { formatDay, formatMinutes } from "./MyTimesheetView";
import { ReviewDayDialog } from "./ReviewDayDialog";
import { ReviewStatusChip } from "./ReviewStatus";
import { TimesheetReport } from "./TimesheetReport";
import { TimesheetWeekGrid } from "./TimesheetWeekGrid";

const PAGE_SIZE = 20;

type Tab = "awaiting" | "all" | "week" | "report";
type StatusFilter = "ALL" | "SUBMITTED" | "APPROVED" | "REJECTED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Returned" },
];

function DayRow({
  day,
  onOpen,
}: {
  day: ReviewDaySummary;
  onOpen: (day: ReviewDaySummary) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {day.employee.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {day.employee.code} · {day.employee.team}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {formatDay(day.date)}
          </span>
          <ReviewStatusChip status={day.status} stage={day.stage} />
          {day.needsAttention ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Needs a look
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {formatMinutes(day.totalMinutes)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {day.rowCount} {day.rowCount === 1 ? "activity" : "activities"}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onOpen(day)}
          aria-label={`Review ${day.employee.name} ${day.date}`}
        >
          Review
        </Button>
      </div>
    </li>
  );
}

/**
 * Submitted timesheet days for the people the caller reviews: "Awaiting me"
 * (what the caller can decide now — the reporting manager's first approval, or
 * HR's second) and "All" (submitted, approved and returned days in their
 * reach). The API scopes every row to the caller's `hr.timesheet` permission;
 * the buttons here only follow it.
 */
export function TeamTimesheetsView() {
  const canApprove = usePermission(REVIEW_APPROVE_ANY_SCOPE);
  const canRead = usePermission(REVIEW_READ_ANY_SCOPE);
  const [tab, setTab] = useState<Tab>(canApprove ? "awaiting" : "all");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    employeeId: number;
    date: string;
  } | null>(null);

  const awaiting = useAwaitingDays(
    { page, limit: PAGE_SIZE },
    canApprove && tab === "awaiting",
  );
  const all = useReviewDays(
    {
      page,
      limit: PAGE_SIZE,
      ...(status !== "ALL" ? { status } : {}),
    },
    canRead && tab === "all",
  );
  const summary = useReviewSummary(canRead);
  const active = tab === "awaiting" ? awaiting : all;
  const days = active.data?.data ?? [];
  const totalPages = active.data?.meta?.totalPages ?? 1;

  const tabs = [
    ...(canApprove
      ? [{ id: "awaiting" as const, label: "Awaiting my decision" }]
      : []),
    ...(canRead ? [{ id: "all" as const, label: "All submitted" }] : []),
    ...(canRead ? [{ id: "week" as const, label: "Week" }] : []),
    ...(canRead ? [{ id: "report" as const, label: "Report" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            Team Timesheets
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Days submitted by the people you review. The reporting manager gives
            the first approval and HR the second.
          </p>
        </div>
        {tab === "all" ? (
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="w-44"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : null}
      </header>

      {tabs.length > 1 ? (
        <SpringGlideSegmentedControl
          options={tabs}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
          ariaLabel="Timesheet review lists"
        />
      ) : null}

      {summary.data ? (
        <section
          aria-label="Review summary"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <StatCard
            headingId="tr-await"
            label="Waiting for me"
            value={summary.data.awaitingMe ?? "-"}
            note={
              summary.data.awaitingMe === null
                ? "You do not decide timesheets"
                : "Days you can approve or return now"
            }
            tone="brand"
          />
          <StatCard
            headingId="tr-submitted"
            label="Submitted"
            value={summary.data.submitted}
            note="In your reach, not yet approved"
            tone="blue"
          />
          <StatCard
            headingId="tr-attention"
            label="Needs a look"
            value={summary.data.needsAttention}
            note="A timer needs checking"
            tone="amber"
          />
          <StatCard
            headingId="tr-approved"
            label="Approved this month"
            value={summary.data.approvedThisMonth}
            note={`${summary.data.returned} returned and waiting for the employee`}
            tone="emerald"
          />
        </section>
      ) : null}

      {tab === "week" ? (
        <TimesheetWeekGrid
          onOpen={(d) =>
            setSelected({ employeeId: d.employee.id, date: d.date })
          }
        />
      ) : tab === "report" ? (
        <TimesheetReport />
      ) : active.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : active.isError ? (
        <ErrorState
          title="Could not load timesheets"
          onRetry={() => void active.refetch()}
        />
      ) : days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title={
              tab === "awaiting"
                ? "Nothing is waiting for your decision"
                : "No submitted timesheets"
            }
            description={
              tab === "awaiting"
                ? "Days submitted by the people you review appear here."
                : "Submitted, approved and returned days appear here."
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {days.map((day) => (
            <DayRow
              key={`${day.employee.id}-${day.date}`}
              day={day}
              onOpen={(d) =>
                setSelected({ employeeId: d.employee.id, date: d.date })
              }
            />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      {selected ? (
        <ReviewDayDialog
          employeeId={selected.employeeId}
          date={selected.date}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
