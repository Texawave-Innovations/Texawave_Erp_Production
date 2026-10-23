"use client";

import type { LocationType, ScmLocation } from "@texawave-erp/api-types";
import { CREATABLE_LOCATION_TYPES } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  ErrorState,
  PageHeader,
  Select,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Power,
  Tag,
  Trash2,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import { usePermission } from "@/hooks/usePermission";
import { buildQrPayload } from "../../barcode/codes";
import { LabelDialog } from "../../barcode/LabelDialog";
import type { BarcodeLabelProps } from "../../barcode/BarcodeLabel";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import { formatQty } from "../../shared/format";
import { useLocationOptions, useWarehouseOptions } from "../../shared/masters";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { errorText } from "../../shared/use-list-controls";
import {
  useCreateLocation,
  useDeleteLocation,
  useLocationStock,
  useUpdateLocation,
} from "../hooks";
import { LocationForm } from "./LocationForm";

type CapacityState =
  "Unconfigured" | "Available" | "Partially Occupied" | "Full";

function capacityState(capacity: number, occupied: number): CapacityState {
  if (!capacity || capacity <= 0) return "Unconfigured";
  if (occupied <= 0) return "Available";
  if (occupied >= capacity) return "Full";
  return "Partially Occupied";
}

const CAPACITY_TOKEN = {
  Unconfigured: "gray",
  Available: "success",
  "Partially Occupied": "warning",
  Full: "error",
} as const;

/** Natural sort so "F2" doesn't sort before "F10" (plain string compare
 * would): splits into text/number chunks and compares numbers numerically. */
function naturalCompare(a: string, b: string) {
  const chunk = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const ac = chunk(a);
  const bc = chunk(b);
  for (let i = 0; i < Math.max(ac.length, bc.length); i++) {
    const x = ac[i] ?? "";
    const y = bc[i] ?? "";
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
      continue;
    }
    return x < y ? -1 : 1;
  }
  return 0;
}

const codeOf = (l: ScmLocation) => l.locationCode ?? l.binCode;
const typeOf = (l: ScmLocation): LocationType => l.locationType ?? "BIN";

interface Row {
  key: string;
  loc: ScmLocation;
  isRack: boolean;
  nested: boolean;
  binCount: number;
  expanded: boolean;
  empty?: boolean;
}

/** Legacy `ScmLocations`: Rack → Bin storage locations. Racks expand to show
 * their bins; each row shows occupancy against capacity, and a location can be
 * viewed (with the stock stored in it), edited and deleted. */
export function LocationsView() {
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScmLocation | null>(null);
  const [detail, setDetail] = useState<ScmLocation | null>(null);
  const [deleting, setDeleting] = useState<ScmLocation | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [label, setLabel] = useState<BarcodeLabelProps | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const warehouses = useWarehouseOptions();
  const locationsQuery = useLocationOptions();
  const stockQuery = useLocationStock();
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const remove = useDeleteLocation();

  const locations = useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  );
  const whById = useMemo(
    () => new Map((warehouses.data ?? []).map((w) => [w.id, w])),
    [warehouses.data],
  );
  const byId = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  // Stock per location, and per location per product.
  const stock = useMemo(() => {
    const perLoc = new Map<number, number>();
    const perLocProduct = new Map<
      number,
      Map<string, { name: string; qty: number }>
    >();
    for (const r of stockQuery.data ?? []) {
      const qty = Number(r.quantity);
      if (qty <= 0) continue;
      perLoc.set(r.locationId, (perLoc.get(r.locationId) ?? 0) + qty);
      const m = perLocProduct.get(r.locationId) ?? new Map();
      const cur = m.get(r.product.productCode);
      m.set(r.product.productCode, {
        name: r.product.name,
        qty: (cur?.qty ?? 0) + qty,
      });
      perLocProduct.set(r.locationId, m);
    }
    return { perLoc, perLocProduct };
  }, [stockQuery.data]);

  // Real parent → children relationship (never inferred from a code prefix).
  const childrenByParent = useMemo(() => {
    const map = new Map<number, ScmLocation[]>();
    for (const l of locations) {
      if (!l.parentLocationId) continue;
      const arr = map.get(l.parentLocationId) ?? [];
      arr.push(l);
      map.set(l.parentLocationId, arr);
    }
    return map;
  }, [locations]);

  const descendantsOf = (id: number): ScmLocation[] => {
    const out: ScmLocation[] = [];
    const seen = new Set<number>([id]);
    const walk = (pid: number) =>
      (childrenByParent.get(pid) ?? []).forEach((c) => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        out.push(c);
        walk(c.id);
      });
    walk(id);
    return out;
  };

  const occupiedOf = (loc: ScmLocation) =>
    typeOf(loc) === "RACK"
      ? (childrenByParent.get(loc.id) ?? []).reduce(
          (s, bin) => s + (stock.perLoc.get(bin.id) ?? 0),
          stock.perLoc.get(loc.id) ?? 0,
        )
      : (stock.perLoc.get(loc.id) ?? 0);

  const whName = (id: number) => whById.get(id)?.name ?? "Unknown Warehouse";
  const whCode = (id: number) => whById.get(id)?.code ?? "—";

  const isBinUnderRack = (loc: ScmLocation) => {
    if (typeOf(loc) !== "BIN" || !loc.parentLocationId) return false;
    const parent = byId.get(loc.parentLocationId);
    return !!parent && typeOf(parent) === "RACK";
  };

  const rows = useMemo<Row[]>(() => {
    const filtered = locations.filter(
      (l) =>
        (!warehouseFilter || l.warehouseId === Number(warehouseFilter)) &&
        (!typeFilter || typeOf(l) === typeFilter),
    );
    // Top-level rows exclude bins nested directly under a rack — those render
    // indented beneath their rack (when expanded) so they are never shown twice.
    const top = (
      typeFilter === "BIN"
        ? filtered
        : filtered.filter((l) => !isBinUnderRack(l))
    ).sort(
      (a, b) =>
        naturalCompare(
          `${whName(a.warehouseId)} ${whCode(a.warehouseId)}`,
          `${whName(b.warehouseId)} ${whCode(b.warehouseId)}`,
        ) || naturalCompare(codeOf(a), codeOf(b)),
    );
    const out: Row[] = [];
    for (const loc of top) {
      const isRack = typeOf(loc) === "RACK";
      const bins = isRack
        ? (childrenByParent.get(loc.id) ?? [])
            .filter((c) => typeOf(c) === "BIN")
            .sort((a, b) => naturalCompare(codeOf(a), codeOf(b)))
        : [];
      const open = isRack && expanded.has(loc.id);
      out.push({
        key: `loc-${loc.id}`,
        loc,
        isRack,
        nested: false,
        binCount: bins.length,
        expanded: open,
      });
      if (open) {
        if (bins.length === 0) {
          out.push({
            key: `empty-${loc.id}`,
            loc,
            isRack: false,
            nested: true,
            binCount: 0,
            expanded: false,
            empty: true,
          });
        } else {
          for (const bin of bins) {
            out.push({
              key: `loc-${bin.id}`,
              loc: bin,
              isRack: false,
              nested: true,
              binCount: 0,
              expanded: false,
            });
          }
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- whName/whCode/isBinUnderRack are derived from the listed maps
  }, [
    locations,
    warehouseFilter,
    typeFilter,
    expanded,
    childrenByParent,
    byId,
    whById,
  ]);

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function toggleActive(l: ScmLocation) {
    const next = l.status === "Active" ? "Inactive" : "Active";
    try {
      await update.mutateAsync({ id: l.id, input: { status: next } });
      toast({ title: `Location marked ${next}`, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, "Failed to update location"),
        variant: "error",
      });
    }
  }

  const nestedOfDeleting = deleting ? descendantsOf(deleting.id) : [];
  const occupiedDeleting = deleting
    ? [deleting, ...nestedOfDeleting].reduce(
        (s, l) => s + (stock.perLoc.get(l.id) ?? 0),
        0,
      )
    : 0;

  const pending = locationsQuery.isPending || warehouses.isPending;
  const failed = locationsQuery.error ?? warehouses.error;

  if (pending) {
    return <TableSkeleton rowsCount={6} columnsCount={7} />;
  }
  if (failed) {
    if (failed instanceof ApiError && failed.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to locations">
          Ask an administrator for the <code>scm.warehouse.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return (
      <ErrorState
        onRetry={() => {
          void locationsQuery.refetch();
          void warehouses.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={MapPin}
        title="Locations"
        description={
          SCM_CLIENT_DEMO
            ? "Rack → Bin hierarchy for storing stock."
            : "Rack → Bin hierarchy within each warehouse."
        }
        badge={
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
            {locations.length} locations
          </span>
        }
        action={
          canWrite ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                if ((warehouses.data ?? []).length === 0) {
                  toast({
                    title:
                      "Create a warehouse first (Warehouse → Warehouses), then add locations to it.",
                    variant: "error",
                  });
                  return;
                }
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {SCM_CLIENT_DEMO ? null : (
          <div className="w-full sm:w-60">
            <Select
              aria-label="Filter by warehouse"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="">All warehouses</option>
              {(warehouses.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.code ? ` (${w.code})` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-full sm:w-40">
          {/* Zone/Shelf are no longer a selectable filter — existing Zone/Shelf
              locations still show under "All types". */}
          <Select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {CREATABLE_LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <span className="text-theme-sm text-gray-500">
          {rows.filter((r) => !r.empty && !r.nested).length} of{" "}
          {locations.length} locations
        </span>
      </div>

      <DataTable<Row>
        caption="Locations"
        rows={rows}
        getRowKey={(r) => r.key}
        onRowClick={(r) => (r.isRack ? toggleExpanded(r.loc.id) : undefined)}
        emptyState={
          <div className="py-10 text-center text-gray-500">
            No locations yet — add a rack, then its bins.
          </div>
        }
        columns={[
          {
            header: "Location Code",
            cell: (r) =>
              r.empty ? (
                <span className="pl-8 text-theme-sm italic text-gray-500">
                  No bins in this rack
                </span>
              ) : (
                <div
                  className={`flex items-center gap-1.5 ${r.nested ? "pl-6" : ""}`}
                >
                  {r.isRack ? (
                    r.expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    )
                  ) : null}
                  <span className="font-mono text-theme-xs">
                    {codeOf(r.loc)}
                  </span>
                  {r.isRack ? (
                    <span className="whitespace-nowrap text-theme-xs text-gray-500">
                      ({r.binCount} {r.binCount === 1 ? "Bin" : "Bins"})
                    </span>
                  ) : null}
                </div>
              ),
          },
          {
            header: "Warehouse",
            cell: (r) =>
              r.empty ? null : (
                <div className="flex flex-col">
                  <span className="font-medium">
                    {whName(r.loc.warehouseId)}
                  </span>
                  <span className="font-mono text-theme-xs text-gray-500">
                    {whCode(r.loc.warehouseId)}
                  </span>
                </div>
              ),
          },
          { header: "Type", cell: (r) => (r.empty ? null : typeOf(r.loc)) },
          {
            header: "Name",
            cell: (r) => (r.empty ? null : (r.loc.locationName ?? "—")),
          },
          {
            header: "Capacity",
            align: "right",
            cell: (r) => {
              if (r.empty) return null;
              const cap = Number(r.loc.capacity ?? 0);
              if (!cap) {
                return (
                  <span className="text-theme-xs text-gray-500">
                    Unconfigured
                  </span>
                );
              }
              const occupied = occupiedOf(r.loc);
              return (
                <StatusBadge
                  label={`${formatQty(occupied)}/${formatQty(cap)} ${r.loc.capacityUnit ?? ""}`.trim()}
                  colorToken={CAPACITY_TOKEN[capacityState(cap, occupied)]}
                />
              );
            },
          },
          {
            header: "Status",
            cell: (r) =>
              r.empty ? null : (
                <StatusBadge
                  label={r.loc.status}
                  colorToken={r.loc.status === "Active" ? "success" : "gray"}
                />
              ),
          },
          {
            header: "Actions",
            headerClassName: "text-right",
            className: "text-right",
            cell: (r) =>
              r.empty ? null : (
                <div
                  className="flex justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View full details"
                    aria-label={`View ${codeOf(r.loc)}`}
                    onClick={() => setDetail(r.loc)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="QR label"
                    aria-label={`QR label for ${codeOf(r.loc)}`}
                    onClick={() =>
                      setLabel({
                        format: "QR",
                        value: buildQrPayload(
                          "LOCATION",
                          codeOf(r.loc),
                          r.loc.id,
                        ),
                        title: codeOf(r.loc),
                        subtitle: r.loc.locationName ?? undefined,
                        footer: `Warehouse: ${whName(r.loc.warehouseId)}`,
                      })
                    }
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                  {canWrite ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        aria-label={`Edit ${codeOf(r.loc)}`}
                        onClick={() => {
                          setEditing(r.loc);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${r.loc.status === "Active" ? "Deactivate" : "Activate"} ${codeOf(r.loc)}`}
                        title={
                          r.loc.status === "Active" ? "Deactivate" : "Activate"
                        }
                        onClick={() => void toggleActive(r.loc)}
                      >
                        <Power
                          className={`h-4 w-4 ${r.loc.status === "Active" ? "text-success-600" : "text-gray-400"}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        aria-label={`Delete ${codeOf(r.loc)}`}
                        onClick={() => {
                          setForceDelete(false);
                          setDeleting(r.loc);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-error-600" />
                      </Button>
                    </>
                  ) : null}
                </div>
              ),
          },
        ]}
      />

      <LocationForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
        locations={locations}
        onCreate={async (input) => {
          let created: ScmLocation;
          try {
            created = await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create location"));
          }
          const bins = input.bins?.length ?? 0;
          toast({
            title:
              bins > 0
                ? `Rack created with ${bins} bin(s)`
                : "Location created",
            variant: "success",
          });
          if (bins > 0) setExpanded((prev) => new Set(prev).add(created.id));
          setFormOpen(false);
        }}
        onUpdate={async (id, input) => {
          try {
            await update.mutateAsync({ id, input });
          } catch (err) {
            throw new Error(errorText(err, "Failed to update location"));
          }
          toast({ title: "Location updated", variant: "success" });
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete location?"
        confirmText="Delete"
        variant="destructive"
        disabled={occupiedDeleting > 0 && !forceDelete}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            const result = await remove.mutateAsync({
              id: deleting.id,
              force: forceDelete,
            });
            toast({
              title: result.nested
                ? `Location and ${result.nested} nested location(s) deleted`
                : "Location deleted",
              variant: "success",
            });
          } catch (err) {
            toast({
              title: errorText(err, "Failed to delete location"),
              variant: "error",
            });
          }
          setDeleting(null);
        }}
      >
        {deleting ? (
          <div className="flex flex-col gap-3 text-theme-sm text-gray-600 dark:text-gray-300">
            <p>
              Delete{" "}
              <span className="font-mono text-gray-900 dark:text-white">
                {codeOf(deleting)}
              </span>
              {deleting.locationName ? ` (${deleting.locationName})` : ""}? This
              can&apos;t be undone.
            </p>
            {nestedOfDeleting.length > 0 ? (
              <p className="text-warning-600">
                The {nestedOfDeleting.length} location(s) nested inside it will
                be deleted too.
              </p>
            ) : null}
            {occupiedDeleting > 0 ? (
              <>
                <p className="text-warning-600">
                  {formatQty(occupiedDeleting)} unit(s) of stock are recorded
                  here. The stock itself still counts toward the product&apos;s
                  on-hand balance either way — deleting this location only loses
                  track of which bin it&apos;s physically in.
                </p>
                <label className="flex items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                  />
                  <span>
                    I understand this location still has stock recorded — delete
                    it anyway.
                  </span>
                </label>
              </>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <LabelDialog
        open={label !== null}
        onClose={() => setLabel(null)}
        dialogTitle="Location QR Label"
        label={label}
      />

      {detail ? (
        <LocationDetail
          loc={detail}
          onClose={() => setDetail(null)}
          bins={childrenByParent.get(detail.id) ?? []}
          parent={
            detail.parentLocationId
              ? byId.get(detail.parentLocationId)
              : undefined
          }
          warehouseLabel={`${whName(detail.warehouseId)} (${whCode(detail.warehouseId)})`}
          perLocProduct={stock.perLocProduct}
          occupied={occupiedOf(detail)}
        />
      ) : null}
    </div>
  );
}

function LocationDetail({
  loc,
  onClose,
  bins,
  parent,
  warehouseLabel,
  perLocProduct,
  occupied,
}: {
  loc: ScmLocation;
  onClose: () => void;
  bins: ScmLocation[];
  parent: ScmLocation | undefined;
  warehouseLabel: string;
  perLocProduct: Map<number, Map<string, { name: string; qty: number }>>;
  occupied: number;
}) {
  // Stock in this location plus its direct children (a rack's bins).
  const byProduct = new Map<string, { name: string; qty: number }>();
  for (const id of [loc.id, ...bins.map((c) => c.id)]) {
    for (const [code, v] of perLocProduct.get(id) ?? []) {
      const cur = byProduct.get(code);
      byProduct.set(code, { name: v.name, qty: (cur?.qty ?? 0) + v.qty });
    }
  }
  const cap = Number(loc.capacity ?? 0);
  return (
    <ScmDetailDialog
      open
      onClose={onClose}
      title="Location Details"
      status={loc.status}
      fields={[
        ["Location code", codeOf(loc)],
        ["Name", loc.locationName],
        ["Type", typeOf(loc)],
        ["Warehouse", warehouseLabel],
        ["Parent", parent ? codeOf(parent) : "—"],
        [
          "Capacity",
          cap
            ? `${formatQty(occupied)}/${formatQty(cap)} ${loc.capacityUnit ?? ""}`
            : "Unconfigured",
        ],
        ["Notes", loc.notes],
      ]}
    >
      <div className="flex flex-col gap-3">
        {bins.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-theme-sm font-medium">Bins ({bins.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {bins.map((c) => (
                <span
                  key={c.id}
                  className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-theme-xs dark:bg-gray-800"
                >
                  {codeOf(c)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="text-theme-sm font-medium">Stock stored here</p>
          {byProduct.size === 0 ? (
            <p className="text-theme-sm text-gray-500">No stock recorded.</p>
          ) : (
            <ul className="divide-y rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {[...byProduct].map(([code, v]) => (
                <Fragment key={code}>
                  <li className="flex justify-between gap-4 px-3 py-1.5 text-theme-sm">
                    <span>
                      {v.name}{" "}
                      <span className="font-mono text-theme-xs text-gray-500">
                        ({code})
                      </span>
                    </span>
                    <span>{formatQty(v.qty)}</span>
                  </li>
                </Fragment>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ScmDetailDialog>
  );
}
