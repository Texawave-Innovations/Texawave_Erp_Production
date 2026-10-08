"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel: string;
}

/**
 * Accessible table row action menu (⋮).
 * Replaces bulky row action buttons with a clean, keyboard-accessible dropdown.
 * Conforms to Docs/DESIGN_SYSTEM.md and Docs/CODING_STANDARDS.md.
 */
export function ActionMenu({ items, ariaLabel }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 z-40 mt-1 min-w-40 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-md dark:border-gray-800 dark:bg-gray-dark animate-in fade-in zoom-in-95 duration-100"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-xs font-medium transition-colors ${
                item.disabled
                  ? "cursor-not-allowed opacity-50"
                  : item.variant === "destructive"
                    ? "text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
              }`}
            >
              {item.icon && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
