"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@texawave-erp/ui-kit";

const emptySubscribe = () => () => {};

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const CLOSE_ALL_FILTER_SELECTS = "texawave:close-filter-selects";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  id?: string;
  label: string; // Accessible label for screen readers
  prefix?: string; // Optional prefix e.g. "Role", "Team", "Status"
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  className?: string;
}

interface Coords {
  top: number;
  left: number;
  minWidth: number;
  placement: "bottom" | "top";
}

function computeFilterCoords(
  triggerEl: HTMLElement,
  optionsCount: number,
): Coords {
  const rect = triggerEl.getBoundingClientRect();
  const minWidth = Math.max(rect.width, 160);
  const panelHeight = Math.min(optionsCount * 36 + 16, 260);

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  const shouldFlip = spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow;

  let top = shouldFlip ? rect.top - panelHeight - 4 : rect.bottom + 4;
  if (top < 8) top = 8;

  let left = rect.left;
  if (left + minWidth > window.innerWidth - 8) {
    left = window.innerWidth - minWidth - 8;
  }
  if (left < 8) left = 8;

  return {
    top,
    left,
    minWidth,
    placement: shouldFlip ? "top" : "bottom",
  };
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  id?: string;
  label: string;
  prefix?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
  triggerClassName?: string;
  fullWidth?: boolean;
}

export function FilterSelect({
  id,
  label,
  prefix,
  value,
  onChange,
  options,
  className,
  triggerClassName,
  fullWidth = false,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [coords, setCoords] = useState<Coords | null>(null);

  const autoId = useId();
  const selectId = id || autoId;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];
  const isFiltered = value !== "all" && value !== "";

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    setCoords(computeFilterCoords(triggerRef.current, options.length));
  }, [options.length]);

  useIsomorphicLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function handleScrollOrResize() {
      updatePosition();
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  // Ensure only one FilterSelect can ever be open at a time across the entire application
  useEffect(() => {
    function handleCloseOthers(e: Event) {
      const customEvent = e as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id !== selectId) {
        setOpen(false);
      }
    }

    window.addEventListener(CLOSE_ALL_FILTER_SELECTS, handleCloseOthers);
    return () => {
      window.removeEventListener(CLOSE_ALL_FILTER_SELECTS, handleCloseOthers);
    };
  }, [selectId]);

  // Click outside and ESC key dismiss handler
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      // Close any other open dropdowns immediately before opening this one
      window.dispatchEvent(
        new CustomEvent(CLOSE_ALL_FILTER_SELECTS, {
          detail: { id: selectId },
        }),
      );
      if (triggerRef.current) {
        setCoords(computeFilterCoords(triggerRef.current, options.length));
      }
      const idx = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        const option = options[focusedIndex];
        if (option) {
          onChange(option.value);
        }
        setOpen(false);
        triggerRef.current?.focus();
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const displayText = prefix
    ? `${prefix}: ${selectedOption?.label ?? value}`
    : (selectedOption?.label ?? value);

  const panelNode =
    open && coords ? (
      <div
        ref={panelRef}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          minWidth: `${coords.minWidth}px`,
          maxWidth: "calc(100vw - 16px)",
        }}
        className={cn(
          "glass-dropdown z-50 max-h-64 overflow-y-auto rounded-xl p-1 shadow-theme-lg",
          "animate-in fade-in-0 zoom-in-95 duration-100 ease-out",
          "motion-reduce:animate-none motion-reduce:transition-none",
          coords.placement === "top" ? "origin-bottom-left" : "origin-top-left",
        )}
      >
        {options.map((option, idx) => {
          const isSelected = option.value === value;
          const isFocused = idx === focusedIndex;

          return (
            <div
              key={option.value}
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              onMouseEnter={() => setFocusedIndex(idx)}
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-theme-xs font-medium transition-colors cursor-pointer select-none",
                isSelected
                  ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/20 dark:text-brand-300"
                  : isFocused
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60",
              )}
            >
              <span className="truncate">{option.label}</span>
              {isSelected && (
                <Check className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
              )}
            </div>
          );
        })}
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "relative",
        fullWidth ? "w-full block" : "inline-block",
        className,
      )}
    >
      {/* Hidden native select for accessibility and form automation compatibility */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Styled Interactive Trigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-1 text-theme-xs font-medium shadow-theme-xs transition-all",
          fullWidth ? "w-full h-10" : "h-9",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500",
          isFiltered
            ? "border-brand-500/40 bg-brand-50/40 text-brand-800 font-semibold dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300 dark:hover:border-gray-700",
          triggerClassName,
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200",
            open && "rotate-180 text-brand-600 dark:text-brand-400",
            isFiltered && "text-brand-600 dark:text-brand-400",
          )}
        />
      </button>

      {isMounted && typeof document !== "undefined" && panelNode
        ? createPortal(panelNode, document.body)
        : null}
    </div>
  );
}
