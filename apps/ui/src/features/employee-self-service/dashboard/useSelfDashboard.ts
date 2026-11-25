"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import type {
  ChartBar,
  ChartData,
  GaugeData,
  ItemTone,
  Kpi,
  ListItem,
  Part,
  PersonRow,
  Reminder,
} from "@/features/admin-dashboard/types";
import { pct, toPart } from "@/features/admin-dashboard/format";
import { listHolidays } from "@/features/hr/holidays/api";
import { READ as HOLIDAY_READ } from "@/features/hr/holidays/permissions";
import { listMyLeaveRequests, myLeaveBalances } from "@/features/hr/leaves/api";
import { SELF_SERVICE_READ as LEAVE_READ } from "@/features/hr/leaves/permissions";
import { STATUS_LABELS as LEAVE_STATUS } from "@/features/hr/leaves/status";
import type { LeaveStatus } from "@/features/hr/leaves/types";
import { listMyTasks } from "@/features/hr/tasks/api";
import { SELF_SERVICE_READ as TASK_READ } from "@/features/hr/tasks/permissions";
import type { TaskItem } from "@/features/hr/tasks/types";
import { getMyMonth } from "@/features/timesheets/api";
import { TIMESHEET_READ } from "@/features/timesheets/permissions";
import type { MonthDay } from "@/features/timesheets/types";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { todayIso, type TodayAttendance } from "./useTodayAttendance";

// The employee's own dashboard, in the admin dashboard's widget shapes
// (features/admin-dashboard/types.ts) so it reuses those exact cards and
// animations. Every source is an existing self-service endpoint, each gated on
// its own permission: a card the employee cannot read renders "no access"
// instead of failing.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function hours(minutes: number): string {
  const h = minutes / 60;
  return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`;
}

type Status = { loading: boolean; error: boolean; retry: () => void };

function qp(q: {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}): Status {
  return {
    loading: q.isLoading,
    error: q.isError,
    retry: () => void q.refetch(),
  };
}

/** One widget from several sources: loading while any loads, an error only when all fail. */
function combine<T>(parts: Status[], ready: boolean, build: () => T): Part<T> {
  return {
    data: ready ? build() : null,
    loading: parts.some((p) => p.loading),
    error: parts.length > 0 && parts.every((p) => p.error),
    retry: () => parts.forEach((p) => p.retry()),
  };
}

const LEAVE_TONE: Record<LeaveStatus, ItemTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
  CANCELLED: "slate",
};

const PRIORITY_TONE: Record<TaskItem["priority"], ItemTone> = {
  URGENT: "error",
  HIGH: "warning",
  MEDIUM: "brand",
  LOW: "slate",
};

export interface SelfAccess {
  attendance: boolean;
  leave: boolean;
  tasks: boolean;
  timesheet: boolean;
  holidays: boolean;
}

export interface SelfDashboard {
  access: SelfAccess;
  kpis: Part<Kpi[]>;
  chart: Part<ChartData>;
  gauge: Part<GaugeData>;
  tasks: Part<ListItem[]>;
  reminder: Part<Reminder>;
  leaves: Part<PersonRow[]>;
  /** Today's target (minutes) from the HR master, for the timer ring; null = none set / unreadable. */
  todayTargetMinutes: number | null;
}

export function useSelfDashboard(attendance: TodayAttendance): SelfDashboard {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  const access: SelfAccess = {
    attendance: attendance.canRead,
    leave: usePermission(LEAVE_READ),
    tasks: usePermission(TASK_READ),
    timesheet: usePermission(TIMESHEET_READ),
    holidays: usePermission(HOLIDAY_READ),
  };
  const key = (...parts: (string | number)[]) =>
    orgScopedKey(orgId, "self-dashboard", ...parts);
  const on = orgId > 0;

  const today = todayIso();
  const month = today.slice(0, 7);
  const weekStart = shiftIso(today, -6);
  const prevMonth = weekStart.slice(0, 7);

  const thisMonth = useQuery({
    queryKey: key("month", month),
    queryFn: () => getMyMonth(month),
    enabled: on && access.timesheet,
    refetchInterval: 60_000,
  });
  // The 7-day chart reaches into last month during the first week of a month.
  const lastMonth = useQuery({
    queryKey: key("month", prevMonth),
    queryFn: () => getMyMonth(prevMonth),
    enabled: on && access.timesheet && prevMonth !== month,
  });
  const balances = useQuery({
    queryKey: key("leave-balances"),
    queryFn: () => myLeaveBalances(),
    enabled: on && access.leave,
  });
  const leaveRequests = useQuery({
    queryKey: key("leave-requests"),
    queryFn: () => listMyLeaveRequests({ page: 1, limit: 5 }),
    enabled: on && access.leave,
  });
  const tasks = useQuery({
    queryKey: key("tasks"),
    queryFn: () => listMyTasks({ page: 1, limit: 100 }),
    enabled: on && access.tasks,
  });
  const holidays = useQuery({
    queryKey: key("holidays", today),
    queryFn: () =>
      listHolidays({ page: 1, limit: 10, from: today, isActive: true }),
    enabled: on && access.holidays,
  });

  const openTasks = (tasks.data?.data ?? []).filter(
    (t) => t.status === "PENDING" || t.status === "IN_PROGRESS",
  );
  const paidAvailable = (balances.data ?? []).reduce(
    (sum, b) => sum + (b.isPaid && b.available !== null ? b.available : 0),
    0,
  );
  const pendingLeave = (balances.data ?? []).reduce(
    (sum, b) => sum + b.pending,
    0,
  );

  // ── KPI row ──
  const kpiSources: Status[] = [];
  if (access.attendance) kpiSources.push(qp(attendance.query));
  if (access.leave) kpiSources.push(qp(balances));
  if (access.tasks) kpiSources.push(qp(tasks));
  if (access.timesheet) kpiSources.push(qp(thisMonth));
  const kpis = combine<Kpi[]>(
    kpiSources,
    kpiSources.length > 0 && !kpiSources.some((s) => s.loading),
    () => {
      const s = attendance.summary;
      const summary = thisMonth.data?.summary;
      const overdue = openTasks.filter((t) => t.isOverdue).length;
      return [
        {
          id: "present",
          label: "Present Days",
          value:
            access.attendance && !attendance.query.isError ? s.present : null,
          format: "number",
          note: `${s.absent} absent · ${s.leave} on leave this month`,
          direction: s.absent > 0 ? "down" : "up",
          href: "/portal/attendance",
        },
        {
          id: "leave-balance",
          label: "Leave Balance",
          value: access.leave && balances.data ? paidAvailable : null,
          format: "number",
          note:
            pendingLeave > 0
              ? `${pendingLeave} day(s) awaiting approval`
              : "Paid days available",
          direction: "flat",
          href: "/portal/leave",
        },
        {
          id: "open-tasks",
          label: "Open Tasks",
          value: access.tasks && tasks.data ? openTasks.length : null,
          format: "number",
          note: overdue > 0 ? `${overdue} overdue` : "Nothing overdue",
          direction: overdue > 0 ? "down" : "flat",
          href: "/portal/tasks",
        },
        {
          id: "hours-month",
          label: "Hours This Month",
          value:
            access.timesheet && summary
              ? Math.round(summary.workedMinutes / 60)
              : null,
          format: "number",
          note: summary
            ? `${hours(summary.loggedMinutes)} logged in timesheets`
            : "Worked hours",
          direction: "up",
          href: "/portal/timesheet",
        },
      ];
    },
  );

  // ── Working hours, last 7 days ──
  const days = new Map<string, MonthDay>();
  for (const d of [
    ...(lastMonth.data?.days ?? []),
    ...(thisMonth.data?.days ?? []),
  ]) {
    days.set(d.date, d);
  }
  const chartReady =
    thisMonth.data !== undefined &&
    (prevMonth === month || lastMonth.data !== undefined);
  const chart = combine<ChartData>(
    access.timesheet
      ? [qp(thisMonth), ...(prevMonth !== month ? [qp(lastMonth)] : [])]
      : [],
    chartReady,
    () => {
      const bars: ChartBar[] = Array.from({ length: 7 }, (_, i) => {
        const date = shiftIso(weekStart, i);
        const d = days.get(date);
        const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
        const worked = d?.workedMinutes ?? 0;
        const target = d?.targetMinutes;
        return {
          label: weekday,
          full: `${weekday}, ${shortDate(date)}: ${hours(worked)} worked${
            target ? ` of ${hours(target)}` : ""
          }${d?.attendanceStatus ? ` · ${d.attendanceStatus.replace(/_/g, " ").toLowerCase()}` : ""}`,
          value: Math.round((worked / 60) * 10) / 10,
          muted: worked === 0,
          href: "/portal/timesheet",
        };
      });
      return { format: "number", focusIndex: bars.length - 1, bars };
    },
  );

  // ── Attendance this month ──
  const gauge = toPart(attendance.query, (): GaugeData => {
    const { present, absent, leave } = attendance.summary;
    const counted = present + absent + leave;
    return {
      percent: pct(present, counted),
      caption: "Attendance this month",
      segments: [
        { label: "Present", value: present, kind: "solid" },
        { label: "On leave", value: leave, kind: "dark" },
        { label: "Absent", value: absent, kind: "striped" },
      ],
    };
  });

  // ── My tasks: open work, overdue first, then by due date ──
  const taskList = toPart(tasks, (): ListItem[] =>
    [...openTasks]
      .sort(
        (a, b) =>
          Number(b.isOverdue) - Number(a.isOverdue) ||
          a.dueDate.localeCompare(b.dueDate),
      )
      .slice(0, 5)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        meta: `${t.isOverdue ? "Overdue since" : "Due"} ${shortDate(t.dueDate)}`,
        href: "/portal/tasks",
        tone: t.isOverdue ? "error" : PRIORITY_TONE[t.priority],
        badge: t.isOverdue
          ? "Overdue"
          : t.priority.charAt(0) + t.priority.slice(1).toLowerCase(),
      })),
  );

  // ── Reminder: the next approved leave, else the next holiday ──
  const nextLeave = (leaveRequests.data?.data ?? [])
    .filter((r) => r.status === "APPROVED" && r.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const nextHoliday = [...(holidays.data?.data ?? [])]
    .filter((h) => h.holidayDate >= today)
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))[0];
  const reminderSources: Status[] = [];
  if (access.leave) reminderSources.push(qp(leaveRequests));
  if (access.holidays) reminderSources.push(qp(holidays));
  const reminder = combine<Reminder>(
    reminderSources,
    reminderSources.length > 0 && !reminderSources.some((s) => s.loading),
    () => {
      const leaveFirst =
        nextLeave &&
        (!nextHoliday || nextLeave.startDate <= nextHoliday.holidayDate);
      if (leaveFirst && nextLeave) {
        const starts = nextLeave.startDate <= today;
        return {
          headline: `${nextLeave.leaveType.name}${starts ? " · on leave" : ""}`,
          lines: [
            `${shortDate(nextLeave.startDate)}${
              nextLeave.endDate !== nextLeave.startDate
                ? ` – ${shortDate(nextLeave.endDate)}`
                : ""
            } · ${nextLeave.leaveDays} day(s)`,
            starts
              ? "Your approved leave is in progress"
              : "Approved leave coming up",
          ],
          cta: { label: "Open leave tracker", href: "/portal/leave" },
        };
      }
      if (nextHoliday) {
        const isToday = nextHoliday.holidayDate === today;
        return {
          headline: nextHoliday.name,
          lines: [
            isToday
              ? "Holiday today"
              : `Holiday on ${new Date(`${nextHoliday.holidayDate}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}`,
            ...(nextHoliday.description ? [nextHoliday.description] : []),
          ],
          cta: { label: "View holidays", href: "/portal/leave" },
        };
      }
      return {
        headline: "Nothing coming up",
        lines: ["No approved leave or holidays ahead"],
        cta: { label: "Apply for leave", href: "/portal/leave" },
      };
    },
  );

  // ── My leave requests ──
  const leaves = toPart(leaveRequests, (env): PersonRow[] =>
    env.data.map((r) => ({
      id: `leave-${r.id}`,
      name: r.leaveType.name,
      sub: `${shortDate(r.startDate)}${
        r.endDate !== r.startDate ? ` – ${shortDate(r.endDate)}` : ""
      } · ${r.leaveDays} day(s)`,
      href: "/portal/leave",
      badge: LEAVE_STATUS[r.status],
      tone: LEAVE_TONE[r.status],
    })),
  );

  return {
    access,
    kpis,
    chart,
    gauge,
    tasks: taskList,
    reminder,
    leaves,
    todayTargetMinutes: days.get(today)?.targetMinutes ?? null,
  };
}
