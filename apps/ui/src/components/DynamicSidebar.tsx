"use client";

import type { MenuTreeNode } from "@texawave-erp/api-types";
import { Skeleton } from "@texawave-erp/ui-kit";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMyMenu } from "@/features/menu/hooks";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  Contact,
  FileText,
  Network,
  Briefcase,
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
  ShieldCheck,
  Building2,
  UsersRound,
  Shield,
  Menu as MenuIcon,
  Tag,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  ShoppingCart,
  UserCheck,
  ShoppingBag,
  Package,
  Landmark,
  FolderKanban,
  ClipboardList,
  Settings,
  UserCircle,
  Percent,
  Wallet,
  User,
  Folder,
  DoorOpen,
  Sliders,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { useAuthStore } from "@/stores/auth-store";

export interface SubNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

/**
 * A link of the static HR/Settings nav. Shown only when the user's
 * permission-filtered menu contains menuCode.
 */
export interface GatedNavItem extends SubNavItem {
  menuCode: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: GatedNavItem[];
}

export interface ErpModuleItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

/**
 * Primary enterprise modules preserved from ErpPrimarySidebar.
 */
export const PRIMARY_MODULES: ErpModuleItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    path: "/hr/dashboard",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/admin/users",
  },
  { id: "sales", label: "Sales", icon: ShoppingCart, path: "#" },
  { id: "crm", label: "CRM", icon: UserCheck, path: "#" },
  { id: "purchases", label: "Purchases", icon: ShoppingBag, path: "#" },
  { id: "scm", label: "SCM", icon: Package, path: "#" },
  { id: "finance", label: "Finance", icon: Landmark, path: "#" },
  { id: "projects", label: "Projects", icon: FolderKanban, path: "#" },
  { id: "documents", label: "Document Center", icon: FileText, path: "#" },
  { id: "master-lists", label: "Master Lists", icon: ClipboardList, path: "#" },
];

/**
 * Canonical HR Navigation Groups — exactly four categories:
 * 1. Overview (Dashboard)
 * 2. People (Employees, Profiles, Employee Documents, Org Chart, Departments, Teams, Recruitment, Exit Requests)
 * 3. Time & Leave (Attendance, Regularization, Work Logs, Location Privilege, Full Month Present, Leaves, Holidays)
 * 4. Operations (Tasks, Expense Approvals, Employee Tickets, Payroll, Compliance)
 */
export const HR_NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        menuCode: "hr-dashboard",
        label: "Dashboard",
        path: "/hr/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        id: "employees",
        menuCode: "hr-employees",
        label: "Employees",
        path: "/hr/employees",
        icon: Users,
      },
      {
        id: "profiles",
        menuCode: "hr-profiles",
        label: "Profiles",
        path: "/hr/profiles",
        icon: Contact,
      },
      {
        id: "employee-documents",
        menuCode: "hr-employee-documents",
        label: "Employee Documents",
        path: "/hr/employee-documents",
        icon: FileText,
      },
      {
        id: "org-chart",
        menuCode: "hr-org-chart",
        label: "Org Chart",
        path: "/hr/org-chart",
        icon: Network,
      },
      {
        id: "departments",
        menuCode: "hr-departments",
        label: "Departments",
        path: "/hr/departments",
        icon: Building2,
      },
      {
        id: "teams",
        menuCode: "hr-teams",
        label: "Teams",
        path: "/hr/teams",
        icon: UsersRound,
      },
      {
        id: "recruitment",
        menuCode: "hr-recruitment",
        label: "Recruitment",
        path: "/hr/recruitment",
        icon: Briefcase,
      },
      {
        id: "exit-requests",
        menuCode: "hr-exit-requests",
        label: "Exit Requests",
        path: "/hr/exit-requests",
        icon: UserMinus,
      },
    ],
  },
  {
    id: "time-leave",
    label: "Time & Leave",
    items: [
      {
        id: "attendance",
        menuCode: "hr-attendance",
        label: "Attendance",
        path: "/hr/attendance",
        icon: Clock,
      },
      {
        id: "regularization",
        menuCode: "hr-regularization",
        label: "Regularization",
        path: "/hr/regularization",
        icon: CalendarCheck,
      },
      {
        id: "location-privilege",
        menuCode: "hr-location-privilege",
        label: "Location Privilege",
        path: "/hr/location-privilege",
        icon: MapPin,
      },
      {
        id: "full-month-present",
        menuCode: "hr-full-month-present",
        label: "Full Month Present",
        path: "/hr/full-month-present",
        icon: Award,
      },
      {
        id: "leaves",
        menuCode: "hr-leaves",
        label: "Leaves",
        path: "/hr/leaves",
        icon: Calendar,
      },
      {
        id: "holidays",
        menuCode: "hr-holidays",
        label: "Holidays",
        path: "/hr/holidays",
        icon: CalendarDays,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "tasks",
        menuCode: "hr-tasks",
        label: "Tasks",
        path: "/hr/tasks",
        icon: ListTodo,
      },
      {
        id: "expense-approvals",
        menuCode: "hr-expense-approvals",
        label: "Expense Approvals",
        path: "/hr/expense-approvals",
        icon: Receipt,
      },
      {
        id: "tickets",
        menuCode: "hr-tickets",
        label: "Employee Tickets",
        path: "/hr/tickets",
        icon: Ticket,
      },
      {
        id: "payroll",
        menuCode: "hr-payroll",
        label: "Payroll",
        path: "/hr/payroll",
        icon: Banknote,
      },
      {
        id: "compliance",
        menuCode: "hr-compliance",
        label: "Compliance",
        path: "/hr/compliance",
        icon: ShieldCheck,
      },
    ],
  },
];

export const SETTINGS_NAV_ITEMS: GatedNavItem[] = [
  {
    id: "users",
    menuCode: "admin-users",
    label: "Users",
    path: "/admin/users",
    icon: Users,
  },
  {
    id: "roles",
    menuCode: "admin-roles",
    label: "Roles",
    path: "/admin/roles",
    icon: Shield,
  },
  {
    id: "preferences",
    menuCode: "admin-preferences",
    label: "Preferences",
    path: "/settings/preferences",
    icon: Sliders,
  },
  {
    id: "regional",
    menuCode: "admin-regional",
    label: "Regional Formats",
    path: "/settings/regional",
    icon: Globe,
  },
  {
    id: "menu",
    menuCode: "admin-menu",
    label: "Navigation Menu",
    path: "/admin/menu",
    icon: MenuIcon,
  },
  {
    id: "reference-tags",
    menuCode: "reference-tags",
    label: "Reference Tags",
    path: "/reference/tags",
    icon: Tag,
  },
];

/**
 * Standardized Employee Portal Navigation Groups matching user layout specifications:
 * 1. Overview (Dashboard)
 * 2. Attendance (Check In / Out, Attendance, My Timesheet)
 * 3. Leaves (Leave Tracker)
 * 4. Work & Projects (My Work, Personal Tasks)
 * 5. Expenses (My Expenses)
 * 6. Payroll (My Payslips, Tax & Declarations, Loans & Advances)
 * 7. My Info (My Profile, Documents, Raise Ticket, Exit Request)
 * 8. Team Management (Team Attendance, Team Leaves — conditional on permissions)
 */
export const PORTAL_NAV_GROUPS: NavGroup[] = [
  {
    id: "portal-overview",
    label: "Overview",
    items: [
      {
        id: "portal-dashboard",
        menuCode: "portal",
        label: "Dashboard",
        path: "/portal",
        icon: LayoutGrid,
        exact: true,
      },
    ],
  },
  {
    id: "portal-attendance-group",
    label: "Attendance",
    items: [
      {
        id: "portal-checkin",
        menuCode: "portal-attendance",
        label: "Check In / Out",
        path: "/portal/attendance?action=punch",
        icon: MapPin,
      },
      {
        id: "portal-attendance",
        menuCode: "portal-attendance",
        label: "Attendance",
        path: "/portal/attendance",
        icon: Calendar,
      },
      {
        id: "portal-timesheet",
        menuCode: "portal-attendance",
        label: "My Timesheet",
        path: "/portal/attendance?view=timesheet",
        icon: Clock,
      },
    ],
  },
  {
    id: "portal-leaves-group",
    label: "Leaves",
    items: [
      {
        id: "portal-leave",
        menuCode: "portal-leave",
        label: "Leave Tracker",
        path: "/portal/leave",
        icon: CalendarDays,
      },
    ],
  },
  {
    id: "portal-work-group",
    label: "Work & Projects",
    items: [
      {
        id: "portal-tasks",
        menuCode: "portal-tasks",
        label: "My Work",
        path: "/portal/tasks",
        icon: Briefcase,
      },
      {
        id: "portal-personal-tasks",
        menuCode: "portal-task-assignment",
        label: "Personal Tasks",
        path: "/portal/task-assignment",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "portal-expenses-group",
    label: "Expenses",
    items: [
      {
        id: "portal-expense-claims",
        menuCode: "portal-expense-claims",
        label: "My Expenses",
        path: "/portal/expense-claims",
        icon: Receipt,
      },
    ],
  },
  {
    id: "portal-payroll-group",
    label: "Payroll",
    items: [
      {
        id: "portal-payslips",
        menuCode: "portal-payslips",
        label: "My Payslips",
        path: "/portal/payslips",
        icon: Wallet,
      },
      {
        id: "portal-tax",
        menuCode: "portal-tax",
        label: "Tax & Declarations",
        path: "/portal/tax",
        icon: Percent,
      },
      {
        id: "portal-loans",
        menuCode: "portal-loans",
        label: "Loans & Advances",
        path: "/portal/loans",
        icon: Landmark,
      },
    ],
  },
  {
    id: "portal-myinfo-group",
    label: "My Info",
    items: [
      {
        id: "portal-profile",
        menuCode: "portal-profile",
        label: "My Profile",
        path: "/portal/profile",
        icon: User,
      },
      {
        id: "portal-documents",
        menuCode: "portal-documents",
        label: "Documents",
        path: "/portal/documents",
        icon: Folder,
      },
      {
        id: "portal-tickets",
        menuCode: "portal-tickets",
        label: "Raise Ticket",
        path: "/portal/tickets",
        icon: Ticket,
      },
      {
        id: "portal-exit-requests",
        menuCode: "portal-exit-requests",
        label: "Exit Request",
        path: "/portal/exit-requests",
        icon: DoorOpen,
      },
    ],
  },
  {
    id: "portal-team-group",
    label: "Team Management",
    items: [
      {
        id: "portal-team-attendance",
        menuCode: "portal-team-attendance",
        label: "Team Attendance",
        path: "/portal/team-attendance",
        icon: UsersRound,
      },
      {
        id: "portal-team-leaves",
        menuCode: "portal-team-leaves",
        label: "Team Leaves",
        path: "/portal/team-leaves",
        icon: CalendarCheck,
      },
    ],
  },
];

export interface DynamicSidebarProps {
  open?: boolean;
  onNavigate?: () => void;
  onlyRootCode?: string;
}

function checkIsActive(item: SubNavItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.path;
  }

  if (item.id === "dashboard") {
    return (
      pathname === item.path ||
      pathname === "/hr" ||
      pathname === "/hr/dashboard"
    );
  }

  if (item.id === "portal-checkin") {
    if (typeof window !== "undefined") {
      return (
        pathname === "/portal/attendance" &&
        window.location.search.includes("action=punch")
      );
    }
    return false;
  }

  if (item.id === "portal-timesheet") {
    if (typeof window !== "undefined") {
      return (
        pathname === "/portal/attendance" &&
        window.location.search.includes("view=timesheet")
      );
    }
    return false;
  }

  if (item.id === "portal-attendance") {
    if (typeof window !== "undefined") {
      return (
        pathname === "/portal/attendance" &&
        !window.location.search.includes("action=punch") &&
        !window.location.search.includes("view=timesheet")
      );
    }
    return pathname === "/portal/attendance";
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

  if (item.path === "/portal") {
    return pathname === "/portal";
  }

  const basePath = item.path.split("?")[0]!;
  return pathname.startsWith(basePath);
}

/**
 * Reusable Navigation Item Component conforming to TEXA Design System.
 */
export function NavigationItem({
  item,
  isActive,
  onNavigate,
  isCollapsed,
}: {
  item: SubNavItem;
  isActive: boolean;
  onNavigate?: (() => void) | undefined;
  isCollapsed?: boolean | undefined;
}) {
  return (
    <Link
      href={item.path}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      title={isCollapsed ? item.label : undefined}
      className={`group relative flex items-center ${
        isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-1.5"
      } rounded-xl text-theme-xs font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-1 ${
        isActive
          ? "bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 text-white font-semibold shadow-theme-xs dark:bg-linear-135 dark:from-blue-600 dark:via-brand-500 dark:to-cyan-500 dark:text-white dark:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
          : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#161B26] dark:hover:text-white"
      }`}
    >
      <item.icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive
            ? "text-white dark:text-white"
            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
        }`}
        aria-hidden="true"
      />
      {!isCollapsed && <span className="truncate">{item.label}</span>}
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
  isSidebarCollapsed,
}: {
  group: NavGroup;
  pathname: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate?: (() => void) | undefined;
  isSidebarCollapsed?: boolean | undefined;
}) {
  const hasActiveChild = group.items.some((item) =>
    checkIsActive(item, pathname),
  );

  const isTimeLeave = group.id === "time-leave";
  const buttonAriaLabel = isTimeLeave
    ? "Time & Leave — Leave & Calendar"
    : group.label;

  if (isSidebarCollapsed) {
    return (
      <div className="flex flex-col items-center py-1">
        <button
          type="button"
          onClick={onToggle}
          title={group.label}
          aria-expanded={!isCollapsed}
          aria-label={buttonAriaLabel}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {hasActiveChild && (
            <span
              className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-brand-500"
              aria-hidden="true"
            />
          )}
          <span className="text-[10px] font-bold uppercase">
            {group.label[0]}
          </span>
        </button>
        {!isCollapsed && (
          <div className="mt-1 flex flex-col gap-1 w-full items-center">
            {group.items.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={checkIsActive(item, pathname)}
                onNavigate={onNavigate}
                isCollapsed={true}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={`nav-group-${group.id}`}
        aria-label={buttonAriaLabel}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
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
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
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

function collectMenuCodes(
  nodes: readonly MenuTreeNode[],
  into: Set<string> = new Set(),
): Set<string> {
  for (const node of nodes) {
    into.add(node.code);
    collectMenuCodes(node.children, into);
  }
  return into;
}

function WithMyMenu({
  children,
}: {
  children: (menu: MenuTreeNode[]) => ReactNode;
}) {
  const menuQuery = useMyMenu();

  if (menuQuery.isPending) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
      </div>
    );
  }

  if (menuQuery.isError) {
    return (
      <p className="p-3 text-theme-xs text-error-600">
        Could not load navigation.
      </p>
    );
  }

  return <>{children(menuQuery.data)}</>;
}

function EmptyNav() {
  return (
    <p className="p-2 text-theme-xs text-gray-400">
      No navigation items available
    </p>
  );
}

function NavItemList({
  items,
  pathname,
  onNavigate,
  isCollapsed,
}: {
  items: readonly SubNavItem[];
  pathname: string;
  onNavigate?: (() => void) | undefined;
  isCollapsed?: boolean | undefined;
}) {
  if (items.length === 0) return <EmptyNav />;
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavigationItem
          key={item.id}
          item={item}
          isActive={checkIsActive(item, pathname)}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
        />
      ))}
    </div>
  );
}

const PORTAL_ICON_MAP: Record<string, LucideIcon> = {
  "portal-home": LayoutDashboard,
  "portal-profile": UserCircle,
  "portal-leave": CalendarCheck,
  "portal-tasks": ListTodo,
  "portal-tickets": Ticket,
  "portal-expense-claims": Receipt,
  "portal-exit-requests": UserMinus,
  "portal-attendance": Clock,
  "portal-documents": FileText,
  "portal-task-assignment": ClipboardList,
  "portal-team-attendance": UsersRound,
  "portal-team-leaves": CalendarDays,
  "portal-payslips": Banknote,
  "portal-loans": Landmark,
  "portal-tax": Percent,
};

const PORTAL_PATH_MAP: Record<string, LucideIcon> = {
  "/portal": LayoutDashboard,
  "/portal/profile": UserCircle,
  "/portal/leave": CalendarCheck,
  "/portal/tasks": ListTodo,
  "/portal/tickets": Ticket,
  "/portal/expense-claims": Receipt,
  "/portal/exit-requests": UserMinus,
  "/portal/attendance": Clock,
  "/portal/documents": FileText,
  "/portal/task-assignment": ClipboardList,
  "/portal/team-attendance": UsersRound,
  "/portal/team-leaves": CalendarDays,
  "/portal/payslips": Banknote,
  "/portal/loans": Landmark,
  "/portal/tax": Percent,
};

function rootItems(menu: MenuTreeNode[], rootCode: string): SubNavItem[] {
  const children = (
    menu.find((item) => item.code === rootCode)?.children ?? []
  ).flatMap((item): SubNavItem[] => {
    if (!item.path) return [];
    const icon =
      PORTAL_ICON_MAP[item.code] ?? PORTAL_PATH_MAP[item.path] ?? ChevronRight;
    return [
      {
        id: item.code,
        label: item.label,
        path: item.path,
        icon,
      },
    ];
  });

  // For portal root, ensure a top-level Dashboard link is present
  if (rootCode === "portal" && !children.some((c) => c.path === "/portal")) {
    return [
      {
        id: "portal-home",
        label: "Dashboard",
        path: "/portal",
        icon: LayoutDashboard,
        exact: true,
      },
      ...children,
    ];
  }

  return children;
}

/**
 * Consolidated Single Application Sidebar.
 * Combines ErpPrimarySidebar and DynamicSidebar into one unified navigation surface.
 * Conforms to Docs/DESIGN_SYSTEM.md.
 */
export function DynamicSidebar({
  open,
  onNavigate,
  onlyRootCode,
}: DynamicSidebarProps = {}) {
  const pathname = usePathname();

  // Desktop collapse state (w-64 expanded vs w-20 collapsed)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Collapsible ERP modules drawer within sidebar
  const [showAllModules, setShowAllModules] = useState(false);

  // Accordion state: which group is currently expanded.
  // Defaults to the single group containing the current active route (or overview),
  // ensuring only ONE dropdown group is open at a time.
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(() => {
    const activeGroup = HR_NAV_GROUPS.find((group) =>
      group.items.some((item) => checkIsActive(item, pathname)),
    );
    return activeGroup ? activeGroup.id : "overview";
  });
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Detect whether user is in HR, Settings/Admin, or other modules
  const isSettingsContext =
    !onlyRootCode &&
    (pathname.startsWith("/settings") ||
      pathname.startsWith("/reference") ||
      pathname.startsWith("/admin/users") ||
      pathname === "/admin/roles" ||
      pathname === "/admin/menu" ||
      pathname === "/admin/departments");

  const isHrActive =
    pathname.startsWith("/hr") || pathname === "/admin/departments";

  const isSettingsActive =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reference") ||
    pathname.startsWith("/admin/users") ||
    pathname === "/admin/roles" ||
    pathname === "/admin/menu";

  // When pathname changes, automatically sync active category
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (!onlyRootCode && !isSettingsContext) {
      const activeGroup = HR_NAV_GROUPS.find((group) =>
        group.items.some((item) => checkIsActive(item, pathname)),
      );
      if (activeGroup) {
        setExpandedGroupId(activeGroup.id);
      }
    }
  }

  function handleToggleGroup(groupId: string) {
    setExpandedGroupId((current) => (current === groupId ? "" : groupId));
  }

  function isGroupCollapsed(group: NavGroup): boolean {
    return expandedGroupId !== group.id;
  }

  const onAsideClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a") && onNavigate) {
      onNavigate();
    }
  };

  const isMobileOpen = open === true;
  const mobileVisibilityClass =
    open !== undefined
      ? isMobileOpen
        ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl"
        : "hidden lg:flex"
      : "flex";

  return (
    <aside
      id="app-sidebar"
      onClick={onAsideClick}
      className={`h-full shrink-0 flex-col border-r border-gray-200 bg-white dark:border-[#1C2029] dark:bg-[#08090D] transition-all duration-200 ${
        isCollapsed ? "w-20" : "w-64"
      } ${mobileVisibilityClass}`}
    >
      {/* Brand Header / Sub-header */}
      {!onlyRootCode ? (
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sky-100/80 px-4 dark:border-[#1C2029] bg-white dark:bg-[#08090D]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {!isCollapsed ? (
              <TexaLogo
                size="md"
                variant="full"
                className="h-8.5 w-auto shrink-0"
              />
            ) : (
              <TexaLogo
                size="sm"
                variant="mark"
                className="h-7 w-auto shrink-0"
              />
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Mobile Drawer Close Button */}
          {open && (
            <button
              type="button"
              onClick={onNavigate}
              aria-label="Close navigation"
              className="inline-flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-sky-100/70 px-3.5 dark:border-gray-800 bg-linear-to-r from-sky-50/60 to-white dark:from-gray-900 dark:to-gray-900">
          {!isCollapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Employee Portal
            </span>
          )}
          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-sky-100 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Mobile Drawer Close Button */}
          {open && (
            <button
              type="button"
              onClick={onNavigate}
              aria-label="Close navigation"
              className="inline-flex lg:hidden h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Global Module Navigation Bar (Preserves ErpPrimarySidebar modules) */}
      {!onlyRootCode && (
        <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
          <div className="flex items-center justify-between">
            {!isCollapsed ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                ERP Modules
              </span>
            ) : null}
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => setShowAllModules((prev) => !prev)}
                className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
              >
                {showAllModules ? "Less" : "All"}
              </button>
            )}
          </div>

          <div
            className={`mt-1.5 flex ${
              isCollapsed ? "flex-col items-center gap-1.5" : "flex-col gap-1"
            }`}
          >
            {/* Primary Core Modules */}
            <Link
              href="/hr/dashboard"
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={`flex items-center gap-2.5 rounded-lg text-theme-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-brand-500 ${
                isCollapsed ? "justify-center p-2" : "px-2.5 py-1.5"
              } ${
                isHrActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                  : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
              title="Human Resources"
            >
              <Users className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              {!isCollapsed && <span>HR</span>}
            </Link>

            <Link
              href="/admin/users"
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={`flex items-center gap-2.5 rounded-lg text-theme-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-brand-500 ${
                isCollapsed ? "justify-center p-2" : "px-2.5 py-1.5"
              } ${
                isSettingsActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold"
                  : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
              title="Settings & Administration"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Settings</span>}
            </Link>

            {/* Expanded Modules List (Preserves all 11 global modules from ErpPrimarySidebar) */}
            {showAllModules && !isCollapsed && (
              <div className="mt-1 flex flex-col gap-0.5 border-t border-gray-100 pt-1.5 dark:border-gray-800">
                {PRIMARY_MODULES.filter(
                  (m) => m.id !== "hr" && m.id !== "settings",
                ).map((mod) => {
                  const isClickable = mod.path !== "#";
                  return isClickable ? (
                    <Link
                      key={mod.id}
                      href={mod.path}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-theme-xs font-medium text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                      <mod.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{mod.label}</span>
                    </Link>
                  ) : (
                    <div
                      key={mod.id}
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-1 text-theme-xs font-medium text-gray-400 opacity-60 dark:text-gray-600"
                      title={`${mod.label} — In development`}
                    >
                      <div className="flex items-center gap-2.5">
                        <mod.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{mod.label}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-gray-400">
                        Soon
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation Workspace */}
      <nav
        aria-label={
          onlyRootCode ? "My Portal Navigation" : "Human Resources Navigation"
        }
        className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2.5"
      >
        {/* Dynamic RBAC Nav Items */}
        <WithMyMenu>
          {(menu) => {
            if (onlyRootCode === "portal") {
              const allowed = collectMenuCodes(menu);

              const portalGroups = PORTAL_NAV_GROUPS.map((group) => ({
                ...group,
                items: group.items.filter((item) => {
                  if (item.id === "portal-dashboard") return true;
                  if (allowed.size === 0) return true;
                  return !item.menuCode || allowed.has(item.menuCode);
                }),
              })).filter((group) => group.items.length > 0);

              if (portalGroups.length === 0) {
                return <EmptyNav />;
              }

              return (
                <div className="flex flex-col gap-3.5">
                  {portalGroups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-1">
                      {!isCollapsed && (
                        <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {group.label}
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        {group.items.map((item) => (
                          <NavigationItem
                            key={item.id}
                            item={item}
                            isActive={checkIsActive(item, pathname)}
                            onNavigate={onNavigate}
                            isCollapsed={isCollapsed}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            if (onlyRootCode) {
              return (
                <NavItemList
                  items={rootItems(menu, onlyRootCode)}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  isCollapsed={isCollapsed}
                />
              );
            }

            const allowed = collectMenuCodes(menu);

            // Filter HR categories by permission
            const hrGroups = HR_NAV_GROUPS.map((group) => ({
              ...group,
              items: group.items.filter((item) => allowed.has(item.menuCode)),
            })).filter((group) => group.items.length > 0);

            // Filter Settings items by permission
            const allowedSettings = SETTINGS_NAV_ITEMS.filter((item) =>
              allowed.has(item.menuCode),
            );

            if (hrGroups.length === 0 && allowedSettings.length === 0) {
              return <EmptyNav />;
            }

            return (
              <div className="flex flex-col gap-2.5">
                {!isCollapsed && hrGroups.length > 0 && (
                  <div className="px-2 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    HR
                  </div>
                )}
                {hrGroups.map((group) => (
                  <NavigationGroup
                    key={group.id}
                    group={group}
                    pathname={pathname}
                    isCollapsed={isGroupCollapsed(group)}
                    onToggle={() => handleToggleGroup(group.id)}
                    onNavigate={onNavigate}
                    isSidebarCollapsed={isCollapsed}
                  />
                ))}
                {allowedSettings.length > 0 && (
                  <div className="mt-2 flex flex-col border-t border-gray-100 pt-2 dark:border-gray-800">
                    {!isCollapsed && (
                      <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Administration
                      </div>
                    )}
                    <NavItemList
                      items={allowedSettings}
                      pathname={pathname}
                      onNavigate={onNavigate}
                      isCollapsed={isCollapsed}
                    />
                  </div>
                )}
              </div>
            );
          }}
        </WithMyMenu>
      </nav>

      {/* Bottom Profile Footer for Portal */}
      {onlyRootCode === "portal" && (
        <EmployeeSidebarFooter
          isCollapsed={isCollapsed}
          onNavigate={onNavigate}
        />
      )}
    </aside>
  );
}

/**
 * Pinned Employee Footer Card for Employee Portal Sidebar
 * Conforms to TexaOne brand guidelines (Nunito Sans, no monospace, no purple/violet).
 */
function EmployeeSidebarFooter({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const myEmployee = useMyEmployee();
  const user = useAuthStore((s) => s.user);

  const empName = myEmployee.data?.fullName || user?.fullName || "Employee";
  const empRole = myEmployee.data?.designation?.name || "Employee";

  const initials =
    empName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "EM";

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 p-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
      <Link
        href="/portal/profile"
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className={`group flex items-center ${
          isCollapsed ? "justify-center p-1" : "gap-2.5 p-2"
        } rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all`}
        title={isCollapsed ? `${empName} (${empRole})` : undefined}
      >
        <div className="relative flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-[#16a34a] to-[#22c55e] text-white text-[11px] font-bold shadow-xs">
          {initials}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
            aria-hidden="true"
          />
        </div>

        {!isCollapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 transition-colors">
              {empName}
            </span>
            <span className="truncate text-[10px] font-medium text-slate-400 dark:text-slate-400 capitalize">
              {empRole}
            </span>
          </div>
        )}
      </Link>
    </div>
  );
}
