"use client";

import type { ScmBatch } from "@texawave-erp/api-types";
import { BATCH_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useBatches,
  useCreateBatch,
  useDeleteBatch,
  useSetBatchStatus,
} from "../hooks";

/** Legacy `ScmBatches`: batch/lot register. Manual registration records
 * metadata at quantity 0; quantity accrues through GRN receipts. */
export function BatchesView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const create = useCreateBatch();
  const setBatchStatus = useSetBatchStatus();
  const remove = useDeleteBatch();
  const [deleting, setDeleting] = useState<ScmBatch | null>(null);

  const query = useBatches({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  return (
    <ScmListView<ScmBatch>
      title="Batches"
      description="Batch/lot tracked stock with manufacturing and expiry dates."
      icon={Layers}
      noun="batches"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(b) => String(b.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Register Batch
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by batch number...",
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
            {BATCH_STATUSES.map((s) => (
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
      emptyTitle="No batches yet"
      emptyDescription="Batches are created by GRN receipts of batch-tracked products, or registered manually."
      columns={[
        {
          header: "Batch #",
          cell: (b) => (
            <span className="font-mono text-theme-xs">{b.batchNumber}</span>
          ),
        },
        { header: "Product", cell: (b) => b.product?.name ?? "—" },
        { header: "Warehouse", cell: (b) => b.warehouse?.name ?? "—" },
        {
          header: "Manufactured",
          cell: (b) => formatDate(b.manufacturingDate),
        },
        { header: "Expiry", cell: (b) => formatDate(b.expiryDate) },
        {
          header: "Quantity",
          align: "right",
          cell: (b) => formatQty(b.quantity),
        },
        {
          header: "Status",
          cell: (b) =>
            canWrite ? (
              <Select
                aria-label={`Status of batch ${b.batchNumber}`}
                value={b.status}
                onChange={(e) => {
                  setBatchStatus
                    .mutateAsync({ id: b.id, status: e.target.value })
                    .then(() =>
                      toast({
                        title: "Batch status updated",
                        variant: "success",
                      }),
                    )
                    .catch((err: unknown) =>
                      toast({
                        title: errorText(err, "Failed to update batch"),
                        variant: "error",
                      }),
                    );
                }}
              >
                {BATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </Select>
            ) : (
              <StatusBadge
                label={formatStatusLabel(b.status)}
                colorToken={scmStatusToken(b.status)}
              />
            ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (b) =>
            canWrite ? (
              <div className="flex justify-end gap-1">
                <ScmDeleteButton
                  label="Delete batch"
                  onClick={() => setDeleting(b)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<ScmBatch>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete batch?"
        describe={(b) =>
          `Delete batch ${b.batchNumber} (${b.product?.name ?? ""})? This cannot be undone. Blocked automatically while it still holds any quantity.`
        }
        confirmText="Delete batch"
        run={(b) => remove.mutateAsync(b.id)}
        successMessage="Batch deleted"
        errorFallback="Failed to delete batch"
      />
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register Batch"
        submitLabel="Register Batch"
        fields={[
          {
            name: "batchNumber",
            label: "Batch Number",
            type: "text",
            required: true,
            upper: true,
            mono: true,
          },
          {
            name: "productId",
            label: "Product",
            type: "product",
            required: true,
          },
          {
            name: "warehouseId",
            label: "Warehouse",
            type: "warehouse",
            required: true,
          },
          {
            name: "manufacturingDate",
            label: "Manufacturing Date",
            type: "date",
          },
          { name: "expiryDate", label: "Expiry Date", type: "date" },
        ]}
        validate={(v) =>
          v.manufacturingDate &&
          v.expiryDate &&
          String(v.expiryDate) < String(v.manufacturingDate)
            ? {
                expiryDate:
                  "Expiry date cannot be before the manufacturing date",
              }
            : null
        }
        onSubmit={async (v) => {
          try {
            await create.mutateAsync({
              batchNumber: v.batchNumber as string,
              productId: v.productId as number,
              warehouseId: v.warehouseId as number,
              manufacturingDate: v.manufacturingDate as string | undefined,
              expiryDate: v.expiryDate as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create batch"));
          }
          toast({ title: "Batch registered", variant: "success" });
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
