"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus, LayoutGrid, ListChecks } from "lucide-react";
import { Alert, Button } from "@texawave-erp/ui-kit";
import {
  DashboardCard,
  KpiCard,
  PartView,
  PillLink,
} from "@/features/admin-dashboard/components/DashboardCard";
import { PillBarChart } from "@/features/admin-dashboard/components/PillBarChart";
import { ProgressGauge } from "@/features/admin-dashboard/components/ProgressGauge";
import {
  ItemList,
  PeopleList,
  ReminderView,
} from "@/features/admin-dashboard/components/SideCards";
import { toPart } from "@/features/admin-dashboard/format";
import { SELF_SERVICE_CREATE as LEAVE_CREATE } from "@/features/hr/leaves/permissions";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { usePermission } from "@/hooks/usePermission";
import { useSelfDashboard } from "../useSelfDashboard";
import { useTodayAttendance } from "../useTodayAttendance";
import { TimeTrackerCard } from "./TimeTrackerCard";

const STAGGER = ["stagger-1", "stagger-2", "stagger-3", "stagger-4"] as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The employee portal home: the admin dashboard's layout, cards and
 * animations (features/admin-dashboard) scoped to the signed-in employee —
 * attendance, leave, tasks and worked hours from the existing self-service
 * endpoints (see useSelfDashboard). The Time Tracker is the hero, top-left
 * beside the key figures, because checking in / out is the page's most
 * frequent action.
 */
export function EmployeeDashboardView() {
  const router = useRouter();
  const employee = useMyEmployee();
  const attendance = useTodayAttendance();
  const board = useSelfDashboard(attendance);
  const canApplyLeave = usePermission(LEAVE_CREATE);
  const firstName = employee.data?.fullName.split(" ")[0] ?? "";
  const trackerPart = toPart(attendance.query, () => null);

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-5 pb-12"
      role="main"
      aria-label="My dashboard"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 animate-reveal">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-[#0a3271] sm:text-4xl dark:text-sky-100">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/25"
            >
              <LayoutGrid className="h-5 w-5" />
            </span>
            Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}. Your day, attendance, leave and
            work in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canApplyLeave && (
            <Button
              variant="primary"
              onClick={() => router.push("/portal/leave")}
              className="gap-2 rounded-full px-5 py-2.5 font-semibold"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Apply leave
            </Button>
          )}
          {board.access.attendance && (
            <Button
              variant="outline"
              onClick={() => router.push("/portal/attendance")}
              className="rounded-full border-sky-200 px-5 py-2.5 font-semibold text-[#0284c7] hover:bg-sky-50 dark:border-sky-800/60 dark:text-sky-300"
            >
              My attendance
            </Button>
          )}
        </div>
      </header>

      {attendance.canRead && attendance.staleOpenDate ? (
        <Alert
          dismissible
          variant="warning"
          title="You did not check out earlier"
        >
          Your session from {attendance.staleOpenDate} is still open, so a new
          check-in is refused. Ask HR to close it, or check out and raise an
          attendance correction.
        </Alert>
      ) : null}
      {attendance.canRead && attendance.pendingDates.length > 0 ? (
        <Alert dismissible variant="info" title="Waiting for HR">
          You were checked out automatically on{" "}
          {attendance.pendingDates.join(", ")}. HR needs to regularize{" "}
          {attendance.pendingDates.length === 1 ? "that day" : "those days"}{" "}
          before{" "}
          {attendance.pendingDates.length === 1 ? "it counts" : "they count"}.
        </Alert>
      ) : null}

      {/* Hero row: the Time Tracker beside the key figures (2 x 2). */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="animate-reveal stagger-1 flex xl:col-span-6">
          <TimeTrackerCard
            attendance={attendance}
            targetMinutes={attendance.targetMinutes ?? board.todayTargetMinutes}
          >
            <PartView
              part={trackerPart}
              label="today's attendance"
              skeletonHeight="h-32"
            >
              {() => null}
            </PartView>
          </TimeTrackerCard>
        </div>

        <section aria-label="My key figures" className="xl:col-span-6">
          <PartView
            part={board.kpis}
            label="your key figures"
            skeletonHeight="h-[150px]"
          >
            {(kpis) => (
              <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
                {kpis.map((kpi, i) => (
                  <KpiCard
                    key={kpi.id}
                    kpi={kpi}
                    highlighted={i === 0}
                    className={`animate-reveal ${STAGGER[i] ?? ""}`}
                  />
                ))}
              </div>
            )}
          </PartView>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <DashboardCard
          title="Working hours"
          headingId="admin-chart-heading"
          action={
            <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">
              Hours worked, last 7 days
            </span>
          }
          className="animate-reveal stagger-2 md:col-span-2 xl:col-span-6"
        >
          <PartView
            part={board.chart}
            label="working hours"
            skeletonHeight="h-48"
          >
            {(chart) => (
              <PillBarChart
                data={chart}
                label="Working hours: hours worked, last 7 days"
              />
            )}
          </PartView>
        </DashboardCard>

        <DashboardCard
          title="My Tasks"
          headingId="admin-list-heading"
          action={<PillLink href="/portal/tasks">View all</PillLink>}
          className="animate-reveal stagger-3 xl:col-span-3"
        >
          <PartView part={board.tasks} label="open tasks" skeletonHeight="h-48">
            {(items) => (
              <ItemList
                items={items}
                icon={ListChecks}
                empty="No open tasks. You're all caught up."
              />
            )}
          </PartView>
        </DashboardCard>

        <DashboardCard
          title="Reminders"
          headingId="admin-reminders-heading"
          className="animate-reveal stagger-4 xl:col-span-3"
        >
          <PartView
            part={board.reminder}
            label="reminders"
            skeletonHeight="h-40"
          >
            {(reminder) => <ReminderView reminder={reminder} />}
          </PartView>
        </DashboardCard>

        <DashboardCard
          title="Leave Requests"
          headingId="admin-people-heading"
          action={<PillLink href="/portal/leave">View all</PillLink>}
          className="animate-reveal stagger-5 md:col-span-2 xl:col-span-7"
        >
          <PartView
            part={board.leaves}
            label="leave requests"
            skeletonHeight="h-48"
          >
            {(rows) => (
              <PeopleList
                rows={rows}
                empty="You haven't requested any leave yet."
              />
            )}
          </PartView>
        </DashboardCard>

        <DashboardCard
          title="Attendance"
          headingId="admin-gauge-heading"
          className="animate-reveal stagger-6 md:col-span-2 xl:col-span-5"
        >
          <PartView part={board.gauge} label="attendance" skeletonHeight="h-48">
            {(gauge) => (
              <ProgressGauge data={gauge} label="Attendance this month" />
            )}
          </PartView>
        </DashboardCard>
      </div>
    </div>
  );
}
