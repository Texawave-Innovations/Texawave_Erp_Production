"use client";

import type { ScmTransfer } from "@texawave-erp/api-types";
import { TRANSFER_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { ArrowLeftRight, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useWarehouseOptions } from "../../shared/masters";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateTransfer,
  useDeleteTransfer,
  useTransferAction,
  useTransfers,
} from "../hooks";

type Action = "approve" | "dispatch" | "receive" | "cancel";

const SUCCESS: Record<Action, string> = {
  approve: "Transfer approved",
  dispatch: "Transfer marked in transit — source stock reduced",
  receive: "Transfer received — destination stock increased",
  cancel: "Transfer cancelled",
};

/** Legacy `ScmTransfers`: REQUESTED -> APPROVED -> IN_TRANSIT (posts
 * TRANSFER_OUT) -> RECEIVED (posts TRANSFER_IN). Destination stock only
 * increases once a transfer is received. */
export function TransfersView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const canApprove = usePermission("scm.inventory.approve");
  const warehouses = useWarehouseOptions();
  const create = useCreateTransfer();
  const act = useTransferAction();
  const deleteTransfer = useDeleteTransfer();
  const [deleting, setDeleting] = useState<ScmTransfer | null>(null);

  const query = useTransfers({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  async function run(t: ScmTransfer, action: Action) {
    try {
      await act.mutateAsync({ id: t.id, action });
      toast({ title: SUCCESS[action], variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${action} transfer`),
        variant: "error",
      });
    }
  }

  const whOptions = (warehouses.data ?? []).filter(
    (w) => w.status === "Active",
  );

  return (
    <ScmListView<ScmTransfer>
      title="Transfers"
      description="Warehouse-to-warehouse stock transfers. Destination stock only increases once a transfer is marked Received."
      icon={ArrowLeftRight}
      noun="transfers"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(t) => String(t.id)}
      actions={
        canWrite ? (
          <Button
            size="sm"
            className="gap-2"
            disabled={whOptions.length < 2}
            title={
              whOptions.length < 2
                ? "At least two active warehouses are required"
                : undefined
            }
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Request Transfer
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by transfer number...",
      }}
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
            {TRANSFER_STATUSES.map((s) => (
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
      emptyTitle="No transfers yet"
      emptyDescription="Request a transfer to move stock between two warehouses."
      columns={[
        {
          header: "Transfer #",
          cell: (t) => (
            <span className="font-mono text-theme-xs">{t.transferNumber}</span>
          ),
        },
        { header: "Product", cell: (t) => t.product?.name ?? "—" },
        { header: "From", cell: (t) => t.sourceWarehouse?.name ?? "—" },
        { header: "To", cell: (t) => t.destinationWarehouse?.name ?? "—" },
        {
          header: "Quantity",
          align: "right",
          cell: (t) => formatQty(t.quantity),
        },
        { header: "Requested", cell: (t) => formatDateTime(t.createdAt) },
        {
          header: "Status",
          cell: (t) => (
            <StatusBadge
              label={formatStatusLabel(t.status)}
              colorToken={scmStatusToken(t.status)}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (t) => (
            <div className="flex flex-wrap justify-end gap-1">
              {t.status === "REQUESTED" && canApprove ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(t, "approve")}
                >
                  Approve
                </Button>
              ) : null}
              {t.status === "APPROVED" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(t, "dispatch")}
                >
                  Dispatch
                </Button>
              ) : null}
              {t.status === "IN_TRANSIT" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(t, "receive")}
                >
                  Receive
                </Button>
              ) : null}
              {["DRAFT", "REQUESTED", "APPROVED"].includes(t.status) &&
              canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(t, "cancel")}
                >
                  Cancel
                </Button>
              ) : null}
              {canWrite ? (
                <ScmDeleteButton
                  label="Delete transfer"
                  onClick={() => setDeleting(t)}
                />
              ) : null}
            </div>
          ),
        },
      ]}
    >
      <ScmDeleteDialog<ScmTransfer>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete transfer?"
        describe={(t) =>
          `Delete transfer ${t.transferNumber} (${formatQty(t.quantity)} × ${t.product?.name ?? "item"})? This cannot be undone. Blocked once it has dispatched or been received — a posted stock move can't be deleted, only reversed with a fresh adjustment.`
        }
        confirmText="Delete transfer"
        run={(t) => deleteTransfer.mutateAsync(t.id)}
        successMessage="Transfer deleted"
        errorFallback="Failed to delete transfer"
      />
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Request Transfer"
        submitLabel="Request Transfer"
        fields={[
          {
            name: "productId",
            label: "Product",
            type: "product",
            required: true,
            span: 2,
          },
          {
            name: "sourceWarehouseId",
            label: "Source Warehouse",
            type: "warehouse",
            required: true,
          },
          {
            name: "destinationWarehouseId",
            label: "Destination Warehouse",
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
            placeholder: "Optional",
          },
        ]}
        validate={(v) =>
          v.sourceWarehouseId !== "" &&
          v.sourceWarehouseId === v.destinationWarehouseId
            ? {
                destinationWarehouseId:
                  "Source and destination warehouse must differ",
              }
            : null
        }
        onSubmit={async (v) => {
          try {
            await create.mutateAsync({
              productId: v.productId as number,
              sourceWarehouseId: v.sourceWarehouseId as number,
              destinationWarehouseId: v.destinationWarehouseId as number,
              quantity: v.quantity as number,
              notes: v.notes as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create transfer"));
          }
          toast({ title: "Transfer requested", variant: "success" });
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
