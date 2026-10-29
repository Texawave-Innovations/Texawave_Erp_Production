"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
 * Enterprise Tab list with Spring Glide indicator + panel (WAI-ARIA tabs).
 * Employs the signature TexaOne spring glide indicator pill for fluid navigation across all views.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabId = (id: T) => `${idPrefix}-tab-${id}`;
  const panelId = (id: T) => `${idPrefix}-panel-${id}`;

  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    const selectedIndex = tabs.findIndex((t) => t.id === value);
    if (selectedIndex === -1) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const buttonEl = refs.current[selectedIndex];
    if (!buttonEl) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = buttonEl.getBoundingClientRect();
    const left = btnRect.left - containerRect.left;
    const top = btnRect.top - containerRect.top;
    const width = btnRect.width;
    const height = btnRect.height;

    setIndicatorStyle({
      left,
      top,
      width,
      height,
      opacity: 1,
    });
  }, [tabs, value]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

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
        ref={containerRef}
        role="tablist"
        aria-label={label}
        className="relative flex w-full flex-wrap gap-1 rounded-xl border border-sky-200/70 bg-sky-50/60 p-1 sm:inline-flex sm:w-auto sm:self-start backdrop-blur-md dark:border-sky-900/50 dark:bg-gray-800/60 isolate"
      >
        {/* Spring Glide Active Indicator Pill */}
        <span
          aria-hidden="true"
          className="tab-prime-pill absolute pointer-events-none z-0 rounded-lg shadow-sm transition-[left,top,width,height,opacity] duration-200 ease-spring-glide motion-reduce:transition-none"
          style={{
            left: `${indicatorStyle.left}px`,
            top: `${indicatorStyle.top}px`,
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity,
          }}
        />

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
                "relative z-1 flex-1 rounded-lg px-4 py-2 text-theme-sm transition-all sm:flex-none",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-500/30",
                selected
                  ? "bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 text-white shadow-theme-xs dark:from-blue-600 dark:via-brand-500 dark:to-cyan-500 dark:text-white dark:shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold"
                  : "font-medium text-slate-600 hover:text-[#0a3271] hover:bg-white hover:shadow-2xs dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-700/60",
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
