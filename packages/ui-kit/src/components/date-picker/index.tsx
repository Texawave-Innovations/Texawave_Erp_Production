"use client";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import {
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES_SHORT,
  formatDateISO,
  parseDateISO,
} from "../date-range-picker/utils";

export interface DatePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "min" | "max"
> {
  mode?: "date" | "month" | "datetime" | undefined;
  value?: string | number | readonly string[] | undefined;
  defaultValue?: string | number | readonly string[] | undefined;
  onChange?: ((e: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onChangeDate?: ((date: string) => void) | undefined;
  min?: string | number | undefined;
  max?: string | number | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  clearable?: boolean | undefined;
  onClear?: (() => void) | undefined;
  invalid?: boolean | undefined;
  align?: "left" | "right" | "auto" | undefined;
  placement?: "top" | "bottom" | "auto" | undefined;
  className?: string | undefined;
  inputClassName?: string | undefined;
  iconClassName?: string | undefined;
  clearButtonAriaLabel?: string | undefined;
  sizeVariant?: "sm" | "md" | "lg" | undefined;
}

function CalendarIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function parseAnyDate(str: string | undefined): Date | null {
  if (!str) return null;
  const dPart = str.split("T")[0];
  return parseDateISO(dPart);
}

function parseTime(val: string): {
  hours: number;
  minutes: number;
  ampm: "AM" | "PM";
} {
  if (!val || !val.includes("T")) {
    return { hours: 9, minutes: 0, ampm: "AM" };
  }
  const tPart = val.split("T")[1] || "";
  const [hStr, mStr] = tPart.split(":");
  const rawH = parseInt(hStr || "9", 10);
  const rawM = parseInt(mStr || "0", 10);
  const m = isNaN(rawM) ? 0 : Math.min(59, Math.max(0, rawM));
  const h24 = isNaN(rawH) ? 9 : Math.min(23, Math.max(0, rawH));
  if (h24 === 0) return { hours: 12, minutes: m, ampm: "AM" };
  if (h24 === 12) return { hours: 12, minutes: m, ampm: "PM" };
  if (h24 > 12) return { hours: h24 - 12, minutes: m, ampm: "PM" };
  return { hours: h24, minutes: m, ampm: "AM" };
}

function formatIsoDateTime(
  dateStr: string,
  hours12: number,
  minutes: number,
  ampm: "AM" | "PM",
): string {
  if (!dateStr) return "";
  let h24 = hours12;
  if (ampm === "AM") {
    if (h24 === 12) h24 = 0;
  } else {
    if (h24 !== 12) h24 += 12;
  }
  return `${dateStr}T${String(h24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function CloseIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const SIZE_CLASSES = {
  sm: "h-9 py-1.5 text-xs",
  md: "h-10 py-2 text-sm",
  lg: "h-11 py-2.5 text-base",
};

/**
 * Reusable single-date DatePicker conforming to TexaOne Ark UI glassmorphism design system.
 * Renders an animated .glass-calendar-surface popover with squircle date cells,
 * completely replacing default browser OS calendars while preserving standard form input contracts.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
      mode: modeProp,
      value,
      defaultValue,
      onChange,
      onChangeDate,
      min,
      max,
      minDate,
      maxDate,
      clearable = true,
      onClear,
      invalid = false,
      disabled = false,
      readOnly = false,
      align: alignProp = "auto",
      placement: placementProp = "auto",
      clearButtonAriaLabel = "Clear date",
      sizeVariant = "md",
      className,
      inputClassName,
      iconClassName,
      placeholder,
      type: _type,
      ...props
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const isMonthMode =
      modeProp === "month" || (props as { type?: string }).type === "month";
    const isDateTimeMode =
      modeProp === "datetime" ||
      (props as { type?: string }).type === "datetime-local";
    const effectiveMin =
      minDate ?? (min !== undefined ? String(min) : undefined);
    const effectiveMax =
      maxDate ?? (max !== undefined ? String(max) : undefined);

    // Controlled or uncontrolled value
    const toValString = (
      val: string | number | readonly string[] | undefined,
    ): string => {
      if (val === undefined || val === null) return "";
      if (typeof val === "number") return String(val);
      if (Array.isArray(val)) return val.join("");
      return String(val);
    };

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
      toValString(defaultValue ?? (isControlled ? value : "")),
    );
    const currentValue = isControlled ? toValString(value) : internalValue;

    // Sync internal value if controlled
    useEffect(() => {
      if (isControlled) {
        setInternalValue(toValString(value));
      }
    }, [isControlled, value]);

    // Popover visibility & dynamic collision-aware placement
    const [isOpen, setIsOpen] = useState(false);
    const [popoverPlacement, setPopoverPlacement] = useState<"top" | "bottom">(
      placementProp === "top" ? "top" : "bottom",
    );
    const [popoverAlign, setPopoverAlign] = useState<"left" | "right">(
      alignProp === "right" ? "right" : "left",
    );

    // Dynamic collision detection (flips to top only if space above is sufficient, aligns right if near container right edge)
    const updatePlacement = useCallback(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popoverHeight = isMonthMode ? 260 : isDateTimeMode ? 480 : 360;
      const popoverWidth = isMonthMode ? 270 : isDateTimeMode ? 320 : 310;

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
      const effectiveBottom = Math.min(
        window.innerHeight,
        containerRect.bottom,
      );
      const effectiveTop = Math.max(0, containerRect.top);
      const effectiveRight = Math.min(window.innerWidth, containerRect.right);
      const effectiveLeft = Math.max(0, containerRect.left);

      const spaceBelow = effectiveBottom - rect.bottom;
      const spaceAbove = rect.top - effectiveTop;

      // Vertical space measurement:
      if (placementProp === "top") {
        setPopoverPlacement("top");
      } else if (placementProp === "bottom") {
        setPopoverPlacement("bottom");
      } else if (spaceBelow < popoverHeight && spaceAbove >= popoverHeight) {
        setPopoverPlacement("top");
      } else {
        setPopoverPlacement("bottom");
      }

      // Horizontal space measurement:
      const wouldOverflowRight = rect.left + popoverWidth > effectiveRight - 8;
      const wouldOverflowLeft = rect.right - popoverWidth < effectiveLeft + 8;

      if (alignProp === "right") {
        setPopoverAlign("right");
      } else if (alignProp === "left") {
        setPopoverAlign("left");
      } else if (wouldOverflowRight && !wouldOverflowLeft) {
        setPopoverAlign("right");
      } else if (wouldOverflowRight && rect.right >= popoverWidth) {
        setPopoverAlign("right");
      } else {
        setPopoverAlign("left");
      }
    }, [isMonthMode, isDateTimeMode, placementProp, alignProp]);

    // Recalculate placement when opening, resizing, or scrolling
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

    // Calendar navigation (Year & Month)
    const today = useMemo(() => new Date(), []);
    const todayIso = useMemo(() => formatDateISO(today), [today]);
    const currentMonthIso = useMemo(
      () =>
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      [today],
    );

    const getInitialViewDate = useCallback((): Date => {
      if (currentValue) {
        const parsed = parseAnyDate(currentValue);
        if (parsed) return parsed;
      }
      const now = new Date();
      if (effectiveMax) {
        const maxParsed = parseAnyDate(effectiveMax);
        if (maxParsed && now > maxParsed) return maxParsed;
      }
      if (effectiveMin) {
        const minParsed = parseAnyDate(effectiveMin);
        if (minParsed && now < minParsed) return minParsed;
      }
      return now;
    }, [currentValue, effectiveMin, effectiveMax]);

    const [viewYear, setViewYear] = useState<number>(() => {
      return getInitialViewDate().getFullYear();
    });
    const [viewMonth, setViewMonth] = useState<number>(() => {
      return getInitialViewDate().getMonth();
    });

    type CalendarPickerView = "days" | "months" | "years";
    const [calendarView, setCalendarView] = useState<CalendarPickerView>(
      isMonthMode ? "months" : "days",
    );
    const [decadeStartYear, setDecadeStartYear] = useState<number>(() => {
      const yr = getInitialViewDate().getFullYear();
      return Math.floor(yr / 12) * 12;
    });

    // Only sync view year/month when transitioning from closed to open
    const prevIsOpenRef = useRef(false);
    useEffect(() => {
      const justOpened = isOpen && !prevIsOpenRef.current;
      prevIsOpenRef.current = isOpen;

      if (justOpened) {
        setCalendarView(isMonthMode ? "months" : "days");
        if (isMonthMode && currentValue && /^\d{4}-\d{2}$/.test(currentValue)) {
          const [y, m] = currentValue.split("-").map(Number);
          if (y && m) {
            setViewYear(y);
            setViewMonth(m - 1);
            setDecadeStartYear(Math.floor(y / 12) * 12);
          }
        } else {
          const d = getInitialViewDate();
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
          setDecadeStartYear(Math.floor(d.getFullYear() / 12) * 12);
        }
      }
    }, [isOpen, currentValue, isMonthMode, getInitialViewDate]);

    // Time picker state for DateTime mode
    const initialTime = parseTime(currentValue);
    const [selectedHour, setSelectedHour] = useState<number>(initialTime.hours);
    const [selectedMinute, setSelectedMinute] = useState<number>(
      initialTime.minutes,
    );
    const [selectedAmpm, setSelectedAmpm] = useState<"AM" | "PM">(
      initialTime.ampm,
    );

    useEffect(() => {
      if (isDateTimeMode && currentValue) {
        const t = parseTime(currentValue);
        setSelectedHour(t.hours);
        setSelectedMinute(t.minutes);
        setSelectedAmpm(t.ampm);
      }
    }, [currentValue, isDateTimeMode]);

    // Trigger value commit
    const commitValue = useCallback(
      (newVal: string) => {
        if (!isControlled) {
          setInternalValue(newVal);
        }
        if (inputRef.current) {
          inputRef.current.value = newVal;
          const event = {
            target: inputRef.current,
            currentTarget: inputRef.current,
            type: "change",
          } as unknown as ChangeEvent<HTMLInputElement>;
          onChange?.(event);
        }
        onChangeDate?.(newVal);
      },
      [isControlled, onChange, onChangeDate],
    );

    const handleClear = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (disabled || readOnly) return;
      commitValue("");
      onClear?.();
      setIsOpen(false);
      inputRef.current?.focus();
    };

    const handleDateSelect = (iso: string) => {
      if (disabled || readOnly) return;
      if (isDateTimeMode) {
        const nextVal = formatIsoDateTime(
          iso,
          selectedHour,
          selectedMinute,
          selectedAmpm,
        );
        commitValue(nextVal);
      } else {
        commitValue(iso);
        setIsOpen(false);
      }
    };

    const handleTimeChange = (h: number, m: number, ap: "AM" | "PM") => {
      setSelectedHour(h);
      setSelectedMinute(m);
      setSelectedAmpm(ap);
      const baseDate =
        (currentValue ? currentValue.split("T")[0] : "") ||
        (effectiveMin ? effectiveMin.split("T")[0] : "") ||
        todayIso;
      const nextVal = formatIsoDateTime(baseDate, h, m, ap);
      commitValue(nextVal);
    };

    // Outside click & escape listeners
    useEffect(() => {
      if (!isOpen) return;

      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
          inputRef.current?.focus();
        }
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("touchstart", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen]);

    const hasValue = currentValue !== "";
    const canClear = clearable && hasValue && !disabled && !readOnly;

    const handlePrevMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else {
        setViewMonth((m) => m - 1);
      }
    };

    const handleNextMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else {
        setViewMonth((m) => m + 1);
      }
    };

    const handlePrevYear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setViewYear((y) => y - 1);
    };

    const handleNextYear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setViewYear((y) => y + 1);
    };

    // Days computation for current month
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full group", isOpen && "z-50", className)}
      >
        {/* Leading Calendar Icon - centered in 40px left gutter */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled && !readOnly) {
              updatePlacement();
              setIsOpen((prev) => !prev);
            }
          }}
          disabled={disabled || readOnly}
          className={cn(
            "absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-cyan-400 transition-colors cursor-pointer z-10",
            (disabled || readOnly) && "pointer-events-none opacity-60",
            iconClassName,
          )}
          aria-hidden="true"
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
        </button>

        {/* The Input with native browser indicator suppressed */}
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          placeholder={
            placeholder ??
            (isMonthMode
              ? "YYYY-MM"
              : isDateTimeMode
                ? "YYYY-MM-DD HH:mm"
                : "YYYY-MM-DD")
          }
          disabled={disabled}
          readOnly={readOnly}
          tabIndex={0}
          aria-invalid={invalid || undefined}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          autoComplete="off"
          onClick={(e) => {
            if (!disabled && !readOnly) {
              updatePlacement();
              setIsOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              if (!disabled && !readOnly) {
                updatePlacement();
                setIsOpen((prev) => !prev);
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          onChange={(e) => {
            commitValue(e.target.value);
          }}
          className={cn(
            "block w-full rounded-xl border bg-white/90 pl-10 pr-10 shadow-2xs backdrop-blur-md transition-all cursor-pointer",
            "text-slate-800 placeholder:text-slate-400 font-medium select-none",
            "focus:outline-none focus:ring-2 focus:ring-sky-500/25",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200",
            "dark:bg-slate-900/90 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:border-slate-700",
            SIZE_CLASSES[sizeVariant],
            invalid
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500"
              : "border-sky-100/90 hover:border-sky-300 focus:border-brand-500 dark:border-slate-800 dark:hover:border-sky-700",
            inputClassName,
          )}
          {...props}
        />

        {/* Trailing Clear Button - centered in 40px right gutter */}
        {canClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={clearButtonAriaLabel}
            tabIndex={0}
            className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 rounded-r-xl cursor-pointer z-10"
          >
            <CloseIcon className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}

        {/* ARK UI THEMED GLASS CALENDAR POPOVER - DYNAMIC COLLISION PLACEMENT */}
        {isOpen && !disabled && !readOnly && (
          <div
            ref={popoverRef}
            data-testid="date-picker-popover"
            role="dialog"
            aria-label={
              isMonthMode
                ? "Choose month"
                : isDateTimeMode
                  ? "Choose date and time"
                  : "Choose date"
            }
            className={cn(
              "glass-calendar-surface absolute z-999 rounded-2xl border border-sky-100/90 dark:border-slate-800 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150",
              popoverPlacement === "top"
                ? "bottom-full mb-1.5 origin-bottom"
                : "top-full mt-1.5 origin-top",
              popoverAlign === "right" ? "right-0" : "left-0",
              isMonthMode
                ? "w-64 max-w-[calc(100vw-2rem)]"
                : isDateTimeMode
                  ? "w-80 max-w-[calc(100vw-2rem)]"
                  : "w-76 max-w-[calc(100vw-2.5rem)]",
            )}
          >
            {/* CALENDAR VIEW: YEARS DECADE SELECTOR */}
            {calendarView === "years" ? (
              <div>
                {/* Decade Navigation Header */}
                <div className="flex items-center justify-between pb-3 border-b border-sky-100/80 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDecadeStartYear((y) => y - 12);
                    }}
                    aria-label="Previous 12 years"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>

                  <span className="text-xs font-bold text-slate-800 dark:text-white px-2 py-1">
                    {decadeStartYear} – {decadeStartYear + 11}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDecadeStartYear((y) => y + 12);
                    }}
                    aria-label="Next 12 years"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* 12 Years Grid */}
                <div className="grid grid-cols-3 gap-2 py-3">
                  {Array.from(
                    { length: 12 },
                    (_, i) => decadeStartYear + i,
                  ).map((yr) => {
                    const isSelected = yr === viewYear;
                    const isCurrentYear = yr === today.getFullYear();
                    const minYear = effectiveMin
                      ? parseInt(effectiveMin.slice(0, 4), 10)
                      : undefined;
                    const maxYear = effectiveMax
                      ? parseInt(effectiveMax.slice(0, 4), 10)
                      : undefined;
                    const isYearDisabled =
                      Boolean(
                        minYear !== undefined &&
                        !isNaN(minYear) &&
                        yr < minYear,
                      ) ||
                      Boolean(
                        maxYear !== undefined &&
                        !isNaN(maxYear) &&
                        yr > maxYear,
                      );

                    return (
                      <button
                        key={yr}
                        type="button"
                        disabled={isYearDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewYear(yr);
                          setCalendarView("months");
                        }}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center",
                          isYearDisabled &&
                            "opacity-35 pointer-events-none cursor-not-allowed",
                          isSelected
                            ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-102"
                            : isCurrentYear
                              ? "ring-1.5 ring-brand-500/80 text-brand-700 dark:text-cyan-400 font-bold bg-sky-50/40 dark:bg-slate-800/40"
                              : "text-slate-700 dark:text-slate-200 hover:bg-sky-50 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-cyan-300",
                        )}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-sky-100/80 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentYr = today.getFullYear();
                      setViewYear(currentYr);
                      setDecadeStartYear(Math.floor(currentYr / 12) * 12);
                      setCalendarView(isMonthMode ? "months" : "days");
                    }}
                    className="text-xs font-semibold text-brand-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    This Year ({today.getFullYear()})
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCalendarView(isMonthMode ? "months" : "days");
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : calendarView === "months" ? (
              /* CALENDAR VIEW: MONTHS SELECTOR */
              <div>
                {/* Year Navigation Header */}
                <div className="flex items-center justify-between pb-3 border-b border-sky-100/80 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handlePrevYear}
                    aria-label="Previous year"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDecadeStartYear(Math.floor(viewYear / 12) * 12);
                      setCalendarView("years");
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-sky-100/70 dark:hover:bg-slate-800 hover:text-brand-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Click to select year"
                  >
                    <span>{viewYear}</span>
                    <svg
                      className="w-3 h-3 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextYear}
                    aria-label="Next year"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* 12 Months Grid */}
                <div className="grid grid-cols-3 gap-2 py-3">
                  {MONTH_NAMES_SHORT.map((mShort, idx) => {
                    const monthIso = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
                    const isSelected = isMonthMode
                      ? currentValue === monthIso
                      : viewMonth === idx;
                    const isCurrent = currentMonthIso === monthIso;
                    const minYearMonth = effectiveMin
                      ? effectiveMin.slice(0, 7)
                      : undefined;
                    const maxYearMonth = effectiveMax
                      ? effectiveMax.slice(0, 7)
                      : undefined;
                    const isMonthDisabled =
                      Boolean(minYearMonth && monthIso < minYearMonth) ||
                      Boolean(maxYearMonth && monthIso > maxYearMonth);

                    return (
                      <button
                        key={mShort}
                        type="button"
                        disabled={isMonthDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMonth(idx);
                          if (isMonthMode) {
                            handleDateSelect(monthIso);
                          } else {
                            setCalendarView("days");
                          }
                        }}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center",
                          isMonthDisabled &&
                            "opacity-35 pointer-events-none cursor-not-allowed",
                          isSelected
                            ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-102"
                            : isCurrent
                              ? "ring-1.5 ring-brand-500/80 text-brand-700 dark:text-cyan-400 font-bold bg-sky-50/40 dark:bg-slate-800/40"
                              : "text-slate-700 dark:text-slate-200 hover:bg-sky-50 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-cyan-300",
                        )}
                      >
                        {mShort}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-sky-100/80 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMonthMode) {
                        handleDateSelect(currentMonthIso);
                      } else {
                        setViewMonth(today.getMonth());
                        setViewYear(today.getFullYear());
                        setCalendarView("days");
                      }
                    }}
                    className="text-xs font-semibold text-brand-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    This Month
                  </button>
                  {!isMonthMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCalendarView("days");
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  {isMonthMode && hasValue && (
                    <button
                      type="button"
                      onClick={() => handleClear()}
                      className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* CALENDAR VIEW: DAYS SELECTOR (DEFAULT) */
              <div>
                {/* Header (Interactive Month & Year Buttons) */}
                <div className="flex items-center justify-between pb-3 border-b border-sky-100/80 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous month"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCalendarView("months");
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-sky-100/70 dark:hover:bg-slate-800 hover:text-brand-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Click to select month"
                    >
                      <span>{MONTH_NAMES[viewMonth]}</span>
                      <svg
                        className="w-3 h-3 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDecadeStartYear(Math.floor(viewYear / 12) * 12);
                        setCalendarView("years");
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-sky-100/70 dark:hover:bg-slate-800 hover:text-brand-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Click to select year"
                    >
                      <span>{viewYear}</span>
                      <svg
                        className="w-3 h-3 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next month"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-sky-100/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Weekday Row */}
                <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
                  {WEEKDAY_NAMES_SHORT.map((wd) => (
                    <div
                      key={wd}
                      className="h-6 flex items-center justify-center text-[11px] font-semibold text-slate-400 dark:text-slate-500"
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Preceding Month Days */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                    const dayNum = daysInPrevMonth - firstDayOfWeek + 1 + i;
                    return (
                      <div
                        key={`prev-${dayNum}`}
                        className="h-8 w-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 opacity-40 select-none"
                      >
                        {dayNum}
                      </div>
                    );
                  })}

                  {/* Current Month Days */}
                  {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const mStr = String(viewMonth + 1).padStart(2, "0");
                    const dStr = String(dayNum).padStart(2, "0");
                    const iso = `${viewYear}-${mStr}-${dStr}`;

                    const isSelected = isDateTimeMode
                      ? currentValue
                        ? currentValue.split("T")[0] === iso
                        : false
                      : currentValue === iso;
                    const isToday = iso === todayIso;
                    const isDisabled =
                      Boolean(
                        effectiveMin &&
                        iso < (effectiveMin.split("T")[0] ?? effectiveMin),
                      ) ||
                      Boolean(
                        effectiveMax &&
                        iso > (effectiveMax.split("T")[0] ?? effectiveMax),
                      );

                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleDateSelect(iso)}
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all cursor-pointer",
                          isSelected
                            ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-105"
                            : isToday
                              ? "ring-1.5 ring-brand-500/80 text-brand-700 dark:text-cyan-400 font-bold bg-sky-50/40 dark:bg-slate-800/40"
                              : "text-slate-700 dark:text-slate-200 hover:bg-sky-50 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-cyan-300",
                          isDisabled &&
                            "opacity-30 cursor-not-allowed hover:bg-transparent text-slate-400 dark:text-slate-600 pointer-events-none",
                        )}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {/* Time Selection Section for DateTime Mode */}
                {isDateTimeMode && (
                  <div className="mt-3 pt-3 border-t border-sky-100/80 dark:border-slate-800">
                    <div className="flex items-center justify-between pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                        <ClockIcon className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
                        <span>Time (IST)</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-slate-800 text-xs font-bold text-brand-700 dark:text-cyan-400">
                        {String(selectedHour).padStart(2, "0")}:
                        {String(selectedMinute).padStart(2, "0")} {selectedAmpm}
                      </div>
                    </div>

                    {/* Interactive Hour, Minute, AM/PM selectors */}
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Hour selector */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 text-center">
                          Hour
                        </label>
                        <select
                          value={selectedHour}
                          onChange={(e) =>
                            handleTimeChange(
                              Number(e.target.value),
                              selectedMinute,
                              selectedAmpm,
                            )
                          }
                          className="w-full text-center rounded-xl border border-sky-100 bg-white/90 px-1 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-sky-300 focus:outline-none focus:ring-1.5 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (h) => (
                              <option key={`h-${h}`} value={h}>
                                {String(h).padStart(2, "0")}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <span className="text-slate-400 font-bold self-end pb-2">
                        :
                      </span>

                      {/* Minute selector */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 text-center">
                          Minute
                        </label>
                        <select
                          value={selectedMinute}
                          onChange={(e) =>
                            handleTimeChange(
                              selectedHour,
                              Number(e.target.value),
                              selectedAmpm,
                            )
                          }
                          className="w-full text-center rounded-xl border border-sky-100 bg-white/90 px-1 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-sky-300 focus:outline-none focus:ring-1.5 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                        >
                          {Array.from({ length: 12 }, (_, i) => i * 5).map(
                            (m) => (
                              <option key={`m-${m}`} value={m}>
                                {String(m).padStart(2, "0")}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      {/* AM / PM Segmented Toggle */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 text-center">
                          Period
                        </label>
                        <div className="flex rounded-xl bg-slate-100/90 dark:bg-slate-800 p-0.5 border border-sky-100/50 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() =>
                              handleTimeChange(
                                selectedHour,
                                selectedMinute,
                                "AM",
                              )
                            }
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              selectedAmpm === "AM"
                                ? "bg-brand-600 text-white shadow-2xs"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900",
                            )}
                          >
                            AM
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleTimeChange(
                                selectedHour,
                                selectedMinute,
                                "PM",
                              )
                            }
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              selectedAmpm === "PM"
                                ? "bg-brand-600 text-white shadow-2xs"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900",
                            )}
                          >
                            PM
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Punch Presets */}
                    <div className="flex flex-wrap items-center gap-1 mt-2.5 pt-2 border-t border-sky-50 dark:border-slate-800/80">
                      {[
                        { label: "09:00 AM", h: 9, m: 0, ap: "AM" as const },
                        { label: "09:30 AM", h: 9, m: 30, ap: "AM" as const },
                        { label: "01:30 PM", h: 1, m: 30, ap: "PM" as const },
                        { label: "06:00 PM", h: 6, m: 0, ap: "PM" as const },
                        { label: "06:30 PM", h: 6, m: 30, ap: "PM" as const },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            handleTimeChange(preset.h, preset.m, preset.ap)
                          }
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer",
                            selectedHour === preset.h &&
                              selectedMinute === preset.m &&
                              selectedAmpm === preset.ap
                              ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/50 dark:border-brand-700 dark:text-cyan-300 font-bold"
                              : "border-sky-100 bg-white/70 text-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions Footer */}
                <div className="mt-3 pt-2.5 border-t border-sky-100/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const nowIso = formatDateISO(now);
                        if (isDateTimeMode) {
                          const h = now.getHours();
                          const m = now.getMinutes();
                          const ap: "AM" | "PM" = h >= 12 ? "PM" : "AM";
                          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                          handleTimeChange(h12, m, ap);
                          const nextVal = formatIsoDateTime(nowIso, h12, m, ap);
                          commitValue(nextVal);
                        } else {
                          handleDateSelect(nowIso);
                        }
                      }}
                      className="text-xs font-semibold text-brand-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      {isDateTimeMode ? "Now" : "Today"}
                    </button>
                    {hasValue && (
                      <button
                        type="button"
                        onClick={() => handleClear()}
                        className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {isDateTimeMode && (
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold text-xs shadow-2xs hover:shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
