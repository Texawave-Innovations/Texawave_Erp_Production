"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, Check } from "lucide-react";
import { useNotify } from "@/hooks/useNotify";
import { useSetDnd } from "../hooks";
import {
  DND_OFF_REQUEST,
  DND_PRESETS,
  dndRequestFor,
  type DndPresetId,
} from "../dnd";
import type { DndState } from "../types";

/**
 * Do Not Disturb, like Microsoft's snooze: pick how long, and the bell badge
 * stays quiet. Notifications are still received and listed; only the red
 * count is hidden until it ends.
 */
export function DoNotDisturbMenu({ state }: { state: DndState | undefined }) {
  const { notifyError } = useNotify();
  const setDnd = useSetDnd();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = state?.active ?? false;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  async function apply(body: ReturnType<typeof dndRequestFor>) {
    setOpen(false);
    try {
      await setDnd.mutateAsync(body);
    } catch (error) {
      notifyError(error, "notifications.dnd.failed");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={setDnd.isPending}
        className={`inline-flex items-center gap-1 text-[11px] font-bold hover:underline disabled:opacity-50 cursor-pointer transition-colors ${
          active
            ? "text-amber-700 dark:text-amber-300"
            : "text-slate-600 hover:text-slate-800 dark:text-slate-300"
        }`}
      >
        <BellOff className="h-3.5 w-3.5" />
        <span>{active ? "Snoozed" : "Snooze"}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Do not disturb"
          className="absolute right-0 z-10 mt-1 w-56 rounded-2xl border border-sky-100/90 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Do not disturb for
          </p>
          {DND_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() =>
                void apply(dndRequestFor(p.id as DndPresetId, new Date()))
              }
              className="flex w-full items-center rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-sky-50 cursor-pointer dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {p.label}
            </button>
          ))}
          {active && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void apply(DND_OFF_REQUEST)}
              className="mt-1 flex w-full items-center gap-1.5 rounded-xl border-t border-slate-100 px-2.5 py-1.5 text-left text-xs font-bold text-brand-700 hover:bg-sky-50 cursor-pointer dark:border-slate-800 dark:text-cyan-300 dark:hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" />
              Turn off
            </button>
          )}
        </div>
      )}
    </div>
  );
}
