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
    "bg-gradient-to-r from-[#55c9f5] via-[#318cf5] to-[#2459e8] text-white font-medium border border-transparent shadow-[0_2px_8px_rgba(36,89,232,0.22),0_1px_2px_rgba(15,23,42,0.06)] hover:from-[#42bef0] hover:via-[#257fe8] hover:to-[#1b4cdb] hover:shadow-[0_4px_14px_rgba(36,89,232,0.32)] active:from-[#2b9ce8] active:via-[#1e6edb] active:to-[#1642c5] active:shadow-[0_1px_4px_rgba(22,66,197,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#318cf5] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 [&>svg]:text-white [&>svg]:shrink-0 transition-all duration-200",
  secondary:
    "bg-white/90 text-[#0284c7] font-semibold border border-sky-200/80 hover:bg-white hover:text-[#0369a1] hover:border-sky-300 shadow-theme-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-gray-dark dark:text-sky-300 dark:border-gray-700 dark:hover:bg-gray-800 transition-all duration-200",
  glass:
    "glass-button bg-white/80 backdrop-blur-md text-[#0284c7] font-bold border border-white/95 shadow-[0_4px_14px_-2px_rgba(14,165,233,0.15),0_1px_3px_0_rgba(15,23,42,0.04),inset_0_1px_1px_0_rgba(255,255,255,1)] hover:bg-white/95 hover:text-[#0369a1] hover:border-sky-200 hover:shadow-[0_6px_20px_-2px_rgba(14,165,233,0.22)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 dark:hover:bg-sky-900/50 transition-all duration-200",
  outline:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-gray-dark dark:text-white/90 dark:border-gray-700 dark:hover:bg-gray-800",
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
