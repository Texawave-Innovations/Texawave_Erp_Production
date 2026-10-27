"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { ActiveTimerBanner } from "./ActiveTimerBanner";
import { PageBanner } from "./PageBanner";

export function ProjectsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboardTab = pathname === "/projects/dashboard";

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Module Title Banner — Dashboard tab only */}
      {isDashboardTab && (
        <PageBanner
          icon={FolderKanban}
          title="Projects & Task Management"
          description="Cross-functional execution, live stopwatch time tracking, milestone delivery, and gamified rewards."
          actions={
            <Link
              href="/projects/new"
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-md transition-all hover:bg-cyan-50 hover:shadow-lg active:scale-95 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              New Project
            </Link>
          }
        />
      )}

      {/* Persistent Live Stopwatch Banner if user has an active timer running */}
      <ActiveTimerBanner />

      {/* Page Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
