"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  CheckCircle2,
  Ticket,
  Receipt,
  Calendar,
  Briefcase,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  READ_ANY_SCOPE as EMPLOYEE_READ,
  WRITE_TEAM_OR_ALL,
} from "../../employees/permissions";
import { READ_ANY_SCOPE as EXPENSE_CLAIM_READ } from "../../expense-approvals/permissions";
import { READ_ANY_SCOPE as ATTENDANCE_REPORT_READ } from "../../full-month-present/permissions";
import { READ as HOLIDAY_READ } from "../../holidays/permissions";
import { READ_ANY_SCOPE as LEAVE_REQUEST_READ } from "../../leaves/permissions";
import { RECRUITMENT_PERMISSIONS } from "../../recruitment/permissions";
import { READ_ANY_SCOPE as CORRECTION_READ } from "../../regularization/permissions";
import { READ_ANY_SCOPE as TICKET_READ } from "../../tickets/permissions";
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
  StatCard,
  QuickAction,
  DashboardSection,
  DonutChart,
  Legend,
  AbsenceHeatmap,
  PipelineFunnel,
  ActivityFeed,
  GlanceSection,
  WidgetState,
  type SegmentTone,
} from "../../components";

const LEAVE_TONES: readonly SegmentTone[] = [
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
];

function leaveTone(index: number): SegmentTone {
  return LEAVE_TONES[index % LEAVE_TONES.length] ?? "chart1";
}

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Enterprise HR Dashboard View conforming to TEXA Design System and Reference C.
 * Provides high-density workforce telemetry, analytics, and operational streams.
 */
export function HrDashboardView() {
  const router = useRouter();
  const fullName = useAuthStore((s) => s.user?.fullName);
  const [now] = useState(() => new Date());
  const today = useMemo(() => istToday(now), [now]);
  const [leaveMode, setLeaveMode] = useState<"month" | "all">("month");

  // RBAC gating for every metric and section. Scoped families are only ever
  // granted as `.own`/`.team`/`.all` (never the bare code), so each check
  // reuses the owning feature's any-scope list — the same one its page uses.
  const canEmployees = usePermission(EMPLOYEE_READ);
  const canAttendance = usePermission(ATTENDANCE_REPORT_READ);
  const canLeaves = usePermission(LEAVE_REQUEST_READ);
  const canCorrections = usePermission(CORRECTION_READ);
  const canApprovals = canLeaves && canCorrections;
  const canTickets = usePermission(TICKET_READ);
  const canExpenses = usePermission(EXPENSE_CLAIM_READ);
  const canPipeline = usePermission(
    [
      ...RECRUITMENT_PERMISSIONS.interviewRead,
      ...RECRUITMENT_PERMISSIONS.offerRead,
    ],
    "all",
  );
  const canHolidays = usePermission(HOLIDAY_READ);
  const canGlance = canHolidays && canEmployees && canAttendance;
  const canActivity = canTickets && canExpenses;
  const canCreateEmployee = usePermission(WRITE_TEAM_OR_ALL);
  const canQuickActions =
    canCreateEmployee ||
    canEmployees ||
    canAttendance ||
    canLeaves ||
    canExpenses ||
    canPipeline;

  // React Query telemetry hooks
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

  // Derived metric values
  const totalEmployees = headcount.data?.total ?? 0;
  const activeWorkforce = headcount.data?.active ?? 0;
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

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 pb-12 animate-reveal"
      role="main"
      aria-label="HR dashboard"
    >
      {/* Introduction Header Card */}
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-shadow duration-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
        {/* Subtle Brand Accent Line */}
        <span
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-600 via-brand-500 to-emerald-400"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200/80 bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:border-brand-500/30 dark:bg-brand-950 dark:text-brand-300">
                <Sparkles className="h-3 w-3 text-brand-600 dark:text-brand-400" />
                Enterprise HR &amp; People Operations
              </span>

              <span className="hidden items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry
              </span>
            </div>

            <h1 className="mt-1.5 text-title-sm sm:text-title-md font-bold tracking-tight text-gray-900 dark:text-white">
              {greeting(now)}
              {fullName ? `, ${fullName}` : ""}
            </h1>

            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400 font-medium">
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

          {(canCreateEmployee || canEmployees) && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {canCreateEmployee && (
                <Button
                  variant="primary"
                  onClick={() => router.push("/hr/employees/new")}
                  className="gap-2 shadow-theme-xs"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Add employee</span>
                </Button>
              )}
              {canEmployees && (
                <Button
                  variant="secondary"
                  onClick={() => router.push("/hr/employees")}
                  className="gap-2"
                >
                  <Users className="h-4 w-4 text-gray-500" />
                  <span>Employee directory</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* KPI Workforce & Operational Metrics Row */}
      {(canEmployees ||
        canAttendance ||
        canApprovals ||
        canTickets ||
        canExpenses) && (
        <section
          aria-labelledby="hr-kpi-heading"
          className="space-y-3 stagger-1 animate-reveal"
        >
          <div className="flex items-center justify-between">
            <h2
              id="hr-kpi-heading"
              className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Workforce &amp; operational metrics
            </h2>

            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
              IST Real-time Sync
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {canEmployees && (
              <WidgetState
                isPending={headcount.isPending}
                isError={headcount.isError}
                onRetry={() => void headcount.refetch()}
                label="headcount"
              >
                <StatCard
                  headingId="kpi-total"
                  label="Total employees"
                  value={String(totalEmployees)}
                  note="Registered headcount"
                  tone="neutral"
                  icon={Users}
                  href="/hr/employees"
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
                <StatCard
                  headingId="kpi-active"
                  label="Active workforce"
                  value={String(activeWorkforce)}
                  note="Status: active"
                  tone="brand"
                  icon={UserCheck}
                  trend={{
                    value: `${pct(activeWorkforce, totalEmployees)}%`,
                    direction: "up",
                    label: "active ratio",
                    isPositive: true,
                  }}
                  href="/hr/employees"
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
                <StatCard
                  headingId="kpi-present"
                  label="Present today"
                  value={String(presentToday)}
                  note={`${pct(presentToday, scopedHeadcount)}% of ${scopedHeadcount} in scope`}
                  tone="info"
                  icon={Clock}
                  trend={{
                    value: `${pct(presentToday, scopedHeadcount)}%`,
                    direction: "neutral",
                    label: "turnout",
                  }}
                  href="/hr/attendance"
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
                <StatCard
                  headingId="kpi-approvals"
                  label="Pending approvals"
                  value={String(approvals.data?.total ?? 0)}
                  note={`${approvals.data?.leaves ?? 0} leave · ${approvals.data?.corrections ?? 0} attendance corrections`}
                  tone="error"
                  icon={CheckCircle2}
                  href="/hr/leaves"
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
                <StatCard
                  headingId="kpi-tickets"
                  label="Open tickets"
                  value={String(openTickets.data ?? 0)}
                  note="Open and in progress"
                  tone="warning"
                  icon={Ticket}
                  href="/hr/tickets"
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
                <StatCard
                  headingId="kpi-expenses"
                  label="Pending expenses"
                  value={String(pendingExpenses.data ?? 0)}
                  note="Claims awaiting decision"
                  tone="warning"
                  icon={Receipt}
                  href="/hr/expense-approvals"
                />
              </WidgetState>
            )}
          </div>
        </section>
      )}

      {/* Quick Actions Row */}
      {canQuickActions && (
        <DashboardSection
          title="Quick actions"
          headingId="hr-quick-actions-heading"
          description="Frequently accessed operational workflows"
          icon={TrendingUp}
          className="stagger-2 animate-reveal"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {canCreateEmployee && (
              <QuickAction
                href="/hr/employees/new"
                label="Add employee"
                description="Onboard a new hire"
                icon={UserPlus}
                tone="brand"
              />
            )}
            {canEmployees && (
              <QuickAction
                href="/hr/employees"
                label="Employee directory"
                description="Browse the workforce"
                icon={Users}
                tone="neutral"
              />
            )}
            {canAttendance && (
              <QuickAction
                href="/hr/attendance"
                label="Attendance"
                description="Daily attendance records"
                icon={Clock}
                tone="info"
              />
            )}
            {canLeaves && (
              <QuickAction
                href="/hr/leaves"
                label="Leave requests"
                description="Review time-off requests"
                icon={Calendar}
                tone="warning"
              />
            )}
            {canExpenses && (
              <QuickAction
                href="/hr/expense-approvals"
                label="Expense claims"
                description="Reimbursement approvals"
                icon={Receipt}
                tone="warning"
              />
            )}
            {canPipeline && (
              <QuickAction
                href="/hr/recruitment"
                label="Recruitment pipeline"
                description="Sourcing to offer stages"
                icon={Briefcase}
                tone="brand"
              />
            )}
          </div>
        </DashboardSection>
      )}

      {/* Recruitment Pipeline Funnel */}
      {canPipeline && (
        <DashboardSection
          title="Recruitment & talent pipeline"
          headingId="hr-pipeline-heading"
          description="Active candidate throughput from schedule to offer"
          icon={Briefcase}
          className="stagger-3 animate-reveal"
          aside={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800 dark:border-brand-500/30 dark:bg-brand-950 dark:text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {pipelineActive} active in pipeline
            </span>
          }
        >
          <WidgetState
            isPending={pipeline.isPending}
            isError={pipeline.isError}
            onRetry={() => void pipeline.refetch()}
            label="recruitment pipeline"
            skeletonHeight="h-32"
          >
            <PipelineFunnel stages={pipelineStages} />
          </WidgetState>
        </DashboardSection>
      )}

      {/* Two-Column Analytics: Attendance, Absence, & Leaves */}
      {(canAttendance || canLeaves) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 stagger-4 animate-reveal">
          <div className="space-y-6 lg:col-span-7">
            {/* Attendance Donut Chart */}
            {canAttendance && (
              <DashboardSection
                title="Attendance today"
                headingId="hr-attendance-heading"
                description="Live daily attendance breakdown for scoped employees"
                icon={Clock}
              >
                <WidgetState
                  isPending={attendance.isPending}
                  isError={attendance.isError}
                  onRetry={() => void attendance.refetch()}
                  label="attendance today"
                  skeletonHeight="h-44"
                >
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <DonutChart
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
                </WidgetState>
              </DashboardSection>
            )}

            {/* Absence Pattern Weekday Heatmap */}
            {canAttendance && (
              <DashboardSection
                title="Absence pattern by weekday"
                headingId="hr-heatmap-heading"
                description="Distribution of unplanned absences over the last 3 working weeks"
                icon={Calendar}
                aside={
                  peak.absences > 0 ? (
                    <span className="rounded-full border border-error-200 bg-error-50 px-3 py-1 text-[11px] font-bold text-error-700 dark:border-error-500/30 dark:bg-error-950 dark:text-error-300">
                      Peak: {peak.day} ({peak.absences} absences)
                    </span>
                  ) : null
                }
              >
                <WidgetState
                  isPending={lookback.isPending}
                  isError={lookback.isError}
                  label="absence pattern"
                  skeletonHeight="h-28"
                >
                  <AbsenceHeatmap days={lookback.days} />
                </WidgetState>
              </DashboardSection>
            )}
          </div>

          <div className="space-y-6 lg:col-span-5">
            {/* Leave Type Distribution */}
            {canLeaves && (
              <DashboardSection
                title="Leave type breakdown"
                headingId="hr-leave-heading"
                description="Categorical distribution of leave requests"
                icon={Calendar}
                aside={
                  <div
                    role="group"
                    aria-label="Leave period"
                    className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-800 dark:bg-gray-800/60"
                  >
                    {(["month", "all"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={leaveMode === mode}
                        onClick={() => setLeaveMode(mode)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                          leaveMode === mode
                            ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-700 dark:text-white"
                            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
                  skeletonHeight="h-44"
                >
                  {leaveRows.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
                        No leave requests for this period
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                        Leave requests appear here once submitted.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                      <DonutChart
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
              </DashboardSection>
            )}
          </div>
        </div>
      )}

      {/* Two-Column Activity Feed & Today at a Glance */}
      {(canActivity || canGlance) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 stagger-5 animate-reveal">
          {canActivity && (
            <DashboardSection
              title="Recent tickets & expense claims"
              headingId="hr-activity-heading"
              description="Unified stream of operational requests and submissions"
              icon={Ticket}
              className="lg:col-span-7"
            >
              <WidgetState
                isPending={activity.isPending}
                isError={activity.isError}
                onRetry={() => void activity.refetch()}
                label="recent activity"
                skeletonHeight="h-48"
              >
                <ActivityFeed items={feed} />
              </WidgetState>
            </DashboardSection>
          )}

          {canGlance && (
            <DashboardSection
              title="Today at a glance"
              headingId="hr-glance-heading"
              description="Schedules, upcoming holidays, and workforce milestones"
              icon={Calendar}
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
                skeletonHeight="h-48"
              >
                <GlanceSection events={glanceEvents} />
              </WidgetState>
            </DashboardSection>
          )}
        </div>
      )}
    </div>
  );
}
