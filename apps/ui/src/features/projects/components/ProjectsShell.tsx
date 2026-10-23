"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  FolderKanban,
  LayoutDashboard,
  Clock,
  Receipt,
  Users2,
  PieChart,
  BarChart3,
  Award,
  Plus,
} from "lucide-react";
import { ActiveTimerBanner } from "./ActiveTimerBanner";

const NAV_TABS = [
  { href: "/projects/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/list", label: "All Projects", icon: FolderKanban },
  { href: "/projects/my-work", label: "My Work & Timer", icon: Clock },
  {
    href: "/projects/expenses",
    label: "Expenses & Utilization",
    icon: Receipt,
  },
  { href: "/projects/resources", label: "Resource Capacity", icon: Users2 },
  {
    href: "/projects/budget-utilization",
    label: "Budget & Revenue",
    icon: PieChart,
  },
  { href: "/projects/analytics", label: "Analytics", icon: BarChart3 },
  {
    href: "/projects/points-master",
    label: "Gamification Points",
    icon: Award,
  },
];

export function ProjectsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Module Title Banner */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-500/15 dark:border-blue-900/40">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 right-16 h-48 w-48 rounded-full bg-blue-300/25 blur-3xl"
        />

        <div className="relative flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3.5 shadow-inner backdrop-blur-md">
            <FolderKanban className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                Enterprise Operations
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Projects & Task Management
            </h1>
            <p className="text-sm font-medium text-cyan-100/90">
              Cross-functional execution, live stopwatch time tracking,
              milestone delivery, and gamified rewards.
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <Link
            href="/projects/new"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-md transition-all hover:bg-cyan-50 hover:shadow-lg active:scale-95 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Project
          </Link>
        </div>
      </div>

      {/* Persistent Live Stopwatch Banner if user has an active timer running */}
      <ActiveTimerBanner />

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center overflow-x-auto rounded-2xl border border-gray-200 bg-white/80 p-1.5 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex gap-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/projects/dashboard" &&
                pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-500 dark:text-gray-400"}`}
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
