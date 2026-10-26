"use client";

import type { Picking } from "@texawave-erp/api-types";
import { PICK_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { ListChecks } from "lucide-react";
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
import { useDeletePicking, usePickingAction, usePickings } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
/** Legacy `ScmPicking`: work through a pick list and record picked quantity. */
export function PickingsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState<Picking | null>(null);
  const [assigning, setAssigning] = useState<Picking | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.fulfillment.write");
  const deletingRowRemove = useDeletePicking();
  const [deletingRow, setDeletingRow] = useState<Picking | null>(null);
  const act = usePickingAction();
  const query = usePickings({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  async function run(p: Picking, action: "start" | "cancel", ok: string) {
    try {
      await act.mutateAsync({ id: p.id, action });
      toast({ title: ok, variant: "success" });
    } catch (err) {
      toast({ title: errorText(err, "Action failed"), variant: "error" });
    }
  }

  return (
    <ScmListView<Picking>
      title="Picking"
      description="Pick lists generated from reserved fulfillments."
      icon={ListChecks}
      noun="pick lists"
      readPermission="scm.fulfillment.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by pick list, order or picker...",
      }}
      filters={
        <div className="w-full lg:w-48">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {PICK_STATUSES.map((s) => (
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
      emptyTitle="No pick lists yet"
      emptyDescription="Create a pick list from a reserved fulfillment."
      columns={[
        {
          header: "Pick #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.pickNumber}</span>
          ),
        },
        { header: "Sales Order", cell: (r) => r.salesOrderNumber },
        {
          header: "Fulfillment",
          cell: (r) => r.fulfillment?.fulfillmentNumber ?? "—",
        },
        { header: "Warehouse", cell: (r) => r.warehouse?.name ?? "—" },
        { header: "Picker", cell: (r) => r.pickerName ?? "Unassigned" },
        {
          header: "Picked / Requested",
          align: "right",
          cell: (r) =>
            `${formatQty(r.items.reduce((s, i) => s + Number(i.pickedQuantity), 0))} / ${formatQty(
              r.items.reduce((s, i) => s + Number(i.requestedQuantity), 0),
            )}`,
        },
        { header: "Completed", cell: (r) => formatDateTime(r.completedAt) },
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
              <div className="flex flex-wrap justify-end gap-1">
                {["PENDING", "ASSIGNED"].includes(r.status) ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssigning(r)}
                    >
                      Assign
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void run(r, "start", "Picking started")}
                    >
                      Start
                    </Button>
                  </>
                ) : null}
                {["IN_PROGRESS", "PARTIALLY_PICKED"].includes(r.status) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecording(r)}
                  >
                    Record Pick
                  </Button>
                ) : null}
                {[
                  "PENDING",
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "PARTIALLY_PICKED",
                ].includes(r.status) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void run(r, "cancel", "Pick list cancelled")}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null,
        },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete pick list"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<Picking>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete pick list?"
        describe={(r) =>
          `Permanently delete pick list ${r.pickNumber}? This cannot be undone. Blocked automatically if a packing already references it.`
        }
        confirmText="Delete pick list"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Pick list deleted"
        errorFallback="Failed to delete pick list"
      />
      <ScmFormDialog
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title={`Assign ${assigning?.pickNumber ?? ""}`}
        submitLabel="Assign Picker"
        fields={[
          {
            name: "pickerName",
            label: "Picker name",
            type: "text",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          if (!assigning) return;
          try {
            await act.mutateAsync({
              id: assigning.id,
              action: "assign",
              body: { pickerName: v.pickerName },
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to assign picker"));
          }
          toast({ title: "Picker assigned", variant: "success" });
          setAssigning(null);
        }}
      />
      <RecordPickDialog
        picking={recording}
        onClose={() => setRecording(null)}
        onSubmit={async (items, closeShort) => {
          if (!recording) return;
          try {
            await act.mutateAsync({
              id: recording.id,
              action: "record",
              body: { items, closeShort },
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to record pick"));
          }
          toast({ title: "Pick recorded", variant: "success" });
          setRecording(null);
        }}
      />
    </ScmListView>
  );
}

function RecordPickDialog({
  picking,
  onClose,
  onSubmit,
}: {
  picking: Picking | null;
  onClose: () => void;
  onSubmit: (
    items: { pickingItemId: number; pickedQuantity: number }[],
    closeShort: boolean,
  ) => Promise<void>;
}) {
  return (
    <ScmPanel
      open={picking !== null}
      onClose={onClose}
      title={`Record pick — ${picking?.pickNumber ?? ""}`}
      size="lg"
    >
      {picking ? (
        <RecordBody
          key={picking.id}
          picking={picking}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function RecordBody({
  picking,
  onClose,
  onSubmit,
}: {
  picking: Picking;
  onClose: () => void;
  onSubmit: (
    items: { pickingItemId: number; pickedQuantity: number }[],
    closeShort: boolean,
  ) => Promise<void>;
}) {
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      picking.items.map((i) => [i.id, String(Number(i.pickedQuantity))]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(closeShort: boolean) {
    for (const i of picking.items) {
      const n = Number(qty[i.id]);
      if (!Number.isFinite(n) || n < 0 || n > Number(i.requestedQuantity)) {
        setError(
          `${i.productName}: enter 0 to ${formatQty(i.requestedQuantity)}`,
        );
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(
        picking.items.map((i) => ({
          pickingItemId: i.id,
          pickedQuantity: Number(qty[i.id]),
        })),
        closeShort,
      );
    } catch (err) {
      setError(errorText(err, "Failed to record pick"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {picking.items.map((i) => (
          <div
            key={i.id}
            className="grid grid-cols-[1fr_auto_8rem] items-center gap-3"
          >
            <span className="text-theme-sm">
              {i.productName}{" "}
              <span className="text-gray-500">({i.productCode})</span>
            </span>
            <span className="text-theme-xs text-gray-500">
              of {formatQty(i.requestedQuantity)}
            </span>
            <Input
              type="number"
              min={0}
              max={Number(i.requestedQuantity)}
              step={0.001}
              aria-label={`Picked quantity for ${i.productName}`}
              value={qty[i.id] ?? ""}
              onChange={(e) =>
                setQty((q) => ({ ...q, [i.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => void submit(true)}
          disabled={busy}
        >
          Save &amp; Close Short
        </Button>
        <Button onClick={() => void submit(false)} loading={busy}>
          Save Progress
        </Button>
      </div>
    </div>
  );
}
