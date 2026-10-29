import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "../spinner/index";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "link"
  | "glass";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

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
  glass:
    "glass-button bg-white/80 backdrop-blur-md text-[#0284c7] font-bold border border-white/95 shadow-[0_4px_14px_-2px_rgba(14,165,233,0.15),0_1px_3px_0_rgba(15,23,42,0.04),inset_0_1px_1px_0_rgba(255,255,255,1)] hover:bg-white/95 hover:text-[#0369a1] hover:border-sky-200 hover:shadow-[0_6px_20px_-2px_rgba(14,165,233,0.22)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 dark:hover:bg-sky-900/50 transition-all duration-200",
  outline:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:outline-brand-500 dark:bg-[#121620] dark:text-white/90 dark:border-[#1C2029] dark:hover:bg-[#161B26]",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:bg-[#161B26]",
  destructive:
    "bg-error-500 text-white hover:bg-error-600 focus-visible:outline-error-500 dark:bg-rose-600 dark:hover:bg-rose-500",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600",
  link: "bg-transparent text-brand-600 hover:underline hover:bg-transparent p-0 h-auto shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400",
};

const DISABLED_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#c8d3e0] via-[#c0cedf] to-[#b8c6d8] text-white/85 shadow-none border-transparent cursor-not-allowed pointer-events-none hover:from-[#c8d3e0] hover:via-[#c0cedf] hover:to-[#b8c6d8] dark:from-[#334155] dark:via-[#293548] dark:to-[#1e293b] dark:text-white/50",
  secondary: "opacity-50 cursor-not-allowed pointer-events-none",
  glass: "opacity-50 cursor-not-allowed pointer-events-none",
  outline: "opacity-50 cursor-not-allowed pointer-events-none",
  ghost: "opacity-50 cursor-not-allowed pointer-events-none",
  destructive: "opacity-50 cursor-not-allowed pointer-events-none",
  success: "opacity-50 cursor-not-allowed pointer-events-none",
  link: "opacity-50 cursor-not-allowed pointer-events-none",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-theme-xs gap-1.5",
  md: "h-10 px-4.5 text-theme-sm gap-2",
  lg: "h-12 px-6 text-theme-sm gap-2.5",
  icon: "h-9 w-9 p-0 text-theme-sm gap-0",
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
    const isActuallyDisabled = Boolean(disabled && !loading);

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-variant={variant}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium shadow-theme-xs whitespace-nowrap shrink-0 transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isActuallyDisabled
            ? DISABLED_CLASSES[variant]
            : cn(
                VARIANT_CLASSES[variant],
                loading && "cursor-wait opacity-95 pointer-events-none",
              ),
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner
            className={cn(
              "h-4 w-4 shrink-0",
              variant === "primary" ? "text-white" : "text-current",
            )}
            aria-hidden
          />
        ) : null}
        {children}
      </button>
    );
  },
);
