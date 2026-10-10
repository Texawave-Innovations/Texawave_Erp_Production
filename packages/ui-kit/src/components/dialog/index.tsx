"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: DialogSize;
  className?: string;
}

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

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
  size = "lg",
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

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = ref.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInsideDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInsideDialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleClick}
      aria-labelledby="dialog-title"
      className={cn(
        "[&:not([open])]:hidden",
        "fixed inset-0 m-auto w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-brand-500/35 bg-white p-0 shadow-dialog-glow backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm",
        "dark:border-brand-400/40 dark:bg-gray-dark",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <div className="flex flex-col max-h-[calc(100dvh-2rem)] h-full">
        <div className="h-1 w-full bg-linear-to-r from-brand-400 via-brand-500 to-brand-600 shrink-0" />
        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-5 sm:px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-brand-500 ring-4 ring-brand-500/20 dark:bg-brand-400 dark:ring-brand-400/20" />
            <h2
              id="dialog-title"
              className="text-theme-sm font-semibold tracking-tight text-gray-900 dark:text-white/90"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </dialog>
  );
}
