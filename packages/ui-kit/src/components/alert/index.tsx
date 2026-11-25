"use client";

import { useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title: string;
  /** When set, a close (×) button is shown and calls this. The caller owns
   * the visibility state; omit it for alerts that must stay on screen. */
  onClose?: (() => void) | undefined;
  /** Shows a close (×) button that hides the alert by itself. It comes back
   * on the next mount, so use it for advisory notices only. Ignored when
   * `onClose` is given. */
  dismissible?: boolean | undefined;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "bg-brand-25 border-brand-200 text-brand-800 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-200",
  success:
    "bg-success-25 border-success-200 text-success-800 dark:bg-success-950 dark:border-success-800 dark:text-success-200",
  warning:
    "bg-warning-25 border-warning-200 text-warning-800 dark:bg-warning-950 dark:border-warning-800 dark:text-warning-200",
  error:
    "bg-error-25 border-error-200 text-error-800 dark:bg-error-950 dark:border-error-800 dark:text-error-200",
};

// Distinct glyph per variant, not just color — a colorblind user or a
// grayscale printout can still tell them apart (Docs/DESIGN_SYSTEM.md
// "Never rely on color alone").
const VARIANT_ICON: Record<AlertVariant, ReactNode> = {
  info: <span aria-hidden>ℹ</span>,
  success: <span aria-hidden>✓</span>,
  warning: <span aria-hidden>▲</span>,
  error: <span aria-hidden>✕</span>,
};

export function Alert({
  variant = "info",
  title,
  onClose,
  dismissible = false,
  className,
  children,
  ...props
}: AlertProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const close = onClose ?? (dismissible ? () => setHidden(true) : undefined);
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-theme-sm",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      <div className="text-base leading-none">{VARIANT_ICON[variant]}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <div className="opacity-90">{children}</div> : null}
      </div>
      {close ? (
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="-m-1 inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
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
  );
}
