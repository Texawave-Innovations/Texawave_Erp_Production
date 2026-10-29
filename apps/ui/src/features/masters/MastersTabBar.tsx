"use client";

import {
  Briefcase,
  Landmark,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@texawave-erp/ui-kit";

type MasterTabId = "sales-document" | "hr" | "finance" | "projects" | "scm";

interface MasterTab {
  id: MasterTabId;
  label: string;
  icon: typeof ShoppingCart;
  path?: string;
}

const TABS: MasterTab[] = [
  {
    id: "sales-document",
    label: "Sales & Document Masters",
    icon: ShoppingCart,
    path: "/settings/sales-settings",
  },
  { id: "hr", label: "HR Master", icon: Users, path: "/settings/masters/hr" },
  {
    id: "finance",
    label: "Finance Master",
    icon: Landmark,
    path: "/settings/masters/finance",
  },
  {
    id: "projects",
    label: "Projects Master",
    icon: Briefcase,
    path: "/settings/masters/projects",
  },
  {
    id: "scm",
    label: "SCM Master",
    icon: Package,
    path: "/settings/masters/scm",
  },
];

export interface MastersTabBarProps {
  /** Which tab to render as active — the caller's own page, not derived
   * from the URL, since both sales-settings and HR Master live at
   * unrelated paths. */
  active: MasterTabId;
}

/** Secondary nav shown above the Sales & Document Masters, HR Master,
 * Finance Master, Projects Master, and SCM Master screens, letting a user
 * jump between master-data areas. Finance Master is just the master-list
 * foundation (Expense Types/Payment Modes) ahead of the rest of that
 * module; SCM Master is the same foundation for SCM (Supplier Types/Package
 * Types/Warehouse Types/Stock Adjustment Reasons); Projects Master is the
 * project-code configuration screen (project type registry + code/task
 * numbering formats), not the full project registry — see
 * Docs/PROJECTS_MASTER.md. Everything beyond these master lists stays
 * "paused, not removed" per CLAUDE.md. This is a secondary nav specific to
 * the Masters area, distinct from the main app's HorizontalNavbar. */
export function MastersTabBar({ active }: MastersTabBarProps) {
  return (
    <nav
      aria-label="Masters sections"
      className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        const isDisabled = !tab.path;

        const className = cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors",
          isActive
            ? "bg-linear-to-r from-brand-600 via-brand-500 to-brand-cyan-accessible text-white shadow-theme-xs"
            : isDisabled
              ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
        );

        if (isDisabled) {
          return (
            <span
              key={tab.id}
              className={className}
              aria-disabled="true"
              title="Coming soon"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </span>
          );
        }

        return (
          <Link key={tab.id} href={tab.path as string} className={className}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
