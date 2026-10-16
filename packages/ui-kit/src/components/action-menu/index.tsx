"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | undefined;
  icon?: ReactNode | undefined;
  disabled?: boolean | undefined;
  separator?: boolean | undefined;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel: string;
  triggerIcon?: "vertical" | "horizontal" | undefined;
  buttonClassName?: string | undefined;
  className?: string | undefined;
  menuClassName?: string | undefined;
  portal?: boolean | undefined;
}

interface Coords {
  top: number;
  left: number;
  placement: "bottom" | "top";
}

function computeMenuCoords(
  triggerEl: HTMLElement,
  menuEl?: HTMLElement | null,
): Coords {
  const rect = triggerEl.getBoundingClientRect();
  const menuWidth = menuEl?.offsetWidth || 180;
  const menuHeight = menuEl?.offsetHeight || 190;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  // Flip upward if constrained below and more space is available above
  const shouldFlip = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow;

  let top = shouldFlip ? rect.top - menuHeight - 6 : rect.bottom + 6;
  if (top < 8) top = 8;
  if (top + menuHeight > window.innerHeight - 8) {
    top = window.innerHeight - menuHeight - 8;
  }

  // Align right edge of menu to right edge of trigger button
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8;
  }

  return {
    top,
    left,
    placement: shouldFlip ? "top" : "bottom",
  };
}

function MoreVerticalIcon({
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
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MoreHorizontalIcon({
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
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Reusable, accessible ActionMenu component conforming to TexaOne design system.
 * Renders an accessible trigger button and a floating, portal-mounted dropdown menu
 * with collision detection and auto-flip behavior to prevent table clipping.
 */
export function ActionMenu({
  items,
  ariaLabel,
  triggerIcon = "vertical",
  buttonClassName,
  className,
  menuClassName,
  portal = true,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    setCoords(computeMenuCoords(triggerRef.current, menuRef.current));
  }, []);

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

  const handleToggle = () => {
    if (!open) {
      if (triggerRef.current) {
        setCoords(computeMenuCoords(triggerRef.current, menuRef.current));
      }
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const menuNode =
    open && (!portal || coords) ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        style={
          portal && coords
            ? {
                position: "fixed",
                top: `${coords.top}px`,
                left: `${coords.left}px`,
              }
            : undefined
        }
        className={cn(
          "glass-dropdown z-50 min-w-44 rounded-2xl p-1.5 shadow-theme-lg",
          "animate-in fade-in-0 zoom-in-95 duration-100 ease-out",
          "motion-reduce:animate-none motion-reduce:transition-none",
          portal
            ? coords?.placement === "top"
              ? "origin-bottom-right"
              : "origin-top-right"
            : "absolute right-0 mt-1",
          menuClassName,
        )}
      >
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            {item.separator && (
              <div
                role="separator"
                className="my-1 border-t border-gray-100 dark:border-gray-800"
              />
            )}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-xs font-medium transition-colors",
                item.disabled
                  ? "cursor-not-allowed opacity-50"
                  : item.variant === "destructive"
                    ? "text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60",
              )}
            >
              {item.icon && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors",
          buttonClassName,
        )}
      >
        {triggerIcon === "horizontal" ? (
          <MoreHorizontalIcon className="h-4 w-4" />
        ) : (
          <MoreVerticalIcon className="h-4 w-4" />
        )}
      </button>

      {portal && mounted && typeof document !== "undefined"
        ? menuNode && createPortal(menuNode, document.body)
        : menuNode}
    </div>
  );
}
