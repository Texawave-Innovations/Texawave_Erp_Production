import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-gray-500 text-brand-600 shadow-theme-xs hover:border-gray-700",
          "focus:outline-none focus:ring-3 focus:ring-brand-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:border-gray-300",
          "dark:border-gray-500 dark:bg-gray-dark dark:hover:border-gray-400 dark:disabled:border-gray-700",
          className,
        )}
        {...props}
      />
    );
  },
);
