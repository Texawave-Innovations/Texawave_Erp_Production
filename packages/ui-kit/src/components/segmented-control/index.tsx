"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  badge?: ReactNode | undefined;
  icon?: ComponentType<{ className?: string }> | undefined;
}

export interface SpringGlideSegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
  ariaLabel?: string | undefined;
  size?: "sm" | "md" | undefined;
}

/**
 * Reusable SpringGlideSegmentedControl component.
 * Features the signature TexaOne spring-glide pill transition animation.
 * Reusable across dashboard controls, filter tabs, and period selectors.
 */
export function SpringGlideSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = "",
  ariaLabel = "Select option",
  size = "sm",
}: SpringGlideSegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    const buttonEl = buttonRefs.current.get(value);
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
  }, [value]);

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

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "relative flex items-center rounded-xl border border-sky-200/70 bg-sky-50/60 p-1 backdrop-blur-md dark:border-sky-900/50 dark:bg-gray-800/60 isolate",
        className,
      )}
    >
      {/* Spring Glide Active Indicator Pill */}
      <span
        aria-hidden="true"
        className="glass-pill absolute pointer-events-none z-0 rounded-lg shadow-xs transition-[left,top,width,height,opacity] duration-200 ease-spring-glide motion-reduce:transition-none"
        style={{
          left: `${indicatorStyle.left}px`,
          top: `${indicatorStyle.top}px`,
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
          opacity: indicatorStyle.opacity,
        }}
      />

      {options.map((option) => {
        const isSelected = option.id === value;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.id, el);
              else buttonRefs.current.delete(option.id);
            }}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative z-1 flex items-center justify-center gap-1.5 rounded-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
              isSmall ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              isSelected
                ? "text-brand-800 dark:text-cyan-200"
                : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            {Icon && <Icon className={isSmall ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            <span>{option.label}</span>
            {option.badge && <span className="ml-1">{option.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
