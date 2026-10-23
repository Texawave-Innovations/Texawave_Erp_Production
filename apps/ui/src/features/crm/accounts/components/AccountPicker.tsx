"use client";

// Server-searched account select (20 results per query, debounced by
// AsyncPicker) so it is never capped at the first page of accounts.
import {
  AsyncPicker,
  type AsyncPickerOption,
} from "@/features/crm/legacy-ui/AsyncPicker";
import { useState } from "react";
import { useAccount, useAccounts } from "../hooks";

export function AccountPicker({
  value,
  onChange,
  placeholder = "Select an account",
  allLabel,
  leadingOptions,
  className,
  disabled,
  invalid,
}: {
  value: number | undefined;
  onChange: (accountId: number | undefined) => void;
  placeholder?: string;
  /** Adds an "all" choice (selecting it calls onChange(undefined)). */
  allLabel?: string | undefined;
  /** Extra pinned choices (negative ids) shown while not searching. */
  leadingOptions?: AsyncPickerOption[] | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<AsyncPickerOption | null>(null);
  const query = useAccounts({
    limit: 20,
    order: "asc",
    ...(search ? { search } : {}),
  });
  const results = query.data?.data ?? [];
  const known = value !== undefined && value > 0;
  const needsFetch =
    known &&
    picked?.id !== value &&
    !results.some((a) => a.id === value) &&
    !leadingOptions?.some((o) => o.id === value);
  const selectedQuery = useAccount(needsFetch ? value : undefined);

  const pinned: AsyncPickerOption[] = search
    ? []
    : [
        ...(allLabel ? [{ id: 0, label: allLabel }] : []),
        ...(leadingOptions ?? []),
      ];
  const options = [
    ...pinned,
    ...results.map((a) => ({ id: a.id, label: a.name })),
  ];

  const selectedLabel =
    value === undefined
      ? allLabel
      : (leadingOptions?.find((o) => o.id === value)?.label ??
        (picked?.id === value ? picked.label : undefined) ??
        results.find((a) => a.id === value)?.name ??
        selectedQuery.data?.name);

  return (
    <AsyncPicker
      selectedId={value ?? (allLabel ? 0 : undefined)}
      selectedLabel={selectedLabel}
      placeholder={placeholder}
      searchPlaceholder="Search accounts…"
      className={className}
      invalid={invalid}
      disabled={disabled}
      loading={query.isFetching}
      onSearchChange={setSearch}
      options={options}
      onSelect={(o) => {
        setPicked(o);
        onChange(o.id === 0 ? undefined : o.id);
      }}
    />
  );
}
