"use client";

import { Alert, Select } from "@texawave-erp/ui-kit";
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

const label = (e: EmployeeOption) => `${e.fullName} (${e.employeeCode})`;

/**
 * Clean employee select dropdown, shared by any HR screen that acts on one
 * employee (salaries, bonuses, loans, gratuity, PF/ESI profiles…).
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
  const query = useEmployeeOptions("", canRead);

  if (!canRead) {
    return (
      <Alert variant="warning" title="Employee list unavailable">
        Your role cannot view employees, so you cannot pick one here.
      </Alert>
    );
  }

  const results = query.data?.data ?? [];
  // Keep the current selection listed even when it's not in the initial options
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
  );
}
