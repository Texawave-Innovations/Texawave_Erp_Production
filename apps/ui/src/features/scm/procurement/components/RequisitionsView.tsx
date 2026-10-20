"use client";

import type {
  PurchaseRequisition,
  RequisitionPayload,
} from "@texawave-erp/api-types";
import { REQUISITION_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { FileText, Plus } from "lucide-react";
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
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateRequisition,
  useRequisitionAction,
  useRequisitions,
  useUpdateRequisition,
} from "../hooks";
import { RequisitionForm } from "./RequisitionForm";

/** Legacy `ScmPurchaseRequisitions`. */
export function RequisitionsView() {
  const router = useRouter();
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequisition | null>(null);
  const [viewing, setViewing] = useState<PurchaseRequisition | null>(null);
  const [rejecting, setRejecting] = useState<PurchaseRequisition | null>(null);
  const [cancelling, setCancelling] = useState<PurchaseRequisition | null>(
    null,
  );
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const canApprove = usePermission("scm.procurement.approve");
  const create = useCreateRequisition();
  const update = useUpdateRequisition();
  const act = useRequisitionAction();

  const query = useRequisitions({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status ? (status as PurchaseRequisition["status"]) : undefined,
    from: from || undefined,
    to: to || undefined,
  });

  async function run(
    r: PurchaseRequisition,
    action: "submit" | "approve" | "cancel",
    success: string,
  ) {
    try {
      await act.mutateAsync({ id: r.id, action });
      toast({ title: success, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} requisition`),
        variant: "error",
      });
    }
  }

  async function save(payload: RequisitionPayload) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: payload });
      else await create.mutateAsync(payload);
    } catch (err) {
      throw new Error(errorText(err, "Failed to save requisition"));
    }
    toast({
      title: editing ? "Requisition updated" : "Requisition saved as draft",
      variant: "success",
    });
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <ScmListView<PurchaseRequisition>
      title="Purchase Requisitions"
      description="Raise and approve internal purchase requisitions before sourcing suppliers."
      icon={FileText}
      noun="requisitions"
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
            New Requisition
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by number, requester, purpose...",
      }}
      filters={
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
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
              {REQUISITION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </Select>
          </div>
          <Input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              c.setPage(1);
            }}
          />
          <Input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              c.setPage(1);
            }}
          />
        </div>
      }
      hasActiveFilters={Boolean(c.search || status || from || to)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
        setFrom("");
        setTo("");
      }}
      emptyTitle="No purchase requisitions yet"
      emptyDescription="Raise a requisition to request items before sourcing suppliers."
      columns={[
        {
          header: "PR #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.requisitionNumber}
            </span>
          ),
        },
        {
          header: "Requester",
          cell: (r) => (
            <div className="flex flex-col">
              <span>{r.requestedByName}</span>
              {r.department ? (
                <span className="text-theme-xs text-gray-500">
                  {r.department}
                </span>
              ) : null}
            </div>
          ),
        },
        { header: "Request Date", cell: (r) => formatDate(r.requestDate) },
        { header: "Priority", cell: (r) => r.priority },
        { header: "Items", align: "right", cell: (r) => r.items.length },
        {
          header: "Est. Total",
          align: "right",
          cell: (r) => formatMoney(r.total),
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
          cell: (r) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {r.status === "DRAFT" && canWrite ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(r);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void run(
                        r,
                        "submit",
                        "Requisition submitted for approval",
                      )
                    }
                  >
                    Submit
                  </Button>
                </>
              ) : null}
              {r.status === "SUBMITTED" && canApprove ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void run(r, "approve", "Requisition approved")
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejecting(r)}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              {r.status === "APPROVED" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(`/scm/procurement/rfqs?fromRequisition=${r.id}`)
                  }
                >
                  Create RFQ
                </Button>
              ) : null}
              {["DRAFT", "SUBMITTED"].includes(r.status) && canWrite ? (
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
      <RequisitionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        requisition={editing}
        onSubmit={save}
      />
      <ScmFormDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.requisitionNumber ?? ""}`}
        submitLabel="Reject Requisition"
        fields={[
          {
            name: "reason",
            label: "Rejection reason",
            type: "textarea",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          if (!rejecting) return;
          try {
            await act.mutateAsync({
              id: rejecting.id,
              action: "reject",
              reason: v.reason as string,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to reject requisition"));
          }
          toast({ title: "Requisition rejected", variant: "success" });
          setRejecting(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel requisition?"
        description={`Cancel requisition ${cancelling?.requisitionNumber ?? ""}? This cannot be undone.`}
        confirmText="Cancel requisition"
        variant="destructive"
        onConfirm={async () => {
          if (cancelling)
            await run(cancelling, "cancel", "Requisition cancelled");
          setCancelling(null);
        }}
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.requisitionNumber ?? ""}
        status={viewing?.status ?? ""}
        fields={[
          ["Requested by", viewing?.requestedByName],
          ["Department", viewing?.department],
          ["Request date", formatDate(viewing?.requestDate)],
          ["Required by", formatDate(viewing?.requiredDate)],
          ["Priority", viewing?.priority],
          ["Warehouse", viewing?.warehouse?.name],
          ["Purpose", viewing?.purpose],
          ["Total", formatMoney(viewing?.total)],
          ["Approved by", viewing?.approvedByName],
          ["Approved at", formatDate(viewing?.approvedAt)],
          ["Rejection reason", viewing?.rejectionReason],
          ["Notes", viewing?.notes],
        ]}
        lineRows={viewing?.items ?? []}
        getLineKey={(i) => String(i.id)}
        lineColumns={[
          { header: "Product", cell: (i) => i.productNameSnapshot },
          { header: "UOM", cell: (i) => i.uom },
          { header: "Qty", align: "right", cell: (i) => formatQty(i.quantity) },
          {
            header: "Est. Unit Cost",
            align: "right",
            cell: (i) => formatMoney(i.estimatedUnitCost),
          },
          {
            header: "Est. Total",
            align: "right",
            cell: (i) => formatMoney(i.estimatedTotal),
          },
          { header: "Required By", cell: (i) => formatDate(i.requiredDate) },
        ]}
      />
    </ScmListView>
  );
}
