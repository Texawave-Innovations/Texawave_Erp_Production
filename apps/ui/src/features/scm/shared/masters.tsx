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
