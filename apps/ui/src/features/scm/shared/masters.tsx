"use client";

import type {
  ScmLocation,
  ScmProduct,
  ScmWarehouse,
  Supplier,
} from "@texawave-erp/api-types";
import { Select } from "@texawave-erp/ui-kit";
import type { ComponentProps } from "react";
import { scmGet, scmList } from "./scm-api";
import { useScmData } from "./scm-hooks";

/** Option lists for pickers across every SCM form. */
export function useProductOptions() {
  return useScmData<ScmProduct[]>("products", ["options"], () =>
    scmGet("/scm/products/options"),
  );
}

/** Active suppliers for pickers (first 100, name order is by creation). */
export function useSupplierOptions() {
  return useScmData<Supplier[]>(
    "suppliers",
    ["options"],
    async () =>
      (
        await scmList<Supplier>("/scm/suppliers", {
          limit: 100,
          status: "Active",
        })
      ).data,
  );
}

export function useWarehouseOptions() {
  return useScmData<ScmWarehouse[]>("warehouses", ["options"], () =>
    scmGet("/scm/warehouses/options"),
  );
}

/** The client-demo view (see `demo-mode.ts`) has no warehouse concept —
 * stock lives in storage locations of one implicit warehouse. Picks the
 * active warehouse with the most locations (so existing bins stay
 * selectable), else the oldest active one, else the oldest of any status.
 * Returns `""` while warehouses are still loading or none exist. */
export function useDefaultWarehouseId(): string {
  const warehouses = useWarehouseOptions();
  const locations = useLocationOptions();
  const list = warehouses.data ?? [];
  if (list.length === 0) return "";
  const active = list.filter((w) => w.status === "Active");
  const pool = (active.length ? active : list)
    .slice()
    .sort((a, b) => a.id - b.id);
  const count = (id: number) =>
    (locations.data ?? []).filter((l) => l.warehouseId === id).length;
  const best = pool.reduce<ScmWarehouse | undefined>(
    (acc, w) => (!acc || count(w.id) > count(acc.id) ? w : acc),
    undefined,
  );
  return best ? String(best.id) : "";
}

export function useLocationOptions(warehouseId?: number | null) {
  return useScmData<ScmLocation[]>(
    "locations",
    ["options", warehouseId ?? 0],
    () =>
      scmGet(
        "/scm/warehouse-locations/options",
        warehouseId ? { warehouseId } : undefined,
      ),
  );
}

type SelectProps = Omit<
  ComponentProps<typeof Select>,
  "value" | "onChange" | "children"
>;

interface PickerProps extends SelectProps {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  /** Hide inactive warehouses (default true). */
  activeOnly?: boolean;
}

export function ProductSelect({
  value,
  onChange,
  placeholder,
  ...rest
}: PickerProps) {
  const options = useProductOptions();
  return (
    <Select
      {...rest}
      value={value === "" ? "" : String(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{placeholder ?? "Select product"}</option>
      {(options.data ?? []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.productCode})
        </option>
      ))}
    </Select>
  );
}

export function WarehouseSelect({
  value,
  onChange,
  placeholder,
  activeOnly = true,
  ...rest
}: PickerProps) {
  const options = useWarehouseOptions();
  return (
    <Select
      {...rest}
      value={value === "" ? "" : String(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{placeholder ?? "Select warehouse"}</option>
      {(options.data ?? [])
        .filter((w) => !activeOnly || w.status === "Active")
        .map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
    </Select>
  );
}
