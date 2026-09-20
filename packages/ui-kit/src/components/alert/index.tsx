import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title: string;
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
  className,
  children,
  ...props
}: AlertProps) {
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
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <div className="opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}
