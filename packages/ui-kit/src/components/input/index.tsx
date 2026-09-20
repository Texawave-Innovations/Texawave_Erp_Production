import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs",
        "placeholder:text-gray-400",
        "focus:outline-none focus:ring-3",
        "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
        "dark:bg-gray-dark dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-gray-800",
        invalid
          ? "border-error-500 focus:border-error-500 focus:ring-error-500/20 dark:border-error-400"
          : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700",
        className,
      )}
      {...props}
    />
  );
});
