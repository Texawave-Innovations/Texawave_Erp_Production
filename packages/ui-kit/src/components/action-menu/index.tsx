"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

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
 * Renders an accessible trigger button and a keyboard-navigable dropdown menu.
 */
export function ActionMenu({
  items,
  ariaLabel,
  triggerIcon = "vertical",
  buttonClassName,
  className,
  menuClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
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
        onClick={() => setOpen((prev) => !prev)}
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

      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={cn(
            "glass-dropdown absolute right-0 z-40 mt-1 min-w-40 rounded-2xl p-1.5 shadow-theme-md animate-in fade-in zoom-in-95 duration-100",
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
      )}
    </div>
  );
}
