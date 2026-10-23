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
import { FileText, GitCompareArrows, Plus, Trash2 } from "lucide-react";
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
  useDeleteRequisition,
  useRequisitionAction,
  useRequisitions,
  useUpdateRequisition,
} from "../hooks";
import { buildMrCoverage, type MrCoverage } from "../mr-coverage";
import { RequisitionForm } from "./RequisitionForm";

const ORDER_STATUS_LABEL: Record<
  MrCoverage["status"],
  { label: string; token: ReturnType<typeof scmStatusToken> }
> = {
  NOT_ORDERED: { label: "Not ordered", token: scmStatusToken("DRAFT") },
  PARTIALLY_ORDERED: {
    label: "Partially ordered",
    token: scmStatusToken("PARTIALLY_RECEIVED"),
  },
  FULLY_ORDERED: { label: "Fully ordered", token: scmStatusToken("RECEIVED") },
};

/** Legacy `ScmPurchaseRequisitions` (renamed Material Requisitions). */
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
  const [tracing, setTracing] = useState<PurchaseRequisition | null>(null);
  const [deleting, setDeleting] = useState<PurchaseRequisition | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.procurement.write");
  const canApprove = usePermission("scm.procurement.approve");
  const create = useCreateRequisition();
  const update = useUpdateRequisition();
  const act = useRequisitionAction();
  const remove = useDeleteRequisition();

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
      title="Material Requisitions"
      description="Raise and approve internal material requisitions before sourcing suppliers."
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
        placeholder: "Search by MR number, requester, PO number, supplier...",
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
      emptyTitle="No material requisitions yet"
      emptyDescription="Raise a requisition to request items before sourcing suppliers."
      columns={[
        {
          header: "MR #",
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
          header: "Purchase Order(s)",
          cell: (r) => <MrPoCell mr={r} onOpen={() => setTracing(r)} />,
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
              <Button
                variant="ghost"
                size="sm"
                title="Trace MR → PO → receipt"
                aria-label="Trace MR to PO to receipt"
                onClick={() => setTracing(r)}
              >
                <GitCompareArrows className="h-4 w-4" />
              </Button>
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
              {canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete"
                  aria-label="Delete requisition"
                  onClick={() => setDeleting(r)}
                >
                  <Trash2 className="h-4 w-4 text-error-600" />
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
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete requisition?"
        description={`Delete ${deleting?.requisitionNumber ?? ""}? This cannot be undone. Purchase orders raised from it are left untouched and keep its number.`}
        confirmText="Delete requisition"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast({ title: "Requisition deleted", variant: "success" });
          } catch (err) {
            toast({
              title: errorText(err, "Failed to delete requisition"),
              variant: "error",
            });
          }
          setDeleting(null);
        }}
      />
      {tracing ? (
        <MrTraceDialog
          mr={tracing}
          onClose={() => setTracing(null)}
          onOpenPos={() =>
            router.push(
              `/scm/procurement/purchase-orders?requisitionId=${tracing.id}&mr=${encodeURIComponent(tracing.requisitionNumber)}`,
            )
          }
        />
      ) : null}
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

function MrPoCell({
  mr,
  onOpen,
}: {
  mr: PurchaseRequisition;
  onOpen: () => void;
}) {
  const linked = mr.purchaseOrders ?? [];
  if (linked.length === 0) {
    return <span className="text-theme-xs text-gray-400">—</span>;
  }
  const coverage = buildMrCoverage(mr);
  return (
    <button
      type="button"
      className="flex flex-col gap-0.5 text-left"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {linked.map((po) => (
        <span key={po.id} className="text-theme-xs">
          <span className="font-mono">{po.poNumber}</span> ·{" "}
          {po.vendorNameSnapshot || "—"} · {formatStatusLabel(po.status)}
        </span>
      ))}
      <span className="text-theme-xs text-gray-500">
        Ordered {formatQty(coverage.orderedTotal)}/
        {formatQty(coverage.requestedTotal)} · Received{" "}
        {formatQty(coverage.receivedTotal)}
      </span>
    </button>
  );
}

function MrTraceDialog({
  mr,
  onClose,
  onOpenPos,
}: {
  mr: PurchaseRequisition;
  onClose: () => void;
  onOpenPos: () => void;
}) {
  const coverage = buildMrCoverage(mr);
  const tone = ORDER_STATUS_LABEL[coverage.status];
  return (
    <ScmDetailDialog
      open
      onClose={onClose}
      title={`MR → PO → Receipt — ${mr.requisitionNumber}`}
      status={mr.status}
      fields={[
        ["Requested by", mr.requestedByName],
        ["Request date", formatDate(mr.requestDate)],
        [
          "Order coverage",
          <StatusBadge key="cov" label={tone.label} colorToken={tone.token} />,
        ],
      ]}
      lineCaption="Coverage"
      lineRows={coverage.lines}
      getLineKey={(l) => String(l.productId)}
      lineColumns={[
        { header: "Item", cell: (l) => l.productName },
        {
          header: "Requested",
          align: "right",
          cell: (l) => `${formatQty(l.requested)} ${l.uom}`,
        },
        {
          header: "Ordered (PO)",
          align: "right",
          cell: (l) => formatQty(l.ordered),
        },
        {
          header: "Received (GR)",
          align: "right",
          cell: (l) => formatQty(l.received),
        },
        {
          header: "Still to order",
          align: "right",
          cell: (l) => formatQty(l.toOrder),
        },
      ]}
    >
      <div className="flex flex-col gap-2">
        <div className="text-theme-sm font-medium">
          Purchase orders raised from this requisition
        </div>
        {(mr.purchaseOrders ?? []).length === 0 ? (
          <p className="text-theme-sm italic text-gray-500">
            None yet — pick this requisition under &quot;Link Material
            Requisition&quot; when creating a purchase order.
          </p>
        ) : (
          <>
            {(mr.purchaseOrders ?? []).map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <span className="text-theme-sm">
                  <span className="font-mono">{po.poNumber}</span>{" "}
                  <span className="text-gray-500">
                    — {po.vendorNameSnapshot}
                  </span>
                </span>
                <StatusBadge
                  label={formatStatusLabel(po.status)}
                  colorToken={scmStatusToken(po.status)}
                />
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={onOpenPos}>
                Open Purchase Orders
              </Button>
            </div>
          </>
        )}
      </div>
    </ScmDetailDialog>
  );
}
