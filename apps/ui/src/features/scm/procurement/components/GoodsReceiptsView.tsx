"use client";

import type {
  CreateGoodsReceiptInput,
  GoodsReceipt,
} from "@texawave-erp/api-types";
import { Button, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { PackageCheck, Plus } from "lucide-react";
import Link from "next/link";
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
import { withoutQueryParams } from "../../shared/purchases-aware-path";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateGoodsReceipt,
  useDeleteGoodsReceipt,
  useGoodsReceipt,
  useGoodsReceipts,
} from "../hooks";
import { GoodsReceiptForm } from "./GoodsReceiptForm";

/** Legacy `ScmGrn`. `?fromPo=<id>` opens the receive form for that PO. */
export function GoodsReceiptsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromPo = params.get("fromPo");
  const c = useListControls();
  const [formOpen, setFormOpen] = useState(Boolean(fromPo));
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<GoodsReceipt | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const create = useCreateGoodsReceipt();
  const remove = useDeleteGoodsReceipt();
  const detail = useGoodsReceipt(viewingId);
  const query = useGoodsReceipts({ page: c.page, limit: c.pageSize, q: c.q });

  function closeForm() {
    setFormOpen(false);
    if (fromPo)
      router.replace(withoutQueryParams(pathname, params, ["fromPo"]));
  }

  async function save(input: CreateGoodsReceiptInput) {
    let created: GoodsReceipt;
    try {
      created = await create.mutateAsync(input);
    } catch (err) {
      throw new Error(errorText(err, "Failed to post goods receipt"));
    }
    toast({
      title: `${created.grnNumber} posted — stock updated`,
      variant: "success",
    });
    closeForm();
  }

  const grn = detail.data;

  return (
    <ScmListView<GoodsReceipt>
      title="Goods Receipts"
      description="Goods receipt notes recording accepted and rejected quantities. Posting a GRN updates stock in the same step."
      icon={PackageCheck}
      noun="goods receipts"
      readPermission="scm.procurement.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(g) => String(g.id)}
      onRowClick={(g) => setViewingId(g.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Receive Goods
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by GRN, PO or supplier...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No goods receipts yet"
      emptyDescription="Receive goods against a sent purchase order."
      columns={[
        {
          header: "GRN #",
          cell: (g) => (
            <span className="font-mono text-theme-xs">{g.grnNumber}</span>
          ),
        },
        {
          header: "Purchase Order",
          cell: (g) => g.purchaseOrder?.poNumber ?? "—",
        },
        { header: "Supplier", cell: (g) => g.vendorNameSnapshot },
        { header: "Warehouse", cell: (g) => g.warehouse?.name ?? "—" },
        { header: "Receipt Date", cell: (g) => formatDate(g.receiptDate) },
        { header: "Lines", align: "right", cell: (g) => g.items.length },
        {
          header: "Accepted",
          align: "right",
          cell: (g) =>
            formatQty(
              g.items.reduce((s, i) => s + Number(i.acceptedQuantity), 0),
            ),
        },
        { header: "Received By", cell: (g) => g.receivedByName },
        {
          header: "Status",
          cell: (g) => (
            <StatusBadge
              label={formatStatusLabel(g.status)}
              colorToken={scmStatusToken(g.status)}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (g) =>
            canWrite ? (
              <div
                className="flex justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete goods receipt"
                  onClick={() => setDeleting(g)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <GoodsReceiptForm
        open={formOpen}
        onClose={closeForm}
        initialPoId={fromPo ? Number(fromPo) : null}
        onSubmit={save}
      />
      <ScmDeleteDialog<GoodsReceipt>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete goods receipt?"
        describe={(g) =>
          `Permanently delete ${g.grnNumber}? The stock it posted is taken back out with an offsetting ledger entry and the purchase order's received quantity is restored. This cannot be undone.`
        }
        confirmText="Delete receipt"
        run={(g) => remove.mutateAsync(g.id)}
        successMessage="Goods receipt deleted"
        errorFallback="Failed to delete goods receipt"
      />
      <ScmDetailDialog
        open={viewingId !== null}
        onClose={() => setViewingId(null)}
        title={grn?.grnNumber ?? "Goods receipt"}
        status={grn?.status ?? ""}
        fields={[
          ["Purchase order", grn?.purchaseOrder?.poNumber],
          ["Supplier", grn?.vendorNameSnapshot],
          ["Warehouse", grn?.warehouse?.name],
          ["Receipt date", formatDate(grn?.receiptDate)],
          ["Received by", grn?.receivedByName],
          [
            "PO status",
            grn?.purchaseOrder
              ? formatStatusLabel(grn.purchaseOrder.status)
              : "—",
          ],
          ["Notes", grn?.notes],
          ["Ledger entries", grn?.ledgerEntries?.length],
        ]}
        lineRows={grn?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          { header: "Product", cell: (i) => i.productNameSnapshot },
          {
            header: "Ordered",
            align: "right",
            cell: (i) => formatQty(i.orderedQuantity),
          },
          {
            header: "Received",
            align: "right",
            cell: (i) => formatQty(i.receivingQuantity),
          },
          {
            header: "Rejected",
            align: "right",
            cell: (i) => formatQty(i.rejectedQuantity),
          },
          {
            header: "Accepted",
            align: "right",
            cell: (i) => formatQty(i.acceptedQuantity),
          },
          { header: "Batch", cell: (i) => i.batchNumber ?? "—" },
          {
            header: "Serials",
            cell: (i) =>
              i.serialNumbers.length ? i.serialNumbers.join(", ") : "—",
          },
          {
            header: "Unit Cost",
            align: "right",
            cell: (i) => formatMoney(i.unitCost),
          },
        ]}
      >
        {grn?.ledgerEntries?.length ? (
          <p className="text-theme-sm">
            <Link
              href="/scm/inventory/ledger"
              className="text-brand-700 hover:underline dark:text-brand-300"
            >
              {grn.ledgerEntries.length} stock ledger entr
              {grn.ledgerEntries.length === 1 ? "y" : "ies"} posted →
            </Link>
          </p>
        ) : null}
      </ScmDetailDialog>
    </ScmListView>
  );
}
