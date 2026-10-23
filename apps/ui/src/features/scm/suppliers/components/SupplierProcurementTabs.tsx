"use client";

import {
  ErrorState,
  Card,
  DataTable,
  EmptyState,
  Skeleton,
  StatCard,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import {
  formatDate,
  formatMoney,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useSupplierProcurement } from "../hooks";

export type ProcurementTabId =
  "products" | "rfqs" | "quotations" | "pos" | "grns" | "performance";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Supplier detail tabs backed by procurement data (legacy `Products`,
 * `RFQs`, `Supplier Quotations`, `Purchase Orders`, `GRNs`, `Performance`). */
export function SupplierProcurementTab({
  supplierId,
  tab,
  currency,
}: {
  supplierId: number;
  tab: ProcurementTabId;
  currency: string;
}) {
  const query = useSupplierProcurement(supplierId);

  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const d = query.data;

  const empty = (title: string, description: string) => (
    <Card>
      <EmptyState title={title} description={description} />
    </Card>
  );

  switch (tab) {
    case "products":
      return d.productsSupplied.length === 0 ? (
        empty(
          "No products sourced yet",
          "Products supplied by this vendor are derived from its purchase order history and appear once a PO is placed.",
        )
      ) : (
        <DataTable
          caption="Products supplied"
          rows={d.productsSupplied}
          getRowKey={(p) => String(p.productId)}
          columns={[
            {
              header: "Product / Item",
              cell: (p) => <strong>{p.name}</strong>,
            },
            {
              header: "Last Purchase Price",
              align: "right",
              cell: (p) => formatMoney(p.lastRate, currency, 0),
            },
            {
              header: "Last Purchase Date",
              cell: (p) => formatDate(p.lastDate),
            },
            { header: "Total Qty", align: "right", cell: (p) => p.totalQty },
            { header: "# POs", align: "right", cell: (p) => p.pos },
          ]}
        />
      );
    case "rfqs":
      return d.rfqs.length === 0 ? (
        empty("No RFQs yet", "RFQs sent to this supplier appear here.")
      ) : (
        <DataTable
          caption="RFQs"
          rows={d.rfqs}
          getRowKey={(r) => String(r.id)}
          columns={[
            {
              header: "RFQ #",
              cell: (r) => (
                <Link
                  href="/scm/procurement/rfqs"
                  className="font-mono text-theme-xs text-brand-700 hover:underline dark:text-brand-300"
                >
                  {r.rfqNumber}
                </Link>
              ),
            },
            { header: "Issued", cell: (r) => formatDate(r.issueDate) },
            {
              header: "Status",
              cell: (r) => (
                <StatusBadge
                  label={formatStatusLabel(r.status)}
                  colorToken={scmStatusToken(r.status)}
                />
              ),
            },
          ]}
        />
      );
    case "quotations":
      return d.quotations.length === 0 ? (
        empty(
          "No supplier quotations yet",
          "Quotations received from this vendor appear here.",
        )
      ) : (
        <DataTable
          caption="Supplier quotations"
          rows={d.quotations}
          getRowKey={(q) => String(q.id)}
          columns={[
            {
              header: "Quotation #",
              cell: (q) => (
                <span className="font-mono text-theme-xs">
                  {q.quotationNumber}
                </span>
              ),
            },
            { header: "RFQ", cell: (q) => q.rfq.rfqNumber },
            { header: "Date", cell: (q) => formatDate(q.quotationDate) },
            {
              header: "Total",
              align: "right",
              cell: (q) => formatMoney(q.total, q.currency),
            },
            {
              header: "Status",
              cell: (q) => (
                <StatusBadge
                  label={formatStatusLabel(q.status)}
                  colorToken={scmStatusToken(q.status)}
                />
              ),
            },
          ]}
        />
      );
    case "pos":
      return d.purchaseOrders.length === 0 ? (
        empty(
          "No purchase orders yet",
          "Purchase orders raised against this supplier appear here.",
        )
      ) : (
        <DataTable
          caption="Purchase orders"
          rows={d.purchaseOrders}
          getRowKey={(p) => String(p.id)}
          columns={[
            {
              header: "PO #",
              cell: (p) => (
                <Link
                  href="/scm/procurement/purchase-orders"
                  className="font-mono text-theme-xs text-brand-700 hover:underline dark:text-brand-300"
                >
                  {p.poNumber}
                </Link>
              ),
            },
            { header: "Date", cell: (p) => formatDate(p.poDate) },
            {
              header: "Total",
              align: "right",
              cell: (p) => formatMoney(p.total, p.currency),
            },
            {
              header: "Status",
              cell: (p) => (
                <StatusBadge
                  label={formatStatusLabel(p.status)}
                  colorToken={scmStatusToken(p.status)}
                />
              ),
            },
          ]}
        />
      );
    case "grns":
      return d.receipts.length === 0 ? (
        empty(
          "No goods receipts yet",
          "Goods received from this supplier appear here.",
        )
      ) : (
        <DataTable
          caption="Goods receipts"
          rows={d.receipts}
          getRowKey={(g) => String(g.id)}
          columns={[
            {
              header: "GRN #",
              cell: (g) => (
                <Link
                  href="/scm/procurement/goods-receipts"
                  className="font-mono text-theme-xs text-brand-700 hover:underline dark:text-brand-300"
                >
                  {g.grnNumber}
                </Link>
              ),
            },
            { header: "PO", cell: (g) => g.poNumber },
            { header: "Receipt Date", cell: (g) => formatDate(g.receiptDate) },
            {
              header: "Status",
              cell: (g) => (
                <StatusBadge
                  label={formatStatusLabel(g.status)}
                  colorToken={scmStatusToken(g.status)}
                />
              ),
            },
          ]}
        />
      );
    case "performance": {
      if (d.kpis.purchaseOrders === 0) {
        return empty(
          "No performance data yet",
          "Supplier performance is calculated after procurement activity is available.",
        );
      }
      const k = d.kpis;
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              headingId="sp-pos"
              label="Purchase Orders"
              value={k.purchaseOrders}
              note="Excluding cancelled"
            />
            <StatCard
              headingId="sp-value"
              label="Total Purchase Value"
              value={formatMoney(k.totalPoValue, currency, 0)}
              note="All live POs"
              tone="brand"
            />
            <StatCard
              headingId="sp-open"
              label="Open POs"
              value={k.openPurchaseOrders}
              note="Goods pending"
              tone="warning"
            />
            <StatCard
              headingId="sp-grn"
              label="Receipts"
              value={k.receipts}
              note="Goods receipts"
              tone="success"
            />
            <StatCard
              headingId="sp-rej"
              label="Rejection Rate"
              value={pct(k.rejectionRate)}
              note={`${k.rejectedQuantity} rejected of ${k.acceptedQuantity + k.rejectedQuantity}`}
              tone={k.rejectionRate > 0.05 ? "error" : "success"}
            />
          </div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Descriptive figures only — no scoring. On-time delivery and return
            rate are added when Returns and Quality are migrated.
          </p>
        </div>
      );
    }
  }
}
