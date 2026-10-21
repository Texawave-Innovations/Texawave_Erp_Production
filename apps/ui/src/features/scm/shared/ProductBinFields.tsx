"use client";

import type { ScmLocation, ScmWarehouse } from "@texawave-erp/api-types";
import { FormField, Select } from "@texawave-erp/ui-kit";
import { AlertTriangle } from "lucide-react";

const codeOf = (l: ScmLocation) => l.locationCode ?? l.binCode;

export interface ProductBinFieldsProps {
  warehouses: readonly ScmWarehouse[];
  locations: readonly ScmLocation[];
  warehouseId: string;
  onWarehouseChange: (warehouseId: string) => void;
  binLocationId: string;
  onBinChange: (locationId: string) => void;
  /** Warehouses the product holds stock in — a hint when it has stock in several. */
  stockWarehouseIds?: readonly number[];
}

/** Shared "Warehouse → Bin" picker for assigning a product's default bin
 * (the product page and the Barcode Utilities' Assign Bin dialog). The Bin
 * list only ever contains locations whose own warehouse is the selected one;
 * changing the warehouse clears a bin that sits in another; no warehouse
 * selected means no bins (never a default warehouse). */
export function ProductBinFields({
  warehouses,
  locations,
  warehouseId,
  onWarehouseChange,
  binLocationId,
  onBinChange,
  stockWarehouseIds = [],
}: ProductBinFieldsProps) {
  const eligible = warehouseId
    ? locations.filter(
        (l) => l.warehouseId === Number(warehouseId) && l.status !== "Inactive",
      )
    : [];
  const knownWarehouseIds = new Set(warehouses.map((w) => w.id));
  const inconsistent = locations.filter(
    (l) => !l.warehouseId || !knownWarehouseIds.has(l.warehouseId),
  );
  const selected = binLocationId
    ? locations.find((l) => l.id === Number(binLocationId))
    : undefined;
  const selectedMismatch =
    !!selected && selected.warehouseId !== Number(warehouseId);
  const whOf = (id: number) => warehouses.find((w) => w.id === id);

  function handleWarehouse(id: string) {
    onWarehouseChange(id);
    // Clear a bin that doesn't belong to the newly selected warehouse.
    if (
      binLocationId &&
      locations.find((l) => l.id === Number(binLocationId))?.warehouseId !==
        Number(id)
    ) {
      onBinChange("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Warehouse" required={false}>
        {(p) => (
          <Select
            {...p}
            value={warehouseId}
            onChange={(e) => handleWarehouse(e.target.value)}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.code ? ` (${w.code})` : ""}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {!warehouseId ? (
        <p className="-mt-2 text-theme-xs text-warning-600">
          {stockWarehouseIds.length > 1
            ? "This product has stock in more than one warehouse — choose which warehouse to assign a bin in."
            : "This product has no warehouse assigned — select a warehouse to see its bin locations."}
        </p>
      ) : null}
      <FormField label="Bin Location" required={false}>
        {(p) => (
          <Select
            {...p}
            value={binLocationId}
            disabled={!warehouseId}
            onChange={(e) => onBinChange(e.target.value)}
          >
            <option value="">
              {warehouseId
                ? eligible.length
                  ? "No bin assigned"
                  : "No locations in this warehouse"
                : "Select a warehouse first"}
            </option>
            {eligible.map((l) => (
              <option key={l.id} value={l.id}>
                {codeOf(l)}
                {l.locationName ? ` — ${l.locationName}` : ""}
                {l.rack ? ` · Rack ${l.rack}` : ""}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {warehouseId && eligible.length === 0 ? (
        <p className="-mt-2 text-theme-xs text-gray-500">
          No locations in this warehouse — create one under Warehouse →
          Locations.
        </p>
      ) : null}
      {inconsistent.length > 0 ? (
        <p className="flex items-start gap-1.5 text-theme-xs text-warning-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {inconsistent.length} location(s) have a missing or invalid warehouse
          reference and are hidden from this list. Fix them under Warehouse →
          Locations.
        </p>
      ) : null}
      {selected ? (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-theme-xs dark:border-gray-800 dark:bg-gray-800/40">
          <div>
            <span className="text-gray-500">Warehouse</span>
            <div className="font-medium">
              {whOf(selected.warehouseId)?.name ?? "Unknown Warehouse"}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Warehouse Code</span>
            <div className="font-mono font-medium">
              {whOf(selected.warehouseId)?.code ?? "—"}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Rack</span>
            <div className="font-medium">{selected.rack || "—"}</div>
          </div>
          <div>
            <span className="text-gray-500">Bin</span>
            <div className="font-medium">
              {selected.locationName || selected.binCode || "—"}
            </div>
          </div>
          {selectedMismatch ? (
            <p className="col-span-2 text-warning-700">
              This saved bin belongs to a different warehouse than the one
              selected — pick a bin from the selected warehouse.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
