"use client";

import { FormField, Select } from "@texawave-erp/ui-kit";
import { useAccounts } from "../hooks";

export interface AccountComboboxProps {
  value: number | undefined;
  onChange: (accountId: number | undefined) => void;
  disabled?: boolean | undefined;
  error?: string | undefined;
  /** "all" prepends an "All accounts" option (list filter use); omit for a
   * required single-select (contact form use). */
  includeAllOption?: boolean;
}

/** Minimal account picker (Phase 4B) — just enough to list accounts and
 * pick one. Only `id`/`name` are shown, matching the fields the legacy
 * Contacts.tsx actually reads off an account. Not a full Account-360 UI. */
export function AccountCombobox({
  value,
  onChange,
  disabled,
  error,
  includeAllOption,
}: AccountComboboxProps) {
  const { data, isPending } = useAccounts({ limit: 100, order: "asc" });
  const accounts = data?.data ?? [];

  return (
    <FormField label="Account" required={!includeAllOption} error={error}>
      {(fieldProps) => (
        <Select
          {...fieldProps}
          invalid={fieldProps.invalid}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : undefined)
          }
          disabled={disabled || isPending}
        >
          {includeAllOption ? (
            <option value="">All accounts</option>
          ) : (
            <option value="" disabled>
              Select an account
            </option>
          )}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
