"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Network,
  Briefcase,
  FileSpreadsheet,
  Clock,
  CalendarCheck,
  MapPin,
  ListTodo,
  Calendar,
  CalendarDays,
  Award,
  Receipt,
  Ticket,
  UserMinus,
  Banknote,
  Building2,
  UsersRound,
  Shield,
  Menu as MenuIcon,
  Tag,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

export interface SubNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: SubNavItem[];
}

export const HR_NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/hr/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    items: [
      {
        id: "employees",
        label: "Employees",
        path: "/hr/employees",
        icon: Users,
      },
      {
        id: "org-chart",
        label: "Org Chart",
        path: "/hr/org-chart",
        icon: Network,
      },
      {
        id: "recruitment",
        label: "Recruitment",
        path: "/hr/recruitment",
        icon: Briefcase,
      },
      {
        id: "exit-requests",
        label: "Exit Requests",
        path: "/hr/exit-requests",
        icon: UserMinus,
      },
    ],
  },
  {
    id: "time-attendance",
    label: "Time & Attendance",
    items: [
      {
        id: "attendance",
        label: "Attendance",
        path: "/hr/attendance",
        icon: Clock,
      },
      {
        id: "regularization",
        label: "Regularization",
        path: "/hr/regularization",
        icon: CalendarCheck,
      },
      {
        id: "work-logs",
        label: "Work Logs",
        path: "/hr/work-logs",
        icon: FileSpreadsheet,
      },
      {
        id: "location-privilege",
        label: "Location Privilege",
        path: "/hr/location-privilege",
        icon: MapPin,
      },
      {
        id: "full-month-present",
        label: "Full Month Present",
        path: "/hr/full-month-present",
        icon: Award,
      },
    ],
  },
  {
    id: "leave-holidays",
    label: "Leave & Calendar",
    items: [
      {
        id: "leaves",
        label: "Leaves",
        path: "/hr/leaves",
        icon: Calendar,
      },
      {
        id: "holidays",
        label: "Holidays",
        path: "/hr/holidays",
        icon: CalendarDays,
      },
    ],
  },
  {
    id: "operations-claims",
    label: "Operations & Claims",
    items: [
      {
        id: "tasks",
        label: "Tasks",
        path: "/hr/tasks",
        icon: ListTodo,
      },
      {
        id: "expense-approvals",
        label: "Expense Approvals",
        path: "/hr/expense-approvals",
        icon: Receipt,
      },
      {
        id: "tickets",
        label: "Employee Tickets",
        path: "/hr/tickets",
        icon: Ticket,
      },
      {
        id: "payroll",
        label: "Payroll",
        path: "/hr/payroll",
        icon: Banknote,
      },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    items: [
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
    ],
  },
];

const SETTINGS_NAV_ITEMS: SubNavItem[] = [
  {
    id: "users",
    label: "Users & Accounts",
    path: "/admin/users",
    icon: Users,
  },
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

export interface DynamicSidebarProps {
  open?: boolean;
  onNavigate?: () => void;
}

function checkIsActive(item: SubNavItem, pathname: string): boolean {
  if (item.exact || item.id === "dashboard") {
    return (
      pathname === item.path ||
      pathname === "/hr" ||
      pathname === "/hr/dashboard"
    );
  }

  if (item.id === "departments") {
    return (
      pathname.startsWith("/hr/departments") ||
      pathname.startsWith("/admin/departments")
    );
  }

  if (item.id === "users") {
    return pathname.startsWith("/admin/users");
  }

  if (item.id === "employees") {
    return pathname.startsWith("/hr/employees");
  }

  if (item.id === "roles") {
    return (
      pathname.startsWith("/settings/roles") ||
      pathname.startsWith("/admin/roles")
    );
  }

  return pathname.startsWith(item.path);
}

/**
 * Reusable Navigation Item Component conforming to TEXA Design System.
 */
export function NavigationItem({
  item,
  isActive,
  onNavigate,
}: {
  item: SubNavItem;
  isActive: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <Link
      href={item.path}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-theme-xs font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand-500 ${
        isActive
          ? "bg-brand-50 text-brand-800 font-semibold shadow-theme-xs dark:bg-brand-950 dark:text-brand-300"
          : "text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-white"
      }`}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-brand-500"
          aria-hidden="true"
        />
      )}
      <item.icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive
            ? "text-brand-600 dark:text-brand-400"
            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
        }`}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Reusable Expandable/Collapsible Navigation Group.
 */
export function NavigationGroup({
  group,
  pathname,
  isCollapsed,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  const hasActiveChild = group.items.some((item) =>
    checkIsActive(item, pathname),
  );

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={`nav-group-${group.id}`}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <span className="flex items-center gap-1.5">
          {hasActiveChild && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500"
              aria-hidden="true"
            />
          )}
          <span>{group.label}</span>
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${
            isCollapsed ? "-rotate-90" : "rotate-0"
          }`}
          aria-hidden="true"
        />
      </button>

      {!isCollapsed && (
        <div
          id={`nav-group-${group.id}`}
          className="mt-0.5 flex flex-col gap-0.5 pl-1 transition-all"
        >
          {group.items.map((item) => (
            <NavigationItem
              key={item.id}
              item={item}
              isActive={checkIsActive(item, pathname)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tier 2 Contextual ERP Sub-Navigation Sidebar.
 * Displays dedicated tabs for the active primary module (HR, Settings, etc.).
 * Conforms to Reference C and Docs/DESIGN_SYSTEM.md.
 */
export function DynamicSidebar({ open, onNavigate }: DynamicSidebarProps = {}) {
  const pathname = usePathname();

  // Detect whether user is in HR or Settings/Administration
  const isSettingsContext =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reference") ||
    pathname.startsWith("/admin/users") ||
    pathname === "/admin/roles" ||
    pathname === "/admin/menu";

  const headerTitle = isSettingsContext ? "Settings" : "Human Resources";

  // Track collapsed groups; auto-expand groups that contain active items
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  // Auto-expand group containing current route when pathname changes
  useEffect(() => {
    if (!isSettingsContext) {
      HR_NAV_GROUPS.forEach((group) => {
        const containsActive = group.items.some((item) =>
          checkIsActive(item, pathname),
        );
        if (containsActive) {
          setCollapsedGroups((prev) => ({ ...prev, [group.id]: false }));
        }
      });
    }
  }, [pathname, isSettingsContext]);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  const onAsideClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a") && onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside
      id="app-sidebar"
      onClick={onAsideClick}
      className={`flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
        open !== undefined
          ? open
            ? "translate-x-0"
            : "invisible -translate-x-full lg:visible lg:translate-x-0"
          : ""
      }`}
    >
      {/* Section Module Header aligned with Primary Sidebar */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-theme-xs font-bold tracking-tight text-gray-900 dark:text-white">
              {headerTitle}
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              Enterprise Module
            </p>
          </div>
        </div>
      </div>

      {/* Sequential Sub-Navigation List with smooth scroll */}
      <nav
        aria-label={`${headerTitle} Navigation`}
        className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3"
      >
        {isSettingsContext ? (
          <div className="flex flex-col gap-0.5">
            {SETTINGS_NAV_ITEMS.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={checkIsActive(item, pathname)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          HR_NAV_GROUPS.map((group) => (
            <NavigationGroup
              key={group.id}
              group={group}
              pathname={pathname}
              isCollapsed={collapsedGroups[group.id] === true}
              onToggle={() => toggleGroup(group.id)}
              onNavigate={onNavigate}
            />
          ))
        )}
      </nav>
    </aside>
  );
}
