"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  LayoutDashboard,
  Users,
  Settings,
  ShoppingCart,
  Package,
  Landmark,
  FolderKanban,
  BarChart3,
  LineChart,
  ScanLine,
  Siren,
  PackageSearch,
  Bot,
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
  MapPin,
  Award,
  ListTodo,
  Receipt,
  Ticket,
  ShieldCheck,
  Shield,
  Tag,
  CheckCircle2,
  Wallet,
  UserCheck,
  CheckCheck,
  UserPlus,
  TrendingUp,
  PhoneCall,
  MessageCircle,
  Link2,
  Mail,
  Target,
  Trash2,
  Table2,
  Database,
  Factory,
  ClipboardList,
  Scale,
  Truck,
  Undo2,
  RotateCw,
  SearchCheck,
  Split,
  ClipboardCheck,
  BadgeAlert,
  ShieldAlert,
  ScrollText,
  Warehouse,
  PackagePlus,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import {
  Spinner,
  Semantic3DIcon,
  DropdownMenu,
  type Icon3DName,
} from "@texawave-erp/ui-kit";
import { useAuthStore } from "@/stores/auth-store";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import { useMyMenu } from "@/features/menu/hooks";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/features/notifications/hooks";
import type { AppNotification } from "@/features/notifications/types";
import type { MenuTreeNode } from "@texawave-erp/api-types";

export interface NavLeafItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  icon3d?: Icon3DName;
  iconColor?: string;
  menuCode: string;
}

export interface NavCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  icon3d?: Icon3DName;
  iconColor?: string;
  /** If category is a direct link without children (e.g. Overview) */
  path?: string;
  menuCode?: string;
  children?: NavLeafItem[];
}

export interface ErpModuleConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  icon3d?: Icon3DName;
  path: string;
  available: boolean;
  upcoming?: boolean;
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
    icon3d: "overview",
    iconColor: "text-sky-500",
    path: "/hr/dashboard",
    menuCode: "hr-dashboard",
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    icon3d: "people",
    iconColor: "text-blue-600",
    children: [
      {
        id: "employees",
        label: "Employees",
        path: "/hr/employees",
        icon: Users,
        icon3d: "employees",
        iconColor: "text-blue-600",
        menuCode: "hr-employees",
      },
      {
        id: "profiles",
        label: "Profiles",
        path: "/hr/profiles",
        icon: Contact,
        icon3d: "profiles",
        iconColor: "text-cyan-600",
        menuCode: "hr-profiles",
      },
      {
        id: "employee-documents",
        label: "Employee Documents",
        path: "/hr/employee-documents",
        icon: FileText,
        icon3d: "documents",
        iconColor: "text-sky-600",
        menuCode: "hr-employee-documents",
      },
      {
        id: "org-chart",
        label: "Org Chart",
        path: "/hr/org-chart",
        icon: Network,
        icon3d: "org-chart",
        iconColor: "text-blue-500",
        menuCode: "hr-org-chart",
      },
      {
        id: "departments",
        label: "Departments",
        path: "/hr/departments",
        icon: Building2,
        icon3d: "departments",
        iconColor: "text-blue-600",
        menuCode: "hr-departments",
      },
      {
        id: "teams",
        label: "Teams",
        path: "/hr/teams",
        icon: UsersRound,
        icon3d: "teams",
        iconColor: "text-blue-600",
        menuCode: "hr-teams",
      },
    ],
  },
  {
    id: "time-leave",
    label: "Time & Leave",
    icon: Calendar,
    icon3d: "time-leave",
    iconColor: "text-rose-500",
    children: [
      {
        id: "attendance",
        label: "Attendance",
        path: "/hr/attendance",
        icon: Clock,
        icon3d: "attendance",
        menuCode: "hr-attendance",
      },
      {
        id: "regularization",
        label: "Regularization",
        path: "/hr/regularization",
        icon: CalendarCheck,
        icon3d: "regularization",
        menuCode: "hr-regularization",
      },
      {
        id: "location-privilege",
        label: "Location Privilege",
        path: "/hr/location-privilege",
        icon: MapPin,
        icon3d: "location-privilege",
        menuCode: "hr-location-privilege",
      },
      {
        id: "full-month-present",
        label: "Full Month Present",
        path: "/hr/full-month-present",
        icon: Award,
        icon3d: "full-month-present",
        menuCode: "hr-full-month-present",
      },
      {
        id: "leaves",
        label: "Leaves",
        path: "/hr/leaves",
        icon: Calendar,
        icon3d: "leaves",
        menuCode: "hr-leaves",
      },
      {
        id: "holidays",
        label: "Holidays",
        path: "/hr/holidays",
        icon: CalendarDays,
        icon3d: "holidays",
        menuCode: "hr-holidays",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Settings,
    icon3d: "operations",
    iconColor: "text-blue-600",
    children: [
      {
        id: "tasks",
        label: "Tasks",
        path: "/hr/tasks",
        icon: ListTodo,
        icon3d: "tasks",
        menuCode: "hr-tasks",
      },
      {
        id: "expense-approvals",
        label: "Expense Approvals",
        path: "/hr/expense-approvals",
        icon: Receipt,
        icon3d: "expense-approvals",
        menuCode: "hr-expense-approvals",
      },
      {
        id: "tickets",
        label: "Employee Tickets",
        path: "/hr/tickets",
        icon: Ticket,
        icon3d: "tickets",
        menuCode: "hr-tickets",
      },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    icon: UserCheck,
    icon3d: "recruitment",
    iconColor: "text-sky-600",
    children: [
      {
        id: "recruitment-pipeline",
        label: "Recruitment Pipeline",
        path: "/hr/recruitment",
        icon: Briefcase,
        icon3d: "recruitment",
        menuCode: "hr-recruitment",
      },
      {
        id: "exit-requests",
        label: "Exit Requests",
        path: "/hr/exit-requests",
        icon: UserMinus,
        icon3d: "exit-requests",
        menuCode: "hr-exit-requests",
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: Wallet,
    icon3d: "payroll",
    iconColor: "text-cyan-600",
    children: [
      {
        id: "payroll-overview",
        label: "Payroll Processing",
        path: "/hr/payroll",
        icon: Wallet,
        icon3d: "payroll",
        iconColor: "text-cyan-600",
        menuCode: "hr-payroll",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    icon3d: "compliance",
    iconColor: "text-indigo-600",
    children: [
      {
        id: "compliance-overview",
        label: "Statutory Compliance",
        path: "/hr/compliance",
        icon: ShieldCheck,
        icon3d: "compliance",
        iconColor: "text-indigo-600",
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
    icon3d: "access-control",
    children: [
      {
        id: "users",
        label: "Users",
        path: "/admin/users",
        icon: Users,
        icon3d: "users",
        menuCode: "admin-users",
      },
      {
        id: "roles",
        label: "Roles",
        path: "/admin/roles",
        icon: Shield,
        icon3d: "roles",
        menuCode: "admin-roles",
      },
    ],
  },
  {
    id: "system-config",
    label: "Configuration",
    icon: Settings,
    icon3d: "settings",
    children: [
      {
        id: "menu",
        label: "Navigation Menu",
        path: "/admin/menu",
        icon: MenuIcon,
        icon3d: "menu",
        menuCode: "admin-menu",
      },
      {
        id: "reference-tags",
        label: "Reference Tags",
        path: "/reference/tags",
        icon: Tag,
        icon3d: "tags",
        menuCode: "reference-tags",
      },
    ],
  },
];

/**
 * CRM Navigation Hierarchy
 */
const CRM_CATEGORIES: NavCategory[] = [
  {
    id: "crm-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    icon3d: "dashboard",
    iconColor: "text-indigo-600",
    path: "/crm/dashboard",
    menuCode: "crm-dashboard",
  },
  {
    id: "sales-deals",
    label: "Sales & Deals",
    icon: TrendingUp,
    icon3d: "sales",
    iconColor: "text-blue-600",
    children: [
      {
        id: "leads",
        label: "Leads",
        path: "/crm/leads",
        icon: UserPlus,
        icon3d: "recruitment",
        menuCode: "crm-leads",
      },
      {
        id: "pipeline",
        label: "Pipeline Board",
        path: "/crm/pipeline",
        icon: BarChart3,
        icon3d: "overview",
        menuCode: "crm-pipeline",
      },
      {
        id: "quotes",
        label: "Quotations",
        path: "/crm/quotes",
        icon: Receipt,
        icon3d: "payroll",
        menuCode: "crm-quotes",
      },
      {
        id: "products",
        label: "Products",
        path: "/crm/products",
        icon: Package,
        icon3d: "inventory-scm",
        menuCode: "crm-products",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers & Contacts",
    icon: Users,
    icon3d: "people",
    iconColor: "text-emerald-600",
    children: [
      {
        id: "accounts",
        label: "Accounts",
        path: "/crm/accounts",
        icon: Building2,
        icon3d: "departments",
        menuCode: "crm-accounts",
      },
      {
        id: "contacts",
        label: "Contacts",
        path: "/crm/contacts",
        icon: Contact,
        icon3d: "profiles",
        menuCode: "crm-contacts",
      },
    ],
  },
  {
    id: "outreach",
    label: "Outreach & Queues",
    icon: Clock,
    icon3d: "time-leave",
    iconColor: "text-purple-600",
    children: [
      {
        id: "cold-calling-status",
        label: "Cold Calling Status",
        path: "/crm/cold-calling-status",
        icon: PhoneCall,
        icon3d: "attendance",
        menuCode: "crm-cold-calling-status",
      },
      {
        id: "interested",
        label: "Interested",
        path: "/crm/interested",
        icon: CheckCircle2,
        icon3d: "compliance",
        menuCode: "crm-interested",
      },
      {
        id: "not-interested",
        label: "Not Interested",
        path: "/crm/not-interested",
        icon: X,
        icon3d: "exit-requests",
        menuCode: "crm-not-interested",
      },
      {
        id: "keep-in-touch",
        label: "Keep in Touch",
        path: "/crm/keep-in-touch",
        icon: Calendar,
        icon3d: "leaves",
        menuCode: "crm-keep-in-touch",
      },
      {
        id: "callback-send-info",
        label: "Call Back / Send Info",
        path: "/crm/callback-send-info",
        icon: FileText,
        icon3d: "documents",
        menuCode: "crm-callback-send-info",
      },
      {
        id: "yet-to-happen",
        label: "Yet to Happen",
        path: "/crm/yet-to-happen",
        icon: ListTodo,
        icon3d: "tasks",
        menuCode: "crm-yet-to-happen",
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: MessageCircle,
    icon3d: "people",
    iconColor: "text-green-600",
    children: [
      {
        id: "whatsapp",
        label: "WhatsApp",
        path: "/crm/whatsapp",
        icon: MessageCircle,
        icon3d: "people",
        menuCode: "crm-whatsapp",
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        path: "/crm/linkedin",
        icon: Link2,
        icon3d: "profiles",
        menuCode: "crm-linkedin",
      },
      {
        id: "email",
        label: "Email",
        path: "/crm/email",
        icon: Mail,
        icon3d: "documents",
        menuCode: "crm-email",
      },
    ],
  },
  {
    id: "data-tools",
    label: "Data & Tools",
    icon: Database,
    icon3d: "documents",
    iconColor: "text-amber-600",
    children: [
      {
        id: "accounts-mining-sheet",
        label: "Accounts Mining Sheet",
        path: "/crm/accounts-mining-sheet",
        icon: Table2,
        icon3d: "departments",
        menuCode: "crm-accounts-mining-sheet",
      },
      {
        id: "overall-data",
        label: "Overall Data",
        path: "/crm/overall-data",
        icon: Database,
        icon3d: "overview",
        menuCode: "crm-overall-data",
      },
      {
        id: "quotas",
        label: "Target",
        path: "/crm/quotas",
        icon: Target,
        icon3d: "compliance",
        menuCode: "crm-quotas",
      },
      {
        id: "crm-calendar",
        label: "Calendar",
        path: "/crm/calendar",
        icon: CalendarDays,
        icon3d: "leaves",
        menuCode: "crm-calendar",
      },
      {
        id: "crm-search",
        label: "Search",
        path: "/crm/search",
        icon: Search,
        icon3d: "profiles",
        menuCode: "crm-search",
      },
      {
        id: "recycle-bin",
        label: "Recycle Bin",
        path: "/crm/recycle-bin",
        icon: Trash2,
        icon3d: "exit-requests",
        menuCode: "crm-recycle-bin",
      },
    ],
  },
];

/**
 * SCM Navigation Hierarchy. Grows one migrated slice at a time
 * (Docs/SCM_LEGACY_PARITY.md section 11); Suppliers is the first.
 */
const SCM_SOURCE_CATEGORIES: NavCategory[] = [
  {
    id: "scm-overview-group",
    label: "Overview",
    icon: LayoutDashboard,
    icon3d: "dashboard",
    iconColor: "text-sky-600",
    children: [
      {
        id: "scm-overview",
        label: "Overview",
        path: "/scm/overview",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-overview",
      },
      {
        id: "scm-master-data",
        label: "Master Data",
        path: "/scm/master-data",
        icon: Database,
        icon3d: "overview",
        menuCode: "scm-master-data",
      },
      {
        id: "scm-barcode",
        label: "Barcode & Scanning",
        path: "/scm/barcode",
        icon: ScanLine,
        icon3d: "overview",
        menuCode: "scm-barcode",
      },
    ],
  },
  {
    id: "scm-suppliers",
    label: "Suppliers",
    icon: Factory,
    icon3d: "inventory-scm",
    iconColor: "text-indigo-600",
    path: "/scm/suppliers",
    menuCode: "scm-suppliers",
  },
  {
    id: "scm-catalog",
    label: "Catalogue & Warehouses",
    icon: Package,
    icon3d: "inventory-scm",
    iconColor: "text-emerald-600",
    children: [
      {
        id: "scm-products",
        label: "Products",
        path: "/scm/products",
        icon: Package,
        icon3d: "inventory-scm",
        menuCode: "scm-products",
      },
      {
        id: "scm-warehouses",
        label: "Warehouses",
        path: "/scm/warehouses",
        icon: Building2,
        icon3d: "departments",
        menuCode: "scm-warehouses",
      },
      {
        id: "scm-locations",
        label: "Locations",
        path: "/scm/locations",
        icon: MapPin,
        icon3d: "overview",
        menuCode: "scm-locations",
      },
    ],
  },
  {
    id: "scm-procurement-group",
    label: "Procurement",
    icon: ClipboardList,
    icon3d: "purchases",
    iconColor: "text-amber-600",
    children: [
      {
        id: "scm-procurement",
        label: "Dashboard",
        path: "/scm/procurement",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-procurement",
      },
      {
        id: "scm-requisitions",
        label: "Purchase Requisitions",
        path: "/scm/procurement/requisitions",
        icon: FileText,
        icon3d: "documents",
        menuCode: "scm-requisitions",
      },
      {
        id: "scm-rfqs",
        label: "RFQs",
        path: "/scm/procurement/rfqs",
        icon: Mail,
        icon3d: "overview",
        menuCode: "scm-rfqs",
      },
      {
        id: "scm-quotations",
        label: "Supplier Quotations",
        path: "/scm/procurement/quotations",
        icon: Receipt,
        icon3d: "payroll",
        menuCode: "scm-quotations",
      },
      {
        id: "scm-comparison",
        label: "Quotation Comparison",
        path: "/scm/procurement/comparison",
        icon: Scale,
        icon3d: "overview",
        menuCode: "scm-comparison",
      },
      {
        id: "scm-purchase-orders",
        label: "Purchase Orders",
        path: "/scm/procurement/purchase-orders",
        icon: ShoppingCart,
        icon3d: "purchases",
        menuCode: "scm-purchase-orders",
      },
      {
        id: "scm-grn",
        label: "Goods Receipts",
        path: "/scm/procurement/goods-receipts",
        icon: CheckCircle2,
        icon3d: "overview",
        menuCode: "scm-grn",
      },
    ],
  },
  {
    id: "scm-inventory",
    label: "Inventory",
    icon: Database,
    icon3d: "inventory-scm",
    iconColor: "text-blue-600",
    children: [
      {
        id: "scm-stock-overview",
        label: "Stock Overview",
        path: "/scm/inventory/overview",
        icon: Table2,
        icon3d: "overview",
        menuCode: "scm-stock-overview",
      },
      {
        id: "scm-stock-ledger",
        label: "Stock Ledger",
        path: "/scm/inventory/ledger",
        icon: FileText,
        icon3d: "documents",
        menuCode: "scm-stock-ledger",
      },
      {
        id: "scm-reservations",
        label: "Reservations",
        path: "/scm/inventory/reservations",
        icon: ShieldCheck,
        icon3d: "compliance",
        menuCode: "scm-reservations",
      },
      {
        id: "scm-transfers",
        label: "Transfers",
        path: "/scm/inventory/transfers",
        icon: Link2,
        icon3d: "overview",
        menuCode: "scm-transfers",
      },
      {
        id: "scm-adjustments",
        label: "Adjustments",
        path: "/scm/inventory/adjustments",
        icon: ListTodo,
        icon3d: "overview",
        menuCode: "scm-adjustments",
      },
      {
        id: "scm-batches",
        label: "Batches",
        path: "/scm/inventory/batches",
        icon: Tag,
        icon3d: "overview",
        menuCode: "scm-batches",
      },
      {
        id: "scm-serials",
        label: "Serial Numbers",
        path: "/scm/inventory/serials",
        icon: CheckCheck,
        icon3d: "overview",
        menuCode: "scm-serials",
      },
    ],
  },
  {
    id: "scm-advanced-group",
    label: "Advanced SCM",
    icon: Siren,
    icon3d: "compliance",
    iconColor: "text-red-600",
    children: [
      {
        id: "scm-control-tower",
        label: "Control Tower",
        path: "/scm/advanced/control-tower",
        icon: Siren,
        icon3d: "compliance",
        menuCode: "scm-control-tower",
      },
      {
        id: "scm-replenishment",
        label: "Replenishment",
        path: "/scm/advanced/replenishment",
        icon: PackageSearch,
        icon3d: "overview",
        menuCode: "scm-replenishment",
      },
      {
        id: "scm-assistant",
        label: "Assistant",
        path: "/scm/assistant",
        icon: Bot,
        icon3d: "overview",
        menuCode: "scm-assistant",
      },
    ],
  },
  {
    id: "scm-reports-group",
    label: "Reports",
    icon: BarChart3,
    icon3d: "overview",
    iconColor: "text-fuchsia-600",
    children: [
      {
        id: "scm-reports",
        label: "Overview",
        path: "/scm/reports",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-reports",
      },
      {
        id: "scm-reports-procurement",
        label: "Procurement",
        path: "/scm/reports/procurement",
        icon: LineChart,
        icon3d: "overview",
        menuCode: "scm-reports-procurement",
      },
      {
        id: "scm-reports-inventory",
        label: "Inventory",
        path: "/scm/reports/inventory",
        icon: BarChart3,
        icon3d: "overview",
        menuCode: "scm-reports-inventory",
      },
      {
        id: "scm-reports-warehouse",
        label: "Warehouse",
        path: "/scm/reports/warehouse",
        icon: Warehouse,
        icon3d: "overview",
        menuCode: "scm-reports-warehouse",
      },
      {
        id: "scm-reports-fulfillment",
        label: "Fulfillment",
        path: "/scm/reports/fulfillment",
        icon: Target,
        icon3d: "overview",
        menuCode: "scm-reports-fulfillment",
      },
      {
        id: "scm-reports-logistics",
        label: "Logistics",
        path: "/scm/reports/logistics",
        icon: Truck,
        icon3d: "overview",
        menuCode: "scm-reports-logistics",
      },
      {
        id: "scm-reports-returns",
        label: "Returns",
        path: "/scm/reports/returns",
        icon: Undo2,
        icon3d: "overview",
        menuCode: "scm-reports-returns",
      },
      {
        id: "scm-reports-quality",
        label: "Quality",
        path: "/scm/reports/quality",
        icon: ShieldCheck,
        icon3d: "overview",
        menuCode: "scm-reports-quality",
      },
      {
        id: "scm-reports-suppliers",
        label: "Suppliers",
        path: "/scm/reports/suppliers",
        icon: Users,
        icon3d: "overview",
        menuCode: "scm-reports-suppliers",
      },
    ],
  },
  {
    id: "scm-warehouse-ops",
    label: "Warehouse",
    icon: Warehouse,
    icon3d: "inventory-scm",
    iconColor: "text-purple-600",
    children: [
      {
        id: "scm-warehouse-dashboard",
        label: "Dashboard",
        path: "/scm/warehouse",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-warehouse-dashboard",
      },
      {
        id: "scm-putaway",
        label: "Put-away",
        path: "/scm/warehouse/putaway",
        icon: PackagePlus,
        icon3d: "overview",
        menuCode: "scm-putaway",
      },
      {
        id: "scm-movements",
        label: "Internal Movements",
        path: "/scm/warehouse/movements",
        icon: ArrowLeftRight,
        icon3d: "overview",
        menuCode: "scm-movements",
      },
      {
        id: "scm-warehouse-activity",
        label: "Activity",
        path: "/scm/warehouse/activity",
        icon: ScrollText,
        icon3d: "documents",
        menuCode: "scm-warehouse-activity",
      },
    ],
  },
  {
    id: "scm-customers-group",
    label: "Customers",
    icon: Users,
    icon3d: "employees",
    iconColor: "text-pink-600",
    path: "/scm/customers",
    menuCode: "scm-customers",
  },
  {
    id: "scm-orders",
    label: "Orders & Fulfillment",
    icon: ShoppingCart,
    icon3d: "purchases",
    iconColor: "text-rose-600",
    children: [
      {
        id: "scm-sales-orders",
        label: "Sales Orders",
        path: "/scm/orders/sales-orders",
        icon: ShoppingCart,
        icon3d: "purchases",
        menuCode: "scm-sales-orders",
      },
      {
        id: "scm-allocation",
        label: "Allocation",
        path: "/scm/orders/allocation",
        icon: Link2,
        icon3d: "overview",
        menuCode: "scm-allocation",
      },
      {
        id: "scm-backorders",
        label: "Backorders",
        path: "/scm/orders/backorders",
        icon: ListTodo,
        icon3d: "overview",
        menuCode: "scm-backorders",
      },
      {
        id: "scm-fulfillment",
        label: "Fulfillment",
        path: "/scm/orders/fulfillment",
        icon: CheckCircle2,
        icon3d: "overview",
        menuCode: "scm-fulfillment",
      },
      {
        id: "scm-picking",
        label: "Picking",
        path: "/scm/warehouse/picking",
        icon: ListTodo,
        icon3d: "overview",
        menuCode: "scm-picking",
      },
      {
        id: "scm-packing",
        label: "Packing",
        path: "/scm/warehouse/packing",
        icon: Package,
        icon3d: "inventory-scm",
        menuCode: "scm-packing",
      },
    ],
  },
  {
    id: "scm-logistics-group",
    label: "Logistics",
    icon: Truck,
    icon3d: "inventory-scm",
    iconColor: "text-cyan-600",
    children: [
      {
        id: "scm-logistics",
        label: "Logistics Dashboard",
        path: "/scm/logistics",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-logistics",
      },
      {
        id: "scm-deliveries",
        label: "Deliveries",
        path: "/scm/logistics/deliveries",
        icon: Package,
        icon3d: "inventory-scm",
        menuCode: "scm-deliveries",
      },
      {
        id: "scm-shipments",
        label: "Shipments",
        path: "/scm/logistics/shipments",
        icon: Truck,
        icon3d: "inventory-scm",
        menuCode: "scm-shipments",
      },
      {
        id: "scm-carriers",
        label: "Carriers",
        path: "/scm/logistics/carriers",
        icon: Users,
        icon3d: "employees",
        menuCode: "scm-carriers",
      },
      {
        id: "scm-tracking",
        label: "Tracking",
        path: "/scm/logistics/tracking",
        icon: MapPin,
        icon3d: "overview",
        menuCode: "scm-tracking",
      },
    ],
  },
  {
    id: "scm-returns-group",
    label: "Returns",
    icon: Undo2,
    icon3d: "inventory-scm",
    iconColor: "text-orange-600",
    children: [
      {
        id: "scm-returns",
        label: "Dashboard",
        path: "/scm/returns",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-returns",
      },
      {
        id: "scm-returns-all",
        label: "All Returns",
        path: "/scm/returns/all",
        icon: ListTodo,
        icon3d: "overview",
        menuCode: "scm-returns-all",
      },
      {
        id: "scm-returns-customer",
        label: "Customer Returns",
        path: "/scm/returns/customer",
        icon: Undo2,
        icon3d: "inventory-scm",
        menuCode: "scm-returns-customer",
      },
      {
        id: "scm-returns-vendor",
        label: "Vendor Returns",
        path: "/scm/returns/vendor",
        icon: RotateCw,
        icon3d: "inventory-scm",
        menuCode: "scm-returns-vendor",
      },
      {
        id: "scm-returns-inspection",
        label: "Return Inspection",
        path: "/scm/returns/inspection",
        icon: SearchCheck,
        icon3d: "overview",
        menuCode: "scm-returns-inspection",
      },
      {
        id: "scm-returns-disposition",
        label: "Return Disposition",
        path: "/scm/returns/disposition",
        icon: Split,
        icon3d: "overview",
        menuCode: "scm-returns-disposition",
      },
    ],
  },
  {
    id: "scm-quality-group",
    label: "Quality",
    icon: ShieldCheck,
    icon3d: "compliance",
    iconColor: "text-teal-600",
    children: [
      {
        id: "scm-quality",
        label: "Quality Overview",
        path: "/scm/quality",
        icon: LayoutDashboard,
        icon3d: "dashboard",
        menuCode: "scm-quality",
      },
      {
        id: "scm-quality-inspections",
        label: "Inspections",
        path: "/scm/quality/inspections",
        icon: SearchCheck,
        icon3d: "overview",
        menuCode: "scm-quality-inspections",
      },
      {
        id: "scm-quality-templates",
        label: "Templates",
        path: "/scm/quality/templates",
        icon: ClipboardCheck,
        icon3d: "overview",
        menuCode: "scm-quality-templates",
      },
      {
        id: "scm-quality-defects",
        label: "Defects",
        path: "/scm/quality/defects",
        icon: BadgeAlert,
        icon3d: "overview",
        menuCode: "scm-quality-defects",
      },
      {
        id: "scm-quarantine",
        label: "Quarantine",
        path: "/scm/quality/quarantine",
        icon: ShieldAlert,
        icon3d: "compliance",
        menuCode: "scm-quarantine",
      },
      {
        id: "scm-quality-activity",
        label: "Activity",
        path: "/scm/quality/activity",
        icon: ScrollText,
        icon3d: "documents",
        menuCode: "scm-quality-activity",
      },
    ],
  },
];

const SCM_SOURCE_LEAVES: ReadonlyMap<string, NavLeafItem> = (() => {
  const map = new Map<string, NavLeafItem>();
  for (const cat of SCM_SOURCE_CATEGORIES) {
    if (cat.path && cat.menuCode) {
      map.set(cat.path, {
        id: cat.id,
        label: cat.label,
        path: cat.path,
        icon: cat.icon,
        ...(cat.icon3d ? { icon3d: cat.icon3d } : {}),
        menuCode: cat.menuCode,
      });
    }
    for (const child of cat.children ?? []) map.set(child.path, child);
  }
  return map;
})();

const scmLeaves = (
  entries: ReadonlyArray<readonly [path: string, label?: string]>,
): NavLeafItem[] =>
  entries.flatMap(([path, label]) => {
    const leaf = SCM_SOURCE_LEAVES.get(path);
    return leaf ? [label ? { ...leaf, label } : leaf] : [];
  });

const scmGroup = (
  id: string,
  label: string,
  styleFrom: string,
  entries: ReadonlyArray<readonly [path: string, label?: string]>,
): NavCategory => {
  const style = SCM_SOURCE_CATEGORIES.find((c) => c.label === styleFrom);
  return {
    id,
    label,
    icon: style?.icon ?? Package,
    ...(style?.icon3d ? { icon3d: style.icon3d } : {}),
    ...(style?.iconColor ? { iconColor: style.iconColor } : {}),
    children: scmLeaves(entries),
  };
};

const scmLink = (path: string): NavCategory[] =>
  scmLeaves([[path]]).map((leaf) => ({
    id: leaf.id,
    label: leaf.label,
    icon: leaf.icon,
    ...(leaf.icon3d ? { icon3d: leaf.icon3d } : {}),
    path: leaf.path,
    menuCode: leaf.menuCode,
  }));

/**
 * SCM navigation, in the legacy ERP's order: Overview, Suppliers, Barcode,
 * Master Data, then the Procurement / Inventory / Orders / Logistics /
 * Returns / Quality / Reports / Advanced SCM groups. Built from the page
 * list above so every entry keeps its menu-catalogue code (per-user RBAC).
 */
export const SCM_CATEGORIES: NavCategory[] = [
  ...scmLink("/scm/overview"),
  ...scmLink("/scm/suppliers"),
  ...scmLink("/scm/barcode"),
  ...scmLink("/scm/master-data"),
  scmGroup("scm-procurement-group", "Procurement", "Procurement", [
    ["/scm/procurement"],
    ["/scm/procurement/requisitions"],
    ["/scm/procurement/rfqs"],
    ["/scm/procurement/quotations"],
    ["/scm/procurement/comparison"],
    ["/scm/procurement/purchase-orders"],
    ["/scm/procurement/goods-receipts", "GRNs"],
  ]),
  scmGroup("scm-inventory-group", "Inventory", "Inventory", [
    ["/scm/warehouse", "Dashboard"],
    ["/scm/products"],
    ["/scm/inventory/overview"],
    ["/scm/warehouses"],
    ["/scm/locations"],
    ["/scm/warehouse/putaway"],
    ["/scm/warehouse/picking"],
    ["/scm/warehouse/packing"],
    ["/scm/warehouse/movements"],
    ["/scm/inventory/transfers"],
    ["/scm/inventory/reservations"],
    ["/scm/inventory/adjustments"],
    ["/scm/inventory/ledger"],
    ["/scm/inventory/batches"],
    ["/scm/inventory/serials"],
    ["/scm/warehouse/activity", "Activity"],
    ["/scm/advanced/replenishment"],
  ]),
  scmGroup("scm-orders-group", "Orders", "Orders & Fulfillment", [
    ["/scm/customers"],
    ["/scm/orders/sales-orders"],
    ["/scm/orders/allocation"],
    ["/scm/orders/backorders"],
    ["/scm/orders/fulfillment"],
  ]),
  scmGroup("scm-logistics-group", "Logistics", "Logistics", [
    ["/scm/logistics", "Dashboard"],
    ["/scm/logistics/shipments"],
    ["/scm/logistics/deliveries"],
    ["/scm/logistics/tracking"],
    ["/scm/logistics/carriers"],
  ]),
  scmGroup("scm-returns-group", "Returns", "Returns", [
    ["/scm/returns", "Dashboard"],
    ["/scm/returns/all"],
    ["/scm/returns/customer"],
    ["/scm/returns/vendor"],
    ["/scm/returns/inspection"],
    ["/scm/returns/disposition"],
  ]),
  scmGroup("scm-quality-group", "Quality", "Quality", [
    ["/scm/quality", "Quality Overview"],
    ["/scm/quality/inspections"],
    ["/scm/quality/templates"],
    ["/scm/quality/defects"],
    ["/scm/quality/quarantine"],
    ["/scm/quality/activity", "Activity"],
  ]),
  scmGroup("scm-reports-group", "Reports", "Reports", [
    ["/scm/reports", "Overview"],
    ["/scm/reports/procurement"],
    ["/scm/reports/inventory"],
    ["/scm/reports/warehouse"],
    ["/scm/reports/fulfillment"],
    ["/scm/reports/logistics"],
    ["/scm/reports/returns"],
    ["/scm/reports/quality"],
    ["/scm/reports/suppliers"],
  ]),
  scmGroup("scm-advanced-group", "Advanced SCM", "Advanced SCM", [
    ["/scm/advanced/control-tower"],
    ["/scm/assistant"],
  ]),
];

const ERP_MODULES: ErpModuleConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    icon3d: "dashboard",
    path: "/admin",
    available: true,
  },
  {
    id: "hr",
    label: "Human Resources",
    icon: Users,
    icon3d: "hr",
    path: "/hr/dashboard",
    available: true,
    categories: HR_CATEGORIES,
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingCart,
    icon3d: "sales",
    path: "#",
    available: false,
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    icon3d: "finance",
    path: "#",
    available: false,
  },
  {
    id: "inventory",
    label: "SCM",
    icon: Package,
    icon3d: "inventory-scm",
    path: "/scm/overview",
    available: true,
    categories: SCM_CATEGORIES,
  },
  {
    id: "crm",
    label: "CRM",
    icon: UsersRound,
    icon3d: "crm",
    path: "/crm/dashboard",
    available: true,
    categories: CRM_CATEGORIES,
  },
  {
    id: "purchases",
    label: "Purchases",
    icon: Receipt,
    icon3d: "purchases",
    path: "#",
    available: false,
    upcoming: true,
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    icon3d: "projects",
    path: "#",
    available: false,
  },
  {
    id: "master-list",
    label: "Master list",
    icon: BarChart3,
    icon3d: "master-list",
    path: "#",
    available: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    icon3d: "settings",
    path: "/admin/users",
    available: true,
    categories: SETTINGS_CATEGORIES,
  },
];

export function collectMenuCodes(
  nodes: readonly MenuTreeNode[],
  into: Set<string> = new Set(),
): Set<string> {
  for (const node of nodes) {
    into.add(node.code);
    collectMenuCodes(node.children, into);
  }
  return into;
}

function NavbarDateTimeCalendar() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle outside click & escape key
  useEffect(() => {
    if (!calendarOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setCalendarOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [calendarOpen]);

  // Formatted date and time
  const formattedDateLong = currentDate.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedDateShort = currentDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });

  const formattedTimeLong = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const formattedTimeShort = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Calendar month calculation
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToToday = () => setViewDate(new Date());

  const days: { day: number; currentMonth: boolean; isToday: boolean }[] = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      currentMonth: false,
      isToday: false,
    });
  }
  // Current month days
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === i;
    days.push({ day: i, currentMonth: true, isToday });
  }
  // Next month padding to fill grid
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, currentMonth: false, isToday: false });
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Current date and time. Click to open calendar"
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        onClick={() => setCalendarOpen((prev) => !prev)}
        className="flex h-9 items-center gap-1.5 sm:gap-2 rounded-xl border border-sky-100/90 bg-white/80 px-2 sm:px-2.5 2xl:px-3 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur-md transition-all hover:border-sky-300 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-sky-900/40 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer"
      >
        <Calendar className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400 shrink-0" />
        <span className="hidden 2xl:inline font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
          {formattedDateLong}
        </span>
        <span className="inline 2xl:hidden font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px]">
          {formattedDateShort}
        </span>
        <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
        <Clock className="h-3.5 w-3.5 text-sky-500 dark:text-cyan-300 shrink-0" />
        <span className="hidden 2xl:inline tabular-nums font-semibold text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {formattedTimeLong}
        </span>
        <span className="inline 2xl:hidden tabular-nums font-semibold text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {formattedTimeShort}
        </span>
      </button>

      {/* Interactive Calendar Dropdown Popover */}
      {calendarOpen && (
        <div
          role="dialog"
          aria-label="Interactive Calendar"
          className="glass-calendar-surface absolute right-0 top-full mt-2.5 z-50 w-74 rounded-2xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-sky-100/70 dark:border-slate-800">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-xl border border-sky-100/80 bg-white/60 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-500 dark:text-slate-400 cursor-pointer shadow-2xs transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              {monthName}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-sky-100 dark:bg-slate-800 dark:text-cyan-300 cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-7.5 w-7.5 items-center justify-center rounded-xl border border-sky-100/80 bg-white/60 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-500 dark:text-slate-400 cursor-pointer shadow-2xs transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((item, idx) => (
              <span
                key={idx}
                className={`flex h-7.5 w-7.5 items-center justify-center rounded-xl text-xs transition-all ${
                  item.isToday
                    ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-102"
                    : item.currentMonth
                      ? "text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 font-semibold cursor-default"
                      : "text-slate-300 dark:text-slate-600 cursor-default"
                }`}
              >
                {item.day}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatAgo(iso: string): string {
  const diffMinutes = Math.round(
    (Date.now() - new Date(iso).getTime()) / 60_000,
  );
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/** True when `pathname` is `path` or lives under it. */
const underPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

function findRouteNavigationState(pathname: string) {
  for (const mod of ERP_MODULES) {
    if (!mod.categories) continue;
    // The deepest matching page wins: a section's dashboard (e.g.
    // /scm/procurement) is a path prefix of its other pages, and must not
    // be picked just because it is listed first.
    let best: {
      length: number;
      categoryId: string;
      leafId: string | null;
    } | null = null;
    for (const cat of mod.categories) {
      if (cat.path && underPath(pathname, cat.path)) {
        if (!best || cat.path.length > best.length) {
          best = { length: cat.path.length, categoryId: cat.id, leafId: null };
        }
      }
      for (const leaf of cat.children ?? []) {
        if (
          underPath(pathname, leaf.path) &&
          (!best || leaf.path.length > best.length)
        ) {
          best = {
            length: leaf.path.length,
            categoryId: cat.id,
            leafId: leaf.id,
          };
        }
      }
    }
    if (best) {
      return {
        moduleId: mod.id,
        categoryId: best.categoryId,
        leafId: best.leafId,
      };
    }
  }
  if (pathname === "/admin/departments") {
    return { moduleId: "hr", categoryId: "people", leafId: "departments" };
  }
  if (pathname === "/admin/designations") {
    return { moduleId: "hr", categoryId: "people", leafId: "designations" };
  }
  if (pathname.startsWith("/hr") || pathname.startsWith("/self-service")) {
    return { moduleId: "hr", categoryId: "overview", leafId: null };
  }
  if (
    pathname === "/" ||
    pathname === "/admin" ||
    pathname === "/admin/" ||
    pathname === "/admin/dashboard" ||
    pathname === "/admin/dashboard/"
  ) {
    return { moduleId: "dashboard", categoryId: null, leafId: null };
  }
  if (
    pathname.startsWith("/admin/users") ||
    pathname.startsWith("/admin/roles") ||
    pathname.startsWith("/admin/menu") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reference")
  ) {
    return { moduleId: "settings", categoryId: "access-control", leafId: null };
  }
  if (pathname.startsWith("/crm")) {
    return {
      moduleId: "crm",
      categoryId: pathname.startsWith("/crm/dashboard")
        ? "crm-dashboard"
        : null,
      leafId: null,
    };
  }
  if (pathname.startsWith("/admin")) {
    return { moduleId: "dashboard", categoryId: null, leafId: null };
  }
  return { moduleId: null, categoryId: null, leafId: null };
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface HorizontalNavbarProps {
  onSignOut: () => void;
}

export function HorizontalNavbar({ onSignOut }: HorizontalNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const menuQuery = useMyMenu();

  // Navigation Dropdown state: separate hovered preview from pinned selection
  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);
  const [pinnedModuleId, setPinnedModuleId] = useState<string | null>(null);

  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(
    null,
  );
  const [pinnedCategoryId, setPinnedCategoryId] = useState<string | null>(null);

  const [submenuAlignLeft, setSubmenuAlignLeft] = useState(false);

  // Shell popover states
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notification queries
  const unreadCountQuery = useUnreadNotificationCount();
  const unreadCount = unreadCountQuery.data ?? 0;
  const notifListQuery = useNotifications(notificationsOpen);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Spring glide active indicator state (CodeFronts specification)
  const navRailRef = useRef<HTMLElement>(null);
  const moduleButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const categoryItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const submenuMenuRef = useRef<HTMLDivElement>(null);
  const [submenuTopOffset, setSubmenuTopOffset] = useState<number>(0);

  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navContainerRef = useRef<HTMLElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Derive active module, category, and leaf from current URL route
  const routeState = useMemo(
    () => findRouteNavigationState(pathname),
    [pathname],
  );
  const currentActiveModuleId = routeState.moduleId;

  // Active indicator module state: locks immediately on selection and prevents bounce back during route transition
  const [clickedModuleId, setClickedModuleId] = useState<string | null>(null);
  const [prevRouteModuleId, setPrevRouteModuleId] = useState(
    currentActiveModuleId,
  );

  if (prevRouteModuleId !== currentActiveModuleId) {
    setPrevRouteModuleId(currentActiveModuleId);
    setClickedModuleId(null);
  }

  const activeIndicatorModuleId =
    clickedModuleId ?? currentActiveModuleId ?? "hr";
  const setActiveIndicatorModuleId = setClickedModuleId;

  const updateIndicator = useCallback((moduleId: string | null) => {
    if (!moduleId || !navRailRef.current) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const buttonEl = moduleButtonRefs.current.get(moduleId);
    if (!buttonEl) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const navRect = navRailRef.current.getBoundingClientRect();
    const btnRect = buttonEl.getBoundingClientRect();
    const left = btnRect.left - navRect.left;
    const top = btnRect.top - navRect.top;
    const width = btnRect.width;
    const height = btnRect.height;

    setIndicatorStyle({
      left,
      top,
      width,
      height,
      opacity: 1,
    });
  }, []);

  useEffect(() => {
    updateIndicator(activeIndicatorModuleId);
  }, [activeIndicatorModuleId, updateIndicator]);

  // Initial calculation / font layout update
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      updateIndicator(activeIndicatorModuleId);
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeIndicatorModuleId, updateIndicator]);

  // Recalculate indicator on window resize or container layout change
  useEffect(() => {
    if (!navRailRef.current) return;
    const observer = new ResizeObserver(() => {
      updateIndicator(activeIndicatorModuleId);
    });
    observer.observe(navRailRef.current);
    return () => observer.disconnect();
  }, [activeIndicatorModuleId, updateIndicator]);

  const handleOpenNotification = (n: AppNotification) => {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    setNotificationsOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const closeAllMenus = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredModuleId(null);
    setPinnedModuleId(null);
    setHoveredCategoryId(null);
    setPinnedCategoryId(null);
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
  }, []);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Close menus on route change
  const prevPathnameRef = useRef(pathname);
  const keepMenuOpenOnNavRef = useRef(false);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      if (keepMenuOpenOnNavRef.current) {
        keepMenuOpenOnNavRef.current = false;
        return;
      }
      closeAllMenus();
    }
  }, [pathname, closeAllMenus]);

  // Close menus on outside click or escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAllMenus();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(target)
      ) {
        closeAllMenus();
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
  }, [closeAllMenus]);

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

  // Effective open module: hovered module previews; otherwise pinned module stays open
  const openModuleId = hoveredModuleId ?? pinnedModuleId;

  const activeModuleConfig = ERP_MODULES.find((m) => m.id === openModuleId);
  const activeCategories = filterCategories(activeModuleConfig?.categories);

  // Active selected category in Level 2 (displays blue gradient .glass-item-active):
  // 1. Explicitly pinned category (clicked by user)
  // 2. Current route-derived category (if current route is within this module)
  // 3. Fallback to first category if no route category exists
  const activeCategoryId = useMemo(() => {
    if (
      pinnedCategoryId &&
      activeCategories.some((c) => c.id === pinnedCategoryId)
    ) {
      return pinnedCategoryId;
    }
    const routeCat = activeCategories.find(
      (c) => c.id === routeState.categoryId,
    );
    if (routeCat) {
      return routeCat.id;
    }
    return activeCategories[0]?.id ?? null;
  }, [pinnedCategoryId, routeState.categoryId, activeCategories]);

  // Category whose Level 3 submenu flyout is open:
  // 1. Actively hovered category with children
  // 2. Explicitly pinned category with children
  // 3. Route-derived category with children
  // 4. Fallback to first category with children
  const openSubmenuCategoryId = useMemo(() => {
    if (
      hoveredCategoryId &&
      activeCategories.some(
        (c) =>
          c.id === hoveredCategoryId && c.children && c.children.length > 0,
      )
    ) {
      return hoveredCategoryId;
    }
    if (
      pinnedCategoryId &&
      activeCategories.some(
        (c) => c.id === pinnedCategoryId && c.children && c.children.length > 0,
      )
    ) {
      return pinnedCategoryId;
    }
    const routeCat = activeCategories.find(
      (c) => c.id === routeState.categoryId,
    );
    if (routeCat && routeCat.children && routeCat.children.length > 0) {
      return routeCat.id;
    }
    // The active category is a plain link (e.g. CRM Dashboard) — don't open an
    // unrelated category's flyout just because it happens to come first.
    const activeCat = activeCategories.find((c) => c.id === activeCategoryId);
    if (activeCat && !(activeCat.children && activeCat.children.length > 0)) {
      return null;
    }
    const firstWithChildren = activeCategories.find(
      (c) => c.children && c.children.length > 0,
    );
    return firstWithChildren ? firstWithChildren.id : null;
  }, [
    hoveredCategoryId,
    pinnedCategoryId,
    routeState.categoryId,
    activeCategories,
    activeCategoryId,
  ]);

  const activeCategoryObj = activeCategories.find(
    (c) => c.id === openSubmenuCategoryId,
  );
  const activeSubmenuItems = activeCategoryObj?.children ?? [];

  const activeCategoryIndex = activeCategories.findIndex(
    (c) => c.id === openSubmenuCategoryId,
  );

  // Shared parent-relative positioning mechanism for Level 3 submenu (Payroll, Compliance, and all categories)
  useIsomorphicLayoutEffect(() => {
    if (!openModuleId || !openSubmenuCategoryId || !categoryMenuRef.current) {
      setSubmenuTopOffset(0);
      return;
    }
    const catEl = categoryItemRefs.current.get(openSubmenuCategoryId);
    const parentMenuEl = categoryMenuRef.current;
    if (catEl && parentMenuEl) {
      const parentRect = parentMenuEl.getBoundingClientRect();
      const catRect = catEl.getBoundingClientRect();
      const rawOffset = catRect.top - parentRect.top;

      // Keep submenu within viewport vertically
      const submenuEl = submenuMenuRef.current;
      const submenuHeight = submenuEl ? submenuEl.offsetHeight : 0;
      if (submenuHeight > 0) {
        const viewportBottom = window.innerHeight - 16;
        const currentSubmenuBottom = catRect.top + submenuHeight;
        if (currentSubmenuBottom > viewportBottom) {
          const overflow = currentSubmenuBottom - viewportBottom;
          setSubmenuTopOffset(Math.max(0, rawOffset - overflow));
          return;
        }
      }

      setSubmenuTopOffset(Math.max(0, rawOffset));
    } else {
      // Reliable fallback based on category index and row height
      if (activeCategoryIndex > 0) {
        setSubmenuTopOffset(activeCategoryIndex * 44);
      } else {
        setSubmenuTopOffset(0);
      }
    }
  }, [
    openModuleId,
    openSubmenuCategoryId,
    activeCategories,
    activeCategoryIndex,
    activeSubmenuItems.length,
  ]);

  // Check submenu viewport horizontal overflow
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
  }, [openModuleId, openSubmenuCategoryId]);

  // Hover handlers
  const handleMouseEnterModule = (moduleId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const mod = ERP_MODULES.find((m) => m.id === moduleId);
    if (mod && mod.available) {
      setHoveredModuleId(moduleId);
    }
  };

  const handleMouseLeaveNav = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    // If user explicitly pinned a module, do not close on mouse leave
    if (pinnedModuleId) {
      setHoveredModuleId(null);
      setHoveredCategoryId(null);
      return;
    }
    // Transient hover close timer
    closeTimerRef.current = setTimeout(() => {
      setHoveredModuleId(null);
      setHoveredCategoryId(null);
    }, 120);
  };

  const handleNavRailMouseLeave = () => {
    handleMouseLeaveNav();
  };

  const handleMouseEnterDropdown = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleModuleClick = (mod: ErpModuleConfig) => {
    // CRM and SCM: clicking the top-level item opens the module's landing page
    // (CRM dashboard / SCM overview) AND keeps the category dropdown pinned
    // open until the user clicks outside / Escape.
    if (mod.id === "crm" || mod.id === "inventory") {
      setPinnedModuleId(mod.id);
      setHoveredModuleId(mod.id);
      setPinnedCategoryId(null);
      setHoveredCategoryId(null);
      if (pathname !== mod.path) {
        keepMenuOpenOnNavRef.current = true;
        router.push(mod.path);
      }
      return;
    }
    const hasCategories = Boolean(mod.categories && mod.categories.length > 0);
    if (hasCategories) {
      if (pinnedModuleId === mod.id) {
        // Toggle closed
        setPinnedModuleId(null);
        setHoveredModuleId(null);
        setPinnedCategoryId(null);
        setHoveredCategoryId(null);
      } else {
        // Pin open
        setPinnedModuleId(mod.id);
        setHoveredModuleId(mod.id);
        setPinnedCategoryId(null);
        setHoveredCategoryId(null);
      }
    } else {
      closeAllMenus();
      router.push(mod.path);
    }
  };

  const handleCategoryHover = (catId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredCategoryId(catId);
  };

  const handleCategoryClick = (cat: NavCategory, targetModuleId?: string) => {
    if (targetModuleId) {
      setActiveIndicatorModuleId(targetModuleId);
    }
    if (cat.path && (!cat.children || cat.children.length === 0)) {
      closeAllMenus();
      router.push(cat.path);
    } else if (cat.children && cat.children.length > 0) {
      // Pin category submenu open
      setPinnedCategoryId(cat.id);
      setHoveredCategoryId(cat.id);
    }
  };

  const handleLeafClick = (
    targetModuleId?: string | React.MouseEvent<HTMLElement>,
  ) => {
    if (typeof targetModuleId === "string") {
      setActiveIndicatorModuleId(targetModuleId);
    }
    closeAllMenus();
  };

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
      {/* Primary Module Rail with TexaOne Header Banner Linear Gradient Glass */}
      <div className="glass-navbar flex h-16 items-center justify-between px-3 sm:px-4 lg:px-4 xl:px-4 2xl:px-6">
        {/* Left: Mobile hamburger + Brand Logo */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/70 backdrop-blur-md text-slate-700 hover:bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-brand-500 md:hidden dark:border-sky-900/40 dark:bg-gray-800/70 dark:text-gray-200"
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

        {/* Center: Desktop Module Navigation (Level 1) with Spring Glide Active Indicator */}
        <nav
          ref={navRailRef}
          aria-label="Main application navigation"
          onMouseLeave={handleNavRailMouseLeave}
          className="relative hidden flex-1 min-w-0 items-center justify-center gap-0.5 px-0.5 sm:gap-0.5 md:flex lg:gap-1 2xl:gap-1.5 isolate"
        >
          {/* Spring Glide Active Indicator Pill */}
          <span
            aria-hidden="true"
            className="tab-prime-pill absolute pointer-events-none z-0 rounded-xl transition-[left,top,width,height,opacity] duration-200 ease-spring-glide motion-reduce:transition-none"
            style={{
              left: `${indicatorStyle.left}px`,
              top: `${indicatorStyle.top}px`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          {ERP_MODULES.map((mod) => {
            const isRouteActive = mod.id === activeIndicatorModuleId;
            const isDropdownOpen = mod.id === openModuleId;
            const isHovered = mod.id === hoveredModuleId;
            const hasCategories = Boolean(
              mod.categories && mod.categories.length > 0,
            );

            if (!mod.available) {
              return (
                <div
                  key={mod.id}
                  className="relative group shrink min-w-0 w-14 sm:w-15 md:w-15 lg:w-15.5 xl:w-16.5 2xl:w-20.5 h-13.5"
                >
                  <button
                    type="button"
                    disabled
                    title={`${mod.label}${mod.upcoming ? " — Upcoming module" : " — Coming soon"}`}
                    className="flex w-full h-full cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 opacity-60 hover:opacity-85 transition-all"
                  >
                    <div className="relative flex items-center justify-center">
                      {mod.icon3d ? (
                        <Semantic3DIcon
                          name={mod.icon3d}
                          size={24}
                          className="opacity-75 transition-transform group-hover:scale-105 shrink-0"
                        />
                      ) : (
                        <mod.icon className="h-4.5 w-4.5 text-gray-500 shrink-0" />
                      )}
                      {mod.upcoming && (
                        <span className="absolute -top-1 -right-3 rounded-full bg-sky-100/95 px-1 py-0.2 text-[7.5px] font-bold text-[#0284c7] border border-sky-200/80 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800 leading-none shadow-2xs">
                          Soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center max-w-full px-0.5">
                      <span className="text-[9.5px] font-semibold leading-tight text-center text-slate-500 dark:text-gray-400 lg:text-[10px] xl:text-[11px] truncate max-w-full">
                        {mod.label}
                      </span>
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={mod.id}
                className="relative shrink min-w-0 w-14 sm:w-15 md:w-15 lg:w-15.5 xl:w-16.5 2xl:w-20.5 h-13.5"
                onMouseEnter={() => handleMouseEnterModule(mod.id)}
              >
                <button
                  type="button"
                  ref={(el) => {
                    if (el) moduleButtonRefs.current.set(mod.id, el);
                    else moduleButtonRefs.current.delete(mod.id);
                  }}
                  aria-haspopup={hasCategories ? "menu" : undefined}
                  aria-expanded={hasCategories ? isDropdownOpen : undefined}
                  aria-current={isRouteActive ? "page" : undefined}
                  onClick={() => handleModuleClick(mod)}
                  onFocus={() => handleMouseEnterModule(mod.id)}
                  onBlur={handleNavRailMouseLeave}
                  className={`group relative z-1 flex w-full h-full flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 outline-none transition-all duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    isRouteActive
                      ? "font-bold text-white shadow-2xs"
                      : isDropdownOpen
                        ? "bg-white text-[#0a3271] shadow-2xs dark:bg-slate-800 dark:text-white font-semibold"
                        : "text-slate-600 hover:bg-white hover:text-[#0a3271] hover:shadow-2xs dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-white font-medium"
                  }`}
                >
                  {mod.icon3d ? (
                    <Semantic3DIcon
                      name={mod.icon3d}
                      size={24}
                      className="transition-transform duration-150 group-hover:scale-110 shrink-0"
                    />
                  ) : (
                    <mod.icon
                      className={`h-4.5 w-4.5 transition-transform duration-150 group-hover:scale-110 shrink-0 ${
                        isRouteActive
                          ? "text-white"
                          : isDropdownOpen
                            ? "text-[#0a3271] dark:text-white"
                            : "text-slate-600 group-hover:text-[#0a3271] dark:text-gray-400 dark:group-hover:text-white"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center justify-center max-w-full px-0.5">
                    <span
                      className={`text-[9.5px] leading-tight text-center lg:text-[10px] xl:text-[10.5px] 2xl:text-[11px] truncate max-w-full ${
                        isRouteActive ? "font-bold text-white" : "font-semibold"
                      }`}
                    >
                      {mod.label}
                    </span>
                  </div>
                  {isRouteActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0.5 h-1 w-1 rounded-full bg-white/90"
                    />
                  )}
                </button>

                {/* Level 2 & Level 3 Glassmorphism Dropdowns */}
                {hasCategories && isDropdownOpen && (
                  <div
                    ref={categoryMenuRef}
                    role="menu"
                    aria-label={`${mod.label} categories`}
                    onMouseEnter={handleMouseEnterDropdown}
                    className="glass-dropdown absolute left-0 top-full mt-2.5 z-50 flex min-w-56 rounded-[26px] p-2.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    {/* Level 2: Categories Column */}
                    <div className="flex w-52 flex-col gap-1">
                      {activeCategories.map((cat) => {
                        const isCatActive = cat.id === activeCategoryId;
                        const isCatFlyoutOpen =
                          cat.id === openSubmenuCategoryId;
                        const isCatRouteActive =
                          cat.id === routeState.categoryId;
                        const hasChildren = Boolean(
                          cat.children && cat.children.length > 0,
                        );

                        if (cat.path && !hasChildren) {
                          return (
                            <div
                              key={cat.id}
                              ref={(el) => {
                                if (el)
                                  categoryItemRefs.current.set(cat.id, el);
                                else categoryItemRefs.current.delete(cat.id);
                              }}
                              className="relative"
                            >
                              <Link
                                href={cat.path}
                                onClick={() => handleLeafClick(mod.id)}
                                className={`group flex w-full items-center justify-between rounded-[18px] border border-transparent outline-none focus:outline-none px-3.5 py-2.5 text-xs font-semibold transition-[color,background-color] duration-150 ${
                                  isCatActive
                                    ? "glass-item-active"
                                    : "text-slate-700 hover:bg-sky-500/10 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {isCatActive ? (
                                    <cat.icon className="h-4.5 w-4.5 shrink-0 text-white" />
                                  ) : cat.icon3d ? (
                                    <Semantic3DIcon
                                      name={cat.icon3d}
                                      size={20}
                                      className="shrink-0 transition-transform group-hover:scale-105"
                                    />
                                  ) : (
                                    <cat.icon className="h-4.5 w-4.5 shrink-0 text-slate-700 group-hover:text-slate-950 dark:text-gray-300 dark:group-hover:text-white" />
                                  )}
                                  <span
                                    className={
                                      isCatActive
                                        ? "text-white font-semibold"
                                        : ""
                                    }
                                  >
                                    {cat.label}
                                  </span>
                                </div>
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${
                                    isCatActive
                                      ? "text-white"
                                      : "text-slate-400/80 group-hover:text-slate-700 dark:text-gray-400"
                                  }`}
                                />
                              </Link>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={cat.id}
                            ref={(el) => {
                              if (el) categoryItemRefs.current.set(cat.id, el);
                              else categoryItemRefs.current.delete(cat.id);
                            }}
                            className="relative"
                          >
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={isCatFlyoutOpen}
                              onMouseEnter={() => handleCategoryHover(cat.id)}
                              onClick={() => handleCategoryClick(cat, mod.id)}
                              className={`group flex w-full items-center justify-between rounded-[18px] border border-transparent outline-none focus:outline-none px-3.5 py-2.5 text-xs font-semibold transition-[color,background-color] duration-150 ${
                                isCatActive
                                  ? "glass-item-active"
                                  : isCatRouteActive
                                    ? "bg-sky-500/15 text-brand-700 font-semibold dark:bg-sky-400/20 dark:text-cyan-300"
                                    : "text-slate-700 hover:bg-sky-500/10 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {isCatActive ? (
                                  <cat.icon className="h-4.5 w-4.5 shrink-0 text-white" />
                                ) : isCatRouteActive ? (
                                  cat.icon3d ? (
                                    <Semantic3DIcon
                                      name={cat.icon3d}
                                      size={20}
                                      className="shrink-0"
                                    />
                                  ) : (
                                    <cat.icon className="h-4.5 w-4.5 shrink-0 text-brand-600 dark:text-cyan-400" />
                                  )
                                ) : cat.icon3d ? (
                                  <Semantic3DIcon
                                    name={cat.icon3d}
                                    size={20}
                                    className="shrink-0 transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <cat.icon className="h-4.5 w-4.5 shrink-0 text-slate-700 group-hover:text-slate-950 dark:text-gray-300 dark:group-hover:text-white" />
                                )}
                                <span
                                  className={
                                    isCatActive
                                      ? "text-white font-semibold"
                                      : ""
                                  }
                                >
                                  {cat.label}
                                </span>
                              </div>
                              {hasChildren && (
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${
                                    isCatActive
                                      ? "text-white translate-x-0.5"
                                      : isCatFlyoutOpen
                                        ? "text-brand-600 translate-x-0.5 dark:text-cyan-400"
                                        : isCatRouteActive
                                          ? "text-brand-600 translate-x-0.5 dark:text-cyan-400"
                                          : "text-slate-400/80 group-hover:text-slate-700 group-hover:translate-x-0.5 dark:text-gray-400"
                                  }`}
                                />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Level 3: Nested Submenu Column (Adjacent flyout) */}
                    {activeSubmenuItems.length > 0 && (
                      <div
                        ref={submenuMenuRef}
                        role="menu"
                        aria-label={`${activeCategoryObj?.label} items`}
                        onMouseEnter={handleMouseEnterDropdown}
                        style={{ top: `${submenuTopOffset}px` }}
                        className={`absolute z-50 flex min-w-60 flex-col gap-1 rounded-[26px] glass-dropdown p-2.5 shadow-2xl animate-in fade-in-0 duration-150 ${
                          submenuAlignLeft
                            ? "right-full mr-2.5 after:absolute after:-right-3.5 after:top-0 after:bottom-0 after:w-3.5"
                            : "left-full ml-2.5 before:absolute before:-left-3.5 before:top-0 before:bottom-0 before:w-3.5"
                        }`}
                      >
                        {activeSubmenuItems.map((item, _i, items) => {
                          // Only the deepest matching page is highlighted, so a
                          // section dashboard is not lit up with its sub-pages.
                          const deepest = Math.max(
                            0,
                            ...items
                              .filter((o) => underPath(pathname, o.path))
                              .map((o) => o.path.length),
                          );
                          const isLeafActive =
                            underPath(pathname, item.path) &&
                            item.path.length === deepest;

                          return (
                            <Link
                              key={item.id}
                              href={item.path}
                              onClick={() => handleLeafClick(mod.id)}
                              className={`group flex items-center justify-between rounded-[18px] border border-transparent outline-none focus:outline-none px-3.5 py-2.5 text-xs font-semibold transition-[color,background-color] duration-150 ${
                                isLeafActive
                                  ? "glass-item-active"
                                  : "text-slate-700 hover:bg-sky-500/10 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {isLeafActive ? (
                                  <item.icon className="h-4.5 w-4.5 shrink-0 text-white" />
                                ) : item.icon3d ? (
                                  <Semantic3DIcon
                                    name={item.icon3d}
                                    size={20}
                                    className="shrink-0 transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <item.icon className="h-4.5 w-4.5 shrink-0 text-slate-700 group-hover:text-slate-950 dark:text-gray-300 dark:group-hover:text-white" />
                                )}
                                <span
                                  className={
                                    isLeafActive
                                      ? "text-white font-semibold"
                                      : ""
                                  }
                                >
                                  {item.label}
                                </span>
                              </div>
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

        {/* Right Section: Date & Time Calendar + Notifications + Profile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-2 2xl:gap-2.5">
          {/* Interactive Date, Time & Calendar Dropdown */}
          <NavbarDateTimeCalendar />

          {/* Notifications Dropdown (Glassmorphism) */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/70 backdrop-blur-md text-slate-600 hover:bg-white hover:text-slate-900 shadow-2xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-sky-900/40 dark:bg-gray-800/70 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-all"
            >
              <Semantic3DIcon name="bell" size={20} />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs"
                  aria-hidden="true"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                role="region"
                aria-label="Recent notifications"
                className="glass-dropdown absolute right-0 mt-2 z-50 w-80 rounded-[26px] p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-sky-100/80 pb-2 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Notifications
                  </h4>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-semibold text-brand-600 dark:text-cyan-400">
                        {unreadCount} unread
                      </span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        disabled={markAllRead.isPending}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:underline dark:text-cyan-400 disabled:opacity-50"
                      >
                        <CheckCheck className="h-3 w-3" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto py-2">
                  {notifListQuery.isPending ? (
                    <div className="flex justify-center py-6">
                      <Spinner className="h-5 w-5 text-brand-600" />
                    </div>
                  ) : notifListQuery.isError ? (
                    <p className="py-4 text-center text-xs text-rose-500">
                      Could not load notifications.
                    </p>
                  ) : notifListQuery.data?.data &&
                    notifListQuery.data.data.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {notifListQuery.data.data.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleOpenNotification(n)}
                          className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sky-50/70 dark:hover:bg-gray-800/60 ${
                            n.readAt
                              ? "opacity-75"
                              : "bg-sky-50/50 dark:bg-brand-950/20"
                          }`}
                        >
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                            <Bell className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {n.title}
                            </p>
                            <p className="text-[10px] text-gray-500 line-clamp-2">
                              {n.body}
                            </p>
                            <span className="text-[9px] text-gray-400">
                              {formatAgo(n.createdAt)}
                            </span>
                          </div>
                          {!n.readAt && (
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-2 ring-white dark:ring-gray-900"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                      You&apos;re all caught up.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown (Shared Animated Glassmorphism DropdownMenu) */}
          <div className="relative shrink-0">
            <DropdownMenu
              align="end"
              headerSlot={
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white/90">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {user?.email || "admin@texawave.com"}
                  </p>
                </div>
              }
              options={[
                {
                  label: "Sign out",
                  Icon: <LogOut className="h-4 w-4" />,
                  variant: "destructive",
                  onClick: onSignOut,
                },
              ]}
            >
              <button
                type="button"
                aria-label={`Profile menu for ${displayName}`}
                className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-md p-1 2xl:p-1.5 2xl:pr-2 text-left hover:bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-sky-900/40 dark:bg-gray-800/70 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1769F5] to-brand-cyan text-xs font-bold text-white shadow-xs">
                  {initials}
                </div>
                <div className="hidden 2xl:flex flex-col">
                  <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white/90 max-w-28 truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 max-w-28 truncate">
                    Software Engineer
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            </DropdownMenu>
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
                        setPinnedModuleId((prev) =>
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
                        const isCatExpanded =
                          (hoveredCategoryId ?? pinnedCategoryId) === cat.id;

                        if (
                          cat.path &&
                          (!cat.children || cat.children.length === 0)
                        ) {
                          return (
                            <Link
                              key={cat.id}
                              href={cat.path}
                              onClick={() => handleLeafClick(mod.id)}
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
                                setPinnedCategoryId((prev) =>
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
                                    onClick={() => handleLeafClick(mod.id)}
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
