"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Skeleton,
} from "@texawave-erp/ui-kit";
import {
  ArrowLeftRight,
  Boxes,
  ChevronRight,
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
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildFlowKpis,
  buildFlowNodes,
  SupplyChainFlow,
} from "../flow/SupplyChainFlow";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import { useScmOverview } from "../hooks";
import { AdvancedScmSummary } from "./AdvancedScmSummary";
import { ClientDashboardView } from "./ClientDashboardView";

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "pr",
    label: "Create Material Requisition",
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
    path: "/scm/procurement/goods-receipts",
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

/** Legacy `ScmOverview`: the Supply Chain Flow (illustrated stages joined by
 * animated arrows, with live KPI tiles), a list view of the same stages, and
 * one-click quick actions. */
export function OverviewView() {
  return SCM_CLIENT_DEMO ? <ClientDashboardView /> : <ScmFullOverviewView />;
}

function ScmFullOverviewView() {
  const query = useScmOverview();
  const [view, setView] = useState<FlowView>("flow");

  const nodes = useMemo(
    () => (query.data ? buildFlowNodes(query.data.metrics) : []),
    [query.data],
  );
  const kpis = useMemo(
    () => (query.data ? buildFlowKpis(query.data.metrics) : []),
    [query.data],
  );

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to the SCM overview"
        >
          Ask an administrator for the <code>scm.overview.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const list = (
    <div className="flex flex-col gap-2">
      {nodes.map((node) => (
        <Link
          key={node.id}
          href={node.path}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-dark"
        >
          <div>
            <p className="font-semibold text-gray-900 dark:text-white/90">
              {node.label}
            </p>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {node.metric}
            </p>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">
          Supply Chain Overview
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Monitor your supply chain operations
        </p>
      </div>

      <Card className="flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
              <Boxes className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
                Supply Chain Flow
              </h3>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Suppliers → Procurement → Inventory → Orders → Quality → Reports
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
            <Button
              size="sm"
              variant={view === "flow" ? "primary" : "ghost"}
              className="gap-1.5"
              aria-pressed={view === "flow"}
              onClick={() => setView("flow")}
            >
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" /> Flow View
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "primary" : "ghost"}
              className="gap-1.5"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" /> List View
            </Button>
          </div>
        </div>
        {view === "flow" ? (
          <SupplyChainFlow
            nodes={nodes}
            kpis={kpis}
            loadedAt={query.dataUpdatedAt}
          />
        ) : (
          list
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white/90">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.id}
              href={action.path}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <action.icon
                className="h-4 w-4 text-brand-600"
                aria-hidden="true"
              />
              <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-200">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <AdvancedScmSummary />
    </div>
  );
}
