"use client";

import type { InventoryRow, StockStatus } from "@texawave-erp/api-types";
import { STOCK_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  Select,
  StatCard,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { LayoutGrid, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney, formatQty, scmStatusToken } from "../../shared/format";
import { WarehouseSelect } from "../../shared/masters";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { useOverview, useOverviewKpis, usePostOpeningBalance } from "../hooks";

/** Legacy `ScmStockOverview`: KPI cards, filterable stock table by product
 * and warehouse, and the "Post Opening Balance" action. */
export function StockOverviewView() {
  const c = useListControls();
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [openingOpen, setOpeningOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const post = usePostOpeningBalance();

  const filters = {
    q: c.q,
    warehouseId: warehouseId === "" ? undefined : warehouseId,
    stockStatus: status === "" ? undefined : status,
  };
  const query = useOverview({ ...filters, page: c.page, limit: c.pageSize });
  const kpis = useOverviewKpis({ q: c.q, warehouseId: filters.warehouseId });
  const k = kpis.data;

  const reset = () => {
    c.setSearch("");
    setWarehouseId("");
    setStatus("");
    c.setPage(1);
  };

  return (
    <ScmListView<InventoryRow>
      title="Stock Overview"
      description="On-hand, reserved, available and incoming stock by product and warehouse."
      icon={LayoutGrid}
      noun="stock rows"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => r.id}
      actions={
        canWrite ? (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setOpeningOpen(true)}
          >
            <PackagePlus className="h-4 w-4" />
            Post Opening Balance
          </Button>
        ) : null
      }
      summary={
        k ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <StatCard
              headingId="kpi-value"
              label="Total Value"
              value={formatMoney(k.totalValue, "INR", 0)}
              note="At cost"
              tone="brand"
            />
            <StatCard
              headingId="kpi-skus"
              label="Total SKUs"
              value={k.totalSkus}
              note="Active products"
            />
            <StatCard
              headingId="kpi-available"
              label="Available"
              value={formatQty(k.available)}
              note="On hand − reserved"
              tone="success"
            />
            <StatCard
              headingId="kpi-reserved"
              label="Reserved"
              value={formatQty(k.reserved)}
              note="Held for orders"
              tone="blue"
            />
            <StatCard
              headingId="kpi-low"
              label="Low Stock"
              value={k.lowStock}
              note="At/below reorder"
              tone="warning"
            />
            <StatCard
              headingId="kpi-out"
              label="Out of Stock"
              value={k.outOfStock}
              note="Nothing available"
              tone="error"
            />
            <StatCard
              headingId="kpi-incoming"
              label="Incoming"
              value={formatQty(k.incoming)}
              note="On open POs"
              tone="info"
            />
          </div>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by product code, name or category...",
      }}
      filters={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="w-full sm:w-52">
            <WarehouseSelect
              aria-label="Filter by warehouse"
              placeholder="All warehouses"
              value={warehouseId}
              onChange={(v) => {
                setWarehouseId(v);
                c.setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by stock status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StockStatus | "");
                c.setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
      hasActiveFilters={Boolean(
        c.search || warehouseId !== "" || status !== "",
      )}
      onResetFilters={reset}
      emptyTitle="No stock yet"
      emptyDescription="Add products and warehouses, then post an opening balance to seed stock."
      columns={[
        {
          header: "Product",
          cell: (r) => (
            <div className="flex flex-col">
              <Link
                href={`/scm/inventory/overview/${r.productId}`}
                className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                {r.productName}
              </Link>
              <span className="font-mono text-theme-xs text-gray-500">
                {r.productCode}
              </span>
            </div>
          ),
        },
        { header: "Warehouse", cell: (r) => r.warehouseName },
        { header: "On Hand", align: "right", cell: (r) => formatQty(r.onHand) },
        {
          header: "Reserved",
          align: "right",
          cell: (r) => formatQty(r.reserved),
        },
        {
          header: "Available",
          align: "right",
          cell: (r) => <strong>{formatQty(r.available)}</strong>,
        },
        {
          header: "Incoming",
          align: "right",
          cell: (r) => (r.incoming > 0 ? formatQty(r.incoming) : "—"),
        },
        {
          header: "Damaged",
          align: "right",
          cell: (r) => (r.damaged > 0 ? formatQty(r.damaged) : "—"),
        },
        {
          header: "Quarantine",
          align: "right",
          cell: (r) => (r.quarantine > 0 ? formatQty(r.quarantine) : "—"),
        },
        {
          header: "Value",
          align: "right",
          cell: (r) => formatMoney(r.value, "INR", 0),
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
    >
      <ScmFormDialog
        open={openingOpen}
        onClose={() => setOpeningOpen(false)}
        title="Post Opening Balance"
        description="Creates an authoritative OPENING_BALANCE entry in the stock ledger. It cannot be edited afterwards — use an Adjustment to correct it."
        submitLabel="Post Opening Balance"
        fields={[
          {
            name: "productId",
            label: "Product",
            type: "product",
            required: true,
            span: 2,
          },
          {
            name: "warehouseId",
            label: "Warehouse",
            type: "warehouse",
            required: true,
            span: 2,
          },
          {
            name: "quantity",
            label: "Opening Quantity",
            type: "number",
            required: true,
            min: 0.001,
            step: 0.001,
          },
          {
            name: "unitCost",
            label: "Unit Cost",
            type: "number",
            min: 0,
            step: 0.01,
            placeholder: "Optional",
          },
          {
            name: "notes",
            label: "Notes",
            type: "text",
            span: 2,
            placeholder: "Optional",
          },
        ]}
        onSubmit={async (v) => {
          try {
            await post.mutateAsync({
              productId: v.productId as number,
              warehouseId: v.warehouseId as number,
              quantity: v.quantity as number,
              unitCost: v.unitCost as number | undefined,
              notes: v.notes as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to post opening balance"));
          }
          toast({
            title: "Opening balance posted to the stock ledger",
            variant: "success",
          });
          setOpeningOpen(false);
        }}
      />
    </ScmListView>
  );
}
