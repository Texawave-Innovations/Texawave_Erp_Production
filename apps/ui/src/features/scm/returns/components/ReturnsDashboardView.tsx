"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useReturnsDashboard } from "../hooks";

import {
  ClipboardCheck,
  FileText,
  type LucideIcon,
  PackageCheck,
  Plus,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Split,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  ScmDashboardPage,
  type DashboardAction,
} from "../../shared/ScmDashboardPage";
const KPI_ICONS: Record<string, LucideIcon> = {
  "pending-approval": ClipboardCheck,
  "in-transit": Truck,
  received: PackageCheck,
  "pending-inspection": SearchCheck,
  "pending-disposition": Split,
  restocked: Warehouse,
  quarantined: ShieldAlert,
  completed: ShieldCheck,
};

const ACTIONS: DashboardAction[] = [
  { label: "New Customer Return", icon: Plus, href: "/scm/returns/customer" },
  { label: "New Vendor Return", icon: Plus, href: "/scm/returns/vendor" },
  { label: "All Returns", icon: FileText, href: "/scm/returns/all" },
  {
    label: "Return Inspection",
    icon: SearchCheck,
    href: "/scm/returns/inspection",
  },
];

const sum = (m: Record<string, number>, keys: string[]) =>
  keys.reduce((s, k) => s + (m[k] ?? 0), 0);

/** Legacy `ScmReturnsDashboard`: return pipeline KPIs with links into each list. */
export function ReturnsDashboardView() {
  const query = useReturnsDashboard();

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to returns">
          Ask an administrator for the <code>scm.returns.read</code> permission.
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
      id: "pending-approval",
      label: "Pending Approval",
      value: sum(d.byStatus, ["REQUESTED", "PENDING_APPROVAL"]),
      note: "Awaiting a decision",
      href: "/scm/returns/all",
      tone: "warning",
    },
    {
      id: "in-transit",
      label: "In Transit",
      value: sum(d.byStatus, ["IN_TRANSIT", "SHIPPED"]),
      note: "On the way",
      href: "/scm/returns/all",
      tone: "blue",
    },
    {
      id: "received",
      label: "Received",
      value: sum(d.byStatus, ["RECEIVED", "VENDOR_RECEIVED"]),
      note: "Awaiting inspection",
      href: "/scm/returns/all",
      tone: "info",
    },
    {
      id: "pending-inspection",
      label: "Pending Inspection",
      value: sum(d.byStatus, ["INSPECTION_PENDING"]),
      note: "Needs a QC call",
      href: "/scm/returns/all",
      tone: "warning",
    },
    {
      id: "pending-disposition",
      label: "Pending Disposition",
      value: sum(d.byStatus, ["DISPOSITION_PENDING"]),
      note: "Needs a stock decision",
      href: "/scm/returns/all",
      tone: "warning",
    },
    {
      id: "restocked",
      label: "Restocked",
      value: d.dispositionedQty.RESTOCK ?? 0,
      note: "Units returned to sellable stock",
      href: "/scm/returns/customer",
      tone: "success",
    },
    {
      id: "quarantined",
      label: "Quarantined",
      value: d.dispositionedQty.QUARANTINE ?? 0,
      note: "Units held for QC review",
      href: "/scm/quality/quarantine",
      tone: "brand",
    },
    {
      id: "completed",
      label: "Completed",
      value: d.byStatus.COMPLETED ?? 0,
      note: "Fully processed",
      href: "/scm/returns/all",
      tone: "success",
    },
  ];

  return (
    <ScmDashboardPage
      title="Returns Dashboard"
      subtitle="Customer and vendor returns — approval, receipt, inspection, disposition and inventory reversal."
      kpis={cards.map((c) => ({
        id: c.id,
        label: c.label,
        value: c.value,
        href: c.href,
        note: c.note,
        icon: KPI_ICONS[c.id] ?? FileText,
      }))}
      actions={ACTIONS}
      activityEmpty="No returns yet."
      activity={d.recent.map((r) => ({
        key: String(r.id),
        type:
          r.returnType === "CUSTOMER_RETURN"
            ? "Customer Return"
            : "Vendor Return",
        label: r.returnNumber,
        status: r.status,
        at: r.requestedDate,
      }))}
    />
  );
}
