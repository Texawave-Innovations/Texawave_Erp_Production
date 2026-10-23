"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  Banknote,
  Receipt,
  ListTodo,
  Ticket,
  LogIn,
  LogOut,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  User,
  Percent,
  Landmark,
  FileText,
} from "lucide-react";
import { Button, Card, Skeleton, useToast } from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useMyEmployee } from "@/features/onboarding/hooks";
import {
  useCheckIn,
  useCheckOut,
  useMyAttendance,
} from "@/features/hr/attendance/hooks";
import { formatTime } from "@/features/hr/attendance/status";
import { useMyLeaveBalances } from "@/features/hr/leaves/hooks";
import { useMyTasks } from "@/features/hr/tasks/hooks";
import { useMyTickets } from "@/features/hr/tickets/hooks";
import { HrPageHeader } from "@/features/hr/components";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function formatFriendlyDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function describePunchError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "ALREADY_CHECKED_IN") {
      return "You are already checked in.";
    }
    if (error.errorCode === "NOT_CHECKED_IN") {
      return "You are not checked in.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to punch attendance.";
    }
    return error.message;
  }
  return "Something went wrong with the punch. Try again.";
}

export default function PortalHomePage() {
  const { toast } = useToast();
  const employee = useMyEmployee();

  // Attendance
  const [punchBusy, setPunchBusy] = useState(false);
  const attendanceQuery = useMyAttendance({
    page: 1,
    limit: 5,
    from: todayIso(),
    to: todayIso(),
  });
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const todayRow = attendanceQuery.data?.data.find(
    (r) => r.attendanceDate === todayIso(),
  );
  const checkedIn = todayRow?.hasOpenSession ?? false;

  const currentPunchTime = useMemo(() => {
    if (!todayRow || todayRow.sessions.length === 0) return null;
    const latest = todayRow.sessions[todayRow.sessions.length - 1];
    return latest ? formatTime(latest.checkInAt) : null;
  }, [todayRow]);

  async function handlePunch() {
    setPunchBusy(true);
    try {
      if (checkedIn) {
        await checkOut.mutateAsync();
        toast({ title: "Checked out successfully", variant: "success" });
      } else {
        await checkIn.mutateAsync();
        toast({ title: "Checked in successfully", variant: "success" });
      }
      void attendanceQuery.refetch();
    } catch (err) {
      toast({
        title: "Punch failed",
        description: describePunchError(err),
        variant: "error",
      });
    } finally {
      setPunchBusy(false);
    }
  }

  // Leave balances
  const leaveBalancesQuery = useMyLeaveBalances();
  const balances = leaveBalancesQuery.data ?? [];

  // Recent tasks
  const tasksQuery = useMyTasks({ page: 1, limit: 4 });
  const tasks = tasksQuery.data?.data ?? [];

  // Recent tickets
  const ticketsQuery = useMyTickets({ page: 1, limit: 4 });
  const tickets = ticketsQuery.data?.data ?? [];

  if (employee.isLoading) {
    return (
      <div className="space-y-6 font-sans">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  const emp = employee.data;
  const greeting = getGreeting();

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Primary Header Banner (Reusing HrPageHeader with primary banner gradient) */}
      <HrPageHeader
        title={`${greeting}, ${emp?.fullName?.split(" ")[0] ?? "Team Member"}!`}
        description={`Employee Self-Service · ID: ${emp?.employeeCode ?? "EMP"} · ${formatFriendlyDate()}`}
        icon3d="dashboard"
        badge={
          <span className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-0.5 text-xs font-bold text-[#0a3271] shadow-2xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-200">
            Active Employee
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/portal/profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/90 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-[#0a3271] hover:bg-white shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <User className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>My Profile</span>
            </Link>
            <Link
              href="/portal/leave"
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#1769F5] to-[#0284c7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-[#155edb] hover:to-[#0275b1] transition-all"
            >
              <CalendarCheck className="h-4 w-4" />
              <span>Apply Leave</span>
            </Link>
          </div>
        }
      />

      {/* Top 3 Interactive Metrics & Status Cards with Visible Borders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Today's Attendance & Quick Punch */}
        <Card className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Today&apos;s Attendance
                </span>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  checkedIn
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                {checkedIn ? "Checked In" : "Not Checked In"}
              </span>
            </div>

            <div className="py-4 space-y-1">
              <div className="text-2xl font-bold text-[#0a3271] dark:text-sky-100">
                {checkedIn ? (currentPunchTime ?? "Active") : "— : —"}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {checkedIn
                  ? `Clocked in today at ${currentPunchTime ?? "earlier"}`
                  : "Start your workday by punching in"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              variant={checkedIn ? "secondary" : "primary"}
              size="sm"
              disabled={punchBusy}
              onClick={handlePunch}
              className={`w-full rounded-xl cursor-pointer ${
                checkedIn
                  ? "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  : "bg-linear-to-r from-[#1769F5] to-[#0284c7] text-white hover:from-[#155edb] hover:to-[#0275b1]"
              }`}
            >
              {checkedIn ? (
                <>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  <span>Punch Out</span>
                </>
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  <span>Punch In Now</span>
                </>
              )}
            </Button>
            <Link
              href="/portal/attendance"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition-colors"
            >
              <span>View Attendance History</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

        {/* Card 2: Leave Balances Overview */}
        <Card className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Leave Balances
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {new Date().getFullYear()}
              </span>
            </div>

            <div className="py-3 space-y-2.5">
              {balances.length > 0 ? (
                balances.slice(0, 3).map((item) => {
                  const available = item.available ?? 0;
                  const total = Math.max(item.entitlement, 1);
                  const pct = Math.min(
                    100,
                    Math.max(0, Math.round((available / total) * 100)),
                  );
                  return (
                    <div
                      key={item.leaveTypeId}
                      className="rounded-xl border border-sky-100/80 bg-sky-50/40 p-2.5 space-y-1.5 dark:border-slate-800 dark:bg-slate-850"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {item.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          <strong className="text-[#0a3271] dark:text-sky-200">
                            {available}
                          </strong>{" "}
                          / {item.entitlement} days
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-sky-500 to-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  No leave balances available.
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/portal/leave"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition-colors"
            >
              <span>Manage & Request Leaves</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

        {/* Card 3: Pay & Benefits */}
        <Card className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                  <Banknote className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Pay & Benefits
                </span>
              </div>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Self-Service
              </span>
            </div>

            <div className="py-3 space-y-2">
              <Link
                href="/portal/payslips"
                className="flex items-center justify-between rounded-xl border border-sky-100/90 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-sky-600" />
                  <span>Monthly Payslips</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link
                href="/portal/tax"
                className="flex items-center justify-between rounded-xl border border-sky-100/90 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-sky-600" />
                  <span>Tax Declarations & Form 16</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link
                href="/portal/loans"
                className="flex items-center justify-between rounded-xl border border-sky-100/90 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-sky-600" />
                  <span>Company Loans & Advances</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/portal/payslips"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition-colors"
            >
              <span>Download Salary Slips</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* 6 Quick Action Hub Tiles with Crisp Visible Borders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-200">
            Quick Actions & Self-Service Hub
          </h2>
          <span className="text-xs text-slate-400">
            Everything you need in one place
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tile 1: Apply Leave */}
          <Link
            href="/portal/leave"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-[#1769F5] hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1769F5] border border-sky-200 group-hover:bg-[#1769F5] group-hover:text-white transition-colors dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-[#1769F5] dark:text-slate-100 transition-colors">
                  Apply Leave
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#1769F5] group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Submit time-off requests, check manager approvals, and review
                leave history.
              </p>
            </div>
          </Link>

          {/* Tile 2: Punch & Attendance */}
          <Link
            href="/portal/attendance"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-cyan-500 hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 group-hover:bg-cyan-600 group-hover:text-white transition-colors dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-cyan-600 dark:text-slate-100 transition-colors">
                  My Attendance
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Daily clock-in/out records, monthly presence reports, and shift
                summaries.
              </p>
            </div>
          </Link>

          {/* Tile 3: My Payslips */}
          <Link
            href="/portal/payslips"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 dark:text-slate-100 transition-colors">
                  My Payslips
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Download PDF salary statements, bonus breakdowns, and deduction
                details.
              </p>
            </div>
          </Link>

          {/* Tile 4: Expense Claims */}
          <Link
            href="/portal/expense-claims"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-amber-600 dark:text-slate-100 transition-colors">
                  Expense Claims
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Submit claims for travel and business expenses with digital bill
                receipts.
              </p>
            </div>
          </Link>

          {/* Tile 5: My Tasks */}
          <Link
            href="/portal/tasks"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              <ListTodo className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 dark:text-slate-100 transition-colors">
                  My Tasks
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Keep track of assigned tasks, update completion progress, and
                view deadlines.
              </p>
            </div>
          </Link>

          {/* Tile 6: Support Tickets */}
          <Link
            href="/portal/tickets"
            className="group flex items-start gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs hover:border-sky-500 hover:shadow-md hover:-translate-y-0.5 transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-200 group-hover:bg-sky-600 group-hover:text-white transition-colors dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 group-hover:text-sky-600 dark:text-slate-100 transition-colors">
                  Support Tickets
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                Raise queries for HR policy, salary corrections, or IT hardware
                issues.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 2-Column Activity Feeds: Tasks & Tickets with Crisp Visible Borders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Assigned Tasks */}
        <Card className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Assigned Tasks
                </h3>
              </div>
              <Link
                href="/portal/tasks"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                View all ({tasks.length})
              </Link>
            </div>

            <div className="divide-y divide-sky-100 dark:divide-slate-800">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Due: {task.dueDate ? task.dueDate : "No due date"} · By{" "}
                        {task.assignedBy?.fullName ?? "Manager"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        task.status === "DONE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : task.status === "IN_PROGRESS"
                            ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No pending tasks!
                  </p>
                  <p className="text-[11px]">
                    You are all caught up with your assignments.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-sky-100 dark:border-slate-800 mt-2">
            <Link
              href="/portal/tasks"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              <span>Manage your task queue</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Right Column: Support Tickets */}
        <Card className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Helpdesk & Support Requests
                </h3>
              </div>
              <Link
                href="/portal/tickets"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                View all ({tickets.length})
              </Link>
            </div>

            <div className="divide-y divide-sky-100 dark:divide-slate-800">
              {tickets.length > 0 ? (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {t.subject}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Category: {t.category} · #{t.id}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        t.status === "RESOLVED" || t.status === "CLOSED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : t.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <Ticket className="h-7 w-7 text-sky-300 mx-auto" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No open tickets
                  </p>
                  <p className="text-[11px]">
                    Need assistance with HR policies, attendance, or IT
                    equipment?
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-sky-100 dark:border-slate-800 mt-2">
            <Link
              href="/portal/tickets"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              <span>Raise or track support tickets</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
