"use client";

import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  useAbsenceLookback,
  useActivityFeed,
  useApprovalsPending,
  useDailyAttendance,
  useGlanceSupport,
  useHeadcount,
  useLeaveBreakdown,
  usePendingExpenseCount,
  usePipelineCounts,
  useTicketCounts,
} from "../hooks";
import {
  buildActivityFeed,
  buildGlanceEvents,
  istToday,
  leaveTypeBreakdown,
} from "../metrics";
import {
  Donut,
  KpiCard,
  Legend,
  SectionCard,
  WidgetState,
  SEGMENT_FILL,
  type SegmentTone,
} from "./dashboard-widgets";

const LEAVE_TONES: readonly SegmentTone[] = [
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
];

/** Cycles through the chart tones; the modulo keeps the index in range, the fallback satisfies the type. */
function leaveTone(index: number): SegmentTone {
  return LEAVE_TONES[index % LEAVE_TONES.length] ?? "chart1";
}

const HEATMAP_TONE = {
  none: "bg-gray-100 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400",
  low: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
  mid: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  high: "bg-error-500 text-white dark:bg-error-500",
} as const;

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function HrDashboardView() {
  const fullName = useAuthStore((s) => s.user?.fullName);
  const [now] = useState(() => new Date());
  const today = useMemo(() => istToday(now), [now]);
  const [leaveMode, setLeaveMode] = useState<"month" | "all">("month");

  // RBAC: each section needs the permission(s) for every number it shows.
  // A partial figure (for example approvals without corrections) would be misleading, so it is hidden instead.
  const canEmployees = usePermission("hr.employee.read");
  const canAttendance = usePermission("hr.attendance_report.read");
  const canLeaves = usePermission("hr.leave_request.read");
  const canCorrections = usePermission("hr.attendance_correction.read");
  const canApprovals = canLeaves && canCorrections;
  const canTickets = usePermission("hr.ticket.read");
  const canExpenses = usePermission("hr.expense_claim.read");
  const canPipeline = usePermission(
    ["hr.interview.read", "hr.offer_letter.read"],
    "all",
  );
  const canGlance = usePermission(
    ["hr.holiday.read", "hr.employee.read", "hr.attendance_report.read"],
    "all",
  );
  const canActivity = usePermission(
    ["hr.ticket.read", "hr.expense_claim.read"],
    "all",
  );

  const headcount = useHeadcount(canEmployees);
  const attendance = useDailyAttendance(today, canAttendance);
  const lookback = useAbsenceLookback(today, canAttendance);
  const approvals = useApprovalsPending(canApprovals);
  const openTickets = useTicketCounts(canTickets);
  const pendingExpenses = usePendingExpenseCount(canExpenses);
  const pipeline = usePipelineCounts(canPipeline);
  const leaves = useLeaveBreakdown(leaveMode, today, canLeaves);
  const activity = useActivityFeed(canActivity);
  const glance = useGlanceSupport(today, canGlance);

  const totalEmployees = headcount.data?.total ?? 0;
  const counts = attendance.data?.counts;
  const presentToday = counts?.present ?? 0;
  const absentToday = counts?.absent ?? 0;
  const onLeaveToday = counts?.onLeave ?? 0;
  const scopedHeadcount = attendance.data?.rows.length ?? 0;

  const pipelineStages = pipeline.data
    ? [
        { label: "Scheduled", count: pipeline.data.scheduled },
        { label: "Interviewed", count: pipeline.data.interviewed },
        { label: "Selected", count: pipeline.data.selected },
        { label: "Offered", count: pipeline.data.offered },
        // No candidate or hire record exists in production; see the note under the stages.
        { label: "Hired", count: null },
      ]
    : [];
  const pipelineActive = pipelineStages.reduce(
    (sum, s) => sum + (s.count ?? 0),
    0,
  );

  const leaveRows = leaves.data ? leaveTypeBreakdown(leaves.data) : [];
  const leaveTotal = leaveRows.reduce((sum, r) => sum + r.count, 0);

  const glanceEvents =
    attendance.data && glance.data
      ? buildGlanceEvents({
          today,
          onLeave: attendance.data.rows.filter((r) => r.status === "ON_LEAVE"),
          holidays: glance.data.holidays,
          employees: glance.data.employees,
        })
      : [];

  const feed = activity.data
    ? buildActivityFeed(activity.data.tickets, activity.data.expenses)
    : [];

  const peak = lookback.days.reduce<{ day: string; absences: number }>(
    (best, d) => (d.absences > best.absences ? d : best),
    { day: "None", absences: 0 },
  );
  const maxAbsence = Math.max(...lookback.days.map((d) => d.absences), 1);

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 pb-12"
      role="main"
      aria-label="HR dashboard"
    >
      {/* Hero */}
      <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-6 text-white shadow-theme-md md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-50">
            Enterprise HR &amp; People Operations
          </p>
          <h1 className="mt-1 text-title-md font-semibold">
            {greeting(now)}
            {fullName ? `, ${fullName}` : ""}
          </h1>
          <p className="mt-1 text-theme-sm text-brand-50">
            {now.toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Asia/Kolkata",
            })}
            {" · Attendance, leave, recruitment and workforce figures"}
          </p>
        </div>
      </header>

      {/* KPI row */}
      {(canEmployees ||
        canAttendance ||
        canApprovals ||
        canTickets ||
        canExpenses) && (
        <section aria-labelledby="hr-kpi-heading" className="space-y-3">
          <h2
            id="hr-kpi-heading"
            className="text-theme-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Workforce &amp; operational metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {canEmployees && (
              <WidgetState
                isPending={headcount.isPending}
                isError={headcount.isError}
                onRetry={() => void headcount.refetch()}
                label="headcount"
              >
                <KpiCard
                  headingId="kpi-total"
                  label="Total employees"
                  value={String(totalEmployees)}
                  note="Registered headcount"
                  tone="neutral"
                />
              </WidgetState>
            )}
            {canEmployees && (
              <WidgetState
                isPending={headcount.isPending}
                isError={headcount.isError}
                onRetry={() => void headcount.refetch()}
                label="active workforce"
              >
                <KpiCard
                  headingId="kpi-active"
                  label="Active workforce"
                  value={String(headcount.data?.active ?? 0)}
                  note="Status: active"
                  tone="brand"
                />
              </WidgetState>
            )}
            {canAttendance && (
              <WidgetState
                isPending={attendance.isPending}
                isError={attendance.isError}
                onRetry={() => void attendance.refetch()}
                label="attendance today"
              >
                <KpiCard
                  headingId="kpi-present"
                  label="Present today"
                  value={String(presentToday)}
                  note={`${pct(presentToday, scopedHeadcount)}% of ${scopedHeadcount} in scope`}
                  tone="info"
                />
              </WidgetState>
            )}
            {canApprovals && (
              <WidgetState
                isPending={approvals.isPending}
                isError={approvals.isError}
                onRetry={() => void approvals.refetch()}
                label="pending approvals"
              >
                <KpiCard
                  headingId="kpi-approvals"
                  label="Pending approvals"
                  value={String(approvals.data?.total ?? 0)}
                  note={`${approvals.data?.leaves ?? 0} leave · ${approvals.data?.corrections ?? 0} attendance corrections`}
                  tone="error"
                />
              </WidgetState>
            )}
            {canTickets && (
              <WidgetState
                isPending={openTickets.isPending}
                isError={openTickets.isError}
                onRetry={() => void openTickets.refetch()}
                label="open tickets"
              >
                <KpiCard
                  headingId="kpi-tickets"
                  label="Open tickets"
                  value={String(openTickets.data ?? 0)}
                  note="Open and in progress"
                  tone="warning"
                />
              </WidgetState>
            )}
            {canExpenses && (
              <WidgetState
                isPending={pendingExpenses.isPending}
                isError={pendingExpenses.isError}
                onRetry={() => void pendingExpenses.refetch()}
                label="pending expenses"
              >
                <KpiCard
                  headingId="kpi-expenses"
                  label="Pending expenses"
                  value={String(pendingExpenses.data ?? 0)}
                  note="Claims awaiting decision"
                  tone="warning"
                />
              </WidgetState>
            )}
          </div>
        </section>
      )}

      {/* Recruitment pipeline */}
      {canPipeline && (
        <SectionCard
          title="Recruitment & talent pipeline"
          headingId="hr-pipeline-heading"
          aside={
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400">
              {pipelineActive} active in pipeline
            </span>
          }
        >
          <WidgetState
            isPending={pipeline.isPending}
            isError={pipeline.isError}
            onRetry={() => void pipeline.refetch()}
            label="recruitment pipeline"
          >
            <ol
              className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3 xl:grid-cols-5"
              aria-label="Recruitment pipeline stages"
            >
              {pipelineStages.map((stage, idx) => {
                const next = pipelineStages[idx + 1];
                const conv =
                  stage.count !== null &&
                  stage.count > 0 &&
                  next?.count !== null &&
                  next?.count !== undefined
                    ? pct(next.count, stage.count)
                    : null;
                return (
                  <li
                    key={stage.label}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between text-theme-xs font-medium text-gray-600 dark:text-gray-300">
                      <span>{stage.label}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        Step {idx + 1}
                      </span>
                    </div>
                    {stage.count === null ? (
                      <p className="mt-2 text-theme-sm font-medium text-gray-500 dark:text-gray-400">
                        Not tracked
                      </p>
                    ) : (
                      <p className="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white/90">
                        {stage.count}
                      </p>
                    )}
                    {conv !== null && (
                      <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                        {conv}% to next stage
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
              Scheduled, interviewed and selected come from interview records;
              offered counts offer letters. Applicants and hires are not tracked
              in production yet.
            </p>
          </WidgetState>
        </SectionCard>
      )}

      {/* Two-column analytics */}
      {(canAttendance || canLeaves) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {canAttendance && (
              <SectionCard
                title="Attendance today"
                headingId="hr-attendance-heading"
              >
                <WidgetState
                  isPending={attendance.isPending}
                  isError={attendance.isError}
                  onRetry={() => void attendance.refetch()}
                  label="attendance today"
                >
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <Donut
                      label={`Attendance today: ${presentToday} present, ${absentToday} absent, ${onLeaveToday} on leave`}
                      segments={[
                        {
                          label: "Present",
                          value: presentToday,
                          tone: "brand",
                        },
                        { label: "Absent", value: absentToday, tone: "error" },
                        {
                          label: "On leave",
                          value: onLeaveToday,
                          tone: "warning",
                        },
                      ]}
                      centerValue={String(presentToday)}
                      centerLabel={`of ${scopedHeadcount} present`}
                    />
                    <Legend
                      items={[
                        {
                          label: "Present today",
                          value: presentToday,
                          tone: "brand",
                          detail: "Checked in and working",
                        },
                        {
                          label: "Absent today",
                          value: absentToday,
                          tone: "error",
                          detail: "Marked absent",
                        },
                        {
                          label: "On approved leave",
                          value: onLeaveToday,
                          tone: "warning",
                          detail: "Approved time off",
                        },
                      ]}
                    />
                  </div>
                  <table className="sr-only">
                    <caption>Attendance today summary</caption>
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Present</td>
                        <td>{presentToday}</td>
                      </tr>
                      <tr>
                        <td>Absent</td>
                        <td>{absentToday}</td>
                      </tr>
                      <tr>
                        <td>On approved leave</td>
                        <td>{onLeaveToday}</td>
                      </tr>
                    </tbody>
                  </table>
                </WidgetState>
              </SectionCard>
            )}

            {canAttendance && (
              <SectionCard
                title="Absence pattern by weekday"
                headingId="hr-heatmap-heading"
                aside={
                  peak.absences > 0 ? (
                    <span className="rounded-full border border-error-200 bg-error-50 px-3 py-1 text-theme-xs font-semibold text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400">
                      Peak: {peak.day} ({peak.absences} absences)
                    </span>
                  ) : null
                }
              >
                <WidgetState
                  isPending={lookback.isPending}
                  isError={lookback.isError}
                  label="absence pattern"
                >
                  <ul
                    className="grid grid-cols-5 gap-3"
                    aria-label="Absences per weekday, last three working weeks"
                  >
                    {lookback.days.map((d) => {
                      const intensity = d.absences / maxAbsence;
                      const tone =
                        d.absences === 0
                          ? HEATMAP_TONE.none
                          : intensity < 0.4
                            ? HEATMAP_TONE.low
                            : intensity < 0.75
                              ? HEATMAP_TONE.mid
                              : HEATMAP_TONE.high;
                      return (
                        <li
                          key={d.day}
                          className="flex flex-col items-center gap-2"
                        >
                          <span className="text-theme-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                            {d.day}
                          </span>
                          <span
                            className={`flex h-16 w-full flex-col items-center justify-center rounded-xl ${tone}`}
                          >
                            <span className="text-theme-lg font-semibold">
                              {d.absences}
                            </span>
                            <span className="text-[10px] uppercase opacity-80">
                              absent
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-4 border-t border-gray-100 pt-3 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    Last 3 working weeks, including today (today is partial
                    until attendance is complete).
                  </p>
                </WidgetState>
              </SectionCard>
            )}
          </div>

          <div className="space-y-6 lg:col-span-5">
            {canLeaves && (
              <SectionCard
                title="Leave type breakdown"
                headingId="hr-leave-heading"
                aside={
                  <div
                    role="group"
                    aria-label="Leave period"
                    className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-800 dark:bg-white/[0.03]"
                  >
                    {(["month", "all"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={leaveMode === mode}
                        onClick={() => setLeaveMode(mode)}
                        className={`rounded-md px-2.5 py-1 text-theme-xs font-semibold transition-colors ${
                          leaveMode === mode
                            ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white/90"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        {mode === "month" ? "This month" : "All time"}
                      </button>
                    ))}
                  </div>
                }
              >
                <WidgetState
                  isPending={leaves.isPending}
                  isError={leaves.isError}
                  onRetry={() => void leaves.refetch()}
                  label="leave breakdown"
                >
                  {leaveRows.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-theme-sm font-medium text-gray-600 dark:text-gray-300">
                        No leave requests for this period
                      </p>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        Leave requests appear here once submitted.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                      <Donut
                        label={`Leave requests: ${leaveTotal} total across ${leaveRows.length} types`}
                        segments={leaveRows.map((r, i) => ({
                          label: r.type,
                          value: r.count,
                          tone: leaveTone(i),
                        }))}
                        centerValue={String(leaveTotal)}
                        centerLabel="requests"
                      />
                      <Legend
                        items={leaveRows.map((r, i) => ({
                          label: r.type,
                          value: r.count,
                          tone: leaveTone(i),
                        }))}
                      />
                    </div>
                  )}
                </WidgetState>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {/* Activity and today */}
      {(canActivity || canGlance) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {canActivity && (
            <SectionCard
              title="Recent tickets & expense claims"
              headingId="hr-activity-heading"
              className="lg:col-span-7"
            >
              <WidgetState
                isPending={activity.isPending}
                isError={activity.isError}
                onRetry={() => void activity.refetch()}
                label="recent activity"
              >
                {feed.length === 0 ? (
                  <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    No recent activity
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {feed.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <span
                          className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.kind === "ticket"
                              ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
                              : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                          }`}
                        >
                          {item.kind}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                            {item.title}
                          </p>
                          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {item.detail}
                          </p>
                        </div>
                        <time
                          dateTime={new Date(item.timestamp).toISOString()}
                          className="shrink-0 text-theme-xs text-gray-400"
                        >
                          {new Date(item.timestamp).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Kolkata",
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </WidgetState>
            </SectionCard>
          )}

          {canGlance && (
            <SectionCard
              title="Today at a glance"
              headingId="hr-glance-heading"
              className="lg:col-span-5"
            >
              <WidgetState
                isPending={glance.isPending || attendance.isPending}
                isError={glance.isError || attendance.isError}
                onRetry={() => {
                  void glance.refetch();
                  void attendance.refetch();
                }}
                label="today at a glance"
              >
                {glanceEvents.length === 0 ? (
                  <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    Nothing scheduled today
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {glanceEvents.map((evt) => (
                      <li
                        key={evt.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"
                      >
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_FILL[evt.type === "leave" ? "warning" : evt.type === "holiday" ? "chart1" : "brand"]}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                            {evt.name}
                          </p>
                          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {evt.detail}
                          </p>
                        </div>
                        <span className="shrink-0 text-theme-xs font-medium capitalize text-gray-500 dark:text-gray-400">
                          {evt.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                  Birthdays are not shown: date of birth is held on the
                  restricted employee profile.
                </p>
              </WidgetState>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
