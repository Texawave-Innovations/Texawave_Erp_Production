"use client";

import { Select } from "@texawave-erp/ui-kit";
import { periodLabel } from "../format";
import { usePeriods } from "../hooks";

/** Payroll periods that can still change (not finalized or cancelled),
 * newest first — for bonus assignment and loan skip requests. */
export function OpenPeriodSelect({
  value,
  onChange,
  emptyLabel,
  ...field
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  emptyLabel: string;
  id?: string;
  "aria-describedby"?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const periods = usePeriods({ page: 1, limit: 100 });
  const open = (periods.data?.data ?? []).filter(
    (p) => p.status !== "FINALIZED" && p.status !== "CANCELLED",
  );
  return (
    <Select
      {...field}
      disabled={field.disabled || periods.isPending}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">
        {periods.isPending
          ? "Loading periods…"
          : periods.isError
            ? "Could not load periods"
            : emptyLabel}
      </option>
      {open.map((p) => (
        <option key={p.id} value={p.id}>
          {periodLabel(p)}
        </option>
      ))}
    </Select>
  );
}
