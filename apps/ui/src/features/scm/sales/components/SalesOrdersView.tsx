"use client";

import type { SalesOrder, SalesOrderPayload } from "@texawave-erp/api-types";
import { SALES_ORDER_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus, ShoppingCart, FileCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatMoney,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateSalesOrder,
  useSalesOrder,
  useSalesOrderAction,
  useSalesOrders,
} from "../hooks";
import { IssueInvoiceDialog } from "./IssueInvoiceDialog";
import { SalesOrderForm } from "./SalesOrderForm";

/** Sales orders feeding fulfillment (legacy read these from the Sales module). */
export function SalesOrdersView() {
  const router = useRouter();
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<SalesOrder | null>(null);
  const [invoicingOrder, setInvoicingOrder] = useState<SalesOrder | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.sales.write");
  const canFulfil = usePermission("scm.fulfillment.write");
  const create = useCreateSalesOrder();
  const act = useSalesOrderAction();
  const detail = useSalesOrder(viewingId);
  const query = useSalesOrders({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  async function run(so: SalesOrder, action: "confirm" | "cancel", ok: string) {
    try {
      await act.mutateAsync({ id: so.id, action });
      toast({ title: ok, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} order`),
        variant: "error",
      });
    }
  }

  async function save(payload: SalesOrderPayload) {
    try {
      await create.mutateAsync(payload);
    } catch (err) {
      throw new Error(errorText(err, "Failed to save sales order"));
    }
    toast({ title: "Sales order saved as draft", variant: "success" });
    setFormOpen(false);
  }

  const so = detail.data;

  return (
    <ScmListView<SalesOrder>
      title="Sales Orders"
      description="Customer orders that are allocated, picked, packed and shipped."
      icon={ShoppingCart}
      noun="sales orders"
      readPermission="scm.sales.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Sales Order
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by order number or customer...",
      }}
      filters={
        <div className="w-full lg:w-44">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {SALES_ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {formatStatusLabel(st)}
              </option>
            ))}
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="No sales orders yet"
      emptyDescription="Create a customer order to start fulfillment."
      columns={[
        {
          header: "Order #",
          cell: (r) => (
            <span className="font-semibold text-theme-xs text-gray-900 dark:text-white">
              {r.soNumber}
            </span>
          ),
        },
        { header: "Customer", cell: (r) => r.customerName },
        { header: "Order Date", cell: (r) => formatDate(r.orderDate) },
        { header: "Items", align: "right", cell: (r) => r.items.length },
        { header: "Total", align: "right", cell: (r) => formatMoney(r.total) },
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
          header: "Invoice",
          cell: (r) =>
            r.invoiceNumber ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-theme-xs font-semibold text-[#1769F5] dark:bg-sky-950/40 dark:text-sky-300">
                {r.invoiceNumber}
              </span>
            ) : (
              <span className="text-theme-xs text-gray-400">Not Invoiced</span>
            ),
        },
        { header: "Shipping", cell: (r) => r.shippedStatus },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {r.status === "DRAFT" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void run(r, "confirm", "Sales order confirmed")
                  }
                >
                  Confirm
                </Button>
              ) : null}
              {r.status === "CONFIRMED" &&
              canWrite &&
              r.invoicedStatus !== "Invoiced" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-[#1769F5]/30 text-[#1769F5] hover:bg-sky-50 dark:hover:bg-sky-950/40"
                  onClick={() => setInvoicingOrder(r)}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Issue Invoice
                </Button>
              ) : null}
              {r.status === "CONFIRMED" && canFulfil ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(`/scm/orders/fulfillment?fromOrder=${r.id}`)
                  }
                >
                  Fulfil
                </Button>
              ) : null}
              {["DRAFT", "CONFIRMED"].includes(r.status) && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelling(r)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          ),
        },
      ]}
    >
      <SalesOrderForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel sales order?"
        description={`Cancel ${cancelling?.soNumber ?? ""}? Orders with open fulfillments cannot be cancelled. If an invoice was posted, its accounting and GST entries will be reversed.`}
        confirmText="Cancel order"
        variant="destructive"
        onConfirm={async () => {
          if (cancelling)
            await run(cancelling, "cancel", "Sales order cancelled");
          setCancelling(null);
        }}
      />
      {invoicingOrder ? (
        <IssueInvoiceDialog
          key={invoicingOrder.id}
          open={Boolean(invoicingOrder)}
          onClose={() => setInvoicingOrder(null)}
          order={invoicingOrder}
        />
      ) : null}
      <ScmDetailDialog
        open={viewingId !== null}
        onClose={() => setViewingId(null)}
        title={so?.soNumber ?? "Sales order"}
        status={so?.status ?? ""}
        fields={[
          ["Customer", so?.customerName],
          ["Order date", formatDate(so?.orderDate)],
          ["Expected", formatDate(so?.expectedDate)],
          ["Shipping", so?.shippedStatus],
          [
            "Invoice",
            so?.invoiceNumber ? `${so.invoiceNumber} (Posted)` : "Not Invoiced",
          ],
          ["Ship to", so?.shipToAddress],
          ["Bill to", so?.billToAddress],
          ["Subtotal", formatMoney(so?.subtotal)],
          ["Tax", formatMoney(so?.taxAmount)],
          ["Total", formatMoney(so?.total)],
          ["Notes", so?.notes],
          [
            "Fulfillments",
            so?.fulfillments?.map((f) => f.fulfillmentNumber).join(", ") || "—",
          ],
        ]}
        lineRows={so?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          {
            header: "Item",
            cell: (i) => `${i.itemDescription} (${i.itemCode})`,
          },
          { header: "UOM", cell: (i) => i.uom },
          { header: "Qty", align: "right", cell: (i) => formatQty(i.salesQty) },
          {
            header: "Unclaimed",
            align: "right",
            cell: (i) => formatQty(i.remainingQty ?? 0),
          },
          {
            header: "Unit Price",
            align: "right",
            cell: (i) => formatMoney(i.unitPrice),
          },
          {
            header: "Tax %",
            align: "right",
            cell: (i) => formatQty(i.taxRate),
          },
          {
            header: "Total",
            align: "right",
            cell: (i) => formatMoney(i.total),
          },
        ]}
      />
    </ScmListView>
  );
}
