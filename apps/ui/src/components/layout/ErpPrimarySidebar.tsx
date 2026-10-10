"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  UserCheck,
  ShoppingBag,
  Package,
  Landmark,
  Users,
  FolderKanban,
  FileText,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";

export interface ErpModuleItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  isActive?: boolean;
}

const PRIMARY_MODULES: ErpModuleItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
  },
  { id: "sales", label: "Sales", icon: ShoppingCart, path: "#" },
  { id: "crm", label: "CRM", icon: UserCheck, path: "#" },
  { id: "purchases", label: "Purchases", icon: ShoppingBag, path: "#" },
  { id: "scm", label: "SCM", icon: Package, path: "#" },
  { id: "finance", label: "Finance", icon: Landmark, path: "#" },
  { id: "hr", label: "HR", icon: Users, path: "/hr" },
  { id: "projects", label: "Projects", icon: FolderKanban, path: "#" },
  { id: "documents", label: "Document Center", icon: FileText, path: "#" },
  { id: "master-lists", label: "Master Lists", icon: ClipboardList, path: "#" },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/admin/users",
  },
];

/**
 * Leftmost ERP Primary Module Sidebar.
 * Displays TexaWave ERP branding and primary enterprise modules.
 * Conforms to Section 4 & Docs/DESIGN_SYSTEM.md.
 */
export function ErpPrimarySidebar() {
  const pathname = usePathname();

  // Determine active module
  const isHrActive =
    pathname.startsWith("/hr") || pathname === "/admin/departments";

  const isSettingsActive =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reference") ||
    pathname.startsWith("/admin/users") ||
    pathname === "/admin/roles" ||
    pathname === "/admin/menu";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-100 px-5 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <TexaLogo size="sm" is3d className="h-7 w-auto" />
          <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
            TexaWave ERP
          </span>
        </div>
      </div>

      {/* Module Navigation List */}
      <nav aria-label="ERP Modules" className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {PRIMARY_MODULES.map((mod) => {
            const active =
              mod.id === "hr"
                ? isHrActive
                : mod.id === "settings"
                  ? isSettingsActive
                  : false;
            const isClickable = mod.path !== "#";

            return (
              <li key={mod.id}>
                {isClickable ? (
                  <Link
                    href={mod.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-theme-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                      active
                        ? "bg-brand-50/90 text-brand-700 font-semibold dark:bg-brand-950/60 dark:text-brand-300 border-l-4 border-brand-500"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <mod.icon className="h-4 w-4 shrink-0" />
                    <span>{mod.label}</span>
                  </Link>
                ) : (
                  <div
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-theme-xs font-medium text-gray-400 opacity-60 dark:text-gray-600"
                    title={`${mod.label} — In development`}
                  >
                    <div className="flex items-center gap-3">
                      <mod.icon className="h-4 w-4 shrink-0" />
                      <span>{mod.label}</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
