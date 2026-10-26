"use client";

import type { AdjustmentDirection } from "@texawave-erp/api-types";
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
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  expiryTone,
  formatProductExpiry,
  productExpiryInfo,
} from "../../shared/expiry";
import { useLocationStock } from "../../warehouses/hooks";
import { useLocationOptions, useWarehouseOptions } from "../../shared/masters";
import { ProductBarcodeCard } from "./ProductBarcodeCard";
import { ProductBinCard, ProductExpiryCard } from "./ProductPlacementCards";
import { ReserveStockDialog, StockAdjustDialog } from "./ProductStockDialogs";
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
 * recent ledger movements, batches and serial counts — plus the product's
 * bin location, life & expiry, and inline On Hand / Reserved / Rejected-Bad
 * edits. */
export function InventoryProductDetail({ productId }: { productId: number }) {
  const [tab, setTab] = useState<TabId>("stock");
  const query = useInventoryProductDetail(productId);
  const canWrite = usePermission("scm.inventory.write");
  const canEditProduct = usePermission("scm.product.write");
  const warehousesQuery = useWarehouseOptions();
  const locationsQuery = useLocationOptions();
  const locationStock = useLocationStock();
  const warehouses = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );
  const locations = useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  );
  const [adjustDirection, setAdjustDirection] =
    useState<AdjustmentDirection | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);

  const stockWarehouseIds = useMemo(
    () =>
      (query.data?.rows ?? [])
        .filter((r) => r.onHand > 0)
        .map((r) => r.warehouseId),
    [query.data],
  );

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

  const { rows, ledger, batches, serialCounts } = query.data;
  const productRecord = query.data.product;
  const expiryInfo = productExpiryInfo(batches, productRecord);
  const locById = new Map(locations.map((l) => [l.id, l]));
  // Where the product actually sits: bins holding its stock, plus the default bin.
  const binIds = new Set<number>();
  for (const r of locationStock.data ?? []) {
    if (r.product.id === productRecord.id) binIds.add(r.locationId);
  }
  if (productRecord.binLocationId) binIds.add(productRecord.binLocationId);
  const binLabels = [...binIds]
    .map((id) => locById.get(id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => l.locationCode ?? l.binCode)
    .sort();
  const lastUpdatedMs = Math.max(
    new Date(productRecord.updatedAt).getTime(),
    ledger[0] ? new Date(ledger[0].transactionDate).getTime() : 0,
  );
  const defaultWarehouseId =
    rows.find((r) => r.onHand > 0)?.warehouseId ??
    productRecord.warehouseId ??
    rows[0]?.warehouseId ??
    null;
  const total = rows.reduce(
    (acc, r) => ({
      onHand: acc.onHand + r.onHand,
      reserved: acc.reserved + r.reserved,
      available: acc.available + r.available,
      incoming: acc.incoming + r.incoming,
      damaged: acc.damaged + r.damaged,
      value: acc.value + r.value,
    }),
    { onHand: 0, reserved: 0, available: 0, incoming: 0, damaged: 0, value: 0 },
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
              {productRecord.name}
            </h1>
          </Link>
          <p className="font-mono text-theme-sm text-gray-500 dark:text-gray-400">
            {productRecord.productCode} · {productRecord.uom}
            {productRecord.category ? ` · ${productRecord.category}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {productRecord.category ? (
              <span>
                Category:{" "}
                <span className="font-medium text-gray-900 dark:text-white/90">
                  {productRecord.category}
                </span>
              </span>
            ) : null}
            <span>
              UOM:{" "}
              <span className="font-medium text-gray-900 dark:text-white/90">
                {productRecord.uom}
              </span>
            </span>
            <span>
              Bin Location(s):{" "}
              <span className="font-medium text-gray-900 dark:text-white/90">
                {binLabels.length ? binLabels.join(", ") : "Not tracked"}
              </span>
            </span>
            <span>
              Expiry:{" "}
              <span className={`font-medium ${expiryTone(expiryInfo.status)}`}>
                {formatProductExpiry(expiryInfo)}
              </span>
            </span>
            <span>
              Last Updated:{" "}
              <span className="font-medium text-gray-900 dark:text-white/90">
                {lastUpdatedMs
                  ? formatDateTime(new Date(lastUpdatedMs).toISOString())
                  : "—"}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <EditableStat
          canEdit={canWrite}
          title="Request a stock adjustment"
          onEdit={() => setAdjustDirection("IN")}
        >
          <StatCard
            headingId="d-onhand"
            label="On Hand"
            value={formatQty(total.onHand)}
            note="All warehouses"
          />
        </EditableStat>
        <EditableStat
          canEdit={canWrite}
          title="Reserve stock"
          onEdit={() => setReserveOpen(true)}
        >
          <StatCard
            headingId="d-reserved"
            label="Reserved"
            value={formatQty(total.reserved)}
            note="Held for orders"
            tone="blue"
          />
        </EditableStat>
        <StatCard
          headingId="d-available"
          label="Available"
          value={formatQty(total.available)}
          note="On hand − reserved"
          tone="success"
        />
        <EditableStat
          canEdit={canWrite}
          title="Request a write-off adjustment"
          onEdit={() => setAdjustDirection("OUT")}
        >
          <StatCard
            headingId="d-bad"
            label="Rejected / Bad"
            value={formatQty(total.damaged)}
            note="Rejected, damaged or QC-rejected"
            tone={total.damaged > 0 ? "error" : "neutral"}
          />
        </EditableStat>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductBinCard
          product={productRecord}
          warehouses={warehouses}
          locations={locations}
          stockWarehouseIds={stockWarehouseIds}
          canEdit={canEditProduct}
          lotTracked={
            batches.length > 0 || Object.keys(serialCounts).length > 0
          }
        />
        <ProductExpiryCard
          product={productRecord}
          expiryInfo={expiryInfo}
          canEdit={canEditProduct}
        />
        <ProductBarcodeCard
          product={productRecord}
          expiryInfo={expiryInfo}
          canEdit={canEditProduct}
          batchDated={batches.length > 0}
        />
      </div>

      <StockAdjustDialog
        open={adjustDirection !== null}
        onClose={() => setAdjustDirection(null)}
        direction={adjustDirection ?? "IN"}
        productId={productRecord.id}
        productLabel={`${productRecord.name} (${productRecord.productCode})`}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouseId}
      />
      <ReserveStockDialog
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        productId={productRecord.id}
        productLabel={`${productRecord.name} (${productRecord.productCode})`}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouseId}
      />

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
                header: "Rejected / Bad",
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
                  productRecord.batchTracked
                    ? "No batches yet"
                    : "Not batch tracked"
                }
                description={
                  productRecord.batchTracked
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
                {
                  header: "Bin",
                  cell: (b) => {
                    const loc = b.locationId
                      ? locById.get(b.locationId)
                      : undefined;
                    return loc ? (loc.locationCode ?? loc.binCode) : "—";
                  },
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
                  productRecord.serialTracked
                    ? "No serial numbers yet"
                    : "Not serial tracked"
                }
                description={
                  productRecord.serialTracked
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

/** A KPI card with a small pencil that opens the matching stock edit. */
function EditableStat({
  canEdit,
  title,
  onEdit,
  children,
}: {
  canEdit: boolean;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {canEdit ? (
        <button
          type="button"
          onClick={onEdit}
          title={title}
          aria-label={title}
          className="absolute right-3 top-3 text-gray-400 transition-colors hover:text-brand-600"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
