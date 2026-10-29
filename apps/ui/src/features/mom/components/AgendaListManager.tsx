"use client";

import type { MomAgendaItem } from "@texawave-erp/api-types";
import { Button, Input } from "@texawave-erp/ui-kit";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { rowId } from "../utils";

export interface AgendaListManagerProps {
  agenda: MomAgendaItem[];
  onChange: (next: MomAgendaItem[]) => void;
  disabled?: boolean;
  title?: string;
}

function renumber(items: MomAgendaItem[]): MomAgendaItem[] {
  return items.map((item, i) => ({ ...item, order: i + 1 }));
}

/** Legacy `mom/components/AgendaListManager.tsx` — numbered topics with
 * add / inline edit / reorder / delete, plus optional presenter and
 * duration per topic. */
export function AgendaListManager({
  agenda,
  onChange,
  disabled = false,
  title = "Numbered Agenda Topics",
}: AgendaListManagerProps) {
  const [newTopic, setNewTopic] = useState("");
  const items = [...agenda].sort((a, b) => a.order - b.order);

  function add() {
    if (!newTopic.trim()) return;
    onChange(
      renumber([
        ...items,
        { id: rowId("ag"), order: items.length + 1, topic: newTopic.trim() },
      ]),
    );
    setNewTopic("");
  }

  function update(id: string, patch: Partial<MomAgendaItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(renumber(next));
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
        <ListOrdered className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        {title}
      </h3>

      {!disabled ? (
        <div className="flex gap-2">
          <Input
            aria-label="New agenda topic"
            placeholder="Add new agenda topic..."
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" onClick={add} disabled={!newTopic.trim()}>
            <Plus className="h-4 w-4" />
            Add Topic
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 py-4 text-center text-theme-xs italic text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No agenda topics added.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {index + 1}
              </span>
              {disabled ? (
                <div className="min-w-0 flex-1 text-theme-sm text-gray-800 dark:text-gray-200">
                  <span className="font-medium">{item.topic}</span>
                  {item.presenter ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      {" "}
                      — {item.presenter}
                    </span>
                  ) : null}
                  {item.durationMinutes ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      {" "}
                      ({item.durationMinutes} min)
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-6">
                  <Input
                    aria-label={`Agenda topic ${index + 1}`}
                    placeholder="Agenda topic"
                    value={item.topic}
                    onChange={(e) => update(item.id, { topic: e.target.value })}
                    className="sm:col-span-4"
                  />
                  <Input
                    aria-label={`Presenter for topic ${index + 1}`}
                    placeholder="Presenter"
                    value={item.presenter ?? ""}
                    onChange={(e) =>
                      update(item.id, {
                        presenter: e.target.value || undefined,
                      })
                    }
                  />
                  <Input
                    aria-label={`Duration in minutes for topic ${index + 1}`}
                    placeholder="Min"
                    type="number"
                    min={0}
                    value={item.durationMinutes ?? ""}
                    onChange={(e) =>
                      update(item.id, {
                        durationMinutes: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
              )}
              {!disabled ? (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label="Move topic up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move topic down"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete topic"
                    onClick={() =>
                      onChange(renumber(items.filter((i) => i.id !== item.id)))
                    }
                    className="rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
