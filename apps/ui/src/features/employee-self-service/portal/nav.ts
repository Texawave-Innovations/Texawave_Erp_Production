"use client";

import type { MenuTreeNode } from "@texawave-erp/api-types";
import {
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  MapPin,
  Receipt,
  TicketCheck,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useMyMenu } from "@/features/menu/hooks";
import { usePermission } from "@/hooks/usePermission";
import { SELF_SERVICE_PUNCH } from "@/features/hr/attendance/permissions";

export interface PortalNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown only when the user's menu (getMyMenu) contains this code. */
  menuCode?: string;
  /** Shown only when the user holds this permission (no menu row exists). */
  permission?: string;
  /** Active only on an exact path match. */
  exact?: boolean;
}

export interface PortalNavGroup {
  label: string;
  items: PortalNavItem[];
}

/**
 * Group labels, order, item labels and icons mirror the legacy employee
 * portal sidebar exactly (TexaWave_ERP_old
 * src/modules/employee/EmployeePortalLayout.tsx `buildNavGroups`). Each item
 * is still gated by its `portal-*` menu code (packages/database/prisma/menu/
 * catalog.ts), so RBAC is unchanged — only the presentation follows legacy.
 *
 * Differences from legacy, on purpose:
 * - "My Timesheet" and "My Work" are not listed: the work-log module was
 *   removed from this ERP and My Work lives in the Projects workspace.
 * - Items legacy never had (Team Attendance, Team Leaves, My Loans, My Tax)
 *   sit in the legacy group they belong to; plain employees never see them
 *   because they hold none of those permissions.
 */
export const PORTAL_NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        path: "/portal",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "ATTENDANCE",
    items: [
      {
        path: "/portal/checkin",
        label: "Check In / Out",
        icon: MapPin,
        permission: SELF_SERVICE_PUNCH,
      },
      {
        path: "/portal/attendance",
        label: "Attendance",
        icon: Calendar,
        menuCode: "portal-attendance",
      },
      {
        path: "/portal/team-attendance",
        label: "Team Attendance",
        icon: Users,
        menuCode: "portal-team-attendance",
      },
    ],
  },
  {
    label: "LEAVES",
    items: [
      {
        path: "/portal/leave",
        label: "Leave Tracker",
        icon: CalendarDays,
        menuCode: "portal-leave",
      },
      {
        path: "/portal/team-leaves",
        label: "Team Leaves",
        icon: Users,
        menuCode: "portal-team-leaves",
      },
    ],
  },
  {
    label: "WORK & PROJECTS",
    items: [
      {
        path: "/portal/tasks",
        label: "Personal Tasks",
        icon: ClipboardList,
        menuCode: "portal-tasks",
      },
      {
        path: "/portal/task-assignment",
        label: "Assign Tasks",
        icon: Briefcase,
        menuCode: "portal-task-assignment",
      },
    ],
  },
  {
    label: "EXPENSES",
    items: [
      {
        path: "/portal/expense-claims",
        label: "My Expenses",
        icon: Receipt,
        menuCode: "portal-expense-claims",
      },
    ],
  },
  {
    label: "PAYROLL",
    items: [
      {
        path: "/portal/payslips",
        label: "My Payslips",
        icon: Wallet,
        menuCode: "portal-payslips",
      },
      {
        path: "/portal/loans",
        label: "My Loans",
        icon: HandCoins,
        menuCode: "portal-loans",
      },
      {
        path: "/portal/tax",
        label: "My Tax",
        icon: Receipt,
        menuCode: "portal-tax",
      },
    ],
  },
  {
    label: "MY INFO",
    items: [
      {
        path: "/portal/profile",
        label: "My Profile",
        icon: User,
        menuCode: "portal-profile",
      },
      {
        path: "/portal/documents",
        label: "Documents",
        icon: FolderOpen,
        menuCode: "portal-documents",
      },
      {
        path: "/portal/tickets",
        label: "Raise Ticket",
        icon: TicketCheck,
        menuCode: "portal-tickets",
      },
      {
        path: "/portal/exit-requests",
        label: "Exit Request",
        icon: DoorOpen,
        menuCode: "portal-exit-requests",
      },
    ],
  },
];

const KNOWN_CODES = new Set(
  PORTAL_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.menuCode)).filter(
    (code): code is string => code !== undefined,
  ),
);

export function isPortalNavItemActive(
  item: PortalNavItem,
  pathname: string,
): boolean {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function buildGroups(
  portal: MenuTreeNode | undefined,
  canPunch: boolean,
): PortalNavGroup[] {
  const children = portal?.children ?? [];
  const allowed = new Set(children.map((c) => c.code));

  const groups = PORTAL_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.menuCode) return allowed.has(item.menuCode);
      if (item.permission) return canPunch;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  // Any portal menu row an administrator added that legacy never had keeps
  // working: it is listed after the legacy groups under its own label.
  const extra = children.flatMap((c): PortalNavItem[] =>
    c.path && !KNOWN_CODES.has(c.code)
      ? [{ path: c.path, label: c.label, icon: ChevronRight }]
      : [],
  );
  if (extra.length > 0) groups.push({ label: "MORE", items: extra });

  return groups;
}

/**
 * The portal sidebar groups the signed-in user may see, in legacy order.
 * `status` lets the sidebar show a skeleton / error like DynamicSidebar.
 */
export function usePortalNavGroups() {
  const menu = useMyMenu();
  const canPunch = usePermission(SELF_SERVICE_PUNCH);
  const groups = useMemo(
    () =>
      menu.data
        ? buildGroups(
            menu.data.find((node) => node.code === "portal"),
            canPunch,
          )
        : [],
    [menu.data, canPunch],
  );
  return { groups, isPending: menu.isPending, isError: menu.isError };
}
