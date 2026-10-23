"use client";

import type {
  ScmLocation,
  ScmWarehouse,
  WarehouseMovement,
} from "@texawave-erp/api-types";
import { MOVEMENT_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  DataTable,
  Input,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import {
  ProductSelect,
  useLocationOptions,
  useWarehouseOptions,
} from "../../shared/masters";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateMovement,
  useDeleteMovement,
  useMovement,
  useMovementAction,
  useMovements,
} from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
interface LineDraft {
  productId: number | "";
  quantity: string;
  sourceLocationId: number | "";
  destinationLocationId: number | "";
}
const blankLine = (): LineDraft => ({
  productId: "",
  quantity: "",
  sourceLocationId: "",
  destinationLocationId: "",
});

/** Location cell: code, then its name, its rack (via the real parent link)
 * and its warehouse (name + code). */
function LocationCell({
  locationId,
  locations,
  warehouses,
}: {
  locationId: number | null | undefined;
  locations: ReadonlyMap<number, ScmLocation>;
  warehouses: ReadonlyMap<number, ScmWarehouse>;
}) {
  const loc = locationId ? locations.get(locationId) : undefined;
  if (!loc) return <span className="font-mono text-theme-xs">–</span>;
  let rack = (loc.locationType ?? "BIN") === "RACK" ? loc : undefined;
  for (
    let cur = loc, guard = 0;
    !rack && cur.parentLocationId && guard < 6;
    guard++
  ) {
    const parent = locations.get(cur.parentLocationId);
    if (!parent) break;
    if ((parent.locationType ?? "BIN") === "RACK") rack = parent;
    cur = parent;
  }
  const rackText = rack
    ? `Rack ${rack.locationName ?? rack.binCode}`
    : loc.rack
      ? `Rack ${loc.rack}`
      : "";
  const wh = warehouses.get(loc.warehouseId);
  return (
    <div className="flex flex-col">
      <span className="font-mono text-theme-xs">
        {loc.locationCode ?? loc.binCode}
      </span>
      {loc.locationName ? (
        <span className="text-theme-xs text-gray-500">{loc.locationName}</span>
      ) : null}
      {rackText ? (
        <span className="text-theme-xs text-gray-500">{rackText}</span>
      ) : null}
      <span className="text-theme-xs text-gray-500">
        {wh ? `${wh.name} (${wh.code})` : "Unknown Warehouse"}
      </span>
    </div>
  );
}

/** Legacy `ScmWarehouseMovements` (renamed Stock Movements): bin-to-bin
 * transfers inside one warehouse. */
export function MovementsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const deletingRowRemove = useDeleteMovement();
  const [deletingRow, setDeletingRow] = useState<WarehouseMovement | null>(
    null,
  );
  const create = useCreateMovement();
  const detail = useMovement(viewingId);
  const allLocations = useLocationOptions();
  const allWarehouses = useWarehouseOptions();
  const locationById = new Map((allLocations.data ?? []).map((l) => [l.id, l]));
  const warehouseById = new Map(
    (allWarehouses.data ?? []).map((w) => [w.id, w]),
  );
  const query = useMovements({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  return (
    <ScmListView<WarehouseMovement>
      title="Stock Movements"
      description="Move stock between bins or racks. No ledger entry is posted — total on-hand is unchanged, only the location changes."
      icon={ArrowLeftRight}
      noun="movements"
      readPermission="scm.warehouse.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Movement
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by movement number...",
      }}
      filters={
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
            {MOVEMENT_STATUSES.map((s) => (
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
      emptyTitle="No movements yet"
      emptyDescription="Request a movement to relocate stock inside a warehouse."
      columns={[
        {
          header: "Movement",
          cell: (r) => (
            <div className="flex flex-col gap-1">
              {/* Every line has both a source and a destination bin, so a
                  movement here is always an exchange between bins. */}
              <StatusBadge label="Exchanged" colorToken="brand" />
              <span className="font-mono text-[11px] text-gray-500">
                {r.movementNumber}
              </span>
            </div>
          ),
        },
        ...(SCM_CLIENT_DEMO
          ? []
          : [
              {
                header: "Warehouse",
                cell: (r: WarehouseMovement) => r.warehouse?.name ?? "—",
              },
            ]),
        {
          header: "Product",
          cell: (r) => (
            <div className="flex flex-col">
              <span className="font-medium">
                {r.items[0]?.productName ?? "—"}
              </span>
              <span className="font-mono text-theme-xs text-gray-500">
                {r.items[0]?.productCode}
                {r.items.length > 1 ? ` +${r.items.length - 1} more` : ""}
              </span>
            </div>
          ),
        },
        {
          header: "Source",
          cell: (r) => (
            <LocationCell
              locationId={r.items[0]?.sourceLocationId}
              locations={locationById}
              warehouses={warehouseById}
            />
          ),
        },
        {
          header: "Destination",
          cell: (r) => (
            <LocationCell
              locationId={r.items[0]?.destinationLocationId}
              locations={locationById}
              warehouses={warehouseById}
            />
          ),
        },
        {
          header: "Quantity",
          align: "right",
          cell: (r) =>
            formatQty(r.items.reduce((sum, i) => sum + Number(i.quantity), 0)),
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
        { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
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
                  label="Delete movement"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<WarehouseMovement>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete movement?"
        describe={(r) =>
          `Permanently delete ${r.movementNumber}? This cannot be undone. A completed movement has already moved stock between bins and cannot be deleted.`
        }
        confirmText="Delete movement"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Movement deleted"
        errorFallback="Failed to delete movement"
      />
      <CreateMovementForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (input) => {
          let created: WarehouseMovement;
          try {
            created = await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create movement"));
          }
          toast({
            title: `${created.movementNumber} created`,
            variant: "success",
          });
          setFormOpen(false);
          setViewingId(created.id);
        }}
      />
      <MovementDetailDialog
        movement={detail.data ?? null}
        onClose={() => setViewingId(null)}
      />
    </ScmListView>
  );
}

function CreateMovementForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    warehouseId: number;
    items: {
      productId: number;
      quantity: number;
      sourceLocationId: number;
      destinationLocationId: number;
    }[];
    notes?: string | undefined;
  }) => Promise<void>;
}) {
  const warehouses = useWarehouseOptions();
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const locations = useLocationOptions(warehouseId || null);
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(idx: number, next: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...next } : l)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!warehouseId) return setError("Select a warehouse");
    const filled = lines.filter((l) => l.productId && l.quantity);
    if (filled.length === 0) return setError("Add at least one line");
    for (const l of filled) {
      if (!l.sourceLocationId || !l.destinationLocationId) {
        return setError("Every line needs a source and destination location");
      }
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        warehouseId,
        items: filled.map((l) => ({
          productId: l.productId as number,
          quantity: Number(l.quantity),
          sourceLocationId: l.sourceLocationId as number,
          destinationLocationId: l.destinationLocationId as number,
        })),
        notes: notes || undefined,
      });
    } catch (err) {
      setError(errorText(err, "Failed to create movement"));
    } finally {
      setBusy(false);
    }
  }

  const locOptions = (locations.data ?? []).filter(
    (l) => l.status === "Active",
  );

  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title="New Movement"
      size="2xl"
      className="sm:max-w-3xl"
    >
      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Select
            aria-label="Warehouse"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value ? Number(e.target.value) : "");
              setLines([blankLine()]);
            }}
          >
            <option value="">Select warehouse</option>
            {(warehouses.data ?? [])
              .filter((w) => w.status === "Active")
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </Select>
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            {lines.map((l, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_6rem_1fr_1fr_auto]"
              >
                <ProductSelect
                  aria-label={`Product for line ${idx + 1}`}
                  value={l.productId}
                  onChange={(v) => patch(idx, { productId: v })}
                  disabled={!warehouseId}
                />
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  aria-label={`Quantity for line ${idx + 1}`}
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) => patch(idx, { quantity: e.target.value })}
                />
                <Select
                  aria-label={`Source location for line ${idx + 1}`}
                  value={l.sourceLocationId}
                  onChange={(e) =>
                    patch(idx, {
                      sourceLocationId: e.target.value
                        ? Number(e.target.value)
                        : "",
                    })
                  }
                >
                  <option value="">From</option>
                  {locOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.locationCode ?? loc.binCode}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={`Destination location for line ${idx + 1}`}
                  value={l.destinationLocationId}
                  onChange={(e) =>
                    patch(idx, {
                      destinationLocationId: e.target.value
                        ? Number(e.target.value)
                        : "",
                    })
                  }
                >
                  <option value="">To</option>
                  {locOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.locationCode ?? loc.binCode}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove line ${idx + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((ls) => ls.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => setLines((ls) => [...ls, blankLine()])}
                disabled={!warehouseId}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
          </div>
          <Textarea
            aria-label="Notes"
            placeholder="Notes (optional)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error ? (
            <p
              role="alert"
              className="text-theme-xs text-error-600 dark:text-error-400"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create Movement
            </Button>
          </div>
        </form>
      ) : null}
    </ScmPanel>
  );
}

function MovementDetailDialog({
  movement,
  onClose,
}: {
  movement: WarehouseMovement | null;
  onClose: () => void;
}) {
  const canWrite = usePermission("scm.warehouse.write");
  const action = useMovementAction();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(a: "submit" | "approve" | "complete" | "cancel") {
    if (!movement) return;
    setErr(null);
    setBusy(true);
    try {
      await action.mutateAsync({ id: movement.id, action: a });
    } catch (e) {
      setErr(errorText(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScmPanel
      open={movement !== null}
      onClose={onClose}
      title={movement?.movementNumber ?? "Movement"}
      size="2xl"
      className="sm:max-w-4xl"
    >
      {movement ? (
        <div className="flex flex-col gap-4">
          <div>
            <StatusBadge
              label={formatStatusLabel(movement.status)}
              colorToken={scmStatusToken(movement.status)}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            <div>
              <dt className="text-theme-xs uppercase text-gray-500">
                Warehouse
              </dt>
              <dd className="text-theme-sm">
                {movement.warehouse?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-theme-xs uppercase text-gray-500">
                Approved
              </dt>
              <dd className="text-theme-sm">
                {formatDateTime(movement.approvedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-theme-xs uppercase text-gray-500">
                Completed
              </dt>
              <dd className="text-theme-sm">
                {formatDateTime(movement.completedAt)}
              </dd>
            </div>
            {movement.cancellationReason ? (
              <div>
                <dt className="text-theme-xs uppercase text-gray-500">
                  Cancellation reason
                </dt>
                <dd className="text-theme-sm">{movement.cancellationReason}</dd>
              </div>
            ) : null}
          </dl>
          <DataTable
            caption="Lines"
            columns={[
              {
                header: "Product",
                cell: (i: WarehouseMovement["items"][number]) =>
                  `${i.productName} (${i.productCode})`,
              },
              {
                header: "Quantity",
                align: "right",
                cell: (i: WarehouseMovement["items"][number]) =>
                  formatQty(i.quantity),
              },
            ]}
            rows={movement.items}
            getRowKey={(i) => String(i.id)}
          />
          {err ? (
            <p
              role="alert"
              className="text-theme-xs text-error-600 dark:text-error-400"
            >
              {err}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {canWrite && movement.status === "DRAFT" ? (
              <Button loading={busy} onClick={() => void run("submit")}>
                Submit
              </Button>
            ) : null}
            {canWrite && movement.status === "REQUESTED" ? (
              <Button loading={busy} onClick={() => void run("approve")}>
                Approve
              </Button>
            ) : null}
            {canWrite && movement.status === "APPROVED" ? (
              <Button loading={busy} onClick={() => void run("complete")}>
                Complete
              </Button>
            ) : null}
            {canWrite &&
            ["DRAFT", "REQUESTED", "APPROVED", "IN_PROGRESS"].includes(
              movement.status,
            ) ? (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void run("cancel")}
              >
                Cancel
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </ScmPanel>
  );
}
