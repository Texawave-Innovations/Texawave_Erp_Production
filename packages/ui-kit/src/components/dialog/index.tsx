"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";

export type DialogSize =
  "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";

export type DialogTone = "brand" | "danger";

const BANNER_TONE: Record<DialogTone, string> = {
  brand:
    "bg-linear-135 from-[#38bdf8] via-[#0ea5e9] to-[#2dd4bf] dark:bg-linear-to-r dark:from-[#131722] dark:via-[#0E111A] dark:to-[#08090D] dark:border-b dark:border-[#1C2029]",
  danger:
    "bg-linear-135 from-error-500 via-error-600 to-error-700 dark:bg-linear-to-r dark:from-[#2a1215] dark:via-[#1f0f12] dark:to-[#120a0c] dark:border-b dark:border-[#3a1a1e]",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** A string gets the standard title; a node is rendered as given. */
  title?: ReactNode | string | undefined;
  /** A muted line under the title (a code, a contact, a date range). */
  subtitle?: ReactNode | undefined;
  /** An icon, shown in a tinted tile before the title (else a small dot). */
  icon?: ReactNode | undefined;
  /** Chips beside the title (a status, a code). */
  badge?: ReactNode | undefined;
  /** Buttons on the right of the banner (they get the glass style). */
  actions?: ReactNode | undefined;
  /** Banner colour: brand (default) or danger for destructive actions. */
  tone?: DialogTone | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: DialogSize | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  showHeader?: boolean | undefined;
  showCloseButton?: boolean | undefined;
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
  subtitle,
  icon,
  badge,
  actions,
  tone = "brand",
  children,
  footer,
  size = "lg",
  className,
  contentClassName,
  showHeader = true,
  showCloseButton = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  /** The body has scrolled under the header: it gets a soft shadow. */
  const [scrolled, setScrolled] = useState(false);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) setScrolled(false);
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
      aria-labelledby={shouldRenderHeader ? titleId : undefined}
      className={cn(
        "[&:not([open])]:hidden",
        "fixed inset-0 m-auto flex flex-col",
        "w-[calc(100%-2rem)] sm:w-full",
        // `h-fit`, not `h-auto`: with `inset-0` (top AND bottom set) on a
        // fixed-position box, `height: auto` resolves per spec to fill the
        // whole viewport between them, not to the content's own height.
        // `fit-content` sidesteps that rule entirely.
        "h-fit max-h-[calc(100dvh-2.5rem)] min-h-0",
        "rounded-2xl border border-brand-500/35 bg-white p-0 shadow-dialog-glow backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm",
        "dark:border-brand-400/40 dark:bg-gray-dark",
        resolvedSizeClass,
        className,
      )}
    >
      {/* Without a header the dialog keeps a thin brand accent bar. */}
      {shouldRenderHeader ? null : (
        <div className="h-1 w-full shrink-0 rounded-t-2xl bg-linear-to-r from-brand-400 via-brand-500 to-brand-600" />
      )}

      {/* Banner header: the same look as a page banner (PageHeader). */}
      {shouldRenderHeader ? (
        <div
          className={cn(
            "shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-t-2xl px-5 sm:px-6 py-4 text-white transition-shadow",
            BANNER_TONE[tone],
            scrolled && "shadow-[0_8px_14px_-10px_rgba(15,23,42,0.45)]",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            {icon ? (
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm dark:bg-[#161B26] dark:text-sky-400 [&_svg]:h-5 [&_svg]:w-5"
              >
                {icon}
              </span>
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white ring-4 ring-white/25" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                {typeof title === "string" ? (
                  <h2
                    id={titleId}
                    className="min-w-0 truncate text-lg font-bold tracking-tight text-white"
                  >
                    {title}
                  </h2>
                ) : (
                  // A custom title keeps its layout; its own colours would clash with the
                  // banner, so everything in it is forced to white.
                  <div
                    id={titleId}
                    className="min-w-0 text-white [&_*]:text-white!"
                  >
                    {title}
                  </div>
                )}
                {badge}
              </div>
              {subtitle ? (
                <div className="text-theme-xs text-white/85 sm:text-theme-sm">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {actions ? (
              <div className="banner-actions flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            ) : null}
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Content Area with Content-Aware Sizing and Single Scroll Region */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6",
          contentClassName,
        )}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}
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
