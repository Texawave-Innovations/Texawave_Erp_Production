import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Factory as FactoryIcon,
  FileText,
  Warehouse as WarehouseIcon,
  Package,
  ShoppingCart,
  Truck as TruckIcon,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScmFlowNode } from "./scmFlowNodes";
import type { ScmKpi } from "./useScmOverviewData";
import { StageIllustration } from "./scmStageIcons";

const STAGE_ICONS: Record<string, typeof FactoryIcon> = {
  suppliers: FactoryIcon,
  procurement: FileText,
  "inventory-warehouse": WarehouseIcon,
  orders: ShoppingCart,
  quality: ShieldCheck,
  reports: BarChart3,
};

const KPI_ICONS: Record<string, typeof Package> = {
  "inventory-value": Package,
  "low-stock": FactoryIcon,
  "pending-po": FileText,
  "pending-grn": TruckIcon,
  "open-so": ShoppingCart,
  "pending-shipments": TruckIcon,
};

/** A rounded arrow connecting two consecutive stage platforms. The arrow shape itself is a static
 * SVG (only its color brightens on hover); a small dot continuously travels along it to read as a
 * live flow between stages — the one deliberately-moving element in an otherwise static scene. */
function FlowArrow({ active }: { active: boolean }) {
  const color = active ? "#16A34A" : "#22C55E";
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

/** One stage: illustration on a soft platform, label, and its metric card underneath. Hover smoothly
 * scales the illustration and brightens the platform glow (pure CSS transition); click uses the
 * app's existing navigation for that stage. Nothing here animates on its own. */
function StageColumn({
  node,
  hovered,
  onHover,
  onLeave,
  onNavigate,
}: {
  node: ScmFlowNode;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onNavigate: () => void;
}) {
  const Icon = STAGE_ICONS[node.id];

  return (
    <button
      type="button"
      onClick={onNavigate}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      className="group flex min-w-0 flex-1 flex-col items-center text-center"
    >
      <div className="relative flex h-[96px] w-full items-end justify-center sm:h-[112px]">
        <div
          className={cn(
            "absolute bottom-1 h-8 w-[86%] rounded-[50%] bg-gradient-to-b from-emerald-200/70 to-sky-200/50 ring-1 ring-white/70 transition-all duration-300",
            hovered
              ? "opacity-100 scale-110 shadow-[0_0_22px_6px_rgba(110,231,183,0.45)]"
              : "opacity-80",
          )}
        />
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-300 ease-out",
            hovered ? "scale-[1.14] -translate-y-1" : "scale-100",
          )}
        >
          <StageIllustration stageId={node.id} />
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-base font-bold transition-colors",
          hovered ? "text-emerald-600" : "text-slate-800",
        )}
      >
        {node.label}
      </p>
      <div
        className={cn(
          "mt-2 flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border bg-white/80 px-2.5 py-3 text-center shadow-sm backdrop-blur transition-all sm:px-3",
          hovered
            ? "border-emerald-300 shadow-md ring-2 ring-emerald-100"
            : "border-slate-300",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            hovered ? "text-emerald-600" : "text-slate-500",
          )}
        />
        <p className="text-xl font-bold leading-none text-slate-900">
          {node.value}
        </p>
        <p className="text-xs font-medium leading-tight text-slate-500">
          {node.caption}
        </p>
      </div>
    </button>
  );
}

/** "Updated 10:42" — the overview is a fetched snapshot, not a live feed. */
function formatLoadedAt(loadedAt: number): string {
  return loadedAt
    ? new Date(loadedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

const KPI_TILE_COUNT = 4;

export default function ScmSupplyChainFlow({
  nodes,
  kpis,
  loading,
  loadedAt,
}: {
  nodes: ScmFlowNode[];
  kpis: ScmKpi[];
  loading: boolean;
  loadedAt: number;
}) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white via-slate-50/60 to-emerald-50/20">
      <div className="relative px-3 pt-14 sm:px-6 sm:pt-16">
        <div className="absolute right-3 top-4 z-10 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white/90 px-3 py-2 shadow-sm backdrop-blur sm:right-5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <div>
            <p className="text-xs font-bold leading-none text-emerald-700">
              Snapshot
            </p>
            <p className="mt-1 text-[10px] leading-none text-slate-500">
              Updated {loading ? "…" : formatLoadedAt(loadedAt)}
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
                  onNavigate={() => navigate(node.path)}
                />
                {i < nodes.length - 1 && (
                  <div className="flex h-[96px] items-center sm:h-[112px]">
                    <FlowArrow
                      active={
                        hoveredId === node.id || hoveredId === nodes[i + 1].id
                      }
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-3 mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.slice(0, KPI_TILE_COUNT).map((kpi) => {
          const Icon = KPI_ICONS[kpi.id] ?? Package;
          return (
            <div
              key={kpi.id}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white/85 px-3 py-3 shadow-sm backdrop-blur"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none text-slate-900">
                  {loading ? "…" : kpi.value}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {kpi.label}
                </p>
                <p className="truncate text-[10px] text-slate-400">
                  {kpi.hint}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
