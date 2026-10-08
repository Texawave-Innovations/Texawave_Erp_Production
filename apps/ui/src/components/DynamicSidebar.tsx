"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  UsersRound,
  Clock,
  Calendar,
  Banknote,
  Shield,
  Menu as MenuIcon,
  Tag,
  type LucideIcon,
} from "lucide-react";

interface SubNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

const HR_NAV_ITEMS: SubNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/hr",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    id: "employees",
    label: "Employees",
    path: "/hr/employees",
    icon: Users,
  },
  {
    id: "departments",
    label: "Departments",
    path: "/hr/departments",
    icon: Building2,
  },
  {
    id: "teams",
    label: "Teams",
    path: "/hr/teams",
    icon: UsersRound,
  },
  {
    id: "attendance",
    label: "Attendance",
    path: "/hr/attendance",
    icon: Clock,
  },
  {
    id: "leaves",
    label: "Leaves",
    path: "/hr/leaves",
    icon: Calendar,
  },
  {
    id: "payroll",
    label: "Payroll",
    path: "/hr/payroll",
    icon: Banknote,
  },
];

const SETTINGS_NAV_ITEMS: SubNavItem[] = [
  {
    id: "roles",
    label: "Roles & Permissions",
    path: "/settings/roles",
    icon: Shield,
  },
  {
    id: "menu",
    label: "Navigation Menu",
    path: "/admin/menu",
    icon: MenuIcon,
  },
  {
    id: "reference-tags",
    label: "Reference Tags",
    path: "/reference/tags",
    icon: Tag,
  },
];

/**
 * Tier 2 Contextual ERP Sub-Navigation Sidebar.
 * Displays dedicated tabs for the active primary module (HR, Settings, etc.).
 * Conforms to Docs/DESIGN_SYSTEM.md.
 */
export function DynamicSidebar() {
  const pathname = usePathname();

  // Detect whether user is in HR or Settings/Administration
  const isSettingsContext =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reference") ||
    pathname === "/admin/roles" ||
    pathname === "/admin/menu";

  const headerTitle = isSettingsContext ? "Settings" : "Human Resources";
  const navItems = isSettingsContext ? SETTINGS_NAV_ITEMS : HR_NAV_ITEMS;

  function checkIsActive(item: SubNavItem): boolean {
    if (item.exact) {
      return pathname === item.path;
    }

    if (item.id === "departments") {
      return (
        pathname.startsWith("/hr/departments") ||
        pathname.startsWith("/admin/departments")
      );
    }

    if (item.id === "employees") {
      return (
        pathname.startsWith("/hr/employees") ||
        pathname.startsWith("/admin/users")
      );
    }

    if (item.id === "roles") {
      return (
        pathname.startsWith("/settings/roles") ||
        pathname.startsWith("/admin/roles")
      );
    }

    return pathname.startsWith(item.path);
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="flex flex-col gap-3">
          {/* Section Module Header */}
          <div className="px-3 py-1 text-theme-base font-bold tracking-tight text-gray-900 dark:text-white">
            {headerTitle}
          </div>

          {/* Sequential Sub-Navigation List */}
          <nav
            aria-label={`${headerTitle} Navigation`}
            className="flex flex-col gap-1 overflow-y-auto"
          >
            {navItems.map((item) => {
              const isActive = checkIsActive(item);

              return (
                <Link
                  key={item.id}
                  href={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-theme-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <item.icon
                    className={`h-4.5 w-4.5 shrink-0 ${
                      isActive
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
