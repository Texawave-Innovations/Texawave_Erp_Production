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
    "bg-gradient-to-r from-[#469ff6] via-[#2a80e8] to-[#2067d2] text-white font-semibold border border-transparent shadow-[0_2px_8px_rgba(32,103,210,0.18),0_1px_2px_rgba(15,23,42,0.05)] hover:from-[#3a93eb] hover:via-[#2274db] hover:to-[#1a5bc2] hover:shadow-[0_4px_12px_rgba(32,103,210,0.25)] active:from-[#2a80e8] active:via-[#1c6ecd] active:to-[#154fa9] active:shadow-[0_1px_3px_rgba(21,79,169,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a80e8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 [&>svg]:text-white [&>svg]:shrink-0 transition-all duration-200",
  secondary:
    "bg-sky-50 text-[#0284c7] font-bold border border-sky-200/90 hover:bg-sky-100 hover:text-[#0369a1] hover:border-sky-300 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80 dark:hover:bg-sky-900/60 transition-all duration-200",
  glass:
    "glass-button bg-white/80 backdrop-blur-md text-[#0284c7] font-bold border border-white/95 shadow-[0_4px_14px_-2px_rgba(14,165,233,0.15),0_1px_3px_0_rgba(15,23,42,0.04),inset_0_1px_1px_0_rgba(255,255,255,1)] hover:bg-white/95 hover:text-[#0369a1] hover:border-sky-200 hover:shadow-[0_6px_20px_-2px_rgba(14,165,233,0.22)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 dark:hover:bg-sky-900/50 transition-all duration-200",
  outline:
    "bg-slate-50/90 text-slate-700 font-semibold border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-gray-dark dark:text-white/90 dark:border-gray-700 dark:hover:bg-gray-800 transition-all duration-200",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-white/90 dark:hover:bg-gray-800",
  destructive:
    "bg-error-500 text-white hover:bg-error-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 dark:bg-error-400 dark:hover:bg-error-300",
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
