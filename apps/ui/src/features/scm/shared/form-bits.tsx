"use client";

import { FormField, Input, Select, Textarea } from "@texawave-erp/ui-kit";
import type { ReactNode } from "react";

interface Base {
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
  className?: string;
}

/** Labelled text/number/date input — the form-field boilerplate every SCM
 * document form shares. */
export function TextField({
  label,
  required,
  error,
  hint,
  disabled,
  className,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
  upper,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "email";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  upper?: boolean;
}) {
  return (
    <div className={className}>
      <FormField
        label={label}
        required={required ?? false}
        error={error}
        hint={hint}
      >
        {(p) => (
          <Input
            {...p}
            invalid={p.invalid}
            type={type}
            value={value}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={upper ? "uppercase" : undefined}
            onChange={(e) =>
              onChange(upper ? e.target.value.toUpperCase() : e.target.value)
            }
          />
        )}
      </FormField>
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  error,
  hint,
  disabled,
  className,
  value,
  onChange,
  rows = 2,
  placeholder,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <FormField
        label={label}
        required={required ?? false}
        error={error}
        hint={hint}
      >
        {(p) => (
          <Textarea
            {...p}
            invalid={p.invalid}
            rows={rows}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </FormField>
    </div>
  );
}

export function SelectField({
  label,
  required,
  error,
  hint,
  disabled,
  className,
  value,
  onChange,
  options,
  placeholder,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <FormField
        label={label}
        required={required ?? false}
        error={error}
        hint={hint}
      >
        {(p) => (
          <Select
            {...p}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{placeholder ?? "Select"}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    </div>
  );
}

/** Two-column responsive grid used inside document forms. */
export function FormGrid({
  cols = 2,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const map = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };
  return (
    <div className={`grid grid-cols-1 gap-4 ${map[cols]}`}>{children}</div>
  );
}

export function TotalsBar({
  rows,
}: {
  rows: { label: string; value: string; strong?: boolean }[];
}) {
  return (
    <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800/60">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">{r.label}</dt>
          <dd
            className={
              r.strong ? "font-semibold text-gray-900 dark:text-white" : ""
            }
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
