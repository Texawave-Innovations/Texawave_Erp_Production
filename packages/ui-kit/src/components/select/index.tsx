import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid = false, className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs",
          "focus:outline-none focus:ring-3",
          "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-300",
          "dark:bg-gray-dark dark:text-white/90 dark:disabled:bg-[#121620] dark:disabled:border-[#1C2029]",
          invalid
            ? "border-error-500 focus:border-error-500 focus:ring-error-500/20 dark:border-error-400"
            : "border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-brand-500/20 dark:border-[#1C2029] dark:hover:border-gray-600 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
