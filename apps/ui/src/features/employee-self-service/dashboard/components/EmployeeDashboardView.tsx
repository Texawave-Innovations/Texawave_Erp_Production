"use client";

import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CircleCheck,
  CircleX,
  FolderOpen,
  Sunrise,
  User,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@texawave-erp/ui-kit";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { usePortalNavGroups } from "../../portal/nav";
import { useTodayAttendance } from "../useTodayAttendance";
import { AttendanceClockCard } from "./AttendanceClockCard";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function longDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

interface QuickLink {
  label: string;
  desc: string;
  icon: LucideIcon;
  path: string;
  iconBg: string;
  card: string;
}

// Legacy EmployeeDashboard "Quick Links", same order/labels/descriptions.
// "Log Work" (→ My Timesheet) is not listed: the work-log module was removed
// from this ERP.
const QUICK_LINKS: QuickLink[] = [
  {
    label: "Attendance",
    desc: "View attendance history",
    icon: Calendar,
    path: "/portal/attendance",
    iconBg: "bg-teal-600",
    card: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300",
  },
  {
    label: "Leave Tracker",
    desc: "Leaves & holidays",
    icon: CalendarDays,
    path: "/portal/leave",
    iconBg: "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan",
    card: "border-brand-200/60 bg-brand-50/50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300",
  },
  {
    label: "My Profile",
    desc: "View your details",
    icon: User,
    path: "/portal/profile",
    iconBg: "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan",
    card: "border-sky-200/70 bg-sky-50/70 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  },
  {
    label: "Documents",
    desc: "View uploaded files",
    icon: FolderOpen,
    path: "/portal/documents",
    iconBg: "bg-amber-500",
    card: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  },
];

/**
 * The employee portal home, laid out like the legacy dashboard
 * (TexaWave_ERP_old src/modules/employee/EmployeeDashboard.tsx): greeting
 * banner → attendance clock card → this month's Present / Absent / Leave
 * tiles → quick links.
 */
export function EmployeeDashboardView() {
  const employee = useMyEmployee();
  const attendance = useTodayAttendance();
  const { groups } = usePortalNavGroups();

  const allowedPaths = new Set(
    groups.flatMap((g) => g.items.map((i) => i.path)),
  );
  const quickLinks = QUICK_LINKS.filter((l) => allowedPaths.has(l.path));
  const firstName = employee.data?.fullName.split(" ")[0] ?? "";

  const tiles = [
    {
      label: "Present",
      value: attendance.summary.present,
      icon: CircleCheck,
      bg: "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan",
    },
    {
      label: "Absent",
      value: attendance.summary.absent,
      icon: CircleX,
      bg: "bg-linear-to-br from-red-500 to-rose-600",
    },
    {
      label: "Leave",
      value: attendance.summary.leave,
      icon: CalendarDays,
      bg: "bg-linear-to-br from-amber-400 to-orange-500",
    },
  ];

  return (
    <div className="max-w-5xl space-y-5">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan p-5 text-white shadow-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-10"
        >
          <div className="absolute right-0 top-0 h-56 w-56 -translate-y-16 translate-x-16 rounded-full bg-white" />
          <div className="absolute bottom-0 left-24 h-40 w-40 translate-y-12 rounded-full bg-white" />
        </div>
        <div className="relative">
          <div className="mb-1 flex items-center gap-1.5 opacity-80">
            <Sunrise className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs">{longDate()}</span>
          </div>
          <h1 className="text-xl font-bold">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="mt-0.5 text-xs opacity-60">Have a productive day!</p>
          {employee.data ? (
            <p className="mt-0.5 text-xs opacity-40">
              {employee.data.employeeCode} · Employee Portal
            </p>
          ) : null}
        </div>
      </div>

      {/* Attendance clock card */}
      {attendance.canRead ? (
        <AttendanceClockCard attendance={attendance} />
      ) : null}

      {/* Stats row — this month */}
      {attendance.canRead ? (
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <Card
              key={t.label}
              tone="none"
              className={`overflow-hidden p-0 shadow-sm transition-shadow hover:shadow-md ${t.bg}`}
            >
              <div className="flex items-center gap-3 p-4 text-white">
                <t.icon
                  className="h-5 w-5 shrink-0 opacity-80"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums">
                    {attendance.query.isPending ? "–" : t.value}
                  </p>
                  <p className="mt-1 text-xs opacity-85">
                    {t.label} · This month
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Quick links */}
      {quickLinks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            Quick Links
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quickLinks.map((l) => (
              <Link
                key={l.path}
                href={l.path}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500 ${l.card}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${l.iconBg}`}
                >
                  <l.icon className="h-4 w-4 text-white" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-none">
                    {l.label}
                  </span>
                  <span className="mt-0.5 block text-xs opacity-70">
                    {l.desc}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 opacity-40"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
