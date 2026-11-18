"use client";

import type {
  CreatePurchaseOrderInput,
  PurchaseOrder,
} from "@texawave-erp/api-types";
import { PO_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatMoney,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import {
  purchasesAwarePath,
  withoutQueryParams,
} from "../../shared/purchases-aware-path";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  usePurchaseOrderAction,
  usePurchaseOrders,
  useQuotation,
  useRequisition,
} from "../hooks";
import { buildMrCoverage } from "../mr-coverage";
import { PurchaseOrderForm } from "./PurchaseOrderForm";

type Action = "submit" | "approve" | "send" | "cancel" | "close";

const SUCCESS: Record<Action, string> = {
  submit: "Purchase order submitted for approval",
  approve: "Purchase order approved — incoming stock raised",
  send: "Purchase order marked as sent",
  cancel: "Purchase order cancelled",
  close: "Purchase order closed",
};

/** Legacy `ScmPurchaseOrders`. `?fromQuotation=<id>` opens the form for a
 * selected quotation; `?requisitionId=<id>&mr=<number>` (from a Material
 * Requisition's "Open Purchase Orders") restricts the list to POs raised
 * from that exact requisition. */
export function PurchaseOrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromQuotationId = params.get("fromQuotation");
  const mrFilterId = params.get("requisitionId");
  const mrFilterNumber = params.get("mr");
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(fromQuotationId));
  const [viewing, setViewing] = useState<PurchaseOrder | null>(null);
  const [confirm, setConfirm] = useState<{
    po: PurchaseOrder;
    action: "cancel" | "close";
  } | null>(null);
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const canApprove = usePermission("scm.procurement.approve");
  const quotation = useQuotation(
    fromQuotationId ? Number(fromQuotationId) : null,
  );
  const create = useCreatePurchaseOrder();
  const act = usePurchaseOrderAction();
  const remove = useDeletePurchaseOrder();
  const viewingMr = useRequisition(viewing?.requisitionId ?? null);

  const query = usePurchaseOrders({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status ? (status as PurchaseOrder["status"]) : undefined,
    requisitionId: mrFilterId ? Number(mrFilterId) : undefined,
  });

  async function run(po: PurchaseOrder, action: Action) {
    try {
      await act.mutateAsync({ id: po.id, action });
      toast({ title: SUCCESS[action], variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} purchase order`),
        variant: "error",
      });
    }
  }

  function closeForm() {
    setFormOpen(false);
    if (fromQuotationId) {
      router.replace(withoutQueryParams(pathname, params, ["fromQuotation"]));
    }
  }

  async function save(input: CreatePurchaseOrderInput) {
    let created: PurchaseOrder;
    try {
      created = await create.mutateAsync(input);
    } catch (err) {
      throw new Error(errorText(err, "Failed to create purchase order"));
    }
    // Client-demo auto-issues a fresh PO straight through to the supplier —
    // there's no separate approval step to walk through in a demo. Stops
    // silently at whatever stage the caller's permissions allow; the PO is
    // left at that (still valid) status rather than failing the create.
    let autoSent = false;
    if (SCM_CLIENT_DEMO && canWrite) {
      try {
        await act.mutateAsync({ id: created.id, action: "submit" });
        if (canApprove) {
          await act.mutateAsync({ id: created.id, action: "approve" });
          await act.mutateAsync({ id: created.id, action: "send" });
          autoSent = true;
        }
      } catch {
        // Already at the furthest status this user/org state allows — fine.
      }
    }
    toast({
      title: autoSent
        ? `Purchase order ${created.poNumber} created and sent to the supplier`
        : `Purchase order ${created.poNumber} created as draft`,
      variant: "success",
    });
    closeForm();
  }

  return (
    <ScmListView<PurchaseOrder>
      title="Purchase Orders"
      description="Purchase orders raised against selected supplier quotations, or directly for an active supplier."
      icon={ShoppingCart}
      noun="purchase orders"
      readPermission="scm.procurement.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(p) => String(p.id)}
      onRowClick={setViewing}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by PO number, supplier or MR number...",
      }}
      filters={
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      }
      summary={
        mrFilterId ? (
          <div className="flex items-center gap-2 text-theme-sm">
            <StatusBadge
              label={`Linked to MR ${mrFilterNumber ?? mrFilterId}`}
              colorToken={scmStatusToken("DRAFT")}
            />
            <button
              type="button"
              className="text-theme-xs text-brand-600 underline"
              onClick={() => {
                router.replace(
                  withoutQueryParams(pathname, params, ["requisitionId", "mr"]),
                );
                c.setPage(1);
              }}
            >
              Show all POs
            </button>
          </div>
        ) : undefined
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="No purchase orders yet"
      emptyDescription="Create a purchase order from a selected quotation or directly for a supplier."
      columns={[
        {
          header: "PO #",
          cell: (p) => (
            <div className="flex flex-col">
              <span className="font-mono text-theme-xs">{p.poNumber}</span>
              {p.requisitionNumber || p.requisition ? (
                <span className="text-theme-xs text-gray-500">
                  MR:{" "}
                  <span className="font-mono">
                    {p.requisition?.requisitionNumber ?? p.requisitionNumber}
                  </span>
                  {p.requisition?.requestedByName
                    ? ` · ${p.requisition.requestedByName}`
                    : ""}
                </span>
              ) : null}
            </div>
          ),
        },
        { header: "Supplier", cell: (p) => p.vendorNameSnapshot },
        { header: "Warehouse", cell: (p) => p.warehouse?.name ?? "—" },
        { header: "PO Date", cell: (p) => formatDate(p.poDate) },
        { header: "Expected", cell: (p) => formatDate(p.expectedDeliveryDate) },
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
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (p) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {p.status === "DRAFT" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(p, "submit")}
                >
                  Submit
                </Button>
              ) : null}
              {p.status === "PENDING_APPROVAL" && canApprove ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(p, "approve")}
                >
                  Approve
                </Button>
              ) : null}
              {p.status === "APPROVED" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(p, "send")}
                >
                  Mark Sent
                </Button>
              ) : null}
              {["SENT", "PARTIALLY_RECEIVED"].includes(p.status) && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(
                      purchasesAwarePath(
                        pathname,
                        "goods-receipts",
                        "/scm/procurement/goods-receipts",
                        `fromPo=${p.id}`,
                      ),
                    )
                  }
                >
                  Receive Goods
                </Button>
              ) : null}
              {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"].includes(
                p.status,
              ) && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm({ po: p, action: "cancel" })}
                >
                  Cancel
                </Button>
              ) : null}
              {["RECEIVED", "PARTIALLY_RECEIVED"].includes(p.status) &&
              canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm({ po: p, action: "close" })}
                >
                  Close
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete"
                  aria-label="Delete purchase order"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="h-4 w-4 text-error-600" />
                </Button>
              ) : null}
            </div>
          ),
        },
      ]}
    >
      <PurchaseOrderForm
        open={formOpen && (!fromQuotationId || quotation.data !== undefined)}
        onClose={closeForm}
        fromQuotation={fromQuotationId ? (quotation.data ?? null) : null}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.action === "close"
            ? "Close purchase order?"
            : "Cancel purchase order?"
        }
        description={
          confirm?.action === "close"
            ? `Close ${confirm.po.poNumber}? Any quantity still unreceived is released from incoming stock.`
            : `Cancel ${confirm?.po.poNumber ?? ""}? Incoming stock raised by this PO is released.`
        }
        confirmText={confirm?.action === "close" ? "Close PO" : "Cancel PO"}
        variant="destructive"
        onConfirm={async () => {
          if (confirm) await run(confirm.po, confirm.action);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete purchase order?"
        description={`Permanently delete ${deleting?.poNumber ?? ""}? Every goods receipt received against it is deleted too and its stock is reversed. This cannot be undone.`}
        confirmText="Delete PO"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            const result = await remove.mutateAsync(deleting.id);
            toast({
              title: result.receiptsRemoved
                ? `Purchase order and ${result.receiptsRemoved} goods receipt(s) deleted`
                : "Purchase order deleted",
              variant: "success",
            });
          } catch (err) {
            toast({
              title: errorText(err, "Failed to delete purchase order"),
              variant: "error",
            });
          }
          setDeleting(null);
        }}
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.poNumber ?? ""}
        status={viewing?.status ?? ""}
        fields={[
          ["Supplier", viewing?.vendorNameSnapshot],
          ["GSTIN", viewing?.vendorGstinSnapshot],
          ["Warehouse", viewing?.warehouse?.name],
          ["PO date", formatDate(viewing?.poDate)],
          ["Expected delivery", formatDate(viewing?.expectedDeliveryDate)],
          ["Payment terms", viewing?.paymentTerms],
          [
            "Source requisition",
            viewing?.requisition?.requisitionNumber ??
              viewing?.requisitionNumber,
          ],
          ["Quotation", viewing?.quotation?.quotationNumber],
          ["RFQ", viewing?.rfq?.rfqNumber],
          ["Subtotal", formatMoney(viewing?.subtotal, viewing?.currency)],
          ["Tax", formatMoney(viewing?.taxAmount, viewing?.currency)],
          ["Freight", formatMoney(viewing?.freight, viewing?.currency)],
          ["Total", formatMoney(viewing?.total, viewing?.currency)],
          ["Approved by", viewing?.approvedByName],
          ["Receipts", viewing?._count?.receipts],
        ]}
        lineRows={viewing?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          { header: "Product", cell: (i) => i.productNameSnapshot },
          { header: "UOM", cell: (i) => i.uom },
          {
            header: "Ordered",
            align: "right",
            cell: (i) => formatQty(i.quantity),
          },
          {
            header: "Received",
            align: "right",
            cell: (i) => formatQty(i.receivedQuantity),
          },
          {
            header: "Unit Price",
            align: "right",
            cell: (i) => formatMoney(i.unitPrice, viewing?.currency),
          },
          {
            header: "Tax %",
            align: "right",
            cell: (i) => `${Number(i.taxRate)}%`,
          },
          {
            header: "Total",
            align: "right",
            cell: (i) => formatMoney(i.total, viewing?.currency),
          },
        ]}
      >
        {viewingMr.data ? (
          <div className="flex flex-col gap-1">
            <div className="text-theme-sm font-medium">
              Requisition coverage ({viewingMr.data.requisitionNumber}, all its
              POs)
            </div>
            {buildMrCoverage(viewingMr.data).lines.map((l) => (
              <div
                key={l.productId}
                className="flex justify-between text-theme-xs"
              >
                <span>{l.productName}</span>
                <span className="font-mono">
                  req {formatQty(l.requested)} · ordered {formatQty(l.ordered)}{" "}
                  · received {formatQty(l.received)}
                  {l.toOrder > 0
                    ? ` · ${formatQty(l.toOrder)} still to order`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </ScmDetailDialog>
    </ScmListView>
  );
}
