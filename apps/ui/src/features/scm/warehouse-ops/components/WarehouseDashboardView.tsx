"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useWarehouseDashboard } from "../hooks";

import {
  ArrowLeftRight,
  Boxes,
  FileText,
  type LucideIcon,
  MapPin,
  PackageCheck,
  PackagePlus,
  Plus,
  Warehouse,
} from "lucide-react";
import {
  ScmDashboardPage,
  type DashboardAction,
} from "../../shared/ScmDashboardPage";
const KPI_ICONS: Record<string, LucideIcon> = {
  "pending-putaway": PackagePlus,
  "completed-putaway": PackageCheck,
  "open-movements": ArrowLeftRight,
  "completed-movements": ArrowLeftRight,
  "active-warehouses": Warehouse,
  "active-locations": MapPin,
  occupied: Boxes,
};

const ACTIONS: DashboardAction[] = [
  { label: "New Put-away", icon: Plus, href: "/scm/warehouse/putaway" },
  {
    label: "New Internal Movement",
    icon: Plus,
    href: "/scm/warehouse/movements",
  },
  { label: "Warehouses", icon: Warehouse, href: "/scm/warehouses" },
  { label: "Locations", icon: MapPin, href: "/scm/locations" },
];

const sum = (m: Record<string, number>, keys: string[]) =>
  keys.reduce((s, k) => s + (m[k] ?? 0), 0);

/** Legacy `ScmWarehouseDashboard`: WMS capacity and operations KPIs. */
export function WarehouseDashboardView() {
  const query = useWarehouseDashboard();

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to warehouse operations"
        >
          Ask an administrator for the <code>scm.warehouse.read</code>{" "}
          permission.
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
      id: "pending-putaway",
      label: "Pending Put-away",
      value: sum(d.putawayByStatus, ["PENDING", "IN_PROGRESS"]),
      note: "Received stock not yet binned",
      href: "/scm/warehouse/putaway",
      tone: "warning",
    },
    {
      id: "completed-putaway",
      label: "Completed Put-away",
      value: sum(d.putawayByStatus, ["COMPLETED"]),
      note: "Fully binned",
      href: "/scm/warehouse/putaway",
      tone: "success",
    },
    {
      id: "open-movements",
      label: "Open Movements",
      value: sum(d.movementByStatus, [
        "DRAFT",
        "REQUESTED",
        "APPROVED",
        "IN_PROGRESS",
      ]),
      note: "Bin-to-bin transfers in flight",
      href: "/scm/warehouse/movements",
      tone: "blue",
    },
    {
      id: "completed-movements",
      label: "Completed Movements",
      value: sum(d.movementByStatus, ["COMPLETED"]),
      note: "Relocated stock",
      href: "/scm/warehouse/movements",
      tone: "success",
    },
    {
      id: "active-warehouses",
      label: "Active Warehouses",
      value: d.activeWarehouses,
      note: "In operation",
      href: "/scm/warehouses",
      tone: "brand",
    },
    {
      id: "active-locations",
      label: "Active Locations",
      value: d.activeLocations,
      note: "Zones, racks, shelves and bins",
      href: "/scm/locations",
      tone: "brand",
    },
    {
      id: "occupied",
      label: "Occupied Bins",
      value: d.occupiedLocations,
      note: "Holding stock right now",
      href: "/scm/warehouse/location-stock",
      tone: "info",
    },
  ];

  return (
    <ScmDashboardPage
      title="Warehouse Dashboard"
      subtitle="Put received stock away into bins, move it between bins, and see what sits where."
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
