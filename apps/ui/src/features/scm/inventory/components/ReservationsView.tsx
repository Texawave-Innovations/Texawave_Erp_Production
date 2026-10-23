"use client";

import type { ScmReservation } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Lock, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateReservation,
  useReleaseReservation,
  useReservations,
} from "../hooks";

const STATUSES = ["ACTIVE", "RELEASED", "FULFILLED", "CANCELLED"] as const;

/** Legacy `ScmReservations`: stock reserved against sales orders. Reserving
 * never posts a ledger transaction — it only reduces Available. */
export function ReservationsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const create = useCreateReservation();
  const release = useReleaseReservation();

  const query = useReservations({
    page: c.page,
    limit: c.pageSize,
    status: status || undefined,
  });

  async function handleRelease(
    r: ScmReservation,
    to: "RELEASED" | "CANCELLED",
  ) {
    try {
      await release.mutateAsync({ id: r.id, status: to });
      toast({ title: `Reservation ${to.toLowerCase()}`, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, "Failed to release reservation"),
        variant: "error",
      });
    }
  }

  return (
    <ScmListView<ScmReservation>
      title="Reservations"
      description="Stock reserved against confirmed sales orders. Reserving stock never posts a ledger transaction — it only reduces Available."
      icon={Lock}
      noun="reservations"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Reserve Stock
          </Button>
        ) : null
      }
      filters={
        <div className="w-full sm:w-48">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(status)}
      onResetFilters={() => {
        setStatus("");
        c.setPage(1);
      }}
      emptyTitle="No reservations yet"
      emptyDescription="Reserve stock to hold it for a sales order."
      columns={[
        { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
        {
          header: "Product",
          cell: (r) => (
            <div className="flex flex-col">
              <span className="font-medium">{r.product?.name}</span>
              <span className="font-mono text-theme-xs text-gray-500">
                {r.product?.productCode}
              </span>
            </div>
          ),
        },
        { header: "Warehouse", cell: (r) => r.warehouse?.name ?? "—" },
        { header: "Sales Order", cell: (r) => r.salesOrderNumber ?? "—" },
        {
          header: "Quantity",
          align: "right",
          cell: (r) => formatQty(r.quantity),
        },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite && r.status === "ACTIVE" ? (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRelease(r, "RELEASED")}
                >
                  Release
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRelease(r, "CANCELLED")}
                >
                  Cancel
                </Button>
              </div>
            ) : null,
        },
      ]}
    >
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reserve Stock"
        submitLabel="Reserve"
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
          },
          {
            name: "quantity",
            label: "Quantity",
            type: "number",
            required: true,
            min: 0.001,
            step: 0.001,
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
            await create.mutateAsync({
              productId: v.productId as number,
              warehouseId: v.warehouseId as number,
              quantity: v.quantity as number,
              notes: v.notes as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to reserve stock"));
          }
          toast({ title: "Stock reserved", variant: "success" });
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
