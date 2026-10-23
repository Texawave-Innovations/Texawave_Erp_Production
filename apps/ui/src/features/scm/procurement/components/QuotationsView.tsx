"use client";

import type {
  CreateQuotationInput,
  SupplierQuotation,
} from "@texawave-erp/api-types";
import { SCM_QUOTATION_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus, ReceiptText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  useCreateQuotation,
  useQuotationAction,
  useQuotations,
} from "../hooks";
import { QuotationForm } from "./QuotationForm";

/** Legacy `ScmSupplierQuotations`. `?fromRfq=<id>` opens the form for that RFQ. */
export function QuotationsView() {
  const router = useRouter();
  const params = useSearchParams();
  const fromRfq = params.get("fromRfq");
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(fromRfq));
  const [viewing, setViewing] = useState<SupplierQuotation | null>(null);
  const [rejecting, setRejecting] = useState<SupplierQuotation | null>(null);
  const [cancelling, setCancelling] = useState<SupplierQuotation | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const create = useCreateQuotation();
  const act = useQuotationAction();

  const query = useQuotations({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status ? (status as SupplierQuotation["status"]) : undefined,
  });

  async function run(
    q: SupplierQuotation,
    action: "reject" | "cancel",
    success: string,
  ) {
    try {
      await act.mutateAsync({ id: q.id, action });
      toast({ title: success, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} quotation`),
        variant: "error",
      });
    }
  }

  function closeForm() {
    setFormOpen(false);
    if (fromRfq) router.replace("/scm/procurement/quotations");
  }

  async function save(input: CreateQuotationInput) {
    let created: SupplierQuotation;
    try {
      created = await create.mutateAsync(input);
    } catch (err) {
      throw new Error(errorText(err, "Failed to save quotation"));
    }
    toast({
      title: `Quotation ${created.quotationNumber} recorded`,
      variant: "success",
    });
    closeForm();
  }

  return (
    <ScmListView<SupplierQuotation>
      title="Supplier Quotations"
      description="Record supplier responses to RFQs."
      icon={ReceiptText}
      noun="quotations"
      readPermission="scm.procurement.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(q) => String(q.id)}
      onRowClick={setViewing}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Quotation
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by number, supplier or RFQ...",
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
            {SCM_QUOTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
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
      emptyTitle="No supplier quotations yet"
      emptyDescription="Record a supplier's response to an issued RFQ."
      columns={[
        {
          header: "Quotation #",
          cell: (q) => (
            <span className="font-mono text-theme-xs">{q.quotationNumber}</span>
          ),
        },
        { header: "RFQ", cell: (q) => q.rfq?.rfqNumber ?? "—" },
        { header: "Supplier", cell: (q) => q.vendorNameSnapshot },
        { header: "Date", cell: (q) => formatDate(q.quotationDate) },
        { header: "Valid Until", cell: (q) => formatDate(q.validUntil) },
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
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (q) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(`/scm/procurement/comparison?rfqId=${q.rfqId}`)
                }
              >
                Compare
              </Button>
              {q.status === "SELECTED" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/scm/procurement/purchase-orders?fromQuotation=${q.id}`,
                    )
                  }
                >
                  Create PO
                </Button>
              ) : null}
              {["RECEIVED", "SHORTLISTED"].includes(q.status) && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejecting(q)}
                >
                  Reject
                </Button>
              ) : null}
              {!["CANCELLED", "SELECTED"].includes(q.status) && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelling(q)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          ),
        },
      ]}
    >
      <QuotationForm
        open={formOpen}
        onClose={closeForm}
        initialRfqId={fromRfq ? Number(fromRfq) : null}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject quotation?"
        description={`Reject ${rejecting?.quotationNumber ?? ""} from ${rejecting?.vendorNameSnapshot ?? ""}?`}
        confirmText="Reject"
        variant="destructive"
        onConfirm={async () => {
          if (rejecting) await run(rejecting, "reject", "Quotation rejected");
          setRejecting(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel quotation?"
        description={`Cancel ${cancelling?.quotationNumber ?? ""}? This cannot be undone.`}
        confirmText="Cancel quotation"
        variant="destructive"
        onConfirm={async () => {
          if (cancelling)
            await run(cancelling, "cancel", "Quotation cancelled");
          setCancelling(null);
        }}
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.quotationNumber ?? ""}
        status={viewing?.status ?? ""}
        fields={[
          ["RFQ", viewing?.rfq?.rfqNumber],
          ["Supplier", viewing?.vendorNameSnapshot],
          ["GSTIN", viewing?.vendorGstinSnapshot],
          ["Supplier quote #", viewing?.supplierQuotationNumber],
          ["Date", formatDate(viewing?.quotationDate)],
          ["Valid until", formatDate(viewing?.validUntil)],
          ["Payment terms", viewing?.paymentTerms],
          ["Delivery terms", viewing?.deliveryTerms],
          ["Subtotal", formatMoney(viewing?.subtotal, viewing?.currency)],
          ["Tax", formatMoney(viewing?.tax, viewing?.currency)],
          ["Freight", formatMoney(viewing?.freight, viewing?.currency)],
          ["Total", formatMoney(viewing?.total, viewing?.currency)],
        ]}
        lineRows={viewing?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          { header: "Product", cell: (i) => i.productNameSnapshot },
          { header: "Qty", align: "right", cell: (i) => formatQty(i.quantity) },
          {
            header: "Unit Price",
            align: "right",
            cell: (i) => formatMoney(i.unitPrice, viewing?.currency),
          },
          {
            header: "Disc.",
            align: "right",
            cell: (i) => formatMoney(i.discount, viewing?.currency),
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
          {
            header: "Promised",
            cell: (i) => formatDate(i.promisedDeliveryDate),
          },
        ]}
      />
    </ScmListView>
  );
}
