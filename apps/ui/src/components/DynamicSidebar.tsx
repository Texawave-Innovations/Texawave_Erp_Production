"use client";

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
    id: "work-logs",
    label: "Work Logs",
    path: "/hr/work-logs",
    icon: FileSpreadsheet,
  },
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
    id: "location-privilege",
    label: "Location Privilege",
    path: "/hr/location-privilege",
    icon: MapPin,
  },
  {
    id: "tasks",
    label: "Tasks",
    path: "/hr/tasks",
    icon: ListTodo,
  },
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
  {
    id: "full-month-present",
    label: "Full Month Present",
    path: "/hr/full-month-present",
    icon: Award,
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
    id: "exit-requests",
    label: "Exit Requests",
    path: "/hr/exit-requests",
    icon: UserMinus,
  },
  {
    id: "payroll",
    label: "Payroll",
    path: "/hr/payroll",
    icon: Banknote,
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

interface DynamicSidebarProps {
  open?: boolean;
  onNavigate?: () => void;
}

/**
 * Tier 2 Contextual ERP Sub-Navigation Sidebar.
 * Displays dedicated tabs for the active primary module (HR, Settings, etc.).
 * Conforms to Docs/DESIGN_SYSTEM.md.
 */
export function DynamicSidebar({ open, onNavigate }: DynamicSidebarProps = {}) {
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
      return (
        pathname === item.path ||
        (item.path === "/hr" && pathname === "/hr/dashboard")
      );
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

  const onAsideClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a") && onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside
      id="app-sidebar"
      onClick={onAsideClick}
      className={`flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
        open !== undefined
          ? open
            ? "translate-x-0"
            : "invisible -translate-x-full lg:visible lg:translate-x-0"
          : ""
      }`}
    >
      {/* Section Module Header aligned with Primary Sidebar */}
      <div className="flex h-16 shrink-0 items-center border-b border-gray-100 px-5 dark:border-gray-800">
        <h2 className="text-theme-sm font-bold tracking-tight text-gray-900 dark:text-white">
          {headerTitle}
        </h2>
      </div>

      {/* Sequential Sub-Navigation List with smooth scroll */}
      <nav
        aria-label={`${headerTitle} Navigation`}
        className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1"
      >
        {navItems.map((item) => {
          const isActive = checkIsActive(item);

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
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
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
