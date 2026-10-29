"use client";

import type { MomSectionConfig, MomSectionType } from "@texawave-erp/api-types";
import { Button, Input, Select, Textarea } from "@texawave-erp/ui-kit";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { rowId } from "../utils";

/** Legacy `SECTION_TYPE_META` from `MomTemplateBuilderPage.tsx`. */
export const MOM_SECTION_TYPE_META: Record<
  MomSectionType,
  { label: string; description: string }
> = {
  company_header: {
    label: "Company Header",
    description: "Corporate branding, contact details, and logo.",
  },
  meeting_details: {
    label: "Meeting Details & Context",
    description: "Title, linked project, date, time, timezone, and location.",
  },
  people_lists: {
    label: "Attendance & Quorum",
    description: "Attendees present or remote, and recorded absentees.",
  },
  agenda_list: {
    label: "Numbered Agenda",
    description: "Ordered list of agenda topics.",
  },
  meeting_notes_table: {
    label: "Deliberations & Action Items",
    description: "Discussion points and action items per agenda topic.",
  },
  free_text: {
    label: "Free Text Notes",
    description: "Narrative section such as a summary or next steps.",
  },
};

/** Section types that may appear only once in a document. */
const SINGLETON_TYPES: MomSectionType[] = [
  "company_header",
  "meeting_details",
  "people_lists",
  "agenda_list",
  "meeting_notes_table",
];

function renumber(sections: MomSectionConfig[]): MomSectionConfig[] {
  return sections.map((s, i) => ({ ...s, order: i + 1 }));
}

/** Legacy `MomTemplateBuilderPage.tsx` "Configured Sections" panel —
 * reorder, rename, describe, toggle visible/required, add and remove
 * sections. Fixed-content types can appear once; free-text sections can be
 * added any number of times. */
export function MomSectionBuilder({
  sections,
  onChange,
  readOnly = false,
}: {
  sections: MomSectionConfig[];
  onChange: (next: MomSectionConfig[]) => void;
  readOnly?: boolean;
}) {
  const [addType, setAddType] = useState<MomSectionType>("free_text");
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const usedTypes = new Set(sorted.map((s) => s.type));
  const addable = (
    Object.keys(MOM_SECTION_TYPE_META) as MomSectionType[]
  ).filter((t) => !SINGLETON_TYPES.includes(t) || !usedTypes.has(t));
  const effectiveAddType = addable.includes(addType)
    ? addType
    : (addable[0] ?? "free_text");

  function update(id: string, patch: Partial<MomSectionConfig>) {
    onChange(sorted.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(renumber(next));
  }

  function add() {
    const meta = MOM_SECTION_TYPE_META[effectiveAddType];
    onChange(
      renumber([
        ...sorted,
        {
          id: rowId("sec"),
          type: effectiveAddType,
          title: meta.label,
          order: sorted.length + 1,
          visible: true,
          required: false,
          description: meta.description,
          ...(effectiveAddType === "free_text" ? { defaultContent: "" } : {}),
        },
      ]),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((section, index) => (
        <div
          key={section.id}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-start gap-3">
            {!readOnly ? (
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${section.title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${section.title} down`}
                  disabled={index === sorted.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Section ${index + 1} title`}
                  value={section.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    update(section.id, { title: e.target.value })
                  }
                  className="min-w-[200px] flex-1"
                />
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {MOM_SECTION_TYPE_META[section.type]?.label ?? section.type}
                </span>
              </div>
              <Input
                aria-label={`Section ${index + 1} description`}
                placeholder="Guidance shown to whoever records the meeting"
                value={section.description ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  update(section.id, {
                    description: e.target.value || undefined,
                  })
                }
              />
              {section.type === "free_text" ? (
                <Textarea
                  aria-label={`Default text for ${section.title}`}
                  placeholder="Default text pre-filled into new meetings (optional)"
                  rows={2}
                  value={section.defaultContent ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    update(section.id, { defaultContent: e.target.value })
                  }
                />
              ) : null}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-theme-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={section.visible}
                    disabled={readOnly}
                    onChange={(e) =>
                      update(section.id, { visible: e.target.checked })
                    }
                  />
                  Visible in document
                </label>
                <label className="flex items-center gap-1.5 text-theme-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={section.required}
                    disabled={readOnly}
                    onChange={(e) =>
                      update(section.id, { required: e.target.checked })
                    }
                  />
                  Required to finalize
                </label>
              </div>
            </div>
            {!readOnly ? (
              <button
                type="button"
                aria-label={`Remove ${section.title}`}
                onClick={() =>
                  onChange(renumber(sorted.filter((s) => s.id !== section.id)))
                }
                className="rounded-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {!readOnly && addable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
          <Select
            aria-label="Section type to add"
            value={effectiveAddType}
            onChange={(e) => setAddType(e.target.value as MomSectionType)}
            className="w-64"
          >
            {addable.map((t) => (
              <option key={t} value={t}>
                {MOM_SECTION_TYPE_META[t].label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>
      ) : null}
    </div>
  );
}
