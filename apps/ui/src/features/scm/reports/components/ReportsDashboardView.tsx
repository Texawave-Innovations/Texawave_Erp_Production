"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { formatMoney } from "../../shared/format";
import { useReportsOverview } from "../hooks";

import {
  AlertTriangle,
  BarChart3,
  Factory,
  FileText,
  LineChart,
  type LucideIcon,
  ShieldCheck,
  ShoppingCart,
  Target,
  Truck,
  Undo2,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import {
  ScmDashboardPage,
  type DashboardAction,
} from "../../shared/ScmDashboardPage";
const KPI_ICONS: Record<string, LucideIcon> = {
  "open-pos": ShoppingCart,
  "open-po-value": Wallet,
  "low-stock": AlertTriangle,
  "open-fulfillments": Truck,
  "in-transit": Truck,
  "open-returns": Undo2,
  "pending-inspections": ShieldCheck,
  "active-suppliers": Factory,
};

const ACTIONS: DashboardAction[] = [
  {
    label: "Procurement Report",
    icon: LineChart,
    href: "/scm/reports/procurement",
  },
  {
    label: "Inventory Report",
    icon: BarChart3,
    href: "/scm/reports/inventory",
  },
  {
    label: "Warehouse Report",
    icon: Warehouse,
    href: "/scm/reports/warehouse",
  },
  {
    label: "Fulfillment Report",
    icon: Target,
    href: "/scm/reports/fulfillment",
  },
  { label: "Logistics Report", icon: Truck, href: "/scm/reports/logistics" },
  { label: "Returns Report", icon: Undo2, href: "/scm/reports/returns" },
  { label: "Quality Report", icon: ShieldCheck, href: "/scm/reports/quality" },
  { label: "Supplier Report", icon: Users, href: "/scm/reports/suppliers" },
];

/** Legacy `ScmReportsDashboard`: executive KPIs across every SCM domain,
 * linking into the detailed report behind each number. */
export function ReportsDashboardView() {
  const query = useReportsOverview();

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to reports">
          Ask an administrator for the <code>scm.reports.read</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const d = query.data;
  const cards: {
    id: string;
    label: string;
    value: number | string;
    note: string;
    href: string;
    tone?: "warning" | "brand" | "success" | "info" | "blue";
  }[] = [
    {
      id: "open-pos",
      label: "Open Purchase Orders",
      value: d.openPOs,
      note: "Committed, goods pending",
      href: "/scm/reports/procurement",
      tone: "brand",
    },
    {
      id: "open-po-value",
      label: "Open PO Value",
      value: formatMoney(d.openPOValue, "INR", 0),
      note: "Committed spend not yet received",
      href: "/scm/reports/procurement",
      tone: "success",
    },
    {
      id: "low-stock",
      label: "Low / Out of Stock",
      value: d.lowStockProducts,
      note: "At or below reorder level",
      href: "/scm/reports/inventory",
      tone: "warning",
    },
    {
      id: "open-fulfillments",
      label: "Open Fulfillments",
      value: d.openFulfillments,
      note: "Not yet fulfilled",
      href: "/scm/reports/fulfillment",
      tone: "blue",
    },
    {
      id: "in-transit",
      label: "Shipments In Transit",
      value: d.shipmentsInTransit,
      note: "With the carrier",
      href: "/scm/reports/logistics",
      tone: "blue",
    },
    {
      id: "open-returns",
      label: "Open Returns",
      value: d.openReturns,
      note: "Not yet completed",
      href: "/scm/reports/returns",
      tone: "warning",
    },
    {
      id: "pending-inspections",
      label: "Pending QC Inspections",
      value: d.pendingInspections,
      note: "Not yet completed",
      href: "/scm/reports/quality",
      tone: "warning",
    },
    {
      id: "active-suppliers",
      label: "Active Suppliers",
      value: d.activeSuppliers,
      note: "Available to source from",
      href: "/scm/reports/suppliers",
      tone: "success",
    },
  ];

  return (
    <ScmDashboardPage
      title="Reports"
      subtitle="Executive SCM KPIs across procurement, inventory, warehouse, fulfillment, logistics, returns, quality and suppliers."
      kpis={cards.map((c) => ({
        id: c.id,
        label: c.label,
        value: c.value,
        href: c.href,
        note: c.note,
        icon: KPI_ICONS[c.id] ?? FileText,
      }))}
      actions={ACTIONS}
    />
  );
}
