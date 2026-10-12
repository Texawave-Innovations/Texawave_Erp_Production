"use client";

import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
}

export interface TabsProps<T extends string> {
  /** Accessible name of the tab list, e.g. "Payroll sections". */
  label: string;
  /** Prefix for the tab/panel element ids — unique per page. */
  idPrefix: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Content of the selected tab, rendered inside the tab panel. */
  children?: ReactNode;
  className?: string;
}

/**
 * Tab list + one panel (WAI-ARIA tabs, automatic activation). Controlled:
 * the caller owns `value`, so it decides which tabs exist (e.g. per
 * permission) and what to fall back to. Arrow keys / Home / End move between
 * tabs; only the selected tab is in the Tab order.
 */
export function Tabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
  children,
  className,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabId = (id: T) => `${idPrefix}-tab-${id}`;
  const panelId = (id: T) => `${idPrefix}-panel-${id}`;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[next]?.focus();
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={label}
        className="flex w-full flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:inline-flex sm:w-auto sm:self-start dark:border-gray-800 dark:bg-gray-800/50"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors sm:flex-none",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20",
                selected
                  ? "bg-brand-500 text-gray-900 shadow-theme-xs"
                  : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(value)}
        aria-labelledby={tabId(value)}
        tabIndex={0}
        className="min-w-0 focus-visible:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
