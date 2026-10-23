"use client";

import type { ScmSerial } from "@texawave-erp/api-types";
import { SERIAL_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Hash, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateSerials,
  useDeleteSerial,
  useSerials,
  useSetSerialStatus,
} from "../hooks";

/** Legacy `ScmSerialNumbers`: serial-number register with bulk add (one per
 * line or comma separated). Serial numbers are unique across the
 * organization. */
export function SerialsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const create = useCreateSerials();
  const setSerialStatus = useSetSerialStatus();
  const remove = useDeleteSerial();
  const [deleting, setDeleting] = useState<ScmSerial | null>(null);

  const query = useSerials({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  return (
    <ScmListView<ScmSerial>
      title="Serial Numbers"
      description="Serial-number tracked units and their current status."
      icon={Hash}
      noun="serial numbers"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(s) => String(s.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Serial Numbers
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by serial number...",
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
            {SERIAL_STATUSES.map((s) => (
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
      emptyTitle="No serial numbers yet"
      emptyDescription="Serial numbers are created by GRN receipts of serial-tracked products, or added manually."
      columns={[
        {
          header: "Serial #",
          cell: (s) => (
            <span className="font-mono text-theme-xs">{s.serialNumber}</span>
          ),
        },
        { header: "Product", cell: (s) => s.product?.name ?? "—" },
        { header: "Warehouse", cell: (s) => s.warehouse?.name ?? "—" },
        { header: "Reference", cell: (s) => s.currentReference ?? "—" },
        { header: "Created", cell: (s) => formatDate(s.createdAt) },
        {
          header: "Status",
          cell: (s) =>
            canWrite ? (
              <Select
                aria-label={`Status of serial ${s.serialNumber}`}
                value={s.status}
                onChange={(e) => {
                  setSerialStatus
                    .mutateAsync({ id: s.id, status: e.target.value })
                    .then(() =>
                      toast({
                        title: "Serial status updated",
                        variant: "success",
                      }),
                    )
                    .catch((err: unknown) =>
                      toast({
                        title: errorText(err, "Failed to update serial"),
                        variant: "error",
                      }),
                    );
                }}
              >
                {SERIAL_STATUSES.map((x) => (
                  <option key={x} value={x}>
                    {formatStatusLabel(x)}
                  </option>
                ))}
              </Select>
            ) : (
              <StatusBadge
                label={formatStatusLabel(s.status)}
                colorToken={scmStatusToken(s.status)}
              />
            ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (s) =>
            canWrite ? (
              <div className="flex justify-end gap-1">
                <ScmDeleteButton
                  label="Delete serial"
                  onClick={() => setDeleting(s)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<ScmSerial>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete serial number?"
        describe={(s) =>
          `Delete serial ${s.serialNumber}? This cannot be undone. Only Available serials can be deleted.`
        }
        confirmText="Delete serial"
        run={(s) => remove.mutateAsync(s.id)}
        successMessage="Serial number deleted"
        errorFallback="Failed to delete serial number"
      />
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add Serial Numbers"
        submitLabel="Create"
        fields={[
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
            name: "serials",
            label: "Serial Numbers",
            type: "textarea",
            required: true,
            span: 2,
            hint: "One per line, or comma separated",
          },
        ]}
        onSubmit={async (v) => {
          const list = String(v.serials ?? "")
            .split(/[\n,]+/)
            .map((x) => x.trim())
            .filter(Boolean);
          if (list.length === 0)
            throw new Error("Enter at least one serial number");
          if (new Set(list).size !== list.length)
            throw new Error("Duplicate serial numbers entered");
          try {
            const res = await create.mutateAsync({
              productId: v.productId as number,
              warehouseId: v.warehouseId as number,
              serialNumbers: list,
            });
            toast({
              title: `${res.created} serial number(s) created`,
              variant: "success",
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create serial numbers"));
          }
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
