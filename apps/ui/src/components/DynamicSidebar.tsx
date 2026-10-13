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
  Users,
  Contact,
  FileText,
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
  type LucideIcon,
} from "lucide-react";

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
        id: "work-logs",
        menuCode: "hr-work-logs",
        label: "Work Logs",
        path: "/hr/work-logs",
        icon: FileSpreadsheet,
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
    id: "roles",
    menuCode: "admin-roles",
    label: "Roles",
    path: "/admin/roles",
    icon: Shield,
  },
  {
    id: "users",
    menuCode: "admin-users",
    label: "Users",
    path: "/admin/users",
    icon: Users,
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

export interface DynamicSidebarProps {
  open?: boolean;
  onNavigate?: () => void;
  onlyRootCode?: string;
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
          ? "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan text-white font-semibold shadow-theme-xs"
          : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-white"
      }`}
    >
      <item.icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive
            ? "text-white"
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

function rootItems(menu: MenuTreeNode[], rootCode: string): SubNavItem[] {
  return (menu.find((item) => item.code === rootCode)?.children ?? []).flatMap(
    (item): SubNavItem[] =>
      item.path
        ? [
            {
              id: item.code,
              label: item.label,
              path: item.path,
              icon: ChevronRight,
            },
          ]
        : [],
  );
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

  // Accordion state: which HR group is currently expanded
  // null means all groups with items are initially expanded until user toggles or navigates
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
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
    if (!onlyRootCode && !isSettingsContext && expandedGroupId !== null) {
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
    if (expandedGroupId !== null) {
      return expandedGroupId !== group.id;
    }
    return false;
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
      className={`h-full shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-all duration-200 ${
        isCollapsed ? "w-20" : "w-64"
      } ${mobileVisibilityClass}`}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sky-100/80 px-4 dark:border-gray-800 bg-white dark:bg-gray-900">
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
    </aside>
  );
}
