"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
  StatusBadge,
  Tabs,
} from "@texawave-erp/ui-kit";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useInventoryProductDetail } from "../hooks";

const TABS = [
  { id: "stock", label: "Stock by Warehouse" },
  { id: "ledger", label: "Recent Ledger" },
  { id: "batches", label: "Batches" },
  { id: "serials", label: "Serials" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Legacy `ScmInventoryDetail`: one product's stock across warehouses, its
 * recent ledger movements, batches and serial counts. */
export function InventoryProductDetail({ productId }: { productId: number }) {
  const [tab, setTab] = useState<TabId>("stock");
  const query = useInventoryProductDetail(productId);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to inventory">
          Ask an administrator for the <code>scm.inventory.read</code>{" "}
          permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.statusCode === 404) {
      return (
        <Card>
          <EmptyState
            title="Product not found"
            description="It may have been removed or belongs to another organization."
            action={
              <Link href="/scm/inventory/overview">
                <Button variant="secondary" size="sm">
                  Back to stock overview
                </Button>
              </Link>
            }
          />
        </Card>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const { product, rows, ledger, batches, serialCounts } = query.data;
  const total = rows.reduce(
    (acc, r) => ({
      onHand: acc.onHand + r.onHand,
      reserved: acc.reserved + r.reserved,
      available: acc.available + r.available,
      incoming: acc.incoming + r.incoming,
      value: acc.value + r.value,
    }),
    { onHand: 0, reserved: 0, available: 0, incoming: 0, value: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div>
          <Link
            href="/scm/inventory/overview"
            aria-label="Back to stock overview"
            className="group inline-flex items-center gap-3 rounded-xl py-1 pr-3 outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-300 dark:hover:bg-gray-800"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <h1 className="text-title-sm sm:text-title-md font-bold tracking-tight text-gray-900 dark:text-white/90">
              {product.name}
            </h1>
          </Link>
          <p className="font-mono text-theme-sm text-gray-500 dark:text-gray-400">
            {product.productCode} · {product.uom}
            {product.category ? ` · ${product.category}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          headingId="d-onhand"
          label="On Hand"
          value={formatQty(total.onHand)}
          note="All warehouses"
        />
        <StatCard
          headingId="d-reserved"
          label="Reserved"
          value={formatQty(total.reserved)}
          note="Held for orders"
          tone="blue"
        />
        <StatCard
          headingId="d-available"
          label="Available"
          value={formatQty(total.available)}
          note="On hand − reserved"
          tone="success"
        />
        <StatCard
          headingId="d-incoming"
          label="Incoming"
          value={formatQty(total.incoming)}
          note="On open POs"
          tone="info"
        />
        <StatCard
          headingId="d-value"
          label="Value"
          value={formatMoney(total.value, "INR", 0)}
          note="At cost"
          tone="brand"
        />
      </div>

      <Tabs
        label="Product inventory sections"
        idPrefix="inv-detail"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "stock" ? (
          <DataTable
            caption="Stock by warehouse"
            rows={rows}
            getRowKey={(r) => r.id}
            columns={[
              { header: "Warehouse", cell: (r) => r.warehouseName },
              {
                header: "On Hand",
                align: "right",
                cell: (r) => formatQty(r.onHand),
              },
              {
                header: "Reserved",
                align: "right",
                cell: (r) => formatQty(r.reserved),
              },
              {
                header: "Available",
                align: "right",
                cell: (r) => formatQty(r.available),
              },
              {
                header: "Incoming",
                align: "right",
                cell: (r) => formatQty(r.incoming),
              },
              {
                header: "Damaged",
                align: "right",
                cell: (r) => formatQty(r.damaged),
              },
              {
                header: "Quarantine",
                align: "right",
                cell: (r) => formatQty(r.quarantine),
              },
              {
                header: "Status",
                cell: (r) => (
                  <StatusBadge
                    label={r.stockStatus}
                    colorToken={scmStatusToken(r.stockStatus)}
                  />
                ),
              },
            ]}
          />
        ) : null}

        {tab === "ledger" ? (
          ledger.length === 0 ? (
            <Card>
              <EmptyState
                title="No movements yet"
                description="Ledger entries for this product appear here."
              />
            </Card>
          ) : (
            <DataTable
              caption="Recent ledger entries"
              rows={ledger}
              getRowKey={(e) => String(e.id)}
              columns={[
                {
                  header: "Date",
                  cell: (e) => formatDateTime(e.transactionDate),
                },
                { header: "Warehouse", cell: (e) => e.warehouseName ?? "—" },
                {
                  header: "Type",
                  cell: (e) => formatStatusLabel(e.transactionType),
                },
                { header: "Reference", cell: (e) => e.referenceNumber ?? "—" },
                {
                  header: "In",
                  align: "right",
                  cell: (e) =>
                    Number(e.quantityIn) > 0 ? formatQty(e.quantityIn) : "—",
                },
                {
                  header: "Out",
                  align: "right",
                  cell: (e) =>
                    Number(e.quantityOut) > 0 ? formatQty(e.quantityOut) : "—",
                },
              ]}
            />
          )
        ) : null}

        {tab === "batches" ? (
          batches.length === 0 ? (
            <Card>
              <EmptyState
                title={
                  product.batchTracked ? "No batches yet" : "Not batch tracked"
                }
                description={
                  product.batchTracked
                    ? "Batches appear here once received through a GRN or registered manually."
                    : "Enable batch tracking on the product to manage lots."
                }
              />
            </Card>
          ) : (
            <DataTable
              caption="Batches"
              rows={batches}
              getRowKey={(b) => String(b.id)}
              columns={[
                {
                  header: "Batch #",
                  cell: (b) => (
                    <span className="font-mono text-theme-xs">
                      {b.batchNumber}
                    </span>
                  ),
                },
                { header: "Expiry", cell: (b) => formatDate(b.expiryDate) },
                {
                  header: "Quantity",
                  align: "right",
                  cell: (b) => formatQty(b.quantity),
                },
                {
                  header: "Status",
                  cell: (b) => (
                    <StatusBadge
                      label={formatStatusLabel(b.status)}
                      colorToken={scmStatusToken(b.status)}
                    />
                  ),
                },
              ]}
            />
          )
        ) : null}

        {tab === "serials" ? (
          Object.keys(serialCounts).length === 0 ? (
            <Card>
              <EmptyState
                title={
                  product.serialTracked
                    ? "No serial numbers yet"
                    : "Not serial tracked"
                }
                description={
                  product.serialTracked
                    ? "Serial numbers appear here once received through a GRN or added manually."
                    : "Enable serial tracking on the product to manage serial numbers."
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(serialCounts).map(([status, count]) => (
                <StatCard
                  key={status}
                  headingId={`serial-${status}`}
                  label={formatStatusLabel(status)}
                  value={count}
                  note="Serial numbers"
                />
              ))}
            </div>
          )
        ) : null}
      </Tabs>
    </div>
  );
}
