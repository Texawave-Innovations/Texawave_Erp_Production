"use client";

import type { Putaway, PutawayItem } from "@texawave-erp/api-types";
import { PUTAWAY_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  DataTable,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { PackagePlus, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
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
  useAddPutawayLine,
  useCreatePutaway,
  useDeletePutaway,
  usePutaway,
  usePutawayAction,
  usePutaways,
  usePutawaySources,
  useRecordPutawayItem,
} from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
/** Legacy `ScmPutaway`: puts received stock away into bins. */
export function PutawaysView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const deletingRowRemove = useDeletePutaway();
  const [deletingRow, setDeletingRow] = useState<Putaway | null>(null);
  const create = useCreatePutaway();
  const detail = usePutaway(viewingId);
  const query = usePutaways({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  return (
    <ScmListView<Putaway>
      title="Put-away"
      description="Put received stock away into bin locations."
      icon={PackagePlus}
      noun="put-aways"
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
            New Put-away
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by put-away or GRN number...",
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
            {PUTAWAY_STATUSES.map((s) => (
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
      emptyTitle="No put-aways yet"
      emptyDescription="Create a put-away from a completed goods receipt, or an ad-hoc one."
      columns={[
        {
          header: "Put-away #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.putawayNumber}</span>
          ),
        },
        { header: "Warehouse", cell: (r) => r.warehouse?.name ?? "—" },
        { header: "Source GRN", cell: (r) => r.grnNumber ?? "Ad-hoc" },
        { header: "Lines", align: "right", cell: (r) => r.items.length },
        {
          header: "Put away",
          align: "right",
          cell: (r) =>
            `${formatQty(r.items.reduce((s, i) => s + Number(i.putAwayQuantity), 0))} / ${formatQty(
              r.items.reduce((s, i) => s + Number(i.quantity), 0),
            )}`,
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
                  label="Delete put-away"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<Putaway>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete put-away?"
        describe={(r) =>
          `Permanently delete ${r.putawayNumber}? This cannot be undone. A completed put-away has already assigned stock to a bin and cannot be deleted.`
        }
        confirmText="Delete put-away"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Put-away deleted"
        errorFallback="Failed to delete put-away"
      />
      <CreatePutawayForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (input) => {
          let created: Putaway;
          try {
            created = await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create put-away"));
          }
          toast({
            title: `${created.putawayNumber} created`,
            variant: "success",
          });
          setFormOpen(false);
          setViewingId(created.id);
        }}
      />
      <PutawayDetailDialog
        putaway={detail.data ?? null}
        onClose={() => setViewingId(null)}
      />
    </ScmListView>
  );
}

function CreatePutawayForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { warehouseId: number; grnId?: number }) => Promise<void>;
}) {
  const warehouses = useWarehouseOptions();
  const sources = usePutawaySources();
  const [warehouseId, setWarehouseId] = useState("");
  const [grnId, setGrnId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eligible = (sources.data ?? []).filter(
    (s) => !warehouseId || String(s.warehouseId) === warehouseId,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!warehouseId) return setError("Select a warehouse");
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        warehouseId: Number(warehouseId),
        ...(grnId ? { grnId: Number(grnId) } : {}),
      });
    } catch (err) {
      setError(errorText(err, "Failed to create put-away"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScmPanel open={open} onClose={onClose} title="New Put-away" size="md">
      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Select
            aria-label="Warehouse"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setGrnId("");
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
          <Select
            aria-label="Source GRN"
            value={grnId}
            onChange={(e) => setGrnId(e.target.value)}
          >
            <option value="">Ad-hoc (no source GRN)</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grnNumber} — {s.vendorNameSnapshot}
              </option>
            ))}
          </Select>
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
              Create Put-away
            </Button>
          </div>
        </form>
      ) : null}
    </ScmPanel>
  );
}

function PutawayDetailDialog({
  putaway,
  onClose,
}: {
  putaway: Putaway | null;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState<PutawayItem | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = usePermission("scm.warehouse.write");
  const action = usePutawayAction();

  function closeAll() {
    setRecording(null);
    setAddingLine(false);
    onClose();
  }

  async function run(a: "start" | "cancel") {
    if (!putaway) return;
    setErr(null);
    setBusy(true);
    try {
      await action.mutateAsync({ id: putaway.id, action: a });
    } catch (e) {
      setErr(errorText(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScmPanel
        open={putaway !== null}
        onClose={closeAll}
        title={putaway?.putawayNumber ?? "Put-away"}
        size="2xl"
        className="sm:max-w-4xl"
      >
        {putaway ? (
          <div className="flex flex-col gap-4">
            <div>
              <StatusBadge
                label={formatStatusLabel(putaway.status)}
                colorToken={scmStatusToken(putaway.status)}
              />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <div>
                <dt className="text-theme-xs uppercase text-gray-500">
                  Warehouse
                </dt>
                <dd className="text-theme-sm">
                  {putaway.warehouse?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs uppercase text-gray-500">
                  Source GRN
                </dt>
                <dd className="text-theme-sm">
                  {putaway.grnNumber ?? "Ad-hoc"}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs uppercase text-gray-500">
                  Started
                </dt>
                <dd className="text-theme-sm">
                  {formatDateTime(putaway.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs uppercase text-gray-500">
                  Completed
                </dt>
                <dd className="text-theme-sm">
                  {formatDateTime(putaway.completedAt)}
                </dd>
              </div>
            </dl>
            <DataTable<PutawayItem>
              caption="Lines"
              columns={[
                {
                  header: "Product",
                  cell: (i) => `${i.productName} (${i.productCode})`,
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: (i) => formatQty(i.quantity),
                },
                {
                  header: "Put away",
                  align: "right",
                  cell: (i) => formatQty(i.putAwayQuantity),
                },
                {
                  header: "Actions",
                  headerClassName: "text-right",
                  className: "text-right",
                  cell: (i) =>
                    putaway.status === "IN_PROGRESS" &&
                    canWrite &&
                    Number(i.putAwayQuantity) < Number(i.quantity) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecording(i)}
                      >
                        Put Away
                      </Button>
                    ) : null,
                },
              ]}
              rows={putaway.items}
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
              {putaway.status === "PENDING" && canWrite ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setAddingLine(true)}
                  >
                    Add Line
                  </Button>
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() => void run("start")}
                  >
                    Start
                  </Button>
                </>
              ) : null}
              {["PENDING", "IN_PROGRESS"].includes(putaway.status) &&
              canWrite ? (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void run("cancel")}
                >
                  Cancel
                </Button>
              ) : null}
              <Button variant="secondary" onClick={closeAll} disabled={busy}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </ScmPanel>

      <RecordItemDialog
        putaway={putaway}
        item={recording}
        onClose={() => setRecording(null)}
      />
      <AddLineDialog
        putaway={putaway}
        open={addingLine}
        onClose={() => setAddingLine(false)}
      />
    </>
  );
}

function RecordItemDialog({
  putaway,
  item,
  onClose,
}: {
  putaway: Putaway | null;
  item: PutawayItem | null;
  onClose: () => void;
}) {
  const locations = useLocationOptions(putaway?.warehouseId ?? null);
  // Stock is put away into active bins (a rack holds bins, not stock itself).
  const binOptions = (locations.data ?? []).filter(
    (l) => l.status === "Active" && (l.locationType ?? "BIN") === "BIN",
  );
  const record = useRecordPutawayItem();
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = item
    ? Number(item.quantity) - Number(item.putAwayQuantity)
    : 0;

  return (
    <ScmPanel
      open={item !== null && putaway !== null}
      onClose={onClose}
      title={item ? `Put away — ${item.productName}` : ""}
      size="md"
    >
      {item && putaway ? (
        <div className="flex flex-col gap-4">
          <p className="text-theme-sm text-gray-500">
            {formatQty(remaining)} of {formatQty(item.quantity)} still to put
            away.
          </p>
          <Select
            aria-label="Destination location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">Select destination</option>
            {binOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationCode ?? l.binCode}
                {l.locationName ? ` — ${l.locationName}` : ""}
              </option>
            ))}
          </Select>
          {binOptions.length === 0 ? (
            <p className="text-theme-xs text-warning-600">
              No bin locations exist yet — create one under Warehouse →
              Locations first.
            </p>
          ) : null}
          <Input
            type="number"
            min={0}
            max={remaining}
            step={0.001}
            aria-label="Quantity"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!locationId) return setErr("Select a destination location");
                if (!(Number(quantity) > 0))
                  return setErr("Quantity must be greater than zero");
                setErr(null);
                setBusy(true);
                try {
                  await record.mutateAsync({
                    id: putaway.id,
                    itemId: item.id,
                    input: {
                      quantity: Number(quantity),
                      destinationLocationId: Number(locationId),
                    },
                  });
                  onClose();
                } catch (e) {
                  setErr(errorText(e, "Failed to record"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Put Away
            </Button>
          </div>
        </div>
      ) : null}
    </ScmPanel>
  );
}

function AddLineDialog({
  putaway,
  open,
  onClose,
}: {
  putaway: Putaway | null;
  open: boolean;
  onClose: () => void;
}) {
  const addLine = useAddPutawayLine();
  const [productId, setProductId] = useState<number | "">("");
  const [quantity, setQuantity] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <ScmPanel
      open={open && putaway !== null}
      onClose={onClose}
      title="Add Line"
      size="md"
    >
      {open && putaway ? (
        <div className="flex flex-col gap-4">
          <ProductSelect value={productId} onChange={setProductId} />
          <Input
            type="number"
            min={0}
            step={0.001}
            aria-label="Quantity"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!productId) return setErr("Select a product");
                if (!(Number(quantity) > 0))
                  return setErr("Quantity must be greater than zero");
                setErr(null);
                setBusy(true);
                try {
                  await addLine.mutateAsync({
                    id: putaway.id,
                    input: { productId, quantity: Number(quantity) },
                  });
                  onClose();
                } catch (e) {
                  setErr(errorText(e, "Failed to add line"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add Line
            </Button>
          </div>
        </div>
      ) : null}
    </ScmPanel>
  );
}
