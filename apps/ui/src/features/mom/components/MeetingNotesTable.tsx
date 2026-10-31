"use client";

import type { MomAgendaItem, MomNoteRow } from "@texawave-erp/api-types";
import { Button, Textarea } from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  ListPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { normalizeNoteRows, rowId } from "../utils";

export interface MeetingNotesTableProps {
  rows: MomNoteRow[];
  onChange: (next: MomNoteRow[]) => void;
  /** Used by "Add rows from agenda" to seed one row per agenda topic. */
  agenda?: MomAgendaItem[];
  disabled?: boolean;
  title?: string;
  error?: string | undefined;
}

function renumber(rows: MomNoteRow[]): MomNoteRow[] {
  return rows.map((r, i) => ({ ...r, order: i + 1 }));
}

/** Legacy `mom/components/MeetingNotesTable.tsx` — S.No / Agenda Item /
 * Discussion Points / Action Items grid with add, reorder and delete. */
export function MeetingNotesTable({
  rows,
  onChange,
  agenda = [],
  disabled = false,
  title = "Deliberations & Action Items",
  error,
}: MeetingNotesTableProps) {
  const normalizedRows = useMemo(() => normalizeNoteRows(rows), [rows]);
  const sorted = useMemo(
    () => [...normalizedRows].sort((a, b) => a.order - b.order),
    [normalizedRows],
  );

  function update(
    id: string,
    field: "agendaItem" | "discussionPoints" | "actionItems",
    value: string,
  ) {
    onChange(sorted.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(renumber(next));
  }

  function addRow() {
    onChange(
      renumber([
        ...sorted,
        {
          id: rowId("nr"),
          order: sorted.length + 1,
          agendaItem: "",
          discussionPoints: "",
          actionItems: "",
        },
      ]),
    );
  }

  /** Adds a row for every agenda topic not already covered by a row. */
  function addFromAgenda() {
    const covered = new Set(
      sorted.map((r) => (r.agendaItem ?? "").trim().toLowerCase()),
    );
    const additions = [...agenda]
      .sort((a, b) => a.order - b.order)
      .filter(
        (a) =>
          (a.topic ?? "").trim() &&
          !covered.has((a.topic ?? "").trim().toLowerCase()),
      )
      .map((a) => ({
        id: rowId("nr"),
        order: 0,
        agendaItem: (a.topic ?? "").trim(),
        discussionPoints: "",
        actionItems: "",
      }));
    if (additions.length > 0) onChange(renumber([...sorted, ...additions]));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          <ClipboardList className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          {title}
        </h3>
        {!disabled ? (
          <div className="flex gap-2">
            {agenda.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addFromAgenda}
              >
                <ListPlus className="h-4 w-4" />
                Rows from Agenda
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50/70 p-3 text-theme-xs font-medium text-error-600 dark:border-error-900/60 dark:bg-error-950/40 dark:text-error-400"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-error-500" />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        className={
          error
            ? "overflow-x-auto rounded-xl border border-rose-300 dark:border-rose-700"
            : "overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800"
        }
      >
        <table className="w-full min-w-[720px] text-left text-theme-sm">
          <thead className="bg-gray-50 text-theme-xs font-semibold uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th scope="col" className="w-14 px-3 py-2 text-center">
                S.No
              </th>
              <th scope="col" className="w-1/4 px-3 py-2">
                Agenda Item
              </th>
              <th scope="col" className="px-3 py-2">
                Discussion Points
              </th>
              <th scope="col" className="px-3 py-2">
                Action Items
              </th>
              {!disabled ? (
                <th scope="col" className="w-24 px-3 py-2">
                  <span className="sr-only">Row actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={disabled ? 4 : 5}
                  className="px-3 py-6 text-center text-theme-xs italic text-gray-500 dark:text-gray-400"
                >
                  No meeting notes recorded.
                </td>
              </tr>
            ) : (
              sorted.map((row, index) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">
                    {index + 1}
                  </td>
                  {disabled ? (
                    <>
                      <td className="whitespace-pre-wrap px-3 py-2 font-medium text-gray-900 dark:text-white/90">
                        {row.agendaItem || "—"}
                      </td>
                      <td className="whitespace-pre-wrap px-3 py-2 text-gray-700 dark:text-gray-300">
                        {row.discussionPoints || "—"}
                      </td>
                      <td className="whitespace-pre-wrap px-3 py-2 text-gray-700 dark:text-gray-300">
                        {row.actionItems || "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2">
                        <Textarea
                          aria-label={`Agenda item for row ${index + 1}`}
                          rows={2}
                          placeholder="e.g. Milestone 2 Deliverables"
                          value={row.agendaItem ?? ""}
                          onChange={(e) =>
                            update(row.id, "agendaItem", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Textarea
                          aria-label={`Discussion points for row ${index + 1}`}
                          rows={3}
                          placeholder="Deliberations, consensus, and key notes..."
                          value={row.discussionPoints ?? ""}
                          onChange={(e) =>
                            update(row.id, "discussionPoints", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Textarea
                          aria-label={`Action items for row ${index + 1}`}
                          rows={3}
                          placeholder="Action items, owners, and agreed target dates..."
                          value={row.actionItems ?? ""}
                          onChange={(e) =>
                            update(row.id, "actionItems", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            aria-label="Move row up"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move row down"
                            disabled={index === sorted.length - 1}
                            onClick={() => move(index, 1)}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete row"
                            onClick={() =>
                              onChange(
                                renumber(sorted.filter((r) => r.id !== row.id)),
                              )
                            }
                            className="rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
