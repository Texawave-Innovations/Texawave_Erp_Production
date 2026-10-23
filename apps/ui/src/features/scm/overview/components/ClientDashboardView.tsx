"use client";

import {
  Button,
  Card,
  DataTable,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import {
  Boxes,
  FileText,
  List,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useOverviewKpis } from "../../inventory/hooks";
import { usePurchaseOrders } from "../../procurement/hooks";
import {
  formatMoney,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import {
  buildDemoFlowNodes,
  buildFlowKpis,
  SupplyChainFlow,
} from "../flow/SupplyChainFlow";
import { useScmOverview } from "../hooks";

type FlowView = "flow" | "list";

/** Legacy `ScmClientDashboard`: the client-demo variant of the Overview page
 * (see `demo-mode.ts`) — a shorter Suppliers → Procurement → Goods Receipt →
 * Inventory flow, plus Open Purchase Orders and Pending Goods Receipts
 * previews. Unlike the legacy Firebase demo, this reads the same real,
 * audited SCM data as the full overview — it only presents a simpler slice
 * of it, with no destructive demo-data reset tools. */
export function ClientDashboardView() {
  const router = useRouter();
  const query = useScmOverview();
  const [view, setView] = useState<FlowView>("flow");
  const openPos = usePurchaseOrders({ limit: 50 });
  const pendingReceipts = usePurchaseOrders({ limit: 8, receivable: "true" });
  const kpis = useOverviewKpis({});

  const nodes = useMemo(
    () => (query.data ? buildDemoFlowNodes(query.data.metrics) : []),
    [query.data],
  );
  const flowKpis = useMemo(
    () => (query.data ? buildFlowKpis(query.data.metrics) : []),
    [query.data],
  );

  const openPoRows = (openPos.data?.data ?? []).filter(
    (po) =>
      po.status !== "CANCELLED" &&
      po.status !== "CLOSED" &&
      po.status !== "RECEIVED",
  );

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
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Supply Chain Overview"
        description="Monitor your supply chain operations"
      />

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
                Suppliers → Procurement → Goods Receipt → Inventory
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
            kpis={flowKpis}
            loadedAt={query.dataUpdatedAt}
          />
        ) : (
          list
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          headingId="d-open-po"
          label="Open Purchase Orders"
          value={openPoRows.length}
          note="Not closed, cancelled or fully received"
          icon={ShoppingCart}
        />
        <StatCard
          headingId="d-pending-gr"
          label="Pending Goods Receipts"
          value={pendingReceipts.data?.meta.total ?? 0}
          note="Sent or partially received POs"
          icon={PackageCheck}
        />
        <StatCard
          headingId="d-items"
          label="Items in Stock"
          value={kpis.data ? kpis.data.totalSkus : "…"}
          note="Distinct SKUs"
          icon={Boxes}
        />
        <StatCard
          headingId="d-bad"
          label="Rejected / Bad Stock (units)"
          value={kpis.data ? formatQty(kpis.data.bad) : "…"}
          note="Rejected, damaged or QC-rejected"
          icon={PackageX}
          tone={kpis.data && kpis.data.bad > 0 ? "error" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white/90">
            Open Purchase Orders
          </h3>
          <DataTable
            caption="Open purchase orders"
            rows={openPoRows.slice(0, 8)}
            getRowKey={(po) => String(po.id)}
            loading={openPos.isPending}
            emptyState={
              <div className="py-6 text-center text-gray-500">
                No open purchase orders.
              </div>
            }
            onRowClick={() => router.push("/scm/procurement/purchase-orders")}
            columns={[
              {
                header: "PO",
                cell: (po) => (
                  <span className="font-mono text-theme-xs">{po.poNumber}</span>
                ),
              },
              { header: "Supplier", cell: (po) => po.vendorNameSnapshot },
              {
                header: "Status",
                cell: (po) => (
                  <StatusBadge
                    label={formatStatusLabel(po.status)}
                    colorToken={scmStatusToken(po.status)}
                  />
                ),
              },
              {
                header: "Total",
                align: "right",
                cell: (po) => formatMoney(po.total, po.currency, 0),
              },
            ]}
          />
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white/90">
            Pending Goods Receipts
          </h3>
          <DataTable
            caption="Pending goods receipts"
            rows={pendingReceipts.data?.data ?? []}
            getRowKey={(po) => String(po.id)}
            loading={pendingReceipts.isPending}
            emptyState={
              <div className="py-6 text-center text-gray-500">
                Nothing waiting to be received.
              </div>
            }
            onRowClick={() => router.push("/scm/procurement/goods-receipts")}
            columns={[
              {
                header: "PO",
                cell: (po) => (
                  <span className="font-mono text-theme-xs">{po.poNumber}</span>
                ),
              },
              { header: "Supplier", cell: (po) => po.vendorNameSnapshot },
              {
                header: "Expected",
                cell: (po) => po.expectedDeliveryDate ?? "—",
              },
            ]}
          />
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white/90">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {[
            {
              id: "pr",
              label: "Material Requisition",
              icon: FileText,
              path: "/scm/procurement/requisitions",
            },
            {
              id: "po",
              label: "Purchase Order",
              icon: ShoppingCart,
              path: "/scm/procurement/purchase-orders",
            },
            {
              id: "grn",
              label: "Receive Goods",
              icon: PackageCheck,
              path: "/scm/procurement/goods-receipts",
            },
          ].map((action) => (
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
    </div>
  );
}
