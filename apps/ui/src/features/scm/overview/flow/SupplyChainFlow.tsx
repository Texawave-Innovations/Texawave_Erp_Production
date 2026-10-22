"use client";

import type { ScmFlowMetrics } from "@texawave-erp/api-types";
import {
  BarChart3,
  ClipboardList,
  Factory,
  FileText,
  Package,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "../../shared/format";
import { StageIllustration } from "./StageIllustrations";

export interface FlowNode {
  id: string;
  label: string;
  path: string;
  /** Headline figure under the illustration. */
  value: string;
  caption: string;
  /** Sentence used by the list view. */
  metric: string;
}

export interface FlowKpi {
  id: string;
  label: string;
  value: string;
  hint: string;
}

const STAGE_ICONS: Record<string, LucideIcon> = {
  suppliers: Factory,
  procurement: FileText,
  "inventory-warehouse": Warehouse,
  orders: ShoppingCart,
  quality: ShieldCheck,
  reports: BarChart3,
};

const KPI_ICONS: Record<string, LucideIcon> = {
  "inventory-value": Package,
  "low-stock": Factory,
  "pending-po": ClipboardList,
  "pending-grn": Truck,
};

const units = (n: number) => Math.round(n).toLocaleString("en-IN");

/** The six-stage flow — Suppliers → Procurement → Inventory → Orders →
 * Quality → Reports — driven by real counts from the overview API. */
export function buildFlowNodes(m: ScmFlowMetrics): FlowNode[] {
  return [
    {
      id: "suppliers",
      label: "Suppliers",
      path: "/scm/suppliers",
      value: String(m.activeSuppliers),
      caption: "Active Suppliers",
      metric: `${m.activeSuppliers} active suppliers`,
    },
    {
      id: "procurement",
      label: "Procurement",
      path: "/scm/procurement/purchase-orders",
      value: String(m.openRequisitions),
      caption: "Open Requisitions",
      metric: `${m.openRequisitions} open purchase requisitions`,
    },
    {
      id: "inventory-warehouse",
      label: "Inventory",
      path: "/scm/inventory/overview",
      value: units(m.unitsAvailable),
      caption: "Units Available",
      metric: `${units(m.unitsAvailable)} units available across all warehouses`,
    },
    {
      id: "orders",
      label: "Orders",
      path: "/scm/orders/sales-orders",
      value: String(m.openSalesOrders),
      caption: "Open Orders",
      metric: `${m.openSalesOrders} open orders`,
    },
    {
      id: "quality",
      label: "Quality",
      path: "/scm/quality",
      value: String(m.openInspections),
      caption: "Open Inspections",
      metric: `${m.openInspections} inspections pending or in progress`,
    },
    {
      id: "reports",
      label: "Reports",
      path: "/scm/reports",
      value: "—",
      caption: "Executive Summary",
      metric: "Open the Reports dashboard for full SCM analytics",
    },
  ];
}

export function buildFlowKpis(m: ScmFlowMetrics): FlowKpi[] {
  return [
    {
      id: "inventory-value",
      label: "Total Inventory Value",
      value: formatMoney(m.inventoryValue, "INR", 0),
      hint: `At cost · ${m.costedRows} of ${m.stockRows} stock rows costed`,
    },
    {
      id: "low-stock",
      label: "Low Stock Items",
      value: String(m.lowStockItems),
      hint: "At or below reorder level",
    },
    {
      id: "pending-po",
      label: "Open Purchase Orders",
      value: String(m.openPurchaseOrders),
      hint: "Approved or sent, not fully received",
    },
    {
      id: "pending-grn",
      label: "POs Awaiting Receipt",
      value: String(m.posAwaitingReceipt),
      hint: "Sent POs with goods still to receive",
    },
  ];
}

/** A rounded arrow between two stage platforms. The arrow is static (it only
 * brightens on hover); a small dot travels along it continuously. */
function FlowArrow({ active }: { active: boolean }) {
  const color = active ? "#1d4ed8" : "#3b82f6";
  return (
    <div className="relative h-4 w-6 shrink-0 sm:w-8">
      <svg viewBox="0 0 64 24" className="h-full w-full" aria-hidden>
        <circle
          cx="6"
          cy="12"
          r="2.2"
          fill={color}
          opacity={active ? 0.9 : 0.55}
        />
        <circle
          cx="14"
          cy="12"
          r="2.2"
          fill={color}
          opacity={active ? 0.9 : 0.55}
        />
        <rect x="20" y="8" width="26" height="8" rx="4" fill={color} />
        <polygon points="42,2 62,12 42,22" fill={color} />
      </svg>
      <span
        className="scm-flow-dot absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white"
        style={{ boxShadow: `0 0 4px 1.5px ${color}` }}
        aria-hidden
      />
    </div>
  );
}

function StageColumn({
  node,
  hovered,
  onHover,
  onLeave,
}: {
  node: FlowNode;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const Icon = STAGE_ICONS[node.id] ?? Package;
  return (
    <Link
      href={node.path}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      className="group flex min-w-0 flex-1 flex-col items-center text-center outline-none"
    >
      <div className="relative flex h-[96px] w-full items-end justify-center sm:h-[112px]">
        <div
          className={cn(
            "absolute bottom-1 h-8 w-[86%] rounded-[50%] bg-gradient-to-b from-brand-200/70 to-sky-200/50 ring-1 ring-white/70 transition-all duration-300",
            hovered
              ? "scale-110 opacity-100 shadow-[0_0_22px_6px_rgba(96,165,250,0.45)]"
              : "opacity-80",
          )}
        />
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-300 ease-out",
            hovered ? "-translate-y-1 scale-[1.14]" : "scale-100",
          )}
        >
          <StageIllustration stageId={node.id} />
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-base font-bold transition-colors",
          hovered ? "text-brand-600" : "text-gray-800 dark:text-white/90",
        )}
      >
        {node.label}
      </p>
      <div
        className={cn(
          "mt-2 flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border bg-white/80 px-2.5 py-3 text-center shadow-sm backdrop-blur transition-all sm:px-3 dark:bg-gray-800/70",
          hovered
            ? "border-brand-300 shadow-md ring-2 ring-brand-100"
            : "border-gray-300 dark:border-gray-700",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            hovered ? "text-brand-600" : "text-gray-500",
          )}
          aria-hidden="true"
        />
        <p className="text-xl font-bold leading-none text-gray-900 dark:text-white/90">
          {node.value}
        </p>
        <p className="text-xs font-medium leading-tight text-gray-500 dark:text-gray-400">
          {node.caption}
        </p>
      </div>
    </Link>
  );
}

export function SupplyChainFlow({
  nodes,
  kpis,
  loadedAt,
}: {
  nodes: FlowNode[];
  kpis: FlowKpi[];
  /** When the figures were fetched (ms) — the overview is a snapshot. */
  loadedAt: number;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const updated = loadedAt
    ? new Date(loadedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white via-gray-50/60 to-brand-50/30 dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="relative px-3 pt-14 sm:px-6 sm:pt-16">
        <div className="absolute right-3 top-4 z-10 flex items-center gap-2 rounded-2xl border border-brand-100 bg-white/90 px-3 py-2 shadow-sm backdrop-blur sm:right-5 dark:border-gray-700 dark:bg-gray-800/90">
          <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
          <div>
            <p className="text-xs font-bold leading-none text-brand-700 dark:text-brand-300">
              Snapshot
            </p>
            <p className="mt-1 text-[10px] leading-none text-gray-500">
              Updated {updated}
            </p>
          </div>
        </div>
        <div className="flex w-full items-start overflow-x-auto pb-6">
          <div className="flex w-full min-w-[700px] items-start">
            {nodes.map((node, i) => (
              <Fragment key={node.id}>
                <StageColumn
                  node={node}
                  hovered={hoveredId === node.id}
                  onHover={() => setHoveredId(node.id)}
                  onLeave={() => setHoveredId(null)}
                />
                {i < nodes.length - 1 ? (
                  <div className="flex h-[96px] items-center sm:h-[112px]">
                    <FlowArrow
                      active={
                        hoveredId === node.id || hoveredId === nodes[i + 1]?.id
                      }
                    />
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-3 mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = KPI_ICONS[kpi.id] ?? Package;
          return (
            <div
              key={kpi.id}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-white/85 px-3 py-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-800/70"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none text-gray-900 dark:text-white/90">
                  {kpi.value}
                </p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {kpi.label}
                </p>
                <p className="truncate text-[10px] text-gray-400">{kpi.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
