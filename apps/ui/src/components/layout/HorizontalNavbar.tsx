"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Users,
  Settings,
  ShoppingCart,
  Package,
  Landmark,
  FolderKanban,
  BarChart3,
  Clock,
  Menu as MenuIcon,
  X,
  Contact,
  FileText,
  Network,
  Building2,
  UsersRound,
  Briefcase,
  UserMinus,
  Calendar,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  MapPin,
  Award,
  ListTodo,
  Receipt,
  Ticket,
  Banknote,
  ShieldCheck,
  Shield,
  Tag,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import { useMyMenu } from "@/features/menu/hooks";
import type { MenuTreeNode } from "@texawave-erp/api-types";

export interface NavLeafItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  menuCode: string;
}

export interface NavCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  /** If category is a direct link without children (e.g. Overview) */
  path?: string;
  menuCode?: string;
  children?: NavLeafItem[];
}

export interface ErpModuleConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  available: boolean;
  categories?: NavCategory[];
}

/**
 * Three-level HR Navigation Hierarchy matching the exact TexaOne visual specification.
 * Level 1: Module ("Human Resources")
 * Level 2: Categories (Overview, People, Time & Leave, Operations, Recruitment, Payroll, Compliance)
 * Level 3: Nested submenus for each category
 */
const HR_CATEGORIES: NavCategory[] = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    path: "/hr/dashboard",
    menuCode: "hr-dashboard",
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    children: [
      {
        id: "employees",
        label: "Employees",
        path: "/hr/employees",
        icon: Users,
        menuCode: "hr-employees",
      },
      {
        id: "profiles",
        label: "Profiles",
        path: "/hr/profiles",
        icon: Contact,
        menuCode: "hr-profiles",
      },
      {
        id: "employee-documents",
        label: "Employee Documents",
        path: "/hr/employee-documents",
        icon: FileText,
        menuCode: "hr-employee-documents",
      },
      {
        id: "org-chart",
        label: "Org Chart",
        path: "/hr/org-chart",
        icon: Network,
        menuCode: "hr-org-chart",
      },
      {
        id: "departments",
        label: "Departments",
        path: "/hr/departments",
        icon: Building2,
        menuCode: "hr-departments",
      },
      {
        id: "teams",
        label: "Teams",
        path: "/hr/teams",
        icon: UsersRound,
        menuCode: "hr-teams",
      },
    ],
  },
  {
    id: "time-leave",
    label: "Time & Leave",
    icon: Calendar,
    children: [
      {
        id: "attendance",
        label: "Attendance",
        path: "/hr/attendance",
        icon: Clock,
        menuCode: "hr-attendance",
      },
      {
        id: "regularization",
        label: "Regularization",
        path: "/hr/regularization",
        icon: CalendarCheck,
        menuCode: "hr-regularization",
      },
      {
        id: "work-logs",
        label: "Work Logs",
        path: "/hr/work-logs",
        icon: FileSpreadsheet,
        menuCode: "hr-work-logs",
      },
      {
        id: "location-privilege",
        label: "Location Privilege",
        path: "/hr/location-privilege",
        icon: MapPin,
        menuCode: "hr-location-privilege",
      },
      {
        id: "full-month-present",
        label: "Full Month Present",
        path: "/hr/full-month-present",
        icon: Award,
        menuCode: "hr-full-month-present",
      },
      {
        id: "leaves",
        label: "Leaves",
        path: "/hr/leaves",
        icon: Calendar,
        menuCode: "hr-leaves",
      },
      {
        id: "holidays",
        label: "Holidays",
        path: "/hr/holidays",
        icon: CalendarDays,
        menuCode: "hr-holidays",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Settings,
    children: [
      {
        id: "tasks",
        label: "Tasks",
        path: "/hr/tasks",
        icon: ListTodo,
        menuCode: "hr-tasks",
      },
      {
        id: "expense-approvals",
        label: "Expense Approvals",
        path: "/hr/expense-approvals",
        icon: Receipt,
        menuCode: "hr-expense-approvals",
      },
      {
        id: "tickets",
        label: "Employee Tickets",
        path: "/hr/tickets",
        icon: Ticket,
        menuCode: "hr-tickets",
      },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    icon: Briefcase,
    children: [
      {
        id: "recruitment-pipeline",
        label: "Recruitment Pipeline",
        path: "/hr/recruitment",
        icon: Briefcase,
        menuCode: "hr-recruitment",
      },
      {
        id: "exit-requests",
        label: "Exit Requests",
        path: "/hr/exit-requests",
        icon: UserMinus,
        menuCode: "hr-exit-requests",
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: Banknote,
    children: [
      {
        id: "payroll-overview",
        label: "Payroll Processing",
        path: "/hr/payroll",
        icon: Banknote,
        menuCode: "hr-payroll",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    children: [
      {
        id: "compliance-overview",
        label: "Statutory Compliance",
        path: "/hr/compliance",
        icon: ShieldCheck,
        menuCode: "hr-compliance",
      },
    ],
  },
];

/**
 * Settings Navigation Hierarchy
 */
const SETTINGS_CATEGORIES: NavCategory[] = [
  {
    id: "access-control",
    label: "Access Control",
    icon: Shield,
    children: [
      {
        id: "users",
        label: "Users",
        path: "/admin/users",
        icon: Users,
        menuCode: "admin-users",
      },
      {
        id: "roles",
        label: "Roles",
        path: "/admin/roles",
        icon: Shield,
        menuCode: "admin-roles",
      },
    ],
  },
  {
    id: "system-config",
    label: "Configuration",
    icon: Settings,
    children: [
      {
        id: "menu",
        label: "Navigation Menu",
        path: "/admin/menu",
        icon: MenuIcon,
        menuCode: "admin-menu",
      },
      {
        id: "reference-tags",
        label: "Reference Tags",
        path: "/reference/tags",
        icon: Tag,
        menuCode: "reference-tags",
      },
    ],
  },
];

const ERP_MODULES: ErpModuleConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
    available: true,
  },
  {
    id: "hr",
    label: "Human Resources",
    icon: Users,
    path: "/hr/dashboard",
    available: true,
    categories: HR_CATEGORIES,
  },
  {
    id: "sales",
    label: "Commerce",
    icon: ShoppingCart,
    path: "#",
    available: false,
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    path: "#",
    available: false,
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    path: "#",
    available: false,
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    path: "#",
    available: false,
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    path: "#",
    available: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/admin/users",
    available: true,
    categories: SETTINGS_CATEGORIES,
  },
];

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

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300 tabular-nums">
      {time}
    </span>
  );
}

export interface HorizontalNavbarProps {
  onSignOut: () => void;
}

export function HorizontalNavbar({ onSignOut }: HorizontalNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const menuQuery = useMyMenu();

  // Navigation Dropdown state
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    "people",
  );
  const [submenuAlignLeft, setSubmenuAlignLeft] = useState(false);

  // Shell popover states
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navContainerRef = useRef<HTMLElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Close menus on outside click or escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenModuleId(null);
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(target)
      ) {
        setOpenModuleId(null);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Detect which ERP module is active based on current route
  const currentActiveModuleId = (() => {
    if (pathname.startsWith("/hr") || pathname === "/admin/departments")
      return "hr";
    if (pathname === "/admin" || pathname === "/admin/dashboard")
      return "dashboard";
    if (
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/menu") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/reference")
    )
      return "settings";
    return null;
  })();

  // Filter categories and leaves based on user RBAC permissions
  const allowedCodes: Set<string> = useMemo(
    () => (menuQuery.data ? collectMenuCodes(menuQuery.data) : new Set()),
    [menuQuery.data],
  );

  const filterCategories = useCallback(
    (categories?: NavCategory[]): NavCategory[] => {
      if (!categories) return [];
      if (!menuQuery.data) return categories; // During loading, show categories

      return categories
        .map((cat) => {
          if (cat.children) {
            const filteredChildren = cat.children.filter((child) =>
              allowedCodes.has(child.menuCode),
            );
            return {
              ...cat,
              children: filteredChildren,
            };
          }
          if (cat.menuCode && !allowedCodes.has(cat.menuCode)) {
            return null;
          }
          return cat;
        })
        .filter((cat): cat is NavCategory => {
          if (!cat) return false;
          if (cat.children !== undefined) {
            return cat.children.length > 0;
          }
          return true;
        });
    },
    [menuQuery.data, allowedCodes],
  );

  const activeModuleConfig = ERP_MODULES.find((m) => m.id === openModuleId);
  const activeCategories = filterCategories(activeModuleConfig?.categories);

  // Check submenu viewport overflow
  useEffect(() => {
    if (openModuleId && categoryMenuRef.current) {
      const rect = categoryMenuRef.current.getBoundingClientRect();
      // Level 3 is 256px wide. If rect.right + 260 exceeds viewport width, flip to left
      if (rect.right + 260 > window.innerWidth) {
        setSubmenuAlignLeft(true);
      } else {
        setSubmenuAlignLeft(false);
      }
    }
  }, [openModuleId, activeCategoryId]);

  // Hover handlers with debounce intent timer
  const handleMouseEnterModule = (moduleId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const mod = ERP_MODULES.find((m) => m.id === moduleId);
    if (mod && mod.categories && mod.categories.length > 0) {
      setOpenModuleId(moduleId);
      // Auto-select category matching current route or first category with children
      const filtered = filterCategories(mod.categories);
      const matchingCat = filtered.find((c) =>
        c.children?.some((child) => pathname.startsWith(child.path)),
      );
      if (matchingCat) {
        setActiveCategoryId(matchingCat.id);
      } else {
        const firstWithChildren = filtered.find(
          (c) => c.children && c.children.length > 0,
        );
        setActiveCategoryId(
          firstWithChildren ? firstWithChildren.id : (filtered[0]?.id ?? null),
        );
      }
    } else {
      setOpenModuleId(null);
    }
  };

  const handleMouseLeaveNav = () => {
    closeTimerRef.current = setTimeout(() => {
      setOpenModuleId(null);
    }, 220);
  };

  const handleMouseEnterDropdown = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCategoryHover = (catId: string) => {
    setActiveCategoryId(catId);
  };

  const handleCategoryClick = (cat: NavCategory) => {
    if (cat.path) {
      setOpenModuleId(null);
      router.push(cat.path);
    } else {
      setActiveCategoryId((prev) => (prev === cat.id ? prev : cat.id));
    }
  };

  const handleLeafClick = () => {
    setOpenModuleId(null);
    setMobileMenuOpen(false);
  };

  const activeCategoryObj = activeCategories.find(
    (c) => c.id === activeCategoryId,
  );
  const activeSubmenuItems = activeCategoryObj?.children ?? [];

  const displayName = user?.fullName || "Super Admin";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      ref={navContainerRef}
      aria-label="TexaOne application navigation"
      className="sticky top-0 z-40 w-full shrink-0"
      onMouseLeave={handleMouseLeaveNav}
    >
      {/* Primary Module Rail */}
      <div className="flex h-16 items-center justify-between border-b border-sky-100/80 bg-linear-to-r from-blue-50/90 via-cyan-50/80 to-emerald-50/60 px-3 shadow-xs dark:border-gray-800 dark:bg-gray-dark sm:px-4 lg:px-6">
        {/* Left: Mobile hamburger + Brand Logo */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-slate-700 hover:bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500 md:hidden dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>

          <Link
            href="/hr/dashboard"
            aria-label="TexaOne — Run Your Business as One."
            className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
          >
            <TexaLogo size="md" variant="full" className="h-9 w-auto" />
          </Link>
        </div>

        {/* Center: Desktop Module Navigation (Level 1) */}
        <nav
          aria-label="Main application navigation"
          className="relative hidden flex-1 items-center justify-center gap-1 px-2 md:flex lg:gap-1.5"
        >
          {ERP_MODULES.map((mod) => {
            const isRouteActive = mod.id === currentActiveModuleId;
            const isDropdownOpen = mod.id === openModuleId;
            const hasCategories = Boolean(
              mod.categories && mod.categories.length > 0,
            );

            if (!mod.available) {
              return (
                <div key={mod.id} className="relative group">
                  <button
                    type="button"
                    disabled
                    title={`${mod.label} — Coming soon`}
                    className="flex cursor-not-allowed flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 opacity-40 transition-all lg:px-3"
                  >
                    <mod.icon className="h-5 w-5 text-gray-500" />
                    <span className="text-[10px] font-semibold leading-none text-gray-500 lg:text-[11px]">
                      {mod.label}
                    </span>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={mod.id}
                className="relative"
                onMouseEnter={() => handleMouseEnterModule(mod.id)}
              >
                <button
                  type="button"
                  aria-haspopup={hasCategories ? "menu" : undefined}
                  aria-expanded={hasCategories ? isDropdownOpen : undefined}
                  onClick={() => {
                    if (hasCategories) {
                      setOpenModuleId((prev) =>
                        prev === mod.id ? null : mod.id,
                      );
                    } else {
                      router.push(mod.path);
                    }
                  }}
                  className={`group relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-2 focus-visible:outline-brand-500 lg:px-3 ${
                    isDropdownOpen || (isRouteActive && !openModuleId)
                      ? "border border-sky-200/90 bg-white/95 text-brand-700 shadow-xs dark:border-sky-800/60 dark:bg-gray-800/95 dark:text-cyan-300 font-semibold"
                      : "text-gray-600 hover:border hover:border-sky-100 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
                  }`}
                >
                  <mod.icon
                    className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                      isDropdownOpen || (isRouteActive && !openModuleId)
                        ? "text-brand-600 dark:text-cyan-400"
                        : "text-slate-600 dark:text-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-semibold leading-none lg:text-[11px]">
                    {mod.label}
                  </span>
                </button>

                {/* Level 2 & Level 3 Glassmorphism Dropdowns */}
                {hasCategories && isDropdownOpen && (
                  <div
                    ref={categoryMenuRef}
                    role="menu"
                    aria-label={`${mod.label} categories`}
                    onMouseEnter={handleMouseEnterDropdown}
                    className="glass-dropdown absolute left-0 top-full mt-2 z-50 flex min-w-56 rounded-2xl p-2 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    {/* Level 2: Categories Column */}
                    <div className="flex w-52 flex-col gap-0.5 border-r border-sky-100/80 pr-1.5 dark:border-gray-800">
                      {activeCategories.map((cat) => {
                        const isCatSelected = cat.id === activeCategoryId;
                        const hasChildren = Boolean(
                          cat.children && cat.children.length > 0,
                        );

                        return (
                          <div key={cat.id} className="relative">
                            {cat.path && !hasChildren ? (
                              <Link
                                href={cat.path}
                                onClick={handleLeafClick}
                                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                                  pathname === cat.path
                                    ? "bg-brand-500/15 text-brand-700 font-bold dark:bg-brand-500/25 dark:text-cyan-300"
                                    : "text-gray-700 hover:bg-sky-50/80 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                }`}
                              >
                                <cat.icon className="h-4 w-4 shrink-0 text-brand-600 dark:text-cyan-400" />
                                <span>{cat.label}</span>
                              </Link>
                            ) : (
                              <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={isCatSelected}
                                onMouseEnter={() => handleCategoryHover(cat.id)}
                                onClick={() => handleCategoryClick(cat)}
                                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                                  isCatSelected
                                    ? "bg-brand-500/15 text-brand-700 font-bold dark:bg-brand-500/25 dark:text-cyan-300 shadow-2xs"
                                    : "text-gray-700 hover:bg-sky-50/80 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <cat.icon
                                    className={`h-4 w-4 shrink-0 ${
                                      isCatSelected
                                        ? "text-brand-600 dark:text-cyan-400"
                                        : "text-gray-500 group-hover:text-brand-600 dark:text-gray-400"
                                    }`}
                                  />
                                  <span>{cat.label}</span>
                                </div>
                                {hasChildren && (
                                  <ChevronRight
                                    className={`h-3.5 w-3.5 transition-transform ${
                                      isCatSelected
                                        ? "text-brand-600 translate-x-0.5 dark:text-cyan-400"
                                        : "text-gray-400 group-hover:text-brand-600"
                                    }`}
                                  />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Level 3: Nested Submenu Column (Adjacent flyout) */}
                    {activeSubmenuItems.length > 0 && (
                      <div
                        role="menu"
                        aria-label={`${activeCategoryObj?.label} items`}
                        className={`absolute top-0 z-50 flex min-w-56 flex-col gap-0.5 rounded-2xl glass-dropdown p-2 shadow-2xl animate-in fade-in-0 duration-150 ${
                          submenuAlignLeft
                            ? "right-full mr-1.5"
                            : "left-full ml-1.5"
                        }`}
                      >
                        <div className="mb-1 border-b border-sky-100/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-gray-800 dark:text-gray-500">
                          {activeCategoryObj?.label}
                        </div>
                        {activeSubmenuItems.map((item) => {
                          const isLeafActive =
                            pathname === item.path ||
                            pathname.startsWith(`${item.path}/`);

                          return (
                            <Link
                              key={item.id}
                              href={item.path}
                              onClick={handleLeafClick}
                              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                                isLeafActive
                                  ? "bg-brand-500/15 text-brand-700 font-bold dark:bg-brand-500/25 dark:text-cyan-300"
                                  : "text-gray-700 hover:bg-sky-50/80 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                              }`}
                            >
                              <item.icon
                                className={`h-4 w-4 shrink-0 ${
                                  isLeafActive
                                    ? "text-brand-600 dark:text-cyan-400"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right Section: Search + Live Clock + Notifications + Profile */}
        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          {/* Universal Search Input */}
          <div
            className={`relative hidden transition-all duration-200 sm:block ${
              searchFocused ? "w-60" : "w-36 lg:w-48"
            }`}
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white/90 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs dark:border-gray-700 dark:bg-gray-800/80 dark:text-white transition-all"
            />
          </div>

          {/* Live IST Clock */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-cyan-200/60 bg-cyan-50/80 px-2.5 py-1 dark:border-cyan-900/40 dark:bg-cyan-950/40 lg:flex">
            <Clock className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
            <LiveClock />
          </div>

          {/* Notifications Dropdown (Glassmorphism) */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
            >
              <Bell className="h-4.5 w-4.5" />
              <span
                className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900"
                aria-hidden="true"
              />
            </button>

            {notificationsOpen && (
              <div
                role="region"
                aria-label="Recent notifications"
                className="glass-dropdown absolute right-0 mt-2 z-50 w-80 rounded-2xl p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-sky-100/80 pb-2 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Notifications
                  </h4>
                  <span className="text-[10px] font-semibold text-brand-600 dark:text-cyan-400">
                    3 unread
                  </span>
                </div>
                <div className="flex flex-col gap-2 py-2">
                  <div className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-sky-50/60 dark:hover:bg-gray-800/60 transition-colors">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        New employee onboarded
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Arun Kumar joined Engineering
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-sky-50/60 dark:hover:bg-gray-800/60 transition-colors">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Leave request approved
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Priya's leave has been verified
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown (Glassmorphism) */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/80 p-1.5 pr-2.5 text-left hover:bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-cyan text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="hidden flex-col md:flex">
                <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white/90">
                  {displayName}
                </span>
                <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                  Software Engineer
                </span>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:inline-block" />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="glass-dropdown absolute right-0 mt-2 z-50 w-56 rounded-2xl p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
              >
                <div className="border-b border-sky-100/80 px-3 py-2 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-900 dark:text-white/90">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {user?.email || "admin@texawave.com"}
                  </p>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Accordion Drawer (ensures 100% accessible navigation on narrow screens) */}
      {mobileMenuOpen && (
        <div className="glass-dropdown border-b border-sky-100 px-4 py-3 md:hidden dark:border-gray-800">
          <div className="flex flex-col gap-2">
            {ERP_MODULES.filter((m) => m.available).map((mod) => {
              const categories = filterCategories(mod.categories);
              const isModuleExpanded = openModuleId === mod.id;

              return (
                <div
                  key={mod.id}
                  className="rounded-xl border border-sky-100/70 p-2 dark:border-gray-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (categories.length > 0) {
                        setOpenModuleId((prev) =>
                          prev === mod.id ? null : mod.id,
                        );
                      } else {
                        router.push(mod.path);
                        setMobileMenuOpen(false);
                      }
                    }}
                    className="flex w-full items-center justify-between text-xs font-bold text-gray-900 dark:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <mod.icon className="h-4 w-4 text-brand-600" />
                      <span>{mod.label}</span>
                    </div>
                    {categories.length > 0 && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isModuleExpanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>

                  {isModuleExpanded && categories.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-sky-100/60 pt-2 dark:border-gray-800">
                      {categories.map((cat) => {
                        const isCatExpanded = activeCategoryId === cat.id;

                        if (
                          cat.path &&
                          (!cat.children || cat.children.length === 0)
                        ) {
                          return (
                            <Link
                              key={cat.id}
                              href={cat.path}
                              onClick={handleLeafClick}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-sky-50 dark:text-gray-300"
                            >
                              <cat.icon className="h-3.5 w-3.5 text-brand-500" />
                              <span>{cat.label}</span>
                            </Link>
                          );
                        }

                        return (
                          <div key={cat.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveCategoryId((prev) =>
                                  prev === cat.id ? null : cat.id,
                                )
                              }
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-sky-50 dark:text-gray-300"
                            >
                              <div className="flex items-center gap-2">
                                <cat.icon className="h-3.5 w-3.5 text-brand-500" />
                                <span>{cat.label}</span>
                              </div>
                              <ChevronDown
                                className={`h-3 w-3 transition-transform ${
                                  isCatExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {isCatExpanded && cat.children && (
                              <div className="ml-4 flex flex-col gap-0.5 border-l border-sky-200 pl-2">
                                {cat.children.map((child) => (
                                  <Link
                                    key={child.id}
                                    href={child.path}
                                    onClick={handleLeafClick}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-sky-50 hover:text-brand-600 dark:text-gray-400"
                                  >
                                    <child.icon className="h-3 w-3" />
                                    <span>{child.label}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
