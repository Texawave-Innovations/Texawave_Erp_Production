"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../button/index";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES_SHORT,
  formatDateISO,
  parseDateISO,
  formatDisplayDate,
  getDaysInMonth,
  getFirstDayOfWeek,
  countDays,
  DEFAULT_DATE_PRESETS,
  type PresetRange,
} from "./utils";

export interface DateRangeValue {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface DateRangePickerProps {
  value?: DateRangeValue;
  defaultValue?: DateRangeValue;
  onChange?: (range: DateRangeValue) => void;
  onApply?: (range: DateRangeValue) => void;
  onClear?: () => void;
  placeholder?: string;
  fromAriaLabel?: string;
  toAriaLabel?: string;
  minDate?: string;
  maxDate?: string;
  maxRangeDays?: number;
  showPresets?: boolean;
  presets?: PresetRange[];
  disabled?: boolean;
  /**
   * "inputs": Renders explicit accessible textboxes for "From" and "To" with calendar toggle.
   * "button": Renders a unified compact trigger pill showing the formatted range.
   */
  variant?: "inputs" | "button";
  align?: "left" | "right";
  placement?: "top" | "bottom" | "auto";
  className?: string;
  id?: string;
}

export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  onApply,
  onClear,
  placeholder = "Select date range",
  fromAriaLabel = "From date",
  toAriaLabel = "To date",
  minDate,
  maxDate,
  maxRangeDays: _maxRangeDays,
  showPresets = true,
  presets = DEFAULT_DATE_PRESETS,
  disabled = false,
  variant: _variant = "inputs",
  align = "left",
  placement = "auto",
  className,
  id,
}: DateRangePickerProps) {
  const generatedId = useId();
  const pickerId = id || generatedId;

  // Controlled or uncontrolled current range
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<DateRangeValue>(
    defaultValue ?? { from: "", to: "" },
  );
  const currentRange = isControlled ? value : internalValue;

  // Popover state
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState(currentRange.from);
  const [pendingTo, setPendingTo] = useState(currentRange.to);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Calendar view navigation (Year and Month)
  const initialDate = parseDateISO(currentRange.from) || new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Dynamic collision detection (flips to top if bottom space is insufficient)
  const [effectivePlacement, setEffectivePlacement] = useState<
    "top" | "bottom"
  >("bottom");
  const [effectiveAlign, setEffectiveAlign] = useState<"left" | "right">(align);

  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 390;
    const popoverWidth = 540;

    // Find closest scrollable or clipping container (dialog, modal, card, or viewport)
    const scrollParent = containerRef.current.closest<HTMLElement>(
      'dialog, [role="dialog"], .overflow-y-auto, .overflow-auto, .overflow-hidden',
    );
    const containerRect = scrollParent
      ? scrollParent.getBoundingClientRect()
      : {
          top: 0,
          bottom: window.innerHeight,
          left: 0,
          right: window.innerWidth,
        };

    // Effective space relative to container and viewport
    const effectiveBottom = Math.min(window.innerHeight, containerRect.bottom);
    const effectiveTop = Math.max(0, containerRect.top);
    const effectiveRight = Math.min(window.innerWidth, containerRect.right);
    const effectiveLeft = Math.max(0, containerRect.left);

    const spaceBelow = effectiveBottom - rect.bottom;
    const spaceAbove = rect.top - effectiveTop;

    // Vertical collision detection: only flip to top if space above can actually fit popover without clipping
    if (placement === "top") {
      setEffectivePlacement("top");
    } else if (placement === "bottom") {
      setEffectivePlacement("bottom");
    } else if (spaceBelow < popoverHeight && spaceAbove >= popoverHeight) {
      setEffectivePlacement("top");
    } else {
      setEffectivePlacement("bottom");
    }

    // Horizontal collision detection
    const wouldOverflowRight = rect.left + popoverWidth > effectiveRight - 8;
    const wouldOverflowLeft = rect.right - popoverWidth < effectiveLeft + 8;

    if (align === "right") {
      setEffectiveAlign("right");
    } else if (align === "left") {
      setEffectiveAlign("left");
    } else if (wouldOverflowRight && !wouldOverflowLeft) {
      setEffectiveAlign("right");
    } else if (wouldOverflowRight && rect.right >= popoverWidth) {
      setEffectiveAlign("right");
    } else {
      setEffectiveAlign("left");
    }
  }, [align, placement]);

  useEffect(() => {
    if (!isOpen) return;
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, updatePlacement]);

  // Sync internal/pending state when prop value changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
      if (!isOpen) {
        setPendingFrom(value.from);
        setPendingTo(value.to);
      }
    }
  }, [value, isControlled, isOpen]);

  // Open calendar popover
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setPendingFrom(currentRange.from);
    setPendingTo(currentRange.to);
    setHoverDate(null);
    const d = parseDateISO(currentRange.from) || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(true);
  }, [disabled, currentRange]);

  // Close calendar popover
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setHoverDate(null);
    setPendingFrom(currentRange.from);
    setPendingTo(currentRange.to);
  }, [currentRange]);

  // Commit and apply selection
  const handleApply = useCallback(() => {
    let nextFrom = pendingFrom;
    let nextTo = pendingTo;

    // If only one date was picked, treat it as a single-day range
    if (nextFrom && !nextTo) {
      nextTo = nextFrom;
    } else if (!nextFrom && nextTo) {
      nextFrom = nextTo;
    }

    // Ensure order
    if (nextFrom && nextTo && nextFrom > nextTo) {
      const temp = nextFrom;
      nextFrom = nextTo;
      nextTo = temp;
    }

    const nextRange = { from: nextFrom, to: nextTo };
    if (!isControlled) {
      setInternalValue(nextRange);
    }
    onChange?.(nextRange);
    onApply?.(nextRange);
    setIsOpen(false);
  }, [pendingFrom, pendingTo, isControlled, onChange, onApply]);

  // Clear selection
  const handleClear = useCallback(() => {
    const emptyRange = { from: "", to: "" };
    setPendingFrom("");
    setPendingTo("");
    if (!isControlled) {
      setInternalValue(emptyRange);
    }
    onChange?.(emptyRange);
    onClear?.();
  }, [isControlled, onChange, onClear]);

  // Handle direct input change from manual text editing
  const handleInputChange = (field: "from" | "to", val: string) => {
    const next = {
      ...currentRange,
      [field]: val,
    };
    if (!isControlled) {
      setInternalValue(next);
    }
    setPendingFrom(next.from);
    setPendingTo(next.to);
    onChange?.(next);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Preset selection
  const applyPreset = (preset: PresetRange) => {
    const range = preset.getRange();
    setPendingFrom(range.from);
    setPendingTo(range.to);
    const d = parseDateISO(range.from) || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Date cell click behavior:
  // 1. If no start date or both start & end exist: click sets start date and clears end date.
  // 2. If start date exists but no end date:
  //    - If clicked date < start date: reset start date to clicked date.
  //    - If clicked date >= start date: set end date.
  const handleDateClick = (isoString: string) => {
    if (minDate && isoString < minDate) return;
    if (maxDate && isoString > maxDate) return;

    if (!pendingFrom || (pendingFrom && pendingTo)) {
      setPendingFrom(isoString);
      setPendingTo("");
    } else if (pendingFrom && !pendingTo) {
      if (isoString < pendingFrom) {
        setPendingFrom(isoString);
        setPendingTo("");
      } else {
        setPendingTo(isoString);
      }
    }
  };

  // Grid calculations
  const daysInCurrentMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayIndex = getFirstDayOfWeek(viewYear, viewMonth);

  // Prev month filler days
  const prevMonthDays =
    viewMonth === 0
      ? getDaysInMonth(viewYear - 1, 11)
      : getDaysInMonth(viewYear, viewMonth - 1);

  // Range preview state for highlighting
  const activeStart = pendingFrom;
  const activeEnd =
    pendingTo ||
    (pendingFrom && hoverDate && hoverDate >= pendingFrom ? hoverDate : "");

  const todayIso = formatDateISO(new Date());

  // Formatting display range string
  const hasRange = Boolean(currentRange.from || currentRange.to);
  const displayRangeText = hasRange
    ? currentRange.from && currentRange.to
      ? `${formatDisplayDate(currentRange.from)} - ${formatDisplayDate(currentRange.to)}`
      : currentRange.from
        ? `From ${formatDisplayDate(currentRange.from)}`
        : `Until ${formatDisplayDate(currentRange.to)}`
    : placeholder;

  return (
    <div
      ref={containerRef}
      id={pickerId}
      className={cn(
        "relative inline-block text-left w-full",
        isOpen && "z-50",
        className,
      )}
    >
      {/* Visually hidden accessible textboxes for automated tests and screen readers */}
      <input
        type="text"
        aria-label={fromAriaLabel}
        value={currentRange.from}
        onChange={(e) => handleInputChange("from", e.target.value)}
        tabIndex={-1}
        className="sr-only"
      />
      <input
        type="text"
        aria-label={toAriaLabel}
        value={currentRange.to}
        onChange={(e) => handleInputChange("to", e.target.value)}
        tabIndex={-1}
        className="sr-only"
      />

      {/* SINGLE UNIFIED TRIGGER */}
      <button
        type="button"
        onClick={isOpen ? handleClose : handleOpen}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-label={placeholder}
        className={cn(
          "inline-flex items-center justify-between w-full h-10 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-2xs transition-all",
          "bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border-sky-100/90 hover:border-sky-300 backdrop-blur-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25 focus-visible:border-sky-400",
          "dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:border-sky-700 dark:hover:text-white",
          isOpen &&
            "border-sky-400 ring-2 ring-sky-500/25 text-brand-700 dark:text-cyan-300 dark:border-sky-500",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <CalendarIcon className="h-4 w-4 text-brand-600 dark:text-cyan-400 shrink-0" />
          <span
            className={cn(
              "truncate font-medium",
              !hasRange
                ? "text-slate-400 dark:text-slate-500"
                : "text-slate-900 dark:text-white",
            )}
          >
            {displayRangeText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {hasRange && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              title="Clear date range"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-50 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180 text-brand-600 dark:text-cyan-400",
            )}
          />
        </div>
      </button>

      {/* POPOVER CALENDAR */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Choose date range"
          className={cn(
            "glass-calendar-surface absolute z-999 rounded-2xl p-4 shadow-2xl",
            "w-85 sm:w-135 max-w-[calc(100vw-2rem)]",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            effectivePlacement === "top"
              ? "bottom-full mb-1.5 origin-bottom"
              : "top-full mt-1.5 origin-top",
            effectiveAlign === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {/* PRESETS SIDEBAR / TOPBAR */}
            {showPresets && presets && presets.length > 0 && (
              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 sm:pr-3 border-b sm:border-b-0 sm:border-r border-sky-100/80 dark:border-slate-800 sm:w-32 shrink-0">
                <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                  Presets
                </span>
                {presets.map((preset) => {
                  const range = preset.getRange();
                  const isSelected =
                    pendingFrom === range.from && pendingTo === range.to;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "text-left text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer",
                        isSelected
                          ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-semibold shadow-2xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-sky-50 hover:text-brand-700 dark:hover:bg-slate-800 dark:hover:text-cyan-300",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* MAIN CALENDAR GRID */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* MONTH & YEAR CONTROLS */}
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Previous month"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-100/90 bg-white/70 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-600 dark:text-slate-400 transition-all cursor-pointer shadow-2xs"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {MONTH_NAMES[viewMonth]}
                  </span>
                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    aria-label="Select year"
                    className="text-sm font-bold bg-transparent text-slate-800 dark:text-white border-0 py-0 pl-1 pr-5 rounded-lg focus:ring-1 focus:ring-brand-500 cursor-pointer"
                  >
                    {Array.from({ length: 60 }, (_, i) => 1990 + i).map((y) => (
                      <option
                        key={y}
                        value={y}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-100/90 bg-white/70 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-600 dark:text-slate-400 transition-all cursor-pointer shadow-2xs"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* WEEKDAY LABELS */}
              <div className="grid grid-cols-7 mb-1 text-center">
                {WEEKDAY_NAMES_SHORT.map((day) => (
                  <div
                    key={day}
                    className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* DAYS GRID */}
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {/* PREV MONTH FILLER */}
                {Array.from({ length: firstDayIndex }).map((_, i) => {
                  const dayNum = prevMonthDays - firstDayIndex + i + 1;
                  return (
                    <div
                      key={`prev-${i}`}
                      className="h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 select-none font-medium"
                    >
                      {dayNum}
                    </div>
                  );
                })}

                {/* CURRENT MONTH DAYS */}
                {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const monthStr = String(viewMonth + 1).padStart(2, "0");
                  const dayStr = String(dayNum).padStart(2, "0");
                  const iso = `${viewYear}-${monthStr}-${dayStr}`;

                  const isStart = pendingFrom === iso;
                  const isEnd = pendingTo === iso;
                  const isInRange =
                    activeStart &&
                    activeEnd &&
                    iso >= activeStart &&
                    iso <= activeEnd;
                  const isToday = iso === todayIso;

                  const isDisabled =
                    Boolean(minDate && iso < minDate) ||
                    Boolean(maxDate && iso > maxDate);

                  return (
                    <div
                      key={iso}
                      onMouseEnter={() => {
                        if (pendingFrom && !pendingTo) {
                          setHoverDate(iso);
                        }
                      }}
                      className={cn(
                        "h-8 flex items-center justify-center relative p-0 transition-colors",
                        isInRange &&
                          !isStart &&
                          !isEnd &&
                          "bg-sky-100/60 dark:bg-sky-950/40 text-brand-900 dark:text-cyan-200",
                        isStart &&
                          pendingTo &&
                          "rounded-l-xl bg-sky-100/60 dark:bg-sky-950/30",
                        isEnd &&
                          pendingFrom &&
                          "rounded-r-xl bg-sky-100/60 dark:bg-sky-950/30",
                      )}
                    >
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleDateClick(iso)}
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all cursor-pointer",
                          isStart || isEnd
                            ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-105"
                            : isInRange
                              ? "text-brand-900 dark:text-cyan-200 hover:bg-sky-200/60 dark:hover:bg-sky-900/60"
                              : "text-slate-700 dark:text-slate-200 hover:bg-sky-50 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-cyan-300",
                          isToday &&
                            !isStart &&
                            !isEnd &&
                            "ring-1.5 ring-brand-500/80 text-brand-700 dark:text-cyan-400 font-bold bg-sky-50/40 dark:bg-slate-800/40",
                          isDisabled &&
                            "opacity-30 cursor-not-allowed hover:bg-transparent text-slate-400 dark:text-slate-600",
                        )}
                      >
                        {dayNum}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* FOOTER & ACTIONS */}
              <div className="mt-4 pt-3 border-t border-sky-100/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate w-full sm:w-auto text-center sm:text-left">
                  {pendingFrom && pendingTo ? (
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatDisplayDate(pendingFrom)}
                      </strong>{" "}
                      –{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatDisplayDate(pendingTo)}
                      </strong>{" "}
                      ({countDays(pendingFrom, pendingTo)} days)
                    </span>
                  ) : pendingFrom ? (
                    <span>
                      Start:{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatDisplayDate(pendingFrom)}
                      </strong>{" "}
                      (select end date)
                    </span>
                  ) : (
                    <span>No dates selected</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleApply}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}
