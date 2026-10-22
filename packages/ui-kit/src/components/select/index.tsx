"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export interface SelectOptionItem {
  value: string;
  label: ReactNode;
  disabled?: boolean | undefined;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> {
  invalid?: boolean | undefined;
  placeholder?: string | undefined;
  triggerClassName?: string | undefined;
  menuClassName?: string | undefined;
}

function ChevronDownIcon({
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Recursively parse <option> and <optgroup> children into structured options */
function extractOptions(children: ReactNode): SelectOptionItem[] {
  const options: SelectOptionItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    // Check if it's an <option> tag or has option-like props
    const childProps = child.props as {
      value?: unknown;
      children?: ReactNode;
      disabled?: boolean;
    };

    if (
      typeof child.type === "string" &&
      child.type.toLowerCase() === "option"
    ) {
      const val =
        childProps.value !== undefined
          ? String(childProps.value)
          : typeof childProps.children === "string" ||
              typeof childProps.children === "number"
            ? String(childProps.children)
            : "";
      options.push({
        value: val,
        label: childProps.children ?? val,
        disabled: Boolean(childProps.disabled),
      });
    } else if (childProps?.children) {
      options.push(...extractOptions(childProps.children));
    }
  });

  return options;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      invalid = false,
      placeholder,
      className,
      triggerClassName,
      menuClassName,
      children,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled = false,
      required,
      id: propId,
      name,
      ...props
    },
    forwardedRef,
  ) {
    const generatedId = useId();
    const selectId = propId ?? generatedId;
    const listboxId = `${selectId}-listbox`;

    const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<{
      top: number;
      left: number;
      width: number;
      openAbove: boolean;
    }>({
      top: 0,
      left: 0,
      width: 0,
      openAbove: false,
    });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Extract options from children
    const options = useMemo(() => extractOptions(children), [children]);

    // Track internal value for uncontrolled mode
    const [internalValue, setInternalValue] = useState<string>(() => {
      if (defaultValue !== undefined) return String(defaultValue);
      return "";
    });

    // Synchronize mounted state for Portal
    useEffect(() => {
      setMounted(true);
    }, []);

    // Combine forwarded ref and internal ref for the native <select>
    const setRef = useCallback(
      (node: HTMLSelectElement | null) => {
        nativeSelectRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef && "current" in forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    // Determine current active value
    const isControlled = value !== undefined;
    const currentVal = isControlled ? String(value) : internalValue;

    // Selected option label
    const selectedOption = useMemo(
      () => options.find((opt) => opt.value === currentVal),
      [options, currentVal],
    );

    const displayLabel =
      selectedOption?.label ??
      (options.length > 0 && currentVal === "" && !placeholder
        ? options[0]?.label
        : null) ??
      placeholder ??
      (options.length > 0 ? options[0]?.label : "Select...");

    // Calculate popup position
    const updatePosition = useCallback(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedMenuHeight = Math.min(
        Math.max(options.length * 36 + 16, 60),
        280,
      );
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const openAbove =
        spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;

      const top = openAbove
        ? Math.max(8, rect.top - estimatedMenuHeight - 6)
        : Math.min(viewportHeight - 20, rect.bottom + 6);

      const width = Math.max(rect.width, 160);
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );

      setCoords({ top, left, width, openAbove });
    }, [options.length]);

    // Handle outside clicks
    useEffect(() => {
      if (!isOpen) return;

      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node | null;
        if (
          triggerRef.current?.contains(target) ||
          menuRef.current?.contains(target)
        ) {
          return;
        }
        setIsOpen(false);
      };

      const handleScrollOrResize = () => {
        updatePosition();
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);

      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("touchstart", handlePointerDown);
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }, [isOpen, updatePosition]);

    // Synchronize highlight on open
    useEffect(() => {
      if (isOpen) {
        updatePosition();
        const activeIdx = options.findIndex((opt) => opt.value === currentVal);
        setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
      }
    }, [isOpen, options, currentVal, updatePosition]);

    // Selection handler that coordinates with the native <select>
    const handleSelectOption = useCallback(
      (optValue: string) => {
        if (!isControlled) {
          setInternalValue(optValue);
        }

        const nativeSelect = nativeSelectRef.current;
        if (nativeSelect) {
          // Set value using HTMLSelectElement descriptor to trigger React's tracker
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(nativeSelect, optValue);
          } else {
            nativeSelect.value = optValue;
          }

          // Dispatch native change event
          const changeEvent = new Event("change", { bubbles: true });
          nativeSelect.dispatchEvent(changeEvent);

          // Also invoke onChange prop with synthetic event if present
          if (onChange) {
            const syntheticEvent = {
              target: nativeSelect,
              currentTarget: nativeSelect,
              bubbles: true,
              cancelable: true,
              defaultPrevented: false,
              eventPhase: 3,
              isTrusted: true,
              nativeEvent: changeEvent,
              preventDefault: () => {},
              stopPropagation: () => {},
              persist: () => {},
              type: "change",
            } as unknown as ChangeEvent<HTMLSelectElement>;
            onChange(syntheticEvent);
          }
        }

        setIsOpen(false);
        triggerRef.current?.focus();
      },
      [isControlled, onChange],
    );

    // Toggle menu
    const toggleMenu = (e: ReactMouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (!isOpen) {
        updatePosition();
      }
      setIsOpen((prev) => !prev);
    };

    // Keyboard navigation on trigger button
    const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const next = prev + delta;
            if (next < 0) return options.length - 1;
            if (next >= options.length) return 0;
            return next;
          });
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
          const opt = options[highlightedIndex];
          if (!opt.disabled) {
            handleSelectOption(opt.value);
          }
        } else {
          setIsOpen((prev) => !prev);
        }
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    // Keyboard navigation within listbox
    const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(
          (prev) => (prev - 1 + options.length) % options.length,
        );
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlightedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          const opt = options[highlightedIndex];
          if (!opt.disabled) {
            handleSelectOption(opt.value);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    return (
      <div className={cn("relative inline-block w-full text-left", className)}>
        {/* Hidden native select for standard form and React hook form compatibility */}
        <select
          ref={setRef}
          id={selectId}
          name={name}
          disabled={disabled}
          required={required}
          value={currentVal}
          onChange={onChange}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none absolute left-[-9999px] opacity-0"
          {...props}
        >
          {children}
        </select>

        {/* Custom Animated Glassmorphic Dropdown Trigger */}
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          aria-label={props["aria-label"]}
          disabled={disabled}
          onClick={toggleMenu}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "group flex w-full items-center justify-between gap-2 rounded-xl border border-sky-100/90 bg-white/90 px-3.5 py-2 text-left text-theme-sm text-slate-800 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-sky-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:border-sky-700 cursor-pointer",
            invalid &&
              "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500",
            disabled &&
              "cursor-not-allowed opacity-50 hover:border-sky-100 hover:bg-white/90 dark:hover:border-slate-800",
            triggerClassName,
          )}
        >
          <span className="truncate flex-1 font-medium">{displayLabel}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </motion.span>
        </button>

        {/* Glassmorphic Animated Portal Menu */}
        {mounted &&
          isOpen &&
          createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 9999,
              }}
              className={cn(
                "overflow-hidden rounded-2xl border border-sky-200/80 bg-white/98 p-1.5 shadow-2xl shadow-sky-950/20 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/98 dark:shadow-black/50",
                menuClassName,
              )}
            >
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.96,
                  y: coords.openAbove ? 4 : -4,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.96,
                  y: coords.openAbove ? 4 : -4,
                }}
                transition={{
                  type: "spring" as const,
                  stiffness: 420,
                  damping: 28,
                }}
                className="max-h-65 overflow-y-auto space-y-0.5 overscroll-contain pr-0.5"
              >
                {options.length === 0 ? (
                  <div className="py-3 px-3 text-center text-xs text-slate-400">
                    No options available
                  </div>
                ) : (
                  options.map((opt, idx) => {
                    const isSelected = String(currentVal) === String(opt.value);
                    const isHighlighted = highlightedIndex === idx;

                    return (
                      <motion.button
                        key={`${opt.value}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onClick={() => handleSelectOption(opt.value)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        whileHover={!opt.disabled ? { x: 2 } : {}}
                        whileTap={!opt.disabled ? { scale: 0.98 } : {}}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all duration-150 cursor-pointer",
                          isSelected
                            ? "bg-linear-to-r from-sky-100 to-cyan-50 font-bold text-sky-950 shadow-2xs dark:from-sky-950/70 dark:to-cyan-950/50 dark:text-cyan-300"
                            : isHighlighted
                              ? "bg-sky-50/70 font-semibold text-slate-900 dark:bg-slate-800/80 dark:text-white"
                              : "font-medium text-slate-800 hover:bg-slate-100/70 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white",
                          opt.disabled &&
                            "cursor-not-allowed opacity-40 hover:bg-transparent",
                        )}
                      >
                        <span className="truncate flex-1">{opt.label}</span>
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="ml-2 shrink-0 text-brand-600 dark:text-cyan-400"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </motion.div>
            </div>,
            (triggerRef.current?.closest("dialog") as HTMLElement | null) ??
              document.body,
          )}
      </div>
    );
  },
);
