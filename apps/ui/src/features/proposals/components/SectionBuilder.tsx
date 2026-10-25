"use client";

import type {
  ProposalSectionConfig,
  ProposalSectionContentType,
} from "@texawave-erp/api-types";
import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

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
function uid() {
  uidCounter += 1;
  return `section-${Date.now()}-${uidCounter}`;
}

export function newSection(order: number): ProposalSectionConfig {
  return { id: uid(), title: "New Section", type: "short_text", order };
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

  function updateListItems(section: ProposalSectionConfig, raw: string) {
    update(section.id, {
      defaultItems: raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  function addKeyValueField(section: ProposalSectionConfig) {
    update(section.id, {
      keyValueFields: [
        ...(section.keyValueFields ?? []),
        { id: uid(), label: "Field", type: "text" },
      ],
    });
  }

  function addTableColumn(section: ProposalSectionConfig) {
    update(section.id, {
      tableColumns: [
        ...(section.tableColumns ?? []),
        { id: uid(), name: "Column", type: "text" },
      ],
    });
  }

  function addSignatureField(section: ProposalSectionConfig) {
    update(section.id, {
      signatureFields: [
        ...(section.signatureFields ?? []),
        { id: uid(), label: "Name", type: "name" },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => (
        <div
          key={section.id}
          className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <Input
                  value={section.title}
                  onChange={(e) =>
                    update(section.id, { title: e.target.value })
                  }
                  placeholder="Section title"
                />
                <Select
                  value={section.type}
                  onChange={(e) =>
                    update(section.id, {
                      type: e.target.value as ProposalSectionContentType,
                    })
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

              {(section.type === "bullet_list" ||
                section.type === "numbered_list" ||
                section.type === "checklist") && (
                <div>
                  <label className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Default items (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={(section.defaultItems ?? []).join("\n")}
                    onChange={(e) => updateListItems(section, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              )}

              {section.type === "key_value" && (
                <div className="flex flex-col gap-2">
                  {(section.keyValueFields ?? []).map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <Input
                        value={f.label}
                        onChange={(e) =>
                          update(section.id, {
                            keyValueFields: (section.keyValueFields ?? []).map(
                              (x) =>
                                x.id === f.id
                                  ? { ...x, label: e.target.value }
                                  : x,
                            ),
                          })
                        }
                        placeholder="Field label"
                      />
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
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyValueField(section)}
                  >
                    Add Field
                  </Button>
                </div>
              )}

              {section.type === "table" && (
                <div className="flex flex-col gap-2">
                  {(section.tableColumns ?? []).map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Input
                        value={c.name}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Remove column"
                        onClick={() =>
                          update(section.id, {
                            tableColumns: (section.tableColumns ?? []).filter(
                              (x) => x.id !== c.id,
                            ),
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
                    onClick={() => addTableColumn(section)}
                  >
                    Add Column
                  </Button>
                </div>
              )}

              {section.type === "signature" && (
                <div className="flex flex-col gap-2">
                  {(section.signatureFields ?? []).map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <Input
                        value={f.label}
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
                        placeholder="Signatory label"
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
                    onClick={() => addSignatureField(section)}
                  >
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
                    className="mt-2"
                    onClick={() =>
                      update(section.id, {
                        children: [
                          ...(section.children ?? []),
                          newSection((section.children ?? []).length + 1),
                        ],
                      })
                    }
                  >
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
      ))}

      <Button type="button" variant="secondary" onClick={addSection}>
        Add Section
      </Button>
    </div>
  );
}
