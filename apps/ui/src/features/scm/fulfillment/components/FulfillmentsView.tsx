"use client";

import type { Fulfillment } from "@texawave-erp/api-types";
import { FULFILLMENT_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { ClipboardCheck, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { useSalesOrders } from "../../sales/hooks";
import {
  useCreateFulfillment,
  useDeleteFulfillment,
  useFulfillment,
  useFulfillmentAction,
  useFulfillments,
} from "../hooks";

type Mode = "fulfillment" | "allocation" | "backorders";

const COPY: Record<
  Mode,
  { title: string; description: string; noun: string; empty: string }
> = {
  fulfillment: {
    title: "Order Fulfillment",
    description:
      "Allocate stock to customer orders, then pick, pack and issue it.",
    noun: "fulfillments",
    empty: "Create a fulfillment from a confirmed sales order.",
  },
  allocation: {
    title: "Stock Allocation",
    description:
      "Fulfillments waiting for stock to be reserved against their order lines.",
    noun: "allocations",
    empty: "No fulfillments are waiting for stock to be reserved.",
  },
  backorders: {
    title: "Backorders",
    description:
      "Open fulfillments that cannot be fully covered by stock on hand.",
    noun: "backorders",
    empty: "Nothing is short — every open fulfillment is covered.",
  },
};

const shortageOf = (f: Fulfillment) =>
  f.items.reduce(
    (s, i) =>
      s +
      Math.max(
        0,
        Number(i.orderedQty) - Number(i.issuedQty) - Number(i.reservedQty),
      ),
    0,
  );

/** Legacy `ScmFulfillment`, `ScmStockAllocation` and `ScmBackorders` share
 * one record; this view renders the three entry points. */
export function FulfillmentsView({ mode = "fulfillment" }: { mode?: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const fromOrder = params.get("fromOrder");
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(fromOrder));
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<Fulfillment | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.fulfillment.write");
  const deletingRowRemove = useDeleteFulfillment();
  const [deletingRow, setDeletingRow] = useState<Fulfillment | null>(null);
  const canApprove = usePermission("scm.fulfillment.approve");
  const create = useCreateFulfillment();
  const act = useFulfillmentAction();
  const detail = useFulfillment(viewingId);
  const orders = useSalesOrders({ page: 1, limit: 100, status: "CONFIRMED" });
  const copy = COPY[mode];
  const query = useFulfillments({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
    view:
      mode === "allocation"
        ? "allocation"
        : mode === "backorders"
          ? "backorders"
          : undefined,
  });

  async function run(
    f: Fulfillment,
    action: Parameters<typeof act.mutateAsync>[0]["action"],
    ok: string,
    reason?: string,
  ) {
    try {
      await act.mutateAsync({
        id: f.id,
        action,
        ...(reason !== undefined ? { reason } : {}),
      });
      toast({ title: ok, variant: "success" });
    } catch (err) {
      toast({ title: errorText(err, "Action failed"), variant: "error" });
    }
  }

  function closeForm() {
    setFormOpen(false);
    if (fromOrder) router.replace("/scm/orders/fulfillment");
  }

  const f = detail.data;
  const openStatuses = [
    "PENDING",
    "PARTIALLY_AVAILABLE",
    "AVAILABLE",
    "RESERVED",
    "PICKING",
    "PACKING",
    "READY_TO_SHIP",
  ];

  function actionsFor(r: Fulfillment) {
    if (!canWrite) return null;
    return (
      <>
        {["PENDING", "PARTIALLY_AVAILABLE", "AVAILABLE"].includes(r.status) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void run(r, "reserve", "Stock reserved")}
          >
            Reserve
          </Button>
        ) : null}
        {r.status === "RESERVED" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void run(r, "pick-list", "Pick list created")}
          >
            Create Pick List
          </Button>
        ) : null}
        {mode === "backorders" && shortageOf(r) > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void run(r, "shortage-requisition", "Material requisition raised")
            }
          >
            Raise Requisition
          </Button>
        ) : null}
        {r.status === "READY_TO_SHIP" && canApprove ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void run(r, "finalize", "Stock issued — fulfilled")}
          >
            Issue Stock
          </Button>
        ) : null}
        {openStatuses.includes(r.status) ? (
          <Button variant="ghost" size="sm" onClick={() => setCancelling(r)}>
            Cancel
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <ScmListView<Fulfillment>
      title={copy.title}
      description={copy.description}
      icon={ClipboardCheck}
      noun={copy.noun}
      readPermission="scm.fulfillment.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      actions={
        canWrite && mode === "fulfillment" ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Fulfillment
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by fulfillment, order or customer...",
      }}
      filters={
        mode === "fulfillment" ? (
          <div className="w-full lg:w-48">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                c.setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {FULFILLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </Select>
          </div>
        ) : undefined
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle={`No ${copy.noun}`}
      emptyDescription={copy.empty}
      columns={[
        {
          header: "Fulfillment #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.fulfillmentNumber}
            </span>
          ),
        },
        { header: "Sales Order", cell: (r) => r.salesOrderNumber },
        { header: "Customer", cell: (r) => r.customerName },
        { header: "Warehouse", cell: (r) => r.warehouse?.name ?? "—" },
        {
          header: "Ordered",
          align: "right",
          cell: (r) =>
            formatQty(r.items.reduce((s, i) => s + Number(i.orderedQty), 0)),
        },
        {
          header: "Reserved",
          align: "right",
          cell: (r) =>
            formatQty(r.items.reduce((s, i) => s + Number(i.reservedQty), 0)),
        },
        ...(mode === "backorders"
          ? [
              {
                header: "Short",
                align: "right" as const,
                cell: (r: Fulfillment) => formatQty(shortageOf(r)),
              },
            ]
          : []),
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
          cell: (r) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {actionsFor(r)}
            </div>
          ),
        },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete fulfillment"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<Fulfillment>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete fulfillment?"
        describe={(r) =>
          `Permanently delete ${r.fulfillmentNumber}? This cannot be undone. A fulfillment with active reservations, linked requisitions or warehouse activity cannot be deleted — cancel it first.`
        }
        confirmText="Delete fulfillment"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Fulfillment deleted"
        errorFallback="Failed to delete fulfillment"
      />
      <ScmFormDialog
        open={formOpen}
        onClose={closeForm}
        title="New Fulfillment"
        description="Claims the unfulfilled quantity of a confirmed sales order."
        submitLabel="Create Fulfillment"
        initialValues={fromOrder ? { salesOrderId: fromOrder } : {}}
        fields={[
          {
            name: "salesOrderId",
            label: "Sales order",
            type: "select",
            required: true,
            options: (orders.data?.data ?? []).map((o) => ({
              value: String(o.id),
              label: `${o.soNumber} — ${o.customerName}`,
            })),
          },
          {
            name: "warehouseId",
            label: "Fulfilling warehouse",
            type: "warehouse",
            required: true,
          },
        ]}
        onSubmit={async (v) => {
          let created: Fulfillment;
          try {
            created = await create.mutateAsync({
              salesOrderId: Number(v.salesOrderId),
              warehouseId: Number(v.warehouseId),
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create fulfillment"));
          }
          toast({
            title: `${created.fulfillmentNumber} created`,
            variant: "success",
          });
          closeForm();
        }}
      />
      <ScmFormDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={`Cancel ${cancelling?.fulfillmentNumber ?? ""}`}
        description="Releases reserved stock and cancels open pick lists."
        submitLabel="Cancel Fulfillment"
        fields={[
          {
            name: "reason",
            label: "Reason",
            type: "textarea",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          if (!cancelling) return;
          try {
            await act.mutateAsync({
              id: cancelling.id,
              action: "cancel",
              reason: v.reason as string,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to cancel fulfillment"));
          }
          toast({ title: "Fulfillment cancelled", variant: "success" });
          setCancelling(null);
        }}
      />
      <ScmDetailDialog
        open={viewingId !== null}
        onClose={() => setViewingId(null)}
        title={f?.fulfillmentNumber ?? "Fulfillment"}
        status={f?.status ?? ""}
        fields={[
          ["Sales order", f?.salesOrderNumber],
          ["Customer", f?.customerName],
          ["Warehouse", f?.warehouse?.name],
          ["Delivery", f ? formatStatusLabel(f.deliveryStatus) : undefined],
          ["Created", formatDate(f?.createdAt)],
          ["Delivered", formatDateTime(f?.deliveredAt)],
          ["Cancellation reason", f?.cancellationReason],
          [
            "Requisitions",
            f?.requisitions?.map((r) => r.requisitionNumber).join(", ") || "—",
          ],
          [
            "Pick lists",
            f?.pickings
              ?.map((p) => `${p.pickNumber} (${formatStatusLabel(p.status)})`)
              .join(", ") || "—",
          ],
          [
            "Packings",
            f?.packings
              ?.map((p) => `${p.packNumber} (${formatStatusLabel(p.status)})`)
              .join(", ") || "—",
          ],
          [
            "Shipments",
            f?.shipments?.map((s) => s.shipmentNumber).join(", ") || "—",
          ],
          ["Stock issues", f?.ledgerEntries?.length ?? 0],
        ]}
        lineRows={f?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          {
            header: "Item",
            cell: (i) => `${i.itemDescription} (${i.itemCode})`,
          },
          { header: "UOM", cell: (i) => i.uom },
          {
            header: "Ordered",
            align: "right",
            cell: (i) => formatQty(i.orderedQty),
          },
          {
            header: "Reserved",
            align: "right",
            cell: (i) => formatQty(i.reservedQty),
          },
          {
            header: "Issued",
            align: "right",
            cell: (i) => formatQty(i.issuedQty),
          },
        ]}
      />
    </ScmListView>
  );
}
