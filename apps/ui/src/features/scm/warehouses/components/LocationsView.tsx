"use client";

import type { LocationType, ScmLocation } from "@texawave-erp/api-types";
import { LOCATION_TYPES, VALID_PARENT_TYPE } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { MapPin, Plus, Power } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { formatQty } from "../../shared/format";
import {
  useLocationOptions,
  useWarehouseOptions,
  WarehouseSelect,
} from "../../shared/masters";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { useCreateLocation, useLocations, useUpdateLocation } from "../hooks";

/** Legacy `ScmLocations`: Zone -> Rack -> Shelf -> Bin hierarchy. A rack sits
 * in a zone, a shelf in a rack, a bin in a shelf; the full code is derived
 * (WH-ZONE-RACK-SHELF-BIN) and unique within the warehouse. */
export function LocationsView() {
  const c = useListControls();
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const warehouses = useWarehouseOptions();
  const allLocations = useLocationOptions();
  const create = useCreateLocation();
  const update = useUpdateLocation();

  const query = useLocations({
    page: c.page,
    limit: c.pageSize,
    warehouseId: warehouseId === "" ? undefined : warehouseId,
    locationType: type === "" ? undefined : (type as LocationType),
  });

  const whName = (id: number) =>
    warehouses.data?.find((w) => w.id === id)?.name ?? "—";

  async function toggle(l: ScmLocation) {
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

  return (
    <ScmListView<ScmLocation>
      title="Locations"
      description="Zone → Rack → Shelf → Bin hierarchy within each warehouse."
      icon={MapPin}
      noun="locations"
      readPermission="scm.warehouse.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(l) => String(l.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        ) : null
      }
      filters={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="w-full sm:w-52">
            <WarehouseSelect
              aria-label="Filter by warehouse"
              placeholder="All warehouses"
              activeOnly={false}
              value={warehouseId}
              onChange={(v) => {
                setWarehouseId(v);
                c.setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select
              aria-label="Filter by type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                c.setPage(1);
              }}
            >
              <option value="">All types</option>
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
      hasActiveFilters={Boolean(warehouseId !== "" || type)}
      onResetFilters={() => {
        setWarehouseId("");
        setType("");
      }}
      emptyTitle="No locations yet"
      emptyDescription="Add a zone first, then racks, shelves and bins inside it."
      columns={[
        {
          header: "Location Code",
          cell: (l) => (
            <span className="font-mono text-theme-xs">
              {l.locationCode ?? l.binCode}
            </span>
          ),
        },
        { header: "Type", cell: (l) => l.locationType ?? "BIN" },
        { header: "Warehouse", cell: (l) => whName(l.warehouseId) },
        { header: "Name", cell: (l) => l.locationName ?? "—" },
        {
          header: "Capacity",
          align: "right",
          cell: (l) =>
            l.capacity
              ? `${formatQty(l.capacity)} ${l.capacityUnit ?? ""}`
              : "—",
        },
        {
          header: "Status",
          cell: (l) => (
            <StatusBadge
              label={l.status}
              colorToken={l.status === "Active" ? "success" : "gray"}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (l) =>
            canWrite ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${l.status === "Active" ? "Deactivate" : "Activate"} ${l.locationCode ?? l.binCode}`}
                  onClick={() => void toggle(l)}
                >
                  <Power
                    className={`h-4 w-4 ${l.status === "Active" ? "text-success-600" : "text-gray-400"}`}
                  />
                </Button>
              </div>
            ) : null,
        },
      ]}
    >
      <ScmFormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add Location"
        submitLabel="Create Location"
        initialValues={{ locationType: "BIN", capacityUnit: "UNITS" }}
        fields={[
          {
            name: "warehouseId",
            label: "Warehouse",
            type: "warehouse",
            required: true,
          },
          {
            name: "locationType",
            label: "Location Type",
            type: "select",
            required: true,
            options: LOCATION_TYPES.map((t) => ({ value: t, label: t })),
          },
          {
            name: "parentLocationId",
            label: "Parent Location",
            type: "select",
            required: true,
            placeholder: "Select parent",
            visibleWhen: (v) =>
              VALID_PARENT_TYPE[v.locationType as LocationType] !== null,
            dynamicOptions: (v) => {
              const required =
                VALID_PARENT_TYPE[v.locationType as LocationType];
              return (allLocations.data ?? [])
                .filter(
                  (l) =>
                    l.warehouseId === Number(v.warehouseId) &&
                    (l.locationType ?? "BIN") === required &&
                    l.status === "Active",
                )
                .map((l) => ({
                  value: String(l.id),
                  label: l.locationCode ?? l.binCode,
                }));
            },
            hint: "A rack sits in a zone, a shelf in a rack, a bin in a shelf",
            span: 2,
          },
          {
            name: "code",
            label: "Code",
            type: "text",
            required: true,
            upper: true,
            mono: true,
          },
          { name: "locationName", label: "Name", type: "text" },
          { name: "capacity", label: "Capacity", type: "number", min: 0 },
          { name: "capacityUnit", label: "Capacity Unit", type: "text" },
          { name: "notes", label: "Notes", type: "text", span: 2 },
        ]}
        onSubmit={async (v) => {
          try {
            await create.mutateAsync({
              warehouseId: v.warehouseId as number,
              locationType: v.locationType as LocationType,
              parentLocationId: v.parentLocationId
                ? Number(v.parentLocationId)
                : undefined,
              code: v.code as string,
              locationName: v.locationName as string | undefined,
              capacity: v.capacity as number | undefined,
              capacityUnit: v.capacity
                ? (v.capacityUnit as string | undefined)
                : undefined,
              notes: v.notes as string | undefined,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to create location"));
          }
          toast({ title: "Location created", variant: "success" });
          setOpen(false);
        }}
      />
    </ScmListView>
  );
}
