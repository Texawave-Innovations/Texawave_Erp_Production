"use client";

import { Select } from "@texawave-erp/ui-kit";
import { periodLabel } from "../format";
import { usePeriods } from "../hooks";

/** "All periods" list filter, newest first. Cancelled periods are left out:
 * they never pay anyone, so nothing useful is filed under them. */
export function PeriodFilterSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const periods = usePeriods({ page: 1, limit: 100 });
  const usable = (periods.data?.data ?? []).filter(
    (p) => p.status !== "CANCELLED",
  );
  return (
    <Select
      aria-label="Filter by payroll period"
      className="w-48"
      disabled={periods.isPending}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">
        {periods.isPending
          ? "Loading periods…"
          : periods.isError
            ? "All periods (list unavailable)"
            : "All periods"}
      </option>
      {usable.map((p) => (
        <option key={p.id} value={p.id}>
          {periodLabel(p)}
        </option>
      ))}
    </Select>
  );
}
