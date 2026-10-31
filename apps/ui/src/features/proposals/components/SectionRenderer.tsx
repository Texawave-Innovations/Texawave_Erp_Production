"use client";

import type { ProposalSectionConfig } from "@texawave-erp/api-types";
import { Input, Textarea } from "@texawave-erp/ui-kit";
import { Trash2 } from "lucide-react";
import { filterTypedValue, getFieldValidationError } from "../field-validation";

export interface SectionRendererProps {
  sections: ProposalSectionConfig[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean | undefined;
}

/** Renders a filled-in proposal document's dynamic sections — legacy
 * `TemplateLivePreview.tsx` / the section-filling part of
 * `ProposalEditor.tsx`. Each section type gets the input shape that matches
 * its data (text/list/key-value/table/signature); `page_break`/`spacer` are
 * layout-only and render nothing. */
export function SectionRenderer({
  sections,
  values,
  onChange,
  readOnly,
}: SectionRendererProps) {
  function setValue(id: string, value: unknown) {
    onChange({ ...values, [id]: value });
  }

  return (
    <div className="flex flex-col gap-5">
      {[...sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          const value = values[section.id];

          if (section.type === "page_break" || section.type === "spacer") {
            return (
              <hr
                key={section.id}
                className="border-gray-200 dark:border-gray-800"
              />
            );
          }

          return (
            <div
              key={section.id}
              id={`proposal-section-${section.id}`}
              className="flex scroll-mt-24 flex-col gap-2"
            >
              <label className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {section.title}
                {section.required ? (
                  <span className="ml-0.5 text-error-500">*</span>
                ) : null}
              </label>
              {section.description ? (
                <p className="-mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {section.description}
                </p>
              ) : null}

              {section.type === "short_text" ? (
                <Input
                  value={
                    typeof value === "string"
                      ? value
                      : (section.defaultContent ?? "")
                  }
                  onChange={(e) => setValue(section.id, e.target.value)}
                  disabled={readOnly}
                />
              ) : null}

              {section.type === "long_text" ? (
                <Textarea
                  rows={4}
                  value={
                    typeof value === "string"
                      ? value
                      : (section.defaultContent ?? "")
                  }
                  onChange={(e) => setValue(section.id, e.target.value)}
                  disabled={readOnly}
                />
              ) : null}

              {section.type === "bullet_list" ||
              section.type === "numbered_list" ? (
                <Textarea
                  rows={4}
                  placeholder="One item per line"
                  value={
                    Array.isArray(value)
                      ? value.join("\n")
                      : (section.defaultItems ?? []).join("\n")
                  }
                  onChange={(e) =>
                    setValue(
                      section.id,
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  disabled={readOnly}
                />
              ) : null}

              {section.type === "checklist" ? (
                <div className="flex flex-col gap-1.5">
                  {(section.defaultItems ?? []).map((item, idx) => {
                    const currentList = Array.isArray(value)
                      ? (value as (string | number)[]).map(String)
                      : [];
                    const isIndexBased = currentList.some((v) =>
                      /^\d+$/.test(v),
                    );
                    const checked = isIndexBased
                      ? currentList.includes(String(idx))
                      : currentList.includes(item);
                    return (
                      <label
                        key={`${section.id}-check-${idx}`}
                        className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={readOnly}
                          onChange={(e) => {
                            const activeIndices = new Set<string>();
                            if (currentList.some((v) => /^\d+$/.test(v))) {
                              for (const v of currentList) {
                                if (/^\d+$/.test(v)) activeIndices.add(v);
                              }
                            } else {
                              (section.defaultItems ?? []).forEach((it, i) => {
                                if (currentList.includes(it))
                                  activeIndices.add(String(i));
                              });
                            }
                            if (e.target.checked) {
                              activeIndices.add(String(idx));
                            } else {
                              activeIndices.delete(String(idx));
                            }
                            setValue(section.id, Array.from(activeIndices));
                          }}
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {section.type === "key_value" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(section.keyValueFields ?? []).map((field) => {
                    const kv = (
                      value && typeof value === "object" ? value : {}
                    ) as Record<string, string>;
                    const fieldType = field.type ?? "text";
                    const currentVal = String(
                      kv[field.id] ?? field.defaultValue ?? field.value ?? "",
                    );
                    const fieldError = getFieldValidationError(
                      fieldType,
                      currentVal,
                    );
                    return (
                      <div key={field.id} className="flex flex-col gap-1">
                        <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                          {field.label}{" "}
                          {fieldType === "currency" ? "(INR)" : ""}
                        </label>
                        <Input
                          type="text"
                          value={currentVal}
                          placeholder={
                            fieldType === "date"
                              ? "DD/MM/YYYY"
                              : fieldType === "currency"
                                ? "0.00"
                                : fieldType === "email"
                                  ? "name@company.com"
                                  : fieldType === "phone"
                                    ? "+91 98765 43210"
                                    : undefined
                          }
                          disabled={readOnly}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (filterTypedValue(fieldType, val)) {
                              setValue(section.id, {
                                ...kv,
                                [field.id]: val,
                              });
                            }
                          }}
                          className={
                            fieldError
                              ? "border-error-500 focus:border-error-500"
                              : ""
                          }
                        />
                        {fieldError ? (
                          <p className="text-theme-xs text-error-600 dark:text-error-400">
                            {fieldError}
                          </p>
                        ) : fieldType === "date" ? (
                          <p className="text-theme-xs text-gray-400">
                            Format: DD/MM/YYYY
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {section.type === "table" ? (
                <TableSectionInput
                  columns={section.tableColumns ?? []}
                  value={
                    Array.isArray(value)
                      ? (value as Record<string, string>[])
                      : (section.defaultRows ?? [])
                  }
                  onChange={(rows) => setValue(section.id, rows)}
                  readOnly={readOnly}
                />
              ) : null}

              {section.type === "signature" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(section.signatureFields ?? []).map((field) => {
                    const sig = (
                      value && typeof value === "object" ? value : {}
                    ) as Record<string, string>;
                    return (
                      <div key={field.id}>
                        <label className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {field.label}
                        </label>
                        <Input
                          value={sig[field.id] ?? ""}
                          disabled={readOnly}
                          onChange={(e) =>
                            setValue(section.id, {
                              ...sig,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {section.type === "section_group" && section.children ? (
                <div className="border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                  <SectionRenderer
                    sections={section.children}
                    values={values}
                    onChange={onChange}
                    readOnly={readOnly}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

function TableSectionInput({
  columns,
  value,
  onChange,
  readOnly,
}: {
  columns: { id: string; name: string; type?: string }[];
  value: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
  readOnly?: boolean | undefined;
}) {
  function updateCell(rowIndex: number, colId: string, cellValue: string) {
    const next = value.map((row, i) =>
      i === rowIndex ? { ...row, [colId]: cellValue } : row,
    );
    onChange(next);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-theme-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {columns.map((c) => (
              <th key={c.id} className="py-1.5 pr-3">
                {c.name}
              </th>
            ))}
            {!readOnly ? <th className="w-8 py-1.5"></th> : null}
          </tr>
        </thead>
        <tbody>
          {value.map((row, i) => (
            <tr key={`row-${i}`}>
              {columns.map((c) => {
                const colType = (c.type ?? "text") as
                  "text" | "number" | "currency" | "date";
                const cellVal = row[c.id] ?? "";
                const cellError = getFieldValidationError(colType, cellVal);
                return (
                  <td key={c.id} className="py-1 pr-3 align-top">
                    <Input
                      aria-label={`${c.name}, row ${i + 1}`}
                      type="text"
                      placeholder={
                        colType === "date"
                          ? "DD/MM/YYYY"
                          : colType === "currency"
                            ? "0.00"
                            : c.name
                      }
                      value={cellVal}
                      disabled={readOnly}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (filterTypedValue(colType, val)) {
                          updateCell(i, c.id, val);
                        }
                      }}
                      className={`h-8 text-theme-xs ${
                        cellError
                          ? "border-error-500 focus:border-error-500"
                          : ""
                      }`}
                    />
                    {cellError && (
                      <p className="mt-0.5 text-theme-xs text-error-600 dark:text-error-400">
                        {cellError}
                      </p>
                    )}
                  </td>
                );
              })}
              {!readOnly ? (
                <td className="py-1 align-top">
                  <button
                    type="button"
                    aria-label={`Delete row ${i + 1}`}
                    onClick={() =>
                      onChange(value.filter((_, idx) => idx !== i))
                    }
                    className="rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <button
          type="button"
          onClick={() => onChange([...value, {}])}
          className="mt-2 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Add Row
        </button>
      ) : null}
    </div>
  );
}
