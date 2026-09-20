"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Built on the native `<dialog>` element on purpose: `showModal()` gives us
 * a real focus trap, Esc-to-close, and a backdrop for free instead of
 * hand-rolling that accessibility logic (Docs/DESIGN_SYSTEM.md
 * "Accessibility expectations").
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className={cn(
        "w-full max-w-lg rounded-xl border border-gray-200 bg-white p-0 shadow-theme-xl backdrop:bg-gray-900/50",
        "dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2
          id="dialog-title"
          className="text-theme-sm font-semibold text-gray-900 dark:text-white/90"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
