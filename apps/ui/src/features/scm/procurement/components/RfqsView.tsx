"use client";

import type { CreateRfqInput, Rfq } from "@texawave-erp/api-types";
import { RFQ_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Plus, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import {
  purchasesAwarePath,
  withoutQueryParams,
} from "../../shared/purchases-aware-path";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateRfq,
  useDeleteRfq,
  useRequisition,
  useRfqAction,
  useRfqs,
} from "../hooks";
import { RfqForm } from "./RfqForm";

const RESPONSE = ["RESPONSES_PENDING", "PARTIALLY_RESPONDED", "RESPONDED"];

/** Legacy `ScmRfqs`. `?fromRequisition=<id>` opens the create form prefilled
 * from an approved requisition. */
export function RfqsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromId = params.get("fromRequisition");
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(fromId));
  const [viewing, setViewing] = useState<Rfq | null>(null);
  const [cancelling, setCancelling] = useState<Rfq | null>(null);
  const [deleting, setDeleting] = useState<Rfq | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const requisition = useRequisition(fromId ? Number(fromId) : null);
  const create = useCreateRfq();
  const act = useRfqAction();
  const remove = useDeleteRfq();

  const query = useRfqs({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status ? (status as Rfq["status"]) : undefined,
  });

  async function run(
    r: Rfq,
    action: "issue" | "close" | "cancel",
    success: string,
  ) {
    try {
      await act.mutateAsync({ id: r.id, action });
      toast({ title: success, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} RFQ`),
        variant: "error",
      });
    }
  }

  function closeForm() {
    setFormOpen(false);
    if (fromId) {
      router.replace(withoutQueryParams(pathname, params, ["fromRequisition"]));
    }
  }

  async function save(input: CreateRfqInput) {
    let created: Rfq;
    try {
      created = await create.mutateAsync(input);
    } catch (err) {
      throw new Error(errorText(err, "Failed to create RFQ"));
    }
    toast({
      title: `RFQ ${created.rfqNumber} created as draft`,
      variant: "success",
    });
    closeForm();
  }

  return (
    <ScmListView<Rfq>
      title="RFQs"
      description="Request quotations from suppliers against an approved requisition."
      icon={Send}
      noun="RFQs"
      readPermission="scm.procurement.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={setViewing}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New RFQ
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by RFQ number or supplier...",
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
            {RFQ_STATUSES.map((s) => (
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
      emptyTitle="No RFQs yet"
      emptyDescription="Create an RFQ from an approved requisition, or from scratch."
      columns={[
        {
          header: "RFQ #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.rfqNumber}</span>
          ),
        },
        {
          header: "Requisition",
          cell: (r) => r.requisition?.requisitionNumber ?? "—",
        },
        {
          header: "Suppliers",
          cell: (r) => (
            <span
              title={r.suppliers.map((s) => s.supplierNameSnapshot).join(", ")}
            >
              {r.suppliers.length} invited
            </span>
          ),
        },
        {
          header: "Quotations",
          align: "right",
          cell: (r) => r._count?.quotations ?? 0,
        },
        { header: "Issue Date", cell: (r) => formatDate(r.issueDate) },
        { header: "Due", cell: (r) => formatDate(r.responseDueDate) },
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
            canWrite ? (
              <div
                className="flex flex-wrap justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {r.status === "DRAFT" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void run(r, "issue", "RFQ issued to suppliers")
                    }
                  >
                    Issue
                  </Button>
                ) : null}
                {RESPONSE.includes(r.status) ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(
                          purchasesAwarePath(
                            pathname,
                            "quotations",
                            "/scm/procurement/quotations",
                            `fromRfq=${r.id}`,
                          ),
                        )
                      }
                    >
                      Record Quotation
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void run(r, "close", "RFQ closed")}
                    >
                      Close
                    </Button>
                  </>
                ) : null}
                {["DRAFT", "RESPONSES_PENDING", "PARTIALLY_RESPONDED"].includes(
                  r.status,
                ) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelling(r)}
                  >
                    Cancel
                  </Button>
                ) : null}
                <ScmDeleteButton
                  label="Delete RFQ"
                  onClick={() => setDeleting(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <RfqForm
        open={formOpen && (!fromId || requisition.data !== undefined)}
        onClose={closeForm}
        fromRequisition={fromId ? (requisition.data ?? null) : null}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel RFQ?"
        description={`Cancel RFQ ${cancelling?.rfqNumber ?? ""}? Suppliers can no longer quote against it.`}
        confirmText="Cancel RFQ"
        variant="destructive"
        onConfirm={async () => {
          if (cancelling) await run(cancelling, "cancel", "RFQ cancelled");
          setCancelling(null);
        }}
      />
      <ScmDeleteDialog<Rfq>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete RFQ?"
        describe={(r) =>
          `Delete ${r.rfqNumber}? This cannot be undone. Blocked automatically if any supplier quotation exists against it.`
        }
        confirmText="Delete RFQ"
        run={(r) => remove.mutateAsync(r.id)}
        successMessage="RFQ deleted"
        errorFallback="Failed to delete RFQ"
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.rfqNumber ?? ""}
        status={viewing?.status ?? ""}
        fields={[
          ["Requisition", viewing?.requisition?.requisitionNumber],
          ["Warehouse", viewing?.warehouse?.name],
          ["Issue date", formatDate(viewing?.issueDate)],
          ["Response due", formatDate(viewing?.responseDueDate)],
          ["Currency", viewing?.currency],
          ["Payment terms", viewing?.paymentTerms],
          ["Delivery terms", viewing?.deliveryTerms],
          ["Delivery location", viewing?.deliveryLocation],
          [
            "Suppliers",
            viewing?.suppliers.map((s) => s.supplierNameSnapshot).join(", "),
          ],
          ["Notes", viewing?.notes],
        ]}
        lineRows={viewing?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          { header: "Product", cell: (i) => i.productNameSnapshot },
          { header: "UOM", cell: (i) => i.uom },
          { header: "Qty", align: "right", cell: (i) => formatQty(i.quantity) },
          { header: "Notes", cell: (i) => i.notes ?? "—" },
        ]}
      />
    </ScmListView>
  );
}
