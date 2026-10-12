"use client";

import { Alert, Input, Select } from "@texawave-erp/ui-kit";
import { useEffect, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  EMPLOYEE_READ_ANY_SCOPE,
  type EmployeeOption,
  useEmployeeOptions,
} from "./employee-picker.api";

export type { EmployeeOption } from "./employee-picker.api";

export interface EmployeePickerProps {
  value: EmployeeOption | null;
  onChange: (employee: EmployeeOption | null) => void;
  /** From `FormField`'s render prop, so its `<label>` names the select. */
  id?: string;
  "aria-describedby"?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
}

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const label = (e: EmployeeOption) => `${e.fullName} (${e.employeeCode})`;

/**
 * Searchable employee select, shared by any HR screen that acts on one
 * employee (salaries, bonuses, loans, PF/ESI profiles…). A widget, not a
 * ui-kit primitive: it calls `GET /hr/employees`, which the server scopes to
 * the caller's own/team/all grant. Use inside `FormField`:
 *
 *   <FormField label="Employee">{(f) => <EmployeePicker {...f} value=… onChange=… />}</FormField>
 */
export function EmployeePicker({
  value,
  onChange,
  id,
  "aria-describedby": describedBy,
  invalid = false,
  disabled = false,
}: EmployeePickerProps) {
  const canRead = usePermission(EMPLOYEE_READ_ANY_SCOPE);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim());
  const query = useEmployeeOptions(debounced, canRead);

  if (!canRead) {
    return (
      <Alert variant="warning" title="Employee list unavailable">
        Your role cannot view employees, so you cannot pick one here.
      </Alert>
    );
  }

  const results = query.data?.data ?? [];
  // Keep the current selection listed even when the search no longer matches it.
  const options =
    value && !results.some((e) => e.id === value.id)
      ? [value, ...results]
      : results;

  const placeholder = query.isPending
    ? "Loading employees…"
    : query.isError
      ? "Could not load employees"
      : options.length === 0
        ? "No matching employees"
        : "Select an employee";

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        aria-label="Search employees"
        placeholder="Search by name or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <Select
        id={id}
        aria-describedby={describedBy}
        invalid={invalid}
        disabled={disabled || query.isPending}
        value={value ? String(value.id) : ""}
        onChange={(e) => {
          const picked = options.find((o) => String(o.id) === e.target.value);
          onChange(
            picked
              ? {
                  id: picked.id,
                  employeeCode: picked.employeeCode,
                  fullName: picked.fullName,
                }
              : null,
          );
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {label(e)}
          </option>
        ))}
      </Select>
    </div>
  );
}
