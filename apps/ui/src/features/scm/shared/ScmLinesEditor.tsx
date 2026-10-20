"use client";

import { Button, Input } from "@texawave-erp/ui-kit";
import { Plus, Trash2 } from "lucide-react";
import { ProductSelect } from "./masters";

export type LineValues = Record<string, string>;

export interface LineDraft {
  productId: number | "";
  values: LineValues;
}

export interface LineColumn {
  key: string;
  label: string;
  type: "number" | "date" | "text";
  min?: number;
  max?: number;
  step?: number;
  /** Tailwind width class for the cell. */
  width?: string;
}

export function emptyLine(defaults: LineValues = {}): LineDraft {
  return { productId: "", values: { ...defaults } };
}

export interface ScmLinesEditorProps {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  columns: readonly LineColumn[];
  /** Defaults for a newly added line. */
  newLineDefaults?: LineValues;
  /** Locks product choice and add/remove (e.g. lines taken from a quotation). */
  locked?: boolean;
  disabled?: boolean;
  /** Right-aligned computed cell, e.g. the line total. */
  computed?: { label: string; render: (line: LineDraft) => string };
  error?: string | undefined;
}

/** Shared product-line grid for requisitions, RFQs, quotations and POs. */
export function ScmLinesEditor({
  lines,
  onChange,
  columns,
  newLineDefaults,
  locked = false,
  disabled = false,
  computed,
  error,
}: ScmLinesEditorProps) {
  function patch(index: number, next: Partial<LineDraft>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...next } : l)));
  }
  function setValue(index: number, key: string, value: string) {
    const line = lines[index]!;
    patch(index, { values: { ...line.values, [key]: value } });
  }
  const chosen = new Set(
    lines.map((l) => l.productId).filter((v): v is number => v !== ""),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Items
        </span>
        {!locked ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([...lines, emptyLine(newLineDefaults)])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800"
          >
            <div className="col-span-12 md:col-span-4">
              <label className="mb-1 block text-theme-xs text-gray-500">
                Product
              </label>
              <ProductSelect
                aria-label={`Product for line ${index + 1}`}
                value={line.productId}
                disabled={disabled || locked}
                onChange={(v) => patch(index, { productId: v })}
              />
              {line.productId !== "" && !locked && chosen.size < lines.length
                ? null
                : null}
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                className={`col-span-6 md:col-span-1 ${c.width ?? ""}`}
              >
                <label className="mb-1 block text-theme-xs text-gray-500">
                  {c.label}
                </label>
                <Input
                  aria-label={`${c.label} for line ${index + 1}`}
                  type={c.type}
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={line.values[c.key] ?? ""}
                  disabled={disabled}
                  onChange={(e) => setValue(index, c.key, e.target.value)}
                />
              </div>
            ))}
            {computed ? (
              <div className="col-span-6 pb-2 text-right text-theme-sm font-medium md:col-span-2">
                <span className="mb-1 block text-theme-xs font-normal text-gray-500">
                  {computed.label}
                </span>
                {computed.render(line)}
              </div>
            ) : null}
            {!locked ? (
              <div className="col-span-12 flex justify-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={disabled || lines.length === 1}
                  onClick={() => onChange(lines.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-error-500" />
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Lines the user actually filled in (product + positive quantity). */
export function filledLines(lines: LineDraft[]) {
  return lines.filter(
    (l) => l.productId !== "" && Number(l.values.quantity) > 0,
  ) as (LineDraft & { productId: number })[];
}
