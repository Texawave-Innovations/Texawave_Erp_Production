import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "../spinner/index";

export type ButtonVariant =
  "primary" | "secondary" | "outline" | "ghost" | "destructive";
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
    "bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 hover:from-blue-700 hover:via-brand-600 hover:to-cyan-600 active:from-blue-800 active:via-brand-700 active:to-cyan-700 text-white shadow-theme-xs hover:shadow-theme-sm focus-visible:outline-brand-500 dark:bg-linear-135 dark:from-blue-600 dark:via-brand-500 dark:to-cyan-500 dark:hover:from-blue-500 dark:hover:via-brand-400 dark:hover:to-cyan-400 dark:active:from-blue-700 dark:active:via-brand-600 dark:active:to-cyan-600 dark:text-white dark:shadow-[0_0_14px_rgba(6,182,212,0.25)] transition-all duration-200",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:outline-brand-500 dark:bg-[#121620] dark:text-white/90 dark:border-[#1C2029] dark:hover:bg-[#161B26]",
  outline:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:outline-brand-500 dark:bg-[#121620] dark:text-white/90 dark:border-[#1C2029] dark:hover:bg-[#161B26]",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:bg-[#161B26]",
  destructive:
    "bg-error-500 text-white hover:bg-error-600 focus-visible:outline-error-500 dark:bg-rose-600 dark:hover:bg-rose-500",
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
          "inline-flex items-center justify-center rounded-lg font-medium shadow-theme-xs transition-colors whitespace-nowrap shrink-0",
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
