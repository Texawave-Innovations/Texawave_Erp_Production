"use client";

import { useState } from "react";
import { Select } from "@texawave-erp/ui-kit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCustomers } from "../../customers/hooks";

/**
 * Pick an active customer for a Sales document: one bar that opens a menu
 * with a search box (code, company, contact, GSTIN, city) over the matches.
 * The chosen customer stays shown even when a later search no longer lists it.
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
  // Label of a customer picked in this session (create forms have no
  // `selectedLabel`), so the bar keeps showing it after the list changes.
  const [pickedLabel, setPickedLabel] = useState<string | undefined>();
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useCustomers({
    page: 1,
    limit: 50,
    status: "ACTIVE",
    ...(debounced ? { search: debounced } : {}),
  });
  const rows = query.data?.data ?? [];
  const keptLabel = pickedLabel ?? selectedLabel;
  const showSelected =
    value !== null && !rows.some((c) => c.id === value) && keptLabel;

  return (
    <Select
      id={id}
      aria-describedby={describedBy}
      invalid={invalid ?? false}
      disabled={disabled}
      placeholder="Select a customer"
      searchPlaceholder="Search customer…"
      onSearchChange={setSearch}
      value={value === null ? "" : String(value)}
      onBlur={onBlur}
      onChange={(e) => {
        const next = e.target.value === "" ? null : Number(e.target.value);
        const row = rows.find((c) => c.id === next);
        setPickedLabel(
          row ? `${row.customerCode} — ${row.companyName}` : undefined,
        );
        onChange(next);
      }}
    >
      {debounced ? null : (
        <option value="">
          {query.isPending ? "Loading customers…" : "Select a customer"}
        </option>
      )}
      {showSelected ? <option value={value}>{keptLabel}</option> : null}
      {rows.map((c) => (
        <option key={c.id} value={c.id}>
          {c.customerCode} — {c.companyName}
        </option>
      ))}
    </Select>
  );
}
