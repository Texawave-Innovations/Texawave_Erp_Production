"use client";

import type { ScmAdjustment } from "@texawave-erp/api-types";
import { ADJUSTMENT_REASONS } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useAdjustmentDecision,
  useAdjustments,
  useCreateAdjustment,
  useDeleteAdjustment,
} from "../hooks";

/** Legacy `ScmAdjustments`: manual stock corrections. Nothing moves until an
 * approver approves; an OUT adjustment is rejected by the ledger guard if it
 * would take stock negative. */
export function AdjustmentsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const canApprove = usePermission("scm.inventory.approve");
  const create = useCreateAdjustment();
  const remove = useDeleteAdjustment();
  const [deleting, setDeleting] = useState<ScmAdjustment | null>(null);
  const decide = useAdjustmentDecision();

  const query = useAdjustments({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  async function run(a: ScmAdjustment, decision: "approve" | "reject") {
    try {
      await decide.mutateAsync({ id: a.id, decision });
      toast({
        title:
          decision === "approve"
            ? "Adjustment approved and posted to the stock ledger"
            : "Adjustment rejected",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: errorText(err, `Failed to ${decision} adjustment`),
        variant: "error",
      });
    }
  }

  return (
    <ScmListView<ScmAdjustment>
      title="Adjustments"
      description="Manual stock corrections with an audited reason. Stock only changes once an adjustment is approved."
      icon={SlidersHorizontal}
      noun="adjustments"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(a) => String(a.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Adjustment
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by adjustment number...",
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
            {["PENDING", "APPROVED", "REJECTED"].map((s) => (
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
      emptyTitle="No adjustments yet"
      emptyDescription="Raise an adjustment to correct stock after a count, damage or loss."
      columns={[
        {
          header: "Adjustment #",
          cell: (a) => (
            <span className="font-mono text-theme-xs">
              {a.adjustmentNumber}
            </span>
          ),
        },
        { header: "Product", cell: (a) => a.product?.name ?? "—" },
        { header: "Warehouse", cell: (a) => a.warehouse?.name ?? "—" },
        {
          header: "Direction",
          cell: (a) => (
            <StatusBadge
              label={a.direction}
              colorToken={a.direction === "IN" ? "success" : "warning"}
            />
          ),
        },
        {
          header: "Quantity",
          align: "right",
          cell: (a) => formatQty(a.quantity),
        },
        { header: "Reason", cell: (a) => a.reason },
        { header: "Requested", cell: (a) => formatDateTime(a.createdAt) },
        {
          header: "Status",
          cell: (a) => (
            <StatusBadge
              label={formatStatusLabel(a.status)}
              colorToken={scmStatusToken(a.status)}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (a) => (
            <div className="flex justify-end gap-1">
              {a.status === "PENDING" && canApprove ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void run(a, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void run(a, "reject")}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              {canWrite ? (
                <ScmDeleteButton
                  label="Delete adjustment"
                  onClick={() => setDeleting(a)}
                />
              ) : null}
            </div>
          ),
        },
      ]}
    >
      <ScmDeleteDialog<ScmAdjustment>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete adjustment?"
        describe={(a) =>
          `Permanently delete adjustment ${a.adjustmentNumber}? This cannot be undone. An approved adjustment has already posted to the ledger and cannot be deleted.`
        }
        confirmText="Delete adjustment"
        run={(a) => remove.mutateAsync(a.id)}
        successMessage="Adjustment deleted"
        errorFallback="Failed to delete adjustment"
      />
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New Adjustment"
        submitLabel="Submit for approval"
        fields={[
          {
            name: "productId",
            label: "Product",
            type: "product",
            required: true,
            span: 2,
          },
          {
            name: "warehouseId",
            label: "Warehouse",
            type: "warehouse",
            required: true,
          },
          {
            name: "direction",
            label: "Direction",
            type: "select",
            required: true,
            options: [
              { value: "IN", label: "IN (add stock)" },
              { value: "OUT", label: "OUT (remove stock)" },
            ],
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
            name: "reason",
            label: "Reason",
            type: "select",
            required: true,
            options: ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r })),
          },
          {
            name: "notes",
            label: "Notes",
            type: "text",
            span: 2,
            placeholder: "Optional",
          },
        ]}
        initialValues={{ direction: "IN", reason: ADJUSTMENT_REASONS[0] }}
        onSubmit={async (v) => {
          try {
            await create.mutateAsync({
              productId: v.productId as number,
              warehouseId: v.warehouseId as number,
              quantity: v.quantity as number,
              direction: v.direction as "IN" | "OUT",
              reason: v.reason as ScmAdjustment["reason"],
              notes: v.notes as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create adjustment"));
          }
          toast({
            title: "Adjustment recorded, pending approval",
            variant: "success",
          });
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
