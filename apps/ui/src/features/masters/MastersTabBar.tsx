"use client";

import { Briefcase, Landmark, ShoppingCart, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@texawave-erp/ui-kit";

type MasterTabId = "sales-document" | "hr" | "finance" | "projects";

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
  },
  { id: "hr", label: "HR Master", icon: Users },
  {
    id: "finance",
    label: "Finance Master",
    icon: Landmark,
    path: "/settings/masters/finance",
  },
  { id: "projects", label: "Projects Master", icon: Briefcase },
];

export interface MastersTabBarProps {
  /** Which tab to render as active — the caller's own page, not derived
   * from the URL, since both sales-settings and HR Master live at
   * unrelated paths. */
  active: MasterTabId;
}

/** Secondary nav shown above the Sales & Document Masters, HR Master, and
 * Finance Master screens, letting a user jump between master-data areas.
 * Projects is visually present but disabled (no route yet) — matching the
 * Sales/Purchases/Finance/Inventory/Vault/Projects "paused, not removed"
 * status in CLAUDE.md; Finance Master itself is just the master-list
 * foundation (Expense Types/Payment Modes) ahead of the rest of that
 * module. This is a secondary nav specific to the Masters area, distinct
 * from the main app's HorizontalNavbar. */
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
