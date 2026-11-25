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
  /**
   * Render the tab panel (default). Pass `false` when the tabs only drive a
   * filter or view and there is no per-tab panel — otherwise an empty,
   * focusable `tabpanel` is emitted.
   */
  panel?: boolean;
  className?: string;
  /**
   * `default` — the original boxed tab bar (opt in explicitly).
   * `capsule` (the default) — a fully rounded capsule with a rounded pill that glides between
   *   tabs (only the pill moves; labels just change colour, never weight, so
   *   nothing re-measures mid-slide). Stays on one line and scrolls sideways
   *   on narrow screens, keeping the selected tab in view.
   */
  variant?: TabsVariant;
}

export type TabsVariant = "default" | "capsule";

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
  panel = true,
  className,
  variant = "capsule",
}: TabsProps<T>) {
  const capsule = variant === "capsule";
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
    let left: number, top: number, width: number, height: number;
    if (capsule) {
      // Offsets are relative to the tablist padding box, so they stay right
      // when the capsule scrolls sideways and ignore its border.
      left = buttonEl.offsetLeft;
      top = buttonEl.offsetTop;
      width = buttonEl.offsetWidth;
      height = buttonEl.offsetHeight;
    } else {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = buttonEl.getBoundingClientRect();
      left = btnRect.left - containerRect.left;
      top = btnRect.top - containerRect.top;
      width = btnRect.width;
      height = btnRect.height;
    }

    setIndicatorStyle({
      left,
      top,
      width,
      height,
      opacity: 1,
    });
  }, [tabs, value, capsule]);

  // Capsule: no transition until the pill has its first position, so it
  // appears in place on load instead of sliding in from the corner.
  const [glideReady, setGlideReady] = useState(false);

  useEffect(() => {
    updateIndicator();
    if (!capsule) return;
    const frame = requestAnimationFrame(() => setGlideReady(true));
    return () => cancelAnimationFrame(frame);
  }, [updateIndicator, capsule]);

  // Capsule: keep the selected tab visible when the capsule scrolls sideways.
  useEffect(() => {
    if (!capsule || !containerRef.current) return;
    const index = tabs.findIndex((t) => t.id === value);
    const el = refs.current[index];
    const box = containerRef.current;
    if (!el || box.scrollWidth <= box.clientWidth) return;
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [capsule, tabs, value]);

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
        className={
          capsule
            ? "relative isolate flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full border border-sky-100 bg-white/90 p-1.5 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-sky-900/50 dark:bg-gray-900/80 dark:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.7)]"
            : "relative flex w-full flex-wrap gap-1 rounded-xl border border-sky-200/70 bg-sky-50/60 p-1 sm:inline-flex sm:w-auto sm:self-start backdrop-blur-md dark:border-sky-900/50 dark:bg-gray-800/60 isolate"
        }
      >
        {/* Spring Glide Active Indicator Pill */}
        {capsule ? (
          <span
            aria-hidden="true"
            className={cn(
              "tab-prime-pill pointer-events-none absolute left-0 top-0 z-0 rounded-full will-change-transform motion-reduce:transition-none",
              glideReady &&
                "transition-[transform,width,height,opacity] duration-300 ease-spring-glide",
            )}
            style={{
              transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />
        ) : (
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
        )}

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
              aria-controls={panel ? panelId(tab.id) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={
                capsule
                  ? cn(
                      "relative z-1 shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-theme-sm font-medium transition-colors duration-300 ease-spring-glide motion-reduce:transition-none",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-500/30",
                      selected
                        ? "text-white"
                        : "text-slate-600 hover:text-[#0a3271] dark:text-gray-300 dark:hover:text-white",
                    )
                  : cn(
                      "relative z-1 flex-1 rounded-lg px-4 py-2 text-theme-sm transition-all sm:flex-none",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-500/30",
                      selected
                        ? "bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 text-white shadow-theme-xs dark:from-blue-600 dark:via-brand-500 dark:to-cyan-500 dark:text-white dark:shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold"
                        : "font-medium text-slate-600 hover:text-[#0a3271] hover:bg-white hover:shadow-2xs dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-700/60",
                    )
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {panel ? (
        <div
          role="tabpanel"
          id={panelId(value)}
          aria-labelledby={tabId(value)}
          tabIndex={0}
          className="min-w-0 focus-visible:outline-none"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
