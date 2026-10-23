"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

export type DialogSize =
  "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode | string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: DialogSize | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  showHeader?: boolean | undefined;
}

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-[calc(100vw-2rem)]",
};

/**
 * Built on the native `<dialog>` element on purpose: `showModal()` gives us
 * a real focus trap, Esc-to-close, and a backdrop for free instead of
 * hand-rolling that accessibility logic (Docs/DESIGN_SYSTEM.md "Accessibility expectations").
 *
 * Implements content-aware sizing: adapts dynamically to the natural height of its
 * content, constrained by the viewport (with safe margins), and handles smooth internal
 * scrolling without clipping or nested scrollbars.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "lg",
  className,
  contentClassName,
  showHeader = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Prevent background page scrolling when modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [open]);

  // Click outside modal backdrop to close safely
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = ref.current;
    if (!dialog) return;
    // Clicks on backdrop target the dialog itself
    if (e.target !== dialog) return;

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

  const hasCustomMaxWidth = Boolean(className && /\bmax-w-/.test(className));
  const resolvedSizeClass = hasCustomMaxWidth ? "" : SIZE_CLASSES[size];
  const shouldRenderHeader =
    showHeader && title !== undefined && title !== null && title !== "";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleClick}
      aria-labelledby={shouldRenderHeader ? "dialog-title" : undefined}
      className={cn(
        "[&:not([open])]:hidden",
        "fixed inset-0 m-auto flex flex-col",
        "w-[calc(100%-2rem)] sm:w-full",
        "h-auto max-h-[calc(100dvh-2.5rem)] min-h-0",
        "rounded-2xl border border-brand-500/35 bg-white p-0 shadow-dialog-glow backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm",
        "dark:border-brand-400/40 dark:bg-gray-dark",
        resolvedSizeClass,
        className,
      )}
    >
      {/* Top brand accent bar */}
      <div className="h-1 w-full bg-linear-to-r from-brand-400 via-brand-500 to-brand-600 shrink-0 rounded-t-2xl" />

      {/* Optional Sticky Header */}
      {shouldRenderHeader ? (
        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-5 sm:px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-500/20 dark:bg-brand-400 dark:ring-brand-400/20" />
            {typeof title === "string" ? (
              <h2
                id="dialog-title"
                className="text-theme-sm font-semibold tracking-tight text-gray-900 dark:text-white/90 truncate"
              >
                {title}
              </h2>
            ) : (
              title
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
      ) : null}

      {/* Content Area with Content-Aware Sizing and Single Scroll Region */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6",
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* Optional Sticky Footer */}
      {footer ? (
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-5 sm:px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900/50 rounded-b-2xl">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
