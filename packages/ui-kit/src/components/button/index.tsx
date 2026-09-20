import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "../spinner/index";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// Complete literal class maps — see Docs/DESIGN_SYSTEM.md "Tailwind class
// literals": never interpolate a variant into a class name string.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-500 dark:bg-brand-400 dark:hover:bg-brand-300 dark:text-gray-900",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:outline-brand-500 dark:bg-gray-dark dark:text-white/90 dark:border-gray-700 dark:hover:bg-gray-800",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:bg-gray-800",
  destructive:
    "bg-error-500 text-white hover:bg-error-600 focus-visible:outline-error-500 dark:bg-error-400 dark:hover:bg-error-300",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-theme-xs gap-1.5",
  md: "h-10 px-4 text-theme-sm gap-2",
  lg: "h-12 px-5 text-theme-sm gap-2",
};

/**
 * The one button in the app — every button, everywhere, is this component
 * with props, never a bespoke `<button className="...">`
 * (Docs/DESIGN_SYSTEM.md "Shared component contracts").
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium shadow-theme-xs transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner className="h-4 w-4" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
