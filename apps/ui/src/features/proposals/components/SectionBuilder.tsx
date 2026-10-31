"use client";

import type {
  KeyValueFieldDef,
  ProposalSectionConfig,
  ProposalSectionContentType,
  TableColumnDef,
} from "@texawave-erp/api-types";
import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { filterTypedValue, getFieldValidationError } from "../field-validation";

const TYPE_OPTIONS: { value: ProposalSectionContentType; label: string }[] = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text / Paragraph" },
  { value: "bullet_list", label: "Bullet List" },
  { value: "numbered_list", label: "Numbered List" },
  { value: "key_value", label: "Key-Value Fields" },
  { value: "table", label: "Table" },
  { value: "checklist", label: "Checklist" },
  { value: "signature", label: "Signature Block" },
  { value: "section_group", label: "Section Group (nested)" },
  { value: "page_break", label: "Page Break" },
  { value: "spacer", label: "Spacer" },
];

let uidCounter = 0;
function uid(prefix = "section") {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

export function newSection(order: number): ProposalSectionConfig {
  return {
    id: uid(),
    title: "New Section",
    type: "short_text",
    order,
    defaultContent: "",
  };
}

export interface SectionBuilderProps {
  sections: ProposalSectionConfig[];
  onChange: (next: ProposalSectionConfig[]) => void;
  depth?: number;
}

/** Dynamic section-schema builder — legacy `TemplateBuilder.tsx` +
 * `SectionConfigDrawer.tsx` folded into one inline editor (no separate
 * drawer/live-preview pane, but every section type legacy supports except
 * `image`, which legacy itself never wired to real file storage, is
 * configurable here). */
export function SectionBuilder({
  sections,
  onChange,
  depth = 0,
}: SectionBuilderProps) {
  function update(id: string, patch: Partial<ProposalSectionConfig>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function remove(id: string) {
    onChange(
      sections
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  }

  function move(id: string, direction: -1 | 1) {
    const index = sections.findIndex((s) => s.id === id);
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  }

  function addSection() {
    onChange([...sections, newSection(sections.length + 1)]);
  }

  function handleTypeChange(
    section: ProposalSectionConfig,
    newType: ProposalSectionContentType,
  ) {
    const patch: Partial<ProposalSectionConfig> = { type: newType };

    // Preserve text when switching between text and list types
    const isToList =
      newType === "bullet_list" ||
      newType === "numbered_list" ||
      newType === "checklist";
    const isFromText =
      section.type === "short_text" || section.type === "long_text";
    if (isToList && isFromText && section.defaultContent?.trim()) {
      if (!section.defaultItems || section.defaultItems.length === 0) {
        patch.defaultItems = section.defaultContent
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const isToText = newType === "short_text" || newType === "long_text";
    const isFromList =
      section.type === "bullet_list" ||
      section.type === "numbered_list" ||
      section.type === "checklist";
    if (isToText && isFromList && section.defaultItems?.length) {
      if (!section.defaultContent || !section.defaultContent.trim()) {
        patch.defaultContent = section.defaultItems.join("\n");
      }
    }

    // Initialize defaults if transitioning to complex types for the first time
    if (
      newType === "key_value" &&
      (!section.keyValueFields || section.keyValueFields.length === 0)
    ) {
      patch.keyValueFields = [
        { id: uid("kv"), label: "Field", defaultValue: "", type: "text" },
      ];
    }

    if (
      newType === "table" &&
      (!section.tableColumns || section.tableColumns.length === 0)
    ) {
      patch.tableColumns = [
        { id: uid("col"), name: "Description", type: "text" },
        { id: uid("col"), name: "Amount", type: "currency" },
      ];
    }

    if (
      newType === "signature" &&
      (!section.signatureFields || section.signatureFields.length === 0)
    ) {
      patch.signatureFields = [
        { id: uid("sig"), label: "Authorized Signatory", type: "name" },
      ];
    }

    update(section.id, patch);
  }

  function updateListItems(section: ProposalSectionConfig, raw: string) {
    // Preserve newlines while typing — do not filter out empty strings aggressively
    update(section.id, {
      defaultItems: raw.split("\n"),
    });
  }

  function addKeyValueField(section: ProposalSectionConfig) {
    update(section.id, {
      keyValueFields: [
        ...(section.keyValueFields ?? []),
        { id: uid("kv"), label: "Field", defaultValue: "", type: "text" },
      ],
    });
  }

  function addTableColumn(section: ProposalSectionConfig) {
    const newColId = uid("col");
    update(section.id, {
      tableColumns: [
        ...(section.tableColumns ?? []),
        { id: newColId, name: "Column", type: "text" },
      ],
    });
  }

  function removeTableColumn(section: ProposalSectionConfig, colId: string) {
    const updatedCols = (section.tableColumns ?? []).filter(
      (x) => x.id !== colId,
    );
    // Also clean up this colId from any existing defaultRows
    const updatedRows = (section.defaultRows ?? []).map((row) => {
      const copy = { ...row };
      delete copy[colId];
      return copy;
    });
    update(section.id, {
      tableColumns: updatedCols,
      defaultRows: updatedRows,
    });
  }

  function addTableRow(section: ProposalSectionConfig) {
    const emptyRow: Record<string, string> = {};
    (section.tableColumns ?? []).forEach((c) => {
      emptyRow[c.id] = "";
    });
    update(section.id, {
      defaultRows: [...(section.defaultRows ?? []), emptyRow],
    });
  }

  function updateTableCell(
    section: ProposalSectionConfig,
    rowIndex: number,
    colId: string,
    value: string,
  ) {
    const rows = [...(section.defaultRows ?? [])];
    rows[rowIndex] = { ...(rows[rowIndex] ?? {}), [colId]: value };
    update(section.id, { defaultRows: rows });
  }

  function removeTableRow(section: ProposalSectionConfig, rowIndex: number) {
    update(section.id, {
      defaultRows: (section.defaultRows ?? []).filter(
        (_, idx) => idx !== rowIndex,
      ),
    });
  }

  function addSignatureField(section: ProposalSectionConfig) {
    update(section.id, {
      signatureFields: [
        ...(section.signatureFields ?? []),
        { id: uid("sig"), label: "Name", type: "name" },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => {
        const sectionKey =
          section.id && typeof section.id === "string"
            ? section.id
            : `section-key-${index}`;

        return (
          <div
            key={sectionKey}
            className="relative rounded-xl border border-gray-200 bg-white p-4 focus-within:z-30 dark:border-gray-700 dark:bg-gray-900"
            style={{ marginLeft: depth * 16 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(section.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Move down"
                  disabled={index === sections.length - 1}
                  onClick={() => move(section.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.5fr_auto]">
                  <Input
                    value={section.title ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    onChange={(e) =>
                      update(section.id, { title: e.target.value })
                    }
                    placeholder="Section title"
                  />
                  <Select
                    value={section.type ?? "short_text"}
                    onChange={(e) =>
                      handleTypeChange(
                        section,
                        e.target.value as ProposalSectionContentType,
                      )
                    }
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={section.required ?? false}
                      onChange={(e) =>
                        update(section.id, { required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>

                {section.type === "page_break" && (
                  <p className="text-theme-xs italic text-gray-500 dark:text-gray-400">
                    Inserts a page break in the printed document or exported
                    PDF. Subsequent content starts on a new page.
                  </p>
                )}

                {section.type === "spacer" && (
                  <p className="text-theme-xs italic text-gray-500 dark:text-gray-400">
                    Inserts a vertical spacer (24px) between adjacent sections.
                  </p>
                )}

                {(section.type === "short_text" ||
                  section.type === "long_text") && (
                  <div>
                    <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Default Content / Body
                    </label>
                    {section.type === "short_text" ? (
                      <Input
                        value={section.defaultContent ?? ""}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        onChange={(e) =>
                          update(section.id, { defaultContent: e.target.value })
                        }
                        placeholder="Enter default section text or brief summary..."
                        className="mt-1"
                      />
                    ) : (
                      <textarea
                        rows={4}
                        value={section.defaultContent ?? ""}
                        onChange={(e) =>
                          update(section.id, { defaultContent: e.target.value })
                        }
                        placeholder="Enter default section body or proposal description (supports multiple lines)..."
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    )}
                  </div>
                )}

                {(section.type === "bullet_list" ||
                  section.type === "numbered_list" ||
                  section.type === "checklist") && (
                  <div>
                    <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Default items (one per line — press Enter for a new line)
                    </label>
                    <textarea
                      rows={4}
                      value={(section.defaultItems ?? []).join("\n")}
                      onChange={(e) => updateListItems(section, e.target.value)}
                      placeholder="Line 1 item&#10;Line 2 item&#10;Line 3 item"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                )}

                {section.type === "key_value" && (
                  <div className="flex flex-col gap-2.5">
                    <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Key-Value Fields & Default Values
                    </label>
                    {(section.keyValueFields ?? []).map((f) => {
                      const fieldType = f.type ?? "text";
                      const fieldVal = f.defaultValue ?? f.value ?? "";
                      const fieldError = getFieldValidationError(
                        fieldType,
                        fieldVal,
                      );
                      return (
                        <div key={f.id} className="flex flex-col gap-1">
                          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1.5fr_1.5fr_1fr_auto]">
                            <Input
                              value={f.label}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) =>
                                update(section.id, {
                                  keyValueFields: (
                                    section.keyValueFields ?? []
                                  ).map((x) =>
                                    x.id === f.id
                                      ? { ...x, label: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                              placeholder="Field label (e.g. Budget)"
                            />
                            <Input
                              value={fieldVal}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (filterTypedValue(fieldType, val)) {
                                  update(section.id, {
                                    keyValueFields: (
                                      section.keyValueFields ?? []
                                    ).map((x) =>
                                      x.id === f.id
                                        ? {
                                            ...x,
                                            defaultValue: val,
                                            value: val,
                                          }
                                        : x,
                                    ),
                                  });
                                }
                              }}
                              placeholder={
                                fieldType === "date"
                                  ? "DD/MM/YYYY"
                                  : fieldType === "currency"
                                    ? "0.00"
                                    : fieldType === "phone"
                                      ? "+91 98765 43210"
                                      : fieldType === "email"
                                        ? "name@company.com"
                                        : "Default value"
                              }
                              className={
                                fieldError
                                  ? "border-error-500 focus:border-error-500"
                                  : ""
                              }
                            />
                            <Select
                              value={f.type ?? "text"}
                              onChange={(e) =>
                                update(section.id, {
                                  keyValueFields: (
                                    section.keyValueFields ?? []
                                  ).map((x) =>
                                    x.id === f.id
                                      ? {
                                          ...x,
                                          type: e.target
                                            .value as KeyValueFieldDef["type"],
                                        }
                                      : x,
                                  ),
                                })
                              }
                            >
                              <option value="text">Text</option>
                              <option value="currency">Currency (INR)</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label="Remove field"
                              onClick={() =>
                                update(section.id, {
                                  keyValueFields: (
                                    section.keyValueFields ?? []
                                  ).filter((x) => x.id !== f.id),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {fieldError && (
                            <p className="text-theme-xs text-error-600 dark:text-error-400">
                              {fieldError}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      onClick={() => addKeyValueField(section)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Field
                    </Button>
                  </div>
                )}

                {section.type === "table" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        Table Columns
                      </label>
                      {(section.tableColumns ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[2fr_1fr_auto]"
                        >
                          <Input
                            value={c.name}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) =>
                              update(section.id, {
                                tableColumns: (section.tableColumns ?? []).map(
                                  (x) =>
                                    x.id === c.id
                                      ? { ...x, name: e.target.value }
                                      : x,
                                ),
                              })
                            }
                            placeholder="Column name"
                          />
                          <Select
                            value={c.type ?? "text"}
                            onChange={(e) =>
                              update(section.id, {
                                tableColumns: (section.tableColumns ?? []).map(
                                  (x) =>
                                    x.id === c.id
                                      ? {
                                          ...x,
                                          type: e.target
                                            .value as TableColumnDef["type"],
                                        }
                                      : x,
                                ),
                              })
                            }
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="currency">Currency (INR)</option>
                            <option value="date">Date</option>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Remove column"
                            onClick={() => removeTableColumn(section, c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start text-brand-600 hover:text-brand-700 dark:text-brand-400"
                        onClick={() => addTableColumn(section)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Column
                      </Button>
                    </div>

                    {(section.tableColumns ?? []).length > 0 && (
                      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                        <label className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                          Default Rows (Optional)
                        </label>
                        <p className="text-theme-xs text-gray-500">
                          Pre-populate sample or standard rows for new
                          proposals.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-theme-xs">
                            <thead>
                              <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700">
                                <th className="w-8 py-1.5 pr-2">#</th>
                                {(section.tableColumns ?? []).map((col) => (
                                  <th key={col.id} className="py-1.5 pr-2">
                                    {col.name}
                                  </th>
                                ))}
                                <th className="w-8 py-1.5"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(section.defaultRows ?? []).map(
                                (row, rowIdx) => (
                                  <tr key={`row-${rowIdx}`}>
                                    <td className="py-1 pr-2 align-top text-gray-400">
                                      {rowIdx + 1}
                                    </td>
                                    {(section.tableColumns ?? []).map((col) => {
                                      const colType = (col.type ?? "text") as
                                        "text" | "number" | "currency" | "date";
                                      const cellVal = row[col.id] ?? "";
                                      const cellError = getFieldValidationError(
                                        colType,
                                        cellVal,
                                      );
                                      return (
                                        <td
                                          key={col.id}
                                          className="py-1 pr-2 align-top"
                                        >
                                          <Input
                                            value={cellVal}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                e.preventDefault();
                                            }}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (
                                                filterTypedValue(colType, val)
                                              ) {
                                                updateTableCell(
                                                  section,
                                                  rowIdx,
                                                  col.id,
                                                  val,
                                                );
                                              }
                                            }}
                                            placeholder={
                                              colType === "date"
                                                ? "DD/MM/YYYY"
                                                : colType === "currency"
                                                  ? "0.00"
                                                  : col.name
                                            }
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
                                    <td className="py-1 align-top">
                                      <button
                                        type="button"
                                        aria-label={`Delete row ${rowIdx + 1}`}
                                        onClick={() =>
                                          removeTableRow(section, rowIdx)
                                        }
                                        className="rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="self-start text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          onClick={() => addTableRow(section)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add Default Row
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {section.type === "signature" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Signatories
                    </label>
                    {(section.signatureFields ?? []).map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Input
                          value={f.label}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                          onChange={(e) =>
                            update(section.id, {
                              signatureFields: (
                                section.signatureFields ?? []
                              ).map((x) =>
                                x.id === f.id
                                  ? { ...x, label: e.target.value }
                                  : x,
                              ),
                            })
                          }
                          placeholder="Signatory label (e.g. Authorized Signatory, Client Representative)"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Remove signatory"
                          onClick={() =>
                            update(section.id, {
                              signatureFields: (
                                section.signatureFields ?? []
                              ).filter((x) => x.id !== f.id),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      onClick={() => addSignatureField(section)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Signatory
                    </Button>
                  </div>
                )}

                {section.type === "section_group" && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
                    <SectionBuilder
                      sections={section.children ?? []}
                      onChange={(children) => update(section.id, { children })}
                      depth={depth + 1}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      onClick={() =>
                        update(section.id, {
                          children: [
                            ...(section.children ?? []),
                            newSection((section.children ?? []).length + 1),
                          ],
                        })
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Sub-section
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove section"
                onClick={() => remove(section.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={addSection}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add Section
      </Button>
    </div>
  );
}
