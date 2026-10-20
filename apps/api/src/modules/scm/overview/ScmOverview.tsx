import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Factory,
  FileStack,
  FileText,
  List,
  PackageCheck,
  Send,
  ShoppingCart,
  Warehouse,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useScmOverviewData } from "./useScmOverviewData";
import { buildScmFlowNodes } from "./scmFlowNodes";
import ScmSupplyChainList from "./ScmSupplyChainList";
import { ScmFlowErrorBoundary } from "./ScmFlowErrorBoundary";

const ScmSupplyChainFlow = lazy(() => import("./ScmSupplyChainFlow"));
// Lazy so it never delays the flow's first paint; it reads the same cached SCM dataset.
const AdvancedScmSummary = lazy(() => import("../advanced/AdvancedScmSummary"));

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "pr",
    label: "Create Purchase Requisition",
    icon: FileText,
    path: "/scm/procurement/requisitions",
  },
  { id: "rfq", label: "Create RFQ", icon: Send, path: "/scm/procurement/rfqs" },
  {
    id: "po",
    label: "Create Purchase Order",
    icon: ShoppingCart,
    path: "/scm/procurement/purchase-orders",
  },
  {
    id: "grn",
    label: "Receive Goods / Create GRN",
    icon: PackageCheck,
    path: "/scm/procurement/grn",
  },
  {
    id: "stock",
    label: "View Stock & Warehouse",
    icon: Warehouse,
    path: "/scm/inventory/overview",
  },
  {
    id: "transfer",
    label: "Create Stock Transfer",
    icon: ArrowLeftRight,
    path: "/scm/inventory/transfers",
  },
  {
    id: "so",
    label: "Create Sales Order",
    icon: FileStack,
    path: "/scm/orders/sales-orders",
  },
  {
    id: "supplier",
    label: "Create Supplier",
    icon: Factory,
    path: "/scm/suppliers",
  },
];

type FlowView = "flow" | "list";

export default function ScmOverview() {
  const navigate = useNavigate();
  const data = useScmOverviewData();
  const [view, setView] = useState<FlowView>("flow");
  const flowNodes = buildScmFlowNodes({
    supplierCount: data.supplierCount,
    openRequisitionCount: data.openRequisitionCount,
    inventoryUnitsAvailable: data.inventoryUnitsAvailable,
    openSalesOrderCount: data.openSalesOrderCount,
    openInspectionCount: data.openInspectionCount,
    loading: data.loading,
  });
  const listView = <ScmSupplyChainList nodes={flowNodes} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          Supply Chain Overview
        </h2>
        <p className="text-muted-foreground">
          Monitor your supply chain operations
        </p>
      </div>

      {data.error && (
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Couldn't load
              supply chain data: {data.error}
            </span>
            <Button size="sm" variant="outline" onClick={data.reload}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-slate-200/90 shadow-sm">
        <CardContent className="p-3 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Supply Chain Flow
                </h3>
                <p className="text-sm text-muted-foreground">
                  Suppliers → Procurement → Inventory → Orders → Quality →
                  Reports
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shrink-0">
              <Button
                size="sm"
                variant={view === "flow" ? "default" : "ghost"}
                className="rounded-lg gap-1.5"
                onClick={() => setView("flow")}
              >
                <Workflow className="h-3.5 w-3.5" /> Flow View
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                className="rounded-lg gap-1.5"
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" /> List View
              </Button>
            </div>
          </div>
          {view === "flow" ? (
            <ScmFlowErrorBoundary fallback={listView}>
              <Suspense
                fallback={
                  <div className="h-[500px] rounded-2xl bg-slate-50 animate-pulse" />
                }
              >
                <ScmSupplyChainFlow
                  nodes={flowNodes}
                  kpis={data.kpis}
                  loading={data.loading}
                  loadedAt={data.loadedAt}
                />
              </Suspense>
            </ScmFlowErrorBoundary>
          ) : (
            listView
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 rounded-xl whitespace-normal text-center"
                onClick={() => navigate(action.path)}
              >
                <action.icon className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-medium leading-tight">
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <div className="h-40 rounded-2xl bg-slate-50 animate-pulse" />
        }
      >
        <AdvancedScmSummary />
      </Suspense>
    </div>
  );
}
