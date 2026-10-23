"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  Ticket,
  Receipt,
  Calendar,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import { Button, SpringGlideSegmentedControl } from "@texawave-erp/ui-kit";
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
  useDepartmentMetrics,
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
  QuickAction,
  DashboardSection,
  DonutChart,
  Legend,
  AbsenceHeatmap,
  PipelineFunnel,
  ActivityFeed,
  GlanceSection,
  WidgetState,
  HrPageHeader,
  DepartmentBarChart,
  EmployeeDistributionDonut,
  RecentActivitiesCard,
  StatCard,
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

function formatTimeAgo(dateStr: string | number): string {
  const ts = typeof dateStr === "number" ? dateStr : Date.parse(dateStr);
  if (isNaN(ts)) return "recently";
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} mo ago`;
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
  const deptMetrics = useDepartmentMetrics(canEmployees);
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
  const newJoinersThisMonth = headcount.data?.newJoinersThisMonth ?? 0;
  const newJoinersLastMonth = headcount.data?.newJoinersLastMonth ?? 0;
  const counts = attendance.data?.counts;
  const presentToday = counts?.present ?? 0;
  const absentToday = counts?.absent ?? 0;
  const onLeaveToday = counts?.onLeave ?? 0;
  const scopedHeadcount = attendance.data?.rows.length ?? 0;

  const departmentData = useMemo(() => {
    if (!deptMetrics.data || deptMetrics.data.length === 0) return [];
    return deptMetrics.data.map((d) => ({
      name: d.name,
      count: d.count,
    }));
  }, [deptMetrics.data]);

  const distributionSegments = useMemo(() => {
    if (!deptMetrics.data || deptMetrics.data.length === 0) return [];
    const COLOR_PALETTE = [
      "#38bdf8",
      "#2dd4bf",
      "#f59e0b",
      "#0284c7",
      "#2563eb",
      "#3b82f6",
      "#10b981",
      "#f97316",
    ];

    if (totalEmployees === 0) {
      return deptMetrics.data.map((d, i) => ({
        name: d.name,
        percentage: 0,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length] ?? "#38bdf8",
      }));
    }

    const assignedTotal = deptMetrics.data.reduce((sum, d) => sum + d.count, 0);
    const segments = deptMetrics.data.map((d, i) => ({
      name: d.name,
      percentage: Math.round((d.count / totalEmployees) * 100),
      color: COLOR_PALETTE[i % COLOR_PALETTE.length] ?? "#38bdf8",
    }));

    const unassigned = totalEmployees - assignedTotal;
    if (unassigned > 0) {
      segments.push({
        name: "Other",
        percentage: Math.round((unassigned / totalEmployees) * 100),
        color: "#94a3b8",
      });
    }

    return segments;
  }, [deptMetrics.data, totalEmployees]);

  const recentActivities = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      timeAgo: string;
      timestamp: number;
      icon: typeof Users;
      tone: "blue" | "emerald" | "amber" | "cyan";
    }> = [];

    if (activity.data?.tickets) {
      for (const t of activity.data.tickets) {
        items.push({
          id: `ticket-${t.id}`,
          title: `Ticket: ${t.subject}`,
          description: `${t.employee?.fullName || "Employee"} · ${t.category.replace(/_/g, " ").toLowerCase()} (${t.status.toLowerCase()})`,
          timeAgo: formatTimeAgo(t.createdAt),
          timestamp: Date.parse(t.createdAt) || 0,
          icon: Ticket,
          tone: "blue",
        });
      }
    }

    if (activity.data?.expenses) {
      for (const e of activity.data.expenses) {
        items.push({
          id: `expense-${e.id}`,
          title: `Expense: ${e.expenseType.replace(/_/g, " ").toLowerCase()}`,
          description: `${e.employee?.fullName || "Employee"} · ₹${Number(e.amount).toLocaleString("en-IN")} (${e.status.toLowerCase()})`,
          timeAgo: formatTimeAgo(e.createdAt),
          timestamp: Date.parse(e.createdAt) || 0,
          icon: Receipt,
          tone: "cyan",
        });
      }
    }

    if (leaves.data) {
      for (const l of leaves.data.slice(0, 5)) {
        items.push({
          id: `leave-${l.id}`,
          title: `Leave request ${l.status.toLowerCase()}`,
          description: `${l.employee?.fullName || "Employee"} · ${l.leaveType?.name || "Leave"} (${l.startDate})`,
          timeAgo: formatTimeAgo(l.startDate),
          timestamp: Date.parse(l.startDate) || 0,
          icon: Calendar,
          tone: "emerald",
        });
      }
    }

    if (glance.data?.employees) {
      const sortedEmps = [...glance.data.employees].sort(
        (a, b) =>
          (Date.parse(b.dateOfJoining) || 0) -
          (Date.parse(a.dateOfJoining) || 0),
      );
      for (const emp of sortedEmps.slice(0, 3)) {
        items.push({
          id: `emp-${emp.id}`,
          title: "New employee registered",
          description: `${emp.fullName} (${emp.employeeCode}) joined`,
          timeAgo: formatTimeAgo(emp.dateOfJoining),
          timestamp: Date.parse(emp.dateOfJoining) || 0,
          icon: Users,
          tone: "blue",
        });
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [activity.data, leaves.data, glance.data]);

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
      {/* Standardized Enterprise Header Banner */}
      <HrPageHeader
        title={`${greeting(now)}${fullName ? `, ${fullName}` : ""}`}
        description={`${now.toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        })} · Attendance, leave, recruitment and workforce figures`}
        icon3d="cheer-hands"
        action={
          (canCreateEmployee || canEmployees) && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {canCreateEmployee && (
                <Button
                  variant="primary"
                  onClick={() => router.push("/hr/employees/new")}
                  className="gap-2.5 rounded-xl px-4.5 py-2.5 font-extrabold tracking-wide"
                >
                  <UserPlus className="h-4.5 w-4.5 stroke-[2.75px] text-[#0a3271] dark:text-sky-100" />
                  <span>Add employee</span>
                </Button>
              )}
              {canEmployees && (
                <Button
                  variant="glass"
                  onClick={() => router.push("/hr/employees")}
                  className="gap-2.5 rounded-xl px-4.5 py-2.5 font-bold"
                >
                  <Users className="h-4.5 w-4.5 stroke-[2.25px] text-[#0284c7] dark:text-sky-300" />
                  <span>Employee directory</span>
                </Button>
              )}
            </div>
          )
        }
      />

      {/* KPI Workforce & Operational Metrics Row (Exact Reference) */}
      <section
        aria-labelledby="hr-kpi-heading"
        className="space-y-3.5 stagger-1 animate-reveal"
      >
        <div className="flex items-center justify-between">
          <h2
            id="hr-kpi-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400"
          >
            Workforce &amp; operational metrics
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            headingId="kpi-total"
            label="TOTAL EMPLOYEES"
            value={totalEmployees}
            note={
              newJoinersThisMonth > 0
                ? `+${newJoinersThisMonth} new this month`
                : `${activeWorkforce} active in workforce`
            }
            tone="blue"
            variant="kpi"
            icon={Users}
            trend={
              newJoinersThisMonth > 0
                ? {
                    value: `+${newJoinersThisMonth}`,
                    direction: "up",
                    isPositive: true,
                  }
                : totalEmployees > 0
                  ? {
                      value: `${Math.round((activeWorkforce / totalEmployees) * 100)}%`,
                      direction: "up",
                      isPositive: true,
                    }
                  : undefined
            }
            href="/hr/employees"
          />

          <StatCard
            headingId="kpi-present"
            label="PRESENT TODAY"
            value={presentToday}
            note={
              scopedHeadcount > 0
                ? `${Math.round((presentToday / scopedHeadcount) * 100)}% attendance rate`
                : "No attendance logged today"
            }
            tone="emerald"
            variant="kpi"
            icon={Calendar}
            trend={{
              value: `${scopedHeadcount > 0 ? Math.round((presentToday / scopedHeadcount) * 100) : 100}%`,
              direction: "up",
              isPositive: true,
            }}
            href="/hr/attendance"
          />

          <StatCard
            headingId="kpi-on-leave"
            label="ON LEAVE"
            value={onLeaveToday}
            note={
              totalEmployees > 0
                ? `${((onLeaveToday / totalEmployees) * 100).toFixed(1)}% of total employees`
                : "No approved leaves today"
            }
            tone="error"
            variant="kpi"
            icon={UserCheck}
            trend={{
              value: onLeaveToday > 0 ? `${onLeaveToday}` : "0",
              direction: "down",
              isPositive: false,
            }}
            href="/hr/leaves"
          />

          <StatCard
            headingId="kpi-new-joiners"
            label="NEW JOINERS"
            value={newJoinersThisMonth}
            note="Joined this month"
            tone="amber"
            variant="kpi"
            icon={UserPlus}
            trend={
              newJoinersLastMonth > 0
                ? {
                    value: `${Math.round(((newJoinersThisMonth - newJoinersLastMonth) / newJoinersLastMonth) * 100)}%`,
                    direction:
                      newJoinersThisMonth >= newJoinersLastMonth
                        ? "up"
                        : "down",
                    isPositive: newJoinersThisMonth >= newJoinersLastMonth,
                  }
                : newJoinersThisMonth > 0
                  ? {
                      value: `+${newJoinersThisMonth}`,
                      direction: "up",
                      isPositive: true,
                    }
                  : undefined
            }
            href="/hr/employees"
          />
        </div>
      </section>

      {/* Middle Row: Analytics & Activities (Exact Reference) */}
      <section
        aria-label="Workforce analytics and activities"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12 stagger-2 animate-reveal"
      >
        <div className="lg:col-span-5">
          <DepartmentBarChart data={departmentData} />
        </div>
        <div className="lg:col-span-4">
          <EmployeeDistributionDonut
            totalCount={totalEmployees}
            segments={distributionSegments}
          />
        </div>
        <div className="lg:col-span-3">
          <RecentActivitiesCard activities={recentActivities} />
        </div>
      </section>

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
                  <SpringGlideSegmentedControl
                    ariaLabel="Leave period"
                    options={[
                      { id: "month", label: "This month" },
                      { id: "all", label: "All time" },
                    ]}
                    value={leaveMode}
                    onChange={setLeaveMode}
                  />
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
