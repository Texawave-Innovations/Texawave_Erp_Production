"use client";

import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { money } from "../format";
import type { SalaryComponent } from "../types";

/** One editable line: a component and its monthly amount (as typed). */
export interface EditableLine {
  key: number;
  componentId: number | "";
  amount: string;
}

let nextKey = 1;
export function newLine(
  componentId: number | "" = "",
  amount = "",
): EditableLine {
  return { key: nextKey++, componentId, amount };
}

/** Earnings total of the lines, in rupees (paise-safe). */
export function earningsTotal(
  lines: readonly EditableLine[],
  components: readonly SalaryComponent[],
): number {
  const byId = new Map(components.map((c) => [c.id, c]));
  const paise = lines.reduce((sum, l) => {
    const c = l.componentId === "" ? undefined : byId.get(l.componentId);
    if (!c || c.kind !== "EARNING") return sum;
    return sum + Math.round((Number(l.amount) || 0) * 100);
  }, 0);
  return paise / 100;
}

/**
 * The lines of a salary structure over the organization's component master
 * (Docs/PAYROLL_AND_COMPLIANCE.md §3.0). Each component can appear once;
 * the gross is the sum of the earning lines.
 */
export function SalaryLinesEditor({
  lines,
  onChange,
  components,
  disabled = false,
  error,
}: {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  components: readonly SalaryComponent[];
  disabled?: boolean;
  error?: string | undefined;
}) {
  const used = new Set(lines.map((l) => l.componentId));
  const update = (key: number, patch: Partial<EditableLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        Salary lines (monthly)
      </legend>
      {lines.map((l, i) => (
        <div key={l.key} className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Component of line ${i + 1}`}
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
            value={l.componentId}
            onChange={(e) =>
              update(l.key, {
                componentId: e.target.value ? Number(e.target.value) : "",
              })
            }
          >
            <option value="">Choose a component</option>
            {components.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={used.has(c.id) && c.id !== l.componentId}
              >
                {c.name} ({c.code})
                {c.kind === "DEDUCTION" ? " — deduction" : ""}
              </option>
            ))}
          </Select>
          <Input
            aria-label={`Monthly amount of line ${i + 1}`}
            className="w-36"
            type="number"
            min={0}
            inputMode="decimal"
            value={l.amount}
            onChange={(e) => update(l.key, { amount: e.target.value })}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...lines, newLine()])}
        >
          Add line
        </Button>
        <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
          Gross: {money(earningsTotal(lines, components))}
        </span>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Validates the lines; returns an error message or the API body. */
export function linesBody(
  lines: readonly EditableLine[],
):
  | { error: string }
  | { lines: Array<{ componentId: number; monthlyAmount: number }> } {
  if (lines.length === 0) return { error: "Add at least one line" };
  const out: Array<{ componentId: number; monthlyAmount: number }> = [];
  for (const l of lines) {
    if (l.componentId === "")
      return { error: "Choose a component on every line" };
    const amount = Number(l.amount);
    if (l.amount === "" || !Number.isFinite(amount) || amount < 0) {
      return { error: "Enter an amount of ₹0 or more on every line" };
    }
    out.push({ componentId: l.componentId, monthlyAmount: amount });
  }
  return { lines: out };
}
