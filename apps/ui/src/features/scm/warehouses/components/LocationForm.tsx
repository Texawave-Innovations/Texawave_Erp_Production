"use client";

import type {
  CreateLocationInput,
  LocationType,
  ScmLocation,
  UpdateLocationInput,
} from "@texawave-erp/api-types";
import { CREATABLE_LOCATION_TYPES } from "@texawave-erp/api-types";
import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { FormGrid, SelectField, TextField } from "../../shared/form-bits";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import { useWarehouseOptions } from "../../shared/masters";
import { ScmPanel } from "../../shared/ScmPanel";

/** What a location of each type must sit inside: a rack needs no zone, a bin
 * sits in a rack, a shelf in a rack. (Zone/Shelf stay valid for locations
 * created under the older Zone → Rack → Shelf → Bin layout.) */
export function requiredParentTypeFor(type: LocationType): LocationType | null {
  if (type === "RACK") return null;
  if (type === "BIN") return "RACK";
  if (type === "SHELF") return "RACK";
  return null;
}

const NO_PARENT = "__none__";
const UNITS = [
  { value: "UNITS", label: "Units" },
  { value: "KG", label: "KG" },
  { value: "CBM", label: "CBM" },
];

interface BinOverride {
  name?: string;
  capacity?: string;
  unit?: string;
}

export interface LocationFormProps {
  open: boolean;
  onClose: () => void;
  /** null = Add Location; set = Edit Location. */
  editing: ScmLocation | null;
  locations: readonly ScmLocation[];
  onCreate: (input: CreateLocationInput) => Promise<void>;
  onUpdate: (id: number, input: UpdateLocationInput) => Promise<void>;
}

/** Legacy `ScmLocations` add/edit dialog. New locations are Racks or Bins
 * (a Rack can create its Bins in the same step); editing an existing location
 * can change its warehouse, type, parent and code — which also re-derives the
 * code of everything nested under it. */
export function LocationForm(props: LocationFormProps) {
  return (
    <ScmPanel
      open={props.open}
      onClose={props.onClose}
      title={props.editing ? "Edit Location" : "Add Location"}
      size="lg"
    >
      {props.open ? <Body key={props.editing?.id ?? "new"} {...props} /> : null}
    </ScmPanel>
  );
}

function Body({
  onClose,
  editing,
  locations,
  onCreate,
  onUpdate,
}: LocationFormProps) {
  const warehouses = useWarehouseOptions();
  const activeWarehouses = (warehouses.data ?? []).filter(
    (w) => w.status === "Active",
  );
  const [form, setForm] = useState({
    warehouseId: editing
      ? String(editing.warehouseId)
      : activeWarehouses.length === 1
        ? String(activeWarehouses[0]!.id)
        : "",
    locationType: (editing?.locationType ?? "BIN") as LocationType,
    parentLocationId: editing?.parentLocationId
      ? String(editing.parentLocationId)
      : "",
    code: editing?.binCode ?? "",
    locationName: editing?.locationName ?? "",
    capacity: editing?.capacity ? String(Number(editing.capacity)) : "",
    capacityUnit: editing?.capacityUnit ?? "UNITS",
    notes: editing?.notes ?? "",
    binCount: "",
  });
  const [overrides, setOverrides] = useState<Record<number, BinOverride>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const requiredParent = requiredParentTypeFor(form.locationType);
  const byId = new Map(locations.map((l) => [l.id, l]));

  // Candidate parents for the selected type. With no warehouse picker (the
  // client-demo view) a parent is offered whichever warehouse it sits in.
  const parentCandidates = requiredParent
    ? locations.filter(
        (l) =>
          (SCM_CLIENT_DEMO ||
            !form.warehouseId ||
            l.warehouseId === Number(form.warehouseId)) &&
          (l.locationType ?? "BIN") === requiredParent &&
          l.status === "Active" &&
          l.id !== editing?.id,
      )
    : [];

  // Next free bin code/name inside a rack: B01, B02, … and "<Rack Name><n>".
  function nextBinFor(rackId: number) {
    const rack = byId.get(rackId);
    const siblings = locations.filter((l) => l.parentLocationId === rackId);
    const used = new Set(siblings.map((l) => (l.binCode ?? "").toUpperCase()));
    let n =
      siblings.reduce(
        (m, l) =>
          Math.max(m, Number(/^B(\d+)$/i.exec(l.binCode ?? "")?.[1] ?? 0)),
        0,
      ) + 1;
    while (used.has(`B${String(n).padStart(2, "0")}`)) n++;
    return {
      code: `B${String(n).padStart(2, "0")}`,
      name: `${rack?.locationName ?? rack?.binCode ?? ""}${n}`,
    };
  }

  function pickParent(value: string) {
    const parentLocationId = value === NO_PARENT ? "" : value;
    setForm((f) => {
      if (editing || f.locationType !== "BIN" || !parentLocationId) {
        return { ...f, parentLocationId };
      }
      const next = nextBinFor(Number(parentLocationId));
      return {
        ...f,
        parentLocationId,
        code:
          !f.code.trim() || /^B\d+$/i.test(f.code.trim()) ? next.code : f.code,
        locationName:
          !f.locationName.trim() ||
          (f.locationName === f.locationName.trim() &&
            /\d+$/.test(f.locationName))
            ? next.name
            : f.locationName,
      };
    });
  }

  // Per-bin rows shown while creating a Rack — names default to the Rack Name + number (A1, A2, …).
  const binRowCount =
    form.locationType === "RACK" && !editing
      ? Math.min(Math.max(Math.floor(Number(form.binCount)) || 0, 0), 200)
      : 0;
  const rackLabel = form.locationName.trim() || form.code.trim().toUpperCase();
  const binRow = (n: number) => {
    const o = overrides[n] ?? {};
    return {
      name: o.name ?? `${rackLabel}${n}`,
      capacity: o.capacity ?? "",
      unit: o.unit ?? "UNITS",
    };
  };
  const setBinRow = (n: number, patch: BinOverride) =>
    setOverrides((o) => ({ ...o, [n]: { ...o[n], ...patch } }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.warehouseId && !SCM_CLIENT_DEMO)
      found.warehouseId = "Select a warehouse";
    if (!form.code.trim()) found.code = "Code is required";
    if (requiredParent && !form.parentLocationId && !SCM_CLIENT_DEMO) {
      found.parentLocationId = `A ${form.locationType.toLowerCase()} must be placed inside a ${requiredParent.toLowerCase()}`;
    }
    const binCount =
      form.locationType === "RACK" && !editing && form.binCount.trim()
        ? Number(form.binCount)
        : 0;
    if (!Number.isInteger(binCount) || binCount < 0 || binCount > 200) {
      found.binCount =
        "Number of bins must be a whole number between 0 and 200";
    }
    for (let n = 1; n <= binCount; n++) {
      const cap = binRow(n).capacity.trim();
      if (cap && !(Number(cap) >= 0)) {
        found.binCount = `Bin ${n}: capacity must be a valid number`;
        break;
      }
    }
    if (form.capacity.trim() && !(Number(form.capacity) >= 0)) {
      found.capacity = "Capacity must be a valid number";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const warehouseId =
        Number(form.warehouseId) || activeWarehouses[0]?.id || 0;
      if (editing) {
        await onUpdate(editing.id, {
          warehouseId,
          locationType: form.locationType,
          parentLocationId: form.parentLocationId
            ? Number(form.parentLocationId)
            : null,
          code: form.code.trim().toUpperCase(),
          locationName: form.locationName,
          capacity: form.capacity.trim() ? Number(form.capacity) : undefined,
          capacityUnit: form.capacity.trim() ? form.capacityUnit : undefined,
          notes: form.notes,
        });
      } else {
        await onCreate({
          warehouseId,
          locationType: form.locationType,
          parentLocationId: form.parentLocationId
            ? Number(form.parentLocationId)
            : undefined,
          code: form.code.trim().toUpperCase(),
          locationName: form.locationName || undefined,
          capacity: form.capacity.trim() ? Number(form.capacity) : undefined,
          capacityUnit: form.capacity.trim() ? form.capacityUnit : undefined,
          notes: form.notes || undefined,
          bins:
            binCount > 0
              ? Array.from({ length: binCount }, (_, i) => {
                  const r = binRow(i + 1);
                  return {
                    name: r.name.trim() || undefined,
                    capacity: r.capacity.trim()
                      ? Number(r.capacity)
                      : undefined,
                    capacityUnit: r.capacity.trim() ? r.unit : undefined,
                  };
                })
              : undefined,
        });
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save the location.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Editing an existing Zone/Shelf still needs its own type listed so the
  // select has something to display; new locations only offer Rack / Bin.
  const typeOptions = (
    (CREATABLE_LOCATION_TYPES as readonly string[]).includes(form.locationType)
      ? [...CREATABLE_LOCATION_TYPES]
      : [form.locationType, ...CREATABLE_LOCATION_TYPES]
  ).map((t) => ({ value: t, label: t }));
  const typeName =
    form.locationType.charAt(0) + form.locationType.slice(1).toLowerCase();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {editing ? (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          Changing Warehouse, Type, Parent or Code also updates the code and
          warehouse of any bins nested under this location.
        </p>
      ) : null}
      <FormGrid cols={2}>
        {SCM_CLIENT_DEMO ? null : (
          <SelectField
            className="md:col-span-2"
            label="Warehouse"
            required
            value={form.warehouseId}
            error={errors.warehouseId}
            onChange={(v) =>
              setForm((f) => ({ ...f, warehouseId: v, parentLocationId: "" }))
            }
            placeholder="Select warehouse"
            options={activeWarehouses.map((w) => ({
              value: String(w.id),
              label: w.code ? `${w.name} (${w.code})` : w.name,
            }))}
          />
        )}
        <SelectField
          className="md:col-span-2"
          label="Location Type"
          required
          value={form.locationType}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              locationType: v as LocationType,
              parentLocationId: "",
            }))
          }
          options={typeOptions}
        />
        {requiredParent ? (
          <div className="flex flex-col gap-1 md:col-span-2">
            <SelectField
              label={`Parent ${requiredParent}${SCM_CLIENT_DEMO ? " (optional)" : ""}`}
              required={!SCM_CLIENT_DEMO}
              value={
                form.parentLocationId || (SCM_CLIENT_DEMO ? NO_PARENT : "")
              }
              error={errors.parentLocationId}
              onChange={pickParent}
              disabled={!SCM_CLIENT_DEMO && !form.warehouseId}
              placeholder={
                parentCandidates.length
                  ? "Select parent"
                  : `No ${requiredParent.toLowerCase()}s yet`
              }
              options={[
                ...(SCM_CLIENT_DEMO
                  ? [
                      {
                        value: NO_PARENT,
                        label: `None (standalone ${form.locationType.toLowerCase()})`,
                      },
                    ]
                  : []),
                ...parentCandidates.map((p) => ({
                  value: String(p.id),
                  label: `${p.locationCode ?? p.binCode}${p.locationName ? ` — ${p.locationName}` : ""}`,
                })),
              ]}
            />
            {SCM_CLIENT_DEMO && !editing && parentCandidates.length === 0 ? (
              <p className="text-theme-xs text-gray-500">
                Nothing to nest under yet — leave this as None, or create a{" "}
                {requiredParent.toLowerCase()} first.
              </p>
            ) : null}
          </div>
        ) : null}
        <TextField
          label="Code"
          required
          upper
          value={form.code}
          error={errors.code}
          placeholder="R03 / B05"
          onChange={(v) => set("code", v)}
        />
        <TextField
          label={`${typeName} Name`}
          value={form.locationName}
          placeholder={
            form.locationType === "BIN"
              ? "e.g. The actual box or slot on the shelf"
              : form.locationType === "SHELF"
                ? "e.g. A horizontal level on the rack"
                : form.locationType === "RACK"
                  ? "e.g. One storage rack in that area"
                  : "e.g. Packaging materials"
          }
          onChange={(v) => set("locationName", v)}
        />
        {form.locationType === "RACK" && !editing ? (
          <TextField
            className="md:col-span-2"
            label="Number of Bins in this Rack"
            type="number"
            min={0}
            max={200}
            value={form.binCount}
            error={errors.binCount}
            placeholder="Optional — e.g. 5 creates bins A1, A2, A3, A4, A5 below"
            onChange={(v) => set("binCount", v)}
          />
        ) : null}
        <TextField
          label="Capacity"
          type="number"
          min={0}
          value={form.capacity}
          error={errors.capacity}
          placeholder="Optional"
          onChange={(v) => set("capacity", v)}
        />
        <SelectField
          label="Capacity Unit"
          value={form.capacityUnit}
          onChange={(v) => set("capacityUnit", v)}
          options={UNITS}
        />
        <TextField
          className="md:col-span-2"
          label="Notes"
          value={form.notes}
          onChange={(v) => set("notes", v)}
        />
      </FormGrid>
      {binRowCount > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-theme-sm font-medium">
            Bins in this Rack ({binRowCount})
          </div>
          <div className="grid grid-cols-[1fr_1fr_110px] gap-2 px-1 text-theme-xs text-gray-500">
            <span>Bin Name</span>
            <span>Capacity</span>
            <span>Unit</span>
          </div>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {Array.from({ length: binRowCount }, (_, i) => i + 1).map((n) => {
              const r = binRow(n);
              return (
                <div key={n} className="grid grid-cols-[1fr_1fr_110px] gap-2">
                  <Input
                    aria-label={`Bin ${n} name`}
                    value={r.name}
                    onChange={(e) => setBinRow(n, { name: e.target.value })}
                  />
                  <Input
                    aria-label={`Bin ${n} capacity`}
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={r.capacity}
                    onChange={(e) => setBinRow(n, { capacity: e.target.value })}
                  />
                  <Select
                    aria-label={`Bin ${n} unit`}
                    value={r.unit}
                    onChange={(e) => setBinRow(n, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {editing ? "Save Changes" : "Create Location"}
        </Button>
      </div>
    </form>
  );
}
