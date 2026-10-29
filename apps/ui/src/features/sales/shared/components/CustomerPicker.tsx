"use client";

import { useState } from "react";
import { Select, SearchInput } from "@texawave-erp/ui-kit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCustomers } from "../../customers/hooks";

/**
 * Pick an active customer for a Sales document: type to search (code,
 * company, contact, GSTIN, city), then choose. The chosen customer stays in
 * the list even when a search no longer matches it.
 */
export function CustomerPicker({
  id,
  value,
  selectedLabel,
  onChange,
  onBlur,
  invalid,
  disabled,
  describedBy,
}: {
  id: string;
  value: number | null;
  /** Shown for the chosen customer before the list loads (edit forms). */
  selectedLabel?: string | undefined;
  onChange: (customerId: number | null) => void;
  onBlur?: (() => void) | undefined;
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  describedBy?: string | undefined;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useCustomers({
    page: 1,
    limit: 50,
    status: "ACTIVE",
    ...(debounced ? { search: debounced } : {}),
  });
  const rows = query.data?.data ?? [];
  const showSelected =
    value !== null && !rows.some((c) => c.id === value) && selectedLabel;

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={search}
        onChangeValue={setSearch}
        placeholder="Search customer…"
        aria-label="Search customers"
        disabled={disabled}
        sizeVariant="sm"
      />
      <Select
        id={id}
        aria-describedby={describedBy}
        invalid={invalid ?? false}
        disabled={disabled}
        value={value === null ? "" : String(value)}
        onBlur={onBlur}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      >
        <option value="">
          {query.isPending ? "Loading customers…" : "Select a customer"}
        </option>
        {showSelected ? <option value={value}>{selectedLabel}</option> : null}
        {rows.map((c) => (
          <option key={c.id} value={c.id}>
            {c.customerCode} — {c.companyName}
          </option>
        ))}
      </Select>
      {debounced && !query.isPending && rows.length === 0 ? (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          No active customer matches “{debounced}”.
        </p>
      ) : null}
    </div>
  );
}
