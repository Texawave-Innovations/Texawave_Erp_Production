"use client";

import {
  type ReactNode,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
  cloneElement,
  isValidElement,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/cn";
import { Button, type ButtonVariant, type ButtonSize } from "../button/index";

export interface DropdownOption {
  label: string;
  onClick: () => void;
  Icon?: ReactNode | undefined;
  disabled?: boolean | undefined;
  variant?: "default" | "destructive" | "brand" | undefined;
  description?: string | undefined;
  separator?: boolean | undefined;
  badge?: ReactNode | undefined;
}

export interface DropdownMenuProps {
  options: DropdownOption[];
  children?: ReactNode | undefined;
  triggerLabel?: string | undefined;
  triggerVariant?: ButtonVariant | undefined;
  triggerSize?: ButtonSize | undefined;
  triggerIcon?: ReactNode | undefined;
  showChevron?: boolean | undefined;
  className?: string | undefined;
  menuClassName?: string | undefined;
  align?: "start" | "center" | "end" | undefined;
  side?: "bottom" | "top" | undefined;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  emptyMessage?: string | undefined;
  headerSlot?: ReactNode | undefined;
  footerSlot?: ReactNode | undefined;
  asChild?: boolean | undefined;
  usePortal?: boolean | undefined;
  closeOnSelect?: boolean | undefined;
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

const MENU_VARIANTS = {
  hidden: (side: "bottom" | "top") => ({
    opacity: 0,
    scale: 0.94,
    y: side === "top" ? 8 : -8,
    transition: {
      duration: 0.16,
      ease: [0.25, 1, 0.4, 1] as const,
    },
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 26,
      mass: 0.8,
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
  exit: (side: "bottom" | "top") => ({
    opacity: 0,
    scale: 0.95,
    y: side === "top" ? 6 : -6,
    transition: {
      duration: 0.14,
      ease: [0.25, 1, 0.4, 1] as const,
    },
  }),
};

const ITEM_VARIANTS = {
  hidden: {
    opacity: 0,
    x: -6,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
    },
  },
};

/**
 * Enterprise Reusable Animated Glassmorphism DropdownMenu for TexaOne ERP.
 * Conforms to Docs/DESIGN_SYSTEM.md and WCAG accessibility standards.
 *
 * Features:
 * - Fluid Framer Motion physics with staggered item entrances and press feedback.
 * - Centralized TexaOne Frosted Glass styling (.glass-dropdown).
 * - Full Portal support into document.body to avoid clipping inside tables, cards, and modal dialogs.
 * - Dynamic boundary detection & viewport clamping.
 * - Comprehensive keyboard navigation (ArrowUp, ArrowDown, Home, End, Escape, Enter, Space).
 * - Respects disabled states, separator lines, descriptive captions, and custom icon slots.
 */
export function DropdownMenu({
  options,
  children,
  triggerLabel = "Actions",
  triggerVariant = "secondary",
  triggerSize = "md",
  triggerIcon,
  showChevron = true,
  className,
  menuClassName,
  align = "start",
  side = "bottom",
  disabled = false,
  ariaLabel,
  emptyMessage = "No actions available",
  headerSlot,
  footerSlot,
  asChild: _asChild = false,
  usePortal = true,
  closeOnSelect = true,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate coordinates relative to viewport for Portal rendering
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl ? menuEl.offsetWidth : 210;
    const menuHeight = menuEl ? menuEl.offsetHeight : 160;
    const margin = 6;
    const padding = 12;

    // Vertical positioning
    let top = 0;
    if (side === "top") {
      top = rect.top - menuHeight - margin;
      // Flip to bottom if clipping top
      if (
        top < padding &&
        rect.bottom + menuHeight + margin < window.innerHeight - padding
      ) {
        top = rect.bottom + margin;
      }
    } else {
      top = rect.bottom + margin;
      // Flip to top if clipping bottom
      if (
        top + menuHeight > window.innerHeight - padding &&
        rect.top - menuHeight - margin > padding
      ) {
        top = rect.top - menuHeight - margin;
      }
    }

    // Horizontal positioning
    let left = 0;
    if (align === "end") {
      left = rect.right - menuWidth;
    } else if (align === "center") {
      left = rect.left + rect.width / 2 - menuWidth / 2;
    } else {
      left = rect.left;
    }

    // Clamping to screen boundaries
    const clampedLeft = Math.max(
      padding,
      Math.min(window.innerWidth - menuWidth - padding, left),
    );
    const clampedTop = Math.max(padding, top);

    setCoords({ x: clampedLeft, y: clampedTop });
  }, [align, side]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      calculatePosition();
      setActiveIndex(-1);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [disabled, isOpen, calculatePosition]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, []);

  // Update position on scroll/resize when open
  useEffect(() => {
    if (!isOpen) return;

    calculatePosition();

    function onScrollOrResize() {
      calculatePosition();
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, calculatePosition]);

  // Outside click dismissal
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    }

    function handleGlobalKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isOpen, handleClose]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
        setActiveIndex(0);
      }
      return;
    }

    const enabledOptions = options
      .map((opt, i) => ({ opt, index: i }))
      .filter((item) => !item.opt.disabled);

    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === "Tab") {
      handleClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (enabledOptions.length === 0) return;
      const currentIdxInEnabled = enabledOptions.findIndex(
        (item) => item.index === activeIndex,
      );
      const nextIdx =
        currentIdxInEnabled === -1 ||
        currentIdxInEnabled === enabledOptions.length - 1
          ? (enabledOptions[0]?.index ?? 0)
          : (enabledOptions[currentIdxInEnabled + 1]?.index ?? 0);
      setActiveIndex(nextIdx);
      itemRefs.current[nextIdx]?.focus();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (enabledOptions.length === 0) return;
      const currentIdxInEnabled = enabledOptions.findIndex(
        (item) => item.index === activeIndex,
      );
      const prevIdx =
        currentIdxInEnabled <= 0
          ? (enabledOptions[enabledOptions.length - 1]?.index ?? 0)
          : (enabledOptions[currentIdxInEnabled - 1]?.index ?? 0);
      setActiveIndex(prevIdx);
      itemRefs.current[prevIdx]?.focus();
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      if (enabledOptions.length > 0) {
        const firstIdx = enabledOptions[0]?.index ?? 0;
        setActiveIndex(firstIdx);
        itemRefs.current[firstIdx]?.focus();
      }
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      if (enabledOptions.length > 0) {
        const lastIdx = enabledOptions[enabledOptions.length - 1]?.index ?? 0;
        setActiveIndex(lastIdx);
        itemRefs.current[lastIdx]?.focus();
      }
      return;
    }
  };

  const handleItemClick = (option: DropdownOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (option.disabled) return;
    option.onClick();
    if (closeOnSelect) {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  // Render Trigger
  let triggerElement: ReactNode = null;

  if (isValidElement(children)) {
    const child = children as React.ReactElement<
      React.HTMLAttributes<HTMLElement> & { ref?: unknown }
    >;
    triggerElement = cloneElement(child, {
      ref: (el: HTMLElement | null) => {
        triggerRef.current = el;
        // preserve original child ref if function
        const originalRef = (child as { ref?: unknown }).ref;
        if (typeof originalRef === "function") originalRef(el);
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        child.props?.onClick?.(e);
        handleToggle();
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        child.props?.onKeyDown?.(e);
        handleKeyDown(e);
      },
      "aria-haspopup": "menu",
      "aria-expanded": isOpen,
      "aria-controls": isOpen ? menuId : undefined,
      className: cn(child.props?.className, className),
    });
  } else if (children) {
    triggerElement = (
      <div
        ref={(el) => {
          triggerRef.current = el;
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={
          ariaLabel ??
          (typeof triggerLabel === "string" ? triggerLabel : undefined)
        }
        className={cn(
          "inline-flex cursor-pointer select-none items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {children}
      </div>
    );
  } else {
    triggerElement = (
      <Button
        ref={(el) => {
          triggerRef.current = el;
        }}
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={ariaLabel ?? triggerLabel}
        className={cn("gap-2", className)}
      >
        {triggerIcon && <span className="shrink-0">{triggerIcon}</span>}
        <span>{triggerLabel}</span>
        {showChevron && (
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.4, 1] }}
            className="inline-flex shrink-0 items-center justify-center opacity-70"
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </Button>
    );
  }

  // Dropdown Menu Body Content
  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={menuId}
          ref={(node) => {
            menuRef.current = node;
            if (node) calculatePosition();
          }}
          role="menu"
          aria-label={ariaLabel ?? triggerLabel}
          tabIndex={-1}
          custom={side}
          variants={MENU_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={
            usePortal
              ? {
                  position: "fixed",
                  top: `${coords.y}px`,
                  left: `${coords.x}px`,
                }
              : {}
          }
          className={cn(
            "glass-dropdown z-9999 min-w-54 max-w-88 overflow-hidden rounded-2xl",
            "border border-sky-100/90 bg-white/95 p-1.5 shadow-[0_14px_40px_-6px_rgba(14,165,233,0.18),0_4px_16px_-2px_rgba(15,23,42,0.08)]",
            "backdrop-blur-xl dark:border-sky-900/50 dark:bg-slate-900/95 dark:shadow-[0_18px_44px_rgba(0,0,0,0.6)]",
            !usePortal &&
              (side === "top"
                ? "absolute bottom-full mb-2"
                : "absolute top-full mt-2"),
            !usePortal &&
              (align === "end"
                ? "right-0"
                : align === "center"
                  ? "left-1/2 -translate-x-1/2"
                  : "left-0"),
            menuClassName,
          )}
        >
          {headerSlot && (
            <div className="border-b border-sky-100/80 px-3 py-2 dark:border-slate-800">
              {headerSlot}
            </div>
          )}

          {options.length === 0 ? (
            <div className="py-3 px-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div className={cn("flex flex-col gap-0.5", headerSlot && "pt-1")}>
              {options.map((option, idx) => {
                const isDestructive = option.variant === "destructive";
                const isBrand = option.variant === "brand";

                return (
                  <div key={`opt-${idx}-${option.label}`}>
                    {option.separator && idx > 0 && (
                      <div
                        className="my-1 border-t border-sky-100/70 dark:border-slate-800"
                        role="separator"
                      />
                    )}
                    <motion.button
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      role="menuitem"
                      variants={ITEM_VARIANTS}
                      whileHover={option.disabled ? {} : { x: 3 }}
                      whileTap={option.disabled ? {} : { scale: 0.98 }}
                      disabled={option.disabled}
                      onClick={(e) => handleItemClick(option, e)}
                      onMouseEnter={() =>
                        !option.disabled && setActiveIndex(idx)
                      }
                      tabIndex={option.disabled ? -1 : 0}
                      className={cn(
                        "group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-medium",
                        "transition-all duration-150 outline-none select-none cursor-pointer",
                        // Default variant
                        !isDestructive &&
                          !isBrand && [
                            "text-slate-700 dark:text-slate-200",
                            "hover:bg-linear-to-r hover:from-sky-50 hover:to-cyan-50/70 hover:text-brand-600",
                            "focus-visible:bg-sky-50 focus-visible:text-brand-600",
                            "dark:hover:bg-slate-800/80 dark:hover:text-cyan-300 dark:focus-visible:bg-slate-800",
                          ],
                        // Brand variant
                        isBrand && [
                          "text-brand-600 dark:text-cyan-400 font-semibold",
                          "hover:bg-brand-50/80 hover:text-brand-700",
                          "focus-visible:bg-brand-50 focus-visible:text-brand-700",
                          "dark:hover:bg-brand-950/40 dark:hover:text-cyan-300 dark:focus-visible:bg-brand-950/40",
                        ],
                        // Destructive variant
                        isDestructive && [
                          "text-error-600 dark:text-error-400 text-rose-600 dark:text-rose-400",
                          "hover:bg-error-50 hover:text-error-700 dark:hover:bg-error-950/50 dark:hover:text-error-300",
                          "focus-visible:bg-error-50 focus-visible:text-error-700 dark:focus-visible:bg-error-950/50",
                        ],
                        // Disabled variant
                        option.disabled &&
                          "cursor-not-allowed opacity-40 pointer-events-none",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {option.Icon && (
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110",
                              isDestructive
                                ? "text-error-500 text-rose-500 dark:text-error-400"
                                : isBrand
                                  ? "text-brand-500 dark:text-cyan-400"
                                  : "text-slate-500 group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-cyan-300",
                            )}
                          >
                            {option.Icon}
                          </span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate leading-tight">
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="truncate text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                              {option.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {option.badge && (
                        <span className="shrink-0">{option.badge}</span>
                      )}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          )}

          {footerSlot && (
            <div className="mt-1 border-t border-sky-100/80 px-3 py-2 dark:border-slate-800">
              {footerSlot}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {triggerElement}
      {mounted && usePortal
        ? createPortal(
            menuContent,
            (triggerRef.current?.closest("dialog") as HTMLElement | null) ??
              document.body,
          )
        : menuContent}
    </>
  );
}
