"use client";

import type { WarehouseStockViewRow } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Boxes,
  Layers,
  LayoutGrid,
  MapPin,
  Tag,
  Trash2,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { buildQrPayload } from "../../barcode/codes";
import { LabelDialog } from "../../barcode/LabelDialog";
import type { BarcodeLabelProps } from "../../barcode/BarcodeLabel";
import { useBatches, useOverviewKpis, useSerials } from "../../inventory/hooks";
import {
  formatDate,
  formatMoney,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useLocationOptions, WarehouseSelect } from "../../shared/masters";
import { DashboardKpiGrid } from "../../shared/ScmDashboardPage";
import { errorText } from "../../shared/use-list-controls";
import { useStockView, useStockWriteOff } from "../hooks";

const TABS = [
  { id: "location", label: "By Location" },
  { id: "batches", label: "Batches" },
  { id: "serials", label: "Serial Numbers" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Legacy `ScmWarehouseStock`: on-hand stock by warehouse, location, batch and
 * serial. On-hand totals come from the stock ledger; the location split comes
 * from completed put-away / movement records, and whatever on-hand never went
 * through a bin shows as "Unassigned" so the total always reconciles. */
export function WarehouseStockView() {
  const [tab, setTab] = useState<TabId>("location");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [writeOff, setWriteOff] = useState<WarehouseStockViewRow | null>(null);
  const [label, setLabel] = useState<BarcodeLabelProps | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const filters = {
    warehouseId: warehouseId === "" ? undefined : warehouseId,
    q: search.trim() || undefined,
  };
  const stock = useStockView(filters);
  const kpis = useOverviewKpis({ warehouseId: filters.warehouseId });
  const batches = useBatches({
    page: 1,
    limit: 100,
    warehouseId: filters.warehouseId,
    q: filters.q,
  });
  const serials = useSerials({
    page: 1,
    limit: 100,
    warehouseId: filters.warehouseId,
    q: filters.q,
  });
  const locations = useLocationOptions();
  const writeOffMutation = useStockWriteOff();
  const locationLabel = useMemo(() => {
    const m = new Map(
      (locations.data ?? []).map((l) => [l.id, l.locationCode ?? l.binCode]),
    );
    return (id: number | null | undefined) =>
      id ? (m.get(id) ?? "—") : "Unassigned";
  }, [locations.data]);

  if (stock.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (stock.isError) {
    if (stock.error instanceof ApiError && stock.error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to warehouse stock"
        >
          Ask an administrator for the <code>scm.warehouse.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void stock.refetch()} />;
  }

  const rows = stock.data;
  const occupiedLocations = new Set(
    rows.filter((r) => r.locationId).map((r) => r.locationId),
  ).size;
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={LayoutGrid}
        title="Warehouse Stock"
        description="On-hand stock by warehouse, location, batch and serial. On-hand/reserved/available totals come from the stock ledger; the location split comes from completed put-away and movement records."
      />
      <DashboardKpiGrid
        kpis={[
          {
            id: "qty",
            label: "Total Stock Quantity",
            value: formatQty(totalQty),
            icon: Boxes,
            href: "/scm/inventory/overview",
          },
          {
            id: "value",
            label: "Stock Value",
            value: kpis.data
              ? formatMoney(kpis.data.totalValue, "INR", 0)
              : "…",
            icon: LayoutGrid,
            href: "/scm/inventory/overview",
          },
          {
            id: "occupied",
            label: "Occupied Locations",
            value: occupiedLocations,
            icon: MapPin,
            href: "/scm/locations",
          },
          {
            id: "tracked",
            label: "Tracked Batches / Serials",
            value: `${batches.data?.meta.total ?? 0} / ${serials.data?.meta.total ?? 0}`,
            icon: Layers,
            href: "/scm/inventory/batches",
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-sm">
          <Input
            aria-label="Search stock"
            placeholder="Search product or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <WarehouseSelect
            aria-label="Filter by warehouse"
            placeholder="All warehouses"
            activeOnly={false}
            value={warehouseId}
            onChange={setWarehouseId}
          />
        </div>
      </div>

      <Tabs
        label="Warehouse stock sections"
        idPrefix="wh-stock"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "location" ? (
          <DataTable<WarehouseStockViewRow>
            caption="Stock by location"
            rows={rows}
            getRowKey={(r) =>
              `${r.warehouseId}-${r.locationId ?? "u"}-${r.productId}`
            }
            emptyState={
              <EmptyState
                title="No stock found."
                description="Receive goods and put them away into bins to see them here."
              />
            }
            columns={[
              {
                header: "Warehouse",
                cell: (r) => (
                  <span className="inline-flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5 text-gray-400" />
                    {r.warehouseName}
                  </span>
                ),
              },
              {
                header: "Location",
                cell: (r) =>
                  r.locationId ? (
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-theme-xs dark:bg-gray-800">
                      {r.locationCode}
                    </span>
                  ) : (
                    <span className="text-theme-xs italic text-gray-500">
                      {r.locationCode}
                    </span>
                  ),
              },
              {
                header: "Product",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.productName}</span>
                    <span className="font-mono text-theme-xs text-gray-500">
                      {r.productCode}
                    </span>
                  </div>
                ),
              },
              {
                header: "Quantity",
                align: "right",
                cell: (r) => <strong>{formatQty(r.quantity)}</strong>,
              },
              {
                header: "Actions",
                headerClassName: "text-center",
                className: "text-center",
                cell: (r) => (
                  <div className="flex justify-center gap-1">
                    {r.locationId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="QR label"
                        aria-label={`QR label for ${r.locationCode}`}
                        onClick={() =>
                          setLabel({
                            format: "QR",
                            value: buildQrPayload(
                              "LOCATION",
                              r.locationCode,
                              r.locationId as number,
                            ),
                            title: r.locationCode,
                            footer: `Warehouse: ${r.warehouseName}`,
                          })
                        }
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Write off this stock"
                        aria-label={`Write off ${r.productName} at ${r.locationCode}`}
                        onClick={() => setWriteOff(r)}
                      >
                        <Trash2 className="h-4 w-4 text-error-600" />
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        ) : null}

        {tab === "batches" ? (
          <DataTable
            caption="Batches"
            rows={batches.data?.data ?? []}
            getRowKey={(b) => String(b.id)}
            loading={batches.isPending}
            emptyState={<EmptyState title="No batches found." description="" />}
            columns={[
              {
                header: "Batch #",
                cell: (b) => (
                  <span className="font-mono text-theme-xs">
                    {b.batchNumber}
                  </span>
                ),
              },
              { header: "Product", cell: (b) => b.product?.name ?? "—" },
              { header: "Warehouse", cell: (b) => b.warehouse?.name ?? "—" },
              {
                header: "Location",
                cell: (b) => (
                  <span className="font-mono text-theme-xs">
                    {locationLabel(b.locationId)}
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
        ) : null}

        {tab === "serials" ? (
          <DataTable
            caption="Serial numbers"
            rows={serials.data?.data ?? []}
            getRowKey={(s) => String(s.id)}
            loading={serials.isPending}
            emptyState={
              <EmptyState title="No serial numbers found." description="" />
            }
            columns={[
              {
                header: "Serial #",
                cell: (s) => (
                  <span className="font-mono text-theme-xs">
                    {s.serialNumber}
                  </span>
                ),
              },
              { header: "Product", cell: (s) => s.product?.name ?? "—" },
              { header: "Warehouse", cell: (s) => s.warehouse?.name ?? "—" },
              {
                header: "Location",
                cell: (s) => (
                  <span className="font-mono text-theme-xs">
                    {locationLabel(s.locationId)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (s) => (
                  <StatusBadge
                    label={formatStatusLabel(s.status)}
                    colorToken={scmStatusToken(s.status)}
                  />
                ),
              },
              { header: "Reference", cell: (s) => s.currentReference ?? "—" },
            ]}
          />
        ) : null}
      </Tabs>

      <ConfirmDialog
        open={Boolean(writeOff)}
        onClose={() => setWriteOff(null)}
        title="Write off stock?"
        confirmText="Write Off"
        variant="destructive"
        description={
          writeOff
            ? `Write off ${formatQty(writeOff.quantity)} × ${writeOff.productName} at ${writeOff.locationCode} (${writeOff.warehouseName})? Posts a real stock adjustment (ADJUSTMENT_OUT) — it reduces this product's on-hand total everywhere immediately. This can't be undone; use a fresh Adjustment to correct it afterward.`
            : ""
        }
        onConfirm={async () => {
          if (!writeOff) return;
          try {
            await writeOffMutation.mutateAsync({
              productId: writeOff.productId,
              warehouseId: writeOff.warehouseId,
              locationId: writeOff.locationId ?? undefined,
              quantity: writeOff.quantity,
            });
            toast({
              title: `Wrote off ${formatQty(writeOff.quantity)} × ${writeOff.productName}`,
              variant: "success",
            });
          } catch (err) {
            toast({
              title: errorText(err, "Failed to write off this stock"),
              variant: "error",
            });
          }
          setWriteOff(null);
        }}
      />

      <LabelDialog
        open={label !== null}
        onClose={() => setLabel(null)}
        dialogTitle="Location QR Label"
        label={label}
      />
    </div>
  );
}
